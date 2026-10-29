import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, ErrorState, Skeleton } from '@/components/ui';
import { LanguageSwitcher } from '@/app/LanguageSwitcher';
import { Logo } from '@/app/Logo';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/queries';
import { PassportView } from '@/features/passport/PassportView';

/** Read-only, no login, works on a phone. */
export function PublicPassportPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['public', id],
    queryFn: () => api.getPublicPassport(id),
    retry: false,
  });
  return (
    <div className="min-h-screen bg-page">
      <header className="print-hide border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[960px] items-center justify-between gap-3 px-4 py-3">
          <Logo onDark={false} />
          <div className="flex items-center gap-3">
            <span className="sm:inline hidden text-sm text-ink-3">{t('publicPage.readOnly')}</span>
            <LanguageSwitcher />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-[960px] px-4 py-6 md:py-8">
        {isLoading ? (
          <div className="flex flex-col gap-4" role="status" aria-label={t('ui.loading')}>
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : isError || !data ? (
          <Card>
            <ErrorState
              title={t('common.notFound')}
              description={errorMessage(error, t('publicPage.notFound'))}
              onRetry={() => void refetch()}
              retrying={isFetching}
            />
          </Card>
        ) : (
          <PassportView panel={data} />
        )}
      </main>
    </div>
  );
}
