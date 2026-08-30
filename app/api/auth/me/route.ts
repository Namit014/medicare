import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        deviceId: user.deviceId,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error("Session verification error:", error);
    return NextResponse.json(
      { error: "An error occurred checking session" },
      { status: 500 }
    );
  }
}
