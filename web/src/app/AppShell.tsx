import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  BarChart3,
  ChevronsLeft,
  ChevronsRight,
  LayoutDashboard,
  Menu,
  Network,
  Settings as SettingsIcon,
  SunMedium,
  X,
  type LucideIcon,
} from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { useSettings } from '@/lib/queries';
import { Banner, SourceTag } from '@/components/ui';
import { api } from '@/lib/api';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Logo } from './Logo';
import { useOnline } from './useOnline';

const NAV: { to: string; key: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/', key: 'nav.overview', icon: LayoutDashboard, end: true },
  { to: '/panels', key: 'nav.panels', icon: SunMedium },
  { to: '/composer', key: 'nav.composer', icon: Network },
  { to: '/impact', key: 'nav.impact', icon: BarChart3 },
  { to: '/settings', key: 'nav.settings', icon: SettingsIcon },
];

function NavList({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('nav.main')} className="flex flex-col gap-0.5 px-3">
      {NAV.map(({ to, key, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          title={collapsed ? t(key) : undefined}
          className={({ isActive }) =>
            cn(
              'flex h-10 items-center gap-3 rounded-btn px-3 text-base transition-colors duration-fast',
              collapsed && 'justify-center px-0',
              isActive
                ? 'bg-navy-hover font-medium text-white'
                : 'text-navy-muted hover:bg-navy-hover hover:text-white',
            )
          }
        >
          <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
          <span className={cn(collapsed && 'sr-only')}>{t(key)}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function AppShell() {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('secondsun.sidebar') === 'collapsed';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: settings } = useSettings();
  const online = useOnline();
  const location = useLocation();

  useEffect(() => setMobileOpen(false), [location.pathname]);
  useEffect(() => {
    try {
      localStorage.setItem('secondsun.sidebar', collapsed ? 'collapsed' : 'open');
    } catch {
      // Preference just won't persist.
    }
  }, [collapsed]);

  return (
    <div className="min-h-screen bg-page">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-btn focus:bg-surface focus:px-3 focus:py-2 focus:text-primary"
      >
        {t('nav.skip')}
      </a>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col bg-navy transition-[width] duration-slow lg:flex',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        <div className={cn('flex h-14 items-center', collapsed ? 'justify-center' : 'px-5')}>
          {collapsed ? <Logo className="[&>span:last-child]:sr-only" /> : <Logo />}
        </div>
        <div className="mt-2 flex-1">
          <NavList collapsed={collapsed} />
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={t(collapsed ? 'nav.expand' : 'nav.collapse')}
          className="m-3 flex h-10 items-center justify-center gap-2 rounded-btn text-navy-muted hover:bg-navy-hover hover:text-white"
        >
          {collapsed ? (
            <ChevronsRight className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
          )}
          <span className={cn('text-sm', collapsed && 'sr-only')}>{t('nav.collapse')}</span>
        </button>
      </aside>

      {/* Mobile and tablet sidebar */}
      <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-navy/40 data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in lg:hidden" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-navy lg:hidden"
          >
            <Dialog.Title className="sr-only">{t('nav.main')}</Dialog.Title>
            <div className="flex h-14 items-center justify-between px-5">
              <Logo />
              <Dialog.Close
                aria-label={t('ui.close')}
                className="rounded-btn p-1.5 text-navy-muted hover:bg-navy-hover hover:text-white"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </Dialog.Close>
            </div>
            <div className="mt-2">
              <NavList collapsed={false} onNavigate={() => setMobileOpen(false)} />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div
        className={cn('transition-[padding] duration-slow', collapsed ? 'lg:pl-16' : 'lg:pl-60')}
      >
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-line bg-surface px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label={t('nav.openMenu')}
              className="-ml-2 inline-flex h-10 w-10 items-center justify-center rounded-btn text-ink-2 hover:bg-divider lg:hidden"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <p className="truncate text-base text-ink-2">
              <span className="text-ink-3">{t('shell.site')}: </span>
              <span className="font-medium text-ink">{settings?.siteName ?? '…'}</span>
            </p>
            {api.mode === 'demo' ? (
              <SourceTag
                kind="simulated"
                label={t('shell.demoBadge')}
                source={t('shell.demoHelp')}
                className="hidden md:inline-flex"
              />
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <p className="hidden text-base text-ink-2 md:block" aria-label={t('shell.userMenu')}>
              {t('shell.user')}
            </p>
          </div>
        </header>

        {!online ? (
          <Banner tone="warning" className="m-4 md:mx-6" live>
            {t('shell.offline')}
          </Banner>
        ) : null}
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1280px] px-4 py-6 outline-none md:px-6 md:py-8"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
