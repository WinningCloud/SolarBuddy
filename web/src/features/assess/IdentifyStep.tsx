import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Banner,
  FileDropzone,
  Input,
  SourceTag,
  Spinner,
  toast,
  type UploadItem,
} from '@/components/ui';
import { api } from '@/lib/api';
import { readNameplate, VisionUnavailable } from '@/lib/vision';
import { errorMessage, useInvalidatePanels } from '@/lib/queries';
import { nameplateSchema, plausibilityIssues } from '@/lib/plausibility';
import {
  NAMEPLATE_FIELDS,
  type Nameplate,
  type NameplateField,
  type PanelPassport,
} from '@/lib/types';
import { FlowFooter, StepFrame, StepHeader, stepPath, useDebouncedEffect } from './flow';

type Form = Record<NameplateField, string>;
const NUMERIC: NameplateField[] = ['pmaxW', 'vocV', 'iscA', 'vmppV', 'imppA', 'yearManufactured'];
const UNITS: Partial<Record<NameplateField, string>> = {
  pmaxW: 'W',
  vocV: 'V',
  iscA: 'A',
  vmppV: 'V',
  imppA: 'A',
};
const LOW_CONFIDENCE = 0.7;

const toForm = (np: Nameplate): Form =>
  Object.fromEntries(
    NAMEPLATE_FIELDS.map((f) => [f, np[f] === null || np[f] === undefined ? '' : String(np[f])]),
  ) as Form;

function fromForm(form: Form, previous: Nameplate): Nameplate {
  const out = { ...previous } as Record<string, unknown>;
  for (const f of NAMEPLATE_FIELDS) {
    out[f] = NUMERIC.includes(f) ? (form[f].trim() === '' ? null : Number(form[f])) : form[f];
  }
  return out as unknown as Nameplate;
}

export function IdentifyStep() {
  return <StepFrame>{(panel) => <IdentifyForm key={panel.id} panel={panel} />}</StepFrame>;
}

