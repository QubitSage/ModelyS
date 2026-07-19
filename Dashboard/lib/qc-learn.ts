// QC que aprende com veredictos: cada aprovação/rejeição do usuário é sinal.
// Nada é aplicado sozinho — o sistema SUGERE, o usuário aprova.

import fs from 'fs'
import path from 'path'
import { atomicWriteFileSync, getClient, saveClient } from './store'

const VERDICTS_FILE = path.join(process.cwd(), 'data', 'qc-verdicts.json')
const SUGGESTIONS_FILE = path.join(process.cwd(), 'data', 'qc-suggestions.json')

export interface QCVerdict {
  at: string
  clientId: string
  regra: string
  motivo: string
  decision: 'procede' | 'falso-positivo'
  termo?: string // termo da blocklist envolvido, quando a regra é blocklist
}

export interface QCSuggestion {
  id: string
  clientId: string
  tipo: 'adicionar' | 'remover'
  termo: string
  motivo: string
  status: 'pendente' | 'aceita' | 'recusada'
  createdAt: string
}

function readJson<T>(file: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')) } catch { return fallback }
}

export function readVerdicts(): QCVerdict[] {
  return readJson<QCVerdict[]>(VERDICTS_FILE, [])
}

export function readSuggestions(): QCSuggestion[] {
  return readJson<QCSuggestion[]>(SUGGESTIONS_FILE, [])
}

function saveSuggestions(s: QCSuggestion[]) {
  atomicWriteFileSync(SUGGESTIONS_FILE, JSON.stringify(s, null, 2))
}

// Registra o veredicto e, se detectar padrão, gera sugestão pendente.
export function addVerdict(v: QCVerdict) {
  const verdicts = readVerdicts()
  verdicts.push({ ...v, at: new Date().toISOString() })
  atomicWriteFileSync(VERDICTS_FILE, JSON.stringify(verdicts, null, 2))

  // Padrão: termo de blocklist marcado como falso-positivo 2+ vezes pro mesmo
  // cliente → sugerir remover da blocklist do cliente (não mexe na global).
  if (v.regra === 'blocklist' && v.decision === 'falso-positivo' && v.termo) {
    const count = verdicts.filter(
      x => x.clientId === v.clientId && x.regra === 'blocklist' && x.decision === 'falso-positivo' && x.termo === v.termo
    ).length
    if (count >= 2) {
      upsertSuggestion({
        clientId: v.clientId,
        tipo: 'remover',
        termo: v.termo,
        motivo: `Marcado como falso positivo ${count}× — o Flow parece aceitar este termo pra este cliente.`,
      })
    }
  }
}

// Usuário reporta um take que o Flow BLOQUEOU mesmo tendo passado no QC →
// extrai termos candidatos (entidades capitalizadas / palavras suspeitas)
// que ainda não estão na blocklist e sugere adicioná-los.
const STOPWORDS = new Set([
  'The', 'She', 'He', 'They', 'His', 'Her', 'Camera', 'Shot', 'Take', 'Action', 'Visual',
  'Prompt', 'Fala', 'Close', 'Wide', 'Medium', 'Slow', 'Fast', 'Then', 'With', 'And',
  'Brazilian', 'Portuguese', 'English', 'A', 'An', 'In', 'On', 'At', 'Of', 'Warm', 'Soft',
])

export function reportBlockedTake(clientId: string, content: string): QCSuggestion[] {
  const client = getClient(clientId)
  const existing = new Set((client?.qcBlocklist || []).map(t => t.toLowerCase()))

  // Sequências de palavras capitalizadas (nomes próprios, marcas) fora de início de frase óbvio
  const candidates = new Set<string>()
  for (const m of content.matchAll(/\b([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+){0,2})\b/g)) {
    const words = m[1].split(/\s+/)
    if (words.every(w => STOPWORDS.has(w))) continue
    if (existing.has(m[1].toLowerCase())) continue
    if (m[1].length < 3) continue
    candidates.add(m[1])
  }

  const created: QCSuggestion[] = []
  for (const termo of [...candidates].slice(0, 12)) {
    const s = upsertSuggestion({
      clientId,
      tipo: 'adicionar',
      termo,
      motivo: 'Apareceu num take que o Flow bloqueou apesar de passar no QC — candidato a gatilho.',
    })
    if (s) created.push(s)
  }
  return created
}

function upsertSuggestion(input: Omit<QCSuggestion, 'id' | 'status' | 'createdAt'>): QCSuggestion | null {
  const all = readSuggestions()
  const dup = all.find(s => s.clientId === input.clientId && s.termo.toLowerCase() === input.termo.toLowerCase() && s.tipo === input.tipo && s.status !== 'recusada')
  if (dup) return null
  const s: QCSuggestion = { ...input, id: `qs_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, status: 'pendente', createdAt: new Date().toISOString() }
  all.push(s)
  saveSuggestions(all)
  return s
}

export function resolveSuggestion(id: string, accept: boolean): QCSuggestion | null {
  const all = readSuggestions()
  const s = all.find(x => x.id === id)
  if (!s || s.status !== 'pendente') return null
  s.status = accept ? 'aceita' : 'recusada'
  saveSuggestions(all)

  if (accept) {
    const client = getClient(s.clientId)
    if (client) {
      const list = client.qcBlocklist || []
      client.qcBlocklist = s.tipo === 'adicionar'
        ? [...new Set([...list, s.termo])]
        : list.filter(t => t.toLowerCase() !== s.termo.toLowerCase())
      saveClient(client)
    }
  }
  return s
}
