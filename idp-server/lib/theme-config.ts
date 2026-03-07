/**
 * Theme Configuration
 * Centralized theme management for the account switcher widget
 * Change the active theme by updating the ACTIVE_THEME constant
 */

export interface WidgetTheme {
  name: string;
  colors: {
    // Background colors
    pageBackground: string;
    cardBackground: string;
    
    // Avatar colors
    avatarGradientFrom: string;
    avatarGradientTo: string;
    
    // Primary action button
    primaryButtonBg: string;
    primaryButtonBgHover: string;
    primaryButtonText: string;
    primaryButtonBorder: string;
    
    // Text colors
    headingText: string;
    bodyText: string;
    mutedText: string;
    
    // Interactive elements
    hoverBackground: string;
    collapsibleHover: string;
    
    // Borders
    dividerBorder: string;
    
    // Action buttons
    addAccountIcon: string;
    signoutIcon: string;
    signoutText: string;
    signoutHover: string;
  };
  
  styles: {
    // Border radius
    cardBorderRadius: string;
    buttonBorderRadius: string;
    avatarBorderRadius: string;
    
    // Shadows
    cardShadow: string;
    avatarShadow: string;
    
    // Spacing
    cardPadding: string;
    sectionSpacing: string;
  };
}

// 1. Google Classic Theme (Light Blue)
const googleClassicTheme: WidgetTheme = {
  name: 'Google Classic',
  colors: {
    pageBackground: 'bg-[#e8f0fe]',
    cardBackground: 'bg-white',
    avatarGradientFrom: 'from-pink-400',
    avatarGradientTo: 'to-pink-600',
    primaryButtonBg: 'bg-white',
    primaryButtonBgHover: 'hover:bg-gray-50',
    primaryButtonText: 'text-blue-600',
    primaryButtonBorder: 'border-2 border-gray-300',
    headingText: 'text-gray-900',
    bodyText: 'text-gray-700',
    mutedText: 'text-gray-600',
    hoverBackground: 'hover:bg-gray-50',
    collapsibleHover: 'hover:bg-gray-50',
    dividerBorder: 'border-gray-200',
    addAccountIcon: 'text-blue-600',
    signoutIcon: 'text-gray-700',
    signoutText: 'text-gray-700',
    signoutHover: 'hover:bg-gray-50',
  },
  styles: {
    cardBorderRadius: 'rounded-3xl',
    buttonBorderRadius: 'rounded-full',
    avatarBorderRadius: 'rounded-full',
    cardShadow: 'shadow-xl',
    avatarShadow: 'shadow-md',
    cardPadding: 'p-6',
    sectionSpacing: 'space-y-4',
  },
};

// 2. Modern Minimal Theme (Clean White)
const modernMinimalTheme: WidgetTheme = {
  name: 'Modern Minimal',
  colors: {
    pageBackground: 'bg-gray-50',
    cardBackground: 'bg-white',
    avatarGradientFrom: 'from-indigo-400',
    avatarGradientTo: 'to-indigo-600',
    primaryButtonBg: 'bg-white',
    primaryButtonBgHover: 'hover:bg-gray-50',
    primaryButtonText: 'text-indigo-600',
    primaryButtonBorder: 'border-2 border-gray-200',
    headingText: 'text-gray-900',
    bodyText: 'text-gray-700',
    mutedText: 'text-gray-500',
    hoverBackground: 'hover:bg-gray-50',
    collapsibleHover: 'hover:bg-gray-50',
    dividerBorder: 'border-gray-100',
    addAccountIcon: 'text-indigo-600',
    signoutIcon: 'text-gray-600',
    signoutText: 'text-gray-700',
    signoutHover: 'hover:bg-gray-50',
  },
  styles: {
    cardBorderRadius: 'rounded-2xl',
    buttonBorderRadius: 'rounded-full',
    avatarBorderRadius: 'rounded-full',
    cardShadow: 'shadow-lg',
    avatarShadow: 'shadow-sm',
    cardPadding: 'p-6',
    sectionSpacing: 'space-y-3',
  },
};

