import cron from 'node-cron';
import { query } from '../db/connection';
import { notifyUser } from '../services/notification.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getApiaryResponsaveis(apiaryLocalId: string): Promise<number[]> {
  const rows = await query<{ user_id: number }>(
    `SELECT uaa.user_id FROM user_apiary_assignments uaa
     JOIN users u ON u.id = uaa.user_id
     WHERE uaa.apiary_local_id = $1 AND u.active = true AND u.deleted_at IS NULL`,
    [apiaryLocalId]
  );
  return rows.map((r) => r.user_id);
}

async function getMasterAdminsAndSocios(): Promise<number[]> {
  const rows = await query<{ id: number }>(
    `SELECT id FROM users WHERE role IN ('master_admin','socio') AND active = true AND deleted_at IS NULL`
  );
  return rows.map((r) => r.id);
}

async function hasSettingEnabled(
  userId: number,
  setting: 'notify_inspection_overdue' | 'notify_task_overdue' | 'notify_batch_risk' | 'notify_batch_stalled'
): Promise<boolean> {
  const row = await query<Record<string, unknown>>(
    `SELECT ${setting} FROM notification_settings WHERE user_id = $1`,
    [userId]
  );
  // Default true if no settings row exists
  return row.length === 0 ? true : Boolean(row[0][setting]);
}

// ── Check: Caixas sem inspeção ─────────────────────────────────────────────────

async function checkInspectionOverdue(): Promise<void> {
  // Find active hives with no inspection in the last 14 days (or never)
  const hives = await query<{
    local_id: string;
    code: string;
    apiary_local_id: string;
    apiary_name: string | null;
    last_inspection: string | null;
    overdue_days: number;
  }>(
    `SELECT h.local_id, h.code, h.apiary_local_id,
       a.name AS apiary_name,
       MAX(i.inspected_at) AS last_inspection,
       EXTRACT(DAY FROM NOW() - COALESCE(MAX(i.inspected_at), h.created_at))::int AS overdue_days
     FROM hives h
     LEFT JOIN apiaries a ON a.local_id = h.apiary_local_id
     LEFT JOIN inspections i ON i.hive_local_id = h.local_id AND i.deleted_at IS NULL
     WHERE h.deleted_at IS NULL AND h.status = 'active'
     GROUP BY h.local_id, h.code, h.apiary_local_id, a.name, h.created_at
     HAVING COALESCE(MAX(i.inspected_at), h.created_at) < NOW() - INTERVAL '14 days'`
  );

  for (const hive of hives) {
    const title = `Caixa ${hive.code} sem inspeção`;
    const body = `A caixa ${hive.code}${hive.apiary_name ? ` (${hive.apiary_name})` : ''} está há ${hive.overdue_days} dias sem inspeção.`;
    const url = `/hives/${hive.local_id}`;

    // Notify tratadores assigned to this hive
    const tratadores = await query<{ user_id: number }>(
      'SELECT user_id FROM user_hive_assignments WHERE hive_local_id = $1',
      [hive.local_id]
    );
    for (const t of tratadores) {
      if (await hasSettingEnabled(t.user_id, 'notify_inspection_overdue')) {
        await notifyUser(t.user_id, 'inspection_overdue', title, body, 'hive', hive.local_id, url);
      }
    }

    // Notify responsaveis for the apiary
    const responsaveis = await getApiaryResponsaveis(hive.apiary_local_id);
    for (const uid of responsaveis) {
      if (await hasSettingEnabled(uid, 'notify_inspection_overdue')) {
        await notifyUser(uid, 'inspection_overdue', title, body, 'hive', hive.local_id, url);
      }
    }
  }
}

// ── Check: Tarefas vencidas ───────────────────────────────────────────────────

async function checkTaskOverdue(): Promise<void> {
  const tasks = await query<{
    id: number;
    inspection_local_id: string;
    task_label: string;
    due_date: string;
    hive_local_id: string;
    hive_code: string;
    apiary_local_id: string;
    apiary_name: string | null;
  }>(
    `SELECT it.id, it.inspection_local_id, it.task_label, it.due_date,
       i.hive_local_id, h.code AS hive_code, h.apiary_local_id,
       a.name AS apiary_name
     FROM inspection_tasks it
     JOIN inspections i ON i.local_id = it.inspection_local_id
     JOIN hives h ON h.local_id = i.hive_local_id
     LEFT JOIN apiaries a ON a.local_id = h.apiary_local_id
     WHERE it.due_date < NOW()::date
       AND i.deleted_at IS NULL
       AND h.deleted_at IS NULL`
  );

  for (const task of tasks) {
    const title = `Tarefa vencida: ${task.task_label}`;
    const body = `Tarefa "${task.task_label}" na caixa ${task.hive_code}${task.apiary_name ? ` (${task.apiary_name})` : ''} venceu em ${new Date(task.due_date).toLocaleDateString('pt-BR')}.`;
    const url = `/hives/${task.hive_local_id}`;

    const responsaveis = await getApiaryResponsaveis(task.apiary_local_id);
    for (const uid of responsaveis) {
      if (await hasSettingEnabled(uid, 'notify_task_overdue')) {
        await notifyUser(uid, 'task_overdue', title, body, 'inspection', task.inspection_local_id, url);
      }
    }
  }
}

