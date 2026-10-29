import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Banner,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  FileDropzone,
  Input,
  SegmentedControl,
  Select,
  toast,
  type UploadItem,
} from '@/components/ui';
import { CELL_TYPES, PanelGrid, PanelGridLegend } from '@/components/PanelGrid';
import { api } from '@/lib/api';
import { errorMessage, useInvalidatePanels } from '@/lib/queries';
import {
  DAMAGE_TYPES,
  type DamageFlag,
  type DamageType,
  type Measured,
  type MeasureConditions,
  type PanelPassport,
  type PhotoRef,
} from '@/lib/types';
import { FlowFooter, StepFrame, StepHeader, stepPath, useDebouncedEffect } from './flow';

const SLOTS = ['front', 'back', 'junction_box', 'defect'] as const;

export function InspectStep() {
  return <StepFrame>{(panel) => <InspectForm key={panel.id} panel={panel} />}</StepFrame>;
}

const num = (s: string): number | null =>
  s.trim() === '' || Number.isNaN(Number(s)) ? null : Number(s);

function InspectForm({ panel }: { panel: PanelPassport }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidatePanels();
  const [flags, setFlags] = useState<DamageFlag[]>(panel.inspection.damageFlags);
  const [active, setActive] = useState<DamageType | null>(null);
  const [photos, setPhotos] = useState<PhotoRef[]>(
    panel.inspection.photos.filter((p) => p.slot !== 'nameplate'),
  );
  const m = panel.inspection.measured;
  const [voc, setVoc] = useState(m.vocV?.toString() ?? '');
  const [isc, setIsc] = useState(m.iscA?.toString() ?? '');
  const [pmax, setPmax] = useState(m.pmaxW?.toString() ?? '');
  const [conditions, setConditions] = useState<MeasureConditions | ''>(m.conditions ?? '');
  const [conditionsError, setConditionsError] = useState<string | null>(null);

  const measured = (): Measured => ({
    vocV: num(voc),
    iscA: num(isc),
    pmaxW: num(pmax),
    conditions: conditions || null,
  });

  useDebouncedEffect(() => {
    void api
      .saveInspection(panel.id, flags, measured())
      .then(() => invalidate(panel.id))
      .catch(() => undefined);
  }, [flags, voc, isc, pmax, conditions]);

  const flagOf = (type: DamageType) => flags.find((f) => f.type === type);

  function toggle(type: DamageType, on: boolean) {
    if (on) {
      setFlags((f) => [...f, { type, severity: 2, cells: [] }]);
      if (CELL_TYPES.includes(type)) setActive(type);
    } else {
      setFlags((f) => f.filter((x) => x.type !== type));
      if (active === type) setActive(null);
    }
  }

  function setSeverity(type: DamageType, severity: 1 | 2 | 3) {
    setFlags((f) => f.map((x) => (x.type === type ? { ...x, severity } : x)));
  }

  function onCell(row: number, col: number) {
    if (!active) return;
    setFlags((all) =>
      all.map((f) => {
        if (f.type !== active) return f;
        const has = f.cells.some((c) => c.row === row && c.col === col);
        return {
          ...f,
          cells: has
            ? f.cells.filter((c) => !(c.row === row && c.col === col))
            : [...f.cells, { row, col }],
        };
      }),
    );
  }

  async function addPhotos(files: File[]) {
    for (const file of files) {
      const slot = SLOTS.find((s) => !photos.some((p) => p.slot === s));
      if (!slot) break;
      try {
        const photo = await api.addPhoto(panel.id, slot, file);
        setPhotos((p) => [...p.filter((x) => x.slot !== slot), photo]);
      } catch (e) {
        toast.error(t('common.saveFailed'), { description: errorMessage(e, t('errors.storage')) });
      }
    }
    invalidate(panel.id);
  }

  async function removePhoto(id: string) {
    setPhotos((p) => p.filter((x) => x.id !== id));
    await api.removePhoto(panel.id, id);
    invalidate(panel.id);
  }

  async function go(target: 'next' | 'back' | 'exit') {
    if (target === 'next' && (voc || isc || pmax) && !conditions && pmax) {
      setConditionsError(t('inspect.conditionsNeeded'));
      return;
    }
    try {
      await api.saveInspection(panel.id, flags, measured());
      if (target === 'next')
        await api.patchPanel(panel.id, { stepIndex: Math.max(panel.stepIndex, 2) });
      invalidate(panel.id);
      if (target === 'exit') {
        toast.success(t('common.saved'));
        navigate('/');
      } else navigate(stepPath(panel.id, target === 'next' ? 'questions' : 'identify'));
    } catch (e) {
      toast.error(t('common.saveFailed'), { description: errorMessage(e, t('errors.generic')) });
    }
  }

  const items: UploadItem[] = photos.map((p) => ({
    id: p.id,
    name: p.name,
    previewUrl: p.url,
    slotLabel: t(`inspect.slots.${p.slot as (typeof SLOTS)[number]}`),
    status: 'done',
  }));
  const activeFlag = active ? flagOf(active) : undefined;

  return (
    <>
      <StepHeader title={t('inspect.title')} subtitle={t('inspect.subtitle')} />
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader title={t('inspect.photosTitle')} description={t('inspect.photosHint')} />
          <CardBody>
            <FileDropzone
              label={t('inspect.photosTitle')}
              items={items}
              maxFiles={4}
              onAdd={(f) => void addPhotos(f)}
              onRemove={(id) => void removePhoto(id)}
            />
            <Banner tone="info" className="mt-4">
              {t('inspect.classifyNote')}
            </Banner>
          </CardBody>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader title={t('inspect.damageTitle')} description={t('inspect.damageHint')} />
            <CardBody className="flex flex-col divide-y divide-divider">
              {DAMAGE_TYPES.map((type) => {
                const flag = flagOf(type);
                return (
                  <div key={type} className="py-1">
                    <Checkbox
                      size="lg"
                      label={t(`damage.${type}`)}
                      checked={Boolean(flag)}
                      onChange={(e) => toggle(type, e.target.checked)}
                    />
                    {flag ? (
                      <div className="mb-2 ml-7 flex flex-col gap-2">
                        <SegmentedControl
                          label={`${t(`damage.${type}`)}: ${t('damage.severity.1')} / ${t('damage.severity.3')}`}
                          value={String(flag.severity) as '1' | '2' | '3'}
                          onChange={(v) => setSeverity(type, Number(v) as 1 | 2 | 3)}
                          size="lg"
                          options={(['1', '2', '3'] as const).map((s) => ({
                            value: s,
                            label: t(`damage.severity.${s}`),
                          }))}
                        />
                        {CELL_TYPES.includes(type) ? (
                          <button
                            type="button"
                            onClick={() => setActive(active === type ? null : type)}
                            aria-pressed={active === type}
                            className="self-start rounded-btn border border-line-strong px-3 py-2 text-sm text-ink hover:bg-page aria-pressed:border-accent aria-pressed:bg-tint"
                          >
                            {active === type
                              ? t('inspect.gridFor', { type: t(`damage.${type}`) })
                              : t('inspect.gridTitle')}
                            {flag.cells.length ? ` (${flag.cells.length})` : ''}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t('inspect.gridTitle')} description={t('inspect.gridHint')} />
            <CardBody className="flex flex-col gap-3">
              <p className="text-sm text-ink-2" aria-live="polite">
                {active
                  ? t('inspect.gridFor', { type: t(`damage.${active}`) })
                  : t('inspect.gridNone')}
                {activeFlag ? ` · ${activeFlag.cells.length}` : ''}
              </p>
              <PanelGrid
                flags={flags}
                label={t('inspect.gridTitle')}
                onCellClick={active ? onCell : undefined}
              />
              <PanelGridLegend />
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader
            title={t('inspect.measuredTitle')}
            description={t('inspect.measuredHint')}
            actions={<span className="text-xs text-ink-3">{t('common.optional')}</span>}
          />
          <CardBody className="flex flex-col gap-4">
            <Banner tone="warning">{t('inspect.safety')}</Banner>
            <div className="sm:grid-cols-3 grid gap-4">
              <Input
                controlSize="lg"
                label={t('inspect.voc')}
                suffix="V"
                inputMode="decimal"
                value={voc}
                onChange={(e) => setVoc(e.target.value)}
              />
              <Input
                controlSize="lg"
                label={t('inspect.isc')}
                suffix="A"
                inputMode="decimal"
                value={isc}
                onChange={(e) => setIsc(e.target.value)}
              />
              <Input
                controlSize="lg"
                label={t('inspect.pmax')}
                suffix="W"
                inputMode="decimal"
                value={pmax}
                onChange={(e) => setPmax(e.target.value)}
              />
            </div>
            <Select
              controlSize="lg"
              label={t('inspect.conditions')}
              placeholder={t('inspect.conditionsPlaceholder')}
              value={conditions}
              onChange={(e) => {
                setConditions(e.target.value as MeasureConditions);
                setConditionsError(null);
              }}
              error={conditionsError ?? undefined}
              options={(['bright_sun', 'hazy', 'overcast'] as const).map((c) => ({
                value: c,
                label: t(`inspect.${c}`),
              }))}
              containerClassName="sm:max-w-xs"
            />
          </CardBody>
        </Card>
      </div>
      <FlowFooter
        onBack={() => void go('back')}
        onSaveExit={() => go('exit')}
        onContinue={() => go('next')}
      />
    </>
  );
}
