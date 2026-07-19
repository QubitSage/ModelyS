'use client'

import { useRef, useState } from 'react'
import { ClientIndex, QCFinding } from '@/lib/types'

interface BatchResult {
  total: number
  aprovados: number
  revisar: number
  aiUsed: number
  results: Array<{
    id: string
    content: string
    status: 'aprovado' | 'ambiguo' | 'flagado'
    findings: QCFinding[]
    ai?: { verdict: string; motivo: string; sugestao: string }
  }>
}

export default function QcBatchView({ clients, onOpenEsteira }: { clients: ClientIndex[]; onOpenEsteira?: () => void }) {
  const [content, setContent] = useState('')
  const [clientId, setClientId] = useState('')
  const [useAi, setUseAi] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<BatchResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function loadFile(files: FileList | null) {
    const f = files?.[0]
    if (!f) return
    setContent(await f.text())
  }

  async function run() {
    if (!content.trim() || busy) return
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/qc/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, clientId: clientId || undefined, useAi }),
      })
      const data = await res.json()
      if (data.error) setError(data.error)
      else setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'erro')
    } finally {
      setBusy(false)
    }
  }

  function download(name: string, text: string, mime = 'text/plain') {
    const blob = new Blob(['﻿' + text], { type: `${mime};charset=utf-8` })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function downloadAprovados() {
    if (!result) return
    const text = result.results
      .filter(r => r.status === 'aprovado')
      .map(r => `=== Take ${r.id} ===\n${r.content}\n`)
      .join('\n')
    download('aprovados.txt', text)
  }

  function downloadRevisar() {
    if (!result) return
    const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`
    const rows = result.results
      .filter(r => r.status !== 'aprovado')
      .map(r => {
        const motivos = [
          ...(r.ai ? [`[IA] ${r.ai.motivo}`] : []),
          ...r.findings.map(f => `[${f.regra}] ${f.motivo}`),
        ].join(' | ')
        const sugestoes = [
          ...(r.ai?.sugestao ? [`[IA] ${r.ai.sugestao}`] : []),
          ...r.findings.filter(f => f.sugestao).map(f => f.sugestao),
        ].join(' | ')
        return [r.id, r.status, motivos, sugestoes, r.content].map(esc).join(',')
      })
    download('revisar.csv', ['id,status,motivos,sugestoes,prompt', ...rows].join('\n'), 'text/csv')
  }

  const pct = result ? Math.round((result.revisar / result.total) * 100) : 0

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-[var(--card)] overflow-y-auto">
      <header className="h-14 shrink-0 border-b border-[var(--border)] flex items-center px-5">
        <h1 className="font-semibold text-[15px]">QC em lote</h1>
        <span className="ml-3 text-[12px] text-[var(--text-2)]">valide o vídeo inteiro antes de colar no Flow — 250 takes de uma vez</span>
      </header>

      <div className="p-5 space-y-4 max-w-3xl w-full">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 space-y-3">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={8}
            placeholder={'Cole aqui os takes do vídeo — ou carregue um arquivo.\nFormatos: texto (um take por bloco, separados por linha em branco), CSV (colunas prompt/duracao) ou JSON.'}
            className="w-full text-[12.5px] rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 outline-none focus:border-[var(--text-3)] resize-y font-mono"
          />
          <div className="flex items-center gap-2.5 flex-wrap">
            <input ref={fileRef} type="file" accept=".txt,.md,.csv,.json" onChange={e => loadFile(e.target.files)} className="hidden" />
            <button onClick={() => fileRef.current?.click()} className="text-[12px] px-3 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--panel-2)]">📄 carregar arquivo</button>
            <select value={clientId} onChange={e => setClientId(e.target.value)} className="text-[12px] rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 outline-none">
              <option value="">blocklist: só a global</option>
              {clients.map(c => <option key={c.id} value={c.id}>blocklist: {c.name}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-[12px] text-[var(--text-2)]">
              <input type="checkbox" checked={useAi} onChange={e => setUseAi(e.target.checked)} />
              ambíguos → Haiku (frações de centavo)
            </label>
            <button onClick={run} disabled={busy || !content.trim()} className="ml-auto text-[12.5px] px-4 py-1.5 rounded-lg bg-[var(--accent)] text-white disabled:opacity-40">
              {busy ? 'validando…' : 'Rodar QC'}
            </button>
          </div>
          {error && <p className="text-[12px] text-[var(--red)]">{error}</p>}
        </div>

        {result && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3.5 text-center">
                <p className="text-2xl font-semibold">{result.total}</p>
                <p className="text-[11px] text-[var(--text-3)] uppercase tracking-wide">takes lidos</p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--green-bg)] p-3.5 text-center">
                <p className="text-2xl font-semibold text-[var(--green)]">{result.aprovados}</p>
                <p className="text-[11px] text-[var(--text-3)] uppercase tracking-wide">prontos pro Flow</p>
              </div>
              <div className={`rounded-xl border border-[var(--border)] p-3.5 text-center ${result.revisar ? 'bg-[var(--amber-bg)]' : 'bg-[var(--panel)]'}`}>
                <p className={`text-2xl font-semibold ${result.revisar ? 'text-[var(--amber)]' : ''}`}>{result.revisar}</p>
                <p className="text-[11px] text-[var(--text-3)] uppercase tracking-wide">pra revisar ({pct}%)</p>
              </div>
            </div>

            {result.aiUsed > 0 && (
              <p className="text-[11.5px] text-[var(--text-2)]">✦ {result.aiUsed} ambíguos julgados pelo Haiku numa chamada só.</p>
            )}
            {pct > 20 && (
              <p className="text-[11.5px] text-[var(--amber)]">△ Mais de 20% pra revisão — provável que falte regra na blocklist do cliente (painel Info do chat).</p>
            )}

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={async () => {
                  const text = result.results.filter(r => r.status === 'aprovado').map(r => `=== Take ${r.id} ===\n${r.content}\n`).join('\n')
                  await fetch('/api/esteira', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: text, nome: `QC ${new Date().toLocaleDateString('pt-BR')}` }) })
                  onOpenEsteira?.()
                }}
                disabled={!result.aprovados}
                className="text-[12.5px] px-4 py-2 rounded-lg bg-[var(--accent)] text-white disabled:opacity-40"
              >▶ enviar aprovados pra Esteira ({result.aprovados})</button>
              <button onClick={downloadAprovados} disabled={!result.aprovados} className="text-[12.5px] px-4 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--panel-2)] disabled:opacity-40">
                ⬇ aprovados.txt
              </button>
              <button onClick={downloadRevisar} disabled={!result.revisar} className="text-[12.5px] px-4 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--panel-2)] disabled:opacity-40">
                ⬇ revisar.csv ({result.revisar})
              </button>
            </div>

            <div className="space-y-2">
              {result.results.filter(r => r.status !== 'aprovado').map(r => (
                <div key={r.id} className={`rounded-xl border p-3 text-[12px] ${r.status === 'flagado' ? 'border-[var(--red)] bg-[var(--red-bg)]' : 'border-[var(--amber)] bg-[var(--amber-bg)]'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">Take {r.id}</span>
                    <span className="text-[10px] uppercase tracking-wide opacity-70">{r.status}</span>
                  </div>
                  {r.ai && <p><b>[IA]</b> {r.ai.motivo} {r.ai.sugestao && <span className="text-[var(--text-2)]">→ {r.ai.sugestao}</span>}</p>}
                  {r.findings.map((f, i) => (
                    <p key={i}>[{f.regra}] {f.motivo} {f.sugestao && <span className="text-[var(--text-2)]">→ {f.sugestao}</span>}</p>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