// ── Check: Risco de fermentação em lotes ─────────────────────────────────────

async function checkBatchFermentationRisk(): Promise<void> {
  const batches = await query<{
    local_id: string;
    code: string;
    apiary_local_id: string;
    apiary_name: string | null;
    risk_reason: string;
  }>(
    `SELECT DISTINCT b.local_id, b.code, b.apiary_local_id, a.name AS apiary_name,
       CASE
         WHEN b.initial_moisture > 30 THEN 'Umidade inicial alta (' || b.initial_moisture || '%)'
         ELSE 'Sinais de fermentação nas observações de maturação'
       END AS risk_reason
     FROM honey_batches b
     LEFT JOIN apiaries a ON a.local_id = b.apiary_local_id
     LEFT JOIN maturation_sessions ms ON ms.batch_local_id = b.local_id
     LEFT JOIN maturation_observations mo ON mo.maturation_session_id = ms.id
     WHERE b.deleted_at IS NULL
       AND b.current_status NOT IN ('sold','rejected','bottled')
       AND (
         b.initial_moisture > 30
         OR mo.bubbles_present = TRUE
         OR mo.foam_present = TRUE
         OR mo.visible_fermentation_signs = TRUE
       )`
  );

  for (const batch of batches) {
    const title = `Risco no lote ${batch.code}`;
    const body = `${batch.risk_reason} no lote ${batch.code}${batch.apiary_name ? ` (${batch.apiary_name})` : ''}. Verifique imediatamente.`;
    const url = `/batches/${batch.local_id}`;

    const responsaveis = await getApiaryResponsaveis(batch.apiary_local_id);
    const admins = await getMasterAdminsAndSocios();
    const recipients = [...new Set([...responsaveis, ...admins])];

    for (const uid of recipients) {
      if (await hasSettingEnabled(uid, 'notify_batch_risk')) {
        await notifyUser(uid, 'batch_fermentation_risk', title, body, 'batch', batch.local_id, url);
      }
    }
  }
}

// ── Check: Lotes parados há 7+ dias ──────────────────────────────────────────

async function checkBatchStalled(): Promise<void> {
  const batches = await query<{
    local_id: string;
    code: string;
    apiary_local_id: string;
    apiary_name: string | null;
    stalled_days: number;
  }>(
    `SELECT b.local_id, b.code, b.apiary_local_id, a.name AS apiary_name,
       EXTRACT(DAY FROM NOW() - b.updated_at)::int AS stalled_days
     FROM honey_batches b
     LEFT JOIN apiaries a ON a.local_id = b.apiary_local_id
     WHERE b.deleted_at IS NULL
       AND b.current_status IN ('collected','in_dehumidification','in_maturation')
       AND b.updated_at < NOW() - INTERVAL '7 days'`
  );

  for (const batch of batches) {
    const title = `Lote ${batch.code} parado`;
    const body = `O lote ${batch.code}${batch.apiary_name ? ` (${batch.apiary_name})` : ''} está há ${batch.stalled_days} dias sem movimentação.`;
    const url = `/batches/${batch.local_id}`;

    const responsaveis = await getApiaryResponsaveis(batch.apiary_local_id);
    for (const uid of responsaveis) {
      if (await hasSettingEnabled(uid, 'notify_batch_stalled')) {
        await notifyUser(uid, 'batch_stalled', title, body, 'batch', batch.local_id, url);
      }
    }
  }
}

// ── Run all checks ────────────────────────────────────────────────────────────

async function runAllChecks(): Promise<void> {
  console.log('[notification-job] Running checks at', new Date().toISOString());
  await Promise.allSettled([
    checkInspectionOverdue(),
    checkTaskOverdue(),
    checkBatchFermentationRisk(),
    checkBatchStalled(),
  ]);
  console.log('[notification-job] Done');
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

export function startNotificationJob(): void {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', () => {
    runAllChecks().catch((err) => console.error('[notification-job] Error:', err));
  });
  console.log('[notification-job] Scheduled (every hour)');
}

export { runAllChecks };
