"use client";

import { CheckCircle2, Circle, Target } from "lucide-react";
import type { Milestone } from "@/lib/types";

interface Props {
  milestones: Milestone[];
  currentWeight: number;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function MilestoneCards({ milestones, currentWeight }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {milestones.map((m) => {
        const diff = currentWeight - m.weight;
        const isNext = !m.achieved && milestones.filter((x) => !x.achieved)[0]?.weight === m.weight;
        return (
          <div
            key={m.weight}
            className={`relative rounded-xl p-3 border transition-all ${
              m.achieved
                ? "bg-emerald-500/10 border-emerald-500/30"
                : isNext
                ? "bg-blue-500/10 border-blue-500/40"
                : "bg-[#111827] border-[#1e2d40]"
            }`}
          >
            {isNext && (
              <span className="absolute top-2 right-2 text-[9px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                NEXT
              </span>
            )}
            <div className="flex items-center gap-1.5 mb-1">
              {m.achieved ? (
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
              ) : isNext ? (
                <Target size={14} className="text-blue-400 shrink-0" />
              ) : (
                <Circle size={14} className="text-slate-600 shrink-0" />
              )}
              <span className={`text-xs font-medium ${m.achieved ? "text-emerald-400" : isNext ? "text-blue-400" : "text-slate-500"}`}>
                {m.label}
              </span>
            </div>
            <p className={`text-lg font-bold ${m.achieved ? "text-emerald-300" : isNext ? "text-blue-300" : "text-slate-400"}`}>
              {m.weight} kg
            </p>
            {m.achieved ? (
              <p className="text-[10px] text-emerald-400 mt-0.5">✓ 達成!</p>
            ) : (
              <p className="text-[10px] text-slate-500 mt-0.5">
                目標 {formatDate(m.idealDate)} | あと{diff.toFixed(1)}kg
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