// 3. Ocean Blue Theme
const oceanBlueTheme: WidgetTheme = {
  name: 'Ocean Blue',
  colors: {
    pageBackground: 'bg-[#e3f2fd]',
    cardBackground: 'bg-white',
    avatarGradientFrom: 'from-blue-400',
    avatarGradientTo: 'to-blue-600',
    primaryButtonBg: 'bg-white',
    primaryButtonBgHover: 'hover:bg-blue-50',
    primaryButtonText: 'text-blue-600',
    primaryButtonBorder: 'border-2 border-blue-200',
    headingText: 'text-gray-900',
    bodyText: 'text-gray-700',
    mutedText: 'text-gray-600',
    hoverBackground: 'hover:bg-blue-50',
    collapsibleHover: 'hover:bg-blue-50',
    dividerBorder: 'border-blue-100',
    addAccountIcon: 'text-blue-600',
    signoutIcon: 'text-gray-700',
    signoutText: 'text-gray-700',
    signoutHover: 'hover:bg-blue-50',
  },
  styles: {
    cardBorderRadius: 'rounded-3xl',
    buttonBorderRadius: 'rounded-full',
    avatarBorderRadius: 'rounded-full',
    cardShadow: 'shadow-xl shadow-blue-100/50',
    avatarShadow: 'shadow-md',
    cardPadding: 'p-6',
    sectionSpacing: 'space-y-4',
  },
};

// 4. Purple Gradient Theme (Suprematic)
const purpleGradientTheme: WidgetTheme = {
  name: 'Purple Gradient',
  colors: {
    pageBackground: 'bg-gradient-to-br from-purple-50 to-pink-50',
    cardBackground: 'bg-white',
    avatarGradientFrom: 'from-purple-400',
    avatarGradientTo: 'to-pink-500',
    primaryButtonBg: 'bg-white',
    primaryButtonBgHover: 'hover:bg-purple-50',
    primaryButtonText: 'text-purple-600',
    primaryButtonBorder: 'border-2 border-purple-200',
    headingText: 'text-gray-900',
    bodyText: 'text-gray-700',
    mutedText: 'text-gray-600',
    hoverBackground: 'hover:bg-purple-50',
    collapsibleHover: 'hover:bg-purple-50',
    dividerBorder: 'border-purple-100',
    addAccountIcon: 'text-purple-600',
    signoutIcon: 'text-gray-700',
    signoutText: 'text-gray-700',
    signoutHover: 'hover:bg-purple-50',
  },
  styles: {
    cardBorderRadius: 'rounded-3xl',
    buttonBorderRadius: 'rounded-full',
    avatarBorderRadius: 'rounded-full',
    cardShadow: 'shadow-2xl shadow-purple-100/50',
    avatarShadow: 'shadow-lg',
    cardPadding: 'p-6',
    sectionSpacing: 'space-y-4',
  },
};

// 5. Dark Elegant Theme
const darkElegantTheme: WidgetTheme = {
  name: 'Dark Elegant',
  colors: {
    pageBackground: 'bg-gray-900',
    cardBackground: 'bg-gray-800',
    avatarGradientFrom: 'from-cyan-400',
    avatarGradientTo: 'to-blue-500',
    primaryButtonBg: 'bg-gray-700',
    primaryButtonBgHover: 'hover:bg-gray-600',
    primaryButtonText: 'text-cyan-400',
    primaryButtonBorder: 'border-2 border-gray-600',
    headingText: 'text-white',
    bodyText: 'text-gray-300',
    mutedText: 'text-gray-400',
    hoverBackground: 'hover:bg-gray-700',
    collapsibleHover: 'hover:bg-gray-700',
    dividerBorder: 'border-gray-700',
    addAccountIcon: 'text-cyan-400',
    signoutIcon: 'text-gray-300',
    signoutText: 'text-gray-300',
    signoutHover: 'hover:bg-gray-700',
  },
  styles: {
    cardBorderRadius: 'rounded-3xl',
    buttonBorderRadius: 'rounded-full',
    avatarBorderRadius: 'rounded-full',
    cardShadow: 'shadow-2xl shadow-black/50',
    avatarShadow: 'shadow-lg',
    cardPadding: 'p-6',
    sectionSpacing: 'space-y-4',
  },
};

