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
  const minWeight = Math.min(
    ...data.map((d) => Math.min(d.weight ?? 999, d.predicted ?? 999, d.ideal)).filter((v) => v < 999)
  ) - 1;
  const maxWeight = Math.max(
    ...data.map((d) => Math.max(d.weight ?? 0, d.predicted ?? 0, d.ideal))
  ) + 1;

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
            dataKey="ideal"
            name="理想ライン"
            stroke="#334155"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            dot={false}
            activeDot={false}
          />
          <Line
            dataKey="predicted"
            name="予測"
            stroke="#8b5cf6"
            strokeWidth={2}
            dot={{ r: 2, fill: "#8b5cf6" }}
            connectNulls={false}
          />
          <Line
            dataKey="weight"
            name="実績"
            stroke="#3b82f6"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "#60a5fa" }}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
