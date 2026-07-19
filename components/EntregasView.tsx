'use client'

import { useEffect, useRef, useState } from 'react'
import { ClientIndex, Delivery, DeliveryIndexEntry, DeliveryDirection } from '@/lib/types'
import CanvasEditor from './CanvasEditor'

// Painel INTERNO de Entregas (só o usuário). Cria entrega, sobe itens 4K (com
// thumbnail gerada no cliente), edita o processo, controla o slug/link público
// e vê o agregado de aprovações/comentários do cliente.

// gera thumbnail (~480px, jpeg) no browser — imagem ou 1º frame de vídeo.
// Tem timeout: um arquivo que não carrega não pode travar a fila de uploads.
function makeThumb(file: File): Promise<string | undefined> {
  const draw = (w: number, h: number, el: CanvasImageSource) => {
    const max = 480, scale = Math.min(1, max / Math.max(w, h))
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(w * scale)); c.height = Math.max(1, Math.round(h * scale))
    c.getContext('2d')?.drawImage(el, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.7)
  }
  const gen = new Promise<string | undefined>(res => {
    const url = URL.createObjectURL(file)
    if (file.type.startsWith('image/')) {
      const img = new Image()
      img.onload = () => { let t; try { t = draw(img.width, img.height, img) } catch { t = undefined } URL.revokeObjectURL(url); res(t) }
      img.onerror = () => { URL.revokeObjectURL(url); res(undefined) }
      img.src = url
    } else if (file.type.startsWith('video/')) {
      const v = document.createElement('video')
      v.muted = true; v.playsInline = true
      v.onloadeddata = () => { v.currentTime = Math.min(0.1, v.duration || 0.1) }
      v.onseeked = () => { let t; try { t = draw(v.videoWidth, v.videoHeight, v) } catch { t = undefined } URL.revokeObjectURL(url); res(t) }
      v.onerror = () => { URL.revokeObjectURL(url); res(undefined) }
      v.src = url
    } else { URL.revokeObjectURL(url); res(undefined) }
  })
  const timeout = new Promise<string | undefined>(res => setTimeout(() => res(undefined), 8000))
  return Promise.race([gen, timeout])
}

