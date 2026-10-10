import { NextResponse } from "next/server";
import { z } from "zod";

const scalar = z.union([z.number().finite(), z.string(), z.boolean()]);
const gameSpecificData = z.record(z.string(), z.union([
  scalar, z.record(z.string(), scalar),
]));
const common = {
  teamNumber: z.number().int().positive(),
  year: z.number().int().min(1992).max(2100),
  competitionType: z.enum(["FRC", "FTC"]),
  eventName: z.string().optional(),
  eventCode: z.string().min(1).optional(),
  gameSpecificData,
};
const pitFields = z.object({
  ...common,
  driveTrain: z.enum(["Swerve", "Mecanum", "Tank", "Other"]),
  weight: z.number().finite().nonnegative().optional(),
  length: z.number().finite().nonnegative().optional(),
  width: z.number().finite().nonnegative().optional(),
  autoDrawing: z.string().optional(),
  notes: z.string().optional(),
});
const matchFields = z.object({
  ...common,
  matchNumber: z.number().int().positive(),
  alliance: z.enum(["red", "blue"]),
  alliancePosition: z.number().int().min(1).max(3).optional(),
  notes: z.string(),
  timestamp: z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
});
const scoutingForUserId = z.string().min(1).optional();
export const createPitSchema = pitFields.extend({ scoutingForUserId });
export const createMatchSchema = matchFields.extend({ scoutingForUserId });
// Ownership is server-controlled. Updates accept only explicit editable fields.
export const updatePitSchema = pitFields.partial().extend({ id: z.number().int().positive() }).strict();
export const updateMatchSchema = matchFields.partial().extend({ id: z.number().int().positive() }).strict();

export async function parseScoutingBody<T>(request: Request, schema: z.ZodType<T>): Promise<
  | { data: T; error: null }
  | { data: null; error: NextResponse }
> {
  const body = await request.json().catch(() => undefined);
  const result = schema.safeParse(body);
  if (!result.success) return {
    data: null,
    error: NextResponse.json({ error: "Invalid scouting data", details: result.error.issues }, { status: 400 }),
  };
  return { data: result.data, error: null };
}
