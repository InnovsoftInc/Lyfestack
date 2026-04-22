import { Router } from 'express';
import { generatePlan } from '../controllers/planning.controller';

const router = Router();

router.post('/generate', generatePlan);

export default router;
