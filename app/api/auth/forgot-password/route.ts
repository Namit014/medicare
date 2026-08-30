import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json(
        { error: "Supabase keys are not configured in .env.local yet" },
        { status: 500 }
      );
    }

    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${request.nextUrl.origin}/reset-password`,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "If the email exists, a reset link has been sent.",
    });
  } catch (error: any) {
    console.error("Password reset error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process password reset" },
      { status: 500 }
    );
  }
}
