'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Client, Thread, QCResult, QCFinding, Ref } from '@/lib/types'

interface Suggestion {
  id: string
  tipo: 'adicionar' | 'remover'
  termo: string
  motivo: string
}

export default function InfoPanel({
  client, thread, qcResult, tab, setTab, onThreadUpdated, mobileOpen, onMobileClose,
}: {
  client: Client
  thread: Thread
  qcResult: QCResult | null
  tab: 'info' | 'qc'
  setTab: (t: 'info' | 'qc') => void
  onThreadUpdated: () => Promise<void>
  mobileOpen?: boolean
  onMobileClose?: () => void
}) {
  const [briefing, setBriefing] = useState(thread.context.briefing)
  const [notes, setNotes] = useState(thread.context.notes)
  const [blocklist, setBlocklist] = useState((client.qcBlocklist || []).join(', '))
  const [rules, setRules] = useState(client.rules || '')
  const [saved, setSaved] = useState(false)
  const [verdictGiven, setVerdictGiven] = useState<Record<number, string>>({})
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [blockReport, setBlockReport] = useState('')
  const [showReport, setShowReport] = useState(false)

  const loadSuggestions = useCallback(async () => {
    const res = await fetch(`/api/qc/verdicts?clientId=${client.id}`)
    const data = await res.json()
    setSuggestions(data.sugestoes || [])
  }, [client.id])

  useEffect(() => { if (tab === 'qc') loadSuggestions() }, [tab, loadSuggestions])
  useEffect(() => { setVerdictGiven({}) }, [qcResult])

  async function sendVerdict(f: QCFinding, i: number, decision: 'procede' | 'falso-positivo') {
    const termo = f.regra === 'blocklist' ? f.motivo.match(/"([^"]+)"/)?.[1] : undefined
    await fetch('/api/qc/verdicts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verdict', clientId: client.id, regra: f.regra, motivo: f.motivo, decision, termo }),
    })
    setVerdictGiven(v => ({ ...v, [i]: decision }))
    loadSuggestions()
  }

  async function resolveSuggestion(id: string, accept: boolean) {
    await fetch('/api/qc/verdicts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resolve', id, accept }),
    })
    await loadSuggestions()
    await onThreadUpdated() // blocklist do cliente pode ter mudado
  }

  async function reportBlock() {
    if (!blockReport.trim()) return
    await fetch('/api/qc/verdicts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'report-block', clientId: client.id, content: blockReport }),
    })
    setBlockReport('')
    setShowReport(false)
    loadSuggestions()
  }

  useEffect(() => {
    setBriefing(thread.context.briefing)
    setNotes(thread.context.notes)
  }, [thread.id, thread.context.briefing, thread.context.notes])

  useEffect(() => { setBlocklist((client.qcBlocklist || []).join(', ')) }, [client.id, client.qcBlocklist])
  useEffect(() => { setRules(client.rules || '') }, [client.id, client.rules])

  async function saveContext() {
    await fetch(`/api/threads/${thread.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: client.id, context: { ...thread.context, briefing, notes } }),
    })
    await fetch(`/api/clients/${client.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qcBlocklist: blocklist.split(',').map(s => s.trim()).filter(Boolean), rules }),
    })
    await onThreadUpdated()
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return <InfoPanelInner {...{ client, thread, qcResult, tab, setTab, onThreadUpdated, briefing, setBriefing, notes, setNotes, blocklist, setBlocklist, rules, setRules, saved, saveContext, verdictGiven, sendVerdict, suggestions, resolveSuggestion, blockReport, setBlockReport, showReport, setShowReport, reportBlock, mobileOpen, onMobileClose }} />
}

