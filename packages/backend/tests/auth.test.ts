import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import {
  createTestUser,
  makeToken,
  makeExpiredToken,
  cleanupTestUsers,
  TEST_PASSWORD,
  TEST_EMAIL_DOMAIN,
  type TestUser,
} from './helpers';

const app = createApp();
const PREFIX = 'auth-test-';
let socio: TestUser;

beforeAll(async () => {
  socio = await createTestUser('socio', `${PREFIX}socio`);
});

afterAll(async () => {
  await cleanupTestUsers(PREFIX);
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  it('retorna JWT com credenciais corretas', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: socio.email, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.length).toBeGreaterThan(20);
    expect(res.body.user?.email).toBe(socio.email);
  });

  it('retorna 401 com senha errada', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: socio.email, password: 'SenhaErrada@999' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('retorna 401 para usuário inexistente', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: `nobody${TEST_EMAIL_DOMAIN}`, password: TEST_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });
});

// ── Middleware de autenticação (GET /api/auth/me) ─────────────────────────────

describe('Middleware JWT — GET /api/auth/me', () => {
  it('retorna 401 sem token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('retorna 401 com token expirado', async () => {
    const token = makeExpiredToken(socio);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
  });

  it('retorna 200 com token válido', async () => {
    const token = makeToken(socio);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(socio.email);
    expect(res.body.role).toBe('socio');
  });
});
