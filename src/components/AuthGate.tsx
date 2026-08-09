"use client";

import { useState, useEffect, createContext, useContext } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
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

function authErrMsg(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use':    return 'そのメールアドレスは既に登録されています';
    case 'auth/weak-password':           return 'パスワードは6文字以上にしてください';
    case 'auth/invalid-email':           return 'メールアドレスの形式が正しくありません';
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':          return 'メールアドレスまたはパスワードが正しくありません';
    default:                             return `エラー: ${code}`;
  }
}

export default function AuthGate({ children }: Props) {
  const [user,    setUser]    = useState<User | null | undefined>(undefined);
  const [mode,    setMode]    = useState<'login' | 'register'>('login');
  const [email,   setEmail]   = useState('');
  const [pass,    setPass]    = useState('');
  const [pass2,   setPass2]   = useState('');
  const [errMsg,  setErrMsg]  = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!auth) { setUser(null); return; }
    return onAuthStateChanged(auth, setUser);
  }, []);

  const switchMode = (next: 'login' | 'register') => {
    setMode(next);
    setErrMsg('');
    setPass('');
    setPass2('');
  };

  // Initial auth state loading
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !email || !pass) return;
    if (mode === 'register' && pass !== pass2) {
      setErrMsg('パスワードが一致しません');
      return;
    }
    setLoading(true);
    setErrMsg('');
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, pass);
      } else {
        await createUserWithEmailAndPassword(auth, email, pass);
      }
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code ?? '';
      setErrMsg(authErrMsg(code));
    } finally {
      setLoading(false);
    }
  };

  const isRegister = mode === 'register';

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0f1e] px-6">
      <div className="text-center mb-8">
        <p className="text-5xl mb-3">💪</p>
        <p className="text-2xl font-black text-white tracking-tight">BODYMAKE</p>
      </div>

      {/* Mode toggle */}
      <div className="flex bg-[#111827] border border-[#1e2d40] rounded-2xl p-1 mb-6 w-full max-w-xs">
        {(['login', 'register'] as const).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${
              mode === m
                ? 'bg-blue-600 text-white'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {m === 'login' ? 'ログイン' : '新規登録'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-3">
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
          placeholder="パスワード（6文字以上）"
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          className="w-full bg-[#111827] border border-[#1e2d40] rounded-2xl px-4 py-3.5 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500/60"
          style={{ colorScheme: 'dark' }}
        />
        {isRegister && (
          <input
            type="password"
            value={pass2}
            onChange={e => setPass2(e.target.value)}
            placeholder="パスワード（確認）"
            autoComplete="new-password"
            className="w-full bg-[#111827] border border-[#1e2d40] rounded-2xl px-4 py-3.5 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500/60"
            style={{ colorScheme: 'dark' }}
          />
        )}

        {errMsg && (
          <p className="text-xs text-red-400 text-center px-2">{errMsg}</p>
        )}

        <button
          type="submit"
          disabled={loading || !email || !pass || (isRegister && !pass2)}
          className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center transition-all active:scale-95 disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}
        >
          {loading
            ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : isRegister ? 'アカウントを作成' : 'ログイン'}
        </button>
      </form>

      {isRegister && (
        <p className="text-[10px] text-slate-600 mt-4 text-center max-w-xs">
          登録後すぐにログイン状態になります。データはアカウントごとに完全に分離されます。
        </p>
      )}
    </div>
  );
}
