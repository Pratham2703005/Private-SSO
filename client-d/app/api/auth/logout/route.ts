import { handleLogout } from 'pratham-sso/server';

export const POST = handleLogout({
  clientId: process.env.NEXT_PUBLIC_CLIENT_ID!,
  idpServer: process.env.NEXT_PUBLIC_IDP_SERVER!,
});
