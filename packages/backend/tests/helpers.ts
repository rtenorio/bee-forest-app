/**
 * Shared helpers for integration tests.
 *
 * Test data markers:
 *   - Users:    email ends with "@bee-test.local"
 *   - Apiaries: name starts with "[TEST]"
 *   - Hives:    code starts with "[TEST]"
 *
 * Every test file must call its cleanup helper in afterAll.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../src/db/connection';
import { config } from '../src/config';
import type { UserRole } from '../src/shared';

export const TEST_EMAIL_DOMAIN = '@bee-test.local';
export const TEST_PASSWORD = 'TestPass@2024';
export { uuidv4 };

export interface TestUser {
  id: number;
  email: string;
  role: UserRole;
  secondary_role: UserRole | null;
  name: string;
}

/** Create (or upsert) a test user with a known password. */
export async function createTestUser(role: UserRole, prefix: string): Promise<TestUser> {
  const hash = await bcrypt.hash(TEST_PASSWORD, 4); // low rounds = fast for tests
  const email = `${prefix}${TEST_EMAIL_DOMAIN}`;
  const result = await pool.query<TestUser>(
    `INSERT INTO users (name, email, password_hash, role, active)
     VALUES ($1, $2, $3, $4, true)
     ON CONFLICT (email) DO UPDATE
       SET role          = EXCLUDED.role,
           active        = true,
           deleted_at    = NULL,
           password_hash = EXCLUDED.password_hash
     RETURNING id, email, role, name, secondary_role`,
    [`Test ${role}`, email, hash, role],
  );
  return result.rows[0];
}

/** Generate a valid, non-expired JWT for a test user. */
export function makeToken(user: TestUser): string {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: '1h' },
  );
}

/** Generate a JWT whose exp is already in the past. */
export function makeExpiredToken(user: TestUser): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    },
    config.jwtSecret,
  );
}

/**
 * Delete all test users whose email starts with `prefix` + TEST_EMAIL_DOMAIN.
 * Call in afterAll of each test file.
 */
export async function cleanupTestUsers(prefix: string): Promise<void> {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`${prefix}%${TEST_EMAIL_DOMAIN}`]);
}
