import { Router } from 'express';
import { calculateScore } from '../controllers/scoring.controller';

const router = Router();

router.post('/calculate', calculateScore);

export default router;
