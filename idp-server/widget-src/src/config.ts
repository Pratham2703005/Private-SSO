/**
 * Build-time constants. The three `__*__` strings are placeholder tokens
 * that the /api/widget.js route replaces before serving.
 */

import type { AvatarColorMap, WidgetMode } from './types';

export const IDP_ORIGIN = '__IDP_ORIGIN__';
export const WIDGET_URL = '__WIDGET_URL__';
export const AVATAR_COLOR_MAP_JSON = '__AVATAR_COLOR_MAP_JSON__';
export const AVATAR_CHAR_COLOR_MAP: AvatarColorMap = JSON.parse(AVATAR_COLOR_MAP_JSON);

// UI sizing shared across styles and button rendering.
export const BUTTON_SIZE_PX: Record<WidgetMode, string> = {
  integrated: '40px',
  floating: '44px',
};

export const SIGN_IN_HEIGHT_PX: Record<WidgetMode, string> = {
  integrated: '36px',
  floating: '40px',
};

export const DEFAULT_AVATAR_FALLBACK_COLOR = '#475569';
