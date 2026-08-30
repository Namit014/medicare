import { NextResponse } from "next/server";
import { supabase, supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured) {
      return NextResponse.json(
        { error: "Supabase keys are not configured in .env.local yet" },
        { status: 500 }
      );
    }

    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // 1. Sign in user with email & password
    const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (sessionError || !sessionData.session) {
      return NextResponse.json(
        { error: sessionError?.message || "Invalid email or password" },
        { status: 401 }
      );
    }

    const { user, access_token, refresh_token } = sessionData.session;

    // 2. Fetch the corresponding name and device_id from profiles in PostgreSQL
    // We use supabaseAdmin to bypass row-level security for this public read, OR standard client
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("name, device_id, role")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Profile load error during login:", profileError);
    }

    const name = profile?.name || user.user_metadata?.name || "User";
    const deviceId = profile?.device_id || "";
    const role = profile?.role || "";

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name,
        email: user.email,
        deviceId,
        role,
      },
    });

    // 3. Save access and refresh tokens in HTTP-only cookies
    response.cookies.set("sb-access-token", access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    response.cookies.set("sb-refresh-token", refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Supabase login error:", error);
    return NextResponse.json(
      { error: error.message || "An unexpected error occurred during login" },
      { status: 500 }
    );
  }
}
