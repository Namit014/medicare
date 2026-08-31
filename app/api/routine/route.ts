import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserFromRequest } from "@/lib/auth";

// Get user's routine
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Query routines table in Supabase PostgreSQL
    let { data: routine, error } = await supabaseAdmin
      .from("routines")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    // Return null if no routine is found so the frontend knows to redirect to onboarding
    if (error || !routine) {
      return NextResponse.json({ success: true, routine: null });
    }

    return NextResponse.json({ success: true, routine });
  } catch (error: any) {
    console.error("Fetch routine error:", error);
    return NextResponse.json({ error: "Failed to fetch routine" }, { status: 500 });
  }
}

// Update user's routine
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slots, dateSpecificSlots, active, deviceId } = await request.json();

    if (slots !== undefined && !Array.isArray(slots)) {
      return NextResponse.json({ error: "Valid slots array is required" }, { status: 400 });
    }

    // 1. Check if the device ID is already registered by another account
    if (deviceId && deviceId !== user.deviceId) {
      const { data: otherProfile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("device_id", deviceId)
        .neq("id", user.id)
        .maybeSingle();

      if (otherProfile) {
        return NextResponse.json(
          { error: "Device ID is already registered to another account" },
          { status: 400 }
        );
      }
    }

    // 2. Update profiles table with new device_id if changed
    if (deviceId) {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({ device_id: deviceId })
        .eq("id", user.id);

      if (profileError) {
        throw new Error(`Profile update failed: ${profileError.message}`);
      }
    }

    // 3. Upsert routine timings using the JSONB column
    const updateData: any = {
      user_id: user.id,
      device_id: deviceId || user.deviceId,
      active: active !== undefined ? active : true,
      updated_at: new Date().toISOString(),
    };
    if (slots !== undefined) updateData.slots = slots;
    if (dateSpecificSlots !== undefined) updateData.date_specific_slots = dateSpecificSlots;

    const { data: updatedRoutine, error: routineError } = await supabaseAdmin
      .from("routines")
      .upsert(updateData, { onConflict: 'user_id' })
      .select()
      .single();

    if (routineError) {
      throw new Error(`Routine save failed: ${routineError.message}`);
    }

    return NextResponse.json({ success: true, routine: updatedRoutine });
  } catch (error: any) {
    console.error("Update routine error:", error);
    return NextResponse.json({ error: error.message || "Failed to update routine" }, { status: 500 });
  }
}
