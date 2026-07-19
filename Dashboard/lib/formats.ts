import fs from 'fs'
import path from 'path'
import { atomicWriteFileSync } from './store'
import { FormatEntry } from './types'

// Storage da Biblioteca de Formatos que deram certo. Captura manual: o sistema
// não tem acesso automático a métricas das redes, então o operador registra o
// que performou. Fica fora do chat (restrição da spec) — é um catálogo próprio.

const FILE = path.join(process.cwd(), 'data', 'formats.json')

export function listFormats(): FormatEntry[] {
  try {
    const arr: FormatEntry[] = JSON.parse(fs.readFileSync(FILE, 'utf-8'))
    // mais recentes primeiro
    return arr.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  } catch { return [] }
}

function write(arr: FormatEntry[]) {
  atomicWriteFileSync(FILE, JSON.stringify(arr, null, 2))
}

export function saveFormat(f: FormatEntry): FormatEntry {
  const arr = listFormats().filter(x => x.id !== f.id)
  arr.push(f)
  write(arr)
  return f
}

export function deleteFormat(id: string) {
  write(listFormats().filter(f => f.id !== id))
}

// Repertório próprio para o slot "Repertório" da Direção Criativa (seção 4).
// Retorna os formatos mais relevantes pro cliente (ou gerais), compactados.
export function formatsDigestFor(clienteProjeto?: string, limit = 6): string {
  let arr = listFormats()
  if (clienteProjeto) {
    const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    const c = norm(clienteProjeto)
    const mine = arr.filter(f => norm(f.clienteProjeto).includes(c))
    arr = mine.length ? mine : arr // sem histórico do cliente → usa o geral
  }
  return arr.slice(0, limit)
    .map(f => `- [${f.tipo}] ${f.descricao}${f.metrica ? ` (${f.metrica})` : ''}`)
    .join('\n')
}
