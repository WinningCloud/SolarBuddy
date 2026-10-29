import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prepareImage } from '../integrations/llm/image';
import { LlmError, llmStatus } from '../integrations/llm/openrouter';
import { classifyDefects, extractNameplate } from '../integrations/llm/tasks';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 4 },
  fileFilter: (_req, file, cb) =>
    cb(null, /^image\/(jpeg|png|webp|heic|heif)$/.test(file.mimetype)),
});

export const visionRouter = Router();

visionRouter.get('/status', (_req, res) => {
  res.json(llmStatus());
});

visionRouter.post(
  '/nameplate',
  upload.single('image'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file)
        throw new HttpError(
          400,
          'NO_IMAGE',
          'Send one image in the "image" field (JPG, PNG or WebP, up to 12 MB).',
        );
      const prepared = await prepareImage(req.file.buffer).catch(() => {
        throw new HttpError(400, 'BAD_IMAGE', 'That file could not be read as an image.');
      });
      const { data, model, latencyMs } = await extractNameplate(prepared.dataUrl);
      res.json({ mode: 'live', model, latencyMs, fields: data });
    } catch (e) {
      next(e);
    }
  },
);

const SlotsSchema = z.array(z.enum(['front', 'back', 'junction_box', 'defect'])).max(4);

visionRouter.post(
  '/defects',
  upload.array('images', 4),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      if (files.length === 0)
        throw new HttpError(400, 'NO_IMAGE', 'Send 1 to 4 images in the "images" field.');
      let slots: string[];
      try {
        slots = SlotsSchema.parse(JSON.parse(String(req.body.slots ?? '[]')));
      } catch {
        throw new HttpError(
          400,
          'BAD_SLOTS',
          'slots must be a JSON array of front, back, junction_box or defect, one per image.',
        );
      }
      while (slots.length < files.length) slots.push('defect');
      const prepared = await Promise.all(files.map((f) => prepareImage(f.buffer)));
      const { data, model, latencyMs } = await classifyDefects(
        prepared.map((p) => p.dataUrl),
        slots.slice(0, files.length),
      );
      res.json({
        mode: 'live',
        model,
        latencyMs,
        slots: slots.slice(0, files.length),
        defects: data.defects,
      });
    } catch (e) {
      next(e);
    }
  },
);

/** Consistent error shape for the whole api: { error: { code, message, details } }. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    res
      .status(err.status)
      .json({ error: { code: err.code, message: err.message, details: err.details ?? null } });
    return;
  }
  if (err instanceof LlmError) {
    const status =
      err.code === 'LLM_UNAVAILABLE' ? 503 : err.code === 'LLM_CAP_REACHED' ? 429 : 502;
    res.status(status).json({ error: { code: err.code, message: err.message, details: null } });
    return;
  }
  if (err instanceof multer.MulterError) {
    res
      .status(400)
      .json({ error: { code: 'UPLOAD_REJECTED', message: err.message, details: null } });
    return;
  }
  res.status(500).json({
    error: { code: 'INTERNAL', message: 'Something went wrong on the server.', details: null },
  });
}
