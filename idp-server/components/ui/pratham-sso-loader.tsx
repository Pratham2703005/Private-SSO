import { cn } from '@/lib/utils';

interface PrathamSSOLoaderProps {
  size?: number;
  label?: string;
  className?: string;
}

/**
 * Branded spinner — a rotating ring around a stationary "Pratham's SSO"
 * wordmark. Used as the loading.tsx fallback for route transitions and as
 * the widget's account-switching overlay.
 */
export function PrathamSSOLoader({
  size = 120,
  label,
  className,
}: PrathamSSOLoaderProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-4', className)}
      role="status"
      aria-label={label || 'Loading'}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <div
          className="absolute inset-0 rounded-full border-[3px] border-gray-200 border-t-blue-600 animate-spin"
          style={{ animationDuration: '900ms' }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none pointer-events-none select-none">
          <span
            className="font-semibold text-gray-900"
            style={{ fontSize: size * 0.14 }}
          >
            Pratham&apos;s
          </span>
          <span
            className="font-medium text-gray-500 tracking-wide mt-0.5"
            style={{ fontSize: size * 0.11 }}
          >
            SSO
          </span>
        </div>
      </div>
      {label && (
        <p className="text-sm text-gray-500 font-medium">{label}</p>
      )}
    </div>
  );
}