// separação puramente estrutural pra manter o componente legível
// ---------------------------------------------------------------------------
// Referências visuais nomeadas — a fonte da verdade de personagem/produto.
// A imagem entra com um NOME de placeholder ([Manu], [Óculos]) e um briefing
// curto; o sistema anexa tudo como primeira mensagem fixa da conversa, então
// o modelo SABE qual arquivo é referência do quê.
// ---------------------------------------------------------------------------
function RefsManager({ client, thread, onThreadUpdated }: {
  client: Client
  thread: Thread
  onThreadUpdated: () => Promise<void>
}) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [refBriefing, setRefBriefing] = useState('')
  const [dataUrl, setDataUrl] = useState('')
  const [mimeType, setMimeType] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function pick(files: FileList | null) {
    const f = files?.[0]
    if (!f) return
    if (!f.type.startsWith('image/')) return
    const url = await new Promise<string>(resolve => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result))
      r.readAsDataURL(f)
    })
    setDataUrl(url)
    setMimeType(f.type)
    if (!name) setName(f.name.replace(/\.[^.]+$/, ''))
  }

  async function saveRefs(refs: Ref[]) {
    await fetch(`/api/threads/${thread.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: client.id, context: { ...thread.context, refs } }),
    })
    await onThreadUpdated()
  }

  async function add() {
    if (!name.trim() || !dataUrl) return
    const ref: Ref = {
      id: `r_${Date.now().toString(36)}`,
      name: name.trim().replace(/^\[|\]$/g, ''),
      dataUrl,
      mimeType,
      briefing: refBriefing.trim() || undefined,
    }
    await saveRefs([...(thread.context.refs || []), ref])
    setAdding(false)
    setName('')
    setRefBriefing('')
    setDataUrl('')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">Referências visuais</h3>
        <button onClick={() => setAdding(v => !v)} className="text-[var(--text-3)] hover:text-[var(--text)] text-sm leading-none">+</button>
      </div>
      <p className="text-[10.5px] text-[var(--text-3)] mb-2">
        Fonte da verdade de personagem/produto — entram fixas em toda mensagem desta conversa, identificadas pelo nome.
      </p>

      {(thread.context.refs || []).length > 0 && (
        <ul className="space-y-1.5 mb-2">
          {thread.context.refs.map(r => (
            <li key={r.id} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-1.5">
              {r.dataUrl?.startsWith('data:image') && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.dataUrl} alt={r.name} className="w-9 h-9 rounded object-cover shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium">[{r.name}]</p>
                {r.briefing && <p className="text-[10.5px] text-[var(--text-2)] truncate">{r.briefing}</p>}
              </div>
              <button
                onClick={() => saveRefs(thread.context.refs.filter(x => x.id !== r.id))}
                className="text-[var(--text-3)] hover:text-[var(--red)] text-[11px] px-1"
              >✕</button>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <div className="space-y-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] p-2">
          <input ref={fileRef} type="file" accept="image/*" onChange={e => pick(e.target.files)} className="hidden" />
          <button onClick={() => fileRef.current?.click()} className="w-full py-3 rounded-lg border border-dashed border-[var(--border)] text-[11.5px] text-[var(--text-2)] hover:border-[var(--text-3)]">
            {dataUrl ? '✓ imagem carregada — trocar' : 'escolher imagem'}
          </button>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="nome do placeholder (ex: Manu, Óculos)"
            className="w-full text-[12px] rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 outline-none"
          />
          <input
            value={refBriefing}
            onChange={e => setRefBriefing(e.target.value)}
            placeholder="briefing curto (ex: ruiva, vestido azul)"
            className="w-full text-[12px] rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 outline-none"
          />
          <div className="flex gap-1.5">
            <button onClick={add} disabled={!name.trim() || !dataUrl} className="flex-1 py-1 rounded-lg bg-[var(--accent)] text-white text-[11.5px] disabled:opacity-40">adicionar</button>
            <button onClick={() => setAdding(false)} className="px-2 py-1 rounded-lg border border-[var(--border)] text-[11.5px] text-[var(--text-2)]">✕</button>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoPanelInner(props: {
  client: Client; thread: Thread; qcResult: QCResult | null
  tab: 'info' | 'qc'; setTab: (t: 'info' | 'qc') => void
  onThreadUpdated: () => Promise<void>
  briefing: string; setBriefing: (v: string) => void
  notes: string; setNotes: (v: string) => void
  blocklist: string; setBlocklist: (v: string) => void
  rules: string; setRules: (v: string) => void
  saved: boolean; saveContext: () => void
  verdictGiven: Record<number, string>
  sendVerdict: (f: QCFinding, i: number, d: 'procede' | 'falso-positivo') => void
  suggestions: Suggestion[]
  resolveSuggestion: (id: string, accept: boolean) => void
  blockReport: string; setBlockReport: (v: string) => void
  showReport: boolean; setShowReport: (v: boolean) => void
  reportBlock: () => void
  mobileOpen?: boolean
  onMobileClose?: () => void
}) {
  const { client, thread, qcResult, tab, setTab, onThreadUpdated, briefing, setBriefing, notes, setNotes, blocklist, setBlocklist, rules, setRules, saved, saveContext, verdictGiven, sendVerdict, suggestions, resolveSuggestion, blockReport, setBlockReport, showReport, setShowReport, reportBlock, mobileOpen, onMobileClose } = props

  const sevStyle = (s: string) =>
    s === 'flagado'
      ? 'bg-[var(--red-bg)] text-[var(--red)] border-[var(--red)]'
      : 'bg-[var(--amber-bg)] text-[var(--amber)] border-[var(--amber)]'

  return (
    <aside className={`w-[290px] shrink-0 border-l border-[var(--border)] bg-[var(--panel)] flex flex-col max-md:fixed max-md:inset-y-0 max-md:right-0 max-md:z-50 max-md:shadow-xl max-md:transition-transform ${mobileOpen ? '' : 'max-md:translate-x-full'}`}>
      <button onClick={onMobileClose} className="hidden max-md:block absolute top-3 left-3 text-[var(--text-3)]">✕</button>
      {/* Abas */}
      <div className="h-12 shrink-0 border-b border-[var(--border)] flex items-center px-3 gap-1">
        {(['info', 'qc'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1 rounded-lg text-[12.5px] ${tab === t ? 'bg-[var(--panel-2)] font-semibold' : 'text-[var(--text-2)]'}`}
          >
            {t === 'info' ? 'Info' : 'QC'}
            {t === 'qc' && qcResult && (
              <span className={`ml-1.5 inline-block w-2 h-2 rounded-full ${
                qcResult.status === 'aprovado' ? 'bg-[var(--green)]' : qcResult.status === 'ambiguo' ? 'bg-[var(--amber)]' : 'bg-[var(--red)]'
              }`} />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === 'info' && (
          <>
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)] mb-2">Main info</h3>
              <div className="text-[12.5px] space-y-1.5">
                <div className="flex justify-between"><span className="text-[var(--text-2)]">Cliente</span><span className="font-medium">{client.name}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-2)]">Modo</span><span>{thread.mode}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-2)]">Criada em</span><span>{new Date(thread.createdAt).toLocaleDateString('pt-BR')}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-2)]">Mensagens</span><span>{thread.messages.length}</span></div>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--text-2)]">Status</span>
                  <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-[var(--green-bg)] text-[var(--green)] font-medium">• Ativa</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)] mb-1.5">Briefing do projeto</h3>
              <textarea
                value={briefing}
                onChange={e => setBriefing(e.target.value)}
                rows={5}
                placeholder="Cole aqui o briefing — entra no contexto de toda mensagem desta conversa."
                className="w-full text-[12px] rounded-lg border border-[var(--border)] bg-[var(--card)] p-2 outline-none focus:border-[var(--text-3)] resize-y"
              />
            </div>

            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)] mb-1.5">Notas</h3>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Regras combinadas, correções do cliente…"
                className="w-full text-[12px] rounded-lg border border-[var(--border)] bg-[var(--card)] p-2 outline-none focus:border-[var(--text-3)] resize-y"
              />
            </div>

            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)] mb-1.5">Regras do cliente (invioláveis)</h3>
              <textarea
                value={rules}
                onChange={e => setRules(e.target.value)}
                rows={4}
                placeholder="Regras que valem pra TODA conversa deste cliente, prioridade máxima. Ex: Proibido b-roll em silêncio. Seguir a dinâmica do vídeo original."
                className="w-full text-[12px] rounded-lg border border-[var(--border)] bg-[var(--card)] p-2 outline-none focus:border-[var(--text-3)] resize-y"
              />
            </div>

            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)] mb-1.5">Blocklist QC do cliente</h3>
              <textarea
                value={blocklist}
                onChange={e => setBlocklist(e.target.value)}
                rows={2}
                placeholder="Termos que o Flow já bloqueou, separados por vírgula"
                className="w-full text-[12px] rounded-lg border border-[var(--border)] bg-[var(--card)] p-2 outline-none focus:border-[var(--text-3)] resize-y"
              />
            </div>

            <RefsManager client={client} thread={thread} onThreadUpdated={onThreadUpdated} />

            <button
              onClick={saveContext}
              className="w-full py-1.5 rounded-lg bg-[var(--accent)] text-white text-[12.5px]"
            >{saved ? 'Salvo ✓' : 'Salvar contexto'}</button>
          </>
        )}

        {tab === 'qc' && (
          <>
            {!qcResult && (
              <p className="text-[12.5px] text-[var(--text-2)]">
                Passe o mouse numa resposta com takes e clique em <span className="font-medium">✓ QC</span> pra validar o pacote antes de colar no Flow.
              </p>
            )}
            {qcResult && (
              <>
                <div className={`rounded-lg p-3 text-[13px] font-medium ${
                  qcResult.status === 'aprovado' ? 'bg-[var(--green-bg)] text-[var(--green)]'
                  : qcResult.status === 'ambiguo' ? 'bg-[var(--amber-bg)] text-[var(--amber)]'
                  : 'bg-[var(--red-bg)] text-[var(--red)]'
                }`}>
                  {qcResult.status === 'aprovado' && `✓ Aprovado — ${qcResult.takes} takes, nenhum problema`}
                  {qcResult.status === 'ambiguo' && `△ ${qcResult.findings.length} ponto(s) de atenção em ${qcResult.takes} takes`}
                  {qcResult.status === 'flagado' && `✕ ${qcResult.findings.filter(f => f.severidade === 'flagado').length} problema(s) em ${qcResult.takes} takes`}
                </div>
                <div className="space-y-2">
                  {qcResult.findings.map((f, i) => (
                    <div key={i} className={`rounded-lg border p-2.5 text-[12px] ${sevStyle(f.severidade)} bg-opacity-40`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="font-semibold text-[10.5px] uppercase tracking-wide">{f.regra}</span>
                        {f.take && <span className="text-[10.5px] opacity-80">· {f.take}</span>}
                      </div>
                      <p className="text-[var(--text)]">{f.motivo}</p>
                      {f.sugestao && <p className="mt-1 text-[var(--text-2)]">→ {f.sugestao}</p>}
                      <div className="flex gap-1.5 mt-1.5">
                        {verdictGiven[i] ? (
                          <span className="text-[10.5px] text-[var(--text-3)]">✓ registrado ({verdictGiven[i]})</span>
                        ) : (
                          <>
                            <button onClick={() => sendVerdict(f, i, 'procede')} className="text-[10.5px] px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--panel-2)]">procede</button>
                            <button onClick={() => sendVerdict(f, i, 'falso-positivo')} className="text-[10.5px] px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--panel-2)]">falso positivo</button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Sugestões aprendidas dos veredictos */}
            {suggestions.length > 0 && (
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)] mb-1.5">Sugestões do QC</h3>
                <div className="space-y-1.5">
                  {suggestions.map(s => (
                    <div key={s.id} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-2 text-[11.5px]">
                      <p><b>{s.tipo === 'adicionar' ? '+ adicionar' : '− remover'}</b> “{s.termo}”</p>
                      <p className="text-[var(--text-2)] mt-0.5">{s.motivo}</p>
                      <div className="flex gap-1.5 mt-1">
                        <button onClick={() => resolveSuggestion(s.id, true)} className="text-[10.5px] px-1.5 py-0.5 rounded bg-[var(--green-bg)] text-[var(--green)]">aceitar</button>
                        <button onClick={() => resolveSuggestion(s.id, false)} className="text-[10.5px] px-1.5 py-0.5 rounded bg-[var(--panel-2)] text-[var(--text-2)]">recusar</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reportar bloqueio do Flow que o QC não pegou */}
            <div>
              {!showReport ? (
                <button onClick={() => setShowReport(true)} className="text-[11.5px] text-[var(--text-3)] hover:text-[var(--text)] underline underline-offset-2">
                  O Flow bloqueou um take que passou no QC? Reporte aqui
                </button>
              ) : (
                <div className="space-y-1.5">
                  <textarea
                    value={blockReport}
                    onChange={e => setBlockReport(e.target.value)}
                    rows={3}
                    placeholder="Cole o take que o Flow bloqueou — vou extrair os termos candidatos e sugerir pra blocklist."
                    className="w-full text-[11.5px] rounded-lg border border-[var(--border)] bg-[var(--card)] p-2 outline-none focus:border-[var(--text-3)]"
                  />
                  <div className="flex gap-1.5">
                    <button onClick={reportBlock} className="text-[11.5px] px-2.5 py-1 rounded-lg bg-[var(--accent)] text-white">analisar</button>
                    <button onClick={() => setShowReport(false)} className="text-[11.5px] px-2 py-1 rounded-lg border border-[var(--border)] text-[var(--text-2)]">cancelar</button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  )
}
