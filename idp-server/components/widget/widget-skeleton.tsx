import { getThemeClasses } from '@/lib/theme-config';

export function WidgetSkeleton() {
  const theme = getThemeClasses();

  return (
    <div className={`w-full max-w-md ${theme.colors.cardBackground} ${theme.styles.cardShadow} overflow-hidden`}>
      {/* Active Account Card Skeleton */}
      <div className={`flex flex-col items-center justify-center py-8 px-6 border-b ${theme.colors.dividerBorder}`}>
        {/* Avatar Skeleton */}
        <div className={`mb-4 w-20 h-20 ${theme.styles.avatarBorderRadius} bg-gray-200 animate-pulse`} />

        {/* Name Skeleton */}
        <div className="mb-1 h-6 w-32 bg-gray-200 rounded animate-pulse" />

        {/* Email Skeleton */}
        <div className="mb-6 h-4 w-40 bg-gray-200 rounded animate-pulse" />

        {/* Button Skeleton */}
        <div className="h-10 w-48 bg-gray-300 rounded-lg animate-pulse" />
      </div>

      {/* Other Accounts Section Skeleton */}
      <div className={`border-b ${theme.colors.dividerBorder}`}>
        <div className={`px-6 py-3 flex items-center justify-between ${theme.colors.collapsibleHover} bg-gray-50`}>
          <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
        </div>

        {/* Multiple account rows skeleton */}
        {[1, 2].map((i) => (
          <div
            key={i}
            className={`px-6 py-3.5 flex items-center gap-3 border-t ${theme.colors.dividerBorder}`}
          >
            <div className="w-10 h-10 bg-gray-200 rounded-full shrink-0 animate-pulse" />
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 w-32 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>

      {/* Actions Section Skeleton */}
      <div className="px-6 py-4 space-y-1">
        <div className="h-10 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-10 bg-gray-200 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}
