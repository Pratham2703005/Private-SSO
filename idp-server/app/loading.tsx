import { PrathamSSOLoader } from '@/components/ui/pratham-sso-loader';

export default function Loading() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-white">
      <PrathamSSOLoader size={140} />
    </div>
  );
}
