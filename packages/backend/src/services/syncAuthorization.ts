/**
 * Autorização do push de /api/sync.
 *
 * O push grava direto nas tabelas e por muito tempo só filtrava o tratador —
 * e ainda confiando no hive_local_id que o próprio cliente mandava. Qualquer
 * outro perfil escrevia em qualquer meliponário. As regras abaixo espelham as
 * das rotas REST (requireRole + checkResourceOwnership):
 *
 * - master_admin, socio: tudo.
 * - responsavel: só registros dos seus meliponários — tanto o registro como
 *   está no banco quanto para onde o payload o leva (mover uma caixa para um
 *   meliponário alheio também é negado). Não exclui meliponário nem item de
 *   estoque, como no REST. Pode criar meliponário e espécie.
 * - orientador: cria inspeção (o POST REST não restringe) e espécie.
 * - tratador: cria e edita inspeções das caixas atribuídas, conferindo a caixa
 *   do registro já gravado, não só a do payload. Não exclui.
 *
 * secondary_role soma permissões: basta um dos dois papéis permitir.
 *
 * O módulo é puro — o acesso ao banco entra por OwnerLookup — para ser
 * testado sem banco.
 */

export type SyncEntityType =
  | 'apiary' | 'hive' | 'species' | 'inspection' | 'production'
  | 'feeding' | 'harvest' | 'batch' | 'stock_item';

export type SyncOperation = 'CREATE' | 'UPDATE' | 'DELETE';

export interface SyncUser {
  role: string;
  secondary_role?: string | null;
  apiary_local_ids: string[];
  hive_local_ids: string[];
}

/** Dados do banco de que a regra precisa. */
export interface OwnerLookup {
  /** Registro atual da entidade (só as colunas de dono), ou null se não existe. */
  existing(entity: SyncEntityType, localId: string): Promise<Record<string, unknown> | null>;
  /** Meliponário da caixa, ou null se a caixa não existe. */
  apiaryOfHive(hiveLocalId: string): Promise<string | null>;
}

/** Coluna que aponta o dono de cada entidade. */
const OWNER: Record<SyncEntityType, { kind: 'self' | 'apiary' | 'hive' | 'none'; column: string }> = {
  apiary:     { kind: 'self',   column: 'local_id' },
  hive:       { kind: 'apiary', column: 'apiary_local_id' },
  harvest:    { kind: 'apiary', column: 'apiary_local_id' },
  batch:      { kind: 'apiary', column: 'apiary_local_id' },
  stock_item: { kind: 'apiary', column: 'apiary_local_id' },
  inspection: { kind: 'hive',   column: 'hive_local_id' },
  production: { kind: 'hive',   column: 'hive_local_id' },
  feeding:    { kind: 'hive',   column: 'hive_local_id' },
  species:    { kind: 'none',   column: '' },
};

export const OWNER_COLUMNS: Record<SyncEntityType, string | null> = Object.fromEntries(
  Object.entries(OWNER).map(([k, v]) => [k, v.kind === 'none' ? null : v.column])
) as Record<SyncEntityType, string | null>;

export interface SyncItemInput {
  entity_type: SyncEntityType;
  entity_local_id: string;
  operation: SyncOperation;
  payload: Record<string, unknown>;
}

export type SyncDecision = { allowed: true } | { allowed: false; reason: string };

const NEGADO = (reason: string): SyncDecision => ({ allowed: false, reason });
const OK: SyncDecision = { allowed: true };

