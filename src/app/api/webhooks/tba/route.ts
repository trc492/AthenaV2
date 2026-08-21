import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { databaseManager } from "@/db/database-manager";
import { sendPushNotificationToUser } from "@/lib/notifications";

type VerificationPayload = {
  message_type: "verification";
  message_data: { verification_key: string };
};

type UpcomingMatchPayload = {
  message_type: "upcoming_match";
  message_data: {
    event_key: string;
    match_key: string;
    event_name: string;
    team_keys: string[];
    scheduled_time?: number;
    predicted_time?: number;
  };
};

type PingPayload = {
  message_type: "ping";
  message_data: { title?: string; desc?: string };
};

type TbaWebhookPayload =
  | VerificationPayload
  | UpcomingMatchPayload
  | PingPayload
  | Record<string, unknown>;

function constantTimeEquals(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function getMatchNumberFromMatchKey(matchKey: string): number | null {
  // Examples: 2014necmp_f1m1, 2025miket_qm23
  const m = matchKey.match(/m(\d+)$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: NextRequest) {
  const secret = process.env.TBA_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "TBA_WEBHOOK_SECRET not configured" },
      { status: 500 },
    );
  }

  const rawBody = await req.text();
  const signatureHeader = req.headers.get("x-tba-hmac") ?? "";
  const computed = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  if (!signatureHeader || !constantTimeEquals(signatureHeader, computed)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: TbaWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Always respond quickly (TBA timeout is 10s)
  if ((payload as any)?.message_type === "verification") {
    const verificationKey = (payload as VerificationPayload).message_data
      ?.verification_key;
    return NextResponse.json(
      { ok: true, verification_key: verificationKey ?? null },
      { status: 200 },
    );
  }

  if ((payload as any)?.message_type !== "upcoming_match") {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const data = (payload as UpcomingMatchPayload).message_data;
  const matchNumber = getMatchNumberFromMatchKey(data.match_key);
  if (!matchNumber) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const notifyMatch = matchNumber;

  try {
    const service = databaseManager.getService();
    if (!service.query) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const result = await service.query<{
      userId: string;
    }>(`
        SELECT DISTINCT userId
        FROM matchAssignments
        WHERE eventCode = @eventCode
          AND matchNumber = @matchNumber
      `, { eventCode: data.event_key, matchNumber: notifyMatch });

    const userIds: string[] =
      result.recordset?.map((r: any) => r.userId).filter(Boolean) ?? [];

    await Promise.all(
      userIds.map((userId) =>
        sendPushNotificationToUser({
          userId,
          payload: {
            title: "Scouting Match Coming Up in 2 Matches",
            body: `${data.event_name}: Get ready for match ${notifyMatch}.`,
            url: "/dashboard/matchscouting",
            data: { timestamp: new Date().toISOString() },
          },
        }),
      ),
    );
  } catch (err) {
    console.error("Error handling TBA upcoming_match webhook:", err);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
