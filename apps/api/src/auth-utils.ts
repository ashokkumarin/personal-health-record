import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { User } from "@phr/shared";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-only-change-me";

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(user: User): string {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: "7d",
  });
}

export interface TokenPayload {
  sub: string;
  email: string;
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}
