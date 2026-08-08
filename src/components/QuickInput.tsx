"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle, Send } from "lucide-react";

interface Props {
  onSubmit: () => void;
}

interface FormState {
  weight: string;
  calories: string;
  protein: string;
  fat: string;
  carbs: string;
  steps: string;
  workout: string;
}

const INITIAL: FormState = {
  weight: "",
  calories: "",
  protein: "",
  fat: "",
  carbs: "",
  steps: "",
  workout: "",
};

export default function QuickInput({ onSubmit }: Props) {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const today = new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "-");

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    if (status !== "idle") setStatus("idle");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.weight) { setStatus("error"); setErrorMsg("体重を入力してください"); return; }

    setStatus("loading");
    try {
      const res = await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: today,
          weight: parseFloat(form.weight),
          calories: form.calories ? parseInt(form.calories) : undefined,
          protein: form.protein ? parseFloat(form.protein) : undefined,
          fat: form.fat ? parseFloat(form.fat) : undefined,
          carbs: form.carbs ? parseFloat(form.carbs) : undefined,
          steps: form.steps ? parseInt(form.steps) : undefined,
          workout: form.workout || undefined,
        }),
      });
      if (!res.ok) throw new Error("送信失敗");
      setStatus("success");
      setTimeout(() => {
        setForm(INITIAL);
        onSubmit();
      }, 1500);
    } catch {
      setStatus("error");
      setErrorMsg("送信に失敗しました。もう一度お試しください。");
    }
  };

  type FieldConfig = {
    key: keyof FormState;
    label: string;
    unit: string;
    placeholder: string;
    inputMode?: "decimal" | "numeric";
    step?: string;
  };

  const fields: FieldConfig[] = [
    { key: "weight",   label: "体重",         unit: "kg",   placeholder: "90.0", inputMode: "decimal", step: "0.1" },
    { key: "calories", label: "摂取カロリー", unit: "kcal", placeholder: "1800",  inputMode: "numeric" },
    { key: "protein",  label: "タンパク質",   unit: "g",    placeholder: "150",   inputMode: "decimal", step: "0.1" },
    { key: "fat",      label: "脂質",         unit: "g",    placeholder: "55",    inputMode: "decimal", step: "0.1" },
    { key: "carbs",    label: "炭水化物",     unit: "g",    placeholder: "180",   inputMode: "decimal", step: "0.1" },
    { key: "steps",    label: "歩数",         unit: "歩",   placeholder: "8000",  inputMode: "numeric" },
  ];

  return (
    <div className="px-4 pb-4 fade-in">
      {/* Header */}
      <div className="pt-12 pb-5">
        <p className="text-[11px] text-blue-400 font-semibold tracking-widest uppercase mb-1">QUICK LOG</p>
        <h1 className="text-2xl font-bold text-white">今日の記録</h1>
        <p className="text-sm text-slate-500 mt-0.5">{today}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Weight — prominent */}
        <div className="bg-[#111827] border-2 border-blue-500/40 rounded-2xl p-4">
          <label className="text-xs text-blue-400 font-semibold uppercase tracking-wide">体重 *</label>
          <div className="flex items-baseline gap-2 mt-1">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={form.weight}
              onChange={set("weight")}
              placeholder="90.0"
              className="flex-1 bg-transparent text-4xl font-black text-white placeholder-slate-700 outline-none"
            />
            <span className="text-lg text-slate-400">kg</span>
          </div>
        </div>

        {/* Other fields grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {fields.slice(1).map((f) => (
            <div key={f.key} className="bg-[#111827] border border-[#1e2d40] rounded-xl p-3">
              <label className="text-[10px] text-slate-500 uppercase tracking-wide">{f.label}</label>
              <div className="flex items-baseline gap-1 mt-1">
                <input
                  type="number"
                  inputMode={f.inputMode}
                  step={f.step}
                  value={form[f.key]}
                  onChange={set(f.key)}
                  placeholder={f.placeholder}
                  className="flex-1 bg-transparent text-xl font-bold text-slate-100 placeholder-slate-700 outline-none w-full"
                />
                <span className="text-xs text-slate-500">{f.unit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Workout memo */}
        <div className="bg-[#111827] border border-[#1e2d40] rounded-xl p-3">
          <label className="text-[10px] text-slate-500 uppercase tracking-wide">筋トレ・運動メモ</label>
          <textarea
            value={form.workout}
            onChange={set("workout")}
            placeholder="例: 胸・三頭筋トレ 45分、ウォーキング 30分..."
            rows={2}
            className="w-full bg-transparent text-sm text-slate-200 placeholder-slate-700 outline-none mt-1 resize-none"
          />
        </div>

        {/* Status feedback */}
        {status === "error" && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
            <AlertCircle size={15} className="text-red-400 shrink-0" />
            <p className="text-xs text-red-400">{errorMsg}</p>
          </div>
        )}
        {status === "success" && (
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3">
            <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
            <p className="text-xs text-emerald-400">記録を保存しました！ダッシュボードへ戻ります...</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={status === "loading" || status === "success"}
          className="w-full py-4 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #3b82f6, #8b5cf6)" }}
        >
          {status === "loading" ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Send size={16} />
              記録を保存する
            </>
          )}
        </button>
      </form>
    </div>
  );
}
