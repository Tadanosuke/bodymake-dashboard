import { NextResponse } from "next/server";
import type { GasResponse } from "@/lib/dashboard";

// 各ユーザーは自分のスプレッドシート(GASのURL)を設定画面から登録する。
// 未設定なら Firestore のみで動作し、Gemini連携(カロリー/AI計画)は無効。
function resolveEndpoint(param: string | null): string | null {
  const url = (param || '').trim();
  return /^https:\/\/script\.google\.com\//.test(url) ? url : null;
}

// GAS の実測は 2〜3 秒。それを大きく超えたら諦めて空を返し、
// アプリ側は Firestore のデータだけで描画を続ける（無限ローディング防止）。
const GAS_TIMEOUT_MS = 12_000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const endpoint = resolveEndpoint(searchParams.get('gas'));

  if (!endpoint) return NextResponse.json({ logs: [], aiPlan: null } satisfies GasResponse);

  // NOTE: Firestore はここで読まない。client SDK はサーバー上では未認証で
  // セキュリティルールに弾かれるうえ、失敗するまで数十秒ハングする。
  // マージは認証済みのブラウザ側 (buildDashboard) で行う。
  try {
    const res = await fetch(`${endpoint}?action=getDashboard`, {
      cache:  'no-store',
      signal: AbortSignal.timeout(GAS_TIMEOUT_MS),
    });
    if (!res.ok) return NextResponse.json({ logs: [], aiPlan: null, error: `GAS ${res.status}` });

    const json = await res.json();
    if (!json || json.error) {
      return NextResponse.json({ logs: [], aiPlan: null, error: json?.error ?? 'bad response' });
    }
    return NextResponse.json({ logs: json.logs ?? [], aiPlan: json.aiPlan ?? null } satisfies GasResponse);
  } catch (e) {
    const timedOut = e instanceof Error && e.name === 'TimeoutError';
    return NextResponse.json({
      logs: [], aiPlan: null,
      error: timedOut ? 'スプレッドシートの応答がありませんでした' : 'スプレッドシートに接続できませんでした',
    });
  }
}
