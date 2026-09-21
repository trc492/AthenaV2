import type { Mock } from "vitest";
import type { NextRequest } from "next/server";

/**
 * Route handlers are declared with `NextRequest`, but none of the extra surface
 * is used by the handlers under test, so the suites build plain `Request`s.
 */
export function asNextRequest(request: Request): NextRequest {
  return request as unknown as NextRequest;
}

/** The session shape the route handlers read from the mocked `auth()`. */
export interface MockAuthSession {
  user: { id: string; role: string; name?: string; username?: string };
}

/**
 * Stand-in for a database service: only the methods a suite exercises are
 * present, and each one is a vitest mock.
 */
export type ServiceMock = Record<string, Mock>;
