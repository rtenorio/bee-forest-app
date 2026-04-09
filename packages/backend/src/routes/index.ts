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
import mediaRouter from './media';
import adminRouter from './admin';
import { authenticate } from '../middleware/authenticate';

const router = Router();

// Public routes (sem autenticação)
router.use('/auth', authRouter);
router.use('/public', publicRouter);

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
router.use('/media', authenticate, mediaRouter);
router.use('/admin', authenticate, adminRouter);

export default router;
