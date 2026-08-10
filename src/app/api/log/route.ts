import { NextResponse } from "next/server";

// NOTE: Firestore はここで書かない。client SDK はサーバー上では未認証で
// ルールに弾かれ、しかも失敗するまで数秒ハングする。保存はブラウザ側で行う
// （QuickInput / WorkoutTab が saveDailyLog を直接呼ぶ）。
// このルートはスプレッドシート(GAS)への転送だけを担当する。

// ユーザーが設定画面で登録した自分のGAS URL のみを受け付ける
function resolveEndpoint(url: unknown): string | null {
  const s = typeof url === 'string' ? url.trim() : '';
  return /^https:\/\/script\.google\.com\//.test(s) ? s : null;
}

export async function POST(request: Request) {
  const body = await request.json();
  const { date, weight, workout } = body;
  const GAS_ENDPOINT = resolveEndpoint(body.gas);

  if (!date) {
    return NextResponse.json({ error: "date is required" }, { status: 400 });
  }

  // 設定タブで自分のシートを連携している場合のみ、そのシートにも書き込む（Gemini参照用）
  if (GAS_ENDPOINT) {
    try {
      const payload = { action: "appendLog", date, weight, workout };
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
