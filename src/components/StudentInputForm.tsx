/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from "react";
import { ScheduleData, StudentSubmission } from "../types";
import { FirebaseService } from "../firebase";
import { ClipboardList, Calendar, User, BookOpen, Clock, FileCheck, CheckCircle2, AlertCircle } from "lucide-react";

interface StudentInputFormProps {
  scheduleData: ScheduleData;
  username: string;
}

const HARI_LIST = ["Senin", "Selasa", "Rabu", "Kamis", "Jum'at", "Sabtu", "Minggu"];

export default function StudentInputForm({ scheduleData, username }: StudentInputFormProps) {
  const [hari, setHari] = useState("Senin");
  const [tanggal, setTanggal] = useState("");
  const [selectedGuru, setSelectedGuru] = useState("");
  const [selectedMapel, setSelectedMapel] = useState("");
  const [selectedJams, setSelectedJams] = useState<string[]>([]);
  const [keterangan, setKeterangan] = useState<"HADIR" | "IZIN" | "SAKIT" | "TANPA KETERANGAN">("HADIR");

  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mySubmissions, setMySubmissions] = useState<StudentSubmission[]>([]);

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

    // Set first default values if lists exist
    if (scheduleData.namaGuruList && scheduleData.namaGuruList.length > 0) {
      setSelectedGuru(scheduleData.namaGuruList[0]);
    }
    if (scheduleData.mataPelajaranList && scheduleData.mataPelajaranList.length > 0) {
      setSelectedMapel(scheduleData.mataPelajaranList[0]);
    }
    if (scheduleData.jamKeList && scheduleData.jamKeList.length > 0) {
      setSelectedJams([scheduleData.jamKeList[0]]);
    }

    fetchMySubmissions();
  }, [scheduleData]);

  const fetchMySubmissions = async () => {
    try {
      const data = await FirebaseService.getSubmissionsKelas();
      // Filter submissions done by this class admin
      const filtered = data.filter(s => s.submittedBy === username);
      // Sort newest first
      filtered.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
      setMySubmissions(filtered);
    } catch (e) {
      console.error("Gagal memuat riwayat penginputan:", e);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!selectedGuru || !selectedMapel) {
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
        namaGuru: selectedGuru,
        mataPelajaran: selectedMapel,
        jamKe: jamKeString,
        keteranganKehadiran: keterangan,
        submittedBy: username
      });

      setMessage({
        type: "success",
        text: `Berhasil melaporkan kehadiran Guru: ${selectedGuru} [${keterangan}]`
      });
      fetchMySubmissions();
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
                {scheduleData.namaGuruList.map((g) => (
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
                {scheduleData.mataPelajaranList.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Jam Ke (Checkboxes) */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> Jam Ke- <span className="text-[10px] text-slate-400 font-normal">(Centang 1-4 jam)</span>
              </label>
              <div className="grid grid-cols-4 gap-1.5" id="student-jam-checkbox-group">
                {scheduleData.jamKeList.map((j) => {
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

      {/* History Log Panel */}
      <div className="bg-slate-50 rounded-2xl border border-slate-100 p-6 shadow-sm" id="student-history-card">
        <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-500" /> Riwayat Input Hari Ini
        </h3>

        {mySubmissions.length === 0 ? (
          <div className="bg-white border border-slate-100 rounded-xl p-8 text-center text-slate-400 text-xs">
            Belum ada laporan dari kelas Anda hari ini. Gunakan form di samping untuk mulai menginput.
          </div>
        ) : (
          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1" id="student-history-list">
            {mySubmissions.map((sub) => (
              <div
                key={sub.id}
                className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-2 relative hover:shadow-md transition-all duration-200"
              >
                <div className="flex justify-between items-start gap-2">
                  <span className="text-[10px] font-semibold font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                    Jam Ke-{sub.jamKe}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      sub.keteranganKehadiran === "HADIR"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                        : sub.keteranganKehadiran === "IZIN"
                        ? "bg-amber-50 text-amber-700 border border-amber-100"
                        : sub.keteranganKehadiran === "SAKIT"
                        ? "bg-sky-50 text-sky-700 border border-sky-100"
                        : "bg-rose-50 text-rose-700 border border-rose-100"
                    }`}
                  >
                    {sub.keteranganKehadiran}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-700 line-clamp-1">{sub.namaGuru}</h4>
                <p className="text-[11px] text-slate-500 line-clamp-1">{sub.mataPelajaran}</p>
                <div className="text-[9px] text-slate-400 border-t border-slate-50 pt-1.5 flex justify-between">
                  <span>{sub.hari}, {sub.tanggal}</span>
                  <span>{new Date(sub.submittedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
