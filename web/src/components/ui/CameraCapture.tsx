import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Camera, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Banner } from './Banner';
import { Button, type ButtonSize, type ButtonVariant } from './Button';
import { Modal } from './Modal';
import { Spinner } from './Spinner';

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  disabled?: boolean;
  /** Base name for the produced file, e.g. "nameplate". */
  fileName?: string;
}

type CameraStatus = 'starting' | 'live' | 'captured' | 'denied' | 'unavailable';

function prefersNativeCamera(): boolean {
  if (typeof window === 'undefined') return true;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  return coarse || !navigator.mediaDevices?.getUserMedia;
}

/**
 * On phones and tablets this opens the device camera directly (file input with capture).
 * On desktops with a webcam it shows a live preview in a modal. Either path yields a File.
 */
export function CameraCapture({
  onCapture,
  label,
  variant = 'secondary',
  size = 'md',
  block,
  disabled,
  fileName = 'photo',
}: CameraCaptureProps) {
  const { t } = useTranslation();
  const nativeInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<CameraStatus>('starting');
  const [captured, setCaptured] = useState<{ blob: Blob; url: string } | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStatus('starting');
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => undefined);
        }
        setStatus('live');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const name = error instanceof DOMException ? error.name : '';
        setStatus(
          name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable',
        );
      });
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [open, stopStream]);

  useEffect(() => {
    return () => {
      if (captured) URL.revokeObjectURL(captured.url);
    };
  }, [captured]);

  function close() {
    stopStream();
    setCaptured(null);
    setOpen(false);
  }

  function start() {
    if (prefersNativeCamera()) nativeInputRef.current?.click();
    else setOpen(true);
  }

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setCaptured({ blob, url: URL.createObjectURL(blob) });
        setStatus('captured');
      },
      'image/jpeg',
      0.9,
    );
  }

  function usePhoto() {
    if (!captured) return;
    onCapture(new File([captured.blob], `${fileName}-${Date.now()}.jpg`, { type: 'image/jpeg' }));
    close();
  }

  function onFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) {
      onCapture(file);
      close();
    }
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        block={block}
        disabled={disabled}
        onClick={start}
        leadingIcon={<Camera className="h-4 w-4" aria-hidden="true" />}
      >
        {label ?? t('ui.upload.takePhoto')}
      </Button>
      <input
        ref={nativeInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={onFileChosen}
      />
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={onFileChosen}
      />
      <Modal
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
        title={t('ui.camera.title')}
        size="lg"
        footer={
          status === 'captured' ? (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setCaptured(null);
                  setStatus('live');
                }}
                leadingIcon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}
              >
                {t('ui.camera.retake')}
              </Button>
              <Button onClick={usePhoto}>{t('ui.camera.usePhoto')}</Button>
            </>
          ) : status === 'live' || status === 'starting' ? (
            <Button onClick={capture} disabled={status !== 'live'}>
              {t('ui.camera.capture')}
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => uploadInputRef.current?.click()}>
              {t('ui.camera.uploadInstead')}
            </Button>
          )
        }
      >
        {status === 'denied' || status === 'unavailable' ? (
          <Banner tone="warning">
            {t(status === 'denied' ? 'ui.camera.denied' : 'ui.camera.unavailable')}
          </Banner>
        ) : (
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-control bg-navy">
            <video
              ref={videoRef}
              className={status === 'captured' ? 'hidden' : 'h-full w-full object-cover'}
              playsInline
              muted
            />
            {captured ? (
              <img src={captured.url} alt="" className="h-full w-full object-cover" />
            ) : null}
            {status === 'starting' ? (
              <div className="absolute inset-0 flex items-center justify-center gap-2 text-white">
                <Spinner />
                <span>{t('ui.camera.starting')}</span>
              </div>
            ) : null}
          </div>
        )}
      </Modal>
    </>
  );
}
