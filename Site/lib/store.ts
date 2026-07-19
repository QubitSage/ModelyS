import fs from 'fs'
import path from 'path'
import { Client, ClientIndex, Message, Thread, Term, LibraryHistoryItem } from './types'

const DATA_DIR = path.join(process.cwd(), 'data')
const CLIENTS_DIR = path.join(DATA_DIR, 'clients')
const LIBRARY_DIR = path.join(DATA_DIR, 'library')
const INDEX_FILE = path.join(DATA_DIR, 'index.json')

function ensureDirs() {
  for (const d of [DATA_DIR, CLIENTS_DIR, LIBRARY_DIR]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true })
  }
}

// Escrita atômica: grava num temp e renomeia — um crash no meio não corrompe
// o JSON do cliente (que carrega todo o histórico de produção).
export function atomicWriteFileSync(file: string, data: string) {
  ensureDirs()
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`
  fs.writeFileSync(tmp, data, 'utf-8')
  fs.renameSync(tmp, file)
}

// ---- Clientes ----

export function listClients(): ClientIndex[] {
  ensureDirs()
  try {
    return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'))
  } catch {
    return []
  }
}

function saveIndex(index: ClientIndex[]) {
  atomicWriteFileSync(INDEX_FILE, JSON.stringify(index, null, 2))
}

function clientFile(id: string) {
  // ids são gerados internamente, mas sanitiza por segurança
  return path.join(CLIENTS_DIR, `${id.replace(/[^\w-]/g, '')}.json`)
}

export function getClient(id: string): Client | null {
  try {
    return JSON.parse(fs.readFileSync(clientFile(id), 'utf-8'))
  } catch {
    return null
  }
}

export function saveClient(client: Client) {
  atomicWriteFileSync(clientFile(client.id), JSON.stringify(client, null, 2))
  const index = listClients()
  const entry: ClientIndex = {
    id: client.id,
    name: client.name,
    createdAt: client.createdAt,
    threadCount: client.threads.length,
  }
  const i = index.findIndex(c => c.id === client.id)
  if (i >= 0) index[i] = entry
  else index.push(entry)
  saveIndex(index)
}

export function createClient(name: string): Client {
  const client: Client = {
    id: `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    name,
    createdAt: new Date().toISOString(),
    threads: [],
    memory: [],
    injectMemory: true,
  }
  saveClient(client)
  return client
}

export function deleteClient(id: string) {
  try { fs.unlinkSync(clientFile(id)) } catch { /* já não existe */ }
  saveIndex(listClients().filter(c => c.id !== id))
}

// Modelo padrão da Direção Criativa para este cliente (seção 3 — promoção
// manual a partir do placar da Arena).
export function setCreativeDefault(clientId: string, provider: Client['creativeDefault']) {
  const c = getClient(clientId)
  if (!c) return null
  c.creativeDefault = provider
  saveClient(c)
  return c
}

// ---- Threads ----

export function getThread(clientId: string, threadId: string): Thread | null {
  const client = getClient(clientId)
  return client?.threads.find(t => t.id === threadId) ?? null
}

