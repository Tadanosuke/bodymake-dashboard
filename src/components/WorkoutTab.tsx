"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Plus, X, Dumbbell, Trash2, ChevronDown, ChevronRight,
  Timer, Zap, CalendarDays, Trophy, Send,
} from "lucide-react";
import RestTimer from "./RestTimer";
import {
  MUSCLES, PRESETS, filterByStore, getLastRecord,
  calc1RM, saveWorkoutHistory, saveWorkoutSession, formatWorkoutForSheet,
  getWorkoutDayCount, getMonthlyVolume, getTotalVolume, STORE_KEY,
  getCustomExercises, addCustomExercise, removeCustomExercise,
  type Muscle, type ExerciseSession, type WorkoutSet, type Store,
} from "@/lib/exercises";
import {
  saveWorkoutSessionFS, saveWorkoutHistoryFS,
  getWorkoutDatesFS, getMonthlyVolumeFS, getTotalVolumeFS,
} from "@/lib/firestore";
import type { AIPlan } from "@/lib/types";
import { useCurrentUser } from "./AuthGate";

const WorkoutCalendar = dynamic(() => import("./WorkoutCalendar"), { ssr: false });

// ─── 定数 ─────────────────────────────────────────────────────────────────────
const REST_DEFAULTS: Record<string, number> = { default: 90 };

// ─── セット行 ─────────────────────────────────────────────────────────────────
interface SetRowProps {
  index:       number;
  set:         WorkoutSet;
  onChange:    (field: 'weight' | 'reps', val: string) => void;
  onDelete:    () => void;
  onDone:      (restSecs: number) => void;
  isOnly:      boolean;
  restDefault: number;
}

function SetRow({ index, set, onChange, onDelete, onDone, isOnly, restDefault }: SetRowProps) {
  const rm = calc1RM(set.weight, set.reps);
  return (
    <div className="flex items-center gap-2 py-2.5 border-b border-red-900/20 last:border-0">
      <span className="w-5 shrink-0 text-xs text-red-300/60 text-center font-bold">{index + 1}</span>

      {/* Weight */}
      <div className="flex-1 flex items-baseline gap-1">
        <input
          type="number" inputMode="decimal" step="0.5" value={set.weight}
          onChange={e => onChange('weight', e.target.value)}
          placeholder="0"
          className="w-full bg-black/30 border border-red-900/30 text-white text-center text-base font-black rounded-lg py-2 outline-none placeholder-red-900 focus:border-red-500/60"
        />
        <span className="text-[10px] text-red-300/50 shrink-0">kg</span>
      </div>

      <span className="text-red-800 text-sm shrink-0">×</span>

      {/* Reps */}
      <div className="flex-1 flex items-baseline gap-1">
        <input
          type="number" inputMode="numeric" value={set.reps}
          onChange={e => onChange('reps', e.target.value)}
          placeholder="0"
          className="w-full bg-black/30 border border-red-900/30 text-white text-center text-base font-black rounded-lg py-2 outline-none placeholder-red-900 focus:border-red-500/60"
        />
        <span className="text-[10px] text-red-300/50 shrink-0">回</span>
      </div>

      {/* 1RM */}
      <div className="w-14 text-center shrink-0">
        <p className="text-[9px] text-red-400/60">1RM</p>
        <p className={`text-xs font-black ${rm !== '-' ? 'text-yellow-400' : 'text-red-900'}`}>{rm !== '-' ? rm : '-'}</p>
      </div>

      {/* Done button */}
      <button
        type="button"
        onClick={() => onDone(restDefault)}
        disabled={!set.weight || !set.reps}
        className="shrink-0 text-[10px] font-bold bg-red-700 hover:bg-red-600 disabled:opacity-30 text-white px-2 py-1.5 rounded-lg transition-colors"
      >
        完了
      </button>

      <button
        type="button" onClick={onDelete} disabled={isOnly}
        className={`shrink-0 ${isOnly ? 'opacity-0 pointer-events-none' : 'text-red-900 hover:text-red-400'}`}
      >
        <X size={13} />
      </button>
    </div>
  );
}

