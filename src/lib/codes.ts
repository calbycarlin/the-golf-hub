import "server-only";
import { randomBytes, randomInt, timingSafeEqual, createHash } from "crypto";
import { JOIN_CODE_LENGTH } from "./joinCode";

// Uppercase letters/numbers only, with ambiguous characters (0/O, 1/I) removed
// so a join code is easy to read aloud and type on a phone.
const JOIN_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateJoinCode(): string {
  let code = "";
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
    code += JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)];
  }
  return code;
}

/** Long random secret shown once to the event creator and stored client-side. */
export function generateHostToken(): string {
  return randomBytes(32).toString("hex");
}

const PEPPER = process.env.HOST_TOKEN_PEPPER ?? "the-golf-hub-dev-pepper";

export function hashHostToken(token: string): string {
  return createHash("sha256").update(`${PEPPER}:${token}`).digest("hex");
}

export function verifyHostToken(token: string, hash: string): boolean {
  const candidate = Buffer.from(hashHostToken(token), "hex");
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}