function IdentifyForm({ panel }: { panel: PanelPassport }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidatePanels();
  const [nameplate, setNameplate] = useState<Nameplate>(panel.nameplate);
  const [form, setForm] = useState<Form>(() => toForm(panel.nameplate));
  const [errors, setErrors] = useState<Partial<Record<NameplateField, string>>>({});
  const [demoMode, setDemoMode] = useState(false);
  const [evidence, setEvidence] = useState<Partial<Record<NameplateField, string>>>({});
  const [nothingRead, setNothingRead] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photo = panel.inspection.photos.find((p) => p.slot === 'nameplate');
  const [preview, setPreview] = useState<string | null>(photo?.url ?? null);
  const dirty = useRef(false);

  const extract = useMutation({
    mutationFn: async (file: File) => {
      await api.addPhoto(panel.id, 'nameplate', file);
      try {
        // Real analysis: the api resizes the photo and asks the vision model to read the label.
        const reading = await readNameplate(file, file.name);
        await api.patchPanel(panel.id, { nameplate: reading.nameplate });
        return {
          np: reading.nameplate,
          mode: 'live' as const,
          evidence: reading.evidence,
          readCount: reading.readCount,
        };
      } catch (e) {
        if (!(e instanceof VisionUnavailable)) throw e;
        // The service is not reachable or not configured: fixture values, clearly labelled.
        const fallback = await api.extractNameplate(panel.id, file);
        return { np: fallback.nameplate, mode: 'demo' as const, evidence: {}, readCount: -1 };
      }
    },
    onSuccess: ({ np, mode, evidence: ev, readCount }) => {
      setNameplate(np);
      setForm(toForm(np));
      setDemoMode(mode === 'demo');
      setEvidence(ev);
      setNothingRead(readCount === 0);
      setPhotoError(null);
      setErrors({});
      dirty.current = false;
      invalidate(panel.id);
    },
    onError: (e) => setPhotoError(errorMessage(e, t('identify.failed'))),
  });

  const save = useMutation({
    mutationFn: (np: Nameplate) => api.patchPanel(panel.id, { nameplate: np }),
    onSuccess: () => invalidate(panel.id),
  });

  // Autosave typed values so a refresh never loses work.
  useDebouncedEffect(() => {
    if (dirty.current) save.mutate(nameplate);
  }, [nameplate]);

  useEffect(() => {
    if (!preview && photo) setPreview(photo.url);
  }, [photo, preview]);

  function onField(field: NameplateField, value: string) {
    dirty.current = true;
    const next = { ...form, [field]: value };
    setForm(next);
    const np = fromForm(next, nameplate);
    np.fieldSource = { ...np.fieldSource, [field]: 'manual' };
    np.confidence = { ...np.confidence };
    delete np.confidence[field];
    setNameplate(np);
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate(): Nameplate | null {
    const np = fromForm(form, nameplate);
    const result = nameplateSchema.safeParse({
      manufacturer: np.manufacturer,
      model: np.model,
      pmaxW: np.pmaxW ?? undefined,
      vocV: np.vocV ?? undefined,
      iscA: np.iscA ?? undefined,
      vmppV: np.vmppV ?? undefined,
      imppA: np.imppA ?? undefined,
      yearManufactured: np.yearManufactured ?? undefined,
    });
    if (result.success) {
      setErrors({});
      return np;
    }
    const next: Partial<Record<NameplateField, string>> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as NameplateField;
      next[key] ??= issue.message;
    }
    setErrors(next);
    return null;
  }

  async function persistAndGo(target: 'next' | 'exit') {
    if (target === 'next') {
      const np = validate();
      if (!np) return;
      try {
        await api.patchPanel(panel.id, { nameplate: np, stepIndex: Math.max(panel.stepIndex, 1) });
        invalidate(panel.id);
        navigate(stepPath(panel.id, 'inspect'));
      } catch (e) {
        toast.error(t('common.saveFailed'), { description: errorMessage(e, t('errors.generic')) });
      }
      return;
    }
    try {
      await api.patchPanel(panel.id, { nameplate: fromForm(form, nameplate) });
      invalidate(panel.id);
      toast.success(t('common.saved'));
      navigate('/');
    } catch (e) {
      toast.error(t('common.saveFailed'), { description: errorMessage(e, t('errors.generic')) });
    }
  }

  const issues = plausibilityIssues(fromForm(form, nameplate));
  const flagged = new Set(issues.flatMap((i) => i.fields as string[]));
  const items: UploadItem[] = preview
    ? [
        {
          id: 'np',
          name: photo?.name ?? 'nameplate',
          previewUrl: preview,
          status: extract.isPending ? 'uploading' : 'done',
          slotLabel: t('identify.photoLabel'),
        },
      ]
    : [];

  const tag = (field: NameplateField) => {
    const src = nameplate.fieldSource[field];
    if (src === 'extracted')
      return (
        <SourceTag
          kind="extracted"
          source={
            <>
              {t('identify.confidenceDetail', {
                percent: Math.round((nameplate.confidence[field] ?? 0) * 100),
              })}
              {evidence[field] ? ` ${t('identify.evidence', { text: evidence[field] })}` : ''}
            </>
          }
        />
      );
    if (src === 'manual') return <SourceTag kind="entered" source={t('identify.enteredDetail')} />;
    return undefined;
  };

  const field = (name: NameplateField, extra?: { inputMode?: 'decimal' | 'numeric' | 'text' }) => {
    const confidence = nameplate.confidence[name];
    const low =
      nameplate.fieldSource[name] === 'extracted' &&
      confidence !== undefined &&
      confidence < LOW_CONFIDENCE;
    return (
      <Input
        key={name}
        controlSize="lg"
        label={t(`identify.fields.${name}`)}
        value={form[name]}
        onChange={(e) => onField(name, e.target.value)}
        suffix={UNITS[name]}
        inputMode={extra?.inputMode ?? (NUMERIC.includes(name) ? 'decimal' : 'text')}
        error={errors[name]}
        highlight={low || flagged.has(name)}
        hint={low ? t('identify.lowConfidence') : undefined}
        tag={tag(name)}
        autoComplete="off"
      />
    );
  };

  return (
    <>
      <StepHeader title={t('identify.title')} subtitle={t('identify.subtitle')} />
      <div className="grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="flex flex-col gap-3">
          <FileDropzone
            label={t('identify.photoLabel')}
            description={t('identify.photoHint')}
            items={items}
            maxFiles={1}
            onAdd={(files) => {
              const file = files[0];
              if (!file) return;
              setPreview(URL.createObjectURL(file));
              extract.mutate(file);
            }}
            onRemove={() => setPreview(null)}
            disabled={extract.isPending}
            error={photoError ?? undefined}
          />
          {extract.isPending ? (
            <p className="flex items-center gap-2 text-sm text-ink-2" role="status">
              <Spinner /> {t('identify.reading')}
            </p>
          ) : null}
          {demoMode ? (
            <Banner tone="info" live>
              {t('identify.demoBanner')}
            </Banner>
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-md">{t('identify.manualTitle')}</h2>
            <p className="text-sm text-ink-2">{t('identify.manualHint')}</p>
          </div>
          {nothingRead ? (
            <Banner tone="warning" live>
              {t('identify.nothingRead')}
            </Banner>
          ) : null}
          {!demoMode && Object.keys(evidence).length > 0 ? (
            <Banner tone="info" live>
              {t('identify.liveBanner')}
            </Banner>
          ) : null}
          {issues.length > 0 ? (
            <Banner tone="warning" title={t('identify.plausibility.title')} live>
              <ul className="list-disc pl-4">
                {issues.map((i) => (
                  <li key={i.code}>{t(`identify.plausibility.${i.code}`, i.values)}</li>
                ))}
              </ul>
            </Banner>
          ) : null}
          <div className="sm:grid-cols-2 grid gap-4">
            {field('manufacturer')}
            {field('model')}
            {field('pmaxW')}
            {field('yearManufactured', { inputMode: 'numeric' })}
            {field('vocV')}
            {field('iscA')}
            {field('vmppV')}
            {field('imppA')}
          </div>
        </div>
      </div>
      <FlowFooter onSaveExit={() => persistAndGo('exit')} onContinue={() => persistAndGo('next')} />
    </>
  );
}
