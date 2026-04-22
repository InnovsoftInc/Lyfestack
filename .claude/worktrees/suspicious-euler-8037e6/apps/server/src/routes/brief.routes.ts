import { Router } from 'express';
import { generateBrief } from '../controllers/brief.controller';

const router = Router();

router.post('/', generateBrief);

export default router;
