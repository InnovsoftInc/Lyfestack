import type { Request, Response, NextFunction } from 'express';
import { goalTemplateService } from '../services/goalTemplate.service';

export function listTemplates(_req: Request, res: Response, next: NextFunction): void {
  try {
    const templates = goalTemplateService.listTemplates();
    res.status(200).json({ data: templates });
  } catch (err) {
    next(err);
  }
}

export function getTemplate(req: Request, res: Response, next: NextFunction): void {
  try {
    const template = goalTemplateService.getTemplate(req.params['id'] as string);
    res.status(200).json({ data: template });
  } catch (err) {
    next(err);
  }
}
