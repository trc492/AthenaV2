import { NextResponse } from "next/server";
import { DatabaseManager } from "@/db/database-manager";
import { auth } from "@/lib/auth/config";
import { hasPermission, PERMISSIONS } from "@/lib/auth/roles";

export async function GET() {
  try {
    const session = await auth();
    if (
      !session?.user?.role ||
      !hasPermission(session.user.role, PERMISSIONS.VIEW_DATA_DIAGNOSTICS)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    console.log("Diagnostics: Starting database diagnostics");

    // Check environment variables
    const env = {
      NODE_ENV: process.env.NODE_ENV,
      AZURE_SQL_CONNECTION_STRING: process.env.AZURE_SQL_CONNECTION_STRING
        ? "Set"
        : "Not set",
      AZURE_SQL_SERVER: process.env.AZURE_SQL_SERVER || "Not set",
      AZURE_SQL_DATABASE: process.env.AZURE_SQL_DATABASE || "Not set",
      AZURE_SQL_USER: process.env.AZURE_SQL_USER ? "Set" : "Not set",
      AZURE_SQL_PASSWORD: process.env.AZURE_SQL_PASSWORD ? "Set" : "Not set",
      AZURE_SQL_USE_MANAGED_IDENTITY:
        process.env.AZURE_SQL_USE_MANAGED_IDENTITY || "Not set",
    };

    // Get database manager info
    const dbManager = DatabaseManager.getInstance();
    const config = dbManager.getConfig();
    const service = dbManager.getService();

    // Test basic connection
    const connectionTest: { success: boolean; error: string | null } = {
      success: false,
      error: null,
    };
    try {
      console.log("Diagnostics: Testing pit entries fetch");
      const pitEntries = await service.getAllPitEntries();
      console.log("Diagnostics: Pit entries count:", pitEntries.length);
      connectionTest.success = true;
    } catch (error) {
      console.error("Diagnostics: Connection test failed:", error);
      connectionTest.error =
        error instanceof Error ? error.message : "Unknown error";
    }

    // Test match entries
    const matchTest: { success: boolean; error: string | null; count: number } =
      { success: false, error: null, count: 0 };
    try {
      console.log("Diagnostics: Testing match entries fetch");
      const matchEntries = await service.getAllMatchEntries();
      console.log("Diagnostics: Match entries count:", matchEntries.length);
      matchTest.success = true;
      matchTest.count = matchEntries.length;
    } catch (error) {
      console.error("Diagnostics: Match test failed:", error);
      matchTest.error =
        error instanceof Error ? error.message : "Unknown error";
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment: env,
      databaseConfig: {
        provider: config?.provider ?? "unknown",
        useManagedIdentity: config?.azuresql?.useManagedIdentity || false,
      },
      tests: {
        connection: connectionTest,
        matchEntries: matchTest,
      },
    });
  } catch (error) {
    console.error("Diagnostics: Critical error:", error);
    return NextResponse.json(
      {
        error: "Diagnostics failed",
        details: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}
