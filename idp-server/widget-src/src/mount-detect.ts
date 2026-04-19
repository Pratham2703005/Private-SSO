/**
 * Pure mount point detection. Reads the DOM but does not mutate module state.
 * Callers decide whether to store the result.
 */

import type { SignInConfig, WidgetMode } from './types';

export type MountDetection = {
  mode: WidgetMode;
  element: HTMLElement | null;
  signInConfig: SignInConfig;
};

export function detectMountPoint(doc: Document): MountDetection {
  const element = doc.getElementById('__account_switcher_mount_point');
  const signInConfig: SignInConfig = { text: 'Sign in', style: '' };

  if (!element) {
    return { mode: 'floating', element: null, signInConfig };
  }

  const text = element.getAttribute('data-signin-text');
  const customStyle = element.getAttribute('data-signin-style');
  if (text) signInConfig.text = text;
  if (customStyle) signInConfig.style = customStyle;

  return { mode: 'integrated', element, signInConfig };
}
