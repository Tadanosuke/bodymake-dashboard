import { NextResponse } from "next/server";
import { saveDailyLog } from "@/lib/firestore";

// ユーザーが設定画面で登録した自分のGAS URL のみを受け付ける
function resolveEndpoint(url: unknown): string | null {
  const s = typeof url === 'string' ? url.trim() : '';
  return /^https:\/\/script\.google\.com\//.test(s) ? s : null;
}

export async function POST(request: Request) {
  const body = await request.json();
  const { uid, date, weight, steps, workout, sleep, doms, tomorrow } = body;
  const GAS_ENDPOINT = resolveEndpoint(body.gas);

  if (!date) {
    return NextResponse.json({ error: "date is required" }, { status: 400 });
  }

  // Build Firebase data (only non-empty fields)
  const logData: Record<string, unknown> = {};
  if (weight && parseFloat(weight) > 0) logData.weight = parseFloat(weight);
  if (steps && parseInt(steps) > 0)     logData.steps   = parseInt(steps);
  if (workout)  logData.workout  = workout;
  if (sleep)    logData.sleep    = sleep;
  if (doms)     logData.doms     = doms;
  if (tomorrow) logData.tomorrow = tomorrow;

  // Write to Firebase (per-user path)
  if (uid) {
    await saveDailyLog(uid, date, logData);
  }

  // Also write to GAS/spreadsheet (Gemini reference — only meaningful for primary user)
  if (GAS_ENDPOINT) {
    try {
      const payload = { action: "appendLog", date, weight, steps, workout, sleep, doms, tomorrow };
      const res = await fetch(GAS_ENDPOINT, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      if (!res.ok) console.error("GAS POST failed:", res.status);
    } catch (e) {
      console.error("GAS POST error:", e);
    }
  }

  return NextResponse.json({ success: true });
}
