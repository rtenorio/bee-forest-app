import { Router } from 'express';
import apiariesRouter from './apiaries';
import hivesRouter from './hives';
import speciesRouter from './species';
import inspectionsRouter from './inspections';
import productionsRouter from './productions';
import feedingsRouter from './feedings';
import syncRouter from './sync';
import authRouter from './auth';
import usersRouter from './users';
import { authenticate } from '../middleware/authenticate';

const router = Router();

// Public routes
router.use('/auth', authRouter);

// Protected routes
router.use('/apiaries', authenticate, apiariesRouter);
router.use('/hives', authenticate, hivesRouter);
router.use('/species', authenticate, speciesRouter);
router.use('/inspections', authenticate, inspectionsRouter);
router.use('/productions', authenticate, productionsRouter);
router.use('/feedings', authenticate, feedingsRouter);
router.use('/sync', authenticate, syncRouter);
router.use('/users', authenticate, usersRouter);

export default router;
