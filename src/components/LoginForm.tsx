/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent } from "react";
import { UserSession, AdminRole } from "../types";
import { FirebaseService } from "../firebase";
import { KeyRound, Users, GraduationCap, ShieldAlert, BookOpen, Eye, EyeOff } from "lucide-react";

interface LoginFormProps {
  onLoginSuccess: (session: UserSession) => void;
  isLoading: boolean;
  defaultType?: "STUDENT" | "ADMIN" | "TEACHER";
}

export default function LoginForm({ onLoginSuccess, isLoading, defaultType = "STUDENT" }: LoginFormProps) {
  const [loginType, setLoginType] = useState<"STUDENT" | "ADMIN" | "TEACHER">(defaultType);
  const [adminRole, setAdminRole] = useState<AdminRole>("UTAMA");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const session = await FirebaseService.performLogin(
        username,
        password,
        loginType,
        loginType === "ADMIN" ? adminRole : undefined
      );
      onLoginSuccess(session);
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || "Gagal melakukan verifikasi masuk.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden" id="login-container">
      {/* Tab Selector */}
      <div className="flex border-b border-slate-100 overflow-x-auto">
        <button
          type="button"
          id="tab-siswa"
          onClick={() => {
            setLoginType("STUDENT");
            setUsername("");
            setPassword("");
            setError(null);
          }}
          className={`flex-1 py-4 text-center font-bold text-xs flex items-center justify-center gap-1.5 transition-all duration-200 min-w-[110px] shrink-0 ${
            loginType === "STUDENT"
              ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/20"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          Admin Kelas
        </button>
        <button
          type="button"
          id="tab-guru"
          onClick={() => {
            setLoginType("TEACHER");
            setUsername("guru");
            setPassword("");
            setError(null);
          }}
          className={`flex-1 py-4 text-center font-bold text-xs flex items-center justify-center gap-1.5 transition-all duration-200 min-w-[110px] shrink-0 ${
            loginType === "TEACHER"
              ? "text-amber-600 border-b-2 border-amber-600 bg-amber-50/20"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Admin Guru
        </button>
        <button
          type="button"
          id="tab-admin"
          onClick={() => {
            setLoginType("ADMIN");
            setUsername("admin");
            setPassword("");
            setError(null);
          }}
          className={`flex-1 py-4 text-center font-bold text-xs flex items-center justify-center gap-1.5 transition-all duration-200 min-w-[110px] shrink-0 ${
            loginType === "ADMIN"
              ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/20"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          }`}
        >
          <KeyRound className="w-4 h-4" />
          Admin Sekolah
        </button>
      </div>

      <div className="p-6 md:p-8">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800">
            {loginType === "STUDENT" 
              ? "Masuk Admin Kelas" 
              : loginType === "TEACHER" 
              ? "Masuk Admin Guru" 
              : "Masuk Administrator"}
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            {loginType === "STUDENT"
              ? "Silakan login menggunakan akun admin kelas Anda untuk melaporkan kehadiran guru."
              : loginType === "TEACHER"
              ? "Silakan login menggunakan akun Admin Guru Anda untuk melaporkan izin mengajar guru."
              : "Silakan pilih hak akses dan masukkan password admin Anda."}
          </p>
        </div>

        {error && (
          <div className="mb-5 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-start gap-3" id="login-error">
            <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="text-xs text-red-700 font-medium leading-relaxed">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" id="login-form">
          {loginType === "TEACHER" ? (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 block">Username Admin Guru</label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  id="input-username"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoComplete="username"
                  placeholder="Contoh: guru"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                />
              </div>
            </div>
          ) : loginType === "ADMIN" ? (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 block">Pilih Peran Admin</label>
              <select
                id="select-admin-role"
                value={adminRole}
                onChange={(e) => setAdminRole(e.target.value as AdminRole)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <option value="UTAMA">Admin Utama</option>
                <option value="TU">Admin Tata Usaha (TU)</option>
                <option value="BK">Admin Bimbingan Konseling (BK)</option>
                <option value="TATIB">Admin Tata Tertib</option>
              </select>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 block">Username Admin Kelas</label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  id="input-username-student"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoComplete="username"
                  placeholder="Contoh: adminkelasx1"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Contoh: adminkelasx1 (atau adminkelas10a/sesuai Sheet DATA_UTAMA)</p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-600 block">Password</label>
              <span className="text-[10px] text-slate-400">Peka huruf besar/kecil ditoleransi pada HP</span>
            </div>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                id="input-password"
                required
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="current-password"
                placeholder="Masukkan password Anda"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer rounded-lg hover:bg-slate-100"
                title={showPassword ? "Sembunyikan Password" : "Tampilkan Password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            id="btn-submit-login"
            disabled={isSubmitting || isLoading}
            className={`w-full py-3.5 rounded-xl text-white font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
              loginType === "STUDENT"
                ? "bg-blue-600 hover:bg-blue-700 active:scale-[0.98] shadow-md shadow-blue-500/20"
                : loginType === "TEACHER"
                ? "bg-amber-600 hover:bg-amber-700 active:scale-[0.98] shadow-md shadow-amber-500/20"
                : "bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] shadow-md shadow-indigo-500/20"
            } disabled:opacity-50 disabled:pointer-events-none`}
          >
            {isSubmitting ? "Sedang Memverifikasi..." : "Masuk ke Sistem"}
          </button>
        </form>
      </div>
    </div>
  );
}
