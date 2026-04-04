import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne, pool } from '../db/connection';
import { requireRole } from '../middleware/requireRole';
import { validate } from '../middleware/validate';
import {
  PartnerCreateSchema,
  PartnerUpdateSchema,
  PartnerApiaryCreateSchema,
  EquipmentLoanCreateSchema,
  DeliveryCreateSchema,
  QualityTestCreateSchema,
  PayPaymentSchema,
} from '@bee-forest/shared';

const router = Router();

// Tratador has no access — all routes require at least responsavel
const requireAccess = requireRole('responsavel', 'socio');

// ── Partners ──────────────────────────────────────────────────────────────────

router.get('/', requireAccess, async (req, res, next) => {
  try {
    const { status, city } = req.query;
    const params: unknown[] = [];
    const conditions: string[] = ['p.deleted_at IS NULL'];

    if (status) { params.push(status); conditions.push(`p.status = $${params.length}`); }
    if (city)   { params.push(`%${city}%`); conditions.push(`p.city ILIKE $${params.length}`); }

    const where = conditions.join(' AND ');
    const rows = await query<Record<string, unknown>>(
      `SELECT
        p.*,
        COALESCE(SUM(pa.active_hives_count), 0)::int AS total_hives,
        SUM(CASE WHEN pd.quality_status != 'rejected' THEN pd.volume_ml END)::numeric AS total_volume_ml,
        SUM(CASE WHEN pd.quality_status != 'rejected' THEN pd.weight_kg END)::numeric AS total_weight_kg,
        CASE WHEN COUNT(pd.id) > 0
          THEN ROUND(100.0 * COUNT(pd.id) FILTER (WHERE pd.quality_status IN ('approved','approved_with_observation')) / COUNT(pd.id), 1)
          ELSE NULL
        END AS approval_rate,
        COUNT(pel.id) FILTER (WHERE pel.status = 'active')::int AS active_loans_count,
        COUNT(pp.id) FILTER (WHERE pp.status = 'pending')::int AS pending_payments_count,
        COUNT(pp.id) FILTER (WHERE pp.status = 'overdue')::int AS overdue_payments_count,
        COUNT(pd2.id) FILTER (WHERE pd2.quality_status = 'pending')::int AS pending_delivery_count
      FROM partners p
      LEFT JOIN partner_apiaries pa ON pa.partner_id = p.id
      LEFT JOIN partner_deliveries pd ON pd.partner_id = p.id
      LEFT JOIN partner_deliveries pd2 ON pd2.partner_id = p.id
      LEFT JOIN partner_equipment_loans pel ON pel.partner_id = p.id
      LEFT JOIN partner_payments pp ON pp.partner_id = p.id
      WHERE ${where}
      GROUP BY p.id
      ORDER BY p.full_name`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/', requireRole('socio'), validate(PartnerCreateSchema), async (req, res, next) => {
  try {
    const d = req.body;
    const row = await queryOne(
      `INSERT INTO partners (local_id, full_name, document, address, city, state, phone, whatsapp, email,
        bank_name, bank_agency, bank_account, pix_key, partnership_start_date, status, max_purchase_pct, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [uuidv4(), d.full_name, d.document, d.address, d.city, d.state, d.phone, d.whatsapp, d.email,
       d.bank_name, d.bank_agency, d.bank_account, d.pix_key, d.partnership_start_date,
       d.status ?? 'active', d.max_purchase_pct ?? 70, d.notes]
    );
    res.status(201).json(row);
  } catch (err) { next(err); }
});

// ── Quality Panel (must be before /:id) ──────────────────────────────────────

router.get('/quality/panel', requireAccess, async (_req, res, next) => {
  try {
    const rows = await query<Record<string, unknown>>(
      `SELECT
        p.id AS partner_id, p.local_id AS partner_local_id, p.full_name AS partner_name,
        COUNT(pd.id)::int AS total_deliveries,
        COUNT(pd.id) FILTER (WHERE pd.quality_status IN ('approved','approved_with_observation'))::int AS approved,
        COUNT(pd.id) FILTER (WHERE pd.quality_status = 'rejected')::int AS rejected,
        CASE WHEN COUNT(pd.id) > 0
          THEN ROUND(100.0 * COUNT(pd.id) FILTER (WHERE pd.quality_status IN ('approved','approved_with_observation')) / COUNT(pd.id), 1)
          ELSE NULL END AS approval_rate,
        ROUND(AVG(pqt.hmf)::numeric, 2) AS avg_hmf,
        ROUND(AVG(pqt.moisture_pct)::numeric, 1) AS avg_moisture,
        COUNT(pd.id) FILTER (WHERE pd.quality_status = 'pending')::int AS pending_test_count
      FROM partners p
      LEFT JOIN partner_deliveries pd ON pd.partner_id = p.id
      LEFT JOIN partner_quality_tests pqt ON pqt.delivery_id = pd.id
      WHERE p.deleted_at IS NULL
      GROUP BY p.id, p.local_id, p.full_name
      ORDER BY approval_rate DESC NULLS LAST`,
      []
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── Finance Panel (must be before /:id) ──────────────────────────────────────

router.get('/finance/panel', requireAccess, async (_req, res, next) => {
  try {
    const rows = await query<Record<string, unknown>>(
      `SELECT
        p.id AS partner_id, p.local_id AS partner_local_id, p.full_name AS partner_name,
        COALESCE(SUM(pp.amount) FILTER (WHERE pp.status = 'paid'), 0)::numeric AS total_paid,
        COALESCE(SUM(pp.amount) FILTER (WHERE pp.status = 'pending'), 0)::numeric AS total_pending,
        COALESCE(SUM(pp.amount) FILTER (WHERE pp.status = 'overdue'), 0)::numeric AS total_overdue
      FROM partners p
      LEFT JOIN partner_payments pp ON pp.partner_id = p.id
      WHERE p.deleted_at IS NULL
      GROUP BY p.id, p.local_id, p.full_name
      ORDER BY total_overdue DESC, total_pending DESC`,
      []
    );

    const result = await Promise.all(
      (rows as Record<string, unknown>[]).map(async (r) => {
        const overduePayments = await query(
          `SELECT pp.*, pd.delivery_date FROM partner_payments pp
           JOIN partner_deliveries pd ON pd.id = pp.delivery_id
           WHERE pp.partner_id = $1 AND pp.status = 'overdue'
           ORDER BY pp.due_date ASC`,
          [r.partner_id]
        );
        return { ...r, overdue_payments: overduePayments };
      })
    );
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/summary', requireAccess, async (_req, res, next) => {
  try {
    const stats = await queryOne<Record<string, unknown>>(
      `SELECT
        COUNT(*)::int AS total_partners,
        COUNT(*) FILTER (WHERE status = 'active')::int AS active_partners,
        SUM(CASE WHEN pp.status = 'pending' THEN pp.amount ELSE 0 END)::numeric AS total_pending_payments,
        SUM(CASE WHEN pp.status = 'overdue' THEN pp.amount ELSE 0 END)::numeric AS total_overdue_payments
      FROM partners p
      LEFT JOIN partner_payments pp ON pp.partner_id = p.id
      WHERE p.deleted_at IS NULL`,
      []
    );
    res.json(stats);
  } catch (err) { next(err); }
});

router.get('/:id', requireAccess, async (req, res, next) => {
  try {
    const partner = await queryOne<Record<string, unknown>>(
      `SELECT * FROM partners WHERE local_id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (!partner) return res.status(404).json({ error: 'Parceiro não encontrado' });

    const [apiaries, loans, deliveries, payments] = await Promise.all([
      query(`SELECT * FROM partner_apiaries WHERE partner_id = $1 ORDER BY name`, [partner.id]),
      query(`SELECT * FROM partner_equipment_loans WHERE partner_id = $1 ORDER BY delivery_date DESC`, [partner.id]),
      query(`SELECT pd.*, pa.name AS partner_apiary_name
             FROM partner_deliveries pd
             LEFT JOIN partner_apiaries pa ON pa.id = pd.partner_apiary_id
             WHERE pd.partner_id = $1 ORDER BY pd.delivery_date DESC`, [partner.id]),
      query(`SELECT pp.*, pd.delivery_date
             FROM partner_payments pp
             JOIN partner_deliveries pd ON pd.id = pp.delivery_id
             WHERE pp.partner_id = $1 ORDER BY pp.due_date ASC`, [partner.id]),
    ]);

    // attach quality tests and payments to each delivery
    const deliveriesWithDetails = await Promise.all(
      (deliveries as Record<string, unknown>[]).map(async (del) => {
        const qualityTest = await queryOne(
          `SELECT pqt.*, u.name AS tested_by_name
           FROM partner_quality_tests pqt
           LEFT JOIN users u ON u.id = pqt.tested_by
           WHERE pqt.delivery_id = $1 ORDER BY pqt.created_at DESC LIMIT 1`,
          [del.id]
        );
        const deliveryPayments = (payments as Record<string, unknown>[]).filter(
          (p) => p.delivery_id === del.id
        );
        return { ...del, quality_test: qualityTest ?? null, payments: deliveryPayments };
      })
    );

    res.json({ ...partner, apiaries, loans, deliveries: deliveriesWithDetails, payments });
  } catch (err) { next(err); }
});

router.put('/:id', requireRole('socio'), validate(PartnerUpdateSchema), async (req, res, next) => {
  try {
    const d = req.body;
    const existing = await queryOne<Record<string, unknown>>(
      `SELECT id FROM partners WHERE local_id = $1 AND deleted_at IS NULL`, [req.params.id]
    );
    if (!existing) return res.status(404).json({ error: 'Parceiro não encontrado' });

    const row = await queryOne(
      `UPDATE partners SET
        full_name = COALESCE($2, full_name),
        document = COALESCE($3, document),
        address = COALESCE($4, address),
        city = COALESCE($5, city),
        state = COALESCE($6, state),
        phone = COALESCE($7, phone),
        whatsapp = COALESCE($8, whatsapp),
        email = COALESCE($9, email),
        bank_name = COALESCE($10, bank_name),
        bank_agency = COALESCE($11, bank_agency),
        bank_account = COALESCE($12, bank_account),
        pix_key = COALESCE($13, pix_key),
        partnership_start_date = COALESCE($14, partnership_start_date),
        status = COALESCE($15, status),
        max_purchase_pct = COALESCE($16, max_purchase_pct),
        notes = COALESCE($17, notes),
        updated_at = NOW()
       WHERE local_id = $1
       RETURNING *`,
      [req.params.id, d.full_name, d.document, d.address, d.city, d.state, d.phone, d.whatsapp, d.email,
       d.bank_name, d.bank_agency, d.bank_account, d.pix_key, d.partnership_start_date,
       d.status, d.max_purchase_pct, d.notes]
    );
    res.json(row);
  } catch (err) { next(err); }
});

router.patch('/:id/status', requireRole('socio'), async (req, res, next) => {
  try {
    const { status } = req.body as { status: string };
    if (!['active', 'inactive', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }
    const row = await queryOne(
      `UPDATE partners SET status = $2, updated_at = NOW() WHERE local_id = $1 AND deleted_at IS NULL RETURNING *`,
      [req.params.id, status]
    );
    if (!row) return res.status(404).json({ error: 'Parceiro não encontrado' });
    res.json(row);
  } catch (err) { next(err); }
});

// ── Partner Apiaries ──────────────────────────────────────────────────────────

router.get('/:id/apiaries', requireAccess, async (req, res, next) => {
  try {
    const partner = await queryOne<{ id: number }>(
      `SELECT id FROM partners WHERE local_id = $1 AND deleted_at IS NULL`, [req.params.id]
    );
    if (!partner) return res.status(404).json({ error: 'Parceiro não encontrado' });
    const rows = await query(
      `SELECT * FROM partner_apiaries WHERE partner_id = $1 ORDER BY name`, [partner.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/:id/apiaries', requireAccess, validate(PartnerApiaryCreateSchema), async (req, res, next) => {
  try {
    const partner = await queryOne<{ id: number }>(
      `SELECT id FROM partners WHERE local_id = $1 AND deleted_at IS NULL`, [req.params.id]
    );
    if (!partner) return res.status(404).json({ error: 'Parceiro não encontrado' });
    const d = req.body;
    const row = await queryOne(
      `INSERT INTO partner_apiaries (local_id, partner_id, name, city, state, latitude, longitude,
        bee_species, active_hives_count, management_type, technical_responsible, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [uuidv4(), partner.id, d.name, d.city, d.state, d.latitude, d.longitude,
       d.bee_species, d.active_hives_count ?? 0, d.management_type, d.technical_responsible, d.notes]
    );
    res.status(201).json(row);
  } catch (err) { next(err); }
});

// ── Equipment Loans ───────────────────────────────────────────────────────────

router.get('/:id/loans', requireAccess, async (req, res, next) => {
  try {
    const partner = await queryOne<{ id: number }>(
      `SELECT id FROM partners WHERE local_id = $1 AND deleted_at IS NULL`, [req.params.id]
    );
    if (!partner) return res.status(404).json({ error: 'Parceiro não encontrado' });
    const rows = await query(
      `SELECT * FROM partner_equipment_loans WHERE partner_id = $1 ORDER BY delivery_date DESC`, [partner.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/:id/loans', requireAccess, validate(EquipmentLoanCreateSchema), async (req, res, next) => {
  try {
    const partner = await queryOne<{ id: number }>(
      `SELECT id FROM partners WHERE local_id = $1 AND deleted_at IS NULL`, [req.params.id]
    );
    if (!partner) return res.status(404).json({ error: 'Parceiro não encontrado' });
    const d = req.body;
    const row = await queryOne(
      `INSERT INTO partner_equipment_loans (local_id, partner_id, item_name, item_type, quantity, unit,
        delivery_date, expected_return_date, delivery_condition, contract_url, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [uuidv4(), partner.id, d.item_name, d.item_type, d.quantity ?? 1, d.unit ?? 'unidade',
       d.delivery_date, d.expected_return_date, d.delivery_condition, d.contract_url, d.notes]
    );
    res.status(201).json(row);
  } catch (err) { next(err); }
});

router.patch('/:id/loans/:loanId/return', requireAccess, async (req, res, next) => {
  try {
    const { actual_return_date, return_condition } = req.body as {
      actual_return_date?: string;
      return_condition?: string;
    };
    const row = await queryOne(
      `UPDATE partner_equipment_loans
       SET status = 'returned',
           actual_return_date = COALESCE($2, NOW()::date),
           return_condition = COALESCE($3, return_condition),
           updated_at = NOW()
       WHERE local_id = $1
       RETURNING *`,
      [req.params.loanId, actual_return_date, return_condition]
    );
    if (!row) return res.status(404).json({ error: 'Comodato não encontrado' });
    res.json(row);
  } catch (err) { next(err); }
});

// ── Deliveries ────────────────────────────────────────────────────────────────

router.get('/:id/deliveries', requireAccess, async (req, res, next) => {
  try {
    const partner = await queryOne<{ id: number }>(
      `SELECT id FROM partners WHERE local_id = $1 AND deleted_at IS NULL`, [req.params.id]
    );
    if (!partner) return res.status(404).json({ error: 'Parceiro não encontrado' });
    const rows = await query(
      `SELECT pd.*, pa.name AS partner_apiary_name
       FROM partner_deliveries pd
       LEFT JOIN partner_apiaries pa ON pa.id = pd.partner_apiary_id
       WHERE pd.partner_id = $1 ORDER BY pd.delivery_date DESC`,
      [partner.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/:id/deliveries', requireAccess, validate(DeliveryCreateSchema), async (req, res, next) => {
  try {
    const partner = await queryOne<{ id: number; max_purchase_pct: number }>(
      `SELECT id, max_purchase_pct FROM partners WHERE local_id = $1 AND deleted_at IS NULL`, [req.params.id]
    );
    if (!partner) return res.status(404).json({ error: 'Parceiro não encontrado' });

    const d = req.body;
    const purchasePct = d.purchase_pct ?? partner.max_purchase_pct;
    const acceptedWeightKg = d.weight_kg ? +(d.weight_kg * purchasePct / 100).toFixed(3) : null;
    const acceptedVolumeMl = d.volume_ml ? +(d.volume_ml * purchasePct / 100).toFixed(2) : null;
    const totalValue = acceptedWeightKg && d.price_per_kg
      ? +(acceptedWeightKg * d.price_per_kg).toFixed(2)
      : null;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const delivery = await client.query(
        `INSERT INTO partner_deliveries
          (local_id, partner_id, partner_apiary_id, delivery_date, honey_type, bee_species,
           volume_ml, weight_kg, purchase_pct, accepted_volume_ml, accepted_weight_kg,
           price_per_kg, total_value, quality_status, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending',$14)
         RETURNING *`,
        [uuidv4(), partner.id, d.partner_apiary_id, d.delivery_date, d.honey_type, d.bee_species,
         d.volume_ml, d.weight_kg, purchasePct, acceptedVolumeMl, acceptedWeightKg,
         d.price_per_kg, totalValue, d.notes]
      );
      const deliveryRow = delivery.rows[0];

      // Auto-create parcela 1 (50% on delivery)
      if (totalValue) {
        await client.query(
          `INSERT INTO partner_payments (local_id, delivery_id, partner_id, installment, amount, due_date, status)
           VALUES ($1,$2,$3,1,$4,$5,'pending')`,
          [uuidv4(), deliveryRow.id, partner.id, +(totalValue * 0.5).toFixed(2), d.delivery_date]
        );
      }

      await client.query('COMMIT');
      res.status(201).json(deliveryRow);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
});

// ── Quality Tests ─────────────────────────────────────────────────────────────

router.post('/:id/deliveries/:deliveryId/quality', requireAccess, validate(QualityTestCreateSchema), async (req, res, next) => {
  try {
    const d = req.body;
    const delivery = await queryOne<{ id: number; partner_id: number; total_value: number | null }>(
      `SELECT pd.id, pd.partner_id, pd.total_value
       FROM partner_deliveries pd
       JOIN partners p ON p.id = pd.partner_id
       WHERE p.local_id = $1 AND pd.local_id = $2`,
      [req.params.id, req.params.deliveryId]
    );
    if (!delivery) return res.status(404).json({ error: 'Entrega não encontrada' });

    const hmfApproved = d.hmf != null ? d.hmf < 50 : null;
    const moistureApproved = d.moisture_pct != null ? d.moisture_pct < 28 : null;

    let overallResult: 'approved' | 'approved_with_observation' | 'rejected' = 'approved';
    if (hmfApproved === false || moistureApproved === false) {
      overallResult = 'rejected';
    } else if (d.visual_aspect === 'turvo') {
      overallResult = 'approved_with_observation';
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const testRow = await client.query(
        `INSERT INTO partner_quality_tests
          (delivery_id, tested_at, tested_by, hmf, hmf_approved, moisture_pct, moisture_approved,
           brix, visual_aspect, aroma, overall_result, observations)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING *`,
        [delivery.id, d.tested_at ?? new Date().toISOString(), req.user!.id,
         d.hmf, hmfApproved, d.moisture_pct, moistureApproved,
         d.brix, d.visual_aspect, d.aroma, overallResult, d.observations]
      );

      // Update delivery quality_status
      await client.query(
        `UPDATE partner_deliveries SET quality_status = $2, updated_at = NOW() WHERE id = $1`,
        [delivery.id, overallResult]
      );

      if (overallResult === 'approved' || overallResult === 'approved_with_observation') {
        // Create parcela 2 if it doesn't exist
        const existing = await client.query(
          `SELECT id FROM partner_payments WHERE delivery_id = $1 AND installment = 2`, [delivery.id]
        );
        if (existing.rows.length === 0 && delivery.total_value) {
          await client.query(
            `INSERT INTO partner_payments (local_id, delivery_id, partner_id, installment, amount, status)
             VALUES ($1,$2,$3,2,$4,'pending')`,
            [uuidv4(), delivery.id, delivery.partner_id, +(delivery.total_value * 0.5).toFixed(2)]
          );
        }
      } else {
        // rejected: cancel parcela 2 if exists
        await client.query(
          `UPDATE partner_payments SET status = 'cancelled', updated_at = NOW()
           WHERE delivery_id = $1 AND installment = 2`,
          [delivery.id]
        );
      }

      await client.query('COMMIT');
      res.status(201).json(testRow.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { next(err); }
});

// ── Payments ──────────────────────────────────────────────────────────────────

router.get('/:id/payments', requireAccess, async (req, res, next) => {
  try {
    const partner = await queryOne<{ id: number }>(
      `SELECT id FROM partners WHERE local_id = $1 AND deleted_at IS NULL`, [req.params.id]
    );
    if (!partner) return res.status(404).json({ error: 'Parceiro não encontrado' });
    const rows = await query(
      `SELECT pp.*, pd.delivery_date
       FROM partner_payments pp
       JOIN partner_deliveries pd ON pd.id = pp.delivery_id
       WHERE pp.partner_id = $1 ORDER BY pp.due_date ASC NULLS LAST`,
      [partner.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.patch('/:id/payments/:paymentId/pay', requireAccess, validate(PayPaymentSchema), async (req, res, next) => {
  try {
    const d = req.body;
    const row = await queryOne(
      `UPDATE partner_payments
       SET status = 'paid',
           paid_date = COALESCE($2, NOW()::date),
           payment_method = COALESCE($3, payment_method),
           receipt_url = COALESCE($4, receipt_url),
           notes = COALESCE($5, notes),
           updated_at = NOW()
       WHERE local_id = $1
       RETURNING *`,
      [req.params.paymentId, d.paid_date, d.payment_method, d.receipt_url, d.notes]
    );
    if (!row) return res.status(404).json({ error: 'Pagamento não encontrado' });
    res.json(row);
  } catch (err) { next(err); }
});

export default router;
