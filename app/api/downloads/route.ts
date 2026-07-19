import { spawn } from 'child_process'
import path from 'path'
import { listJobs, startDownload, deleteJob, MEDIA_DIR } from '@/lib/downloader'

export async function GET() {
  return Response.json(listJobs().slice().reverse())
}

export async function POST(request: Request) {
  const { url, action, file } = await request.json()

  // abrir a pasta (ou um arquivo) no Explorer — servidor roda na máquina local
  if (action === 'open') {
    const target = file ? path.join(MEDIA_DIR, path.basename(file)) : MEDIA_DIR
    spawn('explorer.exe', [target], { detached: true, stdio: 'ignore' }).unref()
    return Response.json({ ok: true })
  }

  if (!url?.trim() || !/^https?:\/\//i.test(url.trim())) {
    return Response.json({ error: 'URL inválida' }, { status: 400 })
  }
  return Response.json(startDownload(url.trim()))
}

export async function DELETE(request: Request) {
  const u = new URL(request.url)
  const id = u.searchParams.get('id')
  if (id) deleteJob(id, u.searchParams.get('file') === '1')
  return Response.json({ ok: true })
}
