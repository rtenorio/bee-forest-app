import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { pool } from './connection';

const MIGRATIONS = ['0000_init.sql', '0001_auth.sql', '0002_inspection_v2.sql', '0003_qr_codes.sql'];

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const file of MIGRATIONS) {
      const migrationPath = path.join(__dirname, 'migrations', file);
      if (!fs.existsSync(migrationPath)) continue;

      const { rows } = await client.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [file]);
      if (rows.length > 0) {
        console.log(`  — skipping ${file} (already applied)`);
        continue;
      }

      const sql = fs.readFileSync(migrationPath, 'utf-8');
      console.log(`Running migration: ${file}`);
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      console.log(`  ✓ ${file}`);
    }

    // Seed default users
    const defaultPassword = 'BeeForest@2024';
    const hash = await bcrypt.hash(defaultPassword, 10);

    await client.query(`
      INSERT INTO users (name, email, password_hash, role) VALUES
        ('Sócio Admin',        'socio@beeforest.com',        $1, 'socio'),
        ('Responsável Demo',   'responsavel@beeforest.com',  $1, 'responsavel'),
        ('Tratador Demo',      'tratador@beeforest.com',     $1, 'tratador')
      ON CONFLICT (email) DO NOTHING
    `, [hash]);

    console.log('\nUsuários padrão criados (senha: BeeForest@2024):');
    console.log('  socio@beeforest.com        → Sócio');
    console.log('  responsavel@beeforest.com  → Responsável');
    console.log('  tratador@beeforest.com     → Tratador');
    console.log('\nMigração concluída com sucesso.');
  } catch (err) {
    console.error('Migração falhou:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
