import { NextResponse } from "next/server";

/** Liveness only; no database details or credentials are exposed. */
export function GET() {
  return NextResponse.json({ status: "ok" }, {
    headers: { "Cache-Control": "no-store" },
  });
}