function papeis(user: SyncUser): Set<string> {
  return new Set([user.role, user.secondary_role].filter((r): r is string => !!r));
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/**
 * Donos (caixa e meliponário) que o item toca: o do registro gravado e o do
 * payload, quando diferentes. Para o próprio meliponário, o dono é o local_id.
 */
async function donos(item: SyncItemInput, lookup: OwnerLookup) {
  const cfg = OWNER[item.entity_type];
  // Busca sempre, inclusive no CREATE: o push faz upsert (ON CONFLICT DO
  // UPDATE), então um CREATE com local_id existente sobrescreve o registro.
  const gravado = await lookup.existing(item.entity_type, item.entity_local_id);

  const hives = new Set<string>();
  const apiaries = new Set<string>();
  let semDono = false;

  const coletar = async (valor: string | null) => {
    if (cfg.kind === 'self') { if (valor) apiaries.add(valor); return; }
    if (!valor) return;
    if (cfg.kind === 'apiary') { apiaries.add(valor); return; }
    hives.add(valor);
    const ap = await lookup.apiaryOfHive(valor);
    if (ap) apiaries.add(ap); else semDono = true;
  };

  if (cfg.kind === 'self') {
    await coletar(item.entity_local_id);
  } else if (cfg.kind !== 'none') {
    await coletar(str(gravado?.[cfg.column]));
    // DELETE não muda o dono; o payload de DELETE vem do cliente e é ignorado.
    if (item.operation !== 'DELETE') await coletar(str(item.payload[cfg.column]));
  }

  return { hives, apiaries, semDono, existe: !!gravado };
}

export async function authorizeSyncItem(user: SyncUser, item: SyncItemInput, lookup: OwnerLookup): Promise<SyncDecision> {
  const roles = papeis(user);
  if (roles.has('master_admin') || roles.has('socio')) return OK;

  const { entity_type: tipo, operation: op } = item;
  const alvo = await donos(item, lookup);

  // Registro que precisaria de dono e não tem (ex.: inspeção sem caixa ou de
  // caixa inexistente): nenhum perfil restrito pode gravá-lo.
  const precisaDono = OWNER[tipo].kind !== 'none';
  const donoResolvido = !precisaDono || (!alvo.semDono && alvo.apiaries.size > 0);

  // ── responsavel ──
  if (roles.has('responsavel')) {
    const permitido = (() => {
      if (tipo === 'species') return true;
      if (tipo === 'apiary' && op === 'DELETE') return false;
      if (tipo === 'stock_item' && op === 'DELETE') return false;
      // Meliponário novo: o REST deixa o responsavel criar.
      if (tipo === 'apiary' && op === 'CREATE' && !alvo.existe) return true;
      if (!donoResolvido) return false;
      return [...alvo.apiaries].every((a) => user.apiary_local_ids.includes(a));
    })();
    if (permitido) return OK;
  }

  // ── orientador ──
  if (roles.has('orientador')) {
    if (tipo === 'species') return OK;
    if (tipo === 'inspection' && op === 'CREATE' && !alvo.existe && donoResolvido) return OK;
  }

  // ── tratador ──
  if (roles.has('tratador')) {
    if (tipo === 'inspection' && op !== 'DELETE' && donoResolvido && alvo.hives.size > 0
        && [...alvo.hives].every((h) => user.hive_local_ids.includes(h))) {
      return OK;
    }
  }

  return NEGADO(`Sem permissão para ${op} em ${tipo}`);
}

// ── Colunas graváveis ─────────────────────────────────────────────────────────

const IDENTIFICADOR = /^[a-z_][a-z0-9_]*$/;

/** Colunas que o cliente nunca escreve, mesmo existindo na tabela. */
const PROTEGIDAS = new Set(['server_id', 'id', 'local_id', 'is_dirty', 'synced_at']);

/**
 * Mantém só as chaves que são colunas reais da tabela. Os nomes das chaves
 * entram no SQL como identificadores — sem esta lista, uma chave forjada
 * injetaria SQL. Devolve também as chaves descartadas, para log.
 */
export function filtrarColunas(
  payload: Record<string, unknown>,
  colunas: ReadonlySet<string>,
): { dados: Record<string, unknown>; descartadas: string[] } {
  const dados: Record<string, unknown> = {};
  const descartadas: string[] = [];
  for (const [k, v] of Object.entries(payload)) {
    if (IDENTIFICADOR.test(k) && colunas.has(k) && !PROTEGIDAS.has(k)) dados[k] = v;
    else descartadas.push(k);
  }
  return { dados, descartadas };
}
