import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: medications, error } = await supabaseAdmin
      .from("medications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, medications: medications || [] });
  } catch (error: any) {
    console.error("Fetch medications error:", error);
    return NextResponse.json({ error: "Failed to fetch medications" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, dosage, frequency, slot, notes } = await request.json();

    if (!name || !dosage || !slot) {
      return NextResponse.json(
        { error: "Medication name, dosage, and slot are required" },
        { status: 400 }
      );
    }

    const { data: medication, error } = await supabaseAdmin
      .from("medications")
      .insert({
        user_id: user.id,
        name,
        dosage,
        frequency: frequency || "daily",
        slot,
        notes: notes || "",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, medication });
  } catch (error: any) {
    console.error("Add medication error:", error);
    return NextResponse.json({ error: "Failed to add medication" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Medication ID required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("medications")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete medication error:", error);
    return NextResponse.json({ error: "Failed to delete medication" }, { status: 500 });
  }
}
