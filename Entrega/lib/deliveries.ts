import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { atomicWriteFileSync } from './store'
import { Delivery, DeliveryIndexEntry } from './types'

// Storage do Portal de Entregas. Cada entrega é um JSON próprio (com thumbnails
// pequenas embutidas pra galeria leve); os arquivos 4K ficam em disco no volume.
// Um índice leve resolve slug → id. Superfície isolada — não toca chat/core.

const DIR = path.join(process.cwd(), 'data', 'deliveries')
const FILES_DIR = path.join(DIR, 'files')
const INDEX = path.join(DIR, 'index.json')

function ensure() {
  for (const d of [DIR, FILES_DIR]) if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true })
}

function deliveryFile(id: string) {
  return path.join(DIR, `${id.replace(/[^\w-]/g, '')}.json`)
}

export function listIndex(): DeliveryIndexEntry[] {
  try {
    return (JSON.parse(fs.readFileSync(INDEX, 'utf-8')) as DeliveryIndexEntry[])
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  } catch { return [] }
}

function saveIndex(list: DeliveryIndexEntry[]) {
  ensure()
  atomicWriteFileSync(INDEX, JSON.stringify(list, null, 2))
}

// Janela de backup: depois que o cliente confirma o recebimento, a entrega some
// pra ele na hora, mas os arquivos ficam 24h como backup do operador (pra cobrar
// antes de sumir). Passadas as 24h sem "Manter", o sweep apaga tudo.
export const RETENTION_MS = 24 * 60 * 60 * 1000

export function getDelivery(id: string): Delivery | null {
  try { return JSON.parse(fs.readFileSync(deliveryFile(id), 'utf-8')) } catch { return null }
}

export function getDeliveryBySlug(slug: string): Delivery | null {
  const entry = listIndex().find(e => e.slug === slug)
  return entry ? getDelivery(entry.id) : null
}

export function slugTaken(slug: string, exceptId?: string): boolean {
  return listIndex().some(e => e.slug === slug && e.id !== exceptId)
}

export function saveDelivery(d: Delivery) {
  ensure()
  atomicWriteFileSync(deliveryFile(d.id), JSON.stringify(d, null, 2))
  const idx = listIndex().filter(e => e.id !== d.id)
  idx.push({ id: d.id, slug: d.slug, clienteNome: d.clienteNome, titulo: d.titulo, createdAt: d.createdAt, receivedAt: d.receivedAt, keep: d.keep })
  saveIndex(idx)
}

export function deleteDelivery(id: string) {
  try { fs.unlinkSync(deliveryFile(id)) } catch { /* já não existe */ }
  try { fs.rmSync(path.join(FILES_DIR, id), { recursive: true, force: true }) } catch { /* sem arquivos */ }
  saveIndex(listIndex().filter(e => e.id !== id))
}

// Cliente confirma o recebimento: trava o acesso dele e arma o relógio de 24h.
// Idempotente — não reinicia o relógio se já foi confirmado.
export function confirmReceipt(id: string): Delivery | null {
  const d = getDelivery(id)
  if (!d) return null
  if (!d.receivedAt) { d.receivedAt = new Date().toISOString(); saveDelivery(d) }
  return d
}

// Operador liga/desliga o "Manter" (cancela ou reativa a auto-remoção).
export function setKeep(id: string, keep: boolean): Delivery | null {
  const d = getDelivery(id)
  if (!d) return null
  d.keep = keep
  saveDelivery(d)
  return d
}

// Quantos ms faltam pra auto-remoção (null = não está no relógio). Negativo = já venceu.
export function retentionRemainingMs(e: { receivedAt?: string; keep?: boolean }): number | null {
  if (!e.receivedAt || e.keep) return null
  const t = Date.parse(e.receivedAt)
  if (Number.isNaN(t)) return null
  return t + RETENTION_MS - Date.now()
}

// Apaga as entregas recebidas cuja janela de 24h venceu (sem "Manter"). Lê só o
// índice — barato. Chamado de forma oportunista quando o app é usado (lista
// interna, visita pública), então não precisa de cron/scheduler.
export function sweepExpiredDeliveries(): string[] {
  const removed: string[] = []
  for (const e of listIndex()) {
    const rem = retentionRemainingMs(e)
    if (rem !== null && rem <= 0) { deleteDelivery(e.id); removed.push(e.id) }
  }
  return removed
}

// ---- slug ----
function slugify(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'entrega'
}
// F-06: sufixo criptograficamente forte (12 hex ≈ 48 bits), URL-safe [a-f0-9].
export function randomSuffix(): string {
  return crypto.randomBytes(6).toString('hex')
}
export function makeSlug(name: string): string {
  return `${slugify(name)}-${randomSuffix()}`
}

// ---- arquivos 4K (binário em disco) ----
function itemDir(deliveryId: string) {
  const d = path.join(FILES_DIR, deliveryId)
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true })
  return d
}
export function saveItemFile(deliveryId: string, fileName: string, buf: Buffer) {
  fs.writeFileSync(path.join(itemDir(deliveryId), fileName), buf)
}
export function readItemFile(deliveryId: string, fileName: string): Buffer | null {
  try { return fs.readFileSync(path.join(FILES_DIR, deliveryId, fileName)) } catch { return null }
}
export function deleteItemFile(deliveryId: string, fileName: string) {
  try { fs.unlinkSync(path.join(FILES_DIR, deliveryId, fileName)) } catch { /* já foi */ }
}
