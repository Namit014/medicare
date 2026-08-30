import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { deviceId, slot, status, date } = await request.json();
    const localDate = date || new Date().toISOString().split("T")[0];

    if (!deviceId || !slot || !status) {
      return NextResponse.json(
        { error: "deviceId, slot, and status are required" },
        { status: 400 }
      );
    }

    if (!["morning", "afternoon", "night"].includes(slot)) {
      return NextResponse.json({ error: "Invalid slot name" }, { status: 400 });
    }

    // 1. Find the routine config to identify the owner
    const { data: routine, error: routineError } = await supabaseAdmin
      .from("routines")
      .select("*")
      .eq("device_id", deviceId)
      .maybeSingle();

    if (routineError || !routine) {
      return NextResponse.json({ error: "Device ID not registered" }, { status: 404 });
    }

    if (status === "taken") {
      // 2. Upsert log as taken (re-write or insert if empty)
      const { data: log, error: upsertError } = await supabaseAdmin
        .from("adherence_logs")
        .upsert({
          user_id: routine.user_id,
          device_id: deviceId,
          date: localDate,
          slot,
          status: "taken",
          due_at: routine[slot],
          taken_at: new Date().toISOString(),
        }, { onConflict: "user_id,date,slot" })
        .select()
        .single();

      if (upsertError) {
        throw new Error(`Failed to log intake: ${upsertError.message}`);
      }

      return NextResponse.json({
        success: true,
        message: `Successfully logged ${slot} pill as taken`,
        log,
      });
    } else if (status === "pending" || status === "reset") {
      // 3. Clear/Delete today's log to reset for testing/simulation
      const { error: deleteError } = await supabaseAdmin
        .from("adherence_logs")
        .delete()
        .eq("user_id", routine.user_id)
        .eq("date", localDate)
        .eq("slot", slot);

      if (deleteError) {
        throw new Error(`Failed to reset log: ${deleteError.message}`);
      }

      return NextResponse.json({
        success: true,
        message: `Successfully reset ${slot} pill state`,
      });
    } else {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Device status write error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
