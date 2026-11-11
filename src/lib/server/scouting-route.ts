import { NextRequest, NextResponse } from "next/server";
import type { CompetitionType } from "@/lib/types";
import { requirePermissionWithSession } from "./require-permission";
import { ScoutingError } from "./scouting-service";

type AuthorizedSession = NonNullable<
  Awaited<ReturnType<typeof requirePermissionWithSession>>["session"]
>;

/** Keep permission checks and scouting error responses consistent across CRUD routes. */
export function scoutingRoute(
  permission: string,
  errorMessage: string,
  handle: (request: NextRequest, session: AuthorizedSession) => Promise<NextResponse>,
) {
  return async (request: NextRequest) => {
    try {
      const access = await requirePermissionWithSession(permission);
      if (access.denied) return access.denied;
      return await handle(request, access.session);
    } catch (error) {
      if (error instanceof ScoutingError) {
        return NextResponse.json(
          { error: error.message, message: error.message },
          { status: error.status },
        );
      }
      console.error(errorMessage, error);
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  };
}

export function scoutingQuery(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const integer = (key: string) => {
    const value = searchParams.get(key);
    return value ? parseInt(value) : undefined;
  };
  return {
    id: integer("id"),
    year: integer("year"),
    teamNumber: integer("teamNumber"),
    eventCode: searchParams.get("eventCode") || undefined,
    competitionType: (searchParams.get("competitionType") as CompetitionType) || undefined,
  };
}
