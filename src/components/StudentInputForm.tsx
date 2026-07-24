/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from "react";
import { ScheduleData, StudentSubmission, KELAS_LIST, TeacherLeaveSubmission } from "../types";
import { FirebaseService, FALLBACK_NAMA_GURU, FALLBACK_MATA_PELAJARAN, FALLBACK_JAM_KE } from "../firebase";
import { ClipboardList, Calendar, User, BookOpen, Clock, FileCheck, CheckCircle2, AlertCircle, Layers, Megaphone, Filter, Info, Bell } from "lucide-react";

interface StudentInputFormProps {
  scheduleData: ScheduleData;
  username: string;
}

const HARI_LIST = ["Senin", "Selasa", "Rabu", "Kamis", "Jum'at", "Sabtu", "Minggu"];

export default function StudentInputForm({ scheduleData, username }: StudentInputFormProps) {
  // Safe lists with fallbacks
  const guruList = (scheduleData && scheduleData.namaGuruList && scheduleData.namaGuruList.length > 0)
    ? scheduleData.namaGuruList
    : FALLBACK_NAMA_GURU;

  const mapelList = (scheduleData && scheduleData.mataPelajaranList && scheduleData.mataPelajaranList.length > 0)
    ? scheduleData.mataPelajaranList
    : FALLBACK_MATA_PELAJARAN;

  const jamList = (scheduleData && scheduleData.jamKeList && scheduleData.jamKeList.length > 0)
    ? scheduleData.jamKeList
    : FALLBACK_JAM_KE;

  // Pre-select based on username, e.g., "adminkelasx1" -> "X-1", "adminkelasxi5" -> "XI-5"
  const getDefaultKelas = (uname: string) => {
    if (!uname) return "X-1";
    const clean = uname.toLowerCase().replace(/[^a-z0-9]/g, "");

    // Check for XII
    const xiiMatch = clean.match(/(xii|12)[_\-]?(\d+)/);
    if (xiiMatch) {
      const target = `XII-${xiiMatch[2]}`;
      if (KELAS_LIST.includes(target)) return target;
    }
    // Check for XI
    const xiMatch = clean.match(/(xi|11)[_\-]?(\d+)/);
    if (xiMatch) {
      const target = `XI-${xiMatch[2]}`;
      if (KELAS_LIST.includes(target)) return target;
    }
    // Check for X
    const xMatch = clean.match(/(x|10)[_\-]?(\d+)/);
    if (xMatch) {
      const target = `X-${xMatch[2]}`;
      if (KELAS_LIST.includes(target)) return target;
    }
    return "X-1";
  };

  const [hari, setHari] = useState("Senin");
  const [tanggal, setTanggal] = useState("");
  const [selectedKelas, setSelectedKelas] = useState("X-1");
  const [selectedGuru, setSelectedGuru] = useState("");
  const [selectedMapel, setSelectedMapel] = useState("");
  const [selectedJams, setSelectedJams] = useState<string[]>([]);
  const [keterangan, setKeterangan] = useState<"HADIR" | "IZIN" | "SAKIT" | "TANPA KETERANGAN">("HADIR");

  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mySubmissions, setMySubmissions] = useState<StudentSubmission[]>([]);
  const [recentLeaves, setRecentLeaves] = useState<TeacherLeaveSubmission[]>([]);
  const [filterClassOnly, setFilterClassOnly] = useState(true);

  // Set today's date and correct day of week on mount
  useEffect(() => {
    const today = new Date();
    const formattedDate = today.toISOString().split("T")[0];
    setTanggal(formattedDate);

    const daysEngToInd: Record<number, string> = {
      0: "Minggu",
      1: "Senin",
      2: "Selasa",
      3: "Rabu",
      4: "Kamis",
      5: "Jum'at",
      6: "Sabtu"
    };
    setHari(daysEngToInd[today.getDay()]);

    const initialKelas = getDefaultKelas(username);
    setSelectedKelas(initialKelas);

    if (guruList.length > 0) setSelectedGuru(guruList[0]);
    if (mapelList.length > 0) setSelectedMapel(mapelList[0]);
    if (jamList.length > 0) setSelectedJams([jamList[0]]);

    fetchMySubmissions();
    fetchRecentLeaves();
  }, [scheduleData, username]);

  const fetchRecentLeaves = async () => {
    try {
      const data = await FirebaseService.getSubmissionsIzin();
      data.sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime());
      setRecentLeaves(data);
    } catch (e) {
      console.error("Gagal memuat info izin guru:", e);
    }
  };

  const fetchMySubmissions = async () => {
    try {
      const data = await FirebaseService.getSubmissionsKelas();
      const filtered = data.filter(s => {
        if (!s) return false;
        const normSubBy = (s.submittedBy || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const normUser = (username || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const userMatch = normSubBy && normUser && (normSubBy === normUser || normSubBy.includes(normUser) || normUser.includes(normSubBy));
        const classMatch = s.kelas && selectedKelas && s.kelas.trim().toLowerCase() === selectedKelas.trim().toLowerCase();
        return userMatch || classMatch;
      });
      filtered.sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime());
      setMySubmissions(filtered);
    } catch (e) {
      console.error("Gagal memuat riwayat penginputan:", e);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const guruToSubmit = selectedGuru || (guruList.length > 0 ? guruList[0] : "");
    const mapelToSubmit = selectedMapel || (mapelList.length > 0 ? mapelList[0] : "");

    if (!guruToSubmit || !mapelToSubmit) {
      setMessage({ type: "error", text: "Silakan pilih Nama Guru dan Mata Pelajaran." });
      return;
    }

    if (selectedJams.length === 0) {
      setMessage({ type: "error", text: "Silakan pilih minimal 1 jam pelajaran." });
      return;
    }

    if (selectedJams.length > 4) {
      setMessage({ type: "error", text: "Maksimal pemilihan adalah 4 jam pelajaran." });
      return;
    }

    const jamKeString = [...selectedJams].map(Number).sort((a, b) => a - b).join(", ");

    setIsSubmitting(true);

    try {
      await FirebaseService.addSubmissionKelas({
        hari,
        tanggal,
        namaGuru: guruToSubmit,
        mataPelajaran: mapelToSubmit,
        jamKe: jamKeString,
        keteranganKehadiran: keterangan,
        submittedBy: username || "adminkelas",
        kelas: selectedKelas
      });

      setMessage({
        type: "success",
        text: `Berhasil melaporkan kehadiran Guru: ${guruToSubmit} [${keterangan}]`
      });

      await fetchMySubmissions();
      await fetchRecentLeaves();
    } catch (err: any) {
      console.error("Submission error:", err);
      setMessage({ type: "error", text: err.message || "Terjadi kesalahan saat mengirimkan data." });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Convert username e.g. "adminkelasx1" to a nicer label: "Kelas X-1"
  const getReadableClass = (uname: string) => {
    const match = uname.match(/adminkelas([a-z]+)(\d+)/);
    if (match) {
      const tingkat = match[1].toUpperCase();
      const nomor = match[2];
      return `Admin Kelas ${tingkat}-${nomor}`;
    }
    return uname.toUpperCase();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8" id="student-view-container">
      {/* Form Card */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-md p-6 md:p-8" id="student-form-card">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-5 mb-6">
          <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Menu DATA INPUT KELAS</h1>
            <p className="text-xs text-slate-500">Laporan kehadiran guru di kelas oleh Perwakilan Siswa ({getReadableClass(username)})</p>
          </div>
        </div>

        {message && (
          <div
            id="student-form-message"
            className={`mb-6 p-4 rounded-xl flex items-start gap-3 border ${
              message.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            )}
            <div className="text-sm font-medium">{message.text}</div>
          </div>
        )}

        {/* Info Guru Berhalangan Hadir Hari Ini untuk Kelas terpilih */}
        {(() => {
          const classLeavesToday = recentLeaves.filter(sub => 
            sub.tanggal === tanggal && 
            sub.kelas === selectedKelas
          );
          if (classLeavesToday.length > 0) {
            return (
              <div 
                id="class-leaves-summary-alert"
                className="mb-6 p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 shadow-sm animate-pulse-slow"
              >
                <div className="flex items-center gap-2 mb-2 text-amber-800 font-bold text-sm">
                  <Megaphone className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Informasi Guru Piket: Guru Izin Hari Ini di Kelas {selectedKelas}</span>
                  <span className="ml-auto bg-amber-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                    {classLeavesToday.length} Guru
                  </span>
                </div>
                <div className="text-xs text-amber-800 space-y-1.5">
                  <p>Bapak/Ibu guru berikut berhalangan hadir di kelas Anda hari ini. Siswa diimbau tertib dan belajar mandiri:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                    {classLeavesToday.map((leave, idx) => (
                      <div key={idx} className="bg-white/80 p-2.5 rounded-lg border border-amber-200/50 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-extrabold text-slate-800">{leave.namaGuru}</span>
                          <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">Jam {leave.jamKe}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium truncate">{leave.mataPelajaran}</p>
                        <p className="text-[10px] text-amber-700 italic font-medium leading-relaxed bg-amber-100/30 p-1 rounded">
                          " {leave.keteranganIzinGuru} "
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          }
          return null;
        })()}

        {/* Alert spesifik jika Guru yang sedang dipilih di dropdown sedang Izin hari ini */}
        {(() => {
          if (!selectedGuru) return null;
          const matchingLeave = recentLeaves.find(sub => 
            sub.namaGuru.trim().toLowerCase() === selectedGuru.trim().toLowerCase() && 
            sub.tanggal === tanggal &&
            sub.kelas === selectedKelas
          );
          if (matchingLeave) {
            return (
              <div 
                id="selected-teacher-leave-alert"
                className="mb-6 p-4 rounded-xl border border-red-200 bg-red-50 flex items-start gap-3 text-red-900"
              >
                <Bell className="w-5 h-5 text-red-600 shrink-0 mt-0.5 animate-bounce" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-red-800">
                    Peringatan Penting! Guru Sedang Izin/Sakit
                  </h4>
                  <p className="text-xs text-red-700 leading-relaxed">
                    Bapak/Ibu <strong className="text-slate-800 font-extrabold">{selectedGuru}</strong> telah mengajukan status <strong className="text-red-800 font-bold">{matchingLeave.keteranganKehadiran}</strong> hari ini ({hari}, {tanggal}) untuk kelas <strong className="font-bold">{selectedKelas}</strong> pada <strong className="font-bold">Jam Ke-{matchingLeave.jamKe}</strong>.
                  </p>
                  <p className="text-xs text-slate-500 italic bg-white/60 p-1.5 rounded border border-red-100 mt-1">
                    Keterangan: "{matchingLeave.keteranganIzinGuru}"
                  </p>
                  <div className="mt-2 text-[10px] text-red-800/90 font-semibold">
                    💡 Harap sesuaikan Keterangan Kehadiran Guru di bawah ini menjadi "{matchingLeave.keteranganKehadiran}" sesuai laporan resmi beliau.
                  </div>
                </div>
              </div>
            );
          }
          return null;
        })()}

        <form onSubmit={handleSubmit} className="space-y-6" id="student-input-form">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Hari */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> Hari Pelaksanaan
              </label>
              <select
                id="student-hari"
                value={hari}
                onChange={(e) => setHari(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              >
                {HARI_LIST.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            {/* Tanggal */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> Tanggal
              </label>
              <input
                type="date"
                id="student-tanggal"
                required
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Nama Guru */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-slate-400" /> Nama Guru
              </label>
              <select
                id="student-guru"
                value={selectedGuru}
                onChange={(e) => setSelectedGuru(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              >
                <option value="">-- Pilih Guru --</option>
                {guruList.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            {/* Mata Pelajaran */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5 text-slate-400" /> Mata Pelajaran
              </label>
              <select
                id="student-mapel"
                value={selectedMapel}
                onChange={(e) => setSelectedMapel(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              >
                <option value="">-- Pilih Mata Pelajaran --</option>
                {mapelList.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: Kelas & Jam Ke */}
            <div className="space-y-5">
              {/* Kelas Dropdown */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-blue-500" /> Kelas
                </label>
                <select
                  id="student-kelas"
                  value={selectedKelas}
                  onChange={(e) => setSelectedKelas(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold"
                >
                  {KELAS_LIST.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>

              {/* Jam Ke (Checkboxes) */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-slate-400" /> Jam Ke- <span className="text-[10px] text-slate-400 font-normal">(Centang 1-4 jam)</span>
                </label>
                <div className="grid grid-cols-4 gap-1.5" id="student-jam-checkbox-group">
                  {jamList.map((j) => {
                    const isChecked = selectedJams.includes(j);
                    const isMaxReached = selectedJams.length >= 4 && !isChecked;
                    return (
                      <button
                        key={j}
                        type="button"
                        id={`jam-check-${j}`}
                        disabled={isMaxReached && !isChecked}
                        onClick={() => {
                          if (isChecked) {
                            setSelectedJams(prev => prev.filter(item => item !== j));
                          } else {
                            setSelectedJams(prev => [...prev, j]);
                          }
                        }}
                        className={`py-2 text-center text-xs font-bold rounded-lg border transition-all duration-200 ${
                          isChecked
                            ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed"
                        }`}
                      >
                        {j}
                      </button>
                    );
                  })}
                </div>
                {selectedJams.length === 0 ? (
                  <p className="text-[10px] text-rose-500 font-medium">Pilih minimal 1 jam.</p>
                ) : (
                  <p className="text-[10px] text-slate-400 font-medium">
                    Terpilih: Jam {([...selectedJams].map(Number).sort((a, b) => a - b).join(", "))}
                  </p>
                )}
              </div>
            </div>

            {/* Keterangan Kehadiran */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-2">
                <FileCheck className="w-3.5 h-3.5 text-slate-400" /> Keterangan Kehadiran Guru
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(["HADIR", "IZIN", "SAKIT", "TANPA KETERANGAN"] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    id={`btn-keterangan-${opt.replace(" ", "-")}`}
                    onClick={() => setKeterangan(opt)}
                    className={`py-2 text-xs font-semibold rounded-lg border transition-all duration-200 ${
                      keterangan === opt
                        ? opt === "HADIR"
                          ? "bg-emerald-50 border-emerald-500 text-emerald-700"
                          : opt === "IZIN"
                          ? "bg-amber-50 border-amber-500 text-amber-700"
                          : opt === "SAKIT"
                          ? "bg-sky-50 border-sky-500 text-sky-700"
                          : "bg-rose-50 border-rose-500 text-rose-700"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="submit"
            id="btn-submit-student"
            disabled={isSubmitting}
            className="w-full mt-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white py-3 px-6 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/15 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {isSubmitting ? "Mengirim Laporan..." : "Kirim Laporan Kehadiran"}
          </button>
        </form>
      </div>

      {/* Sidebar Panel containing Izin Guru & Riwayat Input */}
      <div className="space-y-6 lg:col-span-1" id="student-sidebar-container">
        
        {/* Section 1: Pengajuan Izin Guru Terbaru */}
        <div className="bg-slate-50 rounded-2xl border border-slate-100 p-6 shadow-sm" id="student-leaves-card">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-amber-500 shrink-0" /> Pengajuan Izin Terbaru
            </h3>
            <button
              type="button"
              onClick={fetchRecentLeaves}
              className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline font-bold cursor-pointer"
            >
              Refresh
            </button>
          </div>

          <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
            Daftar Bapak/Ibu Guru yang sedang izin/sakit. Gunakan info ini untuk verifikasi kehadiran.
          </p>

          {/* Toggle Filter Class */}
          <div className="flex gap-1 bg-slate-200/60 p-1 rounded-lg text-xs mb-4">
            <button
              type="button"
              onClick={() => setFilterClassOnly(true)}
              className={`flex-1 py-1.5 rounded-md font-semibold transition-all ${
                filterClassOnly 
                  ? "bg-white text-slate-800 shadow-xs" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Kelas Anda ({selectedKelas})
            </button>
            <button
              type="button"
              onClick={() => setFilterClassOnly(false)}
              className={`flex-1 py-1.5 rounded-md font-semibold transition-all ${
                !filterClassOnly 
                  ? "bg-white text-slate-800 shadow-xs" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Semua Kelas
            </button>
          </div>

          {(() => {
            const leavesToDisplay = recentLeaves.filter(sub => {
              if (filterClassOnly) {
                return sub.kelas === selectedKelas;
              }
              return true;
            });

            if (leavesToDisplay.length === 0) {
              return (
                <div className="bg-white border border-slate-100 rounded-xl p-6 text-center text-slate-400 text-xs">
                  {filterClassOnly 
                    ? `Alhamdulillah, belum ada pengajuan izin/sakit guru untuk Kelas ${selectedKelas} hari ini.`
                    : "Belum ada pengajuan izin/sakit guru terdaftar hari ini."}
                </div>
              );
            }

            return (
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1" id="student-leaves-list">
                {leavesToDisplay.map((sub) => {
                  const isToday = sub.tanggal === tanggal;
                  const isMyClass = sub.kelas === selectedKelas;
                  return (
                    <div
                      key={sub.id}
                      className={`p-3.5 rounded-xl border transition-all duration-200 space-y-2 relative hover:shadow-md ${
                        isMyClass 
                          ? "bg-amber-50/50 border-amber-300" 
                          : "bg-white border-slate-100"
                      }`}
                    >
                      {/* Pulse effect if today's leave */}
                      {isToday && (
                        <div className="absolute top-3.5 right-3 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </div>
                      )}

                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap pr-4">
                          {sub.kelas && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              isMyClass 
                                ? "bg-amber-100 text-amber-800 border border-amber-200" 
                                : "bg-slate-100 text-slate-600"
                            }`}>
                              {sub.kelas} {isMyClass && "⭐"}
                            </span>
                          )}
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            Jam {sub.jamKe}
                          </span>
                        </div>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                            sub.keteranganKehadiran === "IZIN"
                              ? "bg-amber-100 text-amber-800 border border-amber-200"
                              : "bg-sky-100 text-sky-800 border border-sky-200"
                          }`}
                        >
                          {sub.keteranganKehadiran}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-slate-800 leading-snug">
                        {sub.namaGuru}
                      </h4>
                      
                      <div className="text-[10px] text-slate-600 flex items-center gap-1 font-medium bg-slate-50 p-1.5 rounded">
                        <BookOpen className="w-3 h-3 text-slate-400" />
                        <span className="truncate">{sub.mataPelajaran}</span>
                      </div>

                      <div className="text-xs bg-slate-100/40 text-slate-600 p-2 rounded-lg border border-slate-200/40">
                        <p className="text-[9px] text-slate-400 font-bold mb-0.5 uppercase tracking-wider">Alasan Izin:</p>
                        <p className="italic text-[11px] font-medium leading-relaxed">"{sub.keteranganIzinGuru}"</p>
                      </div>

                      <div className="text-[9px] text-slate-400 flex justify-between items-center pt-1.5 border-t border-slate-100">
                        <span>{sub.hari}, {sub.tanggal}</span>
                        {isToday ? (
                          <span className="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.2 rounded-full border border-rose-100 text-[9px]">HARI INI</span>
                        ) : (
                          <span>Lampau</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Section 2: Riwayat Input Hari Ini */}
        <div className="bg-slate-50 rounded-2xl border border-slate-100 p-6 shadow-sm" id="student-history-card">
          <h3 className="text-sm font-extrabold text-slate-800 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" /> Riwayat Input Hari Ini
          </h3>

          {mySubmissions.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-xl p-8 text-center text-slate-400 text-xs">
              Belum ada laporan dari kelas Anda hari ini. Gunakan form di samping untuk mulai menginput.
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1" id="student-history-list">
              {mySubmissions.map((sub) => (
                <div
                  key={sub.id}
                  className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200 space-y-2"
                >
                  {/* Sequence: 1. Hari / Tanggal, 2. Kelas, 3. Nama Guru, 4. Mata Pelajaran, 5. Jam, 6. Kehadiran, 7. Pelapor */}
                  
                  {/* 1. Hari / Tanggal */}
                  <div className="flex justify-between items-center text-[11px] font-bold text-slate-600 bg-slate-100/70 p-2 rounded-lg border border-slate-200/50">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      {sub.hari}, {sub.tanggal}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 font-normal">
                      {sub.submittedAt ? new Date(sub.submittedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : ""}
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-1 px-1 text-xs">
                    {/* 2. Kelas */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase w-20 shrink-0">Kelas:</span>
                      <span className="font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-xs border border-blue-100">
                        {sub.kelas || selectedKelas}
                      </span>
                    </div>

                    {/* 3. Nama Guru */}
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase w-20 shrink-0 pt-0.5">Nama Guru:</span>
                      <span className="font-bold text-slate-800 leading-snug">
                        {sub.namaGuru}
                      </span>
                    </div>

                    {/* 4. Mata Pelajaran */}
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase w-20 shrink-0 pt-0.5">Mapel:</span>
                      <span className="font-medium text-slate-700">
                        {sub.mataPelajaran}
                      </span>
                    </div>

                    {/* 5. Jam */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase w-20 shrink-0">Jam Ke:</span>
                      <span className="font-mono font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-xs">
                        Jam {sub.jamKe}
                      </span>
                    </div>

                    {/* 6. Kehadiran */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase w-20 shrink-0">Kehadiran:</span>
                      <span
                        className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                          sub.keteranganKehadiran === "HADIR"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : sub.keteranganKehadiran === "IZIN"
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : sub.keteranganKehadiran === "SAKIT"
                            ? "bg-sky-100 text-sky-800 border border-sky-200"
                            : "bg-rose-100 text-rose-800 border border-rose-200"
                        }`}
                      >
                        {sub.keteranganKehadiran}
                      </span>
                    </div>

                    {/* 7. Pelapor */}
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100 mt-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase w-20 shrink-0">Pelapor:</span>
                      <span className="text-xs font-semibold text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                        {sub.submittedBy || username || "Admin Kelas"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Full Width Table: Hasil Input Kehadiran Guru (Data Input Kelas) */}
      <div className="lg:col-span-3 mt-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6" id="student-full-history-table">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-blue-600" /> Hasil Input Kehadiran Guru (Data Input Kelas)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Tabel hasil input kehadiran guru sesuai urutan: Hari / Tanggal | Kelas | Nama Guru | Mata Pelajaran | Jam | Kehadiran | Pelapor
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-blue-50 text-blue-700 font-bold px-2.5 py-1 rounded-lg border border-blue-100">
              Total: {mySubmissions.length} Laporan
            </span>
            <button
              type="button"
              onClick={fetchMySubmissions}
              className="text-xs bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold px-3 py-1 rounded-lg transition-all cursor-pointer"
            >
              Refresh Table
            </button>
          </div>
        </div>

        {mySubmissions.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-8 text-center text-slate-500 text-xs">
            Belum ada data input kelas terdaftar untuk kelas Anda hari ini. Gunakan form di atas untuk menginput kehadiran guru.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/90 text-slate-700 font-extrabold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3.5 text-center w-12">No</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Hari / Tanggal</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Kelas</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Nama Guru</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Mata Pelajaran</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Jam</th>
                  <th className="py-3 px-3.5 text-center whitespace-nowrap">Kehadiran</th>
                  <th className="py-3 px-3.5 whitespace-nowrap">Pelapor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {mySubmissions.map((sub, idx) => (
                  <tr key={sub.id || idx} className="hover:bg-blue-50/30 transition-colors">
                    <td className="py-3 px-3.5 text-center font-bold text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-3.5 font-semibold text-slate-800 whitespace-nowrap">
                      {sub.hari}, {sub.tanggal}
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <span className="font-extrabold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md text-xs border border-blue-100">
                        {sub.kelas || selectedKelas}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 font-bold text-slate-800 whitespace-nowrap">
                      {sub.namaGuru}
                    </td>
                    <td className="py-3 px-3.5 font-medium text-slate-700 whitespace-nowrap">
                      {sub.mataPelajaran}
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <span className="font-mono text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        Jam {sub.jamKe}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-center whitespace-nowrap">
                      <span
                        className={`text-[10px] font-extrabold px-3 py-1 rounded-full ${
                          sub.keteranganKehadiran === "HADIR"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : sub.keteranganKehadiran === "IZIN"
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : sub.keteranganKehadiran === "SAKIT"
                            ? "bg-sky-100 text-sky-800 border border-sky-200"
                            : "bg-rose-100 text-rose-800 border border-rose-200"
                        }`}
                      >
                        {sub.keteranganKehadiran}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap font-semibold text-slate-600">
                      {sub.submittedBy || username || "Admin Kelas"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
