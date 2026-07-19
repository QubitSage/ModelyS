'use client'

import { useEffect, useRef, useState } from 'react'

interface EsteiraTake {
  id: string
  content: string
  status: 'pendente' | 'gerado' | 'refazer'
}

interface EsteiraSession {
  nome: string
  createdAt: string
  current: number
  takes: EsteiraTake[]
}

export default function EsteiraView() {
  const [session, setSession] = useState<EsteiraSession | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [newContent, setNewContent] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/esteira').then(r => r.json()).then(s => { setSession(s); setLoaded(true) })
  }, [])

  // mantém o take atual visível na lista lateral
  useEffect(() => {
    if (!session) return
    listRef.current?.querySelector(`[data-idx="${session.current}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [session?.current, session])

  async function patch(body: Record<string, unknown>) {
    const res = await fetch('/api/esteira', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) setSession(await res.json())
  }

  async function start() {
    setError('')
    const res = await fetch('/api/esteira', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: newContent }) })
    const data = await res.json()
    if (data.error) { setError(data.error); return }
    setSession(data)
    setNewContent('')
  }

  async function loadFile(files: FileList | null) {
    const f = files?.[0]
    if (f) setNewContent(await f.text())
  }

  // O clique central da esteira: copia o take atual, marca gerado, avança.
  async function copyAndAdvance() {
    if (!session) return
    const take = session.takes[session.current]
    await navigator.clipboard.writeText(take.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 900)
    const next = nextPendente(session, session.current)
    await patch({ takeIndex: session.current, status: 'gerado', current: next ?? session.current })
  }

  async function markRefazer() {
    if (!session) return
    const next = nextPendente(session, session.current)
    await patch({ takeIndex: session.current, status: 'refazer', current: next ?? session.current })
  }

  function nextPendente(s: EsteiraSession, from: number): number | null {
    for (let i = from + 1; i < s.takes.length; i++) if (s.takes[i].status !== 'gerado') return i
    for (let i = 0; i <= from; i++) if (s.takes[i].status === 'pendente') return i
    return null
  }

  if (!loaded) return <div className="flex-1 grid place-items-center bg-[var(--card)] text-[13px] text-[var(--text-2)]">carregando…</div>

  // ---- sem sessão: tela de carga ----
  if (!session) {
    return (
      <div className="flex-1 min-w-0 flex flex-col bg-[var(--card)] overflow-y-auto">
        <header className="h-14 shrink-0 border-b border-[var(--border)] flex items-center px-5">
          <h1 className="font-semibold text-[15px]">Esteira de takes</h1>
          <span className="ml-3 text-[12px] text-[var(--text-2)]">copiar → colar no Flow → avançar, um take por vez</span>
        </header>
        <div className="p-5 max-w-2xl w-full space-y-3">
          <p className="text-[12.5px] text-[var(--text-2)]">
            Cole os takes (o <b>aprovados.txt</b> do QC em lote, ou qualquer roteiro com um take por bloco) — a esteira mostra um por vez com o botão de copiar e avançar. O progresso fica salvo: feche e retome de onde parou.
          </p>
          <textarea
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            rows={10}
            placeholder="Cole os takes aqui, ou carregue o arquivo…"
            className="w-full text-[12.5px] font-mono rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3 outline-none focus:border-[var(--text-3)] resize-y"
          />
          <input ref={fileRef} type="file" accept=".txt,.md,.csv,.json" onChange={e => loadFile(e.target.files)} className="hidden" />
          <div className="flex gap-2">
            <button onClick={() => fileRef.current?.click()} className="text-[12.5px] px-3 py-1.5 rounded-lg border border-[var(--border)] hover:bg-[var(--panel-2)]">📄 carregar arquivo</button>
            <button onClick={start} disabled={!newContent.trim()} className="text-[12.5px] px-4 py-1.5 rounded-lg bg-[var(--accent)] text-white disabled:opacity-40">Iniciar esteira</button>
          </div>
          {error && <p className="text-[12px] text-[var(--red)]">{error}</p>}
        </div>
      </div>
    )
  }

  // ---- sessão ativa ----
  const take = session.takes[session.current]
  const gerados = session.takes.filter(t => t.status === 'gerado').length
  const refazer = session.takes.filter(t => t.status === 'refazer').length
  const pct = Math.round((gerados / session.takes.length) * 100)
  const dot = (s: EsteiraTake['status']) =>
    s === 'gerado' ? 'bg-[var(--green)]' : s === 'refazer' ? 'bg-[var(--red)]' : 'bg-[var(--border)]'

  return (
    <div className="flex-1 min-w-0 flex bg-[var(--card)]">
      <section className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 shrink-0 border-b border-[var(--border)] flex items-center px-5 max-md:px-3 gap-3">
          <h1 className="font-semibold text-[15px]">Esteira</h1>
          <span className="text-[12px] text-[var(--text-2)] truncate max-md:hidden">{session.nome}</span>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-[12px] text-[var(--text-2)] max-md:text-[11px]">
              <b className="text-[var(--green)]">{gerados}</b>✓ · <b className="text-[var(--red)]">{refazer}</b>✕ · {session.takes.length - gerados - refazer} pend.
            </span>
            <button
              onClick={async () => { if (confirm('Encerrar esta esteira? O progresso será descartado.')) { await fetch('/api/esteira', { method: 'DELETE' }); setSession(null) } }}
              className="text-[11.5px] px-2.5 py-1 rounded-lg border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--red)]"
            >encerrar</button>
          </div>
        </header>

        {/* barra de progresso */}
        <div className="h-1.5 bg-[var(--panel-2)]">
          <div className="h-full bg-[var(--green)] transition-all" style={{ width: `${pct}%` }} />
        </div>

        <div className="flex-1 overflow-y-auto p-6 max-md:p-3 grid place-items-center">
          <div className="w-full max-w-2xl">
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="font-semibold text-[16px]">Take {take.id}</h2>
              <span className="text-[12px] text-[var(--text-3)]">{session.current + 1} de {session.takes.length} · {pct}% gerado</span>
            </div>
            <div className={`rounded-2xl border-2 p-5 text-[13.5px] leading-relaxed whitespace-pre-wrap font-mono bg-[var(--panel)] max-h-[46vh] overflow-y-auto ${
              take.status === 'gerado' ? 'border-[var(--green)]' : take.status === 'refazer' ? 'border-[var(--red)]' : 'border-[var(--border)]'
            }`}>
              {take.content}
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={copyAndAdvance}
                className="flex-1 py-3 rounded-xl bg-[var(--accent)] text-white text-[14px] font-medium hover:opacity-90"
              >
                {copied ? '✓ copiado!' : '📋 Copiar e avançar'}
              </button>
              <button onClick={markRefazer} className="px-4 rounded-xl border border-[var(--red)] text-[var(--red)] text-[13px] hover:bg-[var(--red-bg)]">
                ✕ refazer
              </button>
            </div>
            <div className="flex justify-between mt-2.5">
              <button onClick={() => patch({ current: session.current - 1 })} disabled={session.current === 0} className="text-[12px] text-[var(--text-2)] hover:text-[var(--text)] disabled:opacity-30">← anterior</button>
              <span className="text-[11px] text-[var(--text-3)]">cole no Flow com Ctrl+V e volte</span>
              <button onClick={() => patch({ current: session.current + 1 })} disabled={session.current >= session.takes.length - 1} className="text-[12px] text-[var(--text-2)] hover:text-[var(--text)] disabled:opacity-30">próximo →</button>
            </div>

            {refazer > 0 && (
              <button
                onClick={() => {
                  const i = session.takes.findIndex(t => t.status === 'refazer')
                  if (i >= 0) patch({ current: i })
                }}
                className="mt-3 text-[11.5px] text-[var(--red)] underline underline-offset-2"
              >ir pro próximo “refazer” ({refazer})</button>
            )}
          </div>
        </div>
      </section>

      {/* lista lateral (some no mobile — a navegação anterior/próximo cobre) */}
      <aside className="w-[220px] shrink-0 border-l border-[var(--border)] bg-[var(--panel)] flex flex-col max-md:hidden">
        <div className="h-12 shrink-0 border-b border-[var(--border)] flex items-center px-3.5">
          <span className="text-[12px] font-semibold">Takes</span>
        </div>
        <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {session.takes.map((t, i) => (
            <button
              key={i}
              data-idx={i}
              onClick={() => patch({ current: i })}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-[12px] ${
                i === session.current ? 'bg-[var(--panel-2)] font-medium' : 'hover:bg-[var(--panel-2)] text-[var(--text-2)]'
              }`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${dot(t.status)}`} />
              <span className="truncate">Take {t.id}</span>
            </button>
          ))}
        </div>
      </aside>
    </div>
  )
}
