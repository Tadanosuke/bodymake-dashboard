"use client";

import { useState, useEffect, createContext, useContext } from "react";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

// ─── User context ─────────────────────────────────────────────────────────────
export const UserContext = createContext<User | null>(null);
export function useCurrentUser() { return useContext(UserContext); }

interface Props {
  children: React.ReactNode;
}

export default function AuthGate({ children }: Props) {
  const [user,    setUser]    = useState<User | null | undefined>(undefined);
  const [email,   setEmail]   = useState('');
  const [pass,    setPass]    = useState('');
  const [errMsg,  setErrMsg]  = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!auth) { setUser(null); return; }
    return onAuthStateChanged(auth, setUser);
  }, []);

  // Initial check
  if (user === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0f1e]">
        <div className="w-10 h-10 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  // Firebase not configured — bypass
  if (!auth) return <>{children}</>;

  // Authenticated
  if (user) {
    return (
      <UserContext.Provider value={user}>
        {children}
      </UserContext.Provider>
    );
  }

  // Login screen
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !email || !pass) return;
    setLoading(true);
    setErrMsg('');
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch {
      setErrMsg('メールアドレスまたはパスワードが正しくありません');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0f1e] px-6">
      <div className="text-center mb-10">
        <p className="text-5xl mb-3">💪</p>
        <p className="text-2xl font-black text-white tracking-tight">BODYMAKE</p>
        <p className="text-sm text-slate-500 mt-1">ログインしてください</p>
      </div>

      <form onSubmit={handleSignIn} className="w-full max-w-xs space-y-3">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="メールアドレス"
          autoComplete="email"
          className="w-full bg-[#111827] border border-[#1e2d40] rounded-2xl px-4 py-3.5 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500/60"
          style={{ colorScheme: 'dark' }}
        />
        <input
          type="password"
          value={pass}
          onChange={e => setPass(e.target.value)}
          placeholder="パスワード"
          autoComplete="current-password"
          className="w-full bg-[#111827] border border-[#1e2d40] rounded-2xl px-4 py-3.5 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500/60"
          style={{ colorScheme: 'dark' }}
        />

        {errMsg && (
          <p className="text-xs text-red-400 text-center">{errMsg}</p>
        )}

        <button
          type="submit"
          disabled={loading || !email || !pass}
          className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}
        >
          {loading
            ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : 'ログイン'}
        </button>
      </form>
    </div>
  );
}
