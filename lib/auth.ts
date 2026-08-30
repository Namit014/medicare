import { NextRequest } from "next/server";
import { supabase, supabaseAdmin } from "@/lib/supabase";

export async function getUserFromRequest(req: NextRequest) {
  const tokenCookie = req.cookies.get("sb-access-token");
  if (!tokenCookie) return null;

  // Retrieve user session from Supabase using the HTTP-only cookie access token
  const { data, error } = await supabase.auth.getUser(tokenCookie.value);
  if (error || !data.user) return null;

  const user = data.user;

  // Fetch additional profile data from public.profiles table
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("name, device_id, role")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    email: user.email,
    name: profile?.name || user.user_metadata?.name || "User",
    deviceId: profile?.device_id || "",
    role: profile?.role || "",
  };
}
