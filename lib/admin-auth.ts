import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

const COOKIE = "nn_admin";
const SESSION_HOURS = 12;

/** admin: everything. door: only the check-in scanner (DOOR_PASSWORD), for staff at the entrance. */
export type Role = "admin" | "door";

export function isAdminConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD && (process.env.ADMIN_SESSION_SECRET?.length ?? 0) >= 32);
}

function sign(value: string) {
  return createHmac("sha256", process.env.ADMIN_SESSION_SECRET!).update(value).digest("base64url");
}

const digest = (text: string) => createHash("sha256").update(text).digest();
const same = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));

/** Which role a password unlocks, compared in constant time so response timing gives nothing away. */
export function roleForPassword(attempt: string): Role | null {
  if (!isAdminConfigured()) return null;
  const admin = same(attempt, process.env.ADMIN_PASSWORD!);
  const door = Boolean(process.env.DOOR_PASSWORD) && same(attempt, process.env.DOOR_PASSWORD!);
  return admin ? "admin" : door ? "door" : null;
}

/** Cookie holds the role, an expiry time and their signature; changing ADMIN_SESSION_SECRET signs everyone out. */
export async function startSession(role: Role) {
  const payload = `${role}.${Date.now() + SESSION_HOURS * 3600_000}`;
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function endAdminSession() {
  (await cookies()).delete({ name: COOKIE, path: "/admin" });
}

export async function getRole(): Promise<Role | null> {
  // Session checks compare against the current time, so they only ever run per request.
  await connection();
  if (!isAdminConfigured()) return null;
  const [role, expires, signature] = (await cookies()).get(COOKIE)?.value?.split(".") ?? [];
  if ((role !== "admin" && role !== "door") || !expires || !signature || Number(expires) < Date.now()) return null;
  const expected = Buffer.from(sign(`${role}.${expires}`));
  const given = Buffer.from(signature);
  return given.length === expected.length && timingSafeEqual(given, expected) ? role : null;
}

export async function isAdmin() {
  return (await getRole()) === "admin";
}

/** Call at the top of every admin page and server action. Door staff are sent to the scanner. */
export async function requireAdmin() {
  const role = await getRole();
  if (role === "door") redirect("/admin/scan");
  if (role !== "admin") redirect("/admin/login");
}

/** For the check-in scanner: admins and door staff. */
export async function requireDoor(): Promise<Role> {
  const role = await getRole();
  if (!role) redirect("/admin/login");
  return role;
}
