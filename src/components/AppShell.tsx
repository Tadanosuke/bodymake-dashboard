"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Home, PenLine, Dumbbell, History, LogOut, RefreshCw } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import AuthGate, { useCurrentUser } from "./AuthGate";
import Dashboard from "./Dashboard";
import QuickInput from "./QuickInput";
import LogView from "./LogView";
import type { DashboardData } from "@/lib/types";

const WorkoutTab = dynamic(() => import("./WorkoutTab"), { ssr: false });

type Tab = "home" | "today" | "workout" | "history";

// ─── Inner shell (needs UserContext from AuthGate) ────────────────────────────
function AppShellInner() {
  const currentUser = useCurrentUser();
  const uid = currentUser?.uid ?? '';

  const [activeTab,   setActiveTab]   = useState<Tab>("home");
  const [data,        setData]        = useState<DashboardData | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [refreshKey,  setRefreshKey]  = useState(0);

  const fetchData = async (uid: string, silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch(`/api/sheets?uid=${uid}&t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      setData(json);
    } catch {
      console.error("Failed to load data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    fetchData(uid);
  }, [uid]);

  // Manual refresh trigger
  useEffect(() => {
    if (!uid || refreshKey === 0) return;
    fetchData(uid, true);
  }, [refreshKey]);

  // Auto-refresh every 60 seconds (silent)
  useEffect(() => {
    if (!uid) return;
    const id = setInterval(() => fetchData(uid, true), 60_000);
    return () => clearInterval(id);
  }, [uid]);

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
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0f1e]">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: "80px" }}>
        {loading ? (
          <div className="flex items-center justify-center min-h-screen">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
              <p className="text-slate-400 text-sm">読み込み中...</p>
            </div>
          </div>
        ) : (
          <>
            {activeTab === "home"    && data && <Dashboard data={data} />}
            {activeTab === "today"   && <QuickInput onSubmit={handleLogSubmit} />}
            {activeTab === "workout" && <WorkoutTab aiPlan={data?.aiPlan} />}
            {activeTab === "history" && data && <LogView logs={data.logs} />}
          </>
        )}
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

          {/* Logout */}
          {auth && (
            <button
              onClick={handleLogout}
              className="flex flex-col items-center gap-1 py-2 px-3 text-slate-600 hover:text-slate-400 transition-colors shrink-0"
              title="ログアウト"
            >
              <LogOut size={18} />
              <span className="text-[9px]">ログアウト</span>
            </button>
          )}
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
