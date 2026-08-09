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

// ─── 耐障害レイヤ ─────────────────────────────────────────────────────────────
// Firestore が未有効・オフライン・ルール拒否のとき、client SDK の Promise は
// reject せず「永久に pending」になる。await すると画面が固まるため、
// 必ず上限時間で打ち切り、localStorage を正とみなして動作を続ける。
// Firestore が使えるようになれば、そのまま端末間同期が有効になる。

const GUARD_MS = 6_000;

function guard<T>(p: Promise<T>, fallback: T, ms = GUARD_MS): Promise<T> {
  return Promise.race([
    p.catch(() => fallback),
    new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);
}

function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

function lsSet(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

const K_SETTINGS = (uid: string) => `bodymake_settings:${uid}`;
const K_LOGS     = (uid: string) => `bodymake_dailylogs:${uid}`;
const K_SESSIONS = (uid: string) => `bodymake_sessions:${uid}`;

// ─── ユーザー設定 (自分専用スプレッドシートの接続先) ────────────────────────

export interface UserSettings {
  gasEndpoint?: string;   // 各ユーザー自身の GAS ウェブアプリURL
  updatedAt?:   string;
}

export async function getUserSettings(uid: string): Promise<UserSettings> {
  const local = lsGet<UserSettings>(K_SETTINGS(uid), {});
  const ref = userDoc(uid, 'settings', 'config');
  if (!ref) return local;

  const remote = await guard<UserSettings | null>(
    getDoc(ref).then(s => (s.exists() ? (s.data() as UserSettings) : null)), null);

  if (remote) { lsSet(K_SETTINGS(uid), remote); return remote; }
  return local;
}

export async function saveUserSettings(uid: string, data: UserSettings): Promise<void> {
  // まず端末に確定保存する。ここは必ず成功するので、保存ボタンが固まらない。
  const merged = { ...lsGet<UserSettings>(K_SETTINGS(uid), {}), ...data, updatedAt: new Date().toISOString() };
  lsSet(K_SETTINGS(uid), merged);

  const ref = userDoc(uid, 'settings', 'config');
  if (!ref) return;
  await guard(setDoc(ref, merged, { merge: true }), undefined);   // 同期はベストエフォート
}

// ─── Daily Logs ───────────────────────────────────────────────────────────────

type LogMap = Record<string, DailyLogFS>;

export async function getDailyLog(uid: string, date: string): Promise<DailyLogFS | null> {
  const local = lsGet<LogMap>(K_LOGS(uid), {})[date] ?? null;
  const ref = userDoc(uid, 'dailyLogs', date);
  if (!ref) return local;

  const remote = await guard<DailyLogFS | null>(
    getDoc(ref).then(s => (s.exists() ? (s.data() as DailyLogFS) : null)), null);

  if (remote) {
    const map = lsGet<LogMap>(K_LOGS(uid), {});
    map[date] = remote;
    lsSet(K_LOGS(uid), map);
    return remote;
  }
  return local;
}

export async function saveDailyLog(uid: string, date: string, data: Partial<DailyLogFS>): Promise<void> {
  const map    = lsGet<LogMap>(K_LOGS(uid), {});
  const merged = { ...(map[date] ?? {}), date, ...data, updatedAt: new Date().toISOString() } as DailyLogFS;
  map[date] = merged;
  lsSet(K_LOGS(uid), map);   // 端末側は確実に残す（同日中の値の保持はこれで担保される）

  const ref = userDoc(uid, 'dailyLogs', date);
  if (!ref) return;
  await guard(setDoc(ref, merged, { merge: true }), undefined);
}

export async function getRecentDailyLogs(uid: string, n = 30): Promise<DailyLogFS[]> {
  const local = Object.values(lsGet<LogMap>(K_LOGS(uid), {}))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, n);

  const col = userCol(uid, 'dailyLogs');
  if (!col) return local;

  const remote = await guard<DailyLogFS[] | null>(
    getDocs(query(col, orderBy('date', 'desc'), limit(n))).then(s => s.docs.map(d => d.data() as DailyLogFS)),
    null);

  if (remote && remote.length) {
    const map = lsGet<LogMap>(K_LOGS(uid), {});
    remote.forEach(r => { map[r.date] = { ...(map[r.date] ?? {}), ...r }; });
    lsSet(K_LOGS(uid), map);
    return Object.values(map).sort((a, b) => b.date.localeCompare(a.date)).slice(0, n);
  }
  return local;
}

// ─── Workout Sessions ─────────────────────────────────────────────────────────

type SessionMap = Record<string, WorkoutSessionFS>;

function localSessions(uid: string): SessionMap {
  return lsGet<SessionMap>(K_SESSIONS(uid), {});
}

export async function saveWorkoutSessionFS(uid: string, exercises: ExerciseSession[], date: string): Promise<void> {
  const valid = exercises.filter(ex => ex.sets.some(s => s.weight && s.reps));
  if (valid.length === 0) return;

  const session: WorkoutSessionFS = {
    date,
    exercises: valid.map(ex => ({
      muscle: ex.muscle, name: ex.name,
      sets: ex.sets
        .filter(s => s.weight && s.reps)
        .map(s => ({ weight: parseFloat(s.weight), reps: parseInt(s.reps) })),
    })),
    totalVolume: valid.reduce((sum, ex) =>
      sum + ex.sets.reduce((s2, s) => s2 + (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0), 0), 0),
    updatedAt: new Date().toISOString(),
  };

  const map = localSessions(uid);
  map[date] = session;
  lsSet(K_SESSIONS(uid), map);

  const ref = userDoc(uid, 'workoutSessions', date);
  if (!ref) return;
  await guard(setDoc(ref, session, { merge: true }), undefined);
}

export async function getWorkoutDatesFS(uid: string): Promise<string[]> {
  const local = Object.keys(localSessions(uid));
  const col = userCol(uid, 'workoutSessions');
  if (!col) return local;

  const remote = await guard<string[] | null>(getDocs(col).then(s => s.docs.map(d => d.id)), null);
  if (remote && remote.length) return Array.from(new Set([...local, ...remote]));
  return local;
}

export async function getMonthlyVolumeFS(uid: string, year: number, month: number): Promise<number> {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const localTotal = Object.entries(localSessions(uid))
    .filter(([d]) => d.startsWith(prefix))
    .reduce((sum, [, s]) => sum + (s.totalVolume || 0), 0);

  const col = userCol(uid, 'workoutSessions');
  if (!col) return localTotal;

  const remote = await guard<number | null>(
    getDocs(col).then(s => s.docs
      .filter(d => d.id.startsWith(prefix))
      .reduce((sum, d) => sum + ((d.data() as WorkoutSessionFS).totalVolume || 0), 0)),
    null);

  return Math.max(remote ?? 0, localTotal);
}

export async function getTotalVolumeFS(uid: string): Promise<number> {
  const localTotal = Object.values(localSessions(uid))
    .reduce((sum, s) => sum + (s.totalVolume || 0), 0);

  const col = userCol(uid, 'workoutSessions');
  if (!col) return localTotal;

  const remote = await guard<number | null>(
    getDocs(col).then(s => s.docs.reduce((sum, d) => sum + ((d.data() as WorkoutSessionFS).totalVolume || 0), 0)),
    null);

  return Math.max(remote ?? 0, localTotal);
}

// ─── Workout History ──────────────────────────────────────────────────────────

export async function saveWorkoutHistoryFS(uid: string, exercises: ExerciseSession[], date: string): Promise<void> {
  if (!db) return;
  // 種目ごとに直列 await すると Firestore 不通時に種目数×待ち時間だけ固まるため、
  // まとめて1回だけ上限をかける。
  const writes = exercises.flatMap(ex => {
    const ref = userDoc(uid, 'workoutHistory', ex.name);
    const valid = ex.sets.filter(s => s.weight && s.reps);
    if (!ref || valid.length === 0) return [];
    return [setDoc(ref, {
      date,
      sets: valid.map(s => ({ weight: parseFloat(s.weight), reps: parseInt(s.reps) })),
      updatedAt: new Date().toISOString(),
    })];
  });
  if (writes.length === 0) return;
  await guard(Promise.all(writes).then(() => undefined), undefined);
}
