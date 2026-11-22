// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { isSecureCookieRequest } from "@/lib/cookies";

const request = (url: string, headers: Record<string, string> = {}) => new NextRequest(url, { headers });
const CALLBACK = "/api/github/callback";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isSecureCookieRequest", () => {
  it("is secure over https", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isSecureCookieRequest(request("https://dillinger.io" + CALLBACK))).toBe(true);
  });

  it("is secure when a proxy reports https, even with Host: localhost", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DILLINGER_DESKTOP", "1");
    expect(isSecureCookieRequest(request("http://localhost:3000" + CALLBACK, { "x-forwarded-proto": "https" }))).toBe(true);
  });

  it("stays secure in production behind a proxy that hides the scheme", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isSecureCookieRequest(request("http://localhost:3000" + CALLBACK))).toBe(true);
    expect(isSecureCookieRequest(request("http://dillinger.io" + CALLBACK))).toBe(true);
  });

  it("is not secure in the desktop app on http://localhost", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DILLINGER_DESKTOP", "1");
    expect(isSecureCookieRequest(request("http://localhost:3000" + CALLBACK))).toBe(false);
  });

  it("is not secure for plain-http development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isSecureCookieRequest(request("http://192.168.1.5:3000" + CALLBACK))).toBe(false);
  });
});
