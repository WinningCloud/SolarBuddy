import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config';
import { HttpError } from './vision';

// Request validated here, then forwarded to the sim service, which owns the physics.
const Panel = z.object({
  id: z.string().min(1).max(40),
  pmax_w: z.number().gt(10).lte(800),
  voc_v: z.number().gt(10).lte(60),
  isc_a: z.number().gt(0.5).lte(20),
  substring_irradiance_wm2: z
    .tuple([z.number().min(0), z.number().min(0), z.number().min(0)])
    .optional(),
  cell_temp_c: z.number().min(-40).max(120).optional(),
  dead_substrings: z.array(z.number().int().min(0).max(2)).optional(),
  health_factor: z.number().gt(0).lte(1.2).optional(),
});

const Evaluate = z.object({
  panels: z.array(Panel).min(1).max(64),
  grouping: z.array(z.array(z.array(z.string()).min(1)).min(1)).min(1),
  relay_rds_on_ohm: z.number().min(0).max(5).optional(),
  inverter: z.object({ v_min_v: z.number(), v_max_v: z.number() }).optional(),
});

export const composerRouter = Router();

composerRouter.post('/evaluate', async (req, res, next) => {
  try {
    const parsed = Evaluate.safeParse(req.body);
    if (!parsed.success)
      throw new HttpError(
        400,
        'VALIDATION',
        'The array description is not valid.',
        parsed.error.flatten(),
      );
    let upstream: Response;
    try {
      upstream = await fetch(`${config.SIM_URL}/composer/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new HttpError(503, 'SIM_UNAVAILABLE', 'The simulation service could not be reached.');
    }
    const body: unknown = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      const detail = (body as { detail?: unknown } | null)?.detail;
      throw new HttpError(
        upstream.status === 422 ? 400 : 502,
        'SIM_ERROR',
        typeof detail === 'string' ? detail : 'The simulation service rejected the request.',
      );
    }
    res.json(body);
  } catch (e) {
    next(e);
  }
});
