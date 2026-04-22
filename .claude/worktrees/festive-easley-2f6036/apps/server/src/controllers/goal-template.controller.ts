import type { Request, Response, NextFunction } from 'express';
import { goalTemplateService } from '../services/goal-template.service';

export function getAllTemplates(req: Request, res: Response, next: NextFunction) {
  try {
    const templates = goalTemplateService.getAll();
    res.json({ data: templates });
  } catch (err) {
    next(err);
  }
}

export function getTemplateById(req: Request, res: Response, next: NextFunction) {
  try {
    const template = goalTemplateService.getById(req.params['id']!);
    res.json({ data: template });
  } catch (err) {
    next(err);
  }
}
