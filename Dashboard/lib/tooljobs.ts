import fs from 'fs'
import path from 'path'
import { GoogleGenAI } from '@google/genai'
import { atomicWriteFileSync } from './store'
import { logUsage } from './costlog'
import { GEMINI_MODEL } from './ai'

// Fila persistente da aba Ferramentas: manda N análises, fecha a aba, volta
// depois — resultado sobrevive em disco. Tudo roda no Gemini (multimodal).

const JOBS_FILE = path.join(process.cwd(), 'data', 'tool-jobs.json')
const MAX_JOBS = 120
const STALE_MS = 20 * 60 * 1000

export type ToolJobType = 'video' | 'audio' | 'image'

export interface ToolJob {
  id: string
  type: ToolJobType
  label: string
  status: 'processing' | 'done' | 'error'
  result?: string
  error?: string
  createdAt: string
  finishedAt?: string
}

const PROMPTS: Record<ToolJobType, string> = {
  video: `Analise este vídeo de referência para replicação em gerador de vídeo IA (Gemini Omni Flash/Flow). Entregue em português:
1. **Duração e grade**: duração total em segundos; grade de takes de 10s + resto.
2. **Mapa de cortes**: cada corte/plano com timestamp (MM:SS.d), enquadramento e movimento de câmera.
3. **DNA visual**: luz, paleta, lente/DOF, textura/grain, ritmo de edição.
4. **Áudio**: fala (transcreva), música, SFX relevantes.
5. **Elementos fixos**: personagens/produtos/cenários que precisariam de referência visual.`,
  audio: 'Transcreva este áudio em português brasileiro com pontuação correta. Se houver mais de um falante, identifique-os. Retorne apenas a transcrição.',
  image: `Descreva esta imagem para uso como referência em gerador de imagem/vídeo IA. Em português: composição, enquadramento, luz, paleta, textura, estilo. Depois, um prompt em inglês que recriaria uma imagem no MESMO estilo (sem descrever pessoas como IA — trate como fotografia real).`,
}

export function readJobs(): ToolJob[] {
  try {
    const jobs: ToolJob[] = JSON.parse(fs.readFileSync(JOBS_FILE, 'utf-8'))
    let changed = false
    for (const j of jobs) {
      if (j.status === 'processing' && Date.now() - new Date(j.createdAt).getTime() > STALE_MS) {
        j.status = 'error'
        j.error = 'Interrompido (servidor reiniciou no meio) — envie de novo.'
        changed = true
      }
    }
    if (changed) saveJobs(jobs)
    return jobs
  } catch {
    return []
  }
}

function saveJobs(jobs: ToolJob[]) {
  try {
    atomicWriteFileSync(JOBS_FILE, JSON.stringify(jobs.slice(-MAX_JOBS), null, 2))
  } catch { /* bookkeeping não derruba o processamento */ }
}

function updateJob(id: string, patch: Partial<ToolJob>) {
  const jobs = readJobs()
  const i = jobs.findIndex(j => j.id === id)
  if (i < 0) return
  jobs[i] = { ...jobs[i], ...patch }
  saveJobs(jobs)
}

export function deleteJob(id: string) {
  saveJobs(readJobs().filter(j => j.id !== id))
}

export function startJob(type: ToolJobType, label: string, base64: string, mimeType: string): ToolJob {
  const job: ToolJob = {
    id: `tj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    label: label.slice(0, 120),
    status: 'processing',
    createdAt: new Date().toISOString(),
  }
  saveJobs([...readJobs(), job])

  // fire-and-forget: o job roda no fundo, o cliente faz polling
  ;(async () => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' })
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ parts: [{ inlineData: { mimeType, data: base64 } }, { text: PROMPTS[type] }] }],
      })
      const meta = response.usageMetadata
      logUsage(`tool-${type}`, GEMINI_MODEL, meta?.promptTokenCount ?? 0, meta?.candidatesTokenCount ?? 0)
      updateJob(job.id, { status: 'done', result: response.text?.trim() || '(vazio)', finishedAt: new Date().toISOString() })
    } catch (err) {
      updateJob(job.id, {
        status: 'error',
        error: err instanceof Error ? err.message : 'erro desconhecido',
        finishedAt: new Date().toISOString(),
      })
    }
  })()

  return job
}
