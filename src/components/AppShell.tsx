"use client";

import { useState, useEffect } from "react";
import { BarChart2, PlusCircle, ClipboardList } from "lucide-react";
import Dashboard from "./Dashboard";
import QuickInput from "./QuickInput";
import LogView from "./LogView";
import type { DashboardData } from "@/lib/types";

type Tab = "dashboard" | "input" | "log";

export default function AppShell() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/sheets");
        const json = await res.json();
        setData(json);
      } catch {
        console.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [refreshKey]);

  const handleLogSubmit = () => {
    setRefreshKey((k) => k + 1);
    setActiveTab("dashboard");
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard", label: "ダッシュボード", icon: <BarChart2 size={22} /> },
    { id: "input",     label: "記録する",       icon: <PlusCircle size={22} /> },
    { id: "log",       label: "ログ",           icon: <ClipboardList size={22} /> },
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
            {activeTab === "dashboard" && data && <Dashboard data={data} />}
            {activeTab === "input" && <QuickInput onSubmit={handleLogSubmit} />}
            {activeTab === "log" && data && <LogView logs={data.logs} />}
          </>
        )}
      </div>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0d1526]/95 backdrop-blur-md border-t border-[#1e2d40]">
        <div className="flex items-center justify-around" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))" }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-1 py-2 px-6 transition-colors ${
                activeTab === tab.id
                  ? "text-blue-400"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {tab.icon}
              <span className="text-[10px] font-medium">{tab.label}</span>
              {activeTab === tab.id && (
                <span className="absolute bottom-0 w-8 h-0.5 bg-blue-400 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
