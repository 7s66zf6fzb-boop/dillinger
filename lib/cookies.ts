import type { NextRequest } from "next/server";

/**
 * Whether auth cookies get the Secure flag: always over https (including behind a proxy that
 * says so in x-forwarded-proto), and in production generally, except in the desktop app, which
 * serves production over http://localhost where browsers would drop a Secure cookie. The
 * desktop shell sets DILLINGER_DESKTOP on the server it starts.
 */
export function isSecureCookieRequest(request: NextRequest): boolean {
  if (request.nextUrl.protocol === "https:") return true;
  if (request.headers.get("x-forwarded-proto")?.split(",")[0].trim() === "https") return true;
  if (process.env.DILLINGER_DESKTOP === "1") return false;
  return process.env.NODE_ENV === "production";
}
