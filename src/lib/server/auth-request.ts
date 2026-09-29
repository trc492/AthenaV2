import { NextRequest } from "next/server";
import { loadAppConfig } from "@/lib/server/env-file";

/** Resolve the public origin at request time, including in standalone Docker builds. */
export function withAuthOrigin(request: NextRequest): NextRequest {
  const configuredUrl =
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    loadAppConfig()?.appUrl;

  const url = new URL(request.url);
  if (configuredUrl) {
    const configured = new URL(configuredUrl);
    url.protocol = configured.protocol;
    url.host = configured.host;
    url.port = configured.port;
  } else {
    // Auth already trusts the deployment proxy. It must overwrite forwarded
    // headers with the external host/protocol rather than the container address.
    const host = request.headers.get("x-forwarded-host")?.split(",")[0].trim()
      || request.headers.get("host");
    const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
    if (protocol === "https" || protocol === "http") url.protocol = `${protocol}:`;
    if (host) {
      const publicUrl = new URL(`${url.protocol}//${host}`);
      url.host = publicUrl.host;
      url.port = publicUrl.port;
    }
  }

  return new NextRequest(url, request);
}
