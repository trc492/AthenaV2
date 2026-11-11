import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

afterEach(() => vi.unstubAllEnvs());
describe("trusted rate-limit identity", () => {
  it("does not allow spoofed proxy or browser headers to reset the default bucket", () => {
    vi.stubEnv("RATE_LIMIT_IP_HEADER", "");
    const options = { keyPrefix: "untrusted-test", windowMs: 60_000, maxRequests: 1 };
    expect(checkRateLimit(new NextRequest("http://test"), options).limited).toBe(false);
    expect(checkRateLimit(new NextRequest("http://test", { headers: {
      "cf-connecting-ip": "198.51.100.4", "x-forwarded-for": "192.0.2.1", "user-agent": "different",
    } }), options).limited).toBe(true);
  });
  it("uses only the explicitly configured proxy header", () => {
    vi.stubEnv("RATE_LIMIT_IP_HEADER", "X-Real-IP");
    const options = { keyPrefix: "trusted-test", windowMs: 60_000, maxRequests: 1 };
    const request = (ip: string, spoofed: string) => new NextRequest("http://test", {
      headers: { "x-real-ip": ip, "cf-connecting-ip": spoofed },
    });
    expect(checkRateLimit(request("192.0.2.1", "a"), options).limited).toBe(false);
    expect(checkRateLimit(request("192.0.2.1", "b"), options).limited).toBe(true);
    expect(checkRateLimit(request("192.0.2.2", "b"), options).limited).toBe(false);
  });
});
