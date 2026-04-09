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
const PREFIX = 'insp-test-';

let socio: TestUser;
let testApiaryId: string;
let testHiveId: string;
let createdInspectionId: string | undefined;

beforeAll(async () => {
  socio = await createTestUser('socio', `${PREFIX}socio`);

  const apiaryRes = await request(app)
    .post('/api/apiaries')
    .set('Authorization', `Bearer ${makeToken(socio)}`)
    .send({ name: '[TEST] Insp Apiary' });
  testApiaryId = apiaryRes.body.local_id ?? uuidv4();

  const hiveRes = await request(app)
    .post('/api/hives')
    .set('Authorization', `Bearer ${makeToken(socio)}`)
    .send({ apiary_local_id: testApiaryId, code: '[TEST] INSP-H1', status: 'active' });
  testHiveId = hiveRes.body.local_id ?? uuidv4();
});

afterAll(async () => {
  // Delete inspections before hive (FK ordering)
  await pool.query('DELETE FROM inspection_tasks WHERE inspection_local_id IN (SELECT local_id FROM inspections WHERE hive_local_id = $1)', [testHiveId]);
  await pool.query('DELETE FROM inspections WHERE hive_local_id = $1', [testHiveId]);

  if (testHiveId) {
    await pool.query('UPDATE hives SET deleted_at = NOW() WHERE local_id = $1', [testHiveId]);
  }
  if (testApiaryId) {
    await pool.query('UPDATE apiaries SET deleted_at = NOW() WHERE local_id = $1', [testApiaryId]);
  }
  await cleanupTestUsers(PREFIX);
});

// ── POST /api/inspections ─────────────────────────────────────────────────────

describe('POST /api/inspections', () => {
  it('cria inspeção com dados válidos → 201', async () => {
    const res = await request(app)
      .post('/api/inspections')
      .set('Authorization', `Bearer ${makeToken(socio)}`)
      .send({
        hive_local_id: testHiveId,
        inspected_at: new Date().toISOString(),
        inspector_name: 'Tester Automatizado',
        checklist: {},
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('local_id');
    expect(res.body.hive_local_id).toBe(testHiveId);
    createdInspectionId = res.body.local_id as string;
  });

  it('retorna 400 sem hive_local_id', async () => {
    const res = await request(app)
      .post('/api/inspections')
      .set('Authorization', `Bearer ${makeToken(socio)}`)
      .send({
        inspected_at: new Date().toISOString(),
        inspector_name: 'Tester',
        // hive_local_id omitido
      });

    expect(res.status).toBe(400);
  });

  it('retorna 400 com hive_local_id inválido (não é UUID)', async () => {
    const res = await request(app)
      .post('/api/inspections')
      .set('Authorization', `Bearer ${makeToken(socio)}`)
      .send({
        hive_local_id: 'nao-e-um-uuid',
        inspected_at: new Date().toISOString(),
      });

    expect(res.status).toBe(400);
  });
});

// ── GET /api/inspections ──────────────────────────────────────────────────────

describe('GET /api/inspections', () => {
  it('retorna lista de inspeções → 200', async () => {
    const res = await request(app)
      .get('/api/inspections')
      .set('Authorization', `Bearer ${makeToken(socio)}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ── GET /api/inspections/:local_id ────────────────────────────────────────────

describe('GET /api/inspections/:local_id', () => {
  it('retorna inspeção existente → 200', async () => {
    // Garantir que temos um ID criado (cria um se o POST falhou)
    if (!createdInspectionId) {
      const res = await request(app)
        .post('/api/inspections')
        .set('Authorization', `Bearer ${makeToken(socio)}`)
        .send({ hive_local_id: testHiveId, inspected_at: new Date().toISOString(), checklist: {} });
      createdInspectionId = res.body.local_id;
    }

    const res = await request(app)
      .get(`/api/inspections/${createdInspectionId}`)
      .set('Authorization', `Bearer ${makeToken(socio)}`);

    expect(res.status).toBe(200);
    expect(res.body.local_id).toBe(createdInspectionId);
  });

  it('retorna 404 para inspeção inexistente', async () => {
    const fakeId = uuidv4();
    const res = await request(app)
      .get(`/api/inspections/${fakeId}`)
      .set('Authorization', `Bearer ${makeToken(socio)}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});
