'use client'

import { useState } from 'react'
import { ClientIndex, CreativeProvider } from '@/lib/types'
import FileDrop, { AttachedFile } from './FileDrop'

// DIREÇÃO CRIATIVA — agora um COMITÊ AUTOMÁTICO (multi-agent debate). Você joga
// o pedido, as 4 IAs propõem, debatem entre si e VOTAM, e o presidente consolida
// UM consenso + o porquê. Você copia a resposta pronta pro chat (igual à Arena,
// mas sem comparar na mão). Pra quando tá com pressa e quer que elas decidam.

interface Voice { provider: CreativeProvider; label: string; text: string; ok: boolean; error?: string }
interface Final { conceito: string; tom: string; referencia: string; blocos: string[]; justificativa: string }
interface Tally { provider: CreativeProvider; label: string; votes: number }
interface DebateResult {
  ok: boolean; error?: string
  proposals: Voice[]; critiques: Voice[]
  final?: Final; chairLabel?: string; tally?: Tally[]
}

export default function DirecaoView({ clients, onUseInChat, onOpenArena }: {
  clients: ClientIndex[]; onUseInChat?: (text: string) => void; onOpenArena?: () => void
}) {
  const [idea, setIdea] = useState('')
  const [clientId, setClientId] = useState('')
  const [files, setFiles] = useState<AttachedFile[]>([])
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<DebateResult | null>(null)

  async function run() {
    if (!idea.trim() || running) return
    setRunning(true); setResult(null)
    try {
      const res = await fetch('/api/creative/debate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea, clientId: clientId || undefined, files: files.length ? files : undefined }),
      })
      setResult((await res.json()).result)
    } catch {
      setResult({ ok: false, error: 'Falha na chamada — tente de novo.', proposals: [], critiques: [] })
    } finally { setRunning(false) }
  }

  function useFinal(f: Final) {
    onUseInChat?.([
      `DIREÇÃO CRIATIVA (consenso do comitê): ${f.conceito}`,
      `Tom: ${f.tom}`, `Referência: ${f.referencia}`,
      f.blocos.length ? `Blocos: ${f.blocos.join(', ')}` : '',
      f.justificativa ? `Por que esta: ${f.justificativa}` : '',
      'Desenvolva o roteiro/pacote de takes seguindo esta direção.',
    ].filter(Boolean).join('\n'))
  }

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-[var(--card)] overflow-y-auto">
      <header className="shrink-0 border-b border-[var(--border)] px-5 max-md:px-3 pt-4 pb-3">
        <div className="flex items-start gap-3">
          <div className="min-w-0">
            <h1 className="font-semibold text-[15px]">Direção Criativa · Comitê automático</h1>
            <p className="text-[12px] text-[var(--text-2)]">Joga o pedido, as 4 IAs debatem entre si e decidem um consenso. Você copia pro chat. Pra quando tá com pressa.</p>
          </div>
          {onOpenArena && (
            <button onClick={onOpenArena} className="ml-auto shrink-0 text-[11.5px] px-2.5 py-1 rounded-lg border border-[var(--border)] hover:bg-[var(--panel-2)]">⚔ comparar na Arena</button>
          )}
        </div>
      </header>

      <div className="p-5 max-md:p-3 space-y-4 max-w-3xl w-full">
        <div className="space-y-2.5">
          <textarea value={idea} onChange={e => setIdea(e.target.value)} rows={4}
            placeholder="Jogue a ideia crua / vaga aqui — uma frase basta. Ex: 'vídeo pra vender curso de finanças pra jovem' ou cole um briefing bagunçado do cliente."
            className="w-full text-[13px] rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3 outline-none focus:border-[var(--text-3)] resize-y" />
          <FileDrop files={files} onChange={setFiles} />
          <div className="flex items-center gap-2 flex-wrap">
            <select value={clientId} onChange={e => setClientId(e.target.value)} className="text-[12px] rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 outline-none">
              <option value="">sem cliente (genérico)</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <span className="text-[11px] text-[var(--text-3)]">presidente = modelo calibrado do cliente</span>
            <button onClick={run} disabled={running || !idea.trim()} className="ml-auto text-[13px] px-4 py-1.5 rounded-lg bg-[var(--accent)] text-white disabled:opacity-40">
              {running ? 'comitê debatendo…' : '▶ Rodar comitê'}
            </button>
          </div>
        </div>

        {running && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 flex items-center gap-3 text-[12.5px] text-[var(--text-2)]">
            <span className="w-4 h-4 rounded-full border-2 border-[var(--text-3)] border-t-transparent animate-spin shrink-0" />
            <span>As 4 IAs estão <b>propondo → debatendo → votando</b>, e o presidente vai consolidar. Leva alguns segundos.</span>
          </div>
        )}

        {result && !running && (
          !result.ok ? (
            <p className="text-[12.5px] text-[var(--red)]">✕ {result.error}</p>
          ) : result.final ? (
            <div className="space-y-3">
              {/* consenso final */}
              <div className="rounded-xl border-2 border-[var(--green)]/50 bg-[var(--green-bg)] p-4">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="text-[10px] uppercase tracking-widest text-[var(--green)] font-semibold">✓ Consenso do comitê</span>
                  {result.chairLabel && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--panel-2)] text-[var(--text-2)]">consolidado por {result.chairLabel}</span>}
                  <button onClick={run} className="ml-auto text-[11px] text-[var(--accent)] hover:underline">🔄 rodar de novo</button>
                </div>
                <p className="text-[14px] font-medium leading-snug">{result.final.conceito}</p>
                <p className="text-[12px] text-[var(--text-2)] mt-1.5"><b>Tom:</b> {result.final.tom}</p>
                <p className="text-[12px] text-[var(--text-2)]"><b>Referência:</b> {result.final.referencia}</p>
                {result.final.blocos.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">{result.final.blocos.map(b => <span key={b} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--card)] text-[var(--text-2)] border border-[var(--border)]">{b}</span>)}</div>
                )}
                {result.final.justificativa && (
                  <div className="mt-3 pt-3 border-t border-[var(--green)]/20">
                    <p className="text-[10px] uppercase tracking-wide text-[var(--text-3)] mb-1">Por que esta venceu</p>
                    <p className="text-[12px] text-[var(--text)] leading-snug">{result.final.justificativa}</p>
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap mt-3">
                  {onUseInChat && <button onClick={() => useFinal(result.final!)} className="text-[12px] px-3.5 py-1.5 rounded-lg bg-[var(--accent)] text-white">✎ usar no chat</button>}
                  {result.tally && result.tally.some(t => t.votes > 0) && (
                    <span className="text-[11px] text-[var(--text-3)]">votos: {result.tally.filter(t => t.votes > 0).map(t => `${t.label} ${t.votes}`).join(' · ')}</span>
                  )}
                </div>
              </div>

              {/* transparência: o debate por trás */}
              <details className="rounded-xl border border-[var(--border)] bg-[var(--panel)]">
                <summary className="cursor-pointer text-[12px] text-[var(--text-2)] px-3.5 py-2.5 select-none">Ver o debate (propostas + críticas dos 4 modelos)</summary>
                <div className="px-3.5 pb-3.5 space-y-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-[var(--text-3)] mb-1.5">Rodada 1 — propostas</p>
                    <div className="space-y-2">
                      {result.proposals.map(p => (
                        <div key={`p-${p.provider}`} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-2.5">
                          <p className="text-[11px] font-semibold text-[var(--text-2)] mb-1">{p.label}</p>
                          {p.ok ? <p className="text-[12px] whitespace-pre-wrap leading-snug">{p.text}</p>
                            : <p className="text-[11.5px] text-[var(--red)]">✕ {p.error || 'falhou'}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-[var(--text-3)] mb-1.5">Rodada 2 — debate e votos</p>
                    <div className="space-y-2">
                      {result.critiques.map(c => (
                        <div key={`c-${c.provider}`} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-2.5">
                          <p className="text-[11px] font-semibold text-[var(--text-2)] mb-1">{c.label}</p>
                          {c.ok ? <p className="text-[12px] whitespace-pre-wrap leading-snug">{c.text}</p>
                            : <p className="text-[11.5px] text-[var(--red)]">✕ {c.error || 'falhou'}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </details>
            </div>
          ) : (
            <p className="text-[12.5px] text-[var(--red)]">✕ {result.error || 'não deu pra consolidar'}</p>
          )
        )}
      </div>
    </div>
  )
}
