import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST() {
  try {
    // Optionally trigger Supabase signout (ignores errors if token expired)
    await supabase.auth.signOut();
  } catch (err) {
    console.error("Supabase signOut error:", err);
  }

  const response = NextResponse.json({ success: true });
  
  // Clear tokens from cookies
  response.cookies.set("sb-access-token", "", {
    httpOnly: true,
    expires: new Date(0),
    path: "/",
  });

  response.cookies.set("sb-refresh-token", "", {
    httpOnly: true,
    expires: new Date(0),
    path: "/",
  });

  return response;
}
