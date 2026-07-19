// Download de mídia (YouTube / TikTok / Instagram) via yt-dlp instalado na
// máquina. Instagram usa os cookies do Chrome logado (--cookies-from-browser).

import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { atomicWriteFileSync } from './store'

const DL_DIR = path.join(process.cwd(), 'data', 'downloads')
export const MEDIA_DIR = path.join(DL_DIR, 'media')
const INDEX = path.join(DL_DIR, 'index.json')

export interface DownloadJob {
  id: string
  url: string
  status: 'baixando' | 'concluido' | 'erro'
  filename?: string
  error?: string
  createdAt: string
}

function ensure() {
  fs.mkdirSync(MEDIA_DIR, { recursive: true })
}

export function listJobs(): DownloadJob[] {
  try { return JSON.parse(fs.readFileSync(INDEX, 'utf-8')) } catch { return [] }
}

function saveJobs(jobs: DownloadJob[]) {
  ensure()
  atomicWriteFileSync(INDEX, JSON.stringify(jobs.slice(-100), null, 2))
}

function patchJob(id: string, patch: Partial<DownloadJob>) {
  const jobs = listJobs()
  const i = jobs.findIndex(j => j.id === id)
  if (i >= 0) { jobs[i] = { ...jobs[i], ...patch }; saveJobs(jobs) }
}

export function deleteJob(id: string, removeFile: boolean) {
  const jobs = listJobs()
  const job = jobs.find(j => j.id === id)
  if (removeFile && job?.filename) {
    try { fs.unlinkSync(path.join(MEDIA_DIR, job.filename)) } catch { /* já foi */ }
  }
  saveJobs(jobs.filter(j => j.id !== id))
}

export function startDownload(url: string): DownloadJob {
  ensure()
  const job: DownloadJob = {
    id: `dl_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    url,
    status: 'baixando',
    createdAt: new Date().toISOString(),
  }
  saveJobs([...listJobs(), job])

  const isIG = /instagram\.com/i.test(url)
  const bin = process.env.YTDLP_PATH || 'yt-dlp'

  // Instagram: método aprovado (Playwright + perfil logado) via script Python —
  // carrossel por scraping, vídeo por yt-dlp com os cookies do MESMO perfil.
  // Roda local (precisa de navegador/sessão logada). Ver scripts/instagram_dl.py.
  if (isIG) { runInstagram(job.id, url, bin); return job }

  const args = [
    url,
    '--no-playlist',
    // formato único (sem exigir ffmpeg pra merge); cai pro melhor disponível
    '-f', 'b[ext=mp4]/b',
    '-o', path.join(MEDIA_DIR, '%(title).70s [%(id)s].%(ext)s'),
    '--restrict-filenames',
    '--print', 'after_move:filepath',
    '--no-simulate',
    '--no-warnings',
  ]

  const proc = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
  let stdout = ''
  let stderr = ''
  proc.stdout.on('data', d => { stdout += d })
  proc.stderr.on('data', d => { stderr += d })
  const timer = setTimeout(() => { proc.kill(); patchJob(job.id, { status: 'erro', error: 'timeout (10min)' }) }, 10 * 60 * 1000)
  proc.on('error', err => {
    clearTimeout(timer)
    patchJob(job.id, { status: 'erro', error: `yt-dlp não encontrado ou falhou ao iniciar: ${err.message}` })
  })
  proc.on('close', code => {
    clearTimeout(timer)
    if (code === 0) {
      const filepath = stdout.trim().split('\n').filter(Boolean).pop() || ''
      patchJob(job.id, { status: 'concluido', filename: filepath ? path.basename(filepath) : undefined })
    } else {
      const lastErr = stderr.trim().split('\n').filter(Boolean).pop() || `saiu com código ${code}`
      patchJob(job.id, {
        status: 'erro',
        error: isIG && /login|cookie|rate|challenge/i.test(lastErr)
          ? `Instagram exige login — abra o Chrome logado no IG e tente de novo. (${lastErr.slice(0, 120)})`
          : lastErr.slice(0, 200),
      })
    }
  })

  return job
}

// Instagram via script Python (Playwright + perfil logado). Tenta `py -3.12`
// (launcher do Windows) e cai pra `python`. O script imprime RESULT=<arquivo>.
function runInstagram(jobId: string, url: string, ytdlp: string) {
  const script = path.join(process.cwd(), 'scripts', 'instagram_dl.py')
  const env = { ...process.env, OUTPUT_DIR: MEDIA_DIR, YTDLP_PATH: ytdlp }
  const attempts: Array<[string, string[]]> = process.env.PYTHON_PATH
    ? [[process.env.PYTHON_PATH, [script, url]]]
    : [['py', ['-3.12', script, url]], ['python', [script, url]]]

  let idx = 0
  const tryNext = () => {
    if (idx >= attempts.length) {
      patchJob(jobId, { status: 'erro', error: 'Python não encontrado — instale o Python 3.12 e rode o Sistema Oficial localmente (o download do Instagram não roda no servidor).' })
      return
    }
    const [cmd, args] = attempts[idx++]
    const proc = spawn(cmd, args, { env, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = '', err = ''
    proc.stdout.on('data', d => { out += d })
    proc.stderr.on('data', d => { err += d })
    const timer = setTimeout(() => { proc.kill(); patchJob(jobId, { status: 'erro', error: 'timeout (10min)' }) }, 10 * 60 * 1000)
    proc.on('error', () => { clearTimeout(timer); tryNext() }) // comando não encontrado → tenta o próximo
    proc.on('close', code => {
      clearTimeout(timer)
      const m = out.match(/RESULT=(.+)/)
      if (code === 0 && m) {
        patchJob(jobId, { status: 'concluido', filename: path.basename(m[1].trim()) })
      } else {
        const last = err.trim().split('\n').filter(Boolean).pop() || `saiu com código ${code}`
        patchJob(jobId, { status: 'erro', error: last.replace(/^!!\s*/, '').slice(0, 220) })
      }
    })
  }
  tryNext()
}
