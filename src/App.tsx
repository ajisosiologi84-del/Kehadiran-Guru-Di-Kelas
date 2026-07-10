/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { UserSession, ScheduleData } from "./types";
import LoginForm from "./components/LoginForm";
import StudentInputForm from "./components/StudentInputForm";
import TeacherLeaveForm from "./components/TeacherLeaveForm";
import AdminDashboard from "./components/AdminDashboard";
import { FirebaseService } from "./firebase";

// @ts-ignore
import sapaGuruMockup from "./assets/sapa_guru_mockup.svg";
import {
  GraduationCap, ClipboardList, BookOpen, KeyRound, CalendarDays, ExternalLink,
  ChevronRight, ArrowLeft, Loader2, RefreshCw, LayoutDashboard, ShieldCheck
} from "lucide-react";

export default function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [currentPage, setCurrentPage] = useState<"HOME" | "STUDENT_FORM" | "TEACHER_FORM" | "ADMIN_DASHBOARD">("HOME");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<{ logoUrl: string; informasiUmum: string } | null>(null);

  // Load session from localStorage on mount and fetch schedule data
  useEffect(() => {
    const savedSession = localStorage.getItem("presence_session");
    if (savedSession) {
      try {
        setSession(JSON.parse(savedSession));
      } catch (e) {
        localStorage.removeItem("presence_session");
      }
    }
    fetchSchedule();
  }, []);

  const fetchSchedule = async () => {
    setIsLoading(true);
    try {
      const [sched, setts] = await Promise.all([
        FirebaseService.getScheduleData(),
        FirebaseService.getSettings()
      ]);
      setScheduleData(sched);
      setSettings(setts);
    } catch (e) {
      setError("Kesalahan koneksi jaringan saat memuat data.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSuccess = (newSession: UserSession) => {
    setSession(newSession);
    localStorage.setItem("presence_session", JSON.stringify(newSession));
    if (newSession.type === "ADMIN") {
      setCurrentPage("ADMIN_DASHBOARD");
    } else if (newSession.type === "TEACHER") {
      setCurrentPage("TEACHER_FORM");
    } else {
      setCurrentPage("STUDENT_FORM");
    }
  };

  const handleLogout = () => {
    setSession(null);
    localStorage.removeItem("presence_session");
    setCurrentPage("HOME");
  };

  // Auto-route on clicking action portal
  const handlePortalClick = (target: "STUDENT" | "TEACHER" | "ADMIN") => {
    if (target === "TEACHER") {
      if (session && (session.type === "TEACHER" || session.type === "ADMIN")) {
        setCurrentPage("TEACHER_FORM");
      } else {
        setSession(null); // Clear other sessions if any
        setCurrentPage("TEACHER_FORM"); // Shows login inside view
      }
    } else if (target === "STUDENT") {
      if (session && session.type === "STUDENT") {
        setCurrentPage("STUDENT_FORM");
      } else {
        setSession(null); // Clear admin session if any
        setCurrentPage("STUDENT_FORM"); // Shows login inside view
      }
    } else if (target === "ADMIN") {
      if (session && session.type === "ADMIN") {
        setCurrentPage("ADMIN_DASHBOARD");
      } else {
        setSession(null); // Clear student session if any
        setCurrentPage("ADMIN_DASHBOARD"); // Shows login inside view
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6" id="loading-screen">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
        <h3 className="text-lg font-bold text-slate-700">Memuat SAPA Guru...</h3>
        <p className="text-xs text-slate-400 mt-1">Mengambil data guru dan admin kelas langsung dari Google Sheets</p>
      </div>
    );
  }

  // Fallback state if scheduleData is missing
  const activeSchedule = scheduleData || {
    namaGuruList: [],
    mataPelajaranList: [],
    jamKeList: [],
    classAdmins: {}
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between" id="app-container">
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-100 shadow-sm" id="main-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div
            onClick={() => setCurrentPage("HOME")}
            className="flex items-center gap-3 cursor-pointer select-none"
            id="brand-logo"
          >
            {settings?.logoUrl ? (
              <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md border border-slate-100 flex items-center justify-center bg-white shrink-0">
                <img src={settings.logoUrl} alt="Logo Sekolah" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
              </div>
            ) : (
              <div className="p-2 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-xl shadow-md shadow-blue-500/20 shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
            )}
            <div>
              <h1 className="text-lg font-black text-slate-800 tracking-tight leading-none">SAPA Guru</h1>
              <p className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase mt-1">Sistem Absensi & Pelaporan Akuntabel Guru</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6" id="nav-desktop">
            <button
              onClick={() => setCurrentPage("HOME")}
              id="nav-home"
              className={`text-xs font-bold uppercase tracking-wider transition-all ${
                currentPage === "HOME" ? "text-blue-600" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Beranda
            </button>
            <button
              onClick={() => handlePortalClick("STUDENT")}
              id="nav-kelas"
              className={`text-xs font-bold uppercase tracking-wider transition-all ${
                currentPage === "STUDENT_FORM" ? "text-blue-600" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              DATA INPUT KELAS
            </button>
            <button
              onClick={() => handlePortalClick("TEACHER")}
              id="nav-izin"
              className={`text-xs font-bold uppercase tracking-wider transition-all ${
                currentPage === "TEACHER_FORM" ? "text-blue-600" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              DATA INPUT IZIN GURU
            </button>
            <button
              onClick={() => handlePortalClick("ADMIN")}
              id="nav-admin"
              className={`text-xs font-bold uppercase tracking-wider transition-all ${
                currentPage === "ADMIN_DASHBOARD" ? "text-blue-600" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              DASHBOARD MONITORING
            </button>
          </nav>

          <div className="flex items-center gap-3" id="user-status-bar">
            {session && (
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg">
                  {session.type === "ADMIN" 
                    ? `Admin ${session.role}` 
                    : session.type === "TEACHER" 
                    ? "Admin Guru" 
                    : `Kelas: ${session.username}`}
                </span>
                <button
                  onClick={handleLogout}
                  id="btn-logout-nav"
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-100 transition-all"
                >
                  Keluar
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8" id="main-content">
        {/* LOBBY VIEW / HOME */}
        {currentPage === "HOME" && (
          <div className="space-y-12" id="home-view">
            {/* Hero Welcome Banner */}
            <div className="bg-gradient-to-tr from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-8 md:p-12 relative overflow-hidden shadow-xl" id="hero-banner">
              <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

              <div className="relative max-w-2xl space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 text-blue-200 text-xs font-bold tracking-wide rounded-full border border-white/5">
                  <CalendarDays className="w-3.5 h-3.5" />
                  Sistem Realtime Terintegrasi
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight">
                  Pelaporan Kehadiran Guru Secara Kolektif & Transparan
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Platform digital untuk memudahkan perwakilan siswa dalam melaporkan kehadiran guru di kelas, serta bagi guru untuk mengajukan izin mengajar, terkoneksi langsung dengan dashboard pemantauan multi-admin sekolah.
                </p>
              </div>
            </div>

            {/* Informasi Umum Card */}
            {settings?.informasiUmum && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-sm" id="informasi-umum-card">
                <h3 className="text-sm font-bold text-amber-850 flex items-center gap-2">
                  <span className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">📢</span>
                  INFORMASI UMUM SEKOLAH
                </h3>
                <div className="text-xs text-amber-900 mt-2 whitespace-pre-wrap leading-relaxed">
                  {settings.informasiUmum}
                </div>
              </div>
            )}

            {/* Action Portals */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8" id="portals-container">
              {/* Portal 1: Siswa */}
              <div
                onClick={() => handlePortalClick("STUDENT")}
                className="group bg-white rounded-2xl border border-slate-100 p-8 shadow-sm hover:shadow-xl hover:border-blue-200 cursor-pointer transition-all duration-300 flex flex-col justify-between"
                id="portal-siswa"
              >
                <div>
                  <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl w-fit group-hover:scale-110 transition-transform duration-300">
                    <GraduationCap className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mt-6 group-hover:text-blue-600 transition-colors">DATA INPUT KELAS</h3>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Halaman khusus perwakilan siswa kelas (Admin Kelas) untuk menginput kehadiran guru pada jam pelajaran berlangsung.
                  </p>
                </div>
                <div className="pt-6 border-t border-slate-50 mt-8 flex items-center justify-between text-xs font-bold text-blue-600">
                  <span>{session?.type === "STUDENT" ? "Masuk ke Form Kelas" : "Login Admin Kelas"}</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
                </div>
              </div>

              {/* Portal 2: Guru */}
              <div
                onClick={() => handlePortalClick("TEACHER")}
                className="group bg-white rounded-2xl border border-slate-100 p-8 shadow-sm hover:shadow-xl hover:border-amber-200 cursor-pointer transition-all duration-300 flex flex-col justify-between"
                id="portal-guru"
              >
                <div>
                  <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl w-fit group-hover:scale-110 transition-transform duration-300">
                    <BookOpen className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mt-6 group-hover:text-amber-600 transition-colors">DATA INPUT IZIN</h3>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Formulir bebas login bagi Bapak/Ibu Guru yang berhalangan mengajar guna menginput permohonan izin atau surat sakit.
                  </p>
                </div>
                <div className="pt-6 border-t border-slate-50 mt-8 flex items-center justify-between text-xs font-bold text-amber-600">
                  <span>Isi Pengajuan Izin Guru</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
                </div>
              </div>

              {/* Portal 3: Admin */}
              <div
                onClick={() => handlePortalClick("ADMIN")}
                className="group bg-white rounded-2xl border border-slate-100 p-8 shadow-sm hover:shadow-xl hover:border-indigo-200 cursor-pointer transition-all duration-300 flex flex-col justify-between"
                id="portal-admin"
              >
                <div>
                  <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl w-fit group-hover:scale-110 transition-transform duration-300">
                    <KeyRound className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mt-6 group-hover:text-indigo-600 transition-colors">ADMINISTRATOR</h3>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Akses dashboard monitoring statistik realtime bagi Admin Utama, Tata Usaha (TU), BK, dan Tata Tertib sekolah.
                  </p>
                </div>
                <div className="pt-6 border-t border-slate-50 mt-8 flex items-center justify-between text-xs font-bold text-indigo-600">
                  <span>{session?.type === "ADMIN" ? "Masuk ke Dashboard" : "Login Admin Sekolah"}</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
                </div>
              </div>
            </div>

            {/* Visual Showcase Banner SAPA Guru */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl overflow-hidden shadow-xl border border-slate-700/50 flex flex-col lg:flex-row items-center gap-6 p-6 lg:p-8 relative" id="sapaguru-visual-showcase-home">
              {/* Subtle decorative glowing lights */}
              <div className="absolute top-0 left-0 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl pointer-events-none"></div>
              <div className="absolute bottom-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

              <div className="flex-1 space-y-4 z-10 text-left">
                <div className="flex items-center gap-3">
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">Aplikasi Mobile SAPA Guru Aktif</span>
                </div>
                
                <h3 className="text-xl lg:text-2xl font-black text-white leading-tight tracking-tight">
                  Sistem Absensi Mandiri &amp; Transparan Terintegrasi Realtime
                </h3>
                
                <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
                  Tampilan ekosistem digital <strong className="text-emerald-400">SAPA Guru</strong> yang mendeteksi kehadiran mengajar Bapak/Ibu guru secara transparan, akurat, dan realtime. Terhubung langsung dengan database cloud dan sinkronisasi otomatis Google Sheets.
                </p>

                <div className="flex flex-wrap gap-2.5 pt-2">
                  <span className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700/60 text-[10px] font-bold text-slate-300 flex items-center gap-1.5">
                    📍 SMA Negeri 2 Kota Pasuruan
                  </span>
                  <span className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700/60 text-[10px] font-bold text-slate-300 flex items-center gap-1.5">
                    📱 Pendataan Selfie &amp; Lokasi GPS
                  </span>
                  <span className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700/60 text-[10px] font-bold text-slate-300 flex items-center gap-1.5">
                    📊 Rekapitulasi Otomatis (A4/F4)
                  </span>
                </div>
              </div>

              {/* Mockup Image Container */}
              <div className="w-full lg:w-[480px] shrink-0 z-10 transition-transform duration-500 hover:scale-[1.01]" id="sapaguru-mockup-frame-home">
                <img 
                  src={sapaGuruMockup} 
                  alt="SAPA Guru Mobile App Mockup Showcase" 
                  className="w-full h-auto object-contain rounded-2xl shadow-lg border border-slate-700/30"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          </div>
        )}

        {/* STUDENT VIEW */}
        {currentPage === "STUDENT_FORM" && (
          <div className="space-y-6" id="student-view-wrapper">
            <button
              onClick={() => setCurrentPage("HOME")}
              id="btn-back-home-student"
              className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-all"
            >
              <ArrowLeft className="w-4 h-4" /> Kembali ke Menu Beranda
            </button>

            {session && session.type === "STUDENT" ? (
              <StudentInputForm scheduleData={activeSchedule} username={session.username} />
            ) : (
              <div className="flex justify-center py-10">
                <LoginForm onLoginSuccess={handleLoginSuccess} isLoading={isLoading} />
              </div>
            )}
          </div>
        )}

        {/* TEACHER LEAVE VIEW */}
        {currentPage === "TEACHER_FORM" && (
          <div className="space-y-6" id="teacher-view-wrapper">
            <button
              onClick={() => setCurrentPage("HOME")}
              id="btn-back-home-teacher"
              className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-all"
            >
              <ArrowLeft className="w-4 h-4" /> Kembali ke Menu Beranda
            </button>

            {session && (session.type === "TEACHER" || session.type === "ADMIN") ? (
              <TeacherLeaveForm scheduleData={activeSchedule} />
            ) : (
              <div className="flex justify-center py-10">
                <LoginForm onLoginSuccess={handleLoginSuccess} isLoading={isLoading} defaultType="TEACHER" />
              </div>
            )}
          </div>
        )}

        {/* ADMIN VIEW */}
        {currentPage === "ADMIN_DASHBOARD" && (
          <div className="space-y-6" id="admin-view-wrapper">
            <button
              onClick={() => setCurrentPage("HOME")}
              id="btn-back-home-admin"
              className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-all"
            >
              <ArrowLeft className="w-4 h-4" /> Kembali ke Menu Beranda
            </button>

            {session && session.type === "ADMIN" && session.role ? (
              <AdminDashboard
                role={session.role}
                scheduleData={activeSchedule}
                onLogout={handleLogout}
              />
            ) : (
              <div className="flex justify-center py-10">
                <LoginForm onLoginSuccess={handleLoginSuccess} isLoading={isLoading} />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-100 py-6 mt-12 text-center text-xs text-slate-400" id="main-footer">
        <div className="max-w-7xl mx-auto px-4">
          <p>© 2026 SAPA Guru</p>
          <p className="mt-1 font-mono text-[10px]">Version 2.0.0</p>
        </div>
      </footer>
    </div>
  );
}

