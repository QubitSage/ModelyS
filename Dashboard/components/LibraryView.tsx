'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Term, TermCategory, LibraryHistoryItem } from '@/lib/types'
import TermDemo from './TermDemo'

type CatFilter = TermCategory | 'todas' | 'historico'

const CATEGORIES: Array<{ id: TermCategory | 'todas'; label: string }> = [
  { id: 'todas', label: 'Todas' },
  { id: 'camera', label: 'Câmera' },
  { id: 'motion', label: 'Motion' },
  { id: 'estilo-visual', label: 'Estilo Visual' },
  { id: 'estilo-video', label: 'Estilo de Vídeo' },
  { id: 'graficos', label: 'Gráficos' },
  { id: 'web', label: 'Web' },
  { id: 'produto', label: 'Produto' },
  { id: 'roupas', label: 'Roupas' },
  { id: 'sugeridos', label: 'Sugeridos ✦' },
]

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// prompt "rico" (o Direto foi aposentado da UI — sobrou só como fallback)
function richPrompts(t: Term) {
  const rich = t.prompts.filter(p => p.rotulo.toLowerCase() !== 'direto')
  return rich.length ? rich : t.prompts
}

export default function LibraryView({ onUseInChat }: { onUseInChat?: (text: string) => void }) {
  const [terms, setTerms] = useState<Term[]>([])
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<CatFilter>('todas')
  const [focusIds, setFocusIds] = useState<string[] | null>(null) // vista focada nas sugestões
  const [history, setHistory] = useState<LibraryHistoryItem[]>([])
  const [panel, setPanel] = useState<'assistente' | 'briefing' | 'gerar' | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)

  async function load() {
    const res = await fetch('/api/library/terms')
    setTerms(await res.json())
  }
  async function loadHistory() {
    try { setHistory(await (await fetch('/api/library/history')).json()) } catch { /* silencioso */ }
  }
  useEffect(() => { load(); loadHistory() }, [])

  // registra cópia no histórico e atualiza a lista
  async function recordCopy(termId: string, texto: string, rotulo: string) {
    try {
      await fetch('/api/library/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ termId, texto, rotulo }),
      })
      loadHistory()
    } catch { /* silencioso */ }
  }

  // Vista focada: só os termos sugeridos, na ordem em que vieram.
  const focusTermsList = useMemo(() => {
    if (!focusIds) return []
    const byId = new Map(terms.map(t => [t.id, t]))
    return focusIds.map(id => byId.get(id)).filter((t): t is Term => !!t)
  }, [terms, focusIds])

  // Histórico → termos (dedup por termo, mantendo a ordem de uso mais recente).
  const historyTermsList = useMemo(() => {
    const byId = new Map(terms.map(t => [t.id, t]))
    const seen = new Set<string>()
    const out: Term[] = []
    for (const h of history) {
      if (seen.has(h.termId)) continue
      const t = byId.get(h.termId)
      if (t) { out.push(t); seen.add(h.termId) }
    }
    return out
  }, [terms, history])

  const filtered = useMemo(() => {
    const nq = normalize(q.trim())
    return terms.filter(t => {
      if (cat !== 'todas' && cat !== 'historico' && t.categoria !== cat) return false
      if (!nq) return true
      return (
        normalize(t.termo).includes(nq) ||
        normalize(t.explicacao).includes(nq) ||
        t.sinonimos.some(s => normalize(s).includes(nq))
      )
    })
  }, [terms, q, cat])

  // O que a grade mostra: foco > histórico > filtro normal.
  const showing: Term[] = focusIds ? focusTermsList : cat === 'historico' ? historyTermsList : filtered

  function focusTerms(ids: string[]) {
    if (!ids.length) return
    setFocusIds(ids)
    setQ('')
    setTimeout(() => gridRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 50)
  }

  function clearFocus() {
    setFocusIds(null)
  }

  return (
    <div className="flex-1 min-w-0 flex bg-[var(--card)]">
      <section className="flex-1 min-w-0 flex flex-col">
        <header className="shrink-0 border-b border-[var(--border)] px-5 pt-4 pb-0">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="font-semibold text-[15px]">Biblioteca de Vocabulário</h1>
              <p className="text-[12px] text-[var(--text-2)]">{terms.length} termos — descreva do seu jeito, saia com o termo técnico e o prompt pronto</p>
            </div>
            <div className="ml-auto flex gap-1.5">
              <button onClick={() => setShowAdd(true)} className="text-[12px] px-3 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--panel-2)]">+ termo</button>
              <button onClick={() => setShowImport(true)} className="text-[12px] px-3 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--panel-2)]">importar</button>
              <button onClick={() => setPanel(panel === 'gerar' ? null : 'gerar')}
                className={`text-[12px] px-3 py-1.5 rounded-lg border ${panel === 'gerar' ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'border-[var(--border)] hover:bg-[var(--panel-2)]'}`}>
                ✦ gerar termos
              </button>
              <button onClick={() => setPanel(panel === 'briefing' ? null : 'briefing')}
                className={`text-[12px] px-3 py-1.5 rounded-lg border ${panel === 'briefing' ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'border-[var(--border)] hover:bg-[var(--panel-2)]'}`}>
                Analisar briefing
              </button>
              <button onClick={() => setPanel(panel === 'assistente' ? null : 'assistente')}
                className={`text-[12px] px-3 py-1.5 rounded-lg border ${panel === 'assistente' ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'border-[var(--border)] hover:bg-[var(--panel-2)]'}`}>
                ✦ Assistente
              </button>
            </div>
          </div>

          <input
            value={q}
            onChange={e => { setQ(e.target.value); if (focusIds) clearFocus() }}
            placeholder='Busque do seu jeito: "chega perto devagar", "estilo papel", "fundo que gira"…'
            className="w-full mt-3 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 outline-none focus:border-[var(--text-3)]"
          />

          <div className="flex gap-1 mt-2.5 -mb-px overflow-x-auto">
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                onClick={() => { clearFocus(); setCat(c.id) }}
                className={`px-3 py-1.5 text-[12px] whitespace-nowrap border-b-2 transition-colors ${
                  cat === c.id && !focusIds ? 'border-[var(--accent)] font-semibold' : 'border-transparent text-[var(--text-2)] hover:text-[var(--text)]'
                }`}
              >{c.label}</button>
            ))}
            <button
              onClick={() => { clearFocus(); setCat('historico') }}
              className={`px-3 py-1.5 text-[12px] whitespace-nowrap border-b-2 transition-colors ${
                cat === 'historico' && !focusIds ? 'border-[var(--accent)] font-semibold' : 'border-transparent text-[var(--text-2)] hover:text-[var(--text)]'
              }`}
            >Histórico{history.length ? ` (${historyTermsList.length})` : ''}</button>
          </div>
        </header>

        <div ref={gridRef} className="flex-1 overflow-y-auto p-5">
          {focusIds && (
            <div className="mb-4 flex items-center gap-2 text-[12.5px] rounded-lg border border-[var(--green)] bg-[var(--green-bg)] text-[var(--green)] px-3 py-2">
              <span className="font-semibold">Mostrando {focusTermsList.length} termo(s) sugerido(s)</span>
              <button onClick={clearFocus} className="ml-auto flex items-center gap-1 hover:opacity-80" title="voltar pra biblioteca completa">
                voltar pra biblioteca <span className="text-[14px] leading-none">✕</span>
              </button>
            </div>
          )}
          {cat === 'historico' && !focusIds && (
            <div className="mb-4 flex items-center gap-2 text-[12.5px] text-[var(--text-2)]">
              <span>Termos que você usou (por cópia), mais recentes primeiro.</span>
              {history.length > 0 && (
                <button
                  onClick={async () => { await fetch('/api/library/history', { method: 'DELETE' }); loadHistory() }}
                  className="ml-auto text-[var(--text-3)] hover:text-[var(--red)]"
                >limpar histórico</button>
              )}
            </div>
          )}
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))' }}>
            {showing.map(t => (
              <TermCard key={t.id} term={t} onRefSaved={load} onCopy={recordCopy} />
            ))}
          </div>
          {showing.length === 0 && (
            <p className="text-center text-[13px] text-[var(--text-2)] mt-10">
              {cat === 'historico' && !focusIds
                ? 'Nada no histórico ainda — copie o prompt de um termo e ele aparece aqui.'
                : <>Nada encontrado — tente o <button className="underline" onClick={() => setPanel('assistente')}>Assistente</button>, ele acha pelo jeito que você fala.</>}
            </p>
          )}
        </div>
      </section>

      {panel === 'assistente' && <AssistantPanel onHighlight={focusTerms} onClose={() => setPanel(null)} />}
      {panel === 'briefing' && <BriefingPanel onHighlight={focusTerms} onSaved={load} onClose={() => setPanel(null)} terms={terms} onUseInChat={onUseInChat} />}
      {panel === 'gerar' && <SuggestPanel onSaved={load} onClose={() => setPanel(null)} />}
      {showAdd && <AddTermModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load() }} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onSaved={() => { setShowImport(false); load() }} />}
    </div>
  )
}

