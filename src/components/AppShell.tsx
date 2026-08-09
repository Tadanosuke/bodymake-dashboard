"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Home, PenLine, Dumbbell, History, Settings as SettingsIcon, RefreshCw } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserSettings, getRecentDailyLogs } from "@/lib/firestore";
import { buildDashboard, type GasResponse } from "@/lib/dashboard";
import AuthGate, { useCurrentUser } from "./AuthGate";
import Dashboard from "./Dashboard";
import QuickInput from "./QuickInput";
import LogView from "./LogView";
import Settings from "./Settings";
import type { DashboardData } from "@/lib/types";

const WorkoutTab = dynamic(() => import("./WorkoutTab"), { ssr: false });

type Tab = "home" | "today" | "workout" | "history" | "settings";

// Firestore の client SDK はオフライン時に reject せず無限に待つことがあるので、
// 必ず上限を設けてフォールバック値で先に進む。
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p.catch(() => fallback),
    new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);
}

function LoadingPane() {
  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        <p className="text-slate-400 text-sm">読み込み中...</p>
      </div>
    </div>
  );
}

// ─── Inner shell (needs UserContext from AuthGate) ────────────────────────────
function AppShellInner() {
  const currentUser = useCurrentUser();
  const uid = currentUser?.uid ?? '';

  const [activeTab,   setActiveTab]   = useState<Tab>("home");
  const [data,        setData]        = useState<DashboardData | null>(null);
  const [refreshing,  setRefreshing]  = useState(false);
  const [refreshKey,  setRefreshKey]  = useState(0);
  // 各ユーザー自身のスプレッドシート接続先 (undefined = 読込中, '' = 未連携)
  const [gasEndpoint, setGasEndpoint] = useState<string | undefined>(undefined);
  const [gasError,    setGasError]    = useState("");

  const fetchData = async (uid: string, gas: string, silent = false) => {
    if (silent) setRefreshing(true);
    try {
      // スプレッドシート(GAS)と Firestore を並行取得してからマージする。
      // Firestore はここ(ブラウザ)でしか読めない — 認証情報があるのはクライアントだけ。
      const gasPromise: Promise<GasResponse> = gas
        ? fetch(`/api/sheets?gas=${encodeURIComponent(gas)}&t=${Date.now()}`, { cache: 'no-store' })
            .then(r => r.json())
            .catch(() => ({ logs: [], aiPlan: null }))
        : Promise.resolve({ logs: [], aiPlan: null });

      const [gasData, fsLogs] = await Promise.all([
        withTimeout(gasPromise, 15_000, { logs: [], aiPlan: null }),
        withTimeout(getRecentDailyLogs(uid, 60), 8_000, []),
      ]);

      setGasError(typeof gasData.error === 'string' ? gasData.error : '');
      setData(buildDashboard(fsLogs, gasData));
    } finally {
      setRefreshing(false);
    }
  };

  // 1. ログイン後、まずこのユーザーの接続先を取得
  useEffect(() => {
    if (!uid) { setData(buildDashboard([], {})); return; }
    withTimeout(getUserSettings(uid), 8_000, {})
      .then(s => setGasEndpoint(s.gasEndpoint ?? ''));
  }, [uid]);

  // 2. 接続先が判明したらデータ取得
  useEffect(() => {
    if (!uid || gasEndpoint === undefined) return;
    fetchData(uid, gasEndpoint);
  }, [uid, gasEndpoint]);

  // Manual refresh trigger
  useEffect(() => {
    if (!uid || refreshKey === 0 || gasEndpoint === undefined) return;
    fetchData(uid, gasEndpoint, true);
  }, [refreshKey]);

  // Auto-refresh every 60 seconds (silent)
  useEffect(() => {
    if (!uid || gasEndpoint === undefined) return;
    const id = setInterval(() => fetchData(uid, gasEndpoint, true), 60_000);
    return () => clearInterval(id);
  }, [uid, gasEndpoint]);

  // 設定画面で連携先を変更したら即再取得
  const handleSettingsSaved = () => {
    if (!uid) return;
    getUserSettings(uid).then(s => setGasEndpoint(s.gasEndpoint ?? ''));
  };

  const handleLogSubmit = () => {
    setRefreshKey((k) => k + 1);
    setActiveTab("home");
  };

  const handleLogout = async () => {
    if (!auth) return;
    try { await signOut(auth); } catch {}
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "home",    label: "ホーム",  icon: <Home    size={22} /> },
    { id: "today",   label: "今日",    icon: <PenLine size={22} /> },
    { id: "workout", label: "筋トレ",  icon: <Dumbbell size={22} /> },
    { id: "history", label: "履歴",    icon: <History size={22} /> },
    { id: "settings", label: "設定",   icon: <SettingsIcon size={22} /> },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0f1e]">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: "80px" }}>
        {/* ダッシュボードの読込中でも「今日」「筋トレ」「設定」は即座に開けるようにする。
            スプレッドシートが遅い/落ちている時にアプリ全体が固まらないため。 */}
        {gasError && activeTab === "home" && (
          <div className="mx-4 mt-4 rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2">
            <p className="text-[11px] text-amber-300">{gasError}（設定タブでURLを確認してください）</p>
          </div>
        )}

        {activeTab === "home" && (
          data ? <Dashboard data={data} /> : <LoadingPane />
        )}
        {activeTab === "today"   && <QuickInput onSubmit={handleLogSubmit} gasEndpoint={gasEndpoint ?? ''} />}
        {activeTab === "workout" && <WorkoutTab aiPlan={data?.aiPlan} gasEndpoint={gasEndpoint ?? ''} />}
        {activeTab === "history" && (
          data ? <LogView logs={data.logs} /> : <LoadingPane />
        )}
        {activeTab === "settings" && <Settings onSaved={handleSettingsSaved} onLogout={handleLogout} />}
      </div>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0d1526]/95 backdrop-blur-md border-t border-[#1e2d40]">
        <div
          className="flex items-center"
          style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))" }}
        >
          {/* Tab buttons */}
          <div className="flex flex-1 items-center justify-around">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex flex-col items-center gap-1 py-2 px-4 transition-colors ${
                  activeTab === tab.id
                    ? tab.id === "workout" ? "text-red-400" : "text-blue-400"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {tab.icon}
                <span className="text-[10px] font-medium">{tab.label}</span>
                {activeTab === tab.id && (
                  <span className={`absolute bottom-0 w-8 h-0.5 rounded-full ${tab.id === "workout" ? "bg-red-400" : "bg-blue-400"}`} />
                )}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={refreshing}
            className="flex flex-col items-center gap-1 py-2 px-3 text-slate-600 hover:text-slate-400 transition-colors shrink-0 disabled:opacity-40"
            title="更新"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            <span className="text-[9px]">更新</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

// ─── Outer shell — wraps with AuthGate ───────────────────────────────────────
export default function AppShell() {
  return (
    <AuthGate>
      <AppShellInner />
    </AuthGate>
  );
}