export default function EntregasView({ clients }: { clients: ClientIndex[] }) {
  const [list, setList] = useState<DeliveryIndexEntry[]>([])
  const [sel, setSel] = useState<Delivery | null>(null)
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newClient, setNewClient] = useState('')

  async function load() {
    try { setList(await (await fetch('/api/deliveries')).json()) } catch { /* silencioso */ }
  }
  useEffect(() => { load() }, [])

  async function open(id: string) {
    setSel(await (await fetch(`/api/deliveries/${id}`)).json())
  }

  async function create() {
    const clienteNome = clients.find(c => c.id === newClient)?.name || newClient || 'Cliente'
    const d = await (await fetch('/api/deliveries', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo: newTitle.trim() || 'Entrega', clienteNome, clientId: newClient || undefined }),
    })).json()
    setCreating(false); setNewTitle(''); setNewClient('')
    await load(); setSel(d)
  }

  async function removeDelivery(id: string) {
    if (!confirm('Apagar esta entrega e todos os arquivos dela? Não tem volta.')) return
    await fetch(`/api/deliveries/${id}`, { method: 'DELETE' })
    if (sel?.id === id) setSel(null)
    load()
  }

  return (
    <div className="flex-1 min-w-0 flex bg-[var(--card)] max-md:flex-col">
      {/* lista */}
      <aside className="w-[260px] max-md:w-full shrink-0 border-r max-md:border-r-0 max-md:border-b border-[var(--border)] flex flex-col">
        <header className="h-12 shrink-0 border-b border-[var(--border)] flex items-center px-4 gap-2">
          <span className="text-[13px] font-semibold">Entregas</span>
          <button onClick={() => setCreating(v => !v)} className="ml-auto text-[12px] px-2 py-1 rounded-lg bg-[var(--accent)] text-white">+ nova</button>
        </header>
        {creating && (
          <div className="p-3 border-b border-[var(--border)] space-y-2">
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="título (ex: Campanha X)" className="w-full text-[12px] rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 outline-none" />
            <select value={newClient} onChange={e => setNewClient(e.target.value)} className="w-full text-[12px] rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 outline-none">
              <option value="">cliente…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button onClick={create} className="w-full text-[12px] py-1.5 rounded-lg bg-[var(--accent)] text-white">criar entrega</button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 max-md:max-h-48">
          {list.map(e => (
            <button key={e.id} onClick={() => open(e.id)} className={`w-full text-left px-2.5 py-2 rounded-lg ${sel?.id === e.id ? 'bg-[var(--panel-2)]' : 'hover:bg-[var(--panel-2)]'}`}>
              <div className="flex items-center gap-1.5">
                <p className="text-[12.5px] font-medium truncate">{e.titulo}</p>
                {e.receivedAt && (e.keep
                  ? <span className="ml-auto shrink-0 text-[9px] px-1 py-0.5 rounded bg-[var(--panel-2)] text-[var(--text-2)]">📌 mantida</span>
                  : <span className="ml-auto shrink-0 text-[9px] px-1 py-0.5 rounded bg-[var(--amber-bg)] text-[var(--amber)]">⏳ recebida</span>)}
              </div>
              <p className="text-[10.5px] text-[var(--text-3)]">{e.clienteNome}</p>
            </button>
          ))}
          {list.length === 0 && <p className="text-[12px] text-[var(--text-3)] px-2 py-2">Nenhuma entrega ainda.</p>}
        </div>
      </aside>

      {/* editor */}
      <section className="flex-1 min-w-0 overflow-y-auto">
        {sel ? <Editor key={sel.id} delivery={sel} onChanged={d => { setSel(d); load() }} onRemove={() => removeDelivery(sel.id)} />
          : <div className="grid place-items-center h-full text-[13px] text-[var(--text-2)] p-6 text-center">Selecione ou crie uma entrega. Cada uma vira um link único pro cliente aprovar.</div>}
      </section>
    </div>
  )
}

function Editor({ delivery, onChanged, onRemove }: { delivery: Delivery; onChanged: (d: Delivery) => void; onRemove: () => void }) {
  const [d, setD] = useState<Delivery>(delivery)
  const [prog, setProg] = useState<{ done: number; total: number } | null>(null)
  const [copied, setCopied] = useState(false)
  const [slugEdit, setSlugEdit] = useState(d.slug)
  const [isLocal, setIsLocal] = useState(false) // canvas Excalidraw só em localhost (em teste)
  useEffect(() => { setIsLocal(['localhost', '127.0.0.1'].includes(window.location.hostname)) }, [])
  const fileRef = useRef<HTMLInputElement>(null)

  // Relógio pra contagem regressiva do backup de 24h (só quando recebido e não-mantido)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!d.receivedAt || d.keep) return
    const iv = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(iv)
  }, [d.receivedAt, d.keep])
  const RETENTION_MS = 24 * 60 * 60 * 1000
  const remainMs = d.receivedAt && !d.keep ? Date.parse(d.receivedAt) + RETENTION_MS - now : null
  const fmtRemain = (ms: number) => {
    if (ms <= 0) return 'vencido (some no próximo acesso)'
    const h = Math.floor(ms / 3_600_000), m = Math.floor((ms % 3_600_000) / 60_000)
    return h > 0 ? `${h}h ${m}min` : `${m}min`
  }

  // Ao vivo: enquanto você olha a entrega, reflete aprovações/comentários do
  // cliente sem recarregar (polling leve no endpoint de status).
  const audioCountRef = useRef(d.audios?.length || 0)
  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const s = await (await fetch(`/api/deliveries/${d.id}/status`)).json()
        const map = new Map((s.itens || []).map((x: { id: string; status: string; comentario?: string }) => [x.id, x]))
        setD(prev => {
          let changed = false
          const itens = prev.itens.map(it => {
            const u = map.get(it.id) as { status: Delivery['itens'][number]['status']; comentario?: string } | undefined
            if (u && (u.status !== it.status || (u.comentario || '') !== (it.comentario || ''))) { changed = true; return { ...it, status: u.status, comentario: u.comentario } }
            return it
          })
          return changed ? { ...prev, itens } : prev
        })
        // recado de áudio novo → recarrega a entrega inteira (traz a transcrição)
        const ac = (s.audios?.length as number) || 0
        if (ac !== audioCountRef.current) {
          audioCountRef.current = ac
          const full = await (await fetch(`/api/deliveries/${d.id}`)).json()
          setD(full)
        }
      } catch { /* rede/servidor — silencioso, tenta de novo */ }
    }, 7000)
    return () => clearInterval(iv)
  }, [d.id])

  // link do cliente: domínio público (modely.com.br/[slug]) se configurado,
  // senão o mesmo host em /e/[slug].
  const base = process.env.NEXT_PUBLIC_DELIVERY_BASE
  const publicUrl = base
    ? `${base.replace(/\/$/, '')}/${d.slug}`
    : (typeof window !== 'undefined' ? `${window.location.origin}/e/${d.slug}` : `/e/${d.slug}`)

  async function patch(body: Record<string, unknown>) {
    const nd = await (await fetch(`/api/deliveries/${d.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json()
    setD(nd); onChanged(nd)
  }
  function setProc<K extends keyof Delivery['processo']>(k: K, v: Delivery['processo'][K]) {
    setD(prev => ({ ...prev, processo: { ...prev.processo, [k]: v } }))
  }
  async function saveProc() { await patch({ processo: d.processo }) }
  // autosave do canvas (debounced no CanvasEditor) — persiste sem recarregar
  function saveCanvas(scene: string) {
    setD(prev => ({ ...prev, processo: { ...prev.processo, canvas: scene } }))
    fetch(`/api/deliveries/${d.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ processo: { ...d.processo, canvas: scene } }),
    }).catch(() => {})
  }

  // Upload robusto pra MUITOS arquivos: fila com 3 workers em paralelo, cada
  // arquivo tolera falha (não derruba a leva), progresso X/N ao vivo.
  async function upload(files: FileList | File[] | null) {
    if (!files) return
    const arr = Array.from(files).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'))
    if (!arr.length) return
    setProg({ done: 0, total: arr.length })
    const queue = [...arr]
    let done = 0
    async function worker() {
      for (;;) {
        const f = queue.shift()
        if (!f) return
        try {
          const thumbnail = await makeThumb(f)
          const fd = new FormData()
          fd.append('file', f)
          if (thumbnail) fd.append('thumbnail', thumbnail)
          await fetch(`/api/deliveries/${d.id}/items`, { method: 'POST', body: fd })
        } catch { /* um arquivo falhou — segue a fila */ }
        done++
        setProg({ done, total: arr.length })
      }
    }
    await Promise.all([worker(), worker(), worker()])
    const nd = await (await fetch(`/api/deliveries/${d.id}`)).json()
    setD(nd); onChanged(nd); setProg(null)
  }

  async function removeItem(itemId: string) {
    await fetch(`/api/deliveries/${d.id}/items/${itemId}`, { method: 'DELETE' })
    const nd = await (await fetch(`/api/deliveries/${d.id}`)).json()
    setD(nd); onChanged(nd)
  }

  function setDir(i: number, patchDir: Partial<DeliveryDirection>) {
    setD(prev => ({ ...prev, processo: { ...prev.processo, direcoes: prev.processo.direcoes.map((x, j) => j === i ? { ...x, ...patchDir } : (patchDir.escolhida ? { ...x, escolhida: false } : x)) } }))
  }
  function addDir() { setD(prev => ({ ...prev, processo: { ...prev.processo, direcoes: [...prev.processo.direcoes, { rotulo: '', conceito: '' }] } })) }
  function rmDir(i: number) { setD(prev => ({ ...prev, processo: { ...prev.processo, direcoes: prev.processo.direcoes.filter((_, j) => j !== i) } })) }

  const aprov = d.itens.filter(i => i.status === 'aprovado').length
  const repr = d.itens.filter(i => i.status === 'reprovado').length
  const pend = d.itens.length - aprov - repr
  const comentarios = d.itens.filter(i => i.comentario?.trim())
  const inp = 'w-full text-[12px] rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 outline-none focus:border-[var(--text-3)]'

  return (
    <div className="p-5 max-md:p-3 max-w-3xl space-y-5">
      <div className="flex items-start gap-2">
        <div className="min-w-0">
          <h1 className="text-[16px] font-semibold">{d.titulo}</h1>
          <p className="text-[12px] text-[var(--text-2)]">{d.clienteNome}</p>
        </div>
        <button onClick={onRemove} className="ml-auto text-[11.5px] px-2.5 py-1 rounded-lg border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--red)]">apagar</button>
      </div>

      {/* ciclo de vida: recebido pelo cliente → backup de 24h → some sozinho */}
      {d.receivedAt && (
        <div className={`rounded-xl border p-3 space-y-2 ${d.keep ? 'border-[var(--border)] bg-[var(--panel)]' : 'border-[var(--amber)]/50 bg-[var(--amber-bg)]'}`}>
          {d.keep ? (
            <>
              <p className="text-[12.5px] font-medium">📌 Mantida — não expira</p>
              <p className="text-[11.5px] text-[var(--text-2)]">O cliente confirmou o recebimento em {new Date(d.receivedAt).toLocaleString('pt-BR')}. Os arquivos ficam guardados até você apagar.</p>
              <div className="flex gap-2">
                <button onClick={() => patch({ keep: false })} className="text-[11.5px] px-2.5 py-1 rounded-lg border border-[var(--border)]">parar de manter</button>
                <button onClick={onRemove} className="text-[11.5px] px-2.5 py-1 rounded-lg bg-[var(--red)] text-white">apagar agora</button>
              </div>
            </>
          ) : (
            <>
              <p className="text-[12.5px] font-medium text-[var(--amber)]">⏳ Cliente confirmou o recebimento — backup expira em {remainMs !== null ? fmtRemain(remainMs) : '—'}</p>
              <p className="text-[11.5px] text-[var(--text-2)]">Recebido em {new Date(d.receivedAt).toLocaleString('pt-BR')}. Depois disso os arquivos somem sozinhos pra liberar espaço. Baixe o que precisar (abaixo) e clique em <b>Manter</b> se quiser guardar.</p>
              <div className="flex gap-2">
                <button onClick={() => patch({ keep: true })} className="text-[11.5px] px-2.5 py-1 rounded-lg bg-[var(--accent)] text-white">Manter (não apagar)</button>
                <button onClick={onRemove} className="text-[11.5px] px-2.5 py-1 rounded-lg border border-[var(--red)] text-[var(--red)]">apagar agora</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* link público */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3 space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-[var(--text-3)]">Link público (sem login)</p>
        <div className="flex gap-1.5 items-center flex-wrap">
          <a href={publicUrl} target="_blank" className="text-[12.5px] text-[var(--accent)] underline underline-offset-2 truncate">{publicUrl}</a>
          <button onClick={() => { navigator.clipboard.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 1200) }} className="text-[11px] px-2 py-0.5 rounded bg-[var(--panel-2)]">{copied ? '✓' : 'copiar'}</button>
        </div>
        <div className="flex gap-1.5 items-center">
          <span className="text-[11px] text-[var(--text-3)]">slug:</span>
          <input value={slugEdit} onChange={e => setSlugEdit(e.target.value)} className="flex-1 text-[11.5px] rounded border border-[var(--border)] bg-[var(--card)] px-1.5 py-1 outline-none" />
          <button onClick={() => patch({ slug: slugEdit })} className="text-[11px] px-2 py-1 rounded bg-[var(--accent)] text-white">salvar</button>
          <button onClick={async () => { await patch({ regenSlug: true }) }} title="gerar novo sufixo" className="text-[11px] px-2 py-1 rounded border border-[var(--border)]">↻</button>
        </div>
      </div>

      {/* processo — canvas livre (Excalidraw) — EM TESTE: só em localhost */}
      {isLocal && (
        <div className="space-y-2">
          <h2 className="text-[13px] font-semibold">Processo (canvas) <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-[var(--lav)] text-[var(--lav-text)]">EM TESTE · localhost</span></h2>
          <p className="text-[11px] text-[var(--text-3)]">Desenhe, escreva e conecte livre. Salva sozinho. Oculto pro cliente em produção enquanto testamos.</p>
          <CanvasEditor initial={d.processo.canvas} onChange={saveCanvas} />
        </div>
      )}

      {/* campos estruturados do processo (o que o cliente vê) */}
      <details className="space-y-2.5" open={!isLocal}>
        <summary className="text-[12px] text-[var(--text-2)] cursor-pointer">Processo (campos estruturados — é isso que o cliente vê)</summary>
        <div className="space-y-2.5 mt-2">
        <textarea value={d.processo.origem} onChange={e => setProc('origem', e.target.value)} rows={2} placeholder="Ponto de partida: a ideia/briefing que o cliente trouxe." className={inp} />
        <div className="rounded-lg border border-[var(--border)] p-2.5 space-y-1.5">
          <p className="text-[10px] uppercase tracking-wide text-[var(--text-3)]">Direções consideradas (marque a escolhida)</p>
          {d.processo.direcoes.map((dir, i) => (
            <div key={i} className="flex gap-1.5 items-center">
              <input type="radio" checked={!!dir.escolhida} onChange={() => setDir(i, { escolhida: true })} title="escolhida" />
              <input value={dir.rotulo || ''} onChange={e => setDir(i, { rotulo: e.target.value })} placeholder="rótulo" className="w-[90px] text-[11.5px] rounded border border-[var(--border)] bg-[var(--panel)] px-1.5 py-1 outline-none" />
              <input value={dir.conceito} onChange={e => setDir(i, { conceito: e.target.value })} placeholder="conceito da direção" className="flex-1 text-[11.5px] rounded border border-[var(--border)] bg-[var(--panel)] px-1.5 py-1 outline-none" />
              <button onClick={() => rmDir(i)} className="text-[11px] text-[var(--text-3)] hover:text-[var(--red)]">✕</button>
            </div>
          ))}
          <button onClick={addDir} className="text-[11px] text-[var(--accent)]">+ direção</button>
        </div>
        <input value={d.processo.direcaoEscolhida} onChange={e => setProc('direcaoEscolhida', e.target.value)} placeholder="Direção escolhida (resumo)" className={inp} />
        <textarea value={d.processo.motivoEscolha} onChange={e => setProc('motivoEscolha', e.target.value)} rows={2} placeholder="Por que essa direção foi escolhida." className={inp} />
        <label className="flex items-center gap-2 text-[12px] text-[var(--text-2)]">
          <input type="checkbox" checked={d.processo.qcValidado} onChange={e => setProc('qcValidado', e.target.checked)} /> Material passou pelo QC (segurança de marca)
        </label>
        <button onClick={saveProc} className="text-[12px] px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white">salvar processo</button>
        </div>
      </details>

      {/* itens */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-[13px] font-semibold">Itens ({d.itens.length})</h2>
          <span className="text-[11.5px] text-[var(--text-2)] ml-auto"><b className="text-[var(--green)]">{aprov}</b>✓ · <b className="text-[var(--red)]">{repr}</b>✕ · {pend} pend.</span>
        </div>
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={e => { upload(e.target.files); e.target.value = '' }} />
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); upload(e.dataTransfer.files) }}
          className="rounded-lg border border-dashed border-[var(--border)] p-3 text-[12px] text-[var(--text-2)] text-center cursor-pointer hover:border-[var(--text-3)]"
        >
          {prog ? `enviando ${prog.done}/${prog.total}…` : '📎 arraste as imagens/vídeos finais (4K) aqui, ou clique (pode soltar vários de uma vez)'}
        </div>
        {d.itens.length > 0 && (
          <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
            {d.itens.map(it => (
              <div key={it.id} className={`group rounded-lg overflow-hidden border ${it.status === 'aprovado' ? 'border-[var(--green)]' : it.status === 'reprovado' ? 'border-[var(--red)]' : 'border-[var(--border)]'} bg-[var(--panel)]`}>
                <div className="aspect-square bg-black/20 relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {it.thumbnail ? <img src={it.thumbnail} alt="" className="w-full h-full object-cover" /> : <span className="absolute inset-0 grid place-items-center text-[10px] text-[var(--text-3)]">{it.tipo}</span>}
                  <button onClick={() => removeItem(it.id)} className="absolute top-1 right-1 hidden group-hover:block text-[10px] px-1 rounded bg-black/60 text-white">✕</button>
                  <a href={`/api/deliveries/${d.id}/items/${it.id}/file?download=1`} download title="baixar 4K (backup)" className="absolute top-1 left-1 hidden group-hover:block text-[10px] px-1 rounded bg-black/60 text-white">⬇</a>
                  <span className={`absolute bottom-1 left-1 text-[9px] px-1 py-0.5 rounded ${it.status === 'aprovado' ? 'bg-[var(--green)] text-white' : it.status === 'reprovado' ? 'bg-[var(--red)] text-white' : 'bg-black/50 text-white/80'}`}>{it.status}</span>
                </div>
                {it.comentario && <p className="text-[10px] text-[var(--text-2)] p-1.5 leading-snug">💬 {it.comentario}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* recados em áudio do cliente — ouvir e baixar */}
      {(d.audios?.length ?? 0) > 0 && (
        <div className="space-y-1.5">
          <h2 className="text-[13px] font-semibold">🎙 Recados em áudio ({d.audios!.length})</h2>
          {d.audios!.map(a => (
            <div key={a.id} className="text-[12px] rounded-lg border border-[var(--border)] bg-[var(--panel)] p-2.5 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wide text-[var(--text-3)]">{new Date(a.createdAt).toLocaleString('pt-BR')}</span>
                <a href={`/api/deliveries/${d.id}/audio/${a.id}?download=1`} download className="ml-auto text-[11px] px-2 py-0.5 rounded bg-[var(--accent)] text-white">⬇ baixar</a>
              </div>
              <audio controls preload="none" src={`/api/deliveries/${d.id}/audio/${a.id}`} className="w-full h-8" />
            </div>
          ))}
        </div>
      )}

      {/* agregado */}
      {comentarios.length > 0 && (
        <div className="space-y-1.5">
          <h2 className="text-[13px] font-semibold">Comentários do cliente ({comentarios.length})</h2>
          {comentarios.map(it => (
            <div key={it.id} className="text-[12px] rounded-lg border border-[var(--border)] bg-[var(--panel)] p-2 flex gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {it.thumbnail && <img src={it.thumbnail} alt="" className="w-9 h-9 rounded object-cover shrink-0" />}
              <div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${it.status === 'aprovado' ? 'bg-[var(--green-bg)] text-[var(--green)]' : it.status === 'reprovado' ? 'bg-[var(--red-bg)] text-[var(--red)]' : 'bg-[var(--panel-2)] text-[var(--text-2)]'}`}>{it.status}</span>
                <p className="mt-1">{it.comentario}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
