import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json(
        { error: "Supabase keys are not configured in .env.local yet" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const redirectTo = searchParams.get("redirect") || "/";

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${request.nextUrl.origin}/api/auth/google/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    });

    if (error) {
      return NextResponse.redirect(new URL("/login?error=google_auth_failed", request.url));
    }

    if (data.url) {
      return NextResponse.redirect(data.url);
    }

    return NextResponse.redirect(new URL("/login?error=google_auth_failed", request.url));
  } catch (error: any) {
    console.error("Google OAuth error:", error);
    return NextResponse.redirect(new URL("/login?error=google_auth_failed", request.url));
  }
}
