'use client'

import { useState } from 'react'
import { ClientIndex } from '@/lib/types'

// Tópicos em Alta (Caçador de Pauta) — aba dedicada, por cliente. Descobre o
// "sobre o quê falar" (assunto quente) e devolve pauta pronta. Independente da
// Direção Criativa (que é o "como fazer").

interface Pauta { assunto: string; porque: string; gancho: string; titulo: string; legenda: string }

export default function PautaView({ clients, onUseInChat }: { clients: ClientIndex[]; onUseInChat?: (text: string) => void }) {
  const [clientId, setClientId] = useState('')
  const [tema, setTema] = useState('')
  const [busy, setBusy] = useState(false)
  const [pautas, setPautas] = useState<Pauta[] | null>(null)
  const [erro, setErro] = useState('')
  const [copied, setCopied] = useState('')

  async function buscar() {
    if (busy) return
    setBusy(true); setPautas(null); setErro('')
    try {
      const r = await fetch('/api/pauta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: clientId || undefined, tema: tema.trim() || undefined }),
      })
      const d = await r.json()
      if (!d.ok || !d.pautas?.length) setErro('Não consegui montar pautas agora — tente de novo, ou refine com um tema.')
      else setPautas(d.pautas)
    } catch {
      setErro('Falha na busca — tente de novo.')
    } finally { setBusy(false) }
  }

  async function copy(txt: string, key: string) {
    await navigator.clipboard.writeText(txt)
    setCopied(key); setTimeout(() => setCopied(''), 1200)
  }

  // leva a pauta pro chat como IDEIA já escolhida (o modelo trata como a pauta a
  // desenvolver, não como sugestão a debater)
  function usarNoChat(p: Pauta) {
    onUseInChat?.([
      `PAUTA ESCOLHIDA (assunto em alta pra desenvolver): ${p.assunto}`,
      `- Gancho: ${p.gancho}`,
      `- Título: ${p.titulo}`,
      `- Legenda: ${p.legenda}`,
      'Quero produzir um vídeo em cima desta pauta.',
    ].join('\n'))
  }

  const nomeCliente = clients.find(c => c.id === clientId)?.name

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-[var(--card)] overflow-y-auto">
      <header className="shrink-0 border-b border-[var(--border)] px-5 max-md:px-3 pt-4 pb-3">
        <h1 className="font-semibold text-[15px]">Tópicos em Alta</h1>
        <p className="text-[12px] text-[var(--text-2)]">O <b>sobre o quê</b> falar: assuntos quentes no nicho do cliente, com pauta pronta (gancho, título, legenda). Não é conceito visual — isso é na Direção Criativa.</p>
      </header>

      <div className="p-5 max-md:p-3 space-y-4 max-w-3xl w-full">
        <div className="flex items-center gap-2 flex-wrap">
          <select value={clientId} onChange={e => setClientId(e.target.value)} className="text-[12.5px] rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1.5 outline-none">
            <option value="">escolha o cliente (define o nicho e o tom)</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input value={tema} onChange={e => setTema(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscar()}
            placeholder="afinar (opcional): ex. 'aposentadoria', 'IA no trabalho'…"
            className="flex-1 min-w-[180px] text-[12.5px] rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1.5 outline-none focus:border-[var(--text-3)]" />
          <button onClick={buscar} disabled={busy} className="text-[13px] px-4 py-1.5 rounded-lg bg-[var(--accent)] text-white disabled:opacity-40">
            {busy ? 'caçando pauta na web…' : '🔥 Buscar pautas'}
          </button>
        </div>
        {!clientId && <p className="text-[11.5px] text-[var(--text-3)]">Sem cliente ele busca genérico. Escolha um cliente pra buscar no nicho e no tom dele.</p>}

        {busy && <p className="text-[12.5px] text-[var(--text-2)]">Buscando os assuntos em alta{nomeCliente ? ` no nicho de ${nomeCliente}` : ''} e montando as pautas — leva alguns segundos (busca ao vivo).</p>}
        {erro && <p className="text-[12.5px] text-[var(--red)]">{erro}</p>}

        {pautas && (
          <div className="space-y-3">
            {pautas.map((p, i) => (
              <article key={i} className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4">
                <div className="flex items-start gap-2">
                  <span className="text-[13.5px] font-semibold leading-snug flex-1">{p.assunto}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--panel-2)] text-[var(--text-3)] shrink-0">#{i + 1}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <p className="text-[11.5px] text-[var(--text-2)] flex-1 min-w-[140px]">🔥 {p.porque}</p>
                  {onUseInChat && (
                    <button onClick={() => usarNoChat(p)} className="shrink-0 text-[11px] px-2.5 py-1 rounded-full bg-[var(--accent)] text-white">✎ usar ideia no chat</button>
                  )}
                </div>

                <div className="mt-2.5 space-y-1.5">
                  <Field label="Gancho" value={p.gancho} copied={copied === `g${i}`} onCopy={() => copy(p.gancho, `g${i}`)} />
                  <Field label="Título" value={p.titulo} copied={copied === `t${i}`} onCopy={() => copy(p.titulo, `t${i}`)} />
                  <Field label="Legenda" value={p.legenda} copied={copied === `l${i}`} onCopy={() => copy(p.legenda, `l${i}`)} />
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="rounded-lg bg-[var(--card)] border border-[var(--border)] p-2.5 relative group/f">
      <span className="text-[9.5px] uppercase tracking-wider text-[var(--text-3)]">{label}</span>
      <p className="text-[12px] text-[var(--text)] leading-snug mt-0.5 pr-12">{value}</p>
      <button onClick={onCopy} className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded bg-[var(--panel-2)] text-[var(--text-2)] hover:bg-[var(--border)]">
        {copied ? '✓' : 'copiar'}
      </button>
    </div>
  )
}
