import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Banner,
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  Input,
  SegmentedControl,
  Skeleton,
  SourceTag,
  TabPanel,
  Tabs,
  toast,
} from '@/components/ui';
import { api } from '@/lib/api';
import { LANGUAGES, type LanguageCode } from '@/i18n';
import { errorMessage, useInvalidatePanels, useSettings } from '@/lib/queries';
import { MATERIALS, type AppSettings, type RepairId } from '@/lib/types';
import { defaultSettings, REPAIR_IDS } from '@/lib/demo/economics';

const defaults = api.defaultsTable;

function Tag({ status, source }: { status: string; source: string }) {
  return <SourceTag kind={status === 'sourced' ? 'sourced' : 'assumption'} source={source} />;
}

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const invalidate = useInvalidatePanels();
  const { data, isLoading, isError, error, refetch, isFetching } = useSettings();
  const [s, setS] = useState<AppSettings | null>(null);
  const [tab, setTab] = useState('general');

  useEffect(() => {
    if (data && !s) setS(data);
  }, [data, s]);

  const save = useMutation({
    mutationFn: (v: AppSettings) => api.putSettings(v),
    onSuccess: () => {
      invalidate();
      toast.success(t('settings.saved'));
    },
    onError: (e) =>
      toast.error(t('common.saveFailed'), { description: errorMessage(e, t('errors.generic')) }),
  });
  const clear = useMutation({
    mutationFn: () => api.clearDemoData(),
    onSuccess: () => {
      invalidate();
      toast.success(t('panels.deleted'));
    },
  });
  const reload = useMutation({
    mutationFn: () => api.loadDemoData(),
    onSuccess: () => {
      invalidate();
      toast.success(t('overview.demoLoaded'));
    },
  });

  if (isError)
    return (
      <Card>
        <ErrorState
          title={t('common.loadFailed')}
          description={errorMessage(error, t('errors.generic'))}
          onRetry={() => void refetch()}
          retrying={isFetching}
        />
      </Card>
    );
  if (isLoading || !s)
    return (
      <div className="flex flex-col gap-4" role="status" aria-label={t('ui.loading')}>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );

  const num = (v: string) => (v.trim() === '' || Number.isNaN(Number(v)) ? 0 : Number(v));
  const setA = (k: keyof AppSettings['assumptions'], v: string) =>
    setS({ ...s, assumptions: { ...s.assumptions, [k]: num(v) } });
  const e = defaults.energy;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl">{t('settings.title')}</h1>
          <p className="mt-1 text-base text-ink-2">{t('settings.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setS(defaultSettings())}>
            {t('settings.resetDefaults')}
          </Button>
          <Button
            onClick={() => save.mutate(s)}
            loading={save.isPending}
            loadingLabel={t('common.saving')}
          >
            {t('common.save')}
          </Button>
        </div>
      </div>

      <Tabs
        label={t('settings.title')}
        value={tab}
        onValueChange={setTab}
        items={(['general', 'energy', 'repair', 'materials', 'array', 'integrations'] as const).map(
          (k) => ({ value: k, label: t(`settings.tabs.${k}`) }),
        )}
      >
        <TabPanel value="general">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardBody className="flex flex-col gap-4">
                <div>
                  <p className="mb-1.5 text-sm font-medium">{t('settings.language')}</p>
                  <SegmentedControl
                    label={t('settings.language')}
                    value={i18n.language as LanguageCode}
                    onChange={(l) => void i18n.changeLanguage(l)}
                    options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium">{t('settings.units')}</p>
                  <p className="text-base text-ink-2">{t('settings.unitsValue')}</p>
                </div>
                <Input
                  label={t('settings.siteName')}
                  value={s.siteName}
                  onChange={(ev) => setS({ ...s, siteName: ev.target.value })}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label={t('settings.latitude')}
                    type="number"
                    value={s.latitudeDeg}
                    onChange={(ev) => setS({ ...s, latitudeDeg: num(ev.target.value) })}
                  />
                  <Input
                    label={t('settings.longitude')}
                    type="number"
                    value={s.longitudeDeg}
                    onChange={(ev) => setS({ ...s, longitudeDeg: num(ev.target.value) })}
                  />
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardHeader title={t('settings.demoData')} description={t('settings.demoDataHint')} />
              <CardBody className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => clear.mutate()}
                  loading={clear.isPending}
                >
                  {t('settings.clearDemo')}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => reload.mutate()}
                  loading={reload.isPending}
                >
                  {t('settings.reloadDemo')}
                </Button>
              </CardBody>
            </Card>
          </div>
        </TabPanel>

        <TabPanel value="energy">
          <Card>
            <CardBody className="sm:grid-cols-2 grid gap-4">
              <Input
                label={t('settings.tariff')}
                type="number"
                step="any"
                value={s.assumptions.tariffInrPerKwh}
                onChange={(ev) => setA('tariffInrPerKwh', ev.target.value)}
                tag={<Tag status={e.tariffInrPerKwh.status} source={e.tariffInrPerKwh.source} />}
              />
              <Input
                label={t('settings.sunHours')}
                type="number"
                step="any"
                value={s.assumptions.peakSunHoursPerDay}
                onChange={(ev) => setA('peakSunHoursPerDay', ev.target.value)}
                tag={
                  <Tag status={e.peakSunHoursPerDay.status} source={e.peakSunHoursPerDay.source} />
                }
              />
              <Input
                label={t('settings.life')}
                type="number"
                value={s.assumptions.remainingLifeYears}
                onChange={(ev) => setA('remainingLifeYears', ev.target.value)}
                tag={
                  <Tag status={e.remainingLifeYears.status} source={e.remainingLifeYears.source} />
                }
              />
              <Input
                label={t('settings.degradation')}
                type="number"
                step="0.001"
                value={s.assumptions.annualDegradation}
                onChange={(ev) => setA('annualDegradation', ev.target.value)}
                tag={
                  <Tag status={e.annualDegradation.status} source={e.annualDegradation.source} />
                }
              />
            </CardBody>
          </Card>
        </TabPanel>

        <TabPanel value="repair">
          <Card>
            <CardHeader title={t('settings.repairTable')} />
            <CardBody className="flex flex-col gap-4">
              {REPAIR_IDS.map((id: RepairId) => (
                <div key={id} className="sm:grid-cols-[1fr_140px_140px] grid items-end gap-3">
                  <div className="flex items-center gap-2 text-base font-medium">
                    {t(`repairs.${id}`)}{' '}
                    <Tag
                      status={defaults.repairCostsInr[id].status}
                      source={defaults.repairCostsInr[id].source}
                    />
                  </div>
                  <Input
                    label={`${t(`repairs.${id}`)} ${t('settings.low')}`}
                    hideLabel
                    prefix="₹"
                    type="number"
                    value={s.repairCostsInr[id].low}
                    onChange={(ev) =>
                      setS({
                        ...s,
                        repairCostsInr: {
                          ...s.repairCostsInr,
                          [id]: { ...s.repairCostsInr[id], low: num(ev.target.value) },
                        },
                      })
                    }
                  />
                  <Input
                    label={`${t(`repairs.${id}`)} ${t('settings.high')}`}
                    hideLabel
                    prefix="₹"
                    type="number"
                    value={s.repairCostsInr[id].high}
                    onChange={(ev) =>
                      setS({
                        ...s,
                        repairCostsInr: {
                          ...s.repairCostsInr,
                          [id]: { ...s.repairCostsInr[id], high: num(ev.target.value) },
                        },
                      })
                    }
                  />
                </div>
              ))}
            </CardBody>
          </Card>
        </TabPanel>

        <TabPanel value="materials">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title={t('settings.materialPrices')} />
              <CardBody className="flex flex-col gap-3">
                {MATERIALS.map((m) => (
                  <Input
                    key={m}
                    label={t(`materials.${m}`)}
                    prefix="₹"
                    type="number"
                    value={s.materialPricesInrPerKg[m]}
                    onChange={(ev) =>
                      setS({
                        ...s,
                        materialPricesInrPerKg: {
                          ...s.materialPricesInrPerKg,
                          [m]: num(ev.target.value),
                        },
                      })
                    }
                    tag={
                      <Tag
                        status={defaults.materialPricesInrPerKg[m].status}
                        source={defaults.materialPricesInrPerKg[m].source}
                      />
                    }
                  />
                ))}
              </CardBody>
            </Card>
            <Card>
              <CardHeader
                title={t('settings.recoveryRates')}
                actions={<Tag status="assumption" source={defaults.recoverySource} />}
              />
              <CardBody className="flex flex-col gap-3">
                {MATERIALS.map((m) => (
                  <div key={m} className="grid grid-cols-2 gap-3">
                    <Input
                      label={`${t(`materials.${m}`)} ${t('settings.low')}`}
                      type="number"
                      step="0.01"
                      value={s.recoveryRate[m].low}
                      onChange={(ev) =>
                        setS({
                          ...s,
                          recoveryRate: {
                            ...s.recoveryRate,
                            [m]: { ...s.recoveryRate[m], low: num(ev.target.value) },
                          },
                        })
                      }
                    />
                    <Input
                      label={`${t(`materials.${m}`)} ${t('settings.high')}`}
                      type="number"
                      step="0.01"
                      value={s.recoveryRate[m].high}
                      onChange={(ev) =>
                        setS({
                          ...s,
                          recoveryRate: {
                            ...s.recoveryRate,
                            [m]: { ...s.recoveryRate[m], high: num(ev.target.value) },
                          },
                        })
                      }
                    />
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>
        </TabPanel>

        <TabPanel value="array">
          <Card>
            <CardBody className="sm:grid-cols-2 grid gap-4">
              <Input
                label={t('settings.converterEfficiency')}
                type="number"
                step="0.01"
                value={s.converterEfficiency}
                onChange={(ev) => setS({ ...s, converterEfficiency: num(ev.target.value) })}
                tag={
                  <Tag status="assumption" source="Assumption: typical DC optimiser efficiency." />
                }
              />
              <Input
                label={t('settings.relayRds')}
                type="number"
                step="0.01"
                value={s.relayRdsOnOhm}
                onChange={(ev) => setS({ ...s, relayRdsOnOhm: num(ev.target.value) })}
                tag={<Tag status="assumption" source="Assumption" />}
              />
              <Input
                label={t('settings.optimiserCost')}
                prefix="₹"
                type="number"
                value={s.optimiserCostInrPerPanel}
                onChange={(ev) => setS({ ...s, optimiserCostInrPerPanel: num(ev.target.value) })}
                tag={<Tag status="assumption" source="Assumption" />}
              />
              <Input
                label={t('settings.relayCost')}
                prefix="₹"
                type="number"
                value={s.relayCostInrPerPanel}
                onChange={(ev) => setS({ ...s, relayCostInrPerPanel: num(ev.target.value) })}
                tag={<Tag status="assumption" source="Assumption" />}
              />
            </CardBody>
          </Card>
        </TabPanel>

        <TabPanel value="integrations">
          <Card>
            <CardHeader
              title={t('settings.integrationsTitle')}
              description={t('settings.integrationsHint')}
            />
            <CardBody className="overflow-x-auto px-0 md:px-0">
              <table className="w-full text-base">
                <caption className="sr-only">{t('settings.integrationsTitle')}</caption>
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-2">
                    <th scope="col" className="px-5 py-2 font-medium">
                      {t('settings.integration.name')}
                    </th>
                    <th scope="col" className="px-5 py-2 font-medium">
                      {t('settings.integration.state')}
                    </th>
                    <th scope="col" className="px-5 py-2 font-medium">
                      {t('settings.integration.note')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(['sim', 'llm', 'voice'] as const).map((k) => (
                    <tr key={k} className="border-b border-divider">
                      <th scope="row" className="px-5 py-2.5 text-left font-medium">
                        {t(`settings.integrationRows.${k}.name`)}
                      </th>
                      <td className="px-5 py-2.5">{t(`settings.integrationRows.${k}.state`)}</td>
                      <td className="px-5 py-2.5 text-ink-2">
                        {t(`settings.integrationRows.${k}.note`)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>
          <Banner tone="info" className="mt-4">
            {t('shell.demoHelp')}
          </Banner>
        </TabPanel>
      </Tabs>
    </>
  );
}
