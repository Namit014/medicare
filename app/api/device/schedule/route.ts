import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get("deviceId");
    const localDate = searchParams.get("date") || new Date().toISOString().split("T")[0];

    if (!deviceId) {
      return NextResponse.json({ error: "deviceId parameter is required" }, { status: 400 });
    }

    // 1. Fetch routine by device_id
    const { data: routine, error: routineError } = await supabaseAdmin
      .from("routines")
      .select("*")
      .eq("device_id", deviceId)
      .maybeSingle();

    if (routineError || !routine) {
      return NextResponse.json({ error: "Device not registered or no routine found" }, { status: 404 });
    }

    // 2. Fetch today's logs for this device
    const { data: logs = [] } = await supabaseAdmin
      .from("adherence_logs")
      .select("*")
      .eq("device_id", deviceId)
      .eq("date", localDate);

    // Determine completion status
    const taken = {
      morning: logs?.some((l) => l.slot === "morning" && l.status === "taken") || false,
      afternoon: logs?.some((l) => l.slot === "afternoon" && l.status === "taken") || false,
      night: logs?.some((l) => l.slot === "night" && l.status === "taken") || false,
    };

    return NextResponse.json({
      success: true,
      deviceId,
      morning: routine.morning,
      afternoon: routine.afternoon,
      night: routine.night,
      active: routine.active,
      taken,
    });
  } catch (error: any) {
    console.error("Device schedule endpoint error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