// ─── 種目カード ───────────────────────────────────────────────────────────────
interface ExerciseCardProps {
  exercise:         ExerciseSession;
  onUpdateSet:      (idx: number, field: 'weight' | 'reps', val: string) => void;
  onAddSet:         () => void;
  onRemoveSet:      (idx: number) => void;
  onRemoveExercise: () => void;
  onSetDone:        (restSecs: number) => void;
  restDefault:      number;
}

function ExerciseCard({ exercise, onUpdateSet, onAddSet, onRemoveSet, onRemoveExercise, onSetDone, restDefault }: ExerciseCardProps) {
  const [showHistory, setShowHistory] = useState(false);
  const { lastRecord } = exercise;

  return (
    <div className="bg-black/40 border border-red-900/30 rounded-2xl overflow-hidden mb-3">
      {/* Card header */}
      <div className="flex items-start justify-between px-4 pt-3 pb-2 border-b border-red-900/20">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] bg-red-800/50 text-red-300 border border-red-700/30 px-2 py-0.5 rounded-full font-bold">
              {exercise.muscle}
            </span>
            {lastRecord && (
              <button type="button" onClick={() => setShowHistory(v => !v)}
                className="flex items-center gap-1 text-[10px] text-yellow-400/70 hover:text-yellow-400">
                Last Record {showHistory ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
              </button>
            )}
          </div>
          <h3 className="text-base font-black text-white leading-tight">{exercise.name}</h3>
        </div>
        <button type="button" onClick={onRemoveExercise} className="text-red-900 hover:text-red-500 mt-1">
          <Trash2 size={14} />
        </button>
      </div>

      {/* Last record */}
      {lastRecord && showHistory && (
        <div className="mx-3 my-2 bg-black/50 border border-red-900/20 rounded-xl p-3">
          <p className="text-[10px] text-yellow-400/80 font-semibold mb-1.5">Last Record: {lastRecord.date}</p>
          {lastRecord.sets.map((s, i) => (
            <p key={i} className="text-[11px] text-red-200/60">
              {i+1}. {s.weight}kg × {s.reps}reps
              <span className="text-yellow-400/50 ml-2">1RM: {(s.weight*(1+s.reps/30)).toFixed(1)}kg</span>
            </p>
          ))}
        </div>
      )}

      {/* Sets */}
      <div className="px-3 py-1">
        {exercise.sets.map((set, i) => (
          <SetRow
            key={i} index={i} set={set}
            onChange={(f, v) => onUpdateSet(i, f, v)}
            onDelete={() => onRemoveSet(i)}
            onDone={onSetDone}
            isOnly={exercise.sets.length === 1}
            restDefault={restDefault}
          />
        ))}
      </div>

      {/* Add set */}
      <div className="px-4 pb-3">
        <button type="button" onClick={onAddSet}
          className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors">
          <Plus size={12} /> セットを追加
        </button>
      </div>
    </div>
  );
}

