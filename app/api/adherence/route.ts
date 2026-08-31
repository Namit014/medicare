import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserFromRequest } from "@/lib/auth";

// Parse HH:MM to minutes from midnight
function parseTimeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const localDate = searchParams.get("date") || new Date().toISOString().split("T")[0];
    const localTime = searchParams.get("time") || new Date().toTimeString().split(" ")[0].substring(0, 5);

    // 1. Fetch user's routine settings from Supabase
    let { data: routine, error: routineError } = await supabaseAdmin
      .from("routines")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (routineError || !routine) {
      const defaultDeviceId = user.deviceId || `MED-${user.id.substring(0, 6).toUpperCase()}`;
      const { data: newRoutine } = await supabaseAdmin
        .from("routines")
        .insert({
          user_id: user.id,
          device_id: defaultDeviceId,
          slots: [
            { id: "1", name: "Dose 1", time: "08:00" },
            { id: "2", name: "Dose 2", time: "14:00" },
            { id: "3", name: "Dose 3", time: "20:00" }
          ],
          active: true,
        })
        .select()
        .single();
      routine = newRoutine;
    }

    const recurringSlots = routine.slots || [];
    const dateSpecificSlots = routine.date_specific_slots || {};
    const oneOffSlots = dateSpecificSlots[localDate] || [];
    
    // Merge them and deduplicate IDs if necessary, or just concat
    const slots = [...recurringSlots, ...oneOffSlots];
    const currentMinutes = parseTimeToMinutes(localTime);
    const activeWindowMinutes = 180; // 3 hours window to take pill

    // 2. Fetch today's logs from Postgres
    const { data: todayLogs = [] } = await supabaseAdmin
      .from("adherence_logs")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", localDate);

    const todayStatus: Record<string, any> = {};

    for (const slotObj of slots) {
      const slot = slotObj.id;
      const scheduledTimeStr = slotObj.time;
      const scheduledMinutes = parseTimeToMinutes(scheduledTimeStr);
      const log = todayLogs?.find((l) => l.slot === slot);

      let status = "pending";
      let takenAt = null;

      if (log) {
        status = log.status;
        takenAt = log.taken_at;

        // If log is pending but the active window has closed, auto-update to missed
        if (status === "pending" && currentMinutes > scheduledMinutes + activeWindowMinutes) {
          const { data: updatedLog } = await supabaseAdmin
            .from("adherence_logs")
            .update({ status: "missed" })
            .eq("id", log.id)
            .select()
            .single();
          status = "missed";
        } else if (status === "pending" && currentMinutes >= scheduledMinutes) {
          status = "due"; // Currently in the active alarm window
        }
      } else {
        // No log entry exists yet
        if (currentMinutes > scheduledMinutes + activeWindowMinutes) {
          // Time has passed the window, insert a missed log
          const { data: newLog } = await supabaseAdmin
            .from("adherence_logs")
            .insert({
              user_id: user.id,
              device_id: routine.device_id,
              date: localDate,
              slot,
              status: "missed",
              due_at: scheduledTimeStr,
            })
            .select()
            .single();
          status = "missed";
        } else if (currentMinutes >= scheduledMinutes) {
          // Currently inside the due window, create a pending log and trigger warning
          const { data: newLog } = await supabaseAdmin
            .from("adherence_logs")
            .insert({
              user_id: user.id,
              device_id: routine.device_id,
              date: localDate,
              slot,
              status: "pending",
              due_at: scheduledTimeStr,
            })
            .select()
            .single();
          status = "due";
        } else {
          // Future slot today
          status = "pending";
        }
      }

      todayStatus[slot] = {
        scheduled: scheduledTimeStr,
        status,
        takenAt,
      };
    }

    // 3. Retrieve all historical logs to calculate metrics
    const { data: allLogs = [] } = await supabaseAdmin
      .from("adherence_logs")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    const totalLogsCount = allLogs?.length || 0;
    const takenLogsCount = allLogs?.filter((l) => l.status === "taken").length || 0;
    const adherenceRate = totalLogsCount > 0 ? Math.round((takenLogsCount / totalLogsCount) * 100) : 100;

    // Calculate Streak
    let currentStreak = 0;
    const datesWithLogs = Array.from(new Set(allLogs?.map((l) => l.date))).sort().reverse();

    for (const date of datesWithLogs) {
      const dayLogs = allLogs?.filter((l) => l.date === date) || [];
      const daySuccess = dayLogs.every((l) => l.status === "taken" || l.status === "pending");
      const hasTaken = dayLogs.some((l) => l.status === "taken");

      if (daySuccess && hasTaken) {
        currentStreak++;
      } else if (date === localDate && dayLogs.every(l => l.status === "pending" || (parseTimeToMinutes(l.due_at) > currentMinutes))) {
        // If it's today and no pills have been due yet, don't break the streak
        continue;
      } else {
        break;
      }
    }

    // Return full history list
    const history = allLogs?.map((l) => ({
      id: l.id,
      date: l.date,
      slot: l.slot,
      status: l.status,
      dueAt: l.due_at,
      takenAt: l.taken_at,
    })) || [];

    return NextResponse.json({
      success: true,
      todayStatus,
      stats: {
        adherenceRate,
        currentStreak,
        totalTaken: takenLogsCount,
        totalMissed: allLogs?.filter((l) => l.status === "missed").length || 0,
      },
      history,
    });
  } catch (error: any) {
    console.error("Adherence API error:", error);
    return NextResponse.json({ error: "Failed to load adherence data" }, { status: 500 });
  }
}
