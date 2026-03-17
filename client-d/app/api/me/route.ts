import { validateSession } from 'pratham-sso/server';

export const POST = validateSession({
  clientId: process.env.NEXT_PUBLIC_CLIENT_ID!,
  idpServer: process.env.NEXT_PUBLIC_IDP_SERVER!,
});
