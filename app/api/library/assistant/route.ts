import Anthropic from '@anthropic-ai/sdk'
import { listTerms } from '@/lib/store'
import { logUsage } from '@/lib/costlog'
import { HAIKU_MODEL } from '@/lib/ai'

// Assistente da biblioteca: o usuário descreve solto ("efeito de fundo que
// gira quando mexo o mouse") e o Haiku identifica os termos do catálogo.
// Índice compacto do catálogo vai no system com cache_control — repete em
// toda pergunta da sessão.

export const maxDuration = 60

const SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string', description: 'Resposta em PT-BR, curta e útil' },
    termIds: { type: 'array', items: { type: 'string' }, description: 'ids dos termos do catálogo que respondem à pergunta (vazio se nenhum)' },
  },
  required: ['reply', 'termIds'],
  additionalProperties: false,
}

const CLAUDE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export async function POST(request: Request) {
  const { history, image } = (await request.json()) as {
    history: Array<{ role: 'user' | 'assistant'; content: string }>
    image?: { dataUrl: string; mimeType: string }
  }
  if (!history?.length) return Response.json({ error: 'histórico vazio' }, { status: 400 })

  const index = listTerms()
    .map(t => `${t.id} | ${t.termo} (${t.categoria}) — sinônimos: ${t.sinonimos.join(', ')}`)
    .join('\n')

  const system = `Você é o assistente da Biblioteca de Vocabulário Audiovisual do Bruno (produtor de vídeo com IA, brasileiro). Ele descreve efeitos do jeito leigo e você identifica o termo técnico certo no catálogo.

Responda SEMPRE em português simples. Se o efeito existe no catálogo, aponte os ids em termIds e explique em 1-3 frases quando usar. Se não existe, explique mesmo assim (nome técnico + prompt sugerido em inglês) e deixe termIds vazio. Perguntas de acompanhamento ("versão mais sombria", "isso existe pra vídeo?") continuam a conversa normalmente.

Às vezes ele anexa uma IMAGEM de referência ("quero algo nesse estilo"). Nesse caso, descreva o que vê que importa pro vídeo (cor/paleta, textura, luz, movimento implícito, tipografia, mood) e aponte os termos do catálogo que reproduzem aquele visual — se faltar algum, sugira o nome técnico + prompt em inglês.

CATÁLOGO:
${index}`

  // a imagem (quando houver) entra no ÚLTIMO turno do usuário
  const lastIdx = history.length - 1
  const hasImage = !!(image?.dataUrl && CLAUDE_IMAGE_TYPES.includes(image.mimeType) && image.dataUrl.includes(','))
  const messages: Anthropic.MessageParam[] = history.map((m, i) => {
    if (i === lastIdx && m.role === 'user' && hasImage) {
      const content: Anthropic.ContentBlockParam[] = [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: image!.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: image!.dataUrl.split(',')[1],
          },
        },
        { type: 'text', text: m.content || 'Que estilo/efeito é esse? Aponte os termos do catálogo que mais combinam.' },
      ]
      return { role: 'user', content }
    }
    return { role: m.role, content: m.content }
  })

  const client = new Anthropic()
  const response = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 800,
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    messages,
  })

  logUsage('library-assistant', HAIKU_MODEL, response.usage.input_tokens, response.usage.output_tokens)

  const text = response.content.find(b => b.type === 'text')?.text ?? '{}'
  try {
    return Response.json(JSON.parse(text))
  } catch {
    return Response.json({ reply: text, termIds: [] })
  }
}
