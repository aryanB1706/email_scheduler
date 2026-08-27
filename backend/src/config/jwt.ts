import jwt from "jsonwebtoken";
import { env } from "./env";

export interface JwtPayload {
  userId: string;
  googleId: string;
  email: string;
}

export function signJwt(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn } as any);
}

export function verifyJwt(token: string): JwtPayload {
  return jwt.verify(token, env.jwt.secret) as JwtPayload;
}
