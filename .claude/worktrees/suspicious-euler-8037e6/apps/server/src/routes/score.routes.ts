import { Router } from 'express';
import { computeScore } from '../controllers/score.controller';

const router = Router();

router.post('/', computeScore);

export default router;
