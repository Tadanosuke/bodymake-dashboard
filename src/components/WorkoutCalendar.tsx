"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getWorkoutDatesFS } from "@/lib/firestore";
import { getWorkoutDates } from "@/lib/exercises";
import { useCurrentUser } from "./AuthGate";

interface Props {
  selectedDate: string;
  onSelect: (date: string) => void;
  /** 呼び出し側が把握している記録日（スプレッドシート由来を含む） */
  markedDates?: string[];
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export default function WorkoutCalendar({ selectedDate, onSelect, markedDates }: Props) {
  const currentUser = useCurrentUser();
  const uid = currentUser?.uid ?? '';

  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [ownDates, setOwnDates] = useState<string[]>([]);

  useEffect(() => {
    if (!uid) { setOwnDates(getWorkoutDates()); return; }
    getWorkoutDatesFS(uid).then(dates => setOwnDates(dates.length > 0 ? dates : getWorkoutDates()));
  }, [uid]);

  const workoutDates = new Set([...(markedDates ?? []), ...ownDates]);

  const prev = () => { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); };
  const next = () => { if (month === 12) { setYear(y => y + 1); setMonth(1); } else setMonth(m => m + 1); };

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const fmt = (d: number) => `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  return (
    <div className="bg-[#1a0a0a] border border-red-900/30 rounded-2xl overflow-hidden">
      {/* Month nav */}
      <div className="flex items-center justify-between px-4 py-3 bg-red-700">
        <button type="button" onClick={prev} className="text-white/70 hover:text-white">
          <ChevronLeft size={18} />
        </button>
        <span className="text-white font-bold text-sm tracking-wider">
          {year}年{month}月
        </span>
        <button type="button" onClick={next} className="text-white/70 hover:text-white">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-red-900/20">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={`text-center text-[10px] font-bold py-1.5 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-500'}`}>
            {w}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-px bg-red-900/10 p-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const dateStr     = fmt(day);
          const isToday     = dateStr === todayStr;
          const isSelected  = dateStr === selectedDate;
          const hasWorkout  = workoutDates.has(dateStr);
          const isWeekend   = (i % 7 === 0 || i % 7 === 6);
          const isPast      = new Date(dateStr) < today && !isToday;
          const isFuture    = new Date(dateStr) > today;

          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(dateStr)}
              className={`relative flex flex-col items-center justify-center py-1.5 rounded-lg transition-all ${
                isSelected ? 'bg-red-600' : isToday ? 'bg-red-900/40' : 'hover:bg-red-900/20'
              } ${isFuture ? 'opacity-30' : ''}`}
            >
              {/* Workout dot */}
              {hasWorkout && !isSelected && (
                <div className="absolute top-0.5 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
              )}
              <span className={`text-sm font-bold ${
                isSelected ? 'text-white' :
                isToday    ? 'text-red-300' :
                hasWorkout ? 'text-red-200' :
                isPast     ? 'text-slate-600' :
                isWeekend  ? (i % 7 === 0 ? 'text-red-400/60' : 'text-blue-400/60') :
                'text-slate-400'
              }`}>
                {day}
              </span>
              {hasWorkout && (
                <div className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? 'bg-white' : 'bg-red-500'}`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
