// packages/backend/src/routes/inspections/analyzePhotos.ts
// Endpoint: POST /api/inspections/analyze-photos
// Recebe até 2 fotos (externa + interna) e retorna campos da inspeção pré-preenchidos

import { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Mapeamento de campos retornados pela IA
export interface InspectionAIResult {
  // Campos da colônia
  atividadeEntrada: 'alta' | 'media' | 'baixa' | 'ausente' | null;
  densidadePopulacional: 'alta' | 'media' | 'baixa' | null;
  areaTotal: number | null;             // % estimada de ocupação 0-100
  areaCria: number | null;              // % estimada de área de cria 0-100
  areaMel: number | null;               // % estimada de área de mel 0-100
  areaPolen: number | null;             // % estimada de área de pólen 0-100

  // Sanidade
  invasores: string[];                  // ex: ['forídeos', 'formigas'] ou ['ausentes']
  sinaisEnfraquecimento: string[];      // ex: ['baixa_postura'] ou ['nenhum']
  alteracoesInternas: string[];         // ex: ['fungo'] ou ['nenhuma']

  // Condição física
  condicaoCaixa: 'boa' | 'regular' | 'ruim' | null;
  precisaManutencao: boolean | null;

  // Metadados da análise
  confidence: Record<string, number>;   // 0-1 por campo
  observacoesIA: string;                // comentário geral da IA em português
  alertas: string[];                    // alertas identificados
}

const INSPECTION_PROMPT = `Você é um especialista em meliponicultura brasileira, especificamente em Melipona scutellaris (uruçu-nordestina). 
Você está analisando fotos de uma vistoria de caixa de abelha para preencher um formulário de inspeção.

Analise as imagens fornecidas (foto externa e/ou interna da caixa) e retorne APENAS um JSON válido com os campos abaixo.
Não escreva nada além do JSON. Não use blocos de código.

Campos a preencher:
{
  "atividadeEntrada": "alta" | "media" | "baixa" | "ausente" | null,
  "densidadePopulacional": "alta" | "media" | "baixa" | null,
  "areaTotal": número 0-100 (% de ocupação da caixa) ou null,
  "areaCria": número 0-100 (% de área de cria) ou null,
  "areaMel": número 0-100 (% de área de mel) ou null,
  "areaPolen": número 0-100 (% de área de pólen) ou null,
  "invasores": array com zero ou mais de: "forídeos", "histerídeos", "formigas", "lagartas", "aranhas", "lacraias", "outros" — ou ["ausentes"] se não houver,
  "sinaisEnfraquecimento": array com zero ou mais de: "baixa_postura", "populacao_reduzida", "mel_insuficiente", "polen_insuficiente", "abelhas_mortas", "sem_rainha", "comportamento_agitado" — ou ["nenhum"] se não houver,
  "alteracoesInternas": array com zero ou mais de: "fungo", "abelhas_mortas_interno", "odor_anormal", "cria_irregular", "mel_fermentado", "estrutura_danificada", "umidade_excessiva" — ou ["nenhuma"] se não houver,
  "condicaoCaixa": "boa" | "regular" | "ruim" | null,
  "precisaManutencao": true | false | null,
  "confidence": {
    "atividadeEntrada": 0.0-1.0,
    "densidadePopulacional": 0.0-1.0,
    "areaTotal": 0.0-1.0,
    "areaCria": 0.0-1.0,
    "areaMel": 0.0-1.0,
    "areaPolen": 0.0-1.0,
    "invasores": 0.0-1.0,
    "sinaisEnfraquecimento": 0.0-1.0,
    "alteracoesInternas": 0.0-1.0,
    "condicaoCaixa": 0.0-1.0
  },
  "observacoesIA": "comentário geral em português sobre o estado da colônia",
  "alertas": ["lista de alertas importantes observados, em português"]
}

Regras importantes:
- Se não conseguir ver um campo claramente na foto, use null e confidence 0.0 para esse campo
- Para "invasores", "sinaisEnfraquecimento" e "alteracoesInternas": se não identificar problemas, retorne o valor neutro (["ausentes"], ["nenhum"], ["nenhuma"])
- Seja conservador: só marque problemas se tiver razoável certeza visual
- Lembre-se que Melipona scutellaris NÃO tem células reais (realeiras) — a rainha sempre está presente
- "odor_anormal" só pode ser inferido se a foto mostrar sinais visuais de fermentação ou deterioração
- A foto externa permite avaliar: atividade na entrada, condição da caixa, invasores externos
- A foto interna permite avaliar: densidade, cria, mel, pólen, invasores internos, alterações`;

export async function analyzeInspectionPhotos(req: Request, res: Response) {
  try {
    const { fotoExterna, fotoInterna } = req.body as {
      fotoExterna?: string;   // base64 (sem o prefixo data:image/...)
      fotoInterna?: string;   // base64 (sem o prefixo data:image/...)
      fotoExternaType?: string; // 'jpeg' | 'png' | 'webp'
      fotoInternaType?: string;
    };

    if (!fotoExterna && !fotoInterna) {
      return res.status(400).json({ error: 'Ao menos uma foto é necessária.' });
    }

    // Monta o array de imagens para o prompt
    const imageContent: Anthropic.Messages.ImageBlockParam[] = [];

    if (fotoExterna) {
      imageContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: (req.body.fotoExternaType as Anthropic.Base64ImageSource['media_type']) || 'image/jpeg',
          data: fotoExterna,
        },
      });
    }

    if (fotoInterna) {
      imageContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: (req.body.fotoInternaType as Anthropic.Base64ImageSource['media_type']) || 'image/jpeg',
          data: fotoInterna,
        },
      });
    }

    // Monta a mensagem descrevendo o que cada foto é
    const descricaoFotos =
      fotoExterna && fotoInterna
        ? 'A primeira imagem é a foto EXTERNA da caixa (entrada). A segunda imagem é a foto INTERNA (interior da caixa aberta).'
        : fotoExterna
        ? 'Esta é a foto EXTERNA da caixa (entrada e parte exterior).'
        : 'Esta é a foto INTERNA da caixa (interior com favos, abelhas e estrutura).';

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      system: INSPECTION_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            ...imageContent,
            {
              type: 'text',
              text: `${descricaoFotos}\n\nAnalise e retorne o JSON de inspeção.`,
            },
          ],
        },
      ],
    });

    // Extrai e parseia o JSON da resposta
    const rawText = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.Messages.TextBlock).text)
      .join('');

    let result: InspectionAIResult;
    try {
      // Remove possíveis blocos de código caso o modelo insista em usá-los
      const cleaned = rawText
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
      result = JSON.parse(cleaned);
    } catch {
      console.error('Erro ao parsear resposta da IA:', rawText);
      return res.status(500).json({
        error: 'Não foi possível processar a resposta da IA. Tente novamente.',
        rawResponse: rawText,
      });
    }

    // Filtra campos com confiança muito baixa (< 0.35) — deixa null para o frontend pular
    const CONFIDENCE_THRESHOLD = 0.35;
    const filtered: Partial<InspectionAIResult> = { ...result };

    const camposSimples = ['atividadeEntrada', 'densidadePopulacional', 'areaTotal', 'areaCria', 'areaMel', 'areaPolen', 'condicaoCaixa', 'precisaManutencao'] as const;
    for (const campo of camposSimples) {
      if ((result.confidence?.[campo] ?? 1) < CONFIDENCE_THRESHOLD) {
        (filtered as Record<string, unknown>)[campo] = null;
      }
    }

    // Arrays: se confiança baixa, reseta para o padrão neutro
    if ((result.confidence?.invasores ?? 1) < CONFIDENCE_THRESHOLD) {
      filtered.invasores = ['ausentes'];
    }
    if ((result.confidence?.sinaisEnfraquecimento ?? 1) < CONFIDENCE_THRESHOLD) {
      filtered.sinaisEnfraquecimento = ['nenhum'];
    }
    if ((result.confidence?.alteracoesInternas ?? 1) < CONFIDENCE_THRESHOLD) {
      filtered.alteracoesInternas = ['nenhuma'];
    }

    return res.json({
      success: true,
      data: filtered,
    });
  } catch (error) {
    console.error('Erro na análise de fotos:', error);
    return res.status(500).json({ error: 'Erro interno ao analisar as fotos.' });
  }
}
