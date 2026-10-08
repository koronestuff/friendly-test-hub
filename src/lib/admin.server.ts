import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

type AdminSession = { admin?: boolean };

function sessionConfig() {
  return {
    password: process.env["SESSION_SECRET"]!,
    name: "rawblox-admin",
    maxAge: 60 * 60 * 8,
    // The app renders inside the Lovable preview iframe (third-party context),
    // where SameSite=Lax cookies are dropped. None + Secure keeps the session.
    cookie: { httpOnly: true, secure: true, sameSite: "none" as const, path: "/" },
  };
}

export function passwordMatches(input: string, expected: string) {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export async function getAdminSession() {
  return useSession<AdminSession>(sessionConfig());
}

export async function isAdmin() {
  const session = await getAdminSession();
  return session.data.admin === true;
}

export async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("Not authorized");
}

export function banUntil(duration: string): string | null {
  const map: Record<string, number> = {
    "1d": 1,
    "3d": 3,
    "7d": 7,
    "14d": 14,
    "1mo": 30,
    "6mo": 182,
    "1y": 365,
  };
  if (duration === "perm") return null;
  const days = map[duration] ?? 1;
  return new Date(Date.now() + days * 86400000).toISOString();
}
