"use client";

import { useState, useEffect } from "react";
import { Link2, Check, AlertCircle, ExternalLink, FileSpreadsheet, LogOut } from "lucide-react";
import { getUserSettings, saveUserSettings } from "@/lib/firestore";
import { useCurrentUser } from "./AuthGate";

const TEMPLATE_ID = process.env.NEXT_PUBLIC_TEMPLATE_SPREADSHEET_ID ?? "";

interface Props {
  onSaved: () => void;
  onLogout: () => void;
}

export default function Settings({ onSaved, onLogout }: Props) {
  const currentUser = useCurrentUser();
  const uid   = currentUser?.uid ?? "";
  const email = currentUser?.email ?? "";

  const [endpoint, setEndpoint] = useState("");
  const [loading,  setLoading]  = useState(true);
  const [status,   setStatus]   = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errMsg,   setErrMsg]   = useState("");

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    getUserSettings(uid)
      .then(s => setEndpoint(s.gasEndpoint ?? ""))
      .finally(() => setLoading(false));
  }, [uid]);

  const handleSave = async () => {
    const url = endpoint.trim();
    if (url && !/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(url)) {
      setStatus("error");
      setErrMsg("URLの形式が違います。末尾が /exec のウェブアプリURLを貼り付けてください。");
      return;
    }
    setStatus("saving");
    setErrMsg("");
    try {
      // 接続テスト（空欄なら連携解除として保存）。
      // 応答が無いまま「保存中」で固まらないよう必ず打ち切る。
      if (url) {
        try {
          const res  = await fetch(`/api/sheets?gas=${encodeURIComponent(url)}`, {
            cache: "no-store", signal: AbortSignal.timeout(15_000),
          });
          const json = await res.json();
          if (json.error)            setErrMsg(`注意: ${json.error}`);
          else if (!json.logs?.length) setErrMsg("接続できましたが、データが空でした。まだ記録がない場合は正常です。");
        } catch {
          setErrMsg("注意: スプレッドシートに接続できませんでしたが、URLは保存します。");
        }
      }
      await saveUserSettings(uid, { gasEndpoint: url });
      setStatus("saved");
      onSaved();
      setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("error");
      setErrMsg("保存に失敗しました。通信環境を確認してもう一度お試しください。");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  const connected = !!endpoint.trim();

  return (
    <div className="px-4 pb-8 fade-in">
      <div className="pt-10 pb-4">
        <p className="text-[11px] text-blue-400 font-semibold tracking-widest uppercase mb-0.5">SETTINGS</p>
        <h1 className="text-2xl font-bold text-white">設定</h1>
        <p className="text-xs text-slate-500 mt-0.5">{email}</p>
      </div>

      {/* 接続状態 */}
      <div className={`rounded-2xl p-4 mb-3 border-2 ${
        connected ? "bg-emerald-500/5 border-emerald-500/30" : "bg-[#111827] border-[#1e2d40]"
      }`}>
        <div className="flex items-center gap-2 mb-1">
          {connected
            ? <><Check size={15} className="text-emerald-400" /><span className="text-xs font-bold text-emerald-400">スプレッドシート連携中</span></>
            : <><AlertCircle size={15} className="text-slate-500" /><span className="text-xs font-bold text-slate-400">未連携（アプリ内保存のみ）</span></>}
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          {connected
            ? "カロリー・AI計画がスプレッドシートから読み込まれます。"
            : "記録はアプリに保存されます。カロリー分析とAI計画を使うにはスプレッドシートを連携してください。"}
        </p>
      </div>

      {/* GAS URL 入力 */}
      <div className="bg-[#111827] border border-[#1e2d40] rounded-2xl p-4 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <Link2 size={14} className="text-blue-400" />
          <span className="text-xs font-semibold text-slate-200">自分のスプレッドシートURL</span>
        </div>
        <input
          type="url"
          value={endpoint}
          onChange={e => { setEndpoint(e.target.value); if (status !== "idle") setStatus("idle"); }}
          placeholder="https://script.google.com/macros/s/.../exec"
          autoCapitalize="off" autoCorrect="off" spellCheck={false}
          className="w-full bg-[#0f1a2b] border border-[#1e2d40] rounded-xl px-3 py-3 text-xs text-slate-200 placeholder-slate-700 outline-none focus:border-blue-500/50"
          style={{ colorScheme: "dark" }}
        />

        {errMsg && <p className="text-[11px] text-amber-400 mt-2 leading-relaxed">{errMsg}</p>}
        {status === "saved" && <p className="text-[11px] text-emerald-400 mt-2">✓ 保存しました</p>}

        <button
          type="button" onClick={handleSave} disabled={status === "saving"}
          className="w-full mt-3 py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center transition-all active:scale-95 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)" }}
        >
          {status === "saving"
            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : "保存して接続"}
        </button>
      </div>

      {/* セットアップ手順 */}
      <div className="bg-[#111827] border border-[#1e2d40] rounded-2xl p-4 mb-3">
        <div className="flex items-center gap-2 mb-3">
          <FileSpreadsheet size={14} className="text-emerald-400" />
          <span className="text-xs font-semibold text-slate-200">初めての方 — 自分専用シートの作り方</span>
        </div>

        <ol className="space-y-3 text-[11px] text-slate-400 leading-relaxed">
          <li>
            <span className="text-blue-400 font-bold">1.</span> テンプレートを自分のGoogleドライブにコピー
            {TEMPLATE_ID ? (
              <a
                href={`https://docs.google.com/spreadsheets/d/${TEMPLATE_ID}/copy`}
                target="_blank" rel="noopener noreferrer"
                className="mt-1.5 flex items-center justify-center gap-1.5 bg-emerald-600/15 border border-emerald-600/30 text-emerald-300 rounded-lg py-2.5 font-bold active:scale-95 transition-all"
              >
                <ExternalLink size={12} /> テンプレートをコピー
              </a>
            ) : (
              <p className="text-slate-600 mt-1">（テンプレート準備中）</p>
            )}
          </li>
          <li>
            <span className="text-blue-400 font-bold">2.</span> コピーしたシートで
            <span className="text-slate-300">拡張機能 → Apps Script</span> を開く
          </li>
          <li>
            <span className="text-blue-400 font-bold">3.</span>
            <span className="text-slate-300">デプロイ → 新しいデプロイ → ウェブアプリ</span> を選び、
            <span className="text-slate-300">アクセスできるユーザー = 全員</span> にしてデプロイ
          </li>
          <li>
            <span className="text-blue-400 font-bold">4.</span> 表示された
            <span className="text-slate-300"> /exec で終わるURL</span> を上の欄に貼り付けて保存
          </li>
          <li>
            <span className="text-blue-400 font-bold">5.</span> Gemini（またはお好きなAI）にそのスプレッドシートを共有すれば、
            カロリー計算やAI計画メニューの自動作成が使えます
          </li>
        </ol>

        <p className="text-[10px] text-slate-600 mt-3 leading-relaxed border-t border-[#1e2d40] pt-3">
          連携しなくてもアプリは使えます。体重・筋トレ・睡眠の記録はあなたのアカウント内に保存され、
          他の人からは見えません。
        </p>
      </div>

      <button
        type="button" onClick={onLogout}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-[#1e2d40] text-slate-500 hover:text-slate-300 text-sm font-semibold transition-colors"
      >
        <LogOut size={14} /> ログアウト
      </button>
    </div>
  );
}
