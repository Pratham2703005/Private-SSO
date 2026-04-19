/**
 * Pure button renderers. Each takes an existing <button> and mutates its
 * content/style to reflect a specific visual state. No module state is read.
 */

import {
  BUTTON_SIZE_PX,
  DEFAULT_AVATAR_FALLBACK_COLOR,
  SIGN_IN_HEIGHT_PX,
} from '../config';
import type {
  AccountPreview,
  AvatarColorMap,
  SignInConfig,
  WidgetMode,
} from '../types';

export function getAvatarColor(name: string, colorMap: AvatarColorMap): string {
  const firstChar = ((name || '').trim().charAt(0) || '').toUpperCase();
  return colorMap[firstChar] || DEFAULT_AVATAR_FALLBACK_COLOR;
}

export function renderInitialAvatar(
  btn: HTMLButtonElement,
  name: string,
  colorMap: AvatarColorMap,
): void {
  btn.style.background = getAvatarColor(name, colorMap);
  const initial = document.createElement('span');
  initial.textContent = (name || '?').charAt(0).toUpperCase();
  initial.style.cssText =
    'font-size: 18px; font-weight: 600; color: white; line-height: 1; user-select: none;';
  btn.appendChild(initial);
}

export function renderSkeleton(btn: HTMLButtonElement, mode: WidgetMode): void {
  const size = BUTTON_SIZE_PX[mode];
  btn.setAttribute('aria-label', 'Loading...');
  btn.title = '';
  btn.innerHTML = '';
  btn.disabled = true;
  btn.style.cssText = [
    'width: ' + size,
    'height: ' + size,
    'border-radius: 50%',
    'background: #e0e0e0',
    'border: 2px solid #dadce0',
    'cursor: default',
    'display: flex',
    'align-items: center',
    'justify-content: center',
    'padding: 0',
    'outline: none',
    'box-shadow: none',
    'animation: __asSkeleton 1.5s ease-in-out infinite',
  ].join('; ') + ';';
}

export type AvatarRenderOptions = {
  hasActiveSession: boolean;
  hasRememberedAccounts: boolean;
};

export function renderAvatar(
  btn: HTMLButtonElement,
  preview: AccountPreview,
  options: AvatarRenderOptions,
  mode: WidgetMode,
  colorMap: AvatarColorMap,
): void {
  const size = BUTTON_SIZE_PX[mode];
  const allSignedOut =
    options.hasRememberedAccounts && !options.hasActiveSession;

  btn.disabled = false;
  btn.setAttribute(
    'aria-label',
    allSignedOut ? 'Account selector' : 'Account: ' + preview.name,
  );
  btn.title = allSignedOut
    ? 'Choose an account'
    : preview.name + ' (' + preview.email + ')';
  btn.innerHTML = '';

  btn.style.cssText = [
    'width: ' + size,
    'height: ' + size,
    'border-radius: 50%',
    'border: 2px solid #dadce0',
    'cursor: pointer',
    'display: flex',
    'align-items: center',
    'justify-content: center',
    'padding: 0',
    'outline: none',
    'box-shadow: none',
    'overflow: hidden',
    'background: transparent',
  ].join('; ') + ';';

  if (allSignedOut) {
    renderGenericUserIcon(btn);
    return;
  }

  if (preview.avatarUrl) {
    const img = document.createElement('img');
    img.src = preview.avatarUrl;
    img.alt = preview.name;
    img.style.cssText =
      'width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block;';
    img.onerror = function () {
      btn.innerHTML = '';
      renderInitialAvatar(btn, preview.name, colorMap);
    };
    btn.appendChild(img);
    return;
  }

  renderInitialAvatar(btn, preview.name, colorMap);
}

export function renderSignIn(
  btn: HTMLButtonElement,
  config: SignInConfig,
  mode: WidgetMode,
): void {
  btn.disabled = false;
  btn.setAttribute('aria-label', config.text);
  btn.title = config.text;
  btn.innerHTML = '';

  // Apply default sign-in styles, then overlay custom styles.
  btn.style.cssText = [
    'border-radius: 20px',
    'width: auto',
    'height: ' + SIGN_IN_HEIGHT_PX[mode],
    'padding: 0 16px',
    'background: #1a73e8',
    'overflow: visible',
    'display: flex',
    'align-items: center',
    'justify-content: center',
    'cursor: pointer',
    'border: none',
    'box-shadow: none',
    'transition: none',
    'outline: none',
    config.style, // Custom CSS overrides go last
  ]
    .filter(Boolean)
    .join('; ') + ';';

  const label = document.createElement('span');
  label.textContent = config.text;
  label.style.cssText =
    'font-size: 14px; font-weight: 500; color: inherit; white-space: nowrap; line-height: 1;';
  btn.appendChild(label);

  // Set text color default if not overridden by custom style.
  if (!config.style || config.style.indexOf('color') === -1) {
    btn.style.color = 'white';
  }
}

function renderGenericUserIcon(btn: HTMLButtonElement): void {
  btn.style.background = '#f0f0f0';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', '#5f6368');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.style.cssText =
    'width: 18px; height: 18px; flex-shrink: 0; display: block; color: #5f6368;';

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2');
  path.setAttribute('stroke', '#5f6368');
  svg.appendChild(path);

  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '12');
  circle.setAttribute('cy', '7');
  circle.setAttribute('r', '4');
  circle.setAttribute('stroke', '#000');
  svg.appendChild(circle);

  btn.appendChild(svg);
}
