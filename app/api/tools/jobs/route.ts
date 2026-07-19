import { readJobs, startJob, deleteJob, ToolJobType } from '@/lib/tooljobs'

export const maxDuration = 300

export async function GET() {
  return Response.json(readJobs().slice().reverse())
}

export async function POST(request: Request) {
  const form = await request.formData()
  const file = form.get('file') as File | null
  const type = (form.get('type') as ToolJobType) || 'video'
  if (!file) return Response.json({ error: 'arquivo obrigatório' }, { status: 400 })
  if (!['video', 'audio', 'image'].includes(type)) return Response.json({ error: 'tipo inválido' }, { status: 400 })

  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64')
  const job = startJob(type, file.name, base64, file.type || 'application/octet-stream')
  return Response.json(job)
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get('id')
  if (id) deleteJob(id)
  return Response.json({ ok: true })
}
