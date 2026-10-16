import { describe, it, expect } from 'vitest';
import {
  authorizeSyncItem, filtrarColunas,
  type OwnerLookup, type SyncItemInput, type SyncUser, type SyncEntityType,
} from '../src/services/syncAuthorization';

// Teste puro: o banco entra como um lookup em memória.
// Meliponário A (do responsável) e B (alheio); caixa a1 em A, b1 em B.
const HIVES: Record<string, string> = { a1: 'A', a2: 'A', b1: 'B' };
const ROWS: Partial<Record<SyncEntityType, Record<string, Record<string, unknown>>>> = {
  apiary: { A: { local_id: 'A' }, B: { local_id: 'B' } },
  hive: { a1: { local_id: 'a1', apiary_local_id: 'A' }, b1: { local_id: 'b1', apiary_local_id: 'B' } },
  inspection: { insA: { local_id: 'insA', hive_local_id: 'a1' }, insB: { local_id: 'insB', hive_local_id: 'b1' } },
  stock_item: { stA: { local_id: 'stA', apiary_local_id: 'A' } },
  species: { sp1: { local_id: 'sp1' } },
};
const lookup: OwnerLookup = {
  async existing(entity, id) { return ROWS[entity]?.[id] ?? null; },
  async apiaryOfHive(id) { return HIVES[id] ?? null; },
};

const user = (role: string, extra: Partial<SyncUser> = {}): SyncUser =>
  ({ role, secondary_role: null, apiary_local_ids: [], hive_local_ids: [], ...extra });
const responsavel = user('responsavel', { apiary_local_ids: ['A'] });
const tratador = user('tratador', { hive_local_ids: ['a1'] });
const orientador = user('orientador', { apiary_local_ids: ['A'] });

const item = (entity_type: SyncEntityType, operation: SyncItemInput['operation'], entity_local_id: string, payload: Record<string, unknown> = {}): SyncItemInput =>
  ({ entity_type, operation, entity_local_id, payload });

const pode = async (u: SyncUser, i: SyncItemInput) => (await authorizeSyncItem(u, i, lookup)).allowed;

