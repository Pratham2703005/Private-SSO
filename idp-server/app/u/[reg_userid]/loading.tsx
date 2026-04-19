import { PrathamSSOLoader } from '@/components/ui/pratham-sso-loader';

/**
 * Shown as the Suspense fallback when navigating between account subroutes
 * (/u/[id]/personal-info, /u/[id]/connected-apps, etc.). The AccountLayout
 * (header + sidebar + footer) stays mounted; this only replaces <main>.
 */
export default function Loading() {
  return (
    <div className="flex-1 min-h-[60dvh] flex items-center justify-center py-20">
      <PrathamSSOLoader size={120} />
    </div>
  );
}
