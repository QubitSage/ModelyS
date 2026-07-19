'use client'

import { useEffect, useMemo, useState } from 'react'
import { ClientIndex, CreativeProvider } from '@/lib/types'
import FileDrop, { AttachedFile } from './FileDrop'

// ARENA (seção 2) — comparação entre modelos. Roda TODOS em paralelo (~4x
// custo), lado a lado, cego + notas. É onde a CALIBRAÇÃO por cliente acontece
// (seção 3): o voto real ("usar esta direção") + notas alimentam o placar do
// cliente, e daí se promove manualmente um modelo a padrão da Direção Criativa.
// Uso pontual — não é o fluxo do dia a dia (esse é a Direção Criativa).

type SlotId = 'padrao' | 'repertorio' | 'aberto'
interface CreativeDirection { conceito: string; tom: string; referencia: string; blocos: string[]; slot?: SlotId }
const SLOT_LABEL: Record<SlotId, string> = { padrao: 'Padrão', repertorio: 'Repertório de tendência', aberto: 'Aberto' }
interface ProviderResult {
  provider: CreativeProvider; label: string; model: string; ok: boolean
  pending?: boolean; error?: string; directions?: CreativeDirection[]; ms?: number
}
interface ScoreRow {
  provider: CreativeProvider; escolhas: number; avaliacoes: number
  originalidade: number; viabilidade: number; tom: number; media: number
}

const CRITERIA = [
  { key: 'originalidade', label: 'Originalidade' },
  { key: 'viabilidade', label: 'Viável no Flow' },
  { key: 'tom', label: 'Aderência ao tom' },
] as const
type CriteriaKey = typeof CRITERIA[number]['key']
type Scores = Record<CriteriaKey, number>
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']
const LABELS: Record<CreativeProvider, string> = { sonnet: 'Claude Sonnet', gemini: 'Gemini', gpt: 'GPT', grok: 'Grok' }

