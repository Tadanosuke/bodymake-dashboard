import { NextResponse } from "next/server";

const GAS_ENDPOINT = process.env.GAS_ENDPOINT;

export async function POST(request: Request) {
  const body = await request.json();
  const { date, weight, steps, workout, sleep, doms, tomorrow } = body;

  if (!date || weight == null) {
    return NextResponse.json({ error: "date and weight are required" }, { status: 400 });
  }

  const payload = { action: "appendLog", date, weight, steps, workout, sleep, doms, tomorrow };

  if (GAS_ENDPOINT) {
    try {
      const res = await fetch(GAS_ENDPOINT, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("GAS POST failed");
      const data = await res.json();
      return NextResponse.json(data);
    } catch (e) {
      console.error("GAS POST error:", e);
      return NextResponse.json({ error: "Failed to save to spreadsheet" }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, message: "Demo mode — set GAS_ENDPOINT to persist data.", entry: payload });
}
