/**
 * Widget Script Endpoint
 * Serves the injectable widget code that clients embed with:
 * <script src="https://idp.com/widget.js"></script>
 *
 * Source: widget-src/dist/widget.built.js (produced by `npm run widget:build`,
 * or kept fresh by `npm run widget:dev` which the root `dev` script spawns).
 * At request time we substitute three placeholder tokens for per-deployment values.
 */

import fs from 'node:fs';
import path from 'node:path';
import { AVATAR_CHAR_COLOR_MAP } from '@/lib/avatar-colors';

const BUILT_WIDGET_PATH = path.join(process.cwd(), 'widget-src/dist/widget.built.js');

let cachedBuilt: { mtimeMs: number; content: string } | null = null;

function readBuiltWidget(): string {
  const stat = fs.statSync(BUILT_WIDGET_PATH);
  if (!cachedBuilt || cachedBuilt.mtimeMs !== stat.mtimeMs) {
    cachedBuilt = {
      mtimeMs: stat.mtimeMs,
      content: fs.readFileSync(BUILT_WIDGET_PATH, 'utf8'),
    };
  }
  return cachedBuilt.content;
}

export async function GET(request: Request) {
  const idpOrigin = process.env.NEXT_PUBLIC_IDP_URL || new URL(request.url).origin;
  const widgetUrl = `${idpOrigin}/widget/account-switcher`;
  const avatarColorMapJson = JSON.stringify(AVATAR_CHAR_COLOR_MAP);

  let built: string;
  try {
    built = readBuiltWidget();
  } catch (err) {
    console.error('[widget.js] Built artifact missing at', BUILT_WIDGET_PATH, err);
    return new Response(
      '/* Widget bundle missing. Run `npm run widget:build` (or `npm run dev` which watches it). */',
      {
        status: 500,
        headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
      }
    );
  }

  // The built widget has placeholder tokens inside "..." string literals
  // (e.g. `const X = "__IDP_ORIGIN__";`). Origin and URL values are safe to inject
  // raw. The JSON value contains double quotes that must be backslash-escaped so
  // the resulting literal remains valid JS.
  const widgetScript = built
    .replaceAll('__IDP_ORIGIN__', idpOrigin)
    .replaceAll('__WIDGET_URL__', widgetUrl)
    .replaceAll('__AVATAR_COLOR_MAP_JSON__', avatarColorMapJson.replaceAll('"', '\\"'));

  return new Response(widgetScript, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
  });
}
