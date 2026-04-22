import { Router } from 'express';
import { getTemplates as getAllTemplates, getTemplateById } from './template.controller';

const router = Router();

router.get('/', getAllTemplates);
router.get('/:id', getTemplateById);

export { router as templateRoutes };