function TermCard({ term, onRefSaved, onCopy }: { term: Term; onRefSaved: () => void; onCopy?: (termId: string, texto: string, rotulo: string) => void }) {
  const [copied, setCopied] = useState<number | null>(null)
  const [editRef, setEditRef] = useState(false)
  const [refUrl, setRefUrl] = useState(term.referencia_real || '')

  async function copy(texto: string, i: number, rotulo: string) {
    await navigator.clipboard.writeText(texto)
    setCopied(i)
    onCopy?.(term.id, texto, rotulo)
    setTimeout(() => setCopied(null), 1200)
  }

  async function saveRef() {
    await fetch('/api/library/terms', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ termId: term.id, url: refUrl.trim() }),
    })
    setEditRef(false)
    onRefSaved()
  }

  return (
    <article
      id={`term-${term.id}`}
      className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden transition-shadow hover:shadow-sm"
    >
      <TermDemo demo={term.demo} />
      <div className="p-3.5">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[9.5px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--panel-2)] text-[var(--text-2)]">{term.categoria}</span>
          {term.custom && <span className="text-[9.5px] font-semibold uppercase px-1.5 py-0.5 rounded bg-[var(--lav)] text-[var(--lav-text)]">meu</span>}
        </div>
        <h3 className="font-semibold text-[13.5px]">{term.termo}</h3>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {term.sinonimos.slice(0, 3).map(s => (
            <span key={s} className="text-[10.5px] px-1.5 py-0.5 rounded-full border border-[var(--border)] text-[var(--text-2)]">“{s}”</span>
          ))}
        </div>
        <p className="text-[12px] text-[var(--text-2)] mt-2 leading-relaxed">{term.explicacao}</p>

        <div className="mt-2.5 space-y-1.5">
          {richPrompts(term).map((p, i) => (
            <div key={i} className="rounded-lg bg-[#23231f] p-2 relative group/p">
              <span className="text-[9px] uppercase tracking-wider text-white/40">{p.rotulo}</span>
              <p className="text-[10.5px] text-white/85 font-mono leading-snug mt-0.5 pr-8">{p.texto}</p>
              <button
                onClick={() => copy(p.texto, i, p.rotulo)}
                className="absolute top-1.5 right-1.5 text-[9.5px] px-1.5 py-0.5 rounded bg-white/10 text-white/70 hover:bg-white/20"
              >{copied === i ? '✓' : 'copiar'}</button>
            </div>
          ))}
        </div>

        <div className="mt-2.5 text-[11px]">
          {!editRef && (
            term.referencia_real
              ? <span className="flex items-center gap-1.5">
                  <a href={term.referencia_real} target="_blank" className="text-[var(--green)] underline underline-offset-2 truncate">referência validada ↗</a>
                  <button onClick={() => setEditRef(true)} className="text-[var(--text-3)]">editar</button>
                </span>
              : <button onClick={() => setEditRef(true)} className="text-[var(--text-3)] hover:text-[var(--text)]">+ anexar referência real</button>
          )}
          {editRef && (
            <div className="flex gap-1">
              <input value={refUrl} onChange={e => setRefUrl(e.target.value)} placeholder="URL da imagem/still validado"
                className="flex-1 text-[11px] rounded border border-[var(--border)] px-1.5 py-1 outline-none" />
              <button onClick={saveRef} className="text-[11px] px-2 rounded bg-[var(--accent)] text-white">ok</button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

async function fileToImage(files: FileList | null): Promise<{ dataUrl: string; mimeType: string } | null> {
  const f = files?.[0]
  if (!f || !f.type.startsWith('image/')) return null
  const dataUrl = await new Promise<string>(resolve => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.readAsDataURL(f)
  })
  return { dataUrl, mimeType: f.type }
}

function AssistantPanel({ onHighlight, onClose }: { onHighlight: (ids: string[]) => void; onClose: () => void }) {
  const [history, setHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string; termIds?: string[]; imgUrl?: string }>>([])
  const [input, setInput] = useState('')
  const [img, setImg] = useState<{ dataUrl: string; mimeType: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight }) }, [history])

  async function ask() {
    if ((!input.trim() && !img) || busy) return
    const next = [...history, { role: 'user' as const, content: input.trim(), imgUrl: img?.dataUrl }]
    setHistory(next)
    const sentImg = img
    setInput('')
    setImg(null)
    setBusy(true)
    try {
      const res = await fetch('/api/library/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: next.map(({ role, content }) => ({ role, content })),
          image: sentImg ?? undefined,
        }),
      })
      const data = await res.json()
      setHistory(h => [...h, { role: 'assistant', content: data.reply || 'Não entendi — reformula?', termIds: data.termIds }])
      if (data.termIds?.length) onHighlight(data.termIds)
    } catch {
      setHistory(h => [...h, { role: 'assistant', content: 'Erro na chamada — tenta de novo.' }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside
      className="w-[320px] shrink-0 border-l border-[var(--border)] bg-[var(--panel)] flex flex-col"
      onDragOver={e => e.preventDefault()}
      onDrop={async e => { e.preventDefault(); const i = await fileToImage(e.dataTransfer.files); if (i) setImg(i) }}
    >
      <header className="h-12 shrink-0 border-b border-[var(--border)] flex items-center px-4">
        <span className="text-[13px] font-semibold">✦ Assistente</span>
        <button onClick={onClose} className="ml-auto text-[var(--text-3)] hover:text-[var(--text)]">✕</button>
      </header>
      <div ref={boxRef} className="flex-1 overflow-y-auto p-3.5 space-y-3">
        {history.length === 0 && (
          <p className="text-[12.5px] text-[var(--text-2)]">
            Descreva do seu jeito: <em>“quero aquele efeito de fundo que gira quando mexo o mouse”</em> — ou anexe uma imagem (📎) e diga <em>“quero algo nesse estilo”</em>. Eu acho o termo certo e destaco os cards.
          </p>
        )}
        {history.map((m, i) => (
          <div key={i} className={`text-[12.5px] rounded-lg p-2.5 ${m.role === 'user' ? 'bg-[var(--panel-2)] ml-6' : 'bg-[var(--card)] border border-[var(--border)] mr-2'}`}>
            {m.imgUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.imgUrl} alt="referência" className="mb-1.5 rounded-md max-h-32 w-auto" />
            )}
            {m.content}
            {m.termIds && m.termIds.length > 0 && (
              <button onClick={() => onHighlight(m.termIds!)} className="block mt-1.5 text-[11px] text-[var(--green)] underline underline-offset-2">
                ver {m.termIds.length} termo(s) no catálogo →
              </button>
            )}
          </div>
        ))}
        {busy && <p className="text-[12px] text-[var(--text-3)]">pensando…</p>}
      </div>
      <div className="p-3 border-t border-[var(--border)]">
        {img && (
          <div className="mb-2 flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.dataUrl} alt="referência" className="h-10 w-10 rounded object-cover" />
            <span className="flex-1 text-[11.5px] text-[var(--text-2)]">imagem de referência anexada</span>
            <button onClick={() => setImg(null)} className="text-[11.5px] text-[var(--text-3)] hover:text-[var(--red)]">remover</button>
          </div>
        )}
        <div className="flex gap-1.5">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async e => { setImg(await fileToImage(e.target.files)); e.target.value = '' }} />
          <button onClick={() => fileRef.current?.click()} title="anexar imagem de referência" className="text-[13px] px-2 rounded-lg border border-[var(--border)] hover:bg-[var(--panel-2)]">📎</button>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && ask()}
            placeholder={img ? 'descreva ou só envie…' : 'descreva o efeito…'}
            className="flex-1 text-[12.5px] rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 outline-none focus:border-[var(--text-3)]"
          />
          <button onClick={ask} disabled={busy} className="text-[12px] px-3 rounded-lg bg-[var(--accent)] text-white disabled:opacity-40">→</button>
        </div>
      </div>
    </aside>
  )
}

