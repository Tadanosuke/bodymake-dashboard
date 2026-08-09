import { db } from './firebase';
import {
  doc, getDoc, setDoc, collection, getDocs,
  query, orderBy, limit,
} from 'firebase/firestore';
import type { ExerciseSession } from './exercises';

// ─── 型 ──────────────────────────────────────────────────────────────────────

export interface DailyLogFS {
  date:     string;
  weight?:  number;
  steps?:   number;
  sleep?:   string;
  doms?:    string;
  tomorrow?: string;
  workout?: string;
  updatedAt: string;
}

export interface WorkoutSessionFS {
  date:        string;
  exercises:   Array<{ muscle: string; name: string; sets: Array<{ weight: number; reps: number }> }>;
  totalVolume: number;
  updatedAt:   string;
}

// ─── パスヘルパー (ユーザーごとにサブコレクション) ──────────────────────────

function userCol(uid: string, col: string) {
  if (!db) return null;
  return collection(db, 'users', uid, col);
}

function userDoc(uid: string, col: string, id: string) {
  if (!db) return null;
  return doc(db, 'users', uid, col, id);
}

// ─── ユーザー設定 (自分専用スプレッドシートの接続先) ────────────────────────

export interface UserSettings {
  gasEndpoint?: string;   // 各ユーザー自身の GAS ウェブアプリURL
  updatedAt?:   string;
}

export async function getUserSettings(uid: string): Promise<UserSettings> {
  const ref = userDoc(uid, 'settings', 'config');
  if (!ref) return {};
  try {
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as UserSettings) : {};
  } catch { return {}; }
}

export async function saveUserSettings(uid: string, data: UserSettings): Promise<void> {
  const ref = userDoc(uid, 'settings', 'config');
  if (!ref) return;
  await setDoc(ref, { ...data, updatedAt: new Date().toISOString() }, { merge: true });
}

// ─── Daily Logs ───────────────────────────────────────────────────────────────

export async function getDailyLog(uid: string, date: string): Promise<DailyLogFS | null> {
  const ref = userDoc(uid, 'dailyLogs', date);
  if (!ref) return null;
  try {
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as DailyLogFS) : null;
  } catch { return null; }
}

export async function saveDailyLog(uid: string, date: string, data: Partial<DailyLogFS>): Promise<void> {
  const ref = userDoc(uid, 'dailyLogs', date);
  if (!ref) return;
  try {
    await setDoc(ref, { date, ...data, updatedAt: new Date().toISOString() }, { merge: true });
  } catch {}
}

export async function getRecentDailyLogs(uid: string, n = 30): Promise<DailyLogFS[]> {
  const col = userCol(uid, 'dailyLogs');
  if (!col) return [];
  try {
    const q = query(col, orderBy('date', 'desc'), limit(n));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as DailyLogFS);
  } catch { return []; }
}

// ─── Workout Sessions ─────────────────────────────────────────────────────────

export async function saveWorkoutSessionFS(uid: string, exercises: ExerciseSession[], date: string): Promise<void> {
  const ref = userDoc(uid, 'workoutSessions', date);
  if (!ref) return;
  try {
    const valid = exercises.filter(ex => ex.sets.some(s => s.weight && s.reps));
    if (valid.length === 0) return;
    const totalVolume = valid.reduce((sum, ex) =>
      sum + ex.sets.reduce((s2, s) => s2 + (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0), 0), 0);
    await setDoc(ref, {
      date,
      exercises: valid.map(ex => ({
        muscle: ex.muscle, name: ex.name,
        sets: ex.sets
          .filter(s => s.weight && s.reps)
          .map(s => ({ weight: parseFloat(s.weight), reps: parseInt(s.reps) })),
      })),
      totalVolume,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch {}
}

export async function getWorkoutDatesFS(uid: string): Promise<string[]> {
  const col = userCol(uid, 'workoutSessions');
  if (!col) return [];
  try {
    const snap = await getDocs(col);
    return snap.docs.map(d => d.id);
  } catch { return []; }
}

export async function getMonthlyVolumeFS(uid: string, year: number, month: number): Promise<number> {
  const col = userCol(uid, 'workoutSessions');
  if (!col) return 0;
  try {
    const snap = await getDocs(col);
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    return snap.docs
      .filter(d => d.id.startsWith(prefix))
      .reduce((sum, d) => sum + ((d.data() as WorkoutSessionFS).totalVolume || 0), 0);
  } catch { return 0; }
}

export async function getTotalVolumeFS(uid: string): Promise<number> {
  const col = userCol(uid, 'workoutSessions');
  if (!col) return 0;
  try {
    const snap = await getDocs(col);
    return snap.docs.reduce((sum, d) => sum + ((d.data() as WorkoutSessionFS).totalVolume || 0), 0);
  } catch { return 0; }
}

// ─── Workout History ──────────────────────────────────────────────────────────

export async function saveWorkoutHistoryFS(uid: string, exercises: ExerciseSession[], date: string): Promise<void> {
  if (!db) return;
  try {
    for (const ex of exercises) {
      const ref = userDoc(uid, 'workoutHistory', ex.name);
      if (!ref) continue;
      const valid = ex.sets.filter(s => s.weight && s.reps);
      if (valid.length === 0) continue;
      await setDoc(ref, {
        date,
        sets: valid.map(s => ({ weight: parseFloat(s.weight), reps: parseInt(s.reps) })),
        updatedAt: new Date().toISOString(),
      });
    }
  } catch {}
}
