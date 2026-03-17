import { handleCallback } from 'pratham-sso/server';

export const GET = handleCallback({
  clientId: process.env.NEXT_PUBLIC_CLIENT_ID!,
  idpServer: process.env.NEXT_PUBLIC_IDP_SERVER!,
  redirectUri: process.env.NEXT_PUBLIC_REDIRECT_URI!,
  oauthSecret: process.env.OAUTH_SECRET!,
});
