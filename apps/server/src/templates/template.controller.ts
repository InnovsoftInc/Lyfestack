import { Request, Response, NextFunction } from 'express';
import { TemplateService } from './template.service';

const service = new TemplateService();

export const getAllTemplates = (_req: Request, res: Response, _next: NextFunction): void => {
  const templates = service.getAll();
  res.json({ data: templates });
};

export const getTemplateById = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const template = service.getById(req.params.id as string);
    res.json({ data: template });
  } catch (err) {
    next(err);
  }
};
