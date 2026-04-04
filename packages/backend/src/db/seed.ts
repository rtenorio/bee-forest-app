/**
 * Seed: apiários e caixas iniciais
 *
 * Meliponários:
 *   Aldeia  — Zona Rural de Recife  (active,      responsável: Rodrigo Tenório)
 *   Viçosa  — Zona Rural de Viçosa  (implantacao)
 *   Murici  — Zona Rural de Murici  (implantacao)
 *   Marechal — Marechal Deodoro     (implantacao)
 *
 * Caixas — espécie: Melipona scutellaris
 *   Aldeia:  CME-001-ALD … CME-102-ALD  (102 caixas)
 *   Viçosa:  CME-001-VIC … CME-100-VIC  (100 caixas)
 *   Murici:  CME-001-MUR … CME-100-MUR  (100 caixas)
 *   Total:   302 caixas
 */

import { v4 as uuidv4 } from 'uuid';
import { pool } from './connection';

const APIARIES = [
  { name: 'Aldeia',   location: 'Zona Rural de Recife',  status: 'active',      owner_name: 'Rodrigo Tenório', prefix: 'ALD', count: 102 },
  { name: 'Viçosa',   location: 'Zona Rural de Viçosa',  status: 'implantacao', owner_name: '',                prefix: 'VIC', count: 100 },
  { name: 'Murici',   location: 'Zona Rural de Murici',  status: 'implantacao', owner_name: '',                prefix: 'MUR', count: 100 },
  { name: 'Marechal', location: 'Marechal Deodoro',      status: 'implantacao', owner_name: '',                prefix: 'MAR', count:   0 },
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Resolve or create Melipona scutellaris
    let speciesRow = await client.query(
      `SELECT local_id FROM species WHERE name ILIKE '%Melipona scutellaris%' AND deleted_at IS NULL LIMIT 1`
    );
    let speciesLocalId: string;
    if (speciesRow.rows[0]) {
      speciesLocalId = speciesRow.rows[0].local_id;
      console.log(`Espécie encontrada: Melipona scutellaris (${speciesLocalId})`);
    } else {
      speciesLocalId = uuidv4();
      await client.query(
        `INSERT INTO species (local_id, name, scientific_name, description)
         VALUES ($1, 'Uruçu-nordestina', 'Melipona scutellaris', 'Abelha sem ferrão nativa do Nordeste brasileiro')
         ON CONFLICT DO NOTHING`,
        [speciesLocalId]
      );
      console.log(`Espécie criada: Melipona scutellaris (${speciesLocalId})`);
    }

    let totalHives = 0;

    for (const apiary of APIARIES) {
      // Upsert apiary by name
      const existing = await client.query(
        `SELECT local_id, server_id FROM apiaries WHERE name = $1 AND deleted_at IS NULL LIMIT 1`,
        [apiary.name]
      );

      let apiaryLocalId: string;
      let apiaryServerId: number;

      if (existing.rows[0]) {
        apiaryLocalId  = existing.rows[0].local_id;
        apiaryServerId = existing.rows[0].server_id;
        await client.query(
          `UPDATE apiaries SET location=$1, status=$2, owner_name=$3, updated_at=NOW()
           WHERE local_id=$4`,
          [apiary.location, apiary.status, apiary.owner_name, apiaryLocalId]
        );
        console.log(`Meliponário atualizado: ${apiary.name} (${apiaryLocalId})`);
      } else {
        apiaryLocalId = uuidv4();
        const ins = await client.query(
          `INSERT INTO apiaries (local_id, name, location, status, owner_name)
           VALUES ($1,$2,$3,$4,$5) RETURNING server_id`,
          [apiaryLocalId, apiary.name, apiary.location, apiary.status, apiary.owner_name]
        );
        apiaryServerId = ins.rows[0].server_id;
        console.log(`Meliponário criado: ${apiary.name} (${apiaryLocalId})`);
      }

      if (apiary.count === 0) continue;

      // Backfill species on existing hives that have none
      if (speciesLocalId) {
        const spRow = await client.query(
          `SELECT server_id FROM species WHERE local_id=$1 LIMIT 1`, [speciesLocalId]
        );
        const speciesServerId: number | null = spRow.rows[0]?.server_id ?? null;
        await client.query(
          `UPDATE hives SET species_local_id=$1, species_id=$2, updated_at=NOW()
           WHERE apiary_local_id=$3 AND (species_local_id IS NULL OR species_local_id='') AND deleted_at IS NULL`,
          [speciesLocalId, speciesServerId, apiaryLocalId]
        );
      }

      // Get existing hive codes for this apiary to skip duplicates
      const existingHives = await client.query(
        `SELECT code FROM hives WHERE apiary_local_id=$1 AND deleted_at IS NULL`,
        [apiaryLocalId]
      );
      const existingCodes = new Set(existingHives.rows.map((r: { code: string }) => r.code));

      let created = 0;
      for (let i = 1; i <= apiary.count; i++) {
        const code = `CME-${String(i).padStart(3, '0')}-${apiary.prefix}`;
        if (existingCodes.has(code)) continue;

        const hiveLocalId = uuidv4();
        await client.query(
          `INSERT INTO hives
             (local_id, apiary_id, apiary_local_id, species_id, species_local_id,
              code, status, installation_date)
           VALUES ($1,$2,$3,
             (SELECT server_id FROM species WHERE local_id=$4 LIMIT 1),
             $4, $5, 'active', CURRENT_DATE)`,
          [hiveLocalId, apiaryServerId, apiaryLocalId, speciesLocalId, code]
        );
        created++;
      }

      totalHives += created;
      console.log(`  ${apiary.name}: ${created} caixas criadas (${apiary.count - created} já existiam)`);
    }

    await client.query('COMMIT');
    console.log(`\nSeed concluído: ${totalHives} caixas inseridas no total.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed falhou:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
