'use client';

import Image from 'next/image';
import { IndexedAccount } from '@/lib/account-indexing';
import { getThemeClasses } from '@/lib/theme-config';

interface ActiveAccountCardProps {
  account: IndexedAccount;
}

export default function ActiveAccountCard({ account }: ActiveAccountCardProps) {
  const theme = getThemeClasses();
  
  const handleManageClick = () => {
    // Redirect to account management page on IDP server using stable jar index
    if (typeof window !== 'undefined' && window.top) {
      const stableIndex = account.jarIndex ?? account.index;
      window.top.location.href = `${window.location.origin}/u/${stableIndex}`;
    }
  };

  const getAvatarInitial = (): string => {
    return account.name.charAt(0).toUpperCase();
  };

  return (
    <div className={`flex flex-col items-center justify-center py-8 px-6 border-b ${theme.colors.dividerBorder}`}>
      {/* Avatar */}
      <div className={`mb-4 relative w-20 h-20 ${theme.styles.avatarShadow}`}>
        {account.avatar_url ? (
          <Image
            src={account.avatar_url}
            alt={account.name}
            fill
            className={`${theme.styles.avatarBorderRadius} object-cover`}
            priority
          />
        ) : (
          <div className={`w-20 h-20 ${theme.styles.avatarBorderRadius} bg-gradient-to-br ${theme.colors.avatarGradientFrom} ${theme.colors.avatarGradientTo} flex items-center justify-center text-white text-3xl font-semibold`}>
            {getAvatarInitial()}
          </div>
        )}
      </div>

      {/* Greeting */}
      <h2 className={`text-xl font-normal ${theme.colors.headingText} mb-1`}>
        Hi, {account.name.split(' ')[0]}!
      </h2>

      {/* Email */}
      <p className={`text-sm ${theme.colors.mutedText} mb-6`}>
        {account.email}
      </p>

      {/* Manage Button */}
      <button
        onClick={handleManageClick}
        className={`px-6 py-2.5 ${theme.colors.primaryButtonBg} ${theme.colors.primaryButtonBgHover} ${theme.colors.primaryButtonText} ${theme.colors.primaryButtonBorder} text-sm font-medium ${theme.styles.buttonBorderRadius} transition-colors duration-200`}
        type="button"
      >
        Manage your Account
      </button>
    </div>
  );
}