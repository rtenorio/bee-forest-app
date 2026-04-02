/**
 * Seed: 100 caixas em cada meliponário (Aldeia, Viçosa, Murici)
 * Padrão de código: CME-001-ALD, CME-001-VIC, CME-001-MUR
 *
 * Executar: npm run db:seed-hives -w packages/backend
 */
import { pool } from './connection';

const APIARIES = [
  { local_id: 'da3289bc-12fb-489a-8e5c-694bcf28b377', suffix: 'ALD', label: 'Aldeia' },
  { local_id: '8e4689f2-16dc-47be-8aab-d02c53428757', suffix: 'VIC', label: 'Viçosa' },
  { local_id: 'd48de3a6-a8b3-40f8-92d9-ecbd50703093', suffix: 'MUR', label: 'Murici' },
];

async function seedHives() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const apiary of APIARIES) {
      // Resolve server_id do apiário
      const { rows } = await client.query<{ server_id: number }>(
        'SELECT server_id FROM apiaries WHERE local_id = $1',
        [apiary.local_id]
      );
      if (rows.length === 0) {
        console.warn(`  ⚠ Apiário não encontrado: ${apiary.label} (${apiary.local_id})`);
        continue;
      }
      const apiary_server_id = rows[0].server_id;

      // Conta quantas caixas já existem (evita duplicatas em re-execução)
      const { rows: countRows } = await client.query<{ n: string }>(
        "SELECT COUNT(*) AS n FROM hives WHERE apiary_local_id = $1 AND deleted_at IS NULL AND code LIKE 'CME-%'",
        [apiary.local_id]
      );
      const existing = parseInt(countRows[0].n, 10);
      if (existing >= 100) {
        console.log(`  — ${apiary.label}: já tem ${existing} caixas, pulando.`);
        continue;
      }
      const start = existing + 1;

      // INSERT em lote com generate_series
      const result = await client.query(
        `INSERT INTO hives (
           local_id, apiary_id, apiary_local_id,
           code, qr_code, status, box_type, notes
         )
         SELECT
           gen_random_uuid(),
           $1,
           $2,
           'CME-' || LPAD(n::text, 3, '0') || '-' || $3,
           'CME-' || LPAD(n::text, 3, '0') || '-' || $3,
           'active',
           '',
           ''
         FROM generate_series($4, 100) AS n
         ON CONFLICT DO NOTHING`,
        [apiary_server_id, apiary.local_id, apiary.suffix, start]
      );
      console.log(`  ✓ ${apiary.label}: ${result.rowCount} caixas inseridas (${start}–100)`);
    }

    await client.query('COMMIT');

    // Resumo final
    for (const apiary of APIARIES) {
      const { rows } = await client.query<{ n: string }>(
        'SELECT COUNT(*) AS n FROM hives WHERE apiary_local_id = $1 AND deleted_at IS NULL',
        [apiary.local_id]
      );
      console.log(`  ${apiary.label}: ${rows[0].n} caixas no banco`);
    }

    console.log('\nSeed concluído.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed falhou:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedHives();
