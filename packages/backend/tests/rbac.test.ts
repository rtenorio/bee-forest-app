import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { pool } from '../src/db/connection';
import { createApp } from '../src/app';
import {
  createTestUser,
  makeToken,
  cleanupTestUsers,
  uuidv4,
  type TestUser,
} from './helpers';

const app = createApp();
const PREFIX = 'rbac-test-';

let master: TestUser;
let socio: TestUser;
let responsavel: TestUser;
let tratador: TestUser;
let orientador: TestUser;

let testApiaryId: string;
let testHiveId: string;

beforeAll(async () => {
  [master, socio, responsavel, tratador, orientador] = await Promise.all([
    createTestUser('master_admin', `${PREFIX}master`),
    createTestUser('socio', `${PREFIX}socio`),
    createTestUser('responsavel', `${PREFIX}responsavel`),
    createTestUser('tratador', `${PREFIX}tratador`),
    createTestUser('orientador', `${PREFIX}orientador`),
  ]);

  // Create a real apiary + hive via the API so FK relationships are correct.
  const apiaryRes = await request(app)
    .post('/api/apiaries')
    .set('Authorization', `Bearer ${makeToken(socio)}`)
    .send({ name: '[TEST] RBAC Apiary' });
  testApiaryId = apiaryRes.body.local_id ?? uuidv4();

  const hiveRes = await request(app)
    .post('/api/hives')
    .set('Authorization', `Bearer ${makeToken(socio)}`)
    .send({ apiary_local_id: testApiaryId, code: '[TEST] RBAC-H1', status: 'active' });
  testHiveId = hiveRes.body.local_id ?? uuidv4();
});

afterAll(async () => {
  if (testHiveId) {
    await pool.query('UPDATE hives SET deleted_at = NOW() WHERE local_id = $1', [testHiveId]);
  }
  if (testApiaryId) {
    await pool.query('UPDATE apiaries SET deleted_at = NOW() WHERE local_id = $1', [testApiaryId]);
  }
  await cleanupTestUsers(PREFIX);
});

// ── GET /api/apiaries ─────────────────────────────────────────────────────────

describe('GET /api/apiaries — acesso por perfil', () => {
  it('master_admin recebe 200', async () => {
    const res = await request(app)
      .get('/api/apiaries')
      .set('Authorization', `Bearer ${makeToken(master)}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('socio recebe 200', async () => {
    const res = await request(app)
      .get('/api/apiaries')
      .set('Authorization', `Bearer ${makeToken(socio)}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('responsavel recebe 200 (apenas os seus)', async () => {
    const res = await request(app)
      .get('/api/apiaries')
      .set('Authorization', `Bearer ${makeToken(responsavel)}`);

    // responsavel sem atribuições recebe array vazio, mas ainda é 200
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('tratador recebe 403', async () => {
    const res = await request(app)
      .get('/api/apiaries')
      .set('Authorization', `Bearer ${makeToken(tratador)}`);

    expect(res.status).toBe(403);
  });
});

// ── GET /api/hives ────────────────────────────────────────────────────────────

describe('GET /api/hives — tratador vê apenas as suas', () => {
  it('tratador recebe 200 com lista (apenas hives atribuídas)', async () => {
    const res = await request(app)
      .get('/api/hives')
      .set('Authorization', `Bearer ${makeToken(tratador)}`);

    // tratador sem atribuições recebe array vazio, ainda é 200
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ── POST /api/apiaries ────────────────────────────────────────────────────────

describe('POST /api/apiaries — permissões de escrita', () => {
  it('orientador recebe 403 ao tentar criar meliponário', async () => {
    const res = await request(app)
      .post('/api/apiaries')
      .set('Authorization', `Bearer ${makeToken(orientador)}`)
      .send({ name: 'Tentativa não autorizada' });

    expect(res.status).toBe(403);
  });
});

// ── DELETE /api/hives/:id ─────────────────────────────────────────────────────

describe('DELETE /api/hives/:id — permissões de exclusão', () => {
  it('tratador recebe 403 ao tentar deletar caixa', async () => {
    const res = await request(app)
      .delete(`/api/hives/${testHiveId}`)
      .set('Authorization', `Bearer ${makeToken(tratador)}`);

    expect(res.status).toBe(403);
  });
});
