"use client";

import { useState } from "react";
import { Plus, X, Dumbbell, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import {
  MUSCLES, ALL_TABS, PRESETS, MUSCLE_COLORS, filterByStore,
  getLastRecord, calc1RM,
  type Muscle, type ExerciseSession, type WorkoutSet, type Store,
} from "@/lib/exercises";

// ─── ExercisePicker ───────────────────────────────────────────────────────────

interface PickerProps {
  store:      Store;
  onSelect:   (muscle: Muscle, name: string) => void;
  onClose:    () => void;
  addedNames: string[];
}

function ExercisePicker({ store, onSelect, onClose, addedNames }: PickerProps) {
  const [muscle, setMuscle] = useState<Muscle>('胸');
  const [custom, setCustom] = useState('');

  const available = filterByStore(PRESETS[muscle], store);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/75"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full bg-[#0d1526] rounded-t-3xl overflow-hidden" style={{ maxHeight: '82vh' }}>
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-slate-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#1e2d40]">
          <div>
            <span className="font-bold text-slate-100">種目を選択</span>
            <span className="ml-2 text-[10px] text-slate-500 bg-[#1a2235] border border-[#2a3a55] rounded-full px-2 py-0.5">
              {store}
            </span>
          </div>
          <button type="button" onClick={onClose}>
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Muscle tabs */}
        <div className="flex overflow-x-auto gap-2 px-4 py-3 border-b border-[#1e2d40]" style={{ scrollbarWidth: 'none' }}>
          {MUSCLES.map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMuscle(m)}
              className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${
                muscle === m
                  ? 'bg-purple-600 text-white border-transparent'
                  : 'border-[#2a3a55] text-slate-400 hover:text-slate-200'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Exercise list */}
        <div className="overflow-y-auto" style={{ maxHeight: '45vh' }}>
          {available.length === 0 ? (
            <p className="text-center text-slate-600 text-sm py-8">この店舗では利用できる種目がありません</p>
          ) : (
            available.map(name => {
              const added      = addedNames.includes(name);
              const hasHistory = !!getLastRecord(name);
              return (
                <button
                  key={name}
                  type="button"
                  disabled={added}
                  onClick={() => onSelect(muscle, name)}
                  className={`w-full flex items-center justify-between px-5 py-3.5 border-b border-[#1e2d40] transition-colors text-left ${
                    added ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#1a2235] active:bg-[#1a2235]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm text-slate-200">{name}</span>
                    {hasHistory && (
                      <span className="text-[10px] text-teal-400 bg-teal-400/10 border border-teal-400/20 px-1.5 py-0.5 rounded-full">
                        履歴あり
                      </span>
                    )}
                  </div>
                  {added
                    ? <span className="text-[10px] text-slate-500">追加済み</span>
                    : <ChevronRight size={14} className="text-slate-500" />
                  }
                </button>
              );
            })
          )}
        </div>

        {/* Custom input */}
        <div className="px-4 py-3 border-t border-[#1e2d40] flex gap-2">
          <input
            type="text"
            value={custom}
            onChange={e => setCustom(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && custom.trim()) { onSelect(muscle, custom.trim()); setCustom(''); } }}
            placeholder="カスタム種目を追加..."
            className="flex-1 bg-[#1a2235] border border-[#2a3a55] rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none"
          />
          <button
            type="button"
            onClick={() => { if (custom.trim()) { onSelect(muscle, custom.trim()); setCustom(''); } }}
            className="bg-purple-600 text-white rounded-xl px-4 py-2.5 text-sm font-semibold"
          >
            追加
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SetRow ───────────────────────────────────────────────────────────────────

interface SetRowProps {
  index:    number;
  set:      WorkoutSet;
  onChange: (field: 'weight' | 'reps', val: string) => void;
  onDelete: () => void;
  isOnly:   boolean;
}

function SetRow({ index, set, onChange, onDelete, isOnly }: SetRowProps) {
  const rm = calc1RM(set.weight, set.reps);
  return (
    <div className="flex items-center gap-2 py-2 border-b border-[#1e2d40] last:border-0">
      <span className="w-5 text-[11px] text-slate-500 text-center shrink-0">{index + 1}</span>
      <div className="flex items-baseline gap-1 flex-1">
        <input
          type="number" inputMode="decimal" step="0.5"
          value={set.weight}
          onChange={e => onChange('weight', e.target.value)}
          placeholder="0"
          className="w-full bg-[#0f1a2b] text-slate-100 text-center text-sm font-bold rounded-lg py-2 outline-none placeholder-slate-700 border border-[#1e2d40] focus:border-purple-500/50"
        />
        <span className="text-[10px] text-slate-500 shrink-0">kg</span>
      </div>
      <span className="text-slate-600 text-xs shrink-0">×</span>
      <div className="flex items-baseline gap-1 flex-1">
        <input
          type="number" inputMode="numeric"
          value={set.reps}
          onChange={e => onChange('reps', e.target.value)}
          placeholder="0"
          className="w-full bg-[#0f1a2b] text-slate-100 text-center text-sm font-bold rounded-lg py-2 outline-none placeholder-slate-700 border border-[#1e2d40] focus:border-purple-500/50"
        />
        <span className="text-[10px] text-slate-500 shrink-0">回</span>
      </div>
      <div className="w-14 text-center shrink-0">
        <p className="text-[9px] text-slate-600">1RM</p>
        <p className={`text-xs font-bold ${rm !== '-' ? 'text-amber-400' : 'text-slate-700'}`}>{rm !== '-' ? rm : '-'}</p>
      </div>
      <button
        type="button" onClick={onDelete} disabled={isOnly}
        className={`shrink-0 ${isOnly ? 'opacity-0 pointer-events-none' : 'text-slate-600 hover:text-red-400'}`}
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ─── ExerciseCard ────────────────────────────────────────────────────────────

interface CardProps {
  exercise:         ExerciseSession;
  onUpdateSet:      (idx: number, field: 'weight' | 'reps', val: string) => void;
  onAddSet:         () => void;
  onRemoveSet:      (idx: number) => void;
  onRemoveExercise: () => void;
}

function ExerciseCard({ exercise, onUpdateSet, onAddSet, onRemoveSet, onRemoveExercise }: CardProps) {
  const [showHistory, setShowHistory] = useState(false);
  const { lastRecord } = exercise;
  const colorClass = MUSCLE_COLORS[exercise.muscle] ?? 'bg-slate-500/20 text-slate-300 border-slate-500/30';

  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${colorClass}`}>
              {exercise.muscle}
            </span>
            {lastRecord && (
              <button
                type="button"
                onClick={() => setShowHistory(v => !v)}
                className="flex items-center gap-1 text-[10px] text-teal-400 hover:text-teal-300"
              >
                Last Record
                {showHistory ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              </button>
            )}
          </div>
          <h3 className="text-sm font-bold text-slate-100">{exercise.name}</h3>
        </div>
        <button type="button" onClick={onRemoveExercise} className="text-slate-600 hover:text-red-400 mt-1">
          <Trash2 size={14} />
        </button>
      </div>

      {lastRecord && showHistory && (
        <div className="mb-2 bg-[#0f1a2b] border border-[#1e2d40] rounded-xl p-3">
          <p className="text-[10px] text-teal-400 font-semibold mb-1.5">Last Record: {lastRecord.date}</p>
          {lastRecord.sets.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="w-4 text-slate-600">{i + 1}</span>
              <span>{s.weight}kg × {s.reps}reps</span>
              <span className="text-amber-400/70">1RM: {(s.weight * (1 + s.reps / 30)).toFixed(1)}kg</span>
            </div>
          ))}
        </div>
      )}

      <div className="bg-[#0f1a2b] border border-[#1e2d40] rounded-xl px-3 py-1 mb-2">
        {exercise.sets.map((set, i) => (
          <SetRow
            key={i} index={i} set={set}
            onChange={(f, v) => onUpdateSet(i, f, v)}
            onDelete={() => onRemoveSet(i)}
            isOnly={exercise.sets.length === 1}
          />
        ))}
      </div>

      <button
        type="button" onClick={onAddSet}
        className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors"
      >
        <Plus size={13} />
        セットを追加
      </button>
    </div>
  );
}

// ─── WorkoutLogger ────────────────────────────────────────────────────────────

interface Props {
  store:     Store;
  exercises: ExerciseSession[];
  onChange:  (exercises: ExerciseSession[]) => void;
}

export default function WorkoutLogger({ store, exercises, onChange }: Props) {
  const [activeTab,  setActiveTab]  = useState<typeof ALL_TABS[number]>('ALL');
  const [pickerOpen, setPickerOpen] = useState(false);

  const addExercise = (muscle: Muscle, name: string) => {
    onChange([...exercises, {
      id: `${Date.now()}_${Math.random()}`,
      muscle,
      name,
      sets:       [{ weight: '', reps: '' }],
      lastRecord: getLastRecord(name),
    }]);
    setPickerOpen(false);
  };

  const removeExercise = (id: string) => onChange(exercises.filter(e => e.id !== id));

  const updateSet = (exId: string, idx: number, field: 'weight' | 'reps', val: string) =>
    onChange(exercises.map(ex =>
      ex.id !== exId ? ex : { ...ex, sets: ex.sets.map((s, i) => i === idx ? { ...s, [field]: val } : s) }
    ));

  const addSet = (exId: string) =>
    onChange(exercises.map(ex =>
      ex.id !== exId ? ex : { ...ex, sets: [...ex.sets, { weight: '', reps: '' }] }
    ));

  const removeSet = (exId: string, idx: number) =>
    onChange(exercises.map(ex =>
      ex.id !== exId ? ex : { ...ex, sets: ex.sets.filter((_, i) => i !== idx) }
    ));

  const visible = activeTab === 'ALL' ? exercises : exercises.filter(ex => ex.muscle === activeTab);

  return (
    <div className="bg-[#111827] border border-[#1e2d40] rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2d40]">
        <div className="flex items-center gap-2">
          <Dumbbell size={15} className="text-purple-400" />
          <span className="text-sm font-semibold text-slate-200">筋トレログ</span>
          {exercises.length > 0 && (
            <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/20 rounded-full px-2 py-0.5">
              {exercises.length}種目
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex items-center gap-1.5 bg-purple-600/20 border border-purple-500/30 rounded-full px-3 py-1.5 text-purple-300 text-xs font-semibold hover:bg-purple-600/30 active:scale-95 transition-all"
        >
          <Plus size={12} />
          種目を追加
        </button>
      </div>

      {exercises.length > 0 && (
        <div className="flex gap-1.5 px-4 py-2.5 border-b border-[#1e2d40] overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {ALL_TABS.map(tab => (
            <button
              key={tab} type="button"
              onClick={() => setActiveTab(tab)}
              className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full transition-colors ${
                activeTab === tab ? 'bg-purple-600 text-white' : 'bg-[#1a2235] text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      )}

      <div className="divide-y divide-[#1e2d40]">
        {exercises.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-slate-600">
            <Dumbbell size={30} className="mb-2 opacity-30" />
            <p className="text-xs">「種目を追加」からトレーニングを記録</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-600">このカテゴリの種目はありません</div>
        ) : (
          visible.map(ex => (
            <ExerciseCard
              key={ex.id} exercise={ex}
              onUpdateSet={(i, f, v) => updateSet(ex.id, i, f, v)}
              onAddSet={() => addSet(ex.id)}
              onRemoveSet={(i) => removeSet(ex.id, i)}
              onRemoveExercise={() => removeExercise(ex.id)}
            />
          ))
        )}
      </div>

      {pickerOpen && (
        <ExercisePicker
          store={store}
          onSelect={addExercise}
          onClose={() => setPickerOpen(false)}
          addedNames={exercises.map(e => e.name)}
        />
      )}
    </div>
  );
}
