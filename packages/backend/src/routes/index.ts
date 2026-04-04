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

export default router;
