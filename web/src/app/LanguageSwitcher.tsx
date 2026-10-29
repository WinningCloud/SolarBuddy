import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, type LanguageCode } from '@/i18n';
import { cn } from '@/lib/cn';

/** Compact language picker: a native select, so it works everywhere including phones. */
export function LanguageSwitcher({ className, onDark }: { className?: string; onDark?: boolean }) {
  const { t, i18n } = useTranslation();
  return (
    <label className={cn('relative inline-flex items-center', className)}>
      <span className="sr-only">{t('ui.language')}</span>
      <Languages
        className={cn(
          'pointer-events-none absolute left-2.5 h-4 w-4',
          onDark ? 'text-navy-muted' : 'text-ink-3',
        )}
        aria-hidden="true"
      />
      <select
        value={i18n.language}
        onChange={(e) => void i18n.changeLanguage(e.target.value as LanguageCode)}
        className={cn(
          'h-9 cursor-pointer appearance-none rounded-btn border pl-8 pr-3 text-base',
          onDark
            ? 'border-navy-hover bg-navy text-white'
            : 'border-line-strong bg-surface text-ink hover:bg-page',
        )}
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} lang={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
