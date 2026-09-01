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

    // Determine active slots for the requested localDate
    const now = new Date(localDate);
    const dayOfWeek = now.getDay();
    
    const slotsArr = routine.slots || [];
    const dateSlotsArr = routine.date_specific_slots?.[localDate] || [];
    
    // Filter recurring slots for today
    const activeRecurringSlots = slotsArr.filter((s: any) => {
      if (s.date && s.date !== localDate) return false;
      if (s.date === localDate) return true;
      if (s.daysOfWeek && s.daysOfWeek.length > 0) return s.daysOfWeek.includes(dayOfWeek);
      if (s.date) return false; // has date but didn't match
      return true; // daily if missing daysOfWeek
    });
    
    // Combine and sort chronologically
    const combinedSlots = [...activeRecurringSlots, ...dateSlotsArr];
    combinedSlots.sort((a: any, b: any) => {
      const timeA = a.time || "00:00";
      const timeB = b.time || "00:00";
      return timeA.localeCompare(timeB);
    });
    
    // ESP32 only has 3 physical sensors, so take the first 3
    const top3Slots = combinedSlots.slice(0, 3).map((s: any) => ({
      id: s.id,
      time: s.time,
      name: s.name
    }));

    // Determine completion status for these specific slots
    const taken: Record<string, boolean> = {};
    top3Slots.forEach((slot: any) => {
      taken[slot.id] = logs?.some((l) => l.slot === slot.id && l.status === "taken") || false;
    });

    return NextResponse.json({
      success: true,
      deviceId,
      active: routine.active,
      slots: top3Slots,
      taken,
    });
  } catch (error: any) {
    console.error("Device schedule endpoint error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
