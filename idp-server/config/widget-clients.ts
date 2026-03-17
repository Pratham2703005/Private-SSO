/**
 * Widget Client Allowlist
 * Defines which domains are allowed to embed the account switcher widget
 */

export interface WidgetClient {
  origin: string;
  clientId: string;
  name: string;
}

export const WIDGET_ALLOWED_CLIENTS: WidgetClient[] = [
  {
    origin: 'https://client-a.com',
    clientId: 'client-a',
    name: 'Client A Production',
  },
  {
    origin: 'https://client-b.com',
    clientId: 'client-b',
    name: 'Client B Production',
  },
  {
    origin: 'http://localhost:3001',
    clientId: 'client-a-dev',
    name: 'Client A Development',
  },
  {
    origin: 'http://localhost:3002',
    clientId: 'client-b-dev',
    name: 'Client B Development',
  },
  {
    origin: 'http://localhost:3003',
    clientId: 'client-c-dev',
    name: 'Client C Development',
  },
  {
    origin: 'http://localhost:3004',
    clientId: 'bff3de58-091e-41d2-b299-e78243250d2b',
    name: 'Client D Development',
  },
];

export function isAllowedWidgetClient(origin: string): boolean {
  return WIDGET_ALLOWED_CLIENTS.some((c) => c.origin === origin);
}

export function getClientNameByOrigin(origin: string): string | null {
  const client = WIDGET_ALLOWED_CLIENTS.find((c) => c.origin === origin);
  return client?.name || null;
}

export function getAllowedOrigins(): string {
  return WIDGET_ALLOWED_CLIENTS.map((c) => c.origin).join(' ');
}
