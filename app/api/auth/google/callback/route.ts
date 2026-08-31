import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/";
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${error}`, request.url));
  }

  if (code) {
    const { data, error: exchangeError } = await supabaseAdmin.auth.exchangeCodeForSession(code);

    if (!exchangeError && data.session) {
      const user = data.session.user;

      // Check if profile exists, if not create one
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile) {
        const name = user.user_metadata?.full_name || user.user_metadata?.name || "User";
        const defaultDeviceId = `MED-${user.id.substring(0, 6).toUpperCase()}`;

        await supabaseAdmin.from("profiles").insert({
          id: user.id,
          name,
          device_id: defaultDeviceId,
          role: "Patient",
        });

        await supabaseAdmin.from("routines").insert({
          user_id: user.id,
          device_id: defaultDeviceId,
          morning: "08:00",
          afternoon: "14:00",
          night: "20:00",
          active: true,
        });
      }

      const response = NextResponse.redirect(new URL(next, request.url));

      response.cookies.set("sb-access-token", data.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });

      response.cookies.set("sb-refresh-token", data.session.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });

      return response;
    }
  }

  return NextResponse.redirect(new URL("/login?error=google_auth_failed", request.url));
}
