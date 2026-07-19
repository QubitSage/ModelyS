'use client'

import { useEffect, useState } from 'react'
import { Client, ClientIndex, Thread, Mode } from '@/lib/types'
import { View } from './App'

const MODE_LABEL: Record<Mode, string> = {
  producao: 'Produção',
  visual: 'Visual / SFX',
  revisao: 'Revisão',
  web: 'Pesquisa',
}

const MODES: Mode[] = ['producao', 'visual', 'revisao']

export default function Sidebar({
  view, setView: setViewRaw, clients, activeClient, activeThreadId,
  onOpenClient, onOpenThread: onOpenThreadRaw, onClientsChanged, onThreadCreated,
  onThreadDeleted, mobileOpen, onMobileClose,
}: {
  view: View
  setView: (v: View) => void
  mobileOpen?: boolean
  onMobileClose?: () => void
  clients: ClientIndex[]
  activeClient: Client | null
  activeThreadId: string | null
  onOpenClient: (id: string) => Promise<Client | undefined>
  onOpenThread: (clientId: string, threadId: string) => void
  onClientsChanged: () => void
  onThreadCreated: (t: Thread) => void
  onThreadDeleted?: (threadId: string) => void
}) {
  // no mobile, navegar fecha o drawer
  const setView = (v: View) => { setViewRaw(v); onMobileClose?.() }
  const onOpenThread = (c: string, t: string) => { onOpenThreadRaw(c, t); onMobileClose?.() }

  const [expanded, setExpanded] = useState<string | null>(null)
  const [creatingClient, setCreatingClient] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [creatingThreadFor, setCreatingThreadFor] = useState<string | null>(null)
  const [newThreadMode, setNewThreadMode] = useState<Mode>('producao')
  const [renamingThread, setRenamingThread] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('modely-theme') === 'dark'
    setDark(saved)
    document.documentElement.dataset.theme = saved ? 'dark' : 'light'
  }, [])

  function toggleTheme() {
    const next = !dark
    setDark(next)
    document.documentElement.dataset.theme = next ? 'dark' : 'light'
    localStorage.setItem('modely-theme', next ? 'dark' : 'light')
  }

  async function toggleClient(id: string) {
    if (expanded === id) { setExpanded(null); return }
    await onOpenClient(id)
    setExpanded(id)
  }

  async function createClient() {
    const name = newClientName.trim()
    if (!name) return
    await fetch('/api/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
    setNewClientName('')
    setCreatingClient(false)
    onClientsChanged()
  }

  async function deleteThread(clientId: string, threadId: string, name: string) {
    if (!confirm(`Apagar a conversa "${name}"? O histórico dela some de vez.`)) return
    await fetch(`/api/threads/${threadId}?clientId=${clientId}`, { method: 'DELETE' })
    onThreadDeleted?.(threadId)
    await onOpenClient(clientId)
    onClientsChanged()
  }

  function startRename(threadId: string, name: string) {
    setRenamingThread(threadId)
    setRenameValue(name)
  }

  async function saveRename(clientId: string, threadId: string) {
    const name = renameValue.trim()
    setRenamingThread(null)
    if (!name) return
    await fetch(`/api/threads/${threadId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, name }),
    })
    await onOpenClient(clientId)
    onClientsChanged()
  }

  async function deleteClient(id: string, name: string) {
    if (!confirm(`Apagar o cliente "${name}" com TODAS as conversas e histórico? Não tem volta.`)) return
    await fetch(`/api/clients/${id}`, { method: 'DELETE' })
    if (expanded === id) setExpanded(null)
    onThreadDeleted?.('*')
    onClientsChanged()
  }

  async function createThread(clientId: string) {
    const res = await fetch('/api/threads', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, name: 'Nova conversa', mode: newThreadMode }),
    })
    setCreatingThreadFor(null)
    if (!res.ok) return
    const t: Thread = await res.json()
    await onOpenClient(clientId)
    setExpanded(clientId)
    onThreadCreated(t)
  }

  const navBtn = (v: View, label: string, icon: string, badge?: string) => (
    <button
      onClick={() => setView(v)}
      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] transition-colors ${
        view === v ? 'bg-[var(--panel-2)] font-medium' : 'text-[var(--text-2)] hover:bg-[var(--panel-2)]'
      }`}
    >
      <span className="w-4 text-center opacity-70">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {badge && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--lav)] text-[var(--lav-text)] font-semibold tracking-wide">{badge}</span>}
    </button>
  )

  const inputCls = 'w-full text-[12px] rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 outline-none focus:border-[var(--text-3)]'

  return (
    <aside className={`w-[240px] shrink-0 border-r border-[var(--border)] bg-[var(--panel)] flex flex-col max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:shadow-xl max-md:transition-transform ${mobileOpen ? '' : 'max-md:-translate-x-full'}`}>
      {/* Workspace */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-[#1c1c1a] text-white grid place-items-center text-[13px] font-bold">M</div>
        <span className="font-semibold text-[14px]">Modely</span>
        <button onClick={toggleTheme} className="ml-auto text-[13px] text-[var(--text-3)] hover:text-[var(--text)]" title="Alternar tema">
          {dark ? '☀' : '☾'}
        </button>
      </div>

      {/* Navegação principal */}
      <nav className="px-2.5 space-y-0.5">
        {navBtn('chat', 'Estúdio', '✳')}
        {navBtn('direcao', 'Direção Criativa', '✦', 'NOVO')}
        {navBtn('arena', 'Arena', '⚔')}
        {navBtn('pauta', 'Tópicos em Alta', '🔥')}
        {navBtn('library', 'Biblioteca', '❖')}
        {navBtn('formatos', 'Formatos', '★')}
        {navBtn('tools', 'Ferramentas', '⚒')}
        {navBtn('qcbatch', 'QC em lote', '✓')}
        {navBtn('esteira', 'Esteira', '▶')}
        {navBtn('entregas', 'Entregas', '📦', 'NOVO')}
        {navBtn('crm', 'CRM', '◔')}
        {navBtn('costs', 'Custos', '¢')}
      </nav>

      {/* Clientes */}
      <div className="mt-5 px-4 flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-wide text-[var(--text-3)] uppercase">Clientes</span>
        <button onClick={() => setCreatingClient(v => !v)} className="text-[var(--text-3)] hover:text-[var(--text)] text-sm leading-none" title="Novo cliente">+</button>
      </div>

      {creatingClient && (
        <div className="px-2.5 pt-1.5 flex gap-1">
          <input
            autoFocus
            value={newClientName}
            onChange={e => setNewClientName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') createClient(); if (e.key === 'Escape') setCreatingClient(false) }}
            placeholder="nome do cliente"
            className={inputCls}
          />
          <button onClick={createClient} className="text-[12px] px-2 rounded-lg bg-[var(--accent)] text-white">ok</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2.5 py-1.5 space-y-0.5">
        {clients.map(c => (
          <div key={c.id}>
            <div className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] transition-colors ${
              expanded === c.id ? 'bg-[var(--panel-2)] font-medium' : 'text-[var(--text-2)] hover:bg-[var(--panel-2)]'
            }`}>
              <button onClick={() => toggleClient(c.id)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                <span className="opacity-50 text-[11px]">#</span>
                <span className="flex-1 truncate">{c.name}</span>
              </button>
              {c.threadCount > 0 && <span className="text-[10px] text-[var(--text-3)] group-hover:hidden">{c.threadCount}</span>}
              <button
                onClick={() => deleteClient(c.id, c.name)}
                title="Apagar cliente"
                className="hidden group-hover:block text-[11px] text-[var(--text-3)] hover:text-[var(--red)]"
              >✕</button>
            </div>
            {expanded === c.id && activeClient?.id === c.id && (
              <div className="ml-4 border-l border-[var(--border)] pl-2 my-0.5 space-y-0.5">
                {activeClient.threads.map(t => (
                  <div key={t.id} className={`group flex items-start gap-1 px-2 py-1 rounded-md transition-colors ${
                    activeThreadId === t.id ? 'bg-[var(--panel-2)]' : 'hover:bg-[var(--panel-2)]'
                  }`}>
                    {renamingThread === t.id ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveRename(c.id, t.id); if (e.key === 'Escape') setRenamingThread(null) }}
                        onBlur={() => saveRename(c.id, t.id)}
                        className="flex-1 min-w-0 text-[12.5px] rounded border border-[var(--border)] bg-[var(--card)] px-1.5 py-0.5 outline-none focus:border-[var(--text-3)]"
                      />
                    ) : (
                      <>
                        <button onClick={() => onOpenThread(c.id, t.id)} className="flex-1 min-w-0 flex flex-col items-start text-left">
                          <span className="text-[12.5px] truncate w-full">{t.name}</span>
                          <span className="text-[10px] text-[var(--text-3)]">{MODE_LABEL[t.mode]} · {t.messages.length} msgs</span>
                        </button>
                        <button
                          onClick={() => startRename(t.id, t.name)}
                          title="Renomear conversa"
                          className="hidden group-hover:block text-[11px] text-[var(--text-3)] hover:text-[var(--text)] pt-0.5"
                        >✎</button>
                        <button
                          onClick={() => deleteThread(c.id, t.id, t.name)}
                          title="Apagar conversa"
                          className="hidden group-hover:block text-[11px] text-[var(--text-3)] hover:text-[var(--red)] pt-0.5"
                        >✕</button>
                      </>
                    )}
                  </div>
                ))}
                {creatingThreadFor === c.id ? (
                  <div className="px-1 py-1 space-y-1">
                    <div className="flex gap-1">
                      {MODES.map(m => (
                        <button
                          key={m}
                          onClick={() => setNewThreadMode(m)}
                          className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                            newThreadMode === m ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-2)]'
                          }`}
                        >{MODE_LABEL[m]}</button>
                      ))}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => createThread(c.id)} className="flex-1 text-[11px] py-1 rounded-lg bg-[var(--accent)] text-white">criar conversa</button>
                      <button onClick={() => setCreatingThreadFor(null)} className="text-[11px] px-2 rounded-lg border border-[var(--border)] text-[var(--text-2)]">✕</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setCreatingThreadFor(c.id); setNewThreadMode('producao') }} className="w-full text-left px-2 py-1 text-[12px] text-[var(--text-3)] hover:text-[var(--text)]">
                    + nova conversa
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        {clients.length === 0 && (
          <p className="px-2.5 py-2 text-[12px] text-[var(--text-3)]">Nenhum cliente ainda — crie com o “+”.</p>
        )}
      </div>

      <div className="px-4 py-3 border-t border-[var(--border)] flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-[var(--panel-2)] grid place-items-center text-[11px] font-semibold">B</div>
        <span className="text-[12px] text-[var(--text-2)]">Bruno</span>
      </div>
    </aside>
  )
}
