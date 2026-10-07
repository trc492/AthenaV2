import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const guestEventSchema = z.object({
  eventCode: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(200),
  year: z.number().int().min(1992).max(2100),
  competitionType: z.enum(["FRC", "FTC"]),
});
const grantSchema = guestEventSchema.extend({
  expiresAt: z.number().int().positive(),
  nonce: z.string().length(32),
});
export type GuestEventGrant = z.infer<typeof grantSchema>;

function secret() {
  const value = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!value) throw new Error("Guest links require AUTH_SECRET");
  return value;
}

function signature(payload: string) {
  return createHmac("sha256", secret())
    .update(`event-guest:v1:${payload}`)
    .digest();
}

export function createGuestEventLink(event: z.infer<typeof guestEventSchema>) {
  const grant = grantSchema.parse({
    ...guestEventSchema.parse(event),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    nonce: randomBytes(16).toString("hex"),
  });
  const payload = Buffer.from(JSON.stringify(grant)).toString("base64url");
  return {
    token: `${payload}.${signature(payload).toString("base64url")}`,
    expiresAt: grant.expiresAt,
  };
}

export function verifyGuestEventLink(token: string): GuestEventGrant | null {
  try {
    if (token.length > 3000) return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payload, supplied] = parts;
    const expected = signature(payload);
    const actual = Buffer.from(supplied, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      return null;
    const grant = grantSchema.parse(
      JSON.parse(Buffer.from(payload, "base64url").toString()),
    );
    return grant.expiresAt > Date.now() ? grant : null;
  } catch {
    return null;
  }
}
