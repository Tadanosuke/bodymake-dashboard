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

// ─── Daily Logs ───────────────────────────────────────────────────────────────

export async function getDailyLog(date: string): Promise<DailyLogFS | null> {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, 'dailyLogs', date));
    return snap.exists() ? (snap.data() as DailyLogFS) : null;
  } catch { return null; }
}

export async function saveDailyLog(date: string, data: Partial<DailyLogFS>): Promise<void> {
  if (!db) return;
  try {
    await setDoc(
      doc(db, 'dailyLogs', date),
      { date, ...data, updatedAt: new Date().toISOString() },
      { merge: true },
    );
  } catch {}
}

export async function getRecentDailyLogs(n = 30): Promise<DailyLogFS[]> {
  if (!db) return [];
  try {
    const q = query(collection(db, 'dailyLogs'), orderBy('date', 'desc'), limit(n));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as DailyLogFS);
  } catch { return []; }
}

// ─── Workout Sessions ─────────────────────────────────────────────────────────

export async function saveWorkoutSessionFS(exercises: ExerciseSession[], date: string): Promise<void> {
  if (!db) return;
  try {
    const valid = exercises.filter(ex => ex.sets.some(s => s.weight && s.reps));
    if (valid.length === 0) return;
    const totalVolume = valid.reduce((sum, ex) =>
      sum + ex.sets.reduce((s2, s) => s2 + (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0), 0), 0);
    await setDoc(doc(db, 'workoutSessions', date), {
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

export async function getWorkoutDatesFS(): Promise<string[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, 'workoutSessions'));
    return snap.docs.map(d => d.id);
  } catch { return []; }
}

export async function getMonthlyVolumeFS(year: number, month: number): Promise<number> {
  if (!db) return 0;
  try {
    const snap = await getDocs(collection(db, 'workoutSessions'));
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    return snap.docs
      .filter(d => d.id.startsWith(prefix))
      .reduce((sum, d) => sum + ((d.data() as WorkoutSessionFS).totalVolume || 0), 0);
  } catch { return 0; }
}

export async function getTotalVolumeFS(): Promise<number> {
  if (!db) return 0;
  try {
    const snap = await getDocs(collection(db, 'workoutSessions'));
    return snap.docs.reduce((sum, d) => sum + ((d.data() as WorkoutSessionFS).totalVolume || 0), 0);
  } catch { return 0; }
}

// ─── Workout History ──────────────────────────────────────────────────────────

export async function saveWorkoutHistoryFS(exercises: ExerciseSession[], date: string): Promise<void> {
  if (!db) return;
  try {
    for (const ex of exercises) {
      const valid = ex.sets.filter(s => s.weight && s.reps);
      if (valid.length === 0) continue;
      await setDoc(doc(db, 'workoutHistory', ex.name), {
        date,
        sets: valid.map(s => ({ weight: parseFloat(s.weight), reps: parseInt(s.reps) })),
        updatedAt: new Date().toISOString(),
      });
    }
  } catch {}
}
