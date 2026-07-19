'use client'

import { useEffect, useMemo, useState } from 'react'
import { ClientIndex, FormatEntry } from '@/lib/types'

// Biblioteca de FORMATOS que deram certo — o que já performou pra você (prova
// concreta), captura MANUAL. Aba isolada: nada aqui entra no chat de geração.

const TIPOS = ['comercial', 'talking-head', 'motion', 'still de produto', 'reels/short', 'vsl', 'outro']

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export default function FormatsView({ clients }: { clients: ClientIndex[] }) {
  const [items, setItems] = useState<FormatEntry[]>([])
  const [q, setQ] = useState('')
  const [fCliente, setFCliente] = useState('')
  const [fTipo, setFTipo] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  async function load() {
    try { setItems(await (await fetch('/api/formats')).json()) } catch { /* silencioso */ }
  }
  useEffect(() => { load() }, [])

  const tags = useMemo(() => Array.from(new Set(items.flatMap(i => i.tags))).sort(), [items])
  const filtered = useMemo(() => {
    const nq = normalize(q.trim())
    return items.filter(i => {
      if (fCliente && normalize(i.clienteProjeto) !== normalize(fCliente)) return false
      if (fTipo && i.tipo !== fTipo) return false
      if (!nq) return true
      return normalize(`${i.clienteProjeto} ${i.tipo} ${i.descricao} ${i.metrica || ''} ${i.tags.join(' ')}`).includes(nq)
    })
  }, [items, q, fCliente, fTipo])

  async function remove(id: string) {
    if (!confirm('Remover este formato do catálogo?')) return
    await fetch(`/api/formats?id=${id}`, { method: 'DELETE' })
    load()
  }

  const clienteNomes = Array.from(new Set([...clients.map(c => c.name), ...items.map(i => i.clienteProjeto)])).sort()

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-[var(--card)] overflow-y-auto">
      <header className="shrink-0 border-b border-[var(--border)] px-5 max-md:px-3 pt-4 pb-3">
        <div className="flex items-start gap-3">
          <div className="min-w-0">
            <h1 className="font-semibold text-[15px]">Formatos que deram certo</h1>
            <p className="text-[12px] text-[var(--text-2)]">{items.length} registro(s) — o que já performou pra você, não teoria. Captura manual.</p>
          </div>
          <button onClick={() => setShowAdd(true)} className="ml-auto shrink-0 text-[12.5px] px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white">+ marcar formato de sucesso</button>
        </div>

        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por descrição, tipo, tag, métrica…"
          className="w-full mt-3 text-[13px] rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 outline-none focus:border-[var(--text-3)]" />
        <div className="flex gap-2 mt-2 flex-wrap">
          <select value={fCliente} onChange={e => setFCliente(e.target.value)} className="text-[12px] rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 outline-none">
            <option value="">todos os clientes/projetos</option>
            {clienteNomes.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <select value={fTipo} onChange={e => setFTipo(e.target.value)} className="text-[12px] rounded-lg border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 outline-none">
            <option value="">todos os tipos</option>
            {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {tags.length > 0 && (
            <div className="flex gap-1 flex-wrap items-center">
              {tags.slice(0, 8).map(t => (
                <button key={t} onClick={() => setQ(t)} className="text-[10.5px] px-1.5 py-0.5 rounded-full border border-[var(--border)] text-[var(--text-2)] hover:bg-[var(--panel-2)]">#{t}</button>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-5 max-md:p-3">
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {filtered.map(f => (
            <article key={f.id} className="group rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3.5">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[9.5px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[var(--panel-2)] text-[var(--text-2)]">{f.tipo}</span>
                <span className="text-[11px] font-medium truncate">{f.clienteProjeto}</span>
                <button onClick={() => remove(f.id)} className="ml-auto hidden group-hover:block text-[11px] text-[var(--text-3)] hover:text-[var(--red)]">✕</button>
              </div>
              <p className="text-[12.5px] text-[var(--text)] leading-relaxed">{f.descricao}</p>
              {f.metrica && <p className="text-[11.5px] text-[var(--green)] mt-1.5">📈 {f.metrica}</p>}
              <div className="flex flex-wrap gap-1 mt-1.5 items-center">
                {f.tags.map(t => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--panel-2)] text-[var(--text-2)]">#{t}</span>)}
                <span className="text-[10px] text-[var(--text-3)] ml-auto">{f.data}</span>
              </div>
              {f.link && <a href={f.link} target="_blank" className="inline-block mt-1.5 text-[11px] text-[var(--accent)] underline underline-offset-2 truncate max-w-full">ver resultado ↗</a>}
            </article>
          ))}
        </div>
        {filtered.length === 0 && (
          <p className="text-center text-[13px] text-[var(--text-2)] mt-10">
            {items.length === 0
              ? <>Nenhum formato ainda. Toda vez que algo performar bem, clique em <b>+ marcar formato de sucesso</b> — vira repertório do que funciona pra você.</>
              : 'Nada bate esse filtro.'}
          </p>
        )}
      </div>

      {showAdd && <AddFormatModal clienteNomes={clienteNomes} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load() }} />}
    </div>
  )
}

function AddFormatModal({ clienteNomes, onClose, onSaved }: { clienteNomes: string[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ clienteProjeto: '', tipo: 'comercial', descricao: '', data: new Date().toISOString().slice(0, 10), metrica: '', link: '', tags: '' })
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!f.clienteProjeto.trim() || !f.descricao.trim() || busy) return
    setBusy(true)
    await fetch('/api/formats', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...f, tags: f.tags.split(',').map(t => t.trim()).filter(Boolean) }),
    })
    setBusy(false)
    onSaved()
  }

  const input = 'w-full text-[12.5px] rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 outline-none focus:border-[var(--text-3)]'
  return (
    <div className="fixed inset-0 z-50 bg-black/30 grid place-items-center p-4" onClick={onClose}>
      <div className="w-[460px] max-w-full max-h-[85vh] overflow-y-auto rounded-2xl bg-[var(--panel)] border border-[var(--border)] p-5 space-y-2.5" onClick={e => e.stopPropagation()}>
        <h2 className="font-semibold text-[14px]">Marcar formato de sucesso</h2>
        <p className="text-[11.5px] text-[var(--text-2)]">Registro do que já performou bem — o catálogo do que funciona pra você.</p>
        <input list="fmt-clientes" className={input} placeholder="Cliente / projeto *" value={f.clienteProjeto} onChange={e => setF({ ...f, clienteProjeto: e.target.value })} />
        <datalist id="fmt-clientes">{clienteNomes.map(n => <option key={n} value={n} />)}</datalist>
        <select className={input} value={f.tipo} onChange={e => setF({ ...f, tipo: e.target.value })}>
          {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <textarea className={input} rows={3} placeholder="O que foi feito (descrição livre do formato) *" value={f.descricao} onChange={e => setF({ ...f, descricao: e.target.value })} />
        <div className="flex gap-2">
          <input type="date" className={input} value={f.data} onChange={e => setF({ ...f, data: e.target.value })} />
          <input className={input} placeholder="Métrica (opc: views, 'melhor CTR')" value={f.metrica} onChange={e => setF({ ...f, metrica: e.target.value })} />
        </div>
        <input className={input} placeholder="Link do resultado (opcional)" value={f.link} onChange={e => setF({ ...f, link: e.target.value })} />
        <input className={input} placeholder="Tags separadas por vírgula (opcional)" value={f.tags} onChange={e => setF({ ...f, tags: e.target.value })} />
        <div className="flex justify-end gap-1.5 pt-1">
          <button onClick={onClose} className="text-[12.5px] px-3 py-1.5 rounded-lg border border-[var(--border)]">Cancelar</button>
          <button onClick={save} disabled={busy || !f.clienteProjeto.trim() || !f.descricao.trim()} className="text-[12.5px] px-4 py-1.5 rounded-lg bg-[var(--accent)] text-white disabled:opacity-40">Salvar</button>
        </div>
      </div>
    </div>
  )
}
