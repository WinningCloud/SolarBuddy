import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardBody,
  CardHeader,
  DecisionPill,
  KeyValueList,
  SourceTag,
  StatusPill,
} from '@/components/ui';
import {
  formatDate,
  formatInrRange,
  formatPercent,
  formatUnit,
  formatUnitRange,
} from '@/design/format';
import { decisionOf } from '@/lib/api';
import { MATERIALS, type PanelPassport } from '@/lib/types';
import { explainReasons } from '@/features/assess/DecisionStep';

export const publicUrl = (id: string) => `${window.location.origin}/p/${id}`;

const tone = { draft: 'neutral', assessed: 'info', in_pool: 'success', closed: 'neutral' } as const;

/** The one-page record. Used in the flow (step 6), the Panels detail and the public page. */
export function PassportView({ panel }: { panel: PanelPassport }) {
  const { t } = useTranslation();
  const np = panel.nameplate;
  const twin = panel.twin;
  const decision = panel.decision;
  const kind = decisionOf(panel);
  const option = decision && kind ? decision.options[kind] : null;
  const photos = panel.inspection.photos;
  const src = (field: keyof typeof np.fieldSource) => {
    const s = np.fieldSource[field];
    return s === 'extracted' ? (
      <SourceTag kind="extracted" />
    ) : s === 'manual' ? (
      <SourceTag kind="entered" />
    ) : undefined;
  };

  return (
    <div className="print-sheet flex flex-col gap-4">
      <Card>
        <CardBody className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="section-label">{t('passport.title')}</p>
            <h1 className="mt-1 text-xl md:text-2xl">{panel.id}</h1>
            <p className="mt-0.5 text-base text-ink-2">
              {np.manufacturer} {np.model}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusPill tone={tone[panel.status]}>{t(`status.${panel.status}`)}</StatusPill>
              {kind ? <DecisionPill decision={kind} /> : null}
              {panel.isDemo ? (
                <SourceTag
                  kind="simulated"
                  label={t('shell.demoBadge')}
                  source={t('shell.demoHelp')}
                />
              ) : null}
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="rounded-control border border-line bg-white p-2">
              <QRCodeSVG value={publicUrl(panel.id)} size={96} level="M" title={t('passport.qr')} />
            </div>
            <p className="max-w-[120px] text-center text-xs text-ink-3">{t('passport.qr')}</p>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title={t('passport.identity')} titleAs="h2" />
          <CardBody>
            <KeyValueList
              items={[
                {
                  label: t('identify.fields.manufacturer'),
                  value: np.manufacturer || '—',
                  tag: src('manufacturer'),
                },
                { label: t('identify.fields.model'), value: np.model || '—', tag: src('model') },
                {
                  label: t('identify.fields.pmaxW'),
                  value: formatUnit(np.pmaxW, 'W', 0),
                  tag: src('pmaxW'),
                },
                {
                  label: t('identify.fields.vocV'),
                  value: formatUnit(np.vocV, 'V'),
                  tag: src('vocV'),
                },
                {
                  label: t('identify.fields.iscA'),
                  value: formatUnit(np.iscA, 'A'),
                  tag: src('iscA'),
                },
                {
                  label: t('identify.fields.vmppV'),
                  value: formatUnit(np.vmppV, 'V'),
                  tag: src('vmppV'),
                },
                {
                  label: t('identify.fields.imppA'),
                  value: formatUnit(np.imppA, 'A'),
                  tag: src('imppA'),
                },
                { label: t('identify.fields.yearManufactured'), value: np.yearManufactured ?? '—' },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('passport.photos')} titleAs="h2" />
          <CardBody>
            {photos.length === 0 ? (
              <p className="text-sm text-ink-3">—</p>
            ) : (
              <ul className="grid grid-cols-2 gap-2">
                {photos.map((p) => (
                  <li key={p.id} className="overflow-hidden rounded-control border border-line">
                    <img
                      src={p.url}
                      alt={t(`inspect.slots.${p.slot === 'nameplate' ? 'front' : p.slot}`)}
                      className="aspect-[4/3] w-full object-cover"
                    />
                    <p className="px-2 py-1 text-xs text-ink-2">
                      {p.slot === 'nameplate'
                        ? t('identify.photoLabel')
                        : t(`inspect.slots.${p.slot}`)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader
            title={t('passport.diagnosis')}
            titleAs="h2"
            actions={
              twin ? <SourceTag kind="simulated" source={t('sourceNotes.demoEngine')} /> : undefined
            }
          />
          <CardBody className="flex flex-col gap-4">
            {twin ? (
              <KeyValueList
                items={[
                  {
                    label: t('diagnosis.rows.pmax'),
                    value: formatUnitRange(
                      twin.now.pmaxRangeW.low,
                      twin.now.pmaxRangeW.high,
                      'W',
                      0,
                    ),
                  },
                  {
                    label: t('diagnosis.rows.fraction'),
                    value: `${formatPercent(twin.now.fractionOfRated.low)}–${formatPercent(twin.now.fractionOfRated.high)}`,
                  },
                  { label: t('diagnosis.rows.vmpp'), value: formatUnit(twin.now.point.vmppV, 'V') },
                  { label: t('diagnosis.rows.impp'), value: formatUnit(twin.now.point.imppA, 'A') },
                  {
                    label: t('diagnosis.rows.series'),
                    value: formatUnit(twin.now.seriesResistanceOhm, 'Ω'),
                  },
                ]}
              />
            ) : (
              <p className="text-sm text-ink-3">{t('common.unavailable')}</p>
            )}
            <div>
              <p className="section-label mb-1">{t('passport.damage')}</p>
              {panel.inspection.damageFlags.length === 0 ? (
                <p className="text-sm text-ink-3">{t('passport.noDamage')}</p>
              ) : (
                <ul className="flex flex-wrap gap-1.5 text-sm">
                  {panel.inspection.damageFlags.map((f) => (
                    <li key={f.type} className="rounded-chip bg-divider px-2 py-0.5 text-ink-2">
                      {t(`damage.${f.type}`)}, {t(`damage.severity.${f.severity}`)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('passport.decisionTitle')} titleAs="h2" />
          <CardBody className="flex flex-col gap-3">
            {decision && kind && option ? (
              <>
                <p className="text-base text-ink-2">
                  {explainReasons(t as never, decision.reasons)}
                </p>
                <KeyValueList
                  items={[
                    {
                      label: t('decision.recommendation'),
                      value: <DecisionPill decision={decision.recommended} />,
                    },
                    { label: t('decision.title'), value: <DecisionPill decision={kind} /> },
                    {
                      label: t('ui.confidence.expected'),
                      value: `${formatPercent(decision.confidence.low)}–${formatPercent(decision.confidence.high)}`,
                      tag: <SourceTag kind="simulated" source={t('sourceNotes.triage')} />,
                    },
                    {
                      label: t('passport.value'),
                      value: formatInrRange(option.netValueInr.low, option.netValueInr.high),
                      tag: <SourceTag kind="assumption" source={t('sourceNotes.economics')} />,
                    },
                    {
                      label: t('passport.energy'),
                      value: formatUnitRange(option.energyKwh.low, option.energyKwh.high, 'kWh', 0),
                      tag: <SourceTag kind="simulated" source={t('sourceNotes.economics')} />,
                    },
                  ]}
                />
                {decision.chosen ? (
                  <p className="text-sm text-ink-2">
                    {t('decision.decidedBy', { who: decision.decidedBy ?? '—' })}
                    {decision.decidedAt ? `, ${formatDate(decision.decidedAt)}` : ''}
                    {decision.reasonIfOverridden
                      ? `. ${t('decision.overriddenNote', { reason: decision.reasonIfOverridden })}`
                      : ''}
                  </p>
                ) : (
                  <p className="text-sm text-ink-3">{t('passport.notDecided')}</p>
                )}
                {kind === 'recycle' ? (
                  <div>
                    <p className="section-label mb-1">{t('passport.materials')}</p>
                    <ul className="grid grid-cols-2 gap-x-4 text-sm">
                      {MATERIALS.map((m) => (
                        <li
                          key={m}
                          className="flex justify-between gap-2 border-b border-divider py-1"
                        >
                          <span className="text-ink-2">{t(`materials.${m}`)}</span>
                          <span>
                            {formatUnitRange(
                              option.materialsKg[m].low,
                              option.materialsKg[m].high,
                              'kg',
                              m === 'silver' ? 2 : 1,
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-ink-3">{t('passport.notDecided')}</p>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title={t('passport.provenance')} titleAs="h2" />
        <CardBody className="flex flex-wrap gap-2">
          <SourceTag kind="extracted" source={t('identify.confidenceDetail', { percent: 90 })} />
          <SourceTag kind="entered" source={t('identify.enteredDetail')} />
          <SourceTag kind="simulated" source={t('sourceNotes.demoEngine')} />
          <SourceTag kind="assumption" source={t('sourceNotes.economics')} />
          <p className="w-full text-xs text-ink-3">
            {t('passport.generated', { date: formatDate(panel.updatedAt) })}
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
