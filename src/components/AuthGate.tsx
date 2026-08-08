"use client";

import { useState, useEffect } from "react";
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";

const ALLOWED_EMAIL = process.env.NEXT_PUBLIC_ALLOWED_EMAIL ?? 'handtadanosuke@gmail.com';

interface Props {
  children: React.ReactNode;
}

export default function AuthGate({ children }: Props) {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    if (!auth) { setUser(null); return; }
    return onAuthStateChanged(auth, setUser);
  }, []);

  // Loading
  if (user === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0f1e]">
        <div className="w-10 h-10 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  // Firebase not configured — bypass auth
  if (!auth) return <>{children}</>;

  // Not authenticated or wrong account
  if (!user || user.email !== ALLOWED_EMAIL) {
    const signIn = async () => {
      if (!auth) return;
      try {
        const result = await signInWithPopup(auth, new GoogleAuthProvider());
        if (result.user.email !== ALLOWED_EMAIL) {
          const { signOut } = await import('firebase/auth');
          await signOut(auth);
          alert('このアカウントではアクセスできません。');
        }
      } catch (e: unknown) {
        if ((e as { code?: string })?.code !== 'auth/popup-closed-by-user') {
          console.error(e);
        }
      }
    };

    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0f1e] px-6">
        <div className="text-center mb-10">
          <p className="text-5xl mb-3">💪</p>
          <p className="text-2xl font-black text-white tracking-tight">BODYMAKE</p>
          <p className="text-sm text-slate-500 mt-1">薫之介のボディメイクダッシュボード</p>
        </div>
        <button
          onClick={signIn}
          className="flex items-center gap-3 bg-white text-gray-800 font-bold px-6 py-4 rounded-2xl text-sm shadow-xl active:scale-95 transition-all"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Googleでログイン
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