interface BriefingSuggestion {
  titulo: string
  porque: string
  termIds: string[]
  novoTermo?: { termo: string; explicacao: string; promptExemplo: string }
}

function BriefingPanel({ onHighlight, onSaved, onClose, terms, onUseInChat }: {
  onHighlight: (ids: string[]) => void
  onSaved: () => void
  onClose: () => void
  terms: Term[]
  onUseInChat?: (text: string) => void
}) {
  // monta o texto que vai pro composer da conversa: direção + prompts dos termos
  function buildDirection(s: BriefingSuggestion): string {
    const parts = [`DIREÇÃO DE ESTILO: ${s.titulo}`, s.porque]
    for (const id of s.termIds || []) {
      const t = terms.find(x => x.id === id)
      if (!t) continue
      const p = richPrompts(t)[0]
      parts.push(`- ${t.termo}: ${p?.texto ?? t.explicacao}`)
    }
    if (s.novoTermo) parts.push(`- ${s.novoTermo.termo}: ${s.novoTermo.promptExemplo}`)
    parts.push('Use esta direção de estilo nos prompts dos takes.')
    return parts.join('\n')
  }

  const [briefing, setBriefing] = useState('')
  const [img, setImg] = useState<{ dataUrl: string; mimeType: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ resumo: string; sugestoes: BriefingSuggestion[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function analyze() {
    if ((!briefing.trim() && !img) || busy) return
    setBusy(true)
    setResult(null)
    try {
      const res = await fetch('/api/library/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefing, image: img ?? undefined }),
      })
      setResult(await res.json())
    } finally {
      setBusy(false)
    }
  }

  async function addToCatalog(n: NonNullable<BriefingSuggestion['novoTermo']>) {
    await fetch('/api/library/terms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: n.termo.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        categoria: 'sugeridos',
        termo: n.termo,
        sinonimos: [],
        explicacao: n.explicacao,
        prompts: [{ rotulo: 'Direto', texto: n.promptExemplo }],
      }),
    })
    onSaved()
  }

  return (
    <aside
      className="w-[360px] shrink-0 border-l border-[var(--border)] bg-[var(--panel)] flex flex-col"
      onDragOver={e => e.preventDefault()}
      onDrop={async e => { e.preventDefault(); const i = await fileToImage(e.dataTransfer.files); if (i) setImg(i) }}
    >
      <header className="h-12 shrink-0 border-b border-[var(--border)] flex items-center px-4">
        <span className="text-[13px] font-semibold">Analisador de briefing</span>
        <button onClick={onClose} className="ml-auto text-[var(--text-3)] hover:text-[var(--text)]">✕</button>
      </header>
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
        <textarea
          value={briefing}
          onChange={e => setBriefing(e.target.value)}
          rows={6}
          placeholder="Cole o briefing do cliente (pode vir bagunçado) — eu devolvo 4-6 direções de estilo pra compor o vídeo. Pode anexar uma imagem de referência (“quero algo nesse estilo”)."
          className="w-full text-[12.5px] rounded-lg border border-[var(--border)] bg-[var(--card)] p-2.5 outline-none focus:border-[var(--text-3)] resize-y"
        />
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async e => { setImg(await fileToImage(e.target.files)); e.target.value = '' }} />
        {img ? (
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.dataUrl} alt="referência" className="h-12 w-12 rounded object-cover" />
            <span className="flex-1 text-[11.5px] text-[var(--text-2)]">imagem de referência anexada</span>
            <button onClick={() => setImg(null)} className="text-[11.5px] text-[var(--text-3)] hover:text-[var(--red)]">remover</button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} className="w-full py-1.5 rounded-lg border border-dashed border-[var(--border)] text-[11.5px] text-[var(--text-2)] hover:border-[var(--text-3)]">
            📎 anexar imagem de referência
          </button>
        )}
        <button onClick={analyze} disabled={busy || (!briefing.trim() && !img)} className="w-full py-1.5 rounded-lg bg-[var(--accent)] text-white text-[12.5px] disabled:opacity-40">
          {busy ? 'analisando…' : 'Analisar'}
        </button>
        {result && (
          <>
            <p className="text-[12.5px] text-[var(--text-2)] italic">{result.resumo}</p>
            {result.sugestoes?.map((s, i) => (
              <div key={i} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-2.5">
                <h4 className="text-[12.5px] font-semibold">{s.titulo}</h4>
                <p className="text-[11.5px] text-[var(--text-2)] mt-0.5">{s.porque}</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {onUseInChat && (
                    <button onClick={() => onUseInChat(buildDirection(s))} className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--accent)] text-white">
                      ✎ usar no chat
                    </button>
                  )}
                  {s.termIds?.length > 0 && (
                    <button onClick={() => onHighlight(s.termIds)} className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--green-bg)] text-[var(--green)]">
                      ver no catálogo ({s.termIds.length})
                    </button>
                  )}
                  {s.novoTermo && (
                    <button onClick={() => addToCatalog(s.novoTermo!)} className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--lav)] text-[var(--lav-text)]">
                      + adicionar “{s.novoTermo.termo}” ao catálogo
                    </button>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </aside>
  )
}

