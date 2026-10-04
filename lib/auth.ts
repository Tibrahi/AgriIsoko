import "server-only";

import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { getPool } from "@/lib/agri-data";

const scryptAsync = promisify(scrypt);
export const SESSION_COOKIE = "agri_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const HASH_BYTES = 64;

export type AppRole = "farmer" | "buyer" | "cooperative_manager" | "warehouse_manager" | "market_officer" | "sector_officer" | "district_officer" | "national_admin" | "analyst";
export type SessionUser = { id: string; name: string; email: string; organizationId: string | null; status: "pending" | "active" | "suspended" | "rejected"; reviewNote: string | null; roles: AppRole[] };

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const derived = await scryptAsync(password, salt, HASH_BYTES) as Buffer;
  return { salt, hash: derived.toString("hex") };
}

export async function verifyPassword(password: string, salt: string, expectedHex: string) {
  const { hash } = await hashPassword(password, salt);
  const actual = Buffer.from(hash, "hex");
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await getPool().query(
    "INSERT INTO auth_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
    [userId, hashSessionToken(token), expiresAt],
  );
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function revokeCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  try {
    if (token) await getPool().query("DELETE FROM auth_sessions WHERE token_hash = $1", [hashSessionToken(token)]);
  } finally {
    cookieStore.delete(SESSION_COOKIE);
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const result = await getPool().query<SessionUser & { role: AppRole | null }>(
    `SELECT u.id, u.display_name AS name, u.email, u.organization_id AS "organizationId",
            u.account_status AS status, u.account_review_note AS "reviewNote", r.name AS role
     FROM auth_sessions s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN roles r ON r.id = ur.role_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashSessionToken(token)],
  );
  const first = result.rows[0];
  if (!first) return null;
  return {
    id: first.id,
    name: first.name,
    email: first.email,
    organizationId: first.organizationId,
    status: first.status,
    reviewNote: first.reviewNote,
    roles: [...new Set(result.rows.map((row) => row.role).filter((role): role is AppRole => role !== null))],
  };
}

export function isAdmin(user: SessionUser) {
  return user.status === "active" && user.roles.includes("national_admin");
}

export function verifySameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
