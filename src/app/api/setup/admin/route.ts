import { NextRequest, NextResponse } from "next/server";
import { createUser, hasAnyAdmin } from "@/lib/server/user-service";

export async function POST(request: NextRequest) {
  try {
    // Security check: If an admin already exists, do not allow arbitrary setup admin creation
    const adminExists = await hasAnyAdmin();
    if (adminExists) {
      return NextResponse.json(
        {
          error:
            "Setup has already been completed. An admin account already exists.",
        },
        { status: 403 },
      );
    }

    const { name, username, password } = await request.json();

    const result = await createUser({
      name,
      username,
      password,
      role: "admin",
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Admin account created successfully",
        userId: result.userId,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Admin setup error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create admin account",
      },
      { status: 500 },
    );
  }
}
