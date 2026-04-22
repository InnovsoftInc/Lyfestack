import { Router } from 'express';
import { generateDailyBrief } from '../controllers/dailyLoop.controller';

const router = Router();

router.post('/generate', generateDailyBrief);

export default router;
