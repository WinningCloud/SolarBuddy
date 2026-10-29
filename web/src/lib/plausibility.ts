import { z } from 'zod';
import type { Nameplate } from './types';

const num = (label: string, min: number, max: number) =>
  z
    .number({ invalid_type_error: `${label} is required`, required_error: `${label} is required` })
    .min(min, `${label} must be at least ${min}`)
    .max(max, `${label} must be at most ${max}`);

const thisYear = new Date().getFullYear();

/** Form validation for the nameplate. Limits follow the Phase 1 brief. */
export const nameplateSchema = z.object({
  manufacturer: z.string().trim().min(1, 'Manufacturer is required').max(60),
  model: z.string().trim().min(1, 'Model is required').max(60),
  pmaxW: num('Rated power', 10, 800),
  vocV: num('Voc', 10, 60),
  iscA: num('Isc', 0.5, 20),
  vmppV: num('Vmpp', 8, 55),
  imppA: num('Impp', 0.5, 20),
  yearManufactured: num('Year', 1990, thisYear).int('Year must be a whole number'),
});

export type PlausibilityCode = 'vmpp_not_below_voc' | 'impp_not_below_isc' | 'pmax_mismatch';

export interface PlausibilityIssue {
  code: PlausibilityCode;
  fields: (keyof Nameplate)[];
  /** Values for the message, taken from the entered numbers. */
  values: Record<string, number>;
}

/** Cross-field checks. Violations are shown as warnings, not blocking errors. */
export function plausibilityIssues(np: Nameplate): PlausibilityIssue[] {
  const issues: PlausibilityIssue[] = [];
  const { pmaxW, vocV, iscA, vmppV, imppA } = np;
  if (vmppV && vocV && vmppV >= vocV)
    issues.push({ code: 'vmpp_not_below_voc', fields: ['vmppV', 'vocV'], values: { vmppV, vocV } });
  if (imppA && iscA && imppA >= iscA)
    issues.push({ code: 'impp_not_below_isc', fields: ['imppA', 'iscA'], values: { imppA, iscA } });
  if (pmaxW && vmppV && imppA) {
    const product = vmppV * imppA;
    if (Math.abs(product - pmaxW) / pmaxW > 0.05)
      issues.push({
        code: 'pmax_mismatch',
        fields: ['pmaxW', 'vmppV', 'imppA'],
        values: { pmaxW, product: Math.round(product * 10) / 10 },
      });
  }
  return issues;
}