function SuggestPanel({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const [categoria, setCategoria] = useState('')
  const [tema, setTema] = useState('')
  const [img, setImg] = useState<{ dataUrl: string; mimeType: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [candidatos, setCandidatos] = useState<Term[]>([])
  const [added, setAdded] = useState<Set<string>>(new Set())
  const fileRef = useRef<HTMLInputElement>(null)

  async function gerar() {
    setBusy(true)
    setCandidatos([])
    try {
      const res = await fetch('/api/library/suggest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoria: categoria || undefined, tema: tema || undefined, image: img ?? undefined }),
      })
      const data = await res.json()
      setCandidatos(data.candidatos || [])
      setAdded(new Set())
    } finally {
      setBusy(false)
    }
  }

  async function add(t: Term) {
    // termos aprovados aqui entram agrupados na categoria "Sugeridos" (não se
    // perdem soltos no meio das categorias-base); a categoria original do Haiku
    // vira sinônimo pra não sumir da busca.
    const termo: Term = {
      ...t,
      categoria: 'sugeridos',
      sinonimos: Array.from(new Set([...(t.sinonimos || []), t.categoria])),
    }
    await fetch('/api/library/terms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(termo) })
    setAdded(s => new Set([...s, t.id]))
    onSaved()
  }

  return (
    <aside
      className="w-[340px] shrink-0 border-l border-[var(--border)] bg-[var(--panel)] flex flex-col"
      onDragOver={e => e.preventDefault()}
      onDrop={async e => { e.preventDefault(); const i = await fileToImage(e.dataTransfer.files); if (i) setImg(i) }}
    >
      <header className="h-12 shrink-0 border-b border-[var(--border)] flex items-center px-4">
        <span className="text-[13px] font-semibold">✦ Gerar termos novos</span>
        <button onClick={onClose} className="ml-auto text-[var(--text-3)] hover:text-[var(--text)]">✕</button>
      </header>
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
        <p className="text-[12px] text-[var(--text-2)]">O Haiku propõe 5 termos que ainda não estão no catálogo — você aprova um a um. Pode anexar uma foto do efeito/estilo que você quer nomear.</p>
        <select value={categoria} onChange={e => setCategoria(e.target.value)} className="w-full text-[12px] rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 outline-none">
          <option value="">categoria: qualquer lacuna</option>
          {CATEGORIES.filter(c => c.id !== 'todas').map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <input value={tema} onChange={e => setTema(e.target.value)} placeholder="tema opcional (ex: transições, luz natural)" className="w-full text-[12px] rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 outline-none" />
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async e => { setImg(await fileToImage(e.target.files)); e.target.value = '' }} />
        {img ? (
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.dataUrl} alt="referência" className="h-12 w-12 rounded object-cover" />
            <span className="flex-1 text-[11.5px] text-[var(--text-2)]">imagem de referência anexada</span>
            <button onClick={() => setImg(null)} className="text-[11.5px] text-[var(--text-3)] hover:text-[var(--red)]">remover</button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} className="w-full py-1.5 rounded-lg border border-dashed border-[var(--border)] text-[11.5px] text-[var(--text-2)] hover:border-[var(--text-3)]">
            📎 anexar imagem do estilo que quero
          </button>
        )}
        <button onClick={gerar} disabled={busy || (!categoria && !tema.trim() && !img)} className="w-full py-1.5 rounded-lg bg-[var(--accent)] text-white text-[12.5px] disabled:opacity-40">
          {busy ? 'gerando…' : 'Gerar 5 candidatos'}
        </button>
        {candidatos.map(t => (
          <div key={t.id} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[9.5px] font-semibold uppercase px-1.5 py-0.5 rounded bg-[var(--panel-2)] text-[var(--text-2)]">{t.categoria}</span>
              <h4 className="text-[12.5px] font-semibold">{t.termo}</h4>
            </div>
            <p className="text-[11.5px] text-[var(--text-2)] mt-1">{t.explicacao}</p>
            <p className="text-[10.5px] text-[var(--text-3)] mt-1">“{t.sinonimos.slice(0, 3).join('”, “')}”</p>
            <button
              onClick={() => add(t)}
              disabled={added.has(t.id)}
              className="mt-1.5 text-[11px] px-2 py-0.5 rounded-full bg-[var(--green-bg)] text-[var(--green)] disabled:opacity-50"
            >{added.has(t.id) ? '✓ no catálogo' : '+ adicionar ao catálogo'}</button>
          </div>
        ))}
      </div>
    </aside>
  )
}

function ImportModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [json, setJson] = useState('')
  const [error, setError] = useState('')
  const [count, setCount] = useState<number | null>(null)

  async function doImport() {
    setError('')
    let terms: Term[]
    try {
      const parsed = JSON.parse(json)
      terms = Array.isArray(parsed) ? parsed : [parsed]
    } catch {
      setError('JSON inválido — cole um array de termos no schema da biblioteca.')
      return
    }
    let ok = 0
    for (const t of terms) {
      if (!t.id || !t.termo || !t.categoria) continue
      const res = await fetch('/api/library/terms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(t) })
      if (res.ok) ok++
    }
    setCount(ok)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 grid place-items-center" onClick={onClose}>
      <div className="w-[520px] max-h-[85vh] overflow-y-auto rounded-2xl bg-[var(--panel)] border border-[var(--border)] p-5 space-y-2.5" onClick={e => e.stopPropagation()}>
        <h2 className="font-semibold text-[14px]">Importar termos em lote</h2>
        <p className="text-[12px] text-[var(--text-2)]">
          Cole um array JSON no schema da biblioteca: {'{ id, categoria, termo, sinonimos[], explicacao, prompts[{rotulo, texto}] }'}
        </p>
        <textarea
          value={json}
          onChange={e => setJson(e.target.value)}
          rows={12}
          placeholder='[{"id": "dutch-angle", "categoria": "camera", "termo": "Dutch Angle", ...}]'
          className="w-full text-[11.5px] font-mono rounded-lg border border-[var(--border)] bg-[var(--card)] p-2.5 outline-none focus:border-[var(--text-3)]"
        />
        {error && <p className="text-[12px] text-[var(--red)]">{error}</p>}
        {count !== null && <p className="text-[12px] text-[var(--green)]">✓ {count} termo(s) importado(s).</p>}
        <div className="flex justify-end gap-1.5">
          <button onClick={onClose} className="text-[12.5px] px-3 py-1.5 rounded-lg border border-[var(--border)]">Fechar</button>
          <button onClick={doImport} className="text-[12.5px] px-4 py-1.5 rounded-lg bg-[var(--accent)] text-white">Importar</button>
        </div>
      </div>
    </div>
  )
}

function AddTermModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ termo: '', categoria: 'camera' as TermCategory, sinonimos: '', explicacao: '', promptDireto: '', promptCine: '' })

  async function save() {
    if (!f.termo.trim()) return
    await fetch('/api/library/terms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: f.termo.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        categoria: f.categoria,
        termo: f.termo.trim(),
        sinonimos: f.sinonimos.split(',').map(s => s.trim()).filter(Boolean),
        explicacao: f.explicacao.trim(),
        prompts: [
          ...(f.promptDireto.trim() ? [{ rotulo: 'Direto', texto: f.promptDireto.trim() }] : []),
          ...(f.promptCine.trim() ? [{ rotulo: 'Cinematográfico', texto: f.promptCine.trim() }] : []),
        ],
      }),
    })
    onSaved()
  }

  const input = 'w-full text-[12.5px] rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 outline-none focus:border-[var(--text-3)]'

  return (
    <div className="fixed inset-0 z-50 bg-black/30 grid place-items-center" onClick={onClose}>
      <div className="w-[440px] max-h-[85vh] overflow-y-auto rounded-2xl bg-[var(--panel)] border border-[var(--border)] p-5 space-y-2.5" onClick={e => e.stopPropagation()}>
        <h2 className="font-semibold text-[14px]">Novo termo</h2>
        <input className={input} placeholder="Nome técnico (ex: Dutch Angle)" value={f.termo} onChange={e => setF({ ...f, termo: e.target.value })} />
        <select className={input} value={f.categoria} onChange={e => setF({ ...f, categoria: e.target.value as TermCategory })}>
          {CATEGORIES.filter(c => c.id !== 'todas').map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <input className={input} placeholder="Sinônimos leigos, separados por vírgula" value={f.sinonimos} onChange={e => setF({ ...f, sinonimos: e.target.value })} />
        <textarea className={input} rows={3} placeholder="Explicação simples em PT-BR" value={f.explicacao} onChange={e => setF({ ...f, explicacao: e.target.value })} />
        <textarea className={input} rows={2} placeholder="Prompt direto (inglês)" value={f.promptDireto} onChange={e => setF({ ...f, promptDireto: e.target.value })} />
        <textarea className={input} rows={2} placeholder="Prompt cinematográfico (inglês, opcional)" value={f.promptCine} onChange={e => setF({ ...f, promptCine: e.target.value })} />
        <div className="flex justify-end gap-1.5 pt-1">
          <button onClick={onClose} className="text-[12.5px] px-3 py-1.5 rounded-lg border border-[var(--border)]">Cancelar</button>
          <button onClick={save} className="text-[12.5px] px-4 py-1.5 rounded-lg bg-[var(--accent)] text-white">Salvar</button>
        </div>
      </div>
    </div>
  )
}