describe('authorizeSyncItem', () => {
  it('master_admin e socio gravam qualquer coisa', async () => {
    expect(await pode(user('master_admin'), item('hive', 'DELETE', 'b1'))).toBe(true);
    expect(await pode(user('socio'), item('apiary', 'DELETE', 'B'))).toBe(true);
  });

  describe('responsavel', () => {
    it('altera e exclui caixa do próprio meliponário', async () => {
      expect(await pode(responsavel, item('hive', 'UPDATE', 'a1', { apiary_local_id: 'A', status: 'inactive' }))).toBe(true);
      expect(await pode(responsavel, item('hive', 'DELETE', 'a1'))).toBe(true);
    });
    it('não exclui nem altera caixa de meliponário alheio', async () => {
      expect(await pode(responsavel, item('hive', 'DELETE', 'b1'))).toBe(false);
      expect(await pode(responsavel, item('hive', 'UPDATE', 'b1', { apiary_local_id: 'B' }))).toBe(false);
    });
    it('payload de DELETE forjado não muda o dono', async () => {
      expect(await pode(responsavel, item('hive', 'DELETE', 'b1', { apiary_local_id: 'A' }))).toBe(false);
    });
    it('não move caixa própria para meliponário alheio', async () => {
      expect(await pode(responsavel, item('hive', 'UPDATE', 'a1', { apiary_local_id: 'B' }))).toBe(false);
    });
    it('não sobrescreve caixa alheia com CREATE do mesmo local_id', async () => {
      expect(await pode(responsavel, item('hive', 'CREATE', 'b1', { apiary_local_id: 'A' }))).toBe(false);
    });
    it('cria caixa nova no próprio meliponário, não em alheio', async () => {
      expect(await pode(responsavel, item('hive', 'CREATE', 'novo', { apiary_local_id: 'A' }))).toBe(true);
      expect(await pode(responsavel, item('hive', 'CREATE', 'novo', { apiary_local_id: 'B' }))).toBe(false);
    });
    it('inspeção segue o meliponário da caixa', async () => {
      expect(await pode(responsavel, item('inspection', 'CREATE', 'n1', { hive_local_id: 'a2' }))).toBe(true);
      expect(await pode(responsavel, item('inspection', 'DELETE', 'insB'))).toBe(false);
    });
    it('inspeção de caixa inexistente é negada', async () => {
      expect(await pode(responsavel, item('inspection', 'CREATE', 'n2', { hive_local_id: 'fantasma' }))).toBe(false);
    });
    it('cria meliponário, mas não exclui (só socio, como no REST)', async () => {
      expect(await pode(responsavel, item('apiary', 'CREATE', 'C'))).toBe(true);
      expect(await pode(responsavel, item('apiary', 'DELETE', 'A'))).toBe(false);
      expect(await pode(responsavel, item('apiary', 'UPDATE', 'B'))).toBe(false);
    });
    it('não exclui item de estoque', async () => {
      expect(await pode(responsavel, item('stock_item', 'DELETE', 'stA'))).toBe(false);
    });
    it('espécie é catálogo global', async () => {
      expect(await pode(responsavel, item('species', 'UPDATE', 'sp1', { name: 'x' }))).toBe(true);
    });
  });

  describe('tratador', () => {
    it('cria e edita inspeção da caixa atribuída', async () => {
      expect(await pode(tratador, item('inspection', 'CREATE', 'n3', { hive_local_id: 'a1' }))).toBe(true);
      expect(await pode(tratador, item('inspection', 'UPDATE', 'insA', { hive_local_id: 'a1' }))).toBe(true);
    });
    it('não edita inspeção alheia declarando a própria caixa', async () => {
      expect(await pode(tratador, item('inspection', 'UPDATE', 'insB', { hive_local_id: 'a1' }))).toBe(false);
    });
    it('não move inspeção própria para caixa alheia', async () => {
      expect(await pode(tratador, item('inspection', 'UPDATE', 'insA', { hive_local_id: 'b1' }))).toBe(false);
    });
    it('não exclui inspeção nem grava outras entidades', async () => {
      expect(await pode(tratador, item('inspection', 'DELETE', 'insA'))).toBe(false);
      expect(await pode(tratador, item('hive', 'UPDATE', 'a1', { apiary_local_id: 'A' }))).toBe(false);
      expect(await pode(tratador, item('feeding', 'CREATE', 'f1', { hive_local_id: 'a1' }))).toBe(false);
    });
  });

  describe('orientador', () => {
    it('cria inspeção, mas não edita, não exclui nem mexe em caixas', async () => {
      expect(await pode(orientador, item('inspection', 'CREATE', 'n4', { hive_local_id: 'b1' }))).toBe(true);
      expect(await pode(orientador, item('inspection', 'UPDATE', 'insA', { hive_local_id: 'a1' }))).toBe(false);
      expect(await pode(orientador, item('inspection', 'DELETE', 'insA'))).toBe(false);
      expect(await pode(orientador, item('hive', 'DELETE', 'a1'))).toBe(false);
    });
  });

  it('secondary_role soma permissões', async () => {
    const misto = user('tratador', { secondary_role: 'responsavel', apiary_local_ids: ['A'], hive_local_ids: [] });
    expect(await pode(misto, item('hive', 'DELETE', 'a1'))).toBe(true);
    expect(await pode(misto, item('hive', 'DELETE', 'b1'))).toBe(false);
  });
});

describe('filtrarColunas', () => {
  const cols = new Set(['local_id', 'server_id', 'name', 'status', 'updated_at']);

  it('mantém só colunas reais e graváveis', () => {
    const { dados, descartadas } = filtrarColunas(
      { name: 'x', status: 'active', updated_at: 't', local_id: 'l', server_id: 1, species_name: 'y' },
      cols,
    );
    expect(dados).toEqual({ name: 'x', status: 'active', updated_at: 't' });
    expect(descartadas.sort()).toEqual(['local_id', 'server_id', 'species_name']);
  });

  it('descarta chave que tentaria injetar SQL', () => {
    const { dados } = filtrarColunas({ 'name = name; DROP TABLE hives; --': 1, name: 'ok' }, cols);
    expect(dados).toEqual({ name: 'ok' });
  });
});
