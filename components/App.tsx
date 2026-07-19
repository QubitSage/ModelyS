'use client'

import { useCallback, useEffect, useState } from 'react'
import { Client, ClientIndex, Thread } from '@/lib/types'
import Sidebar from './Sidebar'
import ChatView from './ChatView'
import LibraryView from './LibraryView'
import CrmView from './CrmView'
import CostsView from './CostsView'
import QcBatchView from './QcBatchView'
import ToolsView from './ToolsView'
import EsteiraView from './EsteiraView'
import DirecaoView from './DirecaoView'
import ArenaView from './ArenaView'
import FormatsView from './FormatsView'
import PautaView from './PautaView'
import EntregasView from './EntregasView'
import { Toasts } from './Toast'

export type View = 'chat' | 'direcao' | 'arena' | 'pauta' | 'library' | 'formatos' | 'entregas' | 'tools' | 'qcbatch' | 'esteira' | 'crm' | 'costs'

export default function App() {
  const [view, setView] = useState<View>('chat')
  const [clients, setClients] = useState<ClientIndex[]>([])
  const [client, setClient] = useState<Client | null>(null)
  const [thread, setThread] = useState<Thread | null>(null)
  // rascunho vindo da biblioteca (briefing → "usar no chat")
  const [draft, setDraft] = useState<{ text: string; nonce: number } | null>(null)

  const useInChat = useCallback((text: string) => {
    setDraft({ text, nonce: Date.now() })
    setView('chat')
  }, [])

  const loadClients = useCallback(async () => {
    try {
      const res = await fetch('/api/clients')
      if (res.ok) setClients(await res.json())
    } catch { /* rede caiu — mantém a lista atual */ }
  }, [])

  useEffect(() => { loadClients() }, [loadClients])

  const openClient = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/clients/${id}`)
      if (!res.ok) return
      const c: Client = await res.json()
      setClient(c)
      return c
    } catch {
      // rede caiu / servidor recompilando — não derruba a UI
      return undefined
    }
  }, [])

  const openThread = useCallback(async (clientId: string, threadId: string) => {
    const c = client?.id === clientId ? client : await openClient(clientId)
    const t = c?.threads.find(t => t.id === threadId) ?? null
    setThread(t)
    setView('chat')
  }, [client, openClient])

  // Busca só a thread (não o cliente inteiro — os JSONs migrados têm 1.5MB e
  // recarregar tudo a cada mensagem era parte da travada).
  const refreshThread = useCallback(async () => {
    if (!thread) return
    try {
      const res = await fetch(`/api/threads/${thread.id}?clientId=${thread.clientId}`)
      if (!res.ok) return
      const t: Thread = await res.json()
      setThread(t)
      setClient(c => c && c.id === thread.clientId
        ? { ...c, threads: c.threads.map(x => (x.id === t.id ? t : x)) }
        : c)
    } catch {
      // "Failed to fetch": rede caiu ou servidor recompilando — silencioso,
      // a mensagem já foi salva no servidor e aparece no próximo refresh.
    }
  }, [thread])

  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="h-screen p-3 max-md:p-0">
      <div className="h-full flex rounded-2xl max-md:rounded-none overflow-hidden border border-[var(--border)] max-md:border-0 bg-[var(--panel)] shadow-sm relative">
        {/* topo mobile */}
        <div className="hidden max-md:flex absolute top-0 inset-x-0 h-11 z-30 items-center gap-2 px-3 border-b border-[var(--border)] bg-[var(--panel)]">
          <button onClick={() => setSidebarOpen(true)} className="text-[18px] px-1">☰</button>
          <span className="font-semibold text-[14px]">Modely</span>
        </div>
        {sidebarOpen && <div className="hidden max-md:block absolute inset-0 z-40 bg-black/40" onClick={() => setSidebarOpen(false)} />}
        <Sidebar
          mobileOpen={sidebarOpen}
          onMobileClose={() => setSidebarOpen(false)}
          view={view}
          setView={setView}
          clients={clients}
          activeClient={client}
          activeThreadId={thread?.id ?? null}
          onOpenClient={openClient}
          onOpenThread={openThread}
          onClientsChanged={loadClients}
          onThreadCreated={(t) => { setThread(t); setView('chat') }}
          onThreadDeleted={(threadId) => {
            if (threadId === '*' || thread?.id === threadId) setThread(null)
          }}
        />
        <main className="flex-1 min-w-0 flex max-md:pt-11">
          {/* ChatView fica SEMPRE montado (só escondido) — trocar de aba no meio
              de uma geração não perde mais o stream nem o estado do composer */}
          <div className={view === 'chat' ? 'flex-1 min-w-0 flex' : 'hidden'}>
            <ChatView
              client={client}
              thread={thread}
              onThreadUpdated={refreshThread}
              onOpenLibrary={() => setView('library')}
              draft={draft}
            />
          </div>
          {/* Direção/Arena/Pauta ficam SEMPRE montadas (só escondidas) — rodam
              gerações longas; trocar de aba no meio não cancela mais o resultado */}
          <div className={view === 'direcao' ? 'flex-1 min-w-0 flex' : 'hidden'}>
            <DirecaoView clients={clients} onUseInChat={useInChat} onOpenArena={() => setView('arena')} />
          </div>
          <div className={view === 'arena' ? 'flex-1 min-w-0 flex' : 'hidden'}>
            <ArenaView clients={clients} onUseInChat={useInChat} />
          </div>
          <div className={view === 'pauta' ? 'flex-1 min-w-0 flex' : 'hidden'}>
            <PautaView clients={clients} onUseInChat={useInChat} />
          </div>
          {view === 'library' && <LibraryView onUseInChat={useInChat} />}
          {view === 'formatos' && <FormatsView clients={clients} />}
          {view === 'tools' && <ToolsView />}
          {view === 'qcbatch' && <QcBatchView clients={clients} onOpenEsteira={() => setView('esteira')} />}
          {view === 'esteira' && <EsteiraView />}
          {view === 'entregas' && <EntregasView clients={clients} />}
          {view === 'crm' && <CrmView clients={clients} onChanged={loadClients} />}
          {view === 'costs' && <CostsView />}
        </main>
      </div>
      <Toasts />
    </div>
  )
}
