"use client";

import { Target, CheckCircle2 } from "lucide-react";
import type { Milestone } from "@/lib/types";

interface Props {
  milestones: Milestone[];
  currentWeight: number;
  startWeight: number;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function MilestoneCards({ milestones, currentWeight, startWeight }: Props) {
  const achieved = milestones.filter(m => m.achieved);
  const next     = milestones.find(m => !m.achieved);

  if (!next && achieved.length === 0) return null;

  // Progress from last achieved milestone (or startWeight) toward next
  const fromWeight = achieved.length > 0
    ? Math.max(...achieved.map(m => m.weight))
    : startWeight;
  const progress = next
    ? Math.min(100, Math.max(0, ((fromWeight - currentWeight) / (fromWeight - next.weight)) * 100))
    : 100;

  return (
    <div className="space-y-3">
      {next ? (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target size={14} className="text-blue-400" />
            <span className="text-[10px] font-black text-blue-400 tracking-widest uppercase">Next Target</span>
          </div>

          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="text-3xl font-black text-blue-300">
                {next.weight} <span className="text-base font-medium text-slate-400">kg</span>
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{next.label}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-white">
                あと {(currentWeight - next.weight).toFixed(1)}
                <span className="text-sm font-medium text-slate-400"> kg</span>
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">目標 {formatDate(next.idealDate)}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-[10px] text-slate-500 mb-1.5">
              <span>{fromWeight} kg</span>
              <span className="text-blue-400 font-bold">{progress.toFixed(0)}%</span>
              <span>{next.weight} kg</span>
            </div>
            <div className="h-2.5 bg-[#1e2d40] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 to-purple-500"
                style={{ width: `${progress}%`, transition: 'width 1s ease-out' }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-3xl mb-2">🏆</p>
          <p className="text-sm font-bold text-emerald-400">全マイルストーン達成！</p>
        </div>
      )}

      {/* Achieved dots */}
      {milestones.length > 0 && (
        <div className="flex items-center gap-2 px-1">
          <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />
          <div className="flex gap-1.5 flex-1">
            {milestones.map(m => (
              <div
                key={m.weight}
                title={`${m.weight}kg — ${m.label}`}
                className={`flex-1 h-1.5 rounded-full transition-colors ${m.achieved ? 'bg-emerald-500' : 'bg-[#1e2d40]'}`}
              />
            ))}
          </div>
          <span className="text-[10px] text-emerald-400 font-bold shrink-0">
            {achieved.length}/{milestones.length}
          </span>
        </div>
      )}
    </div>
  );
}