// ─── 種目ピッカー ─────────────────────────────────────────────────────────────
interface PickerProps {
  store: Store; onSelect: (m: Muscle, name: string) => void; onClose: () => void; addedNames: string[];
}
function ExercisePicker({ store, onSelect, onClose, addedNames }: PickerProps) {
  const [muscle, setMuscle] = useState<Muscle>('胸');
  const [custom, setCustom] = useState('');
  const [customMap, setCustomMap] = useState<Record<string, string[]>>({});

  useEffect(() => { setCustomMap(getCustomExercises()); }, []);

  const presets   = filterByStore(PRESETS[muscle], store);
  const customs   = customMap[muscle] || [];
  const available = [...presets, ...customs];

  // 新しい種目を登録して即座に選択する
  const commitCustom = () => {
    const name = custom.trim();
    if (!name) return;
    addCustomExercise(muscle, name);
    setCustomMap(getCustomExercises());
    setCustom('');
    onSelect(muscle, name);
  };

  const deleteCustom = (name: string) => {
    removeCustomExercise(muscle, name);
    setCustomMap(getCustomExercises());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/80" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full bg-[#1a0505] border-t border-red-900/50 rounded-t-3xl overflow-hidden" style={{ maxHeight: '80vh' }}>
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-red-900 rounded-full" /></div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-red-900/30">
          <span className="font-black text-white">種目を選択</span>
          <button type="button" onClick={onClose}><X size={20} className="text-red-400" /></button>
        </div>
        <div className="flex overflow-x-auto gap-2 px-4 py-3 border-b border-red-900/20" style={{ scrollbarWidth: 'none' }}>
          {MUSCLES.map(m => (
            <button key={m} type="button" onClick={() => setMuscle(m)}
              className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${
                muscle === m ? 'bg-red-700 text-white border-transparent' : 'border-red-900/40 text-red-300/70 hover:text-red-200'
              }`}>{m}</button>
          ))}
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: '42vh' }}>
          {available.map(name => {
            const added    = addedNames.includes(name);
            const isCustom = customs.includes(name);
            return (
              <div key={name} className={`w-full flex items-center border-b border-red-900/15 transition-colors ${
                added ? 'opacity-30' : 'hover:bg-red-900/20'
              }`}>
                <button type="button" disabled={added}
                  onClick={() => onSelect(muscle, name)}
                  className={`flex-1 flex items-center justify-between px-5 py-3.5 text-left ${added ? 'cursor-not-allowed' : ''}`}>
                  <span className="text-sm text-red-100 flex items-center gap-2">
                    {name}
                    {isCustom && <span className="text-[9px] bg-red-900/50 text-red-300 px-1.5 py-0.5 rounded">自作</span>}
                  </span>
                  {added ? <span className="text-[10px] text-red-800">追加済み</span> : <ChevronRight size={14} className="text-red-700" />}
                </button>
                {isCustom && (
                  <button type="button" onClick={() => deleteCustom(name)}
                    className="px-4 text-red-900 hover:text-red-400 shrink-0" title="この種目を削除">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="px-4 py-3 border-t border-red-900/30">
          <p className="text-[10px] text-red-400/60 mb-2">
            「{muscle}」に自分の種目を追加（次回以降も一覧に残ります）
          </p>
          <div className="flex gap-2">
            <input type="text" value={custom} onChange={e => setCustom(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitCustom(); }}
              placeholder="種目名を入力..." className="flex-1 bg-black/40 border border-red-900/40 rounded-xl px-3 py-2.5 text-sm text-red-100 placeholder-red-900 outline-none focus:border-red-500/60" />
            <button type="button" onClick={commitCustom} disabled={!custom.trim()}
              className="bg-red-700 text-white rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-40">追加</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── WorkoutTab (メイン) ──────────────────────────────────────────────────────
interface Props {
  aiPlan?: AIPlan | null;
}

export default function WorkoutTab({ aiPlan }: Props) {
  const currentUser = useCurrentUser();
  const uid = currentUser?.uid ?? '';

  const today = new Date().toLocaleDateString('ja-JP', { year:'numeric', month:'2-digit', day:'2-digit' }).replace(/\//g,'-');

  const [store,        setStore]        = useState<Store>('自宅・牛久店');
  const [selectedDate, setSelectedDate] = useState(today);
  const [exercises,    setExercises]    = useState<ExerciseSession[]>([]);
  const [pickerOpen,   setPickerOpen]   = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [timerOpen,    setTimerOpen]    = useState(false);
  const [timerSecs,    setTimerSecs]    = useState(90);
  const [status,       setStatus]       = useState<'idle'|'loading'|'success'|'error'>('idle');
  const [planRests,    setPlanRests]    = useState<Record<string, number>>({});

  // Stats (from localStorage)
  const [dayCount,    setDayCount]    = useState(0);
  const [monthVol,    setMonthVol]    = useState(0);
  const [totalVol,    setTotalVol]    = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem(STORE_KEY) as Store | null;
    if (saved) setStore(saved);

    // Load workout stats from Firestore (with localStorage fallback)
    if (!uid) return;
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth() + 1;
    Promise.all([
      getWorkoutDatesFS(uid).then(dates => dates.length || getWorkoutDayCount()),
      getMonthlyVolumeFS(uid, y, m).then(v => v || getMonthlyVolume(y, m)),
      getTotalVolumeFS(uid).then(v => v || getTotalVolume()),
    ]).then(([days, monthly, total]) => {
      setDayCount(days);
      setMonthVol(monthly);
      setTotalVol(total);
    });
  }, []);

  // Session volume
  const sessionVolume = exercises.reduce((sum, ex) =>
    sum + ex.sets.reduce((s2, s) => s2 + (parseFloat(s.weight)||0)*(parseInt(s.reps)||0), 0), 0);

  const addExercise = (muscle: Muscle, name: string) => {
    setExercises(prev => [...prev, {
      id: `${Date.now()}_${Math.random()}`,
      muscle, name,
      sets: [{ weight: '', reps: '' }],
      lastRecord: getLastRecord(name),
    }]);
    setPickerOpen(false);
  };

  // AI計画の種目名から部位を推定（Geminiは Push/Pull/Legs 単位でしか部位を返さないため）
  const guessMuscle = (name: string): Muscle => {
    for (const m of MUSCLES) {
      if (PRESETS[m].some(p => name.includes(p) || p.includes(name))) return m;
    }
    if (/ベンチ|チェスト|プレス|ペック/.test(name)) return '胸';
    if (/ロー|ラット|プル|デッド|チンニング/.test(name)) return '背中';
    if (/スクワット|レッグ|カーフ/.test(name))          return '脚';
    if (/ショルダー|サイドレイズ|アーノルド/.test(name)) return '肩';
    if (/カール|トライセップス|フレンチ|エクステンション/.test(name)) return '腕';
    return '胸';
  };

  const applyAIPlan = () => {
    if (!aiPlan?.exercises) return;
    const newExs: ExerciseSession[] = aiPlan.exercises.map(ex => ({
      id: `${Date.now()}_${Math.random()}`,
      muscle: guessMuscle(ex.name),
      name: ex.name,
      // Gemini がセットごとに重量・回数を指定していればそれを1セットずつ反映
      sets: ex.setList && ex.setList.length > 0
        ? ex.setList.map(s => ({ weight: String(s.weight), reps: String(s.reps) }))
        : Array.from({ length: ex.sets }, () => ({
            weight: String(ex.targetWeight),
            reps:   String(ex.targetReps),
          })),
      lastRecord: getLastRecord(ex.name),
    }));
    setExercises(newExs);
    // 種目ごとのレスト秒を記録しておく
    const rests: Record<string, number> = {};
    aiPlan.exercises.forEach(ex => { rests[ex.name] = ex.restSeconds; });
    setPlanRests(rests);
  };

  const removeExercise = (id: string) => setExercises(p => p.filter(e => e.id !== id));
  const updateSet = (exId: string, idx: number, field: 'weight'|'reps', val: string) =>
    setExercises(p => p.map(ex => ex.id !== exId ? ex : {
      ...ex, sets: ex.sets.map((s, i) => i === idx ? { ...s, [field]: val } : s)
    }));
  const addSet = (exId: string) =>
    setExercises(p => p.map(ex => ex.id !== exId ? ex : { ...ex, sets: [...ex.sets, { weight:'', reps:'' }] }));
  const removeSet = (exId: string, idx: number) =>
    setExercises(p => p.map(ex => ex.id !== exId ? ex : { ...ex, sets: ex.sets.filter((_,i) => i !== idx) }));
  const openTimer = useCallback((secs: number) => { setTimerSecs(secs); setTimerOpen(true); }, []);

  const handleSave = async () => {
    if (exercises.length === 0) return;
    setStatus('loading');
    try {
      const workoutStr = formatWorkoutForSheet(exercises);

      // Save to Firebase (primary)
      await saveWorkoutSessionFS(uid, exercises, selectedDate);
      await saveWorkoutHistoryFS(uid, exercises, selectedDate);

      // Save to localStorage (offline fallback)
      saveWorkoutHistory(exercises, selectedDate);
      saveWorkoutSession(exercises, selectedDate);

      // Write to GAS + daily log
      await fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, date: selectedDate, workout: workoutStr }),
      });

      // Refresh stats from Firebase
      const now = new Date();
      const y = now.getFullYear(), mo = now.getMonth() + 1;
      const [days, monthly, total] = await Promise.all([
        getWorkoutDatesFS(uid).then(dates => dates.length),
        getMonthlyVolumeFS(uid, y, mo),
        getTotalVolumeFS(uid),
      ]);
      setDayCount(days);
      setMonthVol(monthly);
      setTotalVol(total);

      setStatus('success');
      setTimeout(() => { setExercises([]); setStatus('idle'); }, 1500);
    } catch { setStatus('error'); setTimeout(() => setStatus('idle'), 2000); }
  };

  const toTons = (kg: number) => (kg / 1000).toFixed(2);

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #1a0000 0%, #0d0000 100%)' }}>

      {/* Red Header */}
      <div className="bg-red-700 pt-10 pb-4 px-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-black text-white tracking-tight">筋トレ</h1>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-red-200/70">
              {store === '赤坂店' ? '🏙 赤坂' : '🏡 牛久'}
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-red-800/40 border border-red-600/20 rounded-xl p-2.5 text-center">
            <p className="text-[10px] text-red-300/70 font-semibold">今月</p>
            <p className="text-lg font-black text-white">{toTons(monthVol)} <span className="text-xs font-medium">t</span></p>
          </div>
          <div className="bg-red-800/40 border border-red-600/20 rounded-xl p-2.5 text-center">
            <p className="text-[10px] text-red-300/70 font-semibold">総計</p>
            <p className="text-lg font-black text-white">{toTons(totalVol)} <span className="text-xs font-medium">t</span></p>
          </div>
          <div className="bg-red-800/40 border border-red-600/20 rounded-xl p-2.5 text-center">
            <p className="text-[10px] text-red-300/70 font-semibold">記録日数</p>
            <p className="text-lg font-black text-white">{dayCount} <span className="text-xs font-medium">日</span></p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">

        {/* Calendar toggle */}
        <button type="button" onClick={() => setShowCalendar(v => !v)}
          className="w-full flex items-center justify-between bg-black/40 border border-red-900/30 rounded-2xl px-4 py-3 text-red-200 hover:bg-red-900/20 transition-colors">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-red-500" />
            <span className="text-sm font-bold">カレンダー — {selectedDate}</span>
          </div>
          {showCalendar ? <ChevronDown size={16} className="text-red-500" /> : <ChevronRight size={16} className="text-red-500" />}
        </button>

        {showCalendar && (
          <WorkoutCalendar selectedDate={selectedDate} onSelect={date => { setSelectedDate(date); setShowCalendar(false); }} />
        )}

        {/* AI Plan */}
        {aiPlan && (
          <div className="bg-black/40 border border-yellow-600/30 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Zap size={14} className="text-yellow-400" />
              <span className="text-xs font-bold text-yellow-300">Gemini AI 計画</span>
              <span className="text-[10px] text-yellow-600">{aiPlan.date}</span>
              {aiPlan.split && (
                <span className="text-[10px] bg-yellow-600/20 border border-yellow-600/40 text-yellow-300 px-2 py-0.5 rounded-full font-bold">
                  {aiPlan.split}
                </span>
              )}
              {aiPlan.place && (
                <span className="text-[10px] bg-red-800/40 border border-red-700/30 text-red-300 px-2 py-0.5 rounded-full">
                  {aiPlan.place}
                </span>
              )}
            </div>

            {aiPlan.exercises && aiPlan.exercises.length > 0 ? (
              <div className="space-y-2 mb-3">
                {aiPlan.exercises.map((ex, i) => (
                  <div key={i} className="bg-black/40 border border-yellow-900/20 rounded-xl p-2.5">
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <span className="text-xs font-bold text-yellow-100 leading-tight">{ex.name}</span>
                      <span className="text-[9px] text-yellow-600/80 shrink-0">レスト{ex.restSeconds}秒</span>
                    </div>
                    {ex.setList && ex.setList.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {ex.setList.map((s, j) => (
                          <span key={j} className="text-[10px] bg-black/50 border border-red-900/30 text-red-200/80 px-1.5 py-0.5 rounded">
                            {s.weight}kg{s.count > 1 ? `×${s.count}` : ''} × {s.reps}回
                            {s.label && <span className="text-yellow-600/70 ml-1">{s.label}</span>}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-red-200/60">{ex.setsDetail}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-red-200/70 leading-relaxed whitespace-pre-line mb-3">{aiPlan.rawText}</p>
            )}

            {aiPlan.exercises && (
              <button type="button" onClick={applyAIPlan}
                className="w-full py-2.5 bg-yellow-600 hover:bg-yellow-500 text-black font-black text-sm rounded-xl active:scale-95 transition-all">
                ⚡ AI計画を適用してスタート
              </button>
            )}
          </div>
        )}

        {/* Add exercise button */}
        <button type="button" onClick={() => setPickerOpen(true)}
          className="w-full flex items-center justify-center gap-2 bg-red-700 hover:bg-red-600 text-white font-black py-4 rounded-2xl text-base active:scale-95 transition-all">
          <Plus size={18} /> 本日のトレーニングを追加
        </button>

        {/* Session volume */}
        {exercises.length > 0 && (
          <div className="flex items-center justify-between text-xs text-red-300/70 px-1">
            <span className="flex items-center gap-1"><Trophy size={11} /> 今日のセッション負荷量</span>
            <span className="font-black text-yellow-400">{toTons(sessionVolume)} t</span>
          </div>
        )}

        {/* Exercise cards */}
        {exercises.map(ex => (
          <ExerciseCard
            key={ex.id} exercise={ex}
            onUpdateSet={(i, f, v) => updateSet(ex.id, i, f, v)}
            onAddSet={() => addSet(ex.id)}
            onRemoveSet={i => removeSet(ex.id, i)}
            onRemoveExercise={() => removeExercise(ex.id)}
            onSetDone={openTimer}
            restDefault={planRests[ex.name] ?? REST_DEFAULTS[ex.name] ?? 90}
          />
        ))}

        {/* Save */}
        {exercises.length > 0 && (
          <>
            {status === 'error' && <p className="text-xs text-red-400 text-center">保存に失敗しました</p>}
            {status === 'success' && <p className="text-xs text-emerald-400 text-center">✓ 記録を保存しました！</p>}
            <button type="button" onClick={handleSave} disabled={status === 'loading' || status === 'success'}
              className="w-full flex items-center justify-center gap-2 bg-black/60 border border-red-700 text-red-300 font-bold py-3.5 rounded-2xl active:scale-95 transition-all disabled:opacity-50">
              {status === 'loading'
                ? <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                : <><Send size={15} /> 記録を保存する</>}
            </button>
          </>
        )}
      </div>

      {/* Pickers & timer */}
      {pickerOpen && (
        <ExercisePicker store={store} onSelect={addExercise} onClose={() => setPickerOpen(false)} addedNames={exercises.map(e => e.name)} />
      )}
      {timerOpen && (
        <RestTimer initialSeconds={timerSecs} onClose={() => setTimerOpen(false)} compact />
      )}
    </div>
  );
}
