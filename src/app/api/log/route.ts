import { NextResponse } from "next/server";

const GAS_ENDPOINT = process.env.GAS_ENDPOINT;

export async function POST(request: Request) {
  const body = await request.json();

  const { date, weight, calories, protein, fat, carbs, steps, workout } = body;

  if (!date || weight == null) {
    return NextResponse.json({ error: "date and weight are required" }, { status: 400 });
  }

  if (GAS_ENDPOINT) {
    try {
      const res = await fetch(GAS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "appendLog", date, weight, calories, protein, fat, carbs, steps, workout }),
      });
      if (!res.ok) throw new Error("GAS POST failed");
      const data = await res.json();
      return NextResponse.json(data);
    } catch (e) {
      console.error("GAS POST error:", e);
      return NextResponse.json({ error: "Failed to save to spreadsheet" }, { status: 500 });
    }
  }

  // Dev mode: just echo back success
  return NextResponse.json({ success: true, message: "Demo mode: data not persisted. Set GAS_ENDPOINT to connect Google Sheets.", entry: body });
}
