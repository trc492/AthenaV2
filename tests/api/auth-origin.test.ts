import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import NextAuth from "next-auth";
import { encode } from "next-auth/jwt";
import { withAuthOrigin } from "@/lib/server/auth-request";
import middleware from "@/proxy";

const { loadAppConfig } = vi.hoisted(() => ({ loadAppConfig: vi.fn() }));
vi.mock("@/lib/server/env-file", () => ({ loadAppConfig }));

describe("authentication public origin", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_URL", "");
    vi.stubEnv("NEXTAUTH_URL", "");
    loadAppConfig.mockReturnValue(null);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("reads saved setup changes on the next request without a rebuild", () => {
    const request = new NextRequest("http://0.0.0.0:3000/api/auth/session?test=1");
    loadAppConfig.mockReturnValue({ appUrl: "https://scouting.example.com" });
    expect(withAuthOrigin(request).url).toBe("https://scouting.example.com/api/auth/session?test=1");
    loadAppConfig.mockReturnValue({ appUrl: "https://new.example.com" });
    expect(withAuthOrigin(request).nextUrl.origin).toBe("https://new.example.com");
  });

  it("prefers runtime AUTH_URL over NEXTAUTH_URL and saved setup", () => {
    vi.stubEnv("AUTH_URL", "https://runtime.example.com");
    vi.stubEnv("NEXTAUTH_URL", "https://legacy.example.com");
    loadAppConfig.mockReturnValue({ appUrl: "https://saved.example.com" });
    expect(withAuthOrigin(new NextRequest("http://0.0.0.0:3000/api/auth/session")).nextUrl.origin)
      .toBe("https://runtime.example.com");
  });

  it("supports the legacy runtime NEXTAUTH_URL", () => {
    vi.stubEnv("NEXTAUTH_URL", "https://legacy.example.com");
    expect(withAuthOrigin(new NextRequest("http://0.0.0.0:3000/api/auth/session")).nextUrl.origin)
      .toBe("https://legacy.example.com");
  });

  it("uses forwarded public host and protocol for an unconfigured deployment", () => {
    const request = new NextRequest("http://0.0.0.0:3000/api/auth/session", {
      headers: { "x-forwarded-host": "scouting.example.com", "x-forwarded-proto": "https" },
    });
    expect(withAuthOrigin(request).nextUrl.origin).toBe("https://scouting.example.com");
  });

  it("preserves a direct LAN host, cookies, and the signout POST body", async () => {
    const request = new NextRequest("http://0.0.0.0:3000/api/auth/signout", {
      method: "POST",
      headers: { host: "192.168.1.20:3000", cookie: "test=value" },
      body: "csrfToken=test",
    });
    const resolved = withAuthOrigin(request);
    expect(resolved.nextUrl.origin).toBe("http://192.168.1.20:3000");
    expect(resolved.method).toBe("POST");
    expect(resolved.headers.get("cookie")).toBe("test=value");
    expect(await resolved.text()).toBe("csrfToken=test");
  });

  it("returns the public signout destination through the actual Auth.js handlers", async () => {
    loadAppConfig.mockReturnValue({ appUrl: "https://scouting.example.com" });
    const { handlers } = NextAuth({ providers: [], secret: "test-secret-only", trustHost: true });
    const csrf = await handlers.GET(withAuthOrigin(new NextRequest("http://0.0.0.0:3000/api/auth/csrf")));
    const { csrfToken } = await csrf.json();
    const sessionToken = await encode({ token: { sub: "test-user" }, secret: "test-secret-only", salt: "__Secure-authjs.session-token" });
    const cookie = csrf.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ")
      + `; __Secure-authjs.session-token=${sessionToken}`;
    const response = await handlers.POST(withAuthOrigin(new NextRequest("http://0.0.0.0:3000/api/auth/signout", {
      method: "POST",
      headers: { cookie, "Content-Type": "application/x-www-form-urlencoded", "X-Auth-Return-Redirect": "1" },
      body: new URLSearchParams({ csrfToken, callbackUrl: "https://scouting.example.com/" }),
    })));
    expect(response.status).toBe(200);
    expect((await response.json()).url).toBe("https://scouting.example.com/");
    expect(response.headers.getSetCookie().some((value) => value.includes("session-token=;") && value.includes("Max-Age=0"))).toBe(true);
  });

  it("accepts the HTTPS session cookie behind a proxy", async () => {
    vi.stubEnv("AUTH_SECRET", "test-secret-only");
    loadAppConfig.mockReturnValue({ appUrl: "https://scouting.example.com" });
    const token = await encode({ token: { sub: "test-user" }, secret: "test-secret-only", salt: "__Secure-authjs.session-token" });
    const response = await middleware(new NextRequest("http://0.0.0.0:3000/dashboard", {
      headers: { cookie: `__Secure-authjs.session-token=${token}` },
    }));
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("redirects logged-out clients to the public login URL", async () => {
    loadAppConfig.mockReturnValue({ appUrl: "https://scouting.example.com" });
    const response = await middleware(new NextRequest("http://0.0.0.0:3000/dashboard"));
    expect(response.headers.get("location")).toBe("https://scouting.example.com/login");
  });

  it("accepts an HTTP session cookie on a direct LAN deployment", async () => {
    vi.stubEnv("AUTH_SECRET", "test-secret-only");
    const token = await encode({ token: { sub: "test-user" }, secret: "test-secret-only", salt: "authjs.session-token" });
    const response = await middleware(new NextRequest("http://192.168.1.20:3000/dashboard", {
      headers: { cookie: `authjs.session-token=${token}` },
    }));
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("allows login with a stale account token instead of redirecting back to the dashboard", async () => {
    vi.stubEnv("AUTH_SECRET", "test-secret-only");
    const token = await encode({ token: { sub: "deleted-user" }, secret: "test-secret-only", salt: "authjs.session-token" });
    const response = await middleware(new NextRequest("http://localhost/login", {
      headers: { cookie: `authjs.session-token=${token}` },
    }));
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
