'use client'

import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface ToolJob {
  id: string
  type: 'video' | 'audio' | 'image'
  label: string
  status: 'processing' | 'done' | 'error'
  result?: string
  error?: string
  createdAt: string
}

const TYPES = [
  { id: 'video' as const, label: 'Analisar vídeo ref', desc: 'grade de takes, mapa de cortes, DNA visual, transcrição' },
  { id: 'audio' as const, label: 'Transcrever áudio', desc: 'transcrição PT-BR com pontuação' },
  { id: 'image' as const, label: 'Analisar imagem', desc: 'descrição de estilo + prompt de recriação' },
]

interface DownloadJob {
  id: string
  url: string
  status: 'baixando' | 'concluido' | 'erro'
  filename?: string
  error?: string
  createdAt: string
}

function Downloads() {
  const [jobs, setJobs] = useState<DownloadJob[]>([])
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')

  async function load() {
    setJobs(await fetch('/api/downloads').then(r => r.json()))
  }
  useEffect(() => { load() }, [])
  useEffect(() => {
    if (!jobs.some(j => j.status === 'baixando')) return
    const t = setInterval(load, 3000)
    return () => clearInterval(t)
  }, [jobs])

  async function baixar() {
    if (!url.trim()) return
    setError('')
    const res = await fetch('/api/downloads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
    const data = await res.json()
    if (data.error) { setError(data.error); return }
    setUrl('')
    load()
  }

  async function open(file?: string) {
    await fetch('/api/downloads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'open', file }) })
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[13px] font-semibold">⬇ Baixar mídia — YouTube · TikTok · Instagram</h2>
        <button onClick={() => open()} className="text-[11.5px] px-2.5 py-1 rounded-lg border border-[var(--border)] hover:bg-[var(--panel-2)]">abrir pasta</button>
      </div>
      <div className="flex gap-1.5">
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && baixar()}
          placeholder="cole a URL do vídeo/reel/short…"
          className="flex-1 text-[12.5px] rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 outline-none focus:border-[var(--text-3)]"
        />
        <button onClick={baixar} disabled={!url.trim()} className="text-[12.5px] px-4 rounded-lg bg-[var(--accent)] text-white disabled:opacity-40">Baixar</button>
      </div>
      <p className="text-[10.5px] text-[var(--text-3)] mt-1.5">Instagram usa os cookies do seu Chrome logado. Arquivos ficam em data/downloads/media.</p>
      {error && <p className="text-[12px] text-[var(--red)] mt-1.5">{error}</p>}

      {jobs.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {jobs.map(j => (
            <div key={j.id} className="flex items-center gap-2.5 rounded-lg bg-[var(--card)] border border-[var(--border)] px-3 py-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                j.status === 'concluido' ? 'bg-[var(--green)]' : j.status === 'erro' ? 'bg-[var(--red)]' : 'bg-[var(--amber)] animate-pulse'
              }`} />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium truncate">{j.filename || j.url}</p>
                {j.error && <p className="text-[10.5px] text-[var(--red)] truncate">{j.error}</p>}
              </div>
              {j.status === 'concluido' && j.filename && (
                <button onClick={() => open(j.filename)} className="text-[11px] px-2 py-0.5 rounded border border-[var(--border)] text-[var(--text-2)] hover:bg-[var(--panel-2)]">abrir</button>
              )}
              <button onClick={async () => { await fetch(`/api/downloads?id=${j.id}`, { method: 'DELETE' }); load() }} className="text-[11px] text-[var(--text-3)] hover:text-[var(--red)] px-1">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ToolsView() {
  const [jobs, setJobs] = useState<ToolJob[]>([])
  const [type, setType] = useState<ToolJob['type']>('video')
  const [uploading, setUploading] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function load() {
    const res = await fetch('/api/tools/jobs')
    setJobs(await res.json())
  }

  useEffect(() => { load() }, [])

  // polling enquanto houver job processando
  useEffect(() => {
    if (!jobs.some(j => j.status === 'processing')) return
    const t = setInterval(load, 4000)
    return () => clearInterval(t)
  }, [jobs])

  async function upload(files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const form = new FormData()
        form.append('file', file)
        form.append('type', type)
        await fetch('/api/tools/jobs', { method: 'POST', body: form })
      }
      await load()
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const accept = type === 'video' ? 'video/*' : type === 'audio' ? 'audio/*,video/*' : 'image/*'

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-[var(--card)] overflow-y-auto">
      <header className="h-14 shrink-0 border-b border-[var(--border)] flex items-center px-5">
        <h1 className="font-semibold text-[15px]">Ferramentas</h1>
        <span className="ml-3 text-[12px] text-[var(--text-2)]">análises via Gemini — a fila sobrevive se você fechar a aba</span>
      </header>

      <div className="p-5 space-y-5 max-w-3xl w-full">
        <Downloads />

        {/* Envio */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4">
          <div className="flex gap-1.5 mb-3">
            {TYPES.map(t => (
              <button
                key={t.id}
                onClick={() => setType(t.id)}
                className={`px-3 py-1.5 rounded-lg text-[12px] border ${
                  type === t.id ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-2)] hover:bg-[var(--panel-2)]'
                }`}
              >{t.label}</button>
            ))}
          </div>
          <p className="text-[11.5px] text-[var(--text-3)] mb-3">{TYPES.find(t => t.id === type)?.desc}</p>
          <input ref={fileRef} type="file" accept={accept} multiple onChange={e => upload(e.target.files)} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full py-6 rounded-lg border-2 border-dashed border-[var(--border)] text-[12.5px] text-[var(--text-2)] hover:border-[var(--text-3)] disabled:opacity-50"
          >
            {uploading ? 'enviando…' : 'clique pra escolher arquivo(s) — pode mandar vários de uma vez'}
          </button>
        </div>

        {/* Fila */}
        <div className="space-y-2">
          {jobs.map(j => (
            <div key={j.id} className="rounded-xl border border-[var(--border)] bg-[var(--panel)]">
              <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  j.status === 'done' ? 'bg-[var(--green)]' : j.status === 'error' ? 'bg-[var(--red)]' : 'bg-[var(--amber)] animate-pulse'
                }`} />
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium truncate">{j.label}</p>
                  <p className="text-[10.5px] text-[var(--text-3)]">
                    {TYPES.find(t => t.id === j.type)?.label} · {new Date(j.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {j.status === 'processing' && ' · processando…'}
                  </p>
                </div>
                {j.status === 'done' && (
                  <>
                    <button onClick={() => navigator.clipboard.writeText(j.result || '')} className="text-[11px] px-2 py-1 rounded border border-[var(--border)] text-[var(--text-2)] hover:bg-[var(--panel-2)]">copiar</button>
                    <button onClick={() => setOpen(open === j.id ? null : j.id)} className="text-[11px] px-2 py-1 rounded border border-[var(--border)] text-[var(--text-2)] hover:bg-[var(--panel-2)]">
                      {open === j.id ? 'fechar' : 'ver'}
                    </button>
                  </>
                )}
                <button onClick={async () => { await fetch(`/api/tools/jobs?id=${j.id}`, { method: 'DELETE' }); load() }} className="text-[11px] text-[var(--text-3)] hover:text-[var(--red)] px-1">✕</button>
              </div>
              {j.status === 'error' && <p className="px-3.5 pb-2.5 text-[11.5px] text-[var(--red)]">{j.error}</p>}
              {open === j.id && j.result && (
                <div className="border-t border-[var(--border)] px-4 py-3 prose-chat">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{j.result}</ReactMarkdown>
                </div>
              )}
            </div>
          ))}
          {jobs.length === 0 && <p className="text-[12.5px] text-[var(--text-3)] text-center py-6">Nenhuma análise ainda.</p>}
        </div>
      </div>
    </div>
  )
}
