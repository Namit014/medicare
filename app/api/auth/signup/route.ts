import { NextResponse } from "next/server";
import { supabase, supabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    if (!isSupabaseAdminConfigured) {
      return NextResponse.json(
        { error: "Supabase keys are not configured in .env.local yet" },
        { status: 500 }
      );
    }

    const { name, email, password, role } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    // 1. Create the user using Admin API (which allows auto-confirming email)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto confirms email, bypassing verification blocks
      user_metadata: { name },
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || "Failed to create authentication user" },
        { status: 400 }
      );
    }

    const authUser = authData.user;
    const defaultDeviceId = `MED-${authUser.id.substring(0, 6).toUpperCase()}`;

    // 2. Insert into custom public.profiles table
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: authUser.id,
        name,
        device_id: defaultDeviceId,
        role: role || "",
      });

    if (profileError) {
      // Cleanup auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(authUser.id);
      return NextResponse.json(
        { error: `Profile setup failed: ${profileError.message}` },
        { status: 500 }
      );
    }

    // 3. Authenticate the newly created user to generate session tokens
    const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (sessionError || !sessionData.session) {
      return NextResponse.json(
        { error: "Account created but initial login session failed: " + sessionError?.message },
        { status: 500 }
      );
    }

    const { access_token, refresh_token } = sessionData.session;

    const response = NextResponse.json({
      success: true,
      user: {
        id: authUser.id,
        name,
        email: authUser.email,
        deviceId: defaultDeviceId,
        role: role || "",
      },
    });

    // 5. Save tokens in HTTP-only cookies
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
    console.error("Supabase signup error:", error);
    return NextResponse.json(
      { error: error.message || "An unexpected error occurred during signup" },
      { status: 500 }
    );
  }
}
