import { Router } from 'express';
import apiariesRouter from './apiaries';
import hivesRouter from './hives';
import speciesRouter from './species';
import inspectionsRouter from './inspections';
import productionsRouter from './productions';
import feedingsRouter from './feedings';
import harvestsRouter from './harvests';
import syncRouter from './sync';
import authRouter from './auth';
import usersRouter from './users';
import qrRouter from './qr';
import publicRouter from './public';
import batchesRouter from './batches';
import notificationsRouter from './notifications';
import stockRouter from './stock';
import partnersRouter from './partners';
import instructionsRouter from './instructions';
import divisionsRouter from './divisions';
import transfersRouter from './transfers';
import equipmentRouter from './equipment';
import melgueirasRouter from './melgueiras';
import { authenticate } from '../middleware/authenticate';
import { pool } from '../db/connection';

const router = Router();

// Public routes (sem autenticação)
router.use('/auth', authRouter);
router.use('/public', publicRouter);

// TEMP: resetar triggers duplicados e reexecutar migrations — remover após uso
router.get('/admin/run-migration', async (_req, res) => {
  try {
    await pool.query('DROP TRIGGER IF EXISTS hive_instructions_updated_at ON hive_instructions');
    await pool.query('DROP TRIGGER IF EXISTS hive_divisions_updated_at ON hive_divisions');
    await pool.query(`DELETE FROM schema_migrations WHERE filename IN ('0017_instructions.sql', '0018_divisions.sql')`);
    res.json({ ok: true, message: 'Triggers removidos e migrations 0017/0018 resetadas com sucesso.' });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// Protected routes
router.use('/apiaries', authenticate, apiariesRouter);
router.use('/hives', authenticate, hivesRouter);
router.use('/species', authenticate, speciesRouter);
router.use('/inspections', authenticate, inspectionsRouter);
router.use('/productions', authenticate, productionsRouter);
router.use('/feedings', authenticate, feedingsRouter);
router.use('/harvests', authenticate, harvestsRouter);
router.use('/sync', authenticate, syncRouter);
router.use('/users', authenticate, usersRouter);
router.use('/qr', authenticate, qrRouter);
router.use('/batches', authenticate, batchesRouter);
router.use('/notifications', authenticate, notificationsRouter);
router.use('/stock', authenticate, stockRouter);
router.use('/partners', authenticate, partnersRouter);
router.use('/instructions', authenticate, instructionsRouter);
router.use('/divisions', authenticate, divisionsRouter);
router.use('/transfers', authenticate, transfersRouter);
router.use('/equipment', authenticate, equipmentRouter);
router.use('/melgueiras', authenticate, melgueirasRouter);

export default router;
