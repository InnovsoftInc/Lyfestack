import type { Request, Response, NextFunction } from 'express';
import { templateService } from '../services/template.service';
import { ValidationError } from '../errors/AppError';

export function listTemplates(req: Request, res: Response, next: NextFunction): void {
  try {
    const { category, search } = req.query as { category?: string; search?: string };
    const templates = templateService.list(category, search);
    res.json({ data: templates });
  } catch (err) {
    next(err);
  }
}

export function getTemplate(req: Request, res: Response, next: NextFunction): void {
  try {
    const id = req.params['id'];
    if (!id) throw new ValidationError('Missing template id');
    const template = templateService.getById(id);
    res.json({ data: template });
  } catch (err) {
    next(err);
  }
}

export function getCategories(req: Request, res: Response, next: NextFunction): void {
  try {
    const categories = templateService.getCategories();
    res.json({ data: categories });
  } catch (err) {
    next(err);
  }
}
