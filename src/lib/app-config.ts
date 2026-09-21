const publicAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Athena";
export const APP_SHORT_NAME =
  process.env.NEXT_PUBLIC_APP_SHORT_NAME?.trim() || APP_NAME;
export const APP_DESCRIPTION =
  process.env.NEXT_PUBLIC_APP_DESCRIPTION?.trim() ||
  "A configurable scouting and analytics platform for FIRST teams.";
export const APP_LOGO =
  process.env.NEXT_PUBLIC_APP_LOGO?.trim() || "/assets/icon-192.png";
export const APP_LOGO_DARK =
  process.env.NEXT_PUBLIC_APP_LOGO_DARK?.trim() || APP_LOGO;
export const ORGANIZATION_NAME =
  process.env.NEXT_PUBLIC_ORGANIZATION_NAME?.trim() || "";
export const ORGANIZATION_URL =
  process.env.NEXT_PUBLIC_ORGANIZATION_URL?.trim() || "";

export function getPublicAppUrl() {
  return (
    publicAppUrl ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}
