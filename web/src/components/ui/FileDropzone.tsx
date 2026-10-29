import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { AlertCircle, ImageUp, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Button } from './Button';
import { CameraCapture } from './CameraCapture';
import { Spinner } from './Spinner';

export interface UploadItem {
  id: string;
  name: string;
  previewUrl?: string;
  /** Slot label, e.g. "Front" or "Junction box". */
  slotLabel?: string;
  status?: 'uploading' | 'done' | 'error';
  error?: string;
}

interface FileDropzoneProps {
  /** Heading for the dropzone, e.g. "Nameplate photo". */
  label: string;
  description?: string;
  items: UploadItem[];
  onAdd: (files: File[]) => void;
  onRemove?: (id: string) => void;
  maxFiles?: number;
  maxSizeMb?: number;
  accept?: string;
  allowCamera?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
}

const DEFAULT_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic';

export function FileDropzone({
  label,
  description,
  items,
  onAdd,
  onRemove,
  maxFiles = 1,
  maxSizeMb = 10,
  accept = DEFAULT_ACCEPT,
  allowCamera = true,
  disabled,
  error,
  className,
}: FileDropzoneProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const remaining = maxFiles - items.length;
  const full = remaining <= 0;

  /** Validates type, size and count, reports problems, and passes valid files on. */
  function addFiles(files: File[]) {
    const issues: string[] = [];
    const valid: File[] = [];
    for (const file of files) {
      if (!file.type.startsWith('image/'))
        issues.push(t('ui.upload.wrongType', { name: file.name }));
      else if (file.size > maxSizeMb * 1024 * 1024)
        issues.push(t('ui.upload.tooLarge', { name: file.name, size: maxSizeMb }));
      else valid.push(file);
    }
    if (valid.length > remaining) {
      issues.push(t('ui.upload.tooMany', { count: maxFiles }));
      valid.splice(remaining);
    }
    setProblems(issues);
    if (valid.length) onAdd(valid);
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files ?? []));
    event.target.value = '';
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (disabled || full) return;
    addFiles(Array.from(event.dataTransfer.files));
  }

  const allProblems = [...(error ? [error] : []), ...problems];

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        {description ? <p className="text-xs text-ink-3">{description}</p> : null}
      </div>

      {items.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {items.map((item) => (
            <li
              key={item.id}
              className="relative overflow-hidden rounded-control border border-line bg-surface"
            >
              <div className="relative aspect-[4/3] bg-page">
                {item.previewUrl ? (
                  <img
                    src={item.previewUrl}
                    alt={item.slotLabel ?? item.name}
                    className="h-full w-full object-cover"
                  />
                ) : null}
                {item.status === 'uploading' ? (
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-surface/80 text-sm text-ink-2">
                    <Spinner />
                    {t('ui.upload.uploading')}
                  </div>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                <div className="min-w-0">
                  {item.slotLabel ? (
                    <p className="truncate text-sm font-medium text-ink">{item.slotLabel}</p>
                  ) : null}
                  <p
                    className={cn(
                      'truncate text-xs',
                      item.status === 'error' ? 'text-danger-ink' : 'text-ink-3',
                    )}
                  >
                    {item.status === 'error' ? (item.error ?? t('ui.upload.failed')) : item.name}
                  </p>
                </div>
                {onRemove ? (
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    aria-label={t('ui.upload.removePhoto', { name: item.slotLabel ?? item.name })}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-btn text-ink-2 hover:bg-divider hover:text-ink"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {!full ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex flex-col items-center gap-3 rounded-card border border-dashed px-4 py-6 text-center transition-colors duration-fast',
            dragging ? 'border-accent bg-tint' : 'border-line-input bg-page',
            disabled && 'opacity-60',
          )}
        >
          <ImageUp className="h-6 w-6 text-ink-3" aria-hidden="true" />
          <div>
            <p className="hidden text-base text-ink md:block">{t('ui.upload.dragHere')}</p>
            <p className="text-xs text-ink-3">
              {t('ui.upload.limit', { count: maxFiles, size: maxSizeMb })}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {allowCamera ? (
              <CameraCapture onCapture={(file) => addFiles([file])} disabled={disabled} size="lg" />
            ) : null}
            <Button
              variant="secondary"
              size="lg"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              {t('ui.upload.browse')}
            </Button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={maxFiles > 1}
            className="sr-only"
            tabIndex={-1}
            aria-label={label}
            onChange={onInputChange}
          />
        </div>
      ) : null}

      {allProblems.length > 0 ? (
        <ul className="flex flex-col gap-1" role="alert">
          {allProblems.map((problem) => (
            <li key={problem} className="flex items-start gap-1 text-xs text-danger-ink">
              <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {problem}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