export default function ArenaView({ clients, onUseInChat }: { clients: ClientIndex[]; onUseInChat?: (text: string) => void }) {
  const [idea, setIdea] = useState('')
  const [aberto, setAberto] = useState('') // inspiração própria do slot "Aberto"
  const [files, setFiles] = useState<AttachedFile[]>([])
  const [link, setLink] = useState('')
  const [clientId, setClientId] = useState('')
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<ProviderResult[] | null>(null)
  const [trendsOk, setTrendsOk] = useState<boolean | null>(null)
  const [runId, setRunId] = useState('')
  const [blind, setBlind] = useState(true)
  const [revealed, setRevealed] = useState(false)
  const [order, setOrder] = useState<number[]>([])
  const [scores, setScores] = useState<Record<string, Scores>>({})
  const [chosen, setChosen] = useState<CreativeProvider | null>(null)
  const [avail, setAvail] = useState<Array<{ id: string; label: string; model: string; hasKey: boolean }>>([])
  const [board, setBoard] = useState<{ rodadas: number; rows: ScoreRow[] }>({ rodadas: 0, rows: [] })
  const [minRounds, setMinRounds] = useState(5)
  const [creativeDefault, setCreativeDefault] = useState<CreativeProvider | null>(null)

  async function loadBoard(cid: string) {
    try {
      const d = await (await fetch(`/api/creative/calibration?clientId=${cid}`)).json()
      setBoard(d.scoreboard); setMinRounds(d.minRounds)
    } catch { /* silencioso */ }
    try {
      const d = await (await fetch(`/api/creative/default?clientId=${cid}`)).json()
      setCreativeDefault(d.creativeDefault)
    } catch { /* silencioso */ }
  }
  useEffect(() => { loadBoard(clientId) }, [clientId])
  useEffect(() => {
    fetch('/api/creative/arena').then(r => r.json()).then(d => setAvail(d.providers || [])).catch(() => {})
  }, [])

  async function run() {
    if (!idea.trim() || running) return
    setRunning(true); setResults(null); setRevealed(false); setScores({}); setChosen(null); setTrendsOk(null)
    const id = `run_${Date.now()}`; setRunId(id)
    try {
      const res = await fetch('/api/creative/arena', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea, clientId: clientId || undefined, aberto: aberto.trim() || undefined, files: files.length ? files : undefined, link: link.trim() || undefined }),
      })
      const data = await res.json()
      const rs: ProviderResult[] = data.results || []
      setResults(rs); setTrendsOk(!!data.trendsOk)
      const idx = rs.map((_, i) => i)
      for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[idx[i], idx[j]] = [idx[j], idx[i]] }
      setOrder(idx)
    } catch {
      setResults([{ provider: 'sonnet', label: 'erro', model: '', ok: false, error: 'Falha na chamada — tente de novo.' }]); setOrder([0])
    } finally { setRunning(false) }
  }

  function setScore(provider: string, key: CriteriaKey, val: number) {
    setScores(s => ({ ...s, [provider]: { ...(s[provider] || { originalidade: 0, viabilidade: 0, tom: 0 }), [key]: val } }))
  }

  // registra a rodada (voto = qual modelo tem a direção escolhida). Salva as
  // notas que já existirem. É o sinal mais forte da calibração.
  async function saveRound(escolhido: CreativeProvider | null) {
    if (escolhido) setChosen(escolhido)
    const notas: Record<string, Scores> = {}
    for (const [p, s] of Object.entries(scores)) if (s.originalidade || s.viabilidade || s.tom) notas[p] = s
    const d = await (await fetch('/api/creative/calibration', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId, clientId, idea: idea.slice(0, 200), escolhido, notas }),
    })).json()
    setBoard(d.scoreboard)
  }

  async function chooseDirection(r: ProviderResult, d: CreativeDirection) {
    await saveRound(r.provider)
    onUseInChat?.([
      `DIREÇÃO CRIATIVA ESCOLHIDA (${LABELS[r.provider]}): ${d.conceito}`,
      `Tom: ${d.tom}`, `Referência: ${d.referencia}`,
      d.blocos.length ? `Blocos: ${d.blocos.join(', ')}` : '',
      'Desenvolva o roteiro/pacote de takes seguindo esta direção.',
    ].filter(Boolean).join('\n'))
  }

  async function promote(provider: CreativeProvider) {
    if (!clientId) return
    const cli = clients.find(c => c.id === clientId)?.name || 'este cliente'
    if (!confirm(`Definir ${LABELS[provider]} como modelo padrão da Direção Criativa para ${cli}?`)) return
    const d = await (await fetch('/api/creative/default', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, provider }),
    })).json()
    setCreativeDefault(d.creativeDefault)
  }

  const displayResults = useMemo(() => (results ? order.map(i => results[i]) : []), [results, order])
  const okCount = results?.filter(r => r.ok).length ?? 0
  const canPromote = board.rodadas >= minRounds && !!clientId

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-[var(--card)] overflow-y-auto">
      <header className="shrink-0 border-b border-[var(--border)] px-5 max-md:px-3 pt-4 pb-3">
        <h1 className="font-semibold text-[15px]">Arena — comparar modelos</h1>
        <p className="text-[12px] text-[var(--text-2)]">A mesma faísca em todos os modelos, lado a lado. Julgue cego, pontue, e escolha a melhor direção — isso calibra o padrão deste cliente.</p>
      </header>

      <div className="p-5 max-md:p-3 space-y-4 max-w-5xl w-full">
        {/* legenda dos slots — o usuário sabe o que cada um representa antes de ler */}
        <div className="flex flex-wrap gap-2 text-[11px] text-[var(--text-2)]">
          <span className="px-2 py-0.5 rounded-full bg-[var(--panel-2)]"><b>Padrão</b> · o seguro</span>
          <span className="px-2 py-0.5 rounded-full bg-[var(--panel-2)]"><b>Repertório</b> · tendência da web</span>
          <span className="px-2 py-0.5 rounded-full bg-[var(--panel-2)]"><b>Aberto</b> · sua inspiração (opcional)</span>
        </div>
        <div className="space-y-2.5">
          <textarea value={idea} onChange={e => setIdea(e.target.value)} rows={3}
            placeholder="Jogue a ideia crua aqui — ou cole um briefing bagunçado do cliente."
            className="w-full text-[13px] rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3 outline-none focus:border-[var(--text-3)] resize-y" />
          <textarea value={aberto} onChange={e => setAberto(e.target.value)} rows={2}
            placeholder="Slot Aberto (opcional): já tem uma inspiração/referência sua? Descreva aqui. Vazio = não gera esse slot."
            className="w-full text-[12.5px] rounded-lg border border-dashed border-[var(--border)] bg-[var(--panel)] p-2.5 outline-none focus:border-[var(--text-3)] resize-y" />

          {/* referências: N arquivos (imagem/PDF/vídeo…) + link */}
          <FileDrop files={files} onChange={setFiles} />
          <input value={link} onChange={e => setLink(e.target.value)} placeholder="ou cole um link de referência (opcional)"
            className="w-full text-[12px] rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1.5 outline-none focus:border-[var(--text-3)]" />
          <div className="flex items-center gap-2 flex-wrap">
            <select value={clientId} onChange={e => setClientId(e.target.value)} className="text-[12px] rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 outline-none">
              <option value="">sem cliente (genérico)</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-[12px] text-[var(--text-2)] cursor-pointer select-none">
              <input type="checkbox" checked={blind} onChange={e => setBlind(e.target.checked)} /> modo cego
            </label>
            <button onClick={run} disabled={running || !idea.trim()} className="ml-auto text-[13px] px-4 py-1.5 rounded-lg bg-[var(--accent)] text-white disabled:opacity-40">
              {running ? 'buscando tendências + rodando…' : '⚔ Rodar Arena'}
            </button>
          </div>
          {avail.length > 0 && (
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {avail.map(p => (
                <span key={p.id} className={`px-2 py-0.5 rounded-full border ${p.hasKey ? 'border-[var(--green)] text-[var(--green)]' : 'border-[var(--border)] text-[var(--text-3)]'}`}>
                  {p.label} {p.hasKey ? '✓' : '· sem chave'}
                </span>
              ))}
            </div>
          )}
        </div>

        {results && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-[13px] font-semibold">Resultados ({okCount})</h2>
              <span className="text-[11px] text-[var(--text-3)]">{trendsOk ? '🌐 tendências buscadas na web' : trendsOk === false ? '⚠ busca de tendências indisponível — repertório saiu do conhecimento do modelo' : ''}</span>
              {blind && <button onClick={() => setRevealed(v => !v)} className="text-[11.5px] px-2.5 py-1 rounded-lg border border-[var(--border)] hover:bg-[var(--panel-2)]">{revealed ? 'ocultar quem é quem' : '👁 revelar modelos'}</button>}
              {chosen && <span className="text-[11.5px] text-[var(--green)]">✓ escolhido: {(!blind || revealed) ? LABELS[chosen] : 'registrado (revele pra ver)'}</span>}
            </div>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
              {displayResults.map((r, i) => {
                const name = blind && !revealed ? `Modelo ${LETTERS[i]}` : r.label
                const sc = scores[r.provider] || { originalidade: 0, viabilidade: 0, tom: 0 }
                return (
                  <div key={r.provider + i} className={`rounded-xl border bg-[var(--panel)] p-3.5 flex flex-col ${chosen === r.provider ? 'border-[var(--green)]' : 'border-[var(--border)]'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-[13px]">{name}</span>
                      {(!blind || revealed) && <span className="text-[10px] text-[var(--text-3)]">{r.model}</span>}
                      {r.ms != null && <span className="ml-auto text-[10px] text-[var(--text-3)]">{(r.ms / 1000).toFixed(1)}s</span>}
                    </div>
                    {r.pending && <p className="text-[12px] text-[var(--text-3)]">⏳ {r.error}</p>}
                    {!r.pending && !r.ok && <p className="text-[12px] text-[var(--red)]">✕ {r.error}</p>}
                    {r.ok && r.directions && (
                      <div className="space-y-2.5">
                        {r.directions.map((d, j) => (
                          <div key={j} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-2.5">
                            {d.slot && (
                              <span className={`inline-block mb-1 text-[9.5px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                                d.slot === 'padrao' ? 'bg-[var(--panel-2)] text-[var(--text-2)]'
                                : d.slot === 'repertorio' ? 'bg-[var(--lav)] text-[var(--lav-text)]'
                                : 'bg-[var(--green-bg)] text-[var(--green)]'}`}>{SLOT_LABEL[d.slot]}</span>
                            )}
                            <p className="text-[12.5px] font-medium leading-snug">{d.conceito}</p>
                            <p className="text-[11.5px] text-[var(--text-2)] mt-1"><b>Tom:</b> {d.tom}</p>
                            <p className="text-[11.5px] text-[var(--text-2)]"><b>Ref:</b> {d.referencia}</p>
                            {d.blocos.length > 0 && <div className="flex flex-wrap gap-1 mt-1.5">{d.blocos.map(b => <span key={b} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--panel-2)] text-[var(--text-2)]">{b}</span>)}</div>}
                            <button onClick={() => chooseDirection(r, d)} className="mt-1.5 text-[10.5px] px-2 py-0.5 rounded-full bg-[var(--green-bg)] text-[var(--green)]">✓ usar esta direção (voto)</button>
                          </div>
                        ))}
                      </div>
                    )}
                    {r.ok && (
                      <div className="mt-auto pt-2.5 border-t border-[var(--border)] mt-2.5 space-y-1.5">
                        {CRITERIA.map(c => (
                          <div key={c.key} className="flex items-center gap-1.5">
                            <span className="text-[10.5px] text-[var(--text-2)] w-[86px] shrink-0">{c.label}</span>
                            {[1, 2, 3, 4, 5].map(n => (
                              <button key={n} onClick={() => setScore(r.provider, c.key, n)} className={`w-5 h-5 rounded text-[10px] ${sc[c.key] >= n ? 'bg-[var(--accent)] text-white' : 'bg-[var(--panel-2)] text-[var(--text-3)]'}`}>{n}</button>
                            ))}
                          </div>
                        ))}
                        <button onClick={() => saveRound(chosen)} disabled={!sc.originalidade || !sc.viabilidade || !sc.tom} className="w-full mt-1 text-[11px] py-1 rounded-lg bg-[var(--panel-2)] text-[var(--text-2)] disabled:opacity-40">salvar só as notas</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* placar por cliente */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-[13px] font-semibold">Placar — {clientId ? clients.find(c => c.id === clientId)?.name : 'genérico'}</h2>
            <span className="text-[11px] text-[var(--text-3)]">{board.rodadas} rodada(s) · mín. p/ definir padrão: {minRounds}</span>
            {creativeDefault && <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--green-bg)] text-[var(--green)]">padrão atual: {LABELS[creativeDefault]}</span>}
            {board.rodadas > 0 && <button onClick={async () => { if (confirm('Zerar o placar deste cliente?')) { await fetch(`/api/creative/calibration?clientId=${clientId}`, { method: 'DELETE' }); loadBoard(clientId) } }} className="ml-auto text-[11px] text-[var(--text-3)] hover:text-[var(--red)]">zerar</button>}
          </div>
          {board.rows.length === 0 ? (
            <p className="text-[12px] text-[var(--text-3)]">Sem rodadas ainda. Rode ideias reais deste cliente, escolha a melhor direção (voto) e/ou pontue — o placar aparece aqui.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-[12px] w-full border border-[var(--border)] rounded-lg overflow-hidden">
                <thead className="bg-[var(--panel-2)] text-[var(--text-2)]">
                  <tr><th className="text-left px-3 py-1.5">Modelo</th><th className="px-2 py-1.5">Escolhas</th><th className="px-2 py-1.5">Média</th><th className="px-2 py-1.5">Orig.</th><th className="px-2 py-1.5">Viab.</th><th className="px-2 py-1.5">Tom</th><th className="px-2 py-1.5"></th></tr>
                </thead>
                <tbody>
                  {board.rows.map((a, i) => (
                    <tr key={a.provider} className={`border-t border-[var(--border)] ${i === 0 ? 'bg-[var(--green-bg)]' : ''}`}>
                      <td className="px-3 py-1.5 font-medium">{i === 0 ? '🏆 ' : ''}{LABELS[a.provider]}</td>
                      <td className="text-center px-2 py-1.5 font-semibold">{a.escolhas}</td>
                      <td className="text-center px-2 py-1.5">{a.media || '—'}</td>
                      <td className="text-center px-2 py-1.5">{a.originalidade || '—'}</td>
                      <td className="text-center px-2 py-1.5">{a.viabilidade || '—'}</td>
                      <td className="text-center px-2 py-1.5">{a.tom || '—'}</td>
                      <td className="px-2 py-1.5">
                        {canPromote && creativeDefault !== a.provider && (
                          <button onClick={() => promote(a.provider)} className="text-[10.5px] px-2 py-0.5 rounded-full bg-[var(--accent)] text-white whitespace-nowrap">definir padrão</button>
                        )}
                        {creativeDefault === a.provider && <span className="text-[10.5px] text-[var(--green)]">✓ padrão</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {clientId && board.rodadas > 0 && board.rodadas < minRounds && (
            <p className="text-[11px] text-[var(--text-3)]">Faltam {minRounds - board.rodadas} rodada(s) pra liberar a promoção a padrão deste cliente.</p>
          )}
          {!clientId && <p className="text-[11px] text-[var(--text-3)]">Selecione um cliente pra calibrar o padrão dele (o placar é por cliente).</p>}
        </div>
      </div>
    </div>
  )
}
