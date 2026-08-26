import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Mail, Lock, ShieldAlert, CheckCircle, Info } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setSuccessMsg('Pendaftaran berhasil! Silakan periksa email Anda untuk verifikasi atau hubungi Admin.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onLoginSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan saat autentikasi.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal login menggunakan Google.');
      setLoading(false);
    }
  };

  const handleMicrosoftLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal login menggunakan Microsoft. Pastikan provider Azure diaktifkan di Supabase.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f1f2f5] dark:bg-[#1e293b] p-4 sm:p-6 md:p-8 relative overflow-hidden transition-all duration-300">
      {/* Background decoration */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-sky-900/10 dark:bg-sky-900/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-900/10 dark:bg-indigo-900/20 rounded-full blur-[120px] pointer-events-none" />
 
      {/* Main card matching legacy layout */}
      <div className="w-full max-w-md md:max-w-5xl rounded-3xl bg-[#f1f2f5] dark:bg-[#1e293b] border border-white/60 dark:border-slate-800 shadow-[12px_12px_24px_#d5d8df,-12px_-12px_24px_#ffffff] dark:shadow-[12px_12px_24px_#0e141d,-12px_-12px_24px_#2e3e59] flex flex-col md:flex-row overflow-hidden min-h-[500px] md:min-h-[550px] z-10">
        
        {/* Left Column: Promotional panel (hidden on mobile) */}
        <div className="hidden md:flex md:w-1/2 bg-gradient-to-tr from-sky-950 via-slate-900 to-indigo-950 p-12 flex-col justify-between relative overflow-hidden border-r border-[#d5d8df]/10 dark:border-[#0e141d]/10">
          
          {/* Decorative grid overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
          <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-sky-500/10 blur-[100px] pointer-events-none" />
 
          {/* Top Brand Logo */}
          <div className="flex items-center gap-3 z-10">
            <div className="bg-white p-1.5 rounded-xl flex items-center justify-center border border-white/20 shadow-md h-12 w-auto">
              <img
                src="/images/Logo-Berlian-Manyar-Sejahtera.png"
                alt="BMS Logo"
                className="h-8 object-contain"
              />
            </div>
            <div className="text-left">
              <span className="block text-xs font-bold text-white uppercase tracking-wider leading-none">
                PT. Berlian Manyar Sejahtera
              </span>
              <span className="text-[9px] text-slate-300 font-semibold tracking-wider">Bidding Portal</span>
            </div>
          </div>
 
          {/* Center Slogan */}
          <div className="space-y-4 z-10">
            <h2 className="text-3xl font-extrabold text-white leading-tight tracking-tight">
              Bidding Management{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-300">
                System
              </span>
            </h2>
            <p className="text-xs text-slate-350 leading-relaxed max-w-sm font-normal">
              Aplikasi internal terintegrasi untuk pengelolaan penawaran (bidding) lelang aset perusahaan PT. Berlian Manyar Sejahtera.
            </p>
          </div>
 
          {/* Footer Copy */}
          <div className="z-10 text-[9px] text-slate-400 flex items-center justify-between">
            <span>PT. Berlian Manyar Sejahtera</span>
            <span>App Dev v2.0.0</span>
          </div>
        </div>
 
        {/* Right Column: The Login Box */}
        <div className="w-full md:w-1/2 p-8 sm:p-12 md:p-16 flex flex-col justify-between bg-[#f1f2f5] dark:bg-[#1e293b]">
          
          {/* Mobile Header (Hidden on Desktop) */}
          <div className="flex items-center justify-between md:justify-end gap-2 md:mb-0 mb-8 border-b border-slate-200/50 dark:border-slate-800/60 pb-4 md:border-b-0 md:pb-0 md:hidden">
            <div className="flex items-center gap-2">
              <div className="bg-white p-1 rounded-lg border border-slate-200/50 shadow-sm h-8 w-auto flex items-center justify-center">
                <img
                  src="/images/Logo-Berlian-Manyar-Sejahtera.png"
                  alt="BMS Logo"
                  className="h-6 object-contain"
                />
              </div>
              <div className="text-left">
                <span className="block text-[10px] font-bold text-slate-800 dark:text-white uppercase tracking-wider leading-none">
                  PT. Berlian Manyar Sejahtera
                </span>
                <span className="text-[8px] text-slate-450 dark:text-slate-550 font-semibold tracking-wider">
                  Bidding Portal
                </span>
              </div>
            </div>
          </div>
 
          {/* Center Login Form */}
          <div className="max-w-sm w-full mx-auto space-y-6 my-auto text-center md:text-left">
            <div className="mx-auto md:mx-0 mb-4 max-h-16 flex items-center justify-center md:justify-start relative">
              <div className="absolute inset-0 bg-sky-500/10 dark:bg-sky-500/20 blur-xl rounded-full w-24 h-16 mx-auto md:mx-0 -z-10" />
              <img
                src="/images/Logo-Berlian-Manyar-Sejahtera.png"
                alt="BMS Logo"
                className="h-16 object-contain z-10"
              />
            </div>
 
            <div>
              <h1 className="text-2xl font-extrabold text-slate-850 dark:text-slate-100 tracking-tight leading-tight mb-2">
                Sistem Lelang Internal
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-450">
                Silakan masuk menggunakan akun korporat Anda untuk mulai berpartisipasi dalam lelang aset aktif.
              </p>
            </div>
 
            {errorMsg && (
              <div className="flex items-start gap-3 bg-rose-500/10 dark:bg-rose-950/40 border border-rose-500/20 rounded-xl p-4 text-rose-600 dark:text-rose-400 text-xs text-left">
                <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}
 
            {successMsg && (
              <div className="flex items-start gap-3 bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/20 rounded-xl p-4 text-emerald-600 dark:text-emerald-400 text-xs text-left">
                <CheckCircle size={16} className="shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}
 
            {/* OAuth buttons wrapper (Now prominent at the top) */}
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-[#f1f2f5] dark:bg-[#1e293b] border border-white dark:border-slate-800/80 shadow-[inset_3px_3px_6px_#c8cbd4,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_6px_#0e141d,inset_-3px_-3px_6px_#2e3e59] flex flex-col gap-3">
                
                {/* Google Button */}
                <button
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="btn-neu w-full py-3 flex items-center justify-center gap-2.5 text-slate-700 dark:text-slate-200 bg-[#f1f2f5] dark:bg-[#1e293b] font-bold text-xs cursor-pointer active:scale-95"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      fill="#EA4335"
                    />
                  </svg>
                  <span>Masuk dengan Google</span>
                </button>
 
                {/* Microsoft Button */}
                <button
                  onClick={handleMicrosoftLogin}
                  disabled={loading}
                  className="btn-neu w-full py-3 flex items-center justify-center gap-2.5 text-slate-700 dark:text-slate-200 bg-[#f1f2f5] dark:bg-[#1e293b] font-bold text-xs cursor-pointer active:scale-95"
                >
                  <svg className="h-4 w-4" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 0H11V11H0V0Z" fill="#F25022" />
                    <path d="M12 0H23V11H12V0Z" fill="#7FBA00" />
                    <path d="M0 12H11V23H0V12Z" fill="#00A4EF" />
                    <path d="M12 12H23V23H12V12Z" fill="#FFB900" />
                  </svg>
                  <span>Masuk dengan Microsoft</span>
                </button>
              </div>
            </div>

            {/* Separator "atau" */}
            <div className="flex items-center gap-2 w-full my-3">
              <div className="h-[1px] bg-slate-200/30 dark:bg-slate-800/30 flex-grow" />
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                atau masuk dengan
              </span>
              <div className="h-[1px] bg-slate-200/30 dark:bg-slate-800/30 flex-grow" />
            </div>

            {/* Email form (Secondary below) */}
            <form onSubmit={handleEmailAuth} className="space-y-4 text-left">
              <div>
                <label className="block text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase mb-2 tracking-widest pl-1">
                  Email Perusahaan
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
                    <Mail size={16} />
                  </span>
                  <input
                    type="email"
                    required
                    placeholder="nama@bms.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#f1f2f5] dark:bg-[#1e293b] rounded-xl py-3 pl-11 pr-4 text-sm text-slate-800 dark:text-slate-200 outline-none transition-all placeholder-slate-400 dark:placeholder-slate-600 border border-white/40 dark:border-slate-850/40 shadow-[inset_1.5px_1.5px_3px_#c8cbd4] dark:shadow-[inset_1.5px_1.5px_3px_#0e141d]"
                  />
                </div>
              </div>
 
              <div>
                <label className="block text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase mb-2 tracking-widest pl-1">
                  Kata Sandi
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400">
                    <Lock size={16} />
                  </span>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#f1f2f5] dark:bg-[#1e293b] rounded-xl py-3 pl-11 pr-4 text-sm text-slate-800 dark:text-slate-200 outline-none transition-all placeholder-slate-400 dark:placeholder-slate-600 border border-white/40 dark:border-slate-850/40 shadow-[inset_1.5px_1.5px_3px_#c8cbd4] dark:shadow-[inset_1.5px_1.5px_3px_#0e141d]"
                  />
                </div>
              </div>
 
              <button
                type="submit"
                disabled={loading}
                className="btn-brand-neu w-full py-3.5 font-bold text-xs uppercase tracking-wider mt-3 shadow-md cursor-pointer active:scale-[0.98]"
              >
                {loading ? 'Memproses...' : isSignUp ? 'Daftar Akun Baru' : 'Masuk Ke Portal'}
              </button>
            </form>
 
            <div className="flex items-center justify-between text-[10px] text-slate-450 dark:text-slate-550 pt-2">
              <span className="flex items-center gap-1.5 font-medium">
                <Info size={12} className="text-slate-400" /> Gunakan email resmi
              </span>
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-brand-600 dark:text-brand-400 hover:text-brand-500 font-bold underline transition-all bg-transparent border-none p-0 cursor-pointer"
              >
                {isSignUp ? 'Masuk Portal' : 'Daftar Baru'}
              </button>
            </div>          </div>
 
          {/* Bottom copyright */}
          <div className="text-[9px] text-slate-400 text-center mt-8 md:mt-0">
            Bidding Management System &copy; 2026 PT. Berlian Manyar Sejahtera. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
};
