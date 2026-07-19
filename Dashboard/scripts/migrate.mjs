// Migra clientes selecionados do studio-v2 (ModelyApp) pro Modely.
// Uso: node scripts/migrate.mjs
import fs from 'fs'
import path from 'path'

const OLD_CLIENTS = 'C:/Users/bruno/Desktop/ModelyApp/studio-v2/data/clients'
const NEW_DATA = path.join(process.cwd(), 'data')
const NEW_CLIENTS = path.join(NEW_DATA, 'clients')

// Só os clientes com séries recorrentes ativas
const MIGRATE = ['c_1782913619510_gbegn' /* Professor */, 'c_1782913620956_acyoj' /* Manu */]

const MODE_MAP = { free: 'producao', ugc: 'producao', visual: 'visual', revision: 'revisao', web: 'web' }

fs.mkdirSync(NEW_CLIENTS, { recursive: true })

const index = []
for (const id of MIGRATE) {
  const old = JSON.parse(fs.readFileSync(path.join(OLD_CLIENTS, `${id}.json`), 'utf-8'))

  const client = {
    id: old.id,
    name: old.name,
    createdAt: old.createdAt || new Date().toISOString(),
    threads: (old.threads || []).map(t => ({
      id: t.id,
      clientId: old.id,
      name: t.name || 'Conversa migrada',
      mode: MODE_MAP[t.mode] || 'producao',
      createdAt: t.createdAt || old.createdAt,
      messages: (t.messages || []).map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        attachments: m.attachments,
        inputTokens: m.inputTokens,
        outputTokens: m.outputTokens,
        model: m.model,
      })),
      context: {
        briefing: t.context?.briefing || '',
        notes: t.context?.notes || '',
        refs: t.context?.refs || [],
        previousSummary: t.context?.previousSummary,
      },
      model: t.model || 'auto',
    })),
    memory: old.memory || [],
    injectMemory: old.injectMemory ?? true,
    company: old.company,
    segment: old.segment,
    crmNotes: old.crmNotes,
    tags: old.tags,
    contacts: old.contacts,
    deals: old.deals,
    activities: old.activities,
  }

  fs.writeFileSync(path.join(NEW_CLIENTS, `${client.id}.json`), JSON.stringify(client, null, 2))
  index.push({ id: client.id, name: client.name, createdAt: client.createdAt, threadCount: client.threads.length })
  const nmsgs = client.threads.reduce((s, t) => s + t.messages.length, 0)
  console.log(`migrado: ${client.name} — ${client.threads.length} threads, ${nmsgs} mensagens`)
}

fs.writeFileSync(path.join(NEW_DATA, 'index.json'), JSON.stringify(index, null, 2))
console.log('index.json gravado.')
