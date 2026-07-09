/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from "react";
import { ScheduleData, TeacherLeaveSubmission } from "../types";
import { FirebaseService } from "../firebase";
import { Calendar, User, BookOpen, Clock, FileText, CheckCircle2, AlertCircle, HelpCircle } from "lucide-react";

interface TeacherLeaveFormProps {
  scheduleData: ScheduleData;
}

const HARI_LIST = ["Senin", "Selasa", "Rabu", "Kamis", "Jum'at", "Sabtu", "Minggu"];

export default function TeacherLeaveForm({ scheduleData }: TeacherLeaveFormProps) {
  const [hari, setHari] = useState("Senin");
  const [tanggal, setTanggal] = useState("");
  const [selectedGuru, setSelectedGuru] = useState("");
  const [selectedMapel, setSelectedMapel] = useState("");
  const [selectedJams, setSelectedJams] = useState<string[]>([]);
  const [keterangan, setKeterangan] = useState<"IZIN" | "SAKIT">("IZIN");
  const [keteranganIzin, setKeteranganIzin] = useState("");

  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recentLeaves, setRecentLeaves] = useState<TeacherLeaveSubmission[]>([]);

  useEffect(() => {
    const today = new Date();
    setTanggal(today.toISOString().split("T")[0]);

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

    if (scheduleData.namaGuruList && scheduleData.namaGuruList.length > 0) {
      setSelectedGuru(scheduleData.namaGuruList[0]);
    }
    if (scheduleData.mataPelajaranList && scheduleData.mataPelajaranList.length > 0) {
      setSelectedMapel(scheduleData.mataPelajaranList[0]);
    }
    if (scheduleData.jamKeList && scheduleData.jamKeList.length > 0) {
      setSelectedJams([scheduleData.jamKeList[0]]);
    }

    fetchRecentLeaves();
  }, [scheduleData]);

  const fetchRecentLeaves = async () => {
    try {
      const data = await FirebaseService.getSubmissionsIzin();
      // Sort newest first, take top 5
      data.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
      setRecentLeaves(data.slice(0, 5));
    } catch (e) {
      console.error("Gagal memuat daftar izin terbaru:", e);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!selectedGuru || !selectedMapel || !keteranganIzin.trim()) {
      setMessage({ type: "error", text: "Silakan isi semua data, termasuk keterangan alasan tidak hadir." });
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
      await FirebaseService.addSubmissionIzin({
        hari,
        tanggal,
        namaGuru: selectedGuru,
        mataPelajaran: selectedMapel,
        jamKe: jamKeString,
        keteranganKehadiran: keterangan,
        keteranganIzinGuru: keteranganIzin
      });

      setMessage({
        type: "success",
        text: `Berhasil mengirimkan permohonan izin untuk: ${selectedGuru}`
      });
      setKeteranganIzin("");
      fetchRecentLeaves();
    } catch (err: any) {
      console.error("Leave submission error:", err);
      setMessage({ type: "error", text: err.message || "Gagal mengirimkan permohonan izin." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8" id="teacher-view-container">
      {/* Form Card */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-md p-6 md:p-8" id="teacher-form-card">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-5 mb-6">
          <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">DATA INPUT IZIN GURU</h1>
            <p className="text-xs text-slate-500">Formulir bagi Bapak/Ibu Guru yang berhalangan hadir untuk memberikan laporan izin/sakit</p>
          </div>
        </div>

        {message && (
          <div
            id="teacher-form-message"
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

        <form onSubmit={handleSubmit} className="space-y-6" id="teacher-input-form">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Hari */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> Hari Izin
              </label>
              <select
                id="teacher-hari"
                value={hari}
                onChange={(e) => setHari(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
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
                id="teacher-tanggal"
                required
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Nama Guru */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-slate-400" /> Nama Bapak/Ibu Guru
              </label>
              <select
                id="teacher-guru"
                value={selectedGuru}
                onChange={(e) => setSelectedGuru(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
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
                id="teacher-mapel"
                value={selectedMapel}
                onChange={(e) => setSelectedMapel(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
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
              <div className="grid grid-cols-4 gap-1.5" id="teacher-jam-checkbox-group">
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
                          ? "bg-amber-600 border-amber-600 text-white shadow-sm"
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
                <FileText className="w-3.5 h-3.5 text-slate-400" /> Keterangan Ketidakhadiran
              </label>
              <div className="flex gap-4">
                <label className="flex-1 flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-all">
                  <input
                    type="radio"
                    name="izin_type"
                    id="radio-izin"
                    value="IZIN"
                    checked={keterangan === "IZIN"}
                    onChange={() => setKeterangan("IZIN")}
                    className="w-4 h-4 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-sm font-semibold text-slate-700">IZIN (Ada Keperluan)</span>
                </label>
                <label className="flex-1 flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-all">
                  <input
                    type="radio"
                    name="izin_type"
                    id="radio-sakit"
                    value="SAKIT"
                    checked={keterangan === "SAKIT"}
                    onChange={() => setKeterangan("SAKIT")}
                    className="w-4 h-4 text-sky-600 focus:ring-sky-500"
                  />
                  <span className="text-sm font-semibold text-slate-700">SAKIT (Tidak Sehat)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Keterangan Izin Guru */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600 flex items-center gap-2">
              <HelpCircle className="w-3.5 h-3.5 text-slate-400" /> Keterangan Alasan Izin Guru
            </label>
            <textarea
              id="teacher-izin-desc"
              required
              rows={3}
              placeholder="Berikan alasan ketidakhadiran secara singkat dan jelas (misal: Menghadiri rapat koordinasi MGMP, Sakit demam berobat ke puskesmas, dll)"
              value={keteranganIzin}
              onChange={(e) => setKeteranganIzin(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-sm placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-none"
            />
          </div>

          <button
            type="submit"
            id="btn-submit-teacher"
            disabled={isSubmitting}
            className="w-full bg-amber-600 hover:bg-amber-700 active:scale-[0.99] text-white py-3 px-6 rounded-xl font-bold text-sm shadow-lg shadow-amber-500/15 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {isSubmitting ? "Mengirim Laporan..." : "Kirim Pengajuan Izin Guru"}
          </button>
        </form>
      </div>

      {/* Info Panel */}
      <div className="bg-slate-50 rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between" id="teacher-info-card">
        <div>
          <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-slate-500" /> Pengajuan Izin Terbaru
          </h3>

          {recentLeaves.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-xl p-8 text-center text-slate-400 text-xs">
              Belum ada permohonan izin terdaftar dalam sistem hari ini.
            </div>
          ) : (
            <div className="space-y-3" id="teacher-recent-leaves-list">
              {recentLeaves.map((sub) => (
                <div
                  key={sub.id}
                  className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-1 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      Jam Ke-{sub.jamKe}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        sub.keteranganKehadiran === "IZIN"
                          ? "bg-amber-50 text-amber-700 border border-amber-100"
                          : "bg-sky-50 text-sky-700 border border-sky-100"
                      }`}
                    >
                      {sub.keteranganKehadiran}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-700">{sub.namaGuru}</h4>
                  <p className="text-[11px] text-slate-600 line-clamp-2">Reason: "{sub.keteranganIzinGuru}"</p>
                  <p className="text-[9px] text-slate-400 text-right pt-1">
                    {sub.hari}, {sub.tanggal}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 p-4 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-800 space-y-1">
          <div className="font-bold">Perhatian:</div>
          <div>Data izin guru akan divalidasi langsung oleh Admin BK & Tata Tertib guna penyesuaian agenda belajar-mengajar di kelas.</div>
        </div>
      </div>
    </div>
  );
}
