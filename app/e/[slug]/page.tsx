import { getDeliveryBySlug, sweepExpiredDeliveries } from '@/lib/deliveries'
import PortalView from '@/components/PortalView'

// Portal público de entrega — rota isolada, sem a shell interna do app.
export default async function EntregaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  sweepExpiredDeliveries() // limpeza oportunista a cada visita pública
  const d = getDeliveryBySlug(slug)

  if (!d) {
    return (
      <div className="min-h-screen bg-[#0d0d0c] text-[#e8e6e1] grid place-items-center p-6 text-center">
        <div>
          <p className="text-[15px] font-semibold">Entrega não encontrada</p>
          <p className="text-[13px] text-white/50 mt-1">O link pode ter expirado ou está incorreto.</p>
        </div>
      </div>
    )
  }

  // Cliente já confirmou o recebimento: acesso travado (arquivos liberados).
  if (d.receivedAt) {
    const quando = new Date(d.receivedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    return (
      <div className="min-h-screen bg-[#0d0d0c] text-[#e8e6e1] grid place-items-center p-6 text-center">
        <div className="max-w-sm">
          <div className="w-12 h-12 rounded-full bg-[#7bd88f]/15 text-[#7bd88f] grid place-items-center text-2xl mx-auto mb-4">✓</div>
          <p className="text-[16px] font-semibold">Recebimento confirmado</p>
          <p className="text-[13px] text-white/60 mt-2">Você confirmou o recebimento desta entrega em {quando}. O conteúdo foi liberado do nosso servidor.</p>
          <p className="text-[12px] text-white/40 mt-3">Precisa dos arquivos de novo? Fale com a nossa equipe.</p>
        </div>
      </div>
    )
  }

  return (
    <PortalView
      slug={slug}
      data={{
        titulo: d.titulo,
        clienteNome: d.clienteNome,
        createdAt: d.createdAt,
        processo: d.processo,
        itens: d.itens.map(i => ({
          id: i.id, tipo: i.tipo, thumbnail: i.thumbnail, status: i.status, comentario: i.comentario, originalName: i.originalName,
        })),
        audios: (d.audios || []).map(a => ({ id: a.id, transcript: a.transcript, createdAt: a.createdAt })),
      }}
    />
  )
}