export function createThread(clientId: string, name: string, mode: Thread['mode']): Thread | null {
  const client = getClient(clientId)
  if (!client) return null
  const thread: Thread = {
    id: `t_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    clientId,
    name,
    mode,
    createdAt: new Date().toISOString(),
    messages: [],
    context: { briefing: '', notes: '', refs: [] },
    model: 'auto',
  }
  client.threads.push(thread)
  saveClient(client)
  return thread
}

export function updateThread(clientId: string, threadId: string, patch: Partial<Thread>): Thread | null {
  const client = getClient(clientId)
  if (!client) return null
  const i = client.threads.findIndex(t => t.id === threadId)
  if (i < 0) return null
  client.threads[i] = { ...client.threads[i], ...patch, id: threadId, clientId }
  saveClient(client)
  return client.threads[i]
}

export function deleteThread(clientId: string, threadId: string) {
  const client = getClient(clientId)
  if (!client) return
  client.threads = client.threads.filter(t => t.id !== threadId)
  saveClient(client)
}

export function updateMessage(clientId: string, threadId: string, messageId: string, patch: Partial<Message>): Message | null {
  const client = getClient(clientId)
  if (!client) return null
  const thread = client.threads.find(t => t.id === threadId)
  if (!thread) return null
  const i = thread.messages.findIndex(m => m.id === messageId)
  if (i < 0) return null
  thread.messages[i] = { ...thread.messages[i], ...patch, id: messageId }
  saveClient(client)
  return thread.messages[i]
}

// Corta a conversa num ponto: mantém tudo ANTES de messageId; com inclusive=false
// mantém também a própria mensagem. Base do voltar/editar/regenerar.
export function truncateThread(clientId: string, threadId: string, messageId: string, inclusive: boolean): Thread | null {
  const client = getClient(clientId)
  if (!client) return null
  const thread = client.threads.find(t => t.id === threadId)
  if (!thread) return null
  const i = thread.messages.findIndex(m => m.id === messageId)
  if (i < 0) return thread
  thread.messages = thread.messages.slice(0, inclusive ? i : i + 1)
  saveClient(client)
  return thread
}

export function appendMessage(clientId: string, threadId: string, message: Message) {
  const client = getClient(clientId)
  if (!client) return
  const thread = client.threads.find(t => t.id === threadId)
  if (!thread) return
  thread.messages.push(message)
  // Nome automático da thread a partir da primeira mensagem
  if (thread.messages.length === 1 && message.role === 'user' && (!thread.name || thread.name === 'Nova conversa')) {
    thread.name = message.content.slice(0, 48).replace(/\n/g, ' ') || 'Nova conversa'
  }
  saveClient(client)
}

// ---- Biblioteca ----

const TERMS_FILE = path.join(LIBRARY_DIR, 'terms.json')
const CUSTOM_TERMS_FILE = path.join(LIBRARY_DIR, 'terms-custom.json')

export function listTerms(): Term[] {
  ensureDirs()
  const read = (f: string): Term[] => {
    try { return JSON.parse(fs.readFileSync(f, 'utf-8')) } catch { return [] }
  }
  return [...read(TERMS_FILE), ...read(CUSTOM_TERMS_FILE).map(t => ({ ...t, custom: true }))]
}

export function saveCustomTerm(term: Term) {
  ensureDirs()
  let custom: Term[] = []
  try { custom = JSON.parse(fs.readFileSync(CUSTOM_TERMS_FILE, 'utf-8')) } catch { /* primeiro termo */ }
  const i = custom.findIndex(t => t.id === term.id)
  if (i >= 0) custom[i] = term
  else custom.push(term)
  atomicWriteFileSync(CUSTOM_TERMS_FILE, JSON.stringify(custom, null, 2))
}

// Referência real anexada a qualquer termo (base ou custom) fica num overlay,
// pra não editar o terms.json gerado.
const REFS_FILE = path.join(LIBRARY_DIR, 'term-refs.json')

export function getTermRefs(): Record<string, string> {
  try { return JSON.parse(fs.readFileSync(REFS_FILE, 'utf-8')) } catch { return {} }
}

export function setTermRef(termId: string, url: string) {
  const refs = getTermRefs()
  if (url) refs[termId] = url
  else delete refs[termId]
  atomicWriteFileSync(REFS_FILE, JSON.stringify(refs, null, 2))
}

// Histórico de uso da biblioteca — alimentado quando o usuário copia um prompt.
const HISTORY_FILE = path.join(LIBRARY_DIR, 'history.json')
const HISTORY_CAP = 200

export function listLibraryHistory(): LibraryHistoryItem[] {
  try { return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8')) } catch { return [] }
}

export function pushLibraryHistory(item: LibraryHistoryItem) {
  ensureDirs()
  const hist = listLibraryHistory()
  // dedupe: mesmo termo+prompt sobe pro topo em vez de duplicar
  const rest = hist.filter(h => !(h.termId === item.termId && h.texto === item.texto))
  const next = [item, ...rest].slice(0, HISTORY_CAP)
  atomicWriteFileSync(HISTORY_FILE, JSON.stringify(next, null, 2))
}

export function clearLibraryHistory() {
  atomicWriteFileSync(HISTORY_FILE, JSON.stringify([], null, 2))
}
