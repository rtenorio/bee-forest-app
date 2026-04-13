// packages/shared/src/inspection/sanidadeDefaults.ts
// Valores padrão para a aba Sanidade — pré-marcados pois representam o estado normal da colônia

export const INVASORES_OPCOES = [
  { value: 'ausentes', label: 'Ausentes' },
  { value: 'forídeos', label: 'Forídeos (moscas)' },
  { value: 'histerídeos', label: 'Histerídeos (besouros)' },
  { value: 'formigas', label: 'Formigas' },
  { value: 'lagartas', label: 'Lagartas' },
  { value: 'aranhas', label: 'Aranhas' },
  { value: 'lacraias', label: 'Lacraias' },
  { value: 'outros', label: 'Outros' },
] as const;

export const SINAIS_ENFRAQUECIMENTO_OPCOES = [
  { value: 'nenhum', label: 'Nenhum' },
  { value: 'baixa_postura', label: 'Baixa postura' },
  { value: 'populacao_reduzida', label: 'População reduzida' },
  { value: 'mel_insuficiente', label: 'Mel insuficiente' },
  { value: 'polen_insuficiente', label: 'Pólen insuficiente' },
  { value: 'abelhas_mortas', label: 'Abelhas mortas na entrada' },
  { value: 'sem_rainha', label: 'Suspeita de ausência de rainha' },
  { value: 'comportamento_agitado', label: 'Comportamento agitado' },
] as const;

export const ALTERACOES_INTERNAS_OPCOES = [
  { value: 'nenhuma', label: 'Nenhuma' },
  { value: 'fungo', label: 'Presença de fungo' },
  { value: 'abelhas_mortas_interno', label: 'Abelhas mortas internamente' },
  { value: 'odor_anormal', label: 'Odor anormal' },
  { value: 'cria_irregular', label: 'Cria irregular ou mal distribuída' },
  { value: 'mel_fermentado', label: 'Mel fermentado' },
  { value: 'estrutura_danificada', label: 'Estrutura de favos danificada' },
  { value: 'umidade_excessiva', label: 'Umidade excessiva' },
] as const;

// Valores iniciais do formulário de sanidade — pré-selecionados
export const SANIDADE_INITIAL_VALUES = {
  invasores: ['ausentes'] as string[],
  sinaisEnfraquecimento: ['nenhum'] as string[],
  alteracoesInternas: ['nenhuma'] as string[],
};

// Lógica de exclusão mútua:
// Se usuário marca qualquer item real, remove o 'ausentes/nenhum'
// Se usuário marca 'ausentes/nenhum', remove todos os outros

export function toggleInvasores(
  atual: string[],
  valor: string
): string[] {
  if (valor === 'ausentes') {
    return ['ausentes'];
  }
  const semAusentes = atual.filter((v) => v !== 'ausentes');
  if (semAusentes.includes(valor)) {
    const resultado = semAusentes.filter((v) => v !== valor);
    return resultado.length === 0 ? ['ausentes'] : resultado;
  }
  return [...semAusentes, valor];
}

export function toggleSinaisEnfraquecimento(
  atual: string[],
  valor: string
): string[] {
  if (valor === 'nenhum') {
    return ['nenhum'];
  }
  const semNenhum = atual.filter((v) => v !== 'nenhum');
  if (semNenhum.includes(valor)) {
    const resultado = semNenhum.filter((v) => v !== valor);
    return resultado.length === 0 ? ['nenhum'] : resultado;
  }
  return [...semNenhum, valor];
}

export function toggleAlteracoesInternas(
  atual: string[],
  valor: string
): string[] {
  if (valor === 'nenhuma') {
    return ['nenhuma'];
  }
  const semNenhuma = atual.filter((v) => v !== 'nenhuma');
  if (semNenhuma.includes(valor)) {
    const resultado = semNenhuma.filter((v) => v !== valor);
    return resultado.length === 0 ? ['nenhuma'] : resultado;
  }
  return [...semNenhuma, valor];
}
