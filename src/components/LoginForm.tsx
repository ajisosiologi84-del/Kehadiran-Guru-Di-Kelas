/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent } from "react";
import { UserSession, AdminRole } from "../types";
import { FirebaseService } from "../firebase";
import { KeyRound, Users, GraduationCap, ShieldAlert } from "lucide-react";

interface LoginFormProps {
  onLoginSuccess: (session: UserSession) => void;
  isLoading: boolean;
}

export default function LoginForm({ onLoginSuccess, isLoading }: LoginFormProps) {
  const [loginType, setLoginType] = useState<"STUDENT" | "ADMIN">("STUDENT");
  const [adminRole, setAdminRole] = useState<AdminRole>("UTAMA");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
      <div className="flex border-b border-slate-100">
        <button
          type="button"
          id="tab-siswa"
          onClick={() => {
            setLoginType("STUDENT");
            setUsername("");
            setPassword("");
            setError(null);
          }}
          className={`flex-1 py-4 text-center font-medium text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
            loginType === "STUDENT"
              ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/20"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          Admin Kelas (Siswa)
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
          className={`flex-1 py-4 text-center font-medium text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
            loginType === "ADMIN"
              ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/20"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          }`}
        >
          <KeyRound className="w-4 h-4" />
          Admin Sekolah
        </button>
      </div>

      <div className="p-8">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800">
            {loginType === "STUDENT" ? "Masuk Admin Kelas" : "Masuk Administrator"}
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            {loginType === "STUDENT"
              ? "Silakan login menggunakan akun admin kelas Anda untuk melaporkan kehadiran guru."
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
          {loginType === "ADMIN" ? (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 block">Pilih Peran Admin</label>
              <select
                id="select-admin-role"
                value={adminRole}
                onChange={(e) => setAdminRole(e.target.value as AdminRole)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
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
                  id="input-username"
                  required
                  placeholder="Contoh: adminkelasx1"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-sm placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
              <p className="text-[10px] text-slate-400">Username sesuai yang tercantum di Sheet DATA_UTAMA</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600 block">Password</label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                id="input-password"
                required
                placeholder="Masukkan password Anda"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-sm placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            id="btn-submit-login"
            disabled={isSubmitting || isLoading}
            className={`w-full py-3 rounded-lg text-white font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
              loginType === "STUDENT"
                ? "bg-blue-600 hover:bg-blue-700 active:scale-[0.98] shadow-md shadow-blue-500/10"
                : "bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] shadow-md shadow-indigo-500/10"
            } disabled:opacity-50 disabled:pointer-events-none`}
          >
            {isSubmitting ? "Sedang Memverifikasi..." : "Masuk ke Sistem"}
          </button>
        </form>


      </div>
    </div>
  );
}
