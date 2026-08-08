"use client";

import { Dumbbell, Footprints, Flame, Beef } from "lucide-react";
import type { LogEntry } from "@/lib/types";

interface Props {
  logs: LogEntry[];
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return {
    month: d.getMonth() + 1,
    day: d.getDate(),
    weekday: ["日", "月", "火", "水", "木", "金", "土"][d.getDay()],
  };
}

export default function LogView({ logs }: Props) {
  return (
    <div className="px-4 pb-4 fade-in">
      <div className="pt-12 pb-5">
        <p className="text-[11px] text-purple-400 font-semibold tracking-widest uppercase mb-1">HISTORY</p>
        <h1 className="text-2xl font-bold text-white">記録ログ</h1>
        <p className="text-sm text-slate-500 mt-0.5">直近{logs.length}件のデータ</p>
      </div>

      <div className="space-y-3">
        {logs.map((log, i) => {
          const { month, day, weekday } = formatDate(log.date);
          return (
            <div
              key={log.date}
              className="bg-[#111827] border border-[#1e2d40] rounded-2xl p-4 fade-in"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              {/* Date row */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[#1a2235] flex flex-col items-center justify-center border border-[#2a3a55]">
                    <span className="text-[10px] text-slate-500">{month}月</span>
                    <span className="text-base font-black text-slate-200 leading-none">{day}</span>
                    <span className="text-[9px] text-slate-500">{weekday}</span>
                  </div>
                  <div>
                    <p className="text-xl font-black text-white">{log.weight} <span className="text-sm font-medium text-slate-400">kg</span></p>
                    {i < logs.length - 1 && (
                      <p className={`text-xs font-medium ${
                        log.weight < logs[i + 1].weight ? "text-emerald-400" :
                        log.weight > logs[i + 1].weight ? "text-red-400" : "text-slate-500"
                      }`}>
                        {log.weight < logs[i + 1].weight ? "▼" : log.weight > logs[i + 1].weight ? "▲" : "→"}
                        {" "}
                        {Math.abs(log.weight - logs[i + 1].weight).toFixed(1)} kg
                      </p>
                    )}
                  </div>
                </div>
                {log.workout && (
                  <div className="flex items-center gap-1 bg-purple-500/10 border border-purple-500/20 rounded-full px-2 py-1">
                    <Dumbbell size={10} className="text-purple-400" />
                    <span className="text-[9px] text-purple-300">トレーニング</span>
                  </div>
                )}
              </div>

              {/* Metrics row */}
              <div className="grid grid-cols-4 gap-1.5">
                <div className="flex flex-col items-center bg-[#0f1a2b] rounded-xl p-2">
                  <Flame size={11} className="text-amber-400 mb-0.5" />
                  <p className="text-xs font-bold text-slate-200">{log.calories.toLocaleString()}</p>
                  <p className="text-[9px] text-slate-600">kcal</p>
                </div>
                <div className="flex flex-col items-center bg-[#0f1a2b] rounded-xl p-2">
                  <Beef size={11} className="text-blue-400 mb-0.5" />
                  <p className="text-xs font-bold text-slate-200">{log.protein}g</p>
                  <p className="text-[9px] text-slate-600">P</p>
                </div>
                <div className="flex flex-col items-center bg-[#0f1a2b] rounded-xl p-2">
                  <span className="text-[10px] text-purple-400 mb-0.5 font-bold">F</span>
                  <p className="text-xs font-bold text-slate-200">{log.fat}g</p>
                  <p className="text-[9px] text-slate-600">脂質</p>
                </div>
                <div className="flex flex-col items-center bg-[#0f1a2b] rounded-xl p-2">
                  <Footprints size={11} className="text-teal-400 mb-0.5" />
                  <p className="text-xs font-bold text-slate-200">{log.steps >= 1000 ? `${(log.steps / 1000).toFixed(1)}k` : log.steps}</p>
                  <p className="text-[9px] text-slate-600">歩</p>
                </div>
              </div>

              {/* Workout note */}
              {log.workout && (
                <div className="mt-2 flex items-center gap-1.5">
                  <Dumbbell size={11} className="text-slate-500 shrink-0" />
                  <p className="text-xs text-slate-500 truncate">{log.workout}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
