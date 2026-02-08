import jwt from "jsonwebtoken";
import { AccessTokenPayload, IdTokenPayload, RefreshTokenPayload } from "./schemas";

const privateKey = process.env.JWT_PRIVATE_KEY!.replace(/\\n/g, "\n");
const publicKey = process.env.JWT_PUBLIC_KEY!.replace(/\\n/g, "\n");

if (!privateKey || !publicKey) {
  throw new Error("JWT keys not configured in environment variables");
}

export function generateAccessToken(
  userId: string,
  email: string,
  name: string,
  accountId: string
): string {
  const payload: AccessTokenPayload = {
    sub: userId,
    email,
    name,
    accountId,
    iat: Math.floor(Date.now() / 1000)
  };

  return jwt.sign(payload, privateKey, {
    algorithm: "RS256",
    expiresIn: "1d",
  });
}

export function generateIdToken(
  userId: string,
  email: string,
  name: string,
  accountId: string
): string {
  const payload: IdTokenPayload = {
    sub: userId,
    email,
    name,
    iat: Math.floor(Date.now() / 1000)
  };

  return jwt.sign(payload, privateKey, {
    algorithm: "RS256",
    expiresIn: "1d",
  });
}

export function generateRefreshToken(
  userId: string,
  accountId: string,
  clientId: string,
  jti: string
): string {
  const payload: RefreshTokenPayload = {
    sub: userId,
    accountId,
    clientId,
    jti,
    iat: Math.floor(Date.now() / 1000),
  };

  return jwt.sign(payload, privateKey, {
    algorithm: "RS256",
    expiresIn: "7d",
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, publicKey, {
      algorithms: ["RS256"],
    });
    return decoded as AccessTokenPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    const decoded = jwt.verify(token, publicKey, {
      algorithms: ["RS256"],
    });
    return decoded as RefreshTokenPayload;
  } catch {
    return null;
  }
}

export function decodeToken<T>(token: string): T | null {
  try {
    const decoded = jwt.decode(token);
    return decoded as T;
  } catch {
    return null;
  }
}