// 6. Warm Sunset Theme
const warmSunsetTheme: WidgetTheme = {
  name: 'Warm Sunset',
  colors: {
    pageBackground: 'bg-gradient-to-br from-orange-50 to-red-50',
    cardBackground: 'bg-white',
    avatarGradientFrom: 'from-orange-400',
    avatarGradientTo: 'to-red-500',
    primaryButtonBg: 'bg-white',
    primaryButtonBgHover: 'hover:bg-orange-50',
    primaryButtonText: 'text-orange-600',
    primaryButtonBorder: 'border-2 border-orange-200',
    headingText: 'text-gray-900',
    bodyText: 'text-gray-700',
    mutedText: 'text-gray-600',
    hoverBackground: 'hover:bg-orange-50',
    collapsibleHover: 'hover:bg-orange-50',
    dividerBorder: 'border-orange-100',
    addAccountIcon: 'text-orange-600',
    signoutIcon: 'text-gray-700',
    signoutText: 'text-gray-700',
    signoutHover: 'hover:bg-orange-50',
  },
  styles: {
    cardBorderRadius: 'rounded-3xl',
    buttonBorderRadius: 'rounded-full',
    avatarBorderRadius: 'rounded-full',
    cardShadow: 'shadow-2xl shadow-orange-100/50',
    avatarShadow: 'shadow-md',
    cardPadding: 'p-6',
    sectionSpacing: 'space-y-4',
  },
};

// 7. Forest Green Theme
const forestGreenTheme: WidgetTheme = {
  name: 'Forest Green',
  colors: {
    pageBackground: 'bg-gradient-to-br from-emerald-50 to-teal-50',
    cardBackground: 'bg-white',
    avatarGradientFrom: 'from-emerald-400',
    avatarGradientTo: 'to-teal-500',
    primaryButtonBg: 'bg-white',
    primaryButtonBgHover: 'hover:bg-emerald-50',
    primaryButtonText: 'text-emerald-600',
    primaryButtonBorder: 'border-2 border-emerald-200',
    headingText: 'text-gray-900',
    bodyText: 'text-gray-700',
    mutedText: 'text-gray-600',
    hoverBackground: 'hover:bg-emerald-50',
    collapsibleHover: 'hover:bg-emerald-50',
    dividerBorder: 'border-emerald-100',
    addAccountIcon: 'text-emerald-600',
    signoutIcon: 'text-gray-700',
    signoutText: 'text-gray-700',
    signoutHover: 'hover:bg-emerald-50',
  },
  styles: {
    cardBorderRadius: 'rounded-3xl',
    buttonBorderRadius: 'rounded-full',
    avatarBorderRadius: 'rounded-full',
    cardShadow: 'shadow-2xl shadow-emerald-100/50',
    avatarShadow: 'shadow-md',
    cardPadding: 'p-6',
    sectionSpacing: 'space-y-4',
  },
};

// 8. Monochrome Professional Theme
const monochromeProfessionalTheme: WidgetTheme = {
  name: 'Monochrome Professional',
  colors: {
    pageBackground: 'bg-gray-100',
    cardBackground: 'bg-white',
    avatarGradientFrom: 'from-gray-600',
    avatarGradientTo: 'to-gray-800',
    primaryButtonBg: 'bg-white',
    primaryButtonBgHover: 'hover:bg-gray-100',
    primaryButtonText: 'text-gray-900',
    primaryButtonBorder: 'border-2 border-gray-300',
    headingText: 'text-gray-900',
    bodyText: 'text-gray-700',
    mutedText: 'text-gray-500',
    hoverBackground: 'hover:bg-gray-100',
    collapsibleHover: 'hover:bg-gray-100',
    dividerBorder: 'border-gray-200',
    addAccountIcon: 'text-gray-900',
    signoutIcon: 'text-gray-700',
    signoutText: 'text-gray-700',
    signoutHover: 'hover:bg-gray-100',
  },
  styles: {
    cardBorderRadius: 'rounded-2xl',
    buttonBorderRadius: 'rounded-full',
    avatarBorderRadius: 'rounded-full',
    cardShadow: 'shadow-xl',
    avatarShadow: 'shadow-sm',
    cardPadding: 'p-6',
    sectionSpacing: 'space-y-3',
  },
};

// Export all themes
export const THEMES = {
  googleClassic: googleClassicTheme,
  modernMinimal: modernMinimalTheme,
  oceanBlue: oceanBlueTheme,
  purpleGradient: purpleGradientTheme,
  darkElegant: darkElegantTheme,
  warmSunset: warmSunsetTheme,
  forestGreen: forestGreenTheme,
  monochromeProfessional: monochromeProfessionalTheme,
} as const;

// ⚡ CHANGE THEME HERE - Just update this line to switch themes
export const ACTIVE_THEME: WidgetTheme = THEMES.monochromeProfessional;

// Helper function to get theme classes
export const getThemeClasses = () => ACTIVE_THEME;