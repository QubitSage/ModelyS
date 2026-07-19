'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Client, Thread, Message, QCResult, Term, Attachment } from '@/lib/types'
import InfoPanel from './InfoPanel'
import { pushToast, dismissToast } from './Toast'

type ChatModel = 'gemini' | 'claude' | 'gpt' | 'grok'
const MODEL_LABEL: Record<ChatModel, string> = { claude: 'Sonnet', gemini: 'Gemini', gpt: 'GPT', grok: 'Grok' }

// nome amigável a partir do id do modelo salvo na mensagem
function labelForModel(id: string): string {
  if (/sonnet|claude/i.test(id)) return 'Sonnet'
  if (/gemini/i.test(id)) return 'Gemini'
  if (/gpt/i.test(id)) return 'GPT'
  if (/grok/i.test(id)) return 'Grok'
  return id
}

// cache module-level dos termos da biblioteca (pro matching inline no composer)
let termsCache: Term[] | null = null
async function getTerms(): Promise<Term[]> {
  if (!termsCache) {
    try { termsCache = await fetch('/api/library/terms').then(r => r.json()) } catch { termsCache = [] }
  }
  return termsCache!
}

function norm(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function richPrompt(t: Term): string | undefined {
  const notDireto = t.prompts.filter(p => p.rotulo.toLowerCase() !== 'direto')
  return (notDireto[notDireto.length - 1] ?? t.prompts[t.prompts.length - 1])?.texto
}

const looksLikePackage = (content: string) => /#{2,6}\s*\**\s*(Take|Parte|Cena)\s*\d/i.test(content)
const isAV = (a: Attachment) => a.mimeType.startsWith('video/') || a.mimeType.startsWith('audio/')

// ---------------------------------------------------------------------------
// Bolha de mensagem memoizada (só re-renderiza quando a própria msg muda)
// ---------------------------------------------------------------------------
const MessageBubble = memo(function MessageBubble({
  msg, qcBusy, onValidate, onEdit, onRollback, onRegen, onShowQC, onEditTakes,
}: {
  msg: Message
  qcBusy: boolean
  onValidate: (msg: Message) => void
  onEdit: (msg: Message) => void
  onRollback: (msg: Message) => void
  onRegen: (msg: Message) => void
  onShowQC: (msg: Message) => void
  onEditTakes: (msg: Message) => void
}) {
  const btn = 'text-[10.5px] px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--text-2)] hover:bg-[var(--panel-2)]'
  const qcBadge = msg.qc && (
    <button
      onClick={() => onShowQC(msg)}
      title="QC automático — clique pra ver os detalhes no painel"
      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
        msg.qc.status === 'aprovado' ? 'bg-[var(--green-bg)] text-[var(--green)]'
        : msg.qc.status === 'ambiguo' ? 'bg-[var(--amber-bg)] text-[var(--amber)]'
        : 'bg-[var(--red-bg)] text-[var(--red)]'
      }`}
    >
      {msg.qc.status === 'aprovado' ? '✓ QC ok' : msg.qc.status === 'ambiguo' ? `△ QC ${msg.qc.findings.length}` : `✕ QC ${msg.qc.findings.filter(f => f.severidade === 'flagado').length}`}
    </button>
  )
  return (
    <div className="flex gap-3 group">
      <div className={`w-7 h-7 rounded-full shrink-0 grid place-items-center text-[11px] font-semibold ${
        msg.role === 'user' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--green-bg)] text-[var(--green)]'
      }`}>
        {msg.role === 'user' ? 'B' : 'M'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[12.5px] font-semibold">{msg.role === 'user' ? 'Bruno' : 'Modely'}</span>
          <span className="text-[10.5px] text-[var(--text-3)]">
            {new Date(msg.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            {msg.model ? ` · ${labelForModel(msg.model)}` : ''}
            {typeof msg.cacheReadTokens === 'number' && msg.cacheReadTokens > 0 ? ' · ⚡cache' : ''}
          </span>
          {qcBadge}
          {msg.editedTakes && msg.editedTakes.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--lav)] text-[var(--lav-text)]" title={`Takes corrigidos: ${msg.editedTakes.join(', ')}`}>
              🔧 {msg.editedTakes.length} corrigido{msg.editedTakes.length > 1 ? 's' : ''}
            </span>
          )}
          <span className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {msg.role === 'assistant' && looksLikePackage(msg.content) && (
              <button onClick={() => onEditTakes(msg)} className={btn} title="Editar/corrigir takes individuais sem mexer na conversa">🔧 takes</button>
            )}
            <button onClick={() => navigator.clipboard.writeText(msg.content)} className={btn} title="Copiar conteúdo">copiar</button>
            {msg.role === 'user' && (
              <button onClick={() => onEdit(msg)} className={btn} title="Editar e reenviar (apaga o que veio depois)">editar</button>
            )}
            {msg.role === 'assistant' && (
              <>
                <button onClick={() => onRegen(msg)} className={btn} title="Gerar de novo esta resposta">↻ regenerar</button>
                {looksLikePackage(msg.content) && (
                  <button
                    onClick={() => onValidate(msg)}
                    disabled={qcBusy}
                    className="text-[10.5px] px-1.5 py-0.5 rounded border border-[var(--green)] text-[var(--green)] hover:bg-[var(--green-bg)] disabled:opacity-50"
                  >{qcBusy ? 'validando…' : '✓ QC'}</button>
                )}
              </>
            )}
            <button onClick={() => onRollback(msg)} className={btn} title="Voltar a conversa até esta mensagem (apaga as seguintes)">⤺ voltar aqui</button>
          </span>
        </div>
        {msg.attachments && msg.attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {msg.attachments.map(a => (
              <span key={a.id} className="text-[10.5px] px-2 py-0.5 rounded-full bg-[var(--panel-2)] text-[var(--text-2)]">📎 {a.name}</span>
            ))}
          </div>
        )}
        <div className="prose-chat mt-0.5">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
        </div>
      </div>
    </div>
  )
})

export default function ChatView({
  client, thread, onThreadUpdated, onOpenLibrary, draft,
}: {
  client: Client | null
  thread: Thread | null
  onThreadUpdated: () => Promise<void>
  onOpenLibrary: () => void
  draft?: { text: string; nonce: number } | null
}) {
  const [input, setInput] = useState('')
  // Sistema roda só GPT + Grok. Qualquer padrão antigo (sonnet/gemini/claude)
  // vira GPT. Gemini ainda entra automático em vídeo/áudio (só ele lê AV anexado).
  const asChoice = (m?: string | null): ChatModel => (m === 'grok' ? 'grok' : 'gpt')
  const [model, setModel] = useState<ChatModel>('gpt')
  const [modelTouched, setModelTouched] = useState(false)
  const calibrated: ChatModel | undefined = client?.creativeDefault ? asChoice(client.creativeDefault) : undefined
  useEffect(() => {
    if (!modelTouched) setModel(calibrated ?? asChoice(client?.defaultModel))
  }, [client?.id, client?.defaultModel, calibrated, modelTouched])
  const [streaming, setStreaming] = useState('')
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'enviando' | 'pensando' | 'escrevendo'>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')
  const [qcResult, setQcResult] = useState<QCResult | null>(null)
  const [qcBusy, setQcBusy] = useState<string | null>(null)
  const [panelTab, setPanelTab] = useState<'info' | 'qc'>('info')
  const [panelOpen, setPanelOpen] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<Attachment[]>([])
  const [takeEditorMsg, setTakeEditorMsg] = useState<Message | null>(null)
  // QC de seleção: selecionou um trecho suspeito → botão flutuante "QC"
  const [selQC, setSelQC] = useState<{ x: number; y: number; text: string } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const WINDOW = 30
  const [visibleCount, setVisibleCount] = useState(WINDOW)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [thread?.messages.length, streaming])

  useEffect(() => { setQcResult(null); setError(''); setVisibleCount(WINDOW); setPendingFiles([]) }, [thread?.id])

  // cronômetro do status enquanto gera
  useEffect(() => {
    if (!busy) { setElapsed(0); return }
    const t0 = Date.now()
    const iv = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 1000)
    return () => clearInterval(iv)
  }, [busy])

  // rascunho vindo da biblioteca
  useEffect(() => {
    if (draft?.text) setInput(v => (v.trim() ? `${v.trimEnd()}\n\n${draft.text}` : draft.text))
  }, [draft?.nonce]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalMsgs = thread?.messages.length ?? 0
  const visibleMessages = thread ? thread.messages.slice(Math.max(0, totalMsgs - visibleCount)) : []
  const hiddenCount = Math.max(0, totalMsgs - visibleCount)

  const [terms, setTerms] = useState<Term[]>([])
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set())
  useEffect(() => { getTerms().then(setTerms) }, [])

  const termSuggestions = useMemo(() => {
    if (input.length < 6 || !terms.length) return []
    // Casa só sobre o que você DESCREVEU: ignora as linhas de tag já inseridas
    // ([Termo]: prompt) — senão o prompt inserido gera matches novos e expulsa
    // os termos que você ainda quer. Assim dá pra empilhar várias tags (tema +
    // b-roll em outro estilo + um terceiro), sem teto apertado.
    const desc = input.split('\n').filter(l => !/^\s*\[[^\]]+\]\s*:/.test(l)).join(' ')
    const ni = norm(desc)
    const jaInseridos = norm(input)
    const out: Array<{ term: Term; matched: string }> = []
    for (const t of terms) {
      if (dismissedSuggestions.has(t.id)) continue
      if (jaInseridos.includes(norm(`[${t.termo}]`))) continue // já colocado no composer
      // casa pelos sinônimos leigos OU pelo nome técnico do termo (inclusive
      // cada parte em volta da "/", ex.: "Typographic poster / Editorial").
      const nameParts = norm(t.termo).split('/').map(p => p.trim()).filter(p => p.length >= 5)
      const hit = t.sinonimos.find(s => s.length >= 5 && ni.includes(norm(s)))
        || nameParts.find(p => ni.includes(p))
      if (hit) out.push({ term: t, matched: hit })
      if (out.length >= 8) break
    }
    return out
  }, [input, terms, dismissedSuggestions])

  async function filesToAttachments(files: FileList | File[]): Promise<Attachment[]> {
    const arr: Attachment[] = []
    for (const f of Array.from(files)) {
      if (f.size > 40 * 1024 * 1024) { setError(`${f.name}: arquivo acima de 40MB`); continue }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result))
        r.onerror = reject
        r.readAsDataURL(f)
      })
      arr.push({
        id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        name: f.name || 'colado.png',
        type: f.type.split('/')[0] || 'file',
        mimeType: f.type || 'application/octet-stream',
        dataUrl,
      })
    }
    return arr
  }

  async function pickFiles(files: FileList | File[] | null) {
    if (!files || !('length' in files) || !files.length) return
    setPendingFiles(p => [...p, ...([] as Attachment[])])
    const atts = await filesToAttachments(files)
    setPendingFiles(p => [...p, ...atts])
    if (fileRef.current) fileRef.current.value = ''
  }

  const sendMessage = useCallback(async (text: string, attachments: Attachment[]) => {
    if (!client || !thread) return
    // vídeo/áudio → Gemini automático (Sonnet não processa); resto → modelo escolhido
    const effectiveModel = attachments.some(isAV) ? 'gemini' : model
    setBusy(true)
    setPhase('enviando')
    setError('')
    setStreaming('')
    const controller = new AbortController()
    abortRef.current = controller
    const threadName = thread.name
    const toastId = pushToast(`Gerando em #${threadName}…`, 'loading', { sticky: true })
    let ok = false

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id, threadId: thread.id, text, model: effectiveModel, attachments }),
        signal: controller.signal,
      })
      if (!res.ok || !res.body) throw new Error('Falha na chamada')
      setPhase('pensando')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ''
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''
        for (const ev of events) {
          const data = ev.replace(/^data: /, '').trim()
          if (!data) continue
          try {
            const parsed = JSON.parse(data)
            if (parsed.text) { acc += parsed.text; setStreaming(acc); setPhase('escrevendo') }
            if (parsed.done) ok = true
            if (parsed.error) { setError(parsed.error); pushToast(`Erro em #${threadName}: ${parsed.error.slice(0, 80)}`, 'error') }
          } catch { /* chunk parcial */ }
        }
      }
      if (ok) pushToast(`✓ Resposta pronta em #${threadName}`, 'success')
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setError('Geração cancelada.')
        pushToast(`Geração cancelada em #${threadName}`, 'info')
      } else {
        const msg = e instanceof Error ? e.message : 'Erro'
        setError(msg)
        pushToast(`Erro em #${threadName}: ${msg.slice(0, 80)}`, 'error')
      }
    } finally {
      dismissToast(toastId)
      abortRef.current = null
      setStreaming('')
      setBusy(false)
      setPhase('idle')
      await onThreadUpdated()
    }
  }, [client, thread, model, onThreadUpdated])

  async function send() {
    if ((!input.trim() && !pendingFiles.length) || busy) return
    const text = input.trim() || '(analise o anexo)'
    const attachments = pendingFiles
    setInput('')
    setPendingFiles([])
    await sendMessage(text, attachments)
  }

  function cancel() {
    abortRef.current?.abort()
  }

  const clientId = client?.id
  const threadId = thread?.id

  const truncate = useCallback(async (messageId: string, inclusive: boolean) => {
    if (!clientId || !threadId) return
    await fetch(`/api/threads/${threadId}/truncate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, messageId, inclusive }),
    })
    await onThreadUpdated()
  }, [clientId, threadId, onThreadUpdated])

  // editar: recupera o texto da msg do usuário pro composer e apaga dela em diante
  const onEdit = useCallback(async (msg: Message) => {
    setInput(msg.content)
    if (msg.attachments?.length) setPendingFiles(msg.attachments.filter(a => a.dataUrl?.startsWith('data:')))
    await truncate(msg.id, true)
  }, [truncate])

  // voltar: mantém até esta mensagem (inclusive), apaga as seguintes
  const onRollback = useCallback(async (msg: Message) => {
    await truncate(msg.id, false)
  }, [truncate])

  // regenerar: acha a msg de usuário anterior, corta dela em diante e reenvia igual
  const onRegen = useCallback(async (msg: Message) => {
    if (!thread) return
    const i = thread.messages.findIndex(m => m.id === msg.id)
    const prevUser = [...thread.messages.slice(0, i)].reverse().find(m => m.role === 'user')
    if (!prevUser) return
    await truncate(prevUser.id, true)
    await sendMessage(prevUser.content, (prevUser.attachments || []).filter(a => a.dataUrl?.startsWith('data:')))
  }, [thread, truncate, sendMessage])

  const onShowQC = useCallback((msg: Message) => {
    if (msg.qc) { setQcResult(msg.qc); setPanelTab('qc'); setPanelOpen(true) }
  }, [])

  // seleção de texto nas mensagens → botão QC flutuante
  const onMessagesMouseUp = useCallback(() => {
    setTimeout(() => {
      const sel = window.getSelection()
      const text = sel?.toString().trim() ?? ''
      if (!sel || sel.isCollapsed || text.length < 3) { setSelQC(null); return }
      const rect = sel.getRangeAt(0).getBoundingClientRect()
      setSelQC({ x: rect.left + rect.width / 2, y: rect.top, text })
    }, 10)
  }, [])

  const runSelectionQC = useCallback(async () => {
    if (!selQC || !clientId) return
    const text = selQC.text
    setSelQC(null)
    const res = await fetch('/api/qc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text, clientId }),
    })
    const qc: QCResult = await res.json()
    setQcResult(qc)
    setPanelTab('qc')
    setPanelOpen(true)
    pushToast(
      qc.status === 'aprovado'
        ? '✓ Trecho limpo — nenhum termo de bloqueio'
        : `${qc.status === 'flagado' ? '✕' : '△'} ${qc.findings.length} problema(s) no trecho — detalhes no painel QC`,
      qc.status === 'aprovado' ? 'success' : 'error'
    )
  }, [selQC, clientId])

  const onEditTakes = useCallback((msg: Message) => setTakeEditorMsg(msg), [])

  const validateQC = useCallback(async (msg: Message) => {
    if (!clientId) return
    setQcBusy(msg.id)
    try {
      const res = await fetch('/api/qc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: msg.content, clientId }),
      })
      setQcResult(await res.json())
      setPanelTab('qc')
    } finally {
      setQcBusy(null)
    }
  }, [clientId])

  if (!client || !thread) {
    return (
      <div className="flex-1 grid place-items-center bg-[var(--card)]">
        <div className="text-center max-w-sm px-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-[var(--accent)] text-white grid place-items-center text-xl font-bold mb-4">M</div>
          <h2 className="font-semibold text-[15px] mb-1.5">Bem-vindo ao Modely</h2>
          <p className="text-[13px] text-[var(--text-2)]">
            Selecione um cliente e uma conversa na barra lateral, ou explore a{' '}
            <button onClick={onOpenLibrary} className="underline underline-offset-2">Biblioteca de vocabulário</button>.
          </p>
          {input.trim() && (
            <p className="mt-3 text-[12px] px-3 py-2 rounded-lg bg-[var(--green-bg)] text-[var(--green)]">
              ✓ Rascunho da biblioteca guardado — abra uma conversa pra usá-lo.
            </p>
          )}
        </div>
      </div>
    )
  }

  const statusLabel =
    phase === 'enviando' ? 'enviando…'
    : phase === 'pensando' ? `Sonnet pensando… ${elapsed}s (normal levar 10-40s antes do texto)`
    : phase === 'escrevendo' ? `escrevendo… ${elapsed}s`
    : ''

  return (
    <>
      <section
        className="flex-1 min-w-0 flex flex-col bg-[var(--card)] relative"
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={e => { if (e.currentTarget === e.target) setDragOver(false) }}
        onDrop={async e => {
          e.preventDefault()
          setDragOver(false)
          if (e.dataTransfer.files?.length) await pickFiles(e.dataTransfer.files)
        }}
      >
        {dragOver && (
          <div className="absolute inset-2 z-20 rounded-2xl border-2 border-dashed border-[var(--green)] bg-[var(--green-bg)]/70 grid place-items-center pointer-events-none">
            <p className="text-[14px] font-medium text-[var(--green)]">solte pra anexar</p>
          </div>
        )}

        {/* Header */}
        <header className="h-12 shrink-0 border-b border-[var(--border)] flex items-center px-4 gap-2">
          <span className="text-[var(--text-3)] text-[13px]">#</span>
          <span className="text-[13px] text-[var(--text-2)] max-md:hidden">{client.name}</span>
          <span className="text-[var(--text-3)] max-md:hidden">/</span>
          <span className="text-[13px] font-medium truncate">{thread.name}</span>
          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={() => setPanelOpen(true)} className="hidden max-md:block text-[15px] px-1.5 text-[var(--text-2)]">ⓘ</button>
            <div className="flex rounded-lg border border-[var(--border)] overflow-hidden text-[11.5px]">
              {(['gpt', 'grok'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => { setModel(m); setModelTouched(true) }}
                  title={calibrated === m ? 'padrão calibrado deste cliente' : ''}
                  className={`px-2 py-1 ${model === m ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-2)] hover:bg-[var(--panel-2)]'}`}
                >
                  {MODEL_LABEL[m]}{calibrated === m && model !== m ? ' ★' : ''}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Mensagens */}
        <div
          ref={scrollRef}
          onMouseUp={onMessagesMouseUp}
          onScroll={() => setSelQC(null)}
          className="flex-1 overflow-y-auto px-5 max-md:px-3 py-4 space-y-5"
        >
          {hiddenCount > 0 && (
            <button
              onClick={() => setVisibleCount(c => c + 60)}
              className="mx-auto block text-[11.5px] px-3 py-1 rounded-full border border-[var(--border)] text-[var(--text-2)] hover:bg-[var(--panel-2)]"
            >↑ carregar mais antigas ({hiddenCount} ocultas)</button>
          )}
          {visibleMessages.map(msg => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              qcBusy={qcBusy === msg.id}
              onValidate={validateQC}
              onEdit={onEdit}
              onRollback={onRollback}
              onRegen={onRegen}
              onShowQC={onShowQC}
              onEditTakes={onEditTakes}
            />
          ))}

          {streaming && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full shrink-0 grid place-items-center text-[11px] font-semibold bg-[var(--green-bg)] text-[var(--green)]">M</div>
              <div className="min-w-0 flex-1">
                <span className="text-[12.5px] font-semibold">Modely</span>
                <div className="prose-chat mt-0.5">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{streaming}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}

          {selQC && (
            <button
              onClick={runSelectionQC}
              style={{ position: 'fixed', left: selQC.x, top: Math.max(8, selQC.y - 34), transform: 'translateX(-50%)', zIndex: 60 }}
              className="px-2.5 py-1 rounded-lg bg-[var(--accent)] text-white text-[11.5px] font-medium shadow-lg"
            >✓ QC no trecho</button>
          )}

          {busy && (
            <div className="flex items-center gap-2.5 pl-10">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-[var(--border)] border-t-[var(--green)] animate-spin" />
              <span className="text-[12px] text-[var(--text-2)]">{statusLabel}</span>
              <button onClick={cancel} className="text-[11px] px-2 py-0.5 rounded border border-[var(--red)] text-[var(--red)] hover:bg-[var(--red-bg)]">
                cancelar
              </button>
            </div>
          )}
          {error && <p className="text-[12px] text-[var(--red)] pl-10">{error}</p>}
        </div>

        {/* Composer */}
        <div className="shrink-0 p-4 max-md:p-2 pt-2">
          {termSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-1.5 px-1">
              {termSuggestions.map(({ term, matched }) => (
                <span key={term.id} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border border-[var(--border)] bg-[var(--panel)]">
                  <span className="text-[var(--text-3)]">“{matched}” =</span>
                  <button
                    onClick={() => {
                      const p = richPrompt(term)
                      if (p) setInput(v => `${v.trimEnd()}\n[${term.termo}]: ${p}`)
                    }}
                    title={term.explicacao}
                    className="font-semibold hover:underline"
                  >{term.termo}</button>
                  <button onClick={() => setDismissedSuggestions(s => new Set([...s, term.id]))} className="text-[var(--text-3)] hover:text-[var(--text)]">✕</button>
                </span>
              ))}
            </div>
          )}
          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-1.5 px-1">
              {pendingFiles.map(f => (
                <span key={f.id} className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full bg-[var(--panel-2)]">
                  📎 {f.name}
                  <button onClick={() => setPendingFiles(p => p.filter(x => x.id !== f.id))} className="text-[var(--text-3)] hover:text-[var(--red)]">✕</button>
                </span>
              ))}
              {pendingFiles.some(isAV) && (
                <span className="text-[10.5px] text-[var(--amber)] self-center">vídeo/áudio → esta mensagem vai pro Gemini (o Sonnet não processa mídia)</span>
              )}
            </div>
          )}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm focus-within:border-[var(--text-3)]">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              onPaste={async e => {
                const files = Array.from(e.clipboardData?.files ?? [])
                if (files.length) { e.preventDefault(); await pickFiles(files) }
              }}
              placeholder={`Mensagem em #${thread.name}…  (Enter envia · arraste ou cole arquivos)`}
              rows={3}
              className="w-full resize-none bg-transparent px-3.5 pt-3 text-[13.5px] outline-none placeholder:text-[var(--text-3)]"
            />
            <div className="flex items-center px-2.5 pb-2">
              <input ref={fileRef} type="file" multiple accept="image/*,video/*,audio/*,.pdf,.docx,.txt,.md,.csv" onChange={e => pickFiles(e.target.files)} className="hidden" />
              <button onClick={() => fileRef.current?.click()} title="Anexar arquivo" className="text-[15px] px-1.5 text-[var(--text-3)] hover:text-[var(--text)]">📎</button>
              <span className="text-[11px] text-[var(--text-3)] px-1 max-md:hidden">
                {MODEL_LABEL[model]} · modo {thread.mode}
              </span>
              <div className="ml-auto flex gap-1.5">
                <button
                  onClick={() => { setInput(''); setPendingFiles([]) }}
                  className="text-[12px] px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-2)] hover:bg-[var(--panel-2)]"
                >Descartar</button>
                <button
                  onClick={send}
                  disabled={busy || (!input.trim() && !pendingFiles.length)}
                  className="text-[12px] px-4 py-1.5 rounded-lg bg-[var(--accent)] text-white disabled:opacity-40"
                >Enviar</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <InfoPanel
        client={client}
        thread={thread}
        qcResult={qcResult}
        tab={panelTab}
        setTab={setPanelTab}
        onThreadUpdated={onThreadUpdated}
        mobileOpen={panelOpen}
        onMobileClose={() => setPanelOpen(false)}
      />

      {takeEditorMsg && (
        <TakeEditor
          clientId={client.id}
          threadId={thread.id}
          messageId={takeEditorMsg.id}
          onClose={() => setTakeEditorMsg(null)}
          onUpdated={async (qc) => {
            await onThreadUpdated()
            if (qc) { setQcResult(qc); }
          }}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Editor take-a-take: corrige UM take (via IA focada ou na mão) editando a
// mensagem em disco — a conversa não vê nada, a memória não degrada.
// ---------------------------------------------------------------------------
function TakeEditor({ clientId, threadId, messageId, onClose, onUpdated }: {
  clientId: string
  threadId: string
  messageId: string
  onClose: () => void
  onUpdated: (qc: QCResult | null) => Promise<void>
}) {
  const [takes, setTakes] = useState<Array<{ label: string; block: string }>>([])
  const [open, setOpen] = useState<string | null>(null)
  const [modo, setModo] = useState<'ia' | 'manual'>('ia')
  const [instruction, setInstruction] = useState('')
  const [manualText, setManualText] = useState('')
  const [busy, setBusy] = useState(false)
  const [doneLabels, setDoneLabels] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    const res = await fetch(`/api/takes/fix?clientId=${clientId}&threadId=${threadId}&messageId=${messageId}`)
    const data = await res.json()
    setTakes(data.takes || [])
  }, [clientId, threadId, messageId])

  useEffect(() => { load() }, [load])

  function openTake(label: string, block: string) {
    setOpen(open === label ? null : label)
    setInstruction('')
    setManualText(block)
    setModo('ia')
  }

  async function fix(label: string) {
    if (busy) return
    if (modo === 'ia' && !instruction.trim()) return
    setBusy(true)
    const toastId = pushToast(`Corrigindo ${label}…`, 'loading', { sticky: true })
    try {
      const res = await fetch('/api/takes/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId, threadId, messageId, label,
          ...(modo === 'ia' ? { instruction } : { newBlock: manualText }),
        }),
      })
      const data = await res.json()
      if (data.error) {
        pushToast(`Erro no ${label}: ${data.error}`, 'error')
        return
      }
      pushToast(`✓ ${label} corrigido${data.qc ? ` — QC: ${data.qc.status}` : ''}`, 'success')
      setDoneLabels(s => new Set([...s, label]))
      setOpen(null)
      await load()
      await onUpdated(data.qc ?? null)
    } finally {
      dismissToast(toastId)
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-[var(--panel)] border border-[var(--border)]" onClick={e => e.stopPropagation()}>
        <header className="shrink-0 flex items-center px-4 py-3 border-b border-[var(--border)]">
          <div>
            <h2 className="font-semibold text-[14px]">🔧 Editor de takes</h2>
            <p className="text-[11px] text-[var(--text-2)]">Corrige um take por vez — a conversa não é tocada, a memória não degrada.</p>
          </div>
          <button onClick={onClose} className="ml-auto text-[var(--text-3)] hover:text-[var(--text)]">✕</button>
        </header>

        <div className="flex-1 overflow-y-auto p-3.5 space-y-2">
          {takes.map(t => (
            <div key={t.label} className={`rounded-xl border ${doneLabels.has(t.label) ? 'border-[var(--green)]' : 'border-[var(--border)]'} bg-[var(--card)]`}>
              <button onClick={() => openTake(t.label, t.block)} className="w-full flex items-center gap-2 px-3 py-2 text-left">
                <span className="text-[12.5px] font-semibold">{t.label}</span>
                {doneLabels.has(t.label) && <span className="text-[10px] text-[var(--green)]">✓ corrigido</span>}
                <span className="text-[11px] text-[var(--text-3)] truncate flex-1">
                  {t.block.split('\n').find(l => /Fala/i.test(l))?.slice(0, 70) || t.block.split('\n')[1]?.slice(0, 70)}
                </span>
                <span className="text-[var(--text-3)]">{open === t.label ? '▾' : '▸'}</span>
              </button>

              {open === t.label && (
                <div className="border-t border-[var(--border)] p-3 space-y-2">
                  <div className="flex gap-1">
                    {(['ia', 'manual'] as const).map(m => (
                      <button key={m} onClick={() => setModo(m)}
                        className={`text-[11px] px-2.5 py-1 rounded-full border ${modo === m ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-2)]'}`}>
                        {m === 'ia' ? '✦ corrigir com IA' : '✎ editar na mão'}
                      </button>
                    ))}
                  </div>

                  {modo === 'ia' ? (
                    <>
                      <pre className="text-[10.5px] whitespace-pre-wrap max-h-40 overflow-y-auto rounded-lg bg-[var(--panel-2)] p-2 font-mono">{t.block}</pre>
                      <textarea
                        value={instruction}
                        onChange={e => setInstruction(e.target.value)}
                        rows={2}
                        placeholder='O que corrigir? Ex: "a fala tá longa demais, encurta pra 6s" · "troca o cenário pra cozinha" · "esse take tomou bloqueio no Flow"'
                        className="w-full text-[12px] rounded-lg border border-[var(--border)] bg-[var(--panel)] p-2 outline-none focus:border-[var(--text-3)]"
                      />
                    </>
                  ) : (
                    <textarea
                      value={manualText}
                      onChange={e => setManualText(e.target.value)}
                      rows={10}
                      className="w-full text-[11px] font-mono rounded-lg border border-[var(--border)] bg-[var(--panel)] p-2 outline-none focus:border-[var(--text-3)]"
                    />
                  )}

                  <div className="flex justify-end gap-1.5">
                    <button onClick={() => setOpen(null)} className="text-[12px] px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-2)]">cancelar</button>
                    <button
                      onClick={() => fix(t.label)}
                      disabled={busy || (modo === 'ia' && !instruction.trim())}
                      className="text-[12px] px-4 py-1.5 rounded-lg bg-[var(--accent)] text-white disabled:opacity-40"
                    >{busy ? 'corrigindo…' : modo === 'ia' ? 'Corrigir take' : 'Salvar take'}</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {takes.length === 0 && <p className="text-[12.5px] text-[var(--text-3)] text-center py-4">Nenhum take reconhecido nesta mensagem.</p>}
        </div>
      </div>
    </div>
  )
}
