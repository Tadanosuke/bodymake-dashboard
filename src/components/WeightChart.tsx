"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import type { WeightEntry } from "@/lib/types";

interface Props {
  data: WeightEntry[];
  phaseTarget: number;
  finalTarget: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a2235] border border-[#2a3a55] rounded-xl p-3 text-xs shadow-xl">
      <p className="text-slate-300 font-semibold mb-1">{label}</p>
      {payload.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any) =>
          p.value != null && (
            <p key={p.dataKey} style={{ color: p.color }} className="mt-0.5">
              {p.name}: {p.value.toFixed(1)} kg
            </p>
          )
      )}
    </div>
  );
};

export default function WeightChart({ data, phaseTarget, finalTarget }: Props) {
  if (!data || data.length === 0) {
    return <div className="h-52 flex items-center justify-center text-slate-500 text-sm">データなし</div>;
  }

  const validValues = data
    .flatMap((d) => [d.weight, d.trendWeight, d.targetGuide])
    .filter((v): v is number => typeof v === "number" && v > 0);
  const minWeight = validValues.length > 0 ? Math.min(...validValues) - 1 : phaseTarget - 5;
  const maxWeight = validValues.length > 0 ? Math.max(...validValues) + 1 : phaseTarget + 5;

  return (
    <div className="w-full h-52">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2d40" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: "#64748b" }}
            tickLine={false}
            axisLine={false}
            interval={2}
          />
          <YAxis
            domain={[Math.floor(minWeight), Math.ceil(maxWeight)]}
            tick={{ fontSize: 9, fill: "#64748b" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: "10px", paddingTop: "8px" }}
            iconType="circle"
            iconSize={6}
          />
          <ReferenceLine y={phaseTarget} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1} />
          <ReferenceLine y={finalTarget} stroke="#10b981" strokeDasharray="4 4" strokeWidth={1} />
          <Line
            dataKey="weight"
            name="実測"
            stroke="#3b82f6"
            strokeWidth={0}
            dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "#60a5fa" }}
            connectNulls={false}
          />
          <Line
            dataKey="trendWeight"
            name="実質体重"
            stroke="#67e8f9"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, fill: "#a5f3fc" }}
            connectNulls={false}
            type="monotone"
          />
          <Line
            dataKey="targetGuide"
            name="目標ガイド"
            stroke="#c4b5fd"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            activeDot={{ r: 4, fill: "#ddd6fe" }}
            connectNulls={false}
            type="monotone"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
