/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { StudentSubmission, TeacherLeaveSubmission, AdminRole, ScheduleData } from "../types";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import {
  FileSpreadsheet, Filter, Search, RotateCw, Trash2, Calendar, FileText, CheckCircle,
  AlertTriangle, UserX, Printer, Download, MessageSquarePlus, RefreshCw, Layers, BellRing, Phone,
  Edit, Check, X
} from "lucide-react";

interface AdminDashboardProps {
  role: AdminRole;
  scheduleData: ScheduleData;
  onLogout: () => void;
}

export default function AdminDashboard({ role, scheduleData, onLogout }: AdminDashboardProps) {
  const [submissionsKelas, setSubmissionsKelas] = useState<StudentSubmission[]>([]);
  const [submissionsIzin, setSubmissionsIzin] = useState<TeacherLeaveSubmission[]>([]);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterHari, setFilterHari] = useState("SEMUA");
  const [filterTanggal, setFilterTanggal] = useState("");
  const [activeTab, setActiveTab] = useState<"KELAS" | "IZIN" | "SYNC">("KELAS");

  // Google Apps Script state
  const [appsScriptUrl, setAppsScriptUrl] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Sync state
  const [lastSync, setLastSync] = useState(scheduleData.classAdmins ? "Tersinkronisasi" : "Belum");
  const [isSyncing, setIsSyncing] = useState(false);

  // BK / Tatib Custom interactions
  const [bkRecommendations, setBkRecommendations] = useState<Record<string, string>>({});
  const [recInputs, setRecInputs] = useState<Record<string, string>>({});
  const [tatibFlags, setTatibFlags] = useState<Record<string, boolean>>({});

  // Editing states
  const [editingKelasId, setEditingKelasId] = useState<string | null>(null);
  const [editingIzinId, setEditingIzinId] = useState<string | null>(null);
  
  const [editNamaGuru, setEditNamaGuru] = useState("");
  const [editMataPelajaran, setEditMataPelajaran] = useState("");
  const [editJamKe, setEditJamKe] = useState("");
  const [editKeteranganKehadiran, setEditKeteranganKehadiran] = useState("");
  const [editKeteranganIzinGuru, setEditKeteranganIzinGuru] = useState("");
  const [editHari, setEditHari] = useState("");
  const [editTanggal, setEditTanggal] = useState("");

  const startEditKelas = (item: StudentSubmission) => {
    setEditingKelasId(item.id);
    setEditNamaGuru(item.namaGuru);
    setEditMataPelajaran(item.mataPelajaran);
    setEditJamKe(item.jamKe);
    setEditKeteranganKehadiran(item.keteranganKehadiran);
    setEditHari(item.hari || "");
    setEditTanggal(item.tanggal || "");
  };

  const cancelEditKelas = () => {
    setEditingKelasId(null);
  };

  const handleSaveKelas = async (id: string) => {
    try {
      const res = await fetch(`/api/submissions/kelas/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          namaGuru: editNamaGuru,
          mataPelajaran: editMataPelajaran,
          jamKe: editJamKe,
          keteranganKehadiran: editKeteranganKehadiran,
          hari: editHari,
          tanggal: editTanggal
        })
      });
      if (res.ok) {
        const result = await res.json();
        setSubmissionsKelas(prev => prev.map(item => item.id === id ? { ...item, ...result.data } : item));
        setEditingKelasId(null);
      } else {
        alert("Gagal menyimpan perubahan.");
      }
    } catch (e) {
      alert("Terjadi kesalahan jaringan.");
    }
  };

  const startEditIzin = (item: TeacherLeaveSubmission) => {
    setEditingIzinId(item.id);
    setEditNamaGuru(item.namaGuru);
    setEditMataPelajaran(item.mataPelajaran);
    setEditJamKe(item.jamKe);
    setEditKeteranganKehadiran(item.keteranganKehadiran);
    setEditKeteranganIzinGuru(item.keteranganIzinGuru);
    setEditHari(item.hari || "");
    setEditTanggal(item.tanggal || "");
  };

  const cancelEditIzin = () => {
    setEditingIzinId(null);
  };

  const handleSaveIzin = async (id: string) => {
    try {
      const res = await fetch(`/api/submissions/izin/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          namaGuru: editNamaGuru,
          mataPelajaran: editMataPelajaran,
          jamKe: editJamKe,
          keteranganKehadiran: editKeteranganKehadiran,
          keteranganIzinGuru: editKeteranganIzinGuru,
          hari: editHari,
          tanggal: editTanggal
        })
      });
      if (res.ok) {
        const result = await res.json();
        setSubmissionsIzin(prev => prev.map(item => item.id === id ? { ...item, ...result.data } : item));
        setEditingIzinId(null);
      } else {
        alert("Gagal menyimpan perubahan.");
      }
    } catch (e) {
      alert("Terjadi kesalahan jaringan.");
    }
  };

  useEffect(() => {
    fetchData();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setAppsScriptUrl(data.appsScriptUrl || "");
      }
    } catch (e) {
      console.error("Gagal memuat konfigurasi Google Apps Script:", e);
    }
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appsScriptUrl })
      });
      if (res.ok) {
        alert("URL Google Apps Script berhasil disimpan!");
      } else {
        alert("Gagal menyimpan URL.");
      }
    } catch (e) {
      alert("Terjadi kesalahan koneksi.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSyncAllToSheets = async () => {
    setIsSyncingAll(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/sync/sheets", {
        method: "POST"
      });
      const result = await res.json();
      if (res.ok && result.success) {
        setSyncMessage({ type: "success", text: result.message });
        alert("Sukses! Semua data input kelas dan guru berhasil disinkronisasikan ke Google Sheet.");
      } else {
        setSyncMessage({ type: "error", text: result.error || "Gagal melakukan sinkronisasi massal." });
      }
    } catch (e: any) {
      setSyncMessage({ type: "error", text: "Gagal terhubung ke server: " + e.message });
    } finally {
      setIsSyncingAll(false);
    }
  };

  const fetchData = async () => {
    try {
      const [resKelas, resIzin] = await Promise.all([
        fetch("/api/submissions/kelas"),
        fetch("/api/submissions/izin")
      ]);

      if (resKelas.ok) {
        const data = await resKelas.json();
        // Sort newest first
        data.sort((a: any, b: any) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
        setSubmissionsKelas(data);
      }
      if (resIzin.ok) {
        const data = await resIzin.json();
        data.sort((a: any, b: any) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
        setSubmissionsIzin(data);
      }
    } catch (e) {
      console.error("Gagal memuat data dashboard:", e);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      if (res.ok) {
        const result = await res.json();
        setLastSync(new Date(result.lastSync).toLocaleTimeString("id-ID") + " " + new Date(result.lastSync).toLocaleDateString("id-ID"));
        alert("Berhasil menyinkronkan data guru dan admin kelas dengan Google Sheet!");
        window.location.reload();
      }
    } catch (e) {
      alert("Gagal menyinkronkan data.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteKelas = async (id: string, name: string) => {
    if (!window.confirm(`Hapus laporan kehadiran guru ${name}? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      const res = await fetch(`/api/submissions/kelas/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSubmissionsKelas(prev => prev.filter(item => item.id !== id));
      } else {
        alert("Gagal menghapus.");
      }
    } catch (e) {
      alert("Terjadi kesalahan.");
    }
  };

  const handleDeleteIzin = async (id: string, name: string) => {
    if (!window.confirm(`Hapus laporan izin guru ${name}? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      const res = await fetch(`/api/submissions/izin/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSubmissionsIzin(prev => prev.filter(item => item.id !== id));
      } else {
        alert("Gagal menghapus.");
      }
    } catch (e) {
      alert("Terjadi kesalahan.");
    }
  };

  const handleDownloadCSV = () => {
    const dataToExport = activeTab === "KELAS" ? submissionsKelas : submissionsIzin;
    if (dataToExport.length === 0) {
      alert("Tidak ada data untuk diunduh.");
      return;
    }

    let headers = [];
    let rows = [];

    if (activeTab === "KELAS") {
      headers = ["Hari", "Tanggal", "Nama Guru", "Mata Pelajaran", "Jam Ke", "Keterangan Kehadiran", "Dilaporkan Oleh", "Waktu Input"];
      rows = (dataToExport as StudentSubmission[]).map(s => [
        s.hari, s.tanggal, s.namaGuru, s.mataPelajaran, s.jamKe, s.keteranganKehadiran, s.submittedBy, s.submittedAt
      ]);
    } else {
      headers = ["Hari", "Tanggal", "Nama Guru", "Mata Pelajaran", "Jam Ke", "Keterangan Kehadiran", "Keterangan Izin Guru", "Waktu Input"];
      rows = (dataToExport as TeacherLeaveSubmission[]).map(s => [
        s.hari, s.tanggal, s.namaGuru, s.mataPelajaran, s.jamKe, s.keteranganKehadiran, s.keteranganIzinGuru, s.submittedAt
      ]);
    }

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Laporan_${activeTab}_Kehadiran_Guru_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // BK Recommendation submission
  const saveBKRecommendation = (id: string) => {
    const text = recInputs[id]?.trim();
    if (!text) return;
    setBkRecommendations(prev => ({ ...prev, [id]: text }));
    setRecInputs(prev => ({ ...prev, [id]: "" }));
    alert("Rekomendasi tindak lanjut BK berhasil disimpan!");
  };

  // Tatib flagging
  const toggleTatibFlag = (id: string) => {
    setTatibFlags(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Filter application
  const filteredKelas = submissionsKelas.filter(item => {
    const matchesSearch = item.namaGuru.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.mataPelajaran.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesHari = filterHari === "SEMUA" || item.hari === filterHari;
    const matchesTanggal = !filterTanggal || item.tanggal === filterTanggal;
    return matchesSearch && matchesHari && matchesTanggal;
  });

  const filteredIzin = submissionsIzin.filter(item => {
    const matchesSearch = item.namaGuru.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.mataPelajaran.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesHari = filterHari === "SEMUA" || item.hari === filterHari;
    const matchesTanggal = !filterTanggal || item.tanggal === filterTanggal;
    return matchesSearch && matchesHari && matchesTanggal;
  });

  // Calculate Statistics
  const totalReportedKelas = submissionsKelas.length;
  const countHadir = submissionsKelas.filter(s => s.keteranganKehadiran === "HADIR").length;
  const countIzin = submissionsKelas.filter(s => s.keteranganKehadiran === "IZIN").length;
  const countSakit = submissionsKelas.filter(s => s.keteranganKehadiran === "SAKIT").length;
  const countAlpa = submissionsKelas.filter(s => s.keteranganKehadiran === "TANPA KETERANGAN").length;

  // Recharts Data
  const pieData = [
    { name: "Hadir", value: countHadir, color: "#10b981" },
    { name: "Izin", value: countIzin + submissionsIzin.filter(s => s.keteranganKehadiran === "IZIN").length, color: "#f59e0b" },
    { name: "Sakit", value: countSakit + submissionsIzin.filter(s => s.keteranganKehadiran === "SAKIT").length, color: "#06b6d4" },
    { name: "Alpa", value: countAlpa, color: "#ef4444" }
  ].filter(item => item.value > 0);

  const barData = [
    { name: "Senin", Hadir: submissionsKelas.filter(s => s.hari === "Senin" && s.keteranganKehadiran === "HADIR").length, Alpa: submissionsKelas.filter(s => s.hari === "Senin" && s.keteranganKehadiran === "TANPA KETERANGAN").length },
    { name: "Selasa", Hadir: submissionsKelas.filter(s => s.hari === "Selasa" && s.keteranganKehadiran === "HADIR").length, Alpa: submissionsKelas.filter(s => s.hari === "Selasa" && s.keteranganKehadiran === "TANPA KETERANGAN").length },
    { name: "Rabu", Hadir: submissionsKelas.filter(s => s.hari === "Rabu" && s.keteranganKehadiran === "HADIR").length, Alpa: submissionsKelas.filter(s => s.hari === "Rabu" && s.keteranganKehadiran === "TANPA KETERANGAN").length },
    { name: "Kamis", Hadir: submissionsKelas.filter(s => s.hari === "Kamis" && s.keteranganKehadiran === "HADIR").length, Alpa: submissionsKelas.filter(s => s.hari === "Kamis" && s.keteranganKehadiran === "TANPA KETERANGAN").length },
    { name: "Jum'at", Hadir: submissionsKelas.filter(s => s.hari === "Jum'at" && s.keteranganKehadiran === "HADIR").length, Alpa: submissionsKelas.filter(s => s.hari === "Jum'at" && s.keteranganKehadiran === "TANPA KETERANGAN").length }
  ];

  return (
    <div className="space-y-8" id="admin-dashboard-container">
      {/* Header Panel */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full ${
              role === "UTAMA"
                ? "bg-purple-100 text-purple-700"
                : role === "TU"
                ? "bg-blue-100 text-blue-700"
                : role === "BK"
                ? "bg-amber-100 text-amber-700"
                : "bg-rose-100 text-rose-700"
            }`}>
              ADMIN {role}
            </span>
            <span className="text-slate-400 text-xs">• Sesi Aktif</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mt-1">Dashboard Pemantauan Kehadiran Guru</h1>
          <p className="text-xs text-slate-500 mt-1">
            Hak Akses: <strong className="text-slate-700">Admin {role === "UTAMA" ? "Utama (Semua Hak)" : role === "TU" ? "Tata Usaha (Laporan)" : role === "BK" ? "Bimbingan Konseling (Tindak Lanjut)" : "Tata Tertib (Disiplin)"}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {role === "UTAMA" && (
            <button
              onClick={handleSync}
              disabled={isSyncing}
              id="btn-sync-sheets"
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              Sync GSheet
            </button>
          )}
          <button
            onClick={onLogout}
            id="btn-logout"
            className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all"
          >
            Keluar Sesi
          </button>
        </div>
      </div>

      {/* Statistics Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Total Kelas Terlapor */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Laporan Kelas</div>
            <div className="text-2xl font-black text-slate-800" id="stat-total-laporan">{totalReportedKelas}</div>
            <div className="text-[10px] text-slate-400">Total jam pelajaran terlapor</div>
          </div>
        </div>

        {/* Card 2: Tingkat Kehadiran Guru */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Hadir (Persentase)</div>
            <div className="text-2xl font-black text-slate-800" id="stat-kehadiran-persen">
              {totalReportedKelas > 0 ? Math.round((countHadir / totalReportedKelas) * 100) : 0}%
            </div>
            <div className="text-[10px] text-slate-400">{countHadir} dari {totalReportedKelas} jam terlapor</div>
          </div>
        </div>

        {/* Card 3: Total Guru Izin & Sakit */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Izin & Sakit</div>
            <div className="text-2xl font-black text-slate-800" id="stat-total-izin">
              {countIzin + countSakit}
            </div>
            <div className="text-[10px] text-slate-400">Total guru berhalangan hari ini</div>
          </div>
        </div>

        {/* Card 4: Tanpa Keterangan / Alpa */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <UserX className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tanpa Keterangan</div>
            <div className="text-2xl font-black text-slate-800 text-rose-600" id="stat-total-alpa">{countAlpa}</div>
            <div className="text-[10px] text-slate-400">Memerlukan konfirmasi segera</div>
          </div>
        </div>
      </div>

      {/* Visual Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Bar Chart of Daily Attendance */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">Distribusi Kehadiran Mingguan (Jam Pelajaran)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={11} stroke="#64748b" />
                <YAxis fontSize={11} stroke="#64748b" />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Hadir" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Alpa" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Pie Chart of Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Persentase Keterangan Kehadiran</h3>
            <p className="text-[11px] text-slate-400 mb-4">Grafik proporsi status guru yang dilaporkan</p>
          </div>
          {pieData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-xs h-40">
              Belum ada data visualisasi yang dapat ditampilkan.
            </div>
          ) : (
            <div className="h-44 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} Jam`, "Jumlah"]} />
                </PieChart>
              </ResponsiveContainer>
              {/* Custom Legend inside the card */}
              <div className="absolute flex flex-col items-center justify-center pointer-events-none">
                <span className="text-lg font-black text-slate-700">{totalReportedKelas}</span>
                <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Total</span>
              </div>
            </div>
          )}
          <div className="grid grid-cols-4 gap-2 pt-4 border-t border-slate-50 text-[10px] text-center font-bold text-slate-600">
            <div className="flex flex-col items-center"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mb-1"></span>Hadir ({countHadir})</div>
            <div className="flex flex-col items-center"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 mb-1"></span>Izin ({countIzin})</div>
            <div className="flex flex-col items-center"><span className="w-2.5 h-2.5 rounded-full bg-cyan-500 mb-1"></span>Sakit ({countSakit})</div>
            <div className="flex flex-col items-center"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 mb-1"></span>Alpa ({countAlpa})</div>
          </div>
        </div>
      </div>

      {/* Main Filter Panel */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6" id="filter-panel">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Filter className="w-3.5 h-3.5" /> Filter Pemantauan Data Kehadiran
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              id="filter-search"
              placeholder="Cari guru atau mata pelajaran..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Hari */}
          <select
            id="filter-hari-select"
            value={filterHari}
            onChange={(e) => setFilterHari(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
          >
            <option value="SEMUA">Semua Hari</option>
            <option value="Senin">Senin</option>
            <option value="Selasa">Selasa</option>
            <option value="Rabu">Rabu</option>
            <option value="Kamis">Kamis</option>
            <option value="Jum'at">Jum'at</option>
          </select>

          {/* Tanggal */}
          <input
            type="date"
            id="filter-tanggal-input"
            value={filterTanggal}
            onChange={(e) => setFilterTanggal(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
          />
        </div>
      </div>

      {/* Tab Data Table Submissions */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" id="admin-table-panel">
        <div className="flex border-b border-slate-100 bg-slate-50/50 justify-between items-center px-6 py-2">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab("KELAS")}
              id="tab-btn-kelas"
              className={`py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                activeTab === "KELAS"
                  ? "text-blue-600 border-blue-600"
                  : "text-slate-400 border-transparent hover:text-slate-700"
              }`}
            >
              DATA INPUT KELAS (Siswa)
            </button>
            <button
              onClick={() => setActiveTab("IZIN")}
              id="tab-btn-izin"
              className={`py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                activeTab === "IZIN"
                  ? "text-amber-600 border-amber-600"
                  : "text-slate-400 border-transparent hover:text-slate-700"
              }`}
            >
              DATA INPUT IZIN (Guru)
            </button>
            {(role === "UTAMA" || role === "TU") && (
              <button
                onClick={() => setActiveTab("SYNC")}
                id="tab-btn-sync"
                className={`py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                  activeTab === "SYNC"
                    ? "text-indigo-600 border-indigo-600"
                    : "text-slate-400 border-transparent hover:text-slate-700"
                }`}
              >
                SINKRONISASI GSHEET (Otomatis)
              </button>
            )}
          </div>

          <div className="flex gap-2">
            {role === "TU" && (
              <button
                onClick={() => window.print()}
                id="btn-print"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-all"
              >
                <Printer className="w-3.5 h-3.5" /> Cetak Rekap
              </button>
            )}
            <button
              onClick={handleDownloadCSV}
              id="btn-download-csv"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-all"
            >
              <Download className="w-3.5 h-3.5" /> Ekspor CSV
            </button>
          </div>
        </div>

        {/* DATA TABLE */}
        <div className="overflow-x-auto">
          {activeTab === "SYNC" ? (
            <div className="p-6 max-w-4xl mx-auto space-y-6" id="panel-sync-apps-script">
              {/* Alert status */}
              <div className="p-5 rounded-xl border bg-indigo-50/50 border-indigo-100 flex items-start gap-4">
                <FileSpreadsheet className="w-6 h-6 text-indigo-600 mt-1 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Sinkronisasi Otomatis Google Sheets via Google Apps Script</h4>
                  <p className="text-xs text-slate-500 leading-relaxed mt-1">
                    Fitur ini memungkinkan data absensi kelas (oleh siswa) dan laporan izin (oleh guru) otomatis terkirim dan tercatat langsung pada sheet <strong>DATA_INPUT_KELAS</strong> dan <strong>DATA_INPUT_IZIN_GURU</strong> di Google Spreadsheet Anda secara real-time saat disubmit, diedit, atau dihapus!
                  </p>
                </div>
              </div>

              {/* URL Configuration Card */}
              <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-5 md:p-6 space-y-4">
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Konfigurasi URL Google Apps Script</h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Masukkan URL Aplikasi Web Google Apps Script yang didapatkan setelah melakukan deploy script di bawah.
                  </p>
                </div>
                <div className="flex flex-col md:flex-row gap-3">
                  <input
                    type="url"
                    placeholder="https://script.google.com/macros/s/.../exec"
                    value={appsScriptUrl}
                    onChange={(e) => setAppsScriptUrl(e.target.value)}
                    className="flex-1 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 font-mono"
                  />
                  <button
                    onClick={handleSaveSettings}
                    disabled={isSavingSettings}
                    className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 rounded-lg shadow-sm transition-all shrink-0 cursor-pointer"
                  >
                    {isSavingSettings ? "Menyimpan..." : "Simpan URL"}
                  </button>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${appsScriptUrl ? 'bg-emerald-500' : 'bg-amber-400'}`}></span>
                  <span className="text-slate-600 font-medium">
                    Status: {appsScriptUrl ? (
                      <span className="text-emerald-700 font-bold">Terhubung & Siap Sinkronisasi</span>
                    ) : (
                      <span className="text-amber-600 font-bold">Belum Terkonfigurasi (Gunakan fallback penyimpanan lokal)</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Sync Action Card */}
              <div className="bg-white border border-slate-150 rounded-xl p-5 md:p-6 space-y-4 shadow-sm">
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Sinkronisasi Massal Semua Data</h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Jika Anda baru saja mengkonfigurasi Apps Script, atau ingin menyalin semua data lokal yang sudah terlanjur diinput sebelumnya ke Google Sheets, Anda dapat menekan tombol sinkronisasi massal di bawah ini.
                  </p>
                </div>

                {syncMessage && (
                  <div className={`p-3.5 rounded-lg text-xs font-medium border ${
                    syncMessage.type === "success" 
                      ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                      : "bg-red-50 border-red-100 text-red-800"
                  }`}>
                    {syncMessage.text}
                  </div>
                )}

                <button
                  onClick={handleSyncAllToSheets}
                  disabled={isSyncingAll || !appsScriptUrl}
                  className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:bg-slate-100 disabled:text-slate-400 rounded-lg border border-indigo-100/60 transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAll ? 'animate-spin' : ''}`} />
                  {isSyncingAll ? "Sedang Menyinkronkan..." : "Sinkronisasikan Semua Data Ke GSheet Sekarang"}
                </button>
              </div>

              {/* Instructions and Code Card */}
              <div className="bg-slate-900 text-slate-300 rounded-xl p-5 md:p-6 space-y-5 shadow-md">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-400" /> Panduan & Kode Google Apps Script
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Ikuti langkah-langkah di bawah untuk menempelkan kode ini ke editor Apps Script Google Sheet Anda.
                  </p>
                </div>

                <div className="space-y-2 text-xs leading-relaxed text-slate-300 bg-slate-800/50 p-4 rounded-lg border border-slate-800">
                  <ol className="list-decimal pl-5 space-y-1.5">
                    <li>Buka file <strong>Google Sheet</strong> pemantauan Anda.</li>
                    <li>Pada menu bagian atas, klik <strong>Ekstensi (Extensions)</strong> &gt; <strong>Apps Script</strong>.</li>
                    <li>Hapus seluruh kode default yang ada di dalam editor.</li>
                    <li>Salin seluruh kode di bawah ini, lalu tempelkan (Paste) ke dalam editor Apps Script.</li>
                    <li>Klik ikon <strong>Simpan (ikon disket)</strong>.</li>
                    <li><strong>SANGAT PENTING (Otorisasi)</strong>: Di bagian atas editor, pilih fungsi <code>doGet</code> atau <code>doPost</code> di sebelah tombol "Jalankan", lalu klik tombol <strong>Jalankan (Run)</strong> sekali. Google akan meminta izin akses (Tinjau Izin / Review Permissions). Pilih akun Google Anda, klik <strong>Advanced (Lanjutan)</strong> di kiri bawah, lalu klik <strong>Go to ... (unsafe)</strong>, dan klik <strong>Allow (Izinkan)</strong>. Langkah ini wajib agar Google Sheets mengizinkan script membaca/menulis data.</li>
                    <li>Klik tombol biru <strong>Terapkan (Deploy)</strong> di kanan atas &gt; pilih <strong>Penerapan baru (New deployment)</strong>.</li>
                    <li>Klik ikon gerigi di sebelah "Pilih tipe" &gt; pilih <strong>Aplikasi web (Web app)</strong>.</li>
                    <li>Ubah kolom <strong>Menejalankan sebagai (Execute as)</strong> menjadi <strong>Saya (Me)</strong>.</li>
                    <li>Ubah kolom <strong>Siapa yang memiliki akses (Who has access)</strong> menjadi <strong>Siapa saja (Anyone)</strong>. <span className="text-amber-400 font-bold">(Sangat Penting agar server dapat mengirimkan data secara anonim/bebas hambatan!)</span></li>
                    <li>Klik <strong>Terapkan (Deploy)</strong>.</li>
                    <li>Salin URL Aplikasi Web yang diberikan (berakhiran <code>/exec</code>), lalu tempelkan pada kolom konfigurasi di atas!</li>
                  </ol>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-indigo-300">Kode Apps Script:</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(APPS_SCRIPT_CODE);
                        alert("Kode Google Apps Script disalin ke clipboard!");
                      }}
                      className="text-[10px] bg-slate-800 hover:bg-slate-700 text-white font-bold py-1 px-2.5 rounded border border-slate-700 transition-all cursor-pointer"
                    >
                      Salin Kode
                    </button>
                  </div>
                  <pre className="p-4 rounded-lg bg-black text-[10px] font-mono text-emerald-400 overflow-x-auto max-h-80 border border-slate-800">
                    {APPS_SCRIPT_CODE}
                  </pre>
                </div>
              </div>
            </div>
          ) : activeTab === "KELAS" ? (
            <table className="w-full text-left border-collapse" id="table-submissions-kelas">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider bg-slate-50/20">
                  <th className="py-4 px-6">Hari / Tanggal</th>
                  <th className="py-4 px-6">Nama Guru</th>
                  <th className="py-4 px-6">Mata Pelajaran</th>
                  <th className="py-4 px-6">Jam</th>
                  <th className="py-4 px-6">Kehadiran</th>
                  <th className="py-4 px-6">Pelapor</th>
                  {role === "BK" && <th className="py-4 px-6">BK Tindak Lanjut</th>}
                  {role === "TATIB" && <th className="py-4 px-6">Status Disiplin</th>}
                  {(role === "UTAMA" || role === "TU") && <th className="py-4 px-6 text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredKelas.length === 0 ? (
                  <tr>
                    <td colSpan={role === "BK" || role === "TATIB" || role === "UTAMA" || role === "TU" ? 8 : 7} className="py-8 text-center text-xs text-slate-400">
                      Tidak ada laporan kehadiran kelas yang cocok dengan filter.
                    </td>
                  </tr>
                ) : (
                  filteredKelas.map((item) => (
                    <tr key={item.id} className={`${editingKelasId === item.id ? 'bg-indigo-50/40 hover:bg-indigo-50/40' : 'hover:bg-slate-50/50'} transition-all text-xs`}>
                      <td className="py-3 px-6 font-medium text-slate-500">
                        {editingKelasId === item.id ? (
                          <div className="space-y-1">
                            <input
                              type="text"
                              value={editHari}
                              onChange={(e) => setEditHari(e.target.value)}
                              className="px-2 py-1 rounded border border-slate-200 text-xs w-full bg-white text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              placeholder="Hari"
                            />
                            <input
                              type="date"
                              value={editTanggal}
                              onChange={(e) => setEditTanggal(e.target.value)}
                              className="px-2 py-1 rounded border border-slate-200 text-[10px] w-full bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                        ) : (
                          <>
                            <div>{item.hari}</div>
                            <div className="text-[10px] text-slate-400">{item.tanggal}</div>
                          </>
                        )}
                      </td>
                      <td className="py-3 px-6 font-bold text-slate-800">
                        {editingKelasId === item.id ? (
                          <select
                            value={editNamaGuru}
                            onChange={(e) => setEditNamaGuru(e.target.value)}
                            className="px-2 py-1.5 rounded border border-slate-200 text-xs w-full max-w-[200px] bg-white text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            {scheduleData.namaGuruList.map(g => (
                              <option key={g} value={g}>{g}</option>
                            ))}
                          </select>
                        ) : (
                          item.namaGuru
                        )}
                      </td>
                      <td className="py-3 px-6 text-slate-600">
                        {editingKelasId === item.id ? (
                          <select
                            value={editMataPelajaran}
                            onChange={(e) => setEditMataPelajaran(e.target.value)}
                            className="px-2 py-1.5 rounded border border-slate-200 text-xs w-full max-w-[150px] bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            {scheduleData.mataPelajaranList.map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        ) : (
                          item.mataPelajaran
                        )}
                      </td>
                      <td className="py-3 px-6">
                        {editingKelasId === item.id ? (
                          <input
                            type="text"
                            value={editJamKe}
                            onChange={(e) => setEditJamKe(e.target.value)}
                            className="px-2 py-1.5 rounded border border-slate-200 text-xs w-full bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            placeholder="Contoh: 1, 2"
                          />
                        ) : (
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-semibold">Jam Ke-{item.jamKe}</span>
                        )}
                      </td>
                      <td className="py-3 px-6">
                        {editingKelasId === item.id ? (
                          <select
                            value={editKeteranganKehadiran}
                            onChange={(e) => setEditKeteranganKehadiran(e.target.value)}
                            className="px-2 py-1.5 rounded border border-slate-200 text-xs w-full bg-white text-slate-800 font-black focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="HADIR">HADIR</option>
                            <option value="IZIN">IZIN</option>
                            <option value="SAKIT">SAKIT</option>
                            <option value="TANPA KETERANGAN">TANPA KETERANGAN</option>
                          </select>
                        ) : (
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                            item.keteranganKehadiran === "HADIR"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                              : item.keteranganKehadiran === "IZIN"
                              ? "bg-amber-50 text-amber-700 border border-amber-100"
                              : item.keteranganKehadiran === "SAKIT"
                              ? "bg-sky-50 text-sky-700 border border-sky-100"
                              : "bg-rose-50 text-rose-700 border border-rose-100"
                          }`}>
                            {item.keteranganKehadiran}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-6 font-mono text-slate-500 text-[10px]">{item.submittedBy}</td>

                      {/* BK Action Column */}
                      {role === "BK" && (
                        <td className="py-4 px-6">
                          {item.keteranganKehadiran === "SAKIT" || item.keteranganKehadiran === "IZIN" ? (
                            <div className="space-y-1">
                              {bkRecommendations[item.id] ? (
                                <div className="p-2 bg-slate-50 rounded text-[10px] text-slate-600 italic">
                                  "{bkRecommendations[item.id]}"
                                </div>
                              ) : (
                                <div className="flex gap-1.5">
                                  <input
                                    type="text"
                                    placeholder="Alasan / Solusi..."
                                    value={recInputs[item.id] || ""}
                                    onChange={(e) => setRecInputs(prev => ({ ...prev, [item.id]: e.target.value }))}
                                    className="px-2 py-1 rounded border text-[10px] bg-slate-50"
                                  />
                                  <button
                                    onClick={() => saveBKRecommendation(item.id)}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white p-1 rounded text-[10px]"
                                  >
                                    Simpan
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Tidak ada tindakan</span>
                          )}
                        </td>
                      )}

                      {/* Tata Tertib Column */}
                      {role === "TATIB" && (
                        <td className="py-4 px-6">
                          {item.keteranganKehadiran === "TANPA KETERANGAN" ? (
                            <button
                              onClick={() => toggleTatibFlag(item.id)}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-semibold border ${
                                tatibFlags[item.id]
                                  ? "bg-rose-50 border-rose-300 text-rose-600"
                                  : "bg-slate-50 border-slate-200 text-slate-500"
                              }`}
                            >
                              <BellRing className="w-3 h-3" />
                              {tatibFlags[item.id] ? "TERFLAG - Sanksi" : "Tandai Alpa"}
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Disiplin Baik</span>
                          )}
                        </td>
                      )}

                      {/* Main Admin / TU Action Column */}
                      {(role === "UTAMA" || role === "TU") && (
                        <td className="py-3 px-6 text-center">
                          {editingKelasId === item.id ? (
                            <div className="flex justify-center items-center gap-1.5">
                              <button
                                onClick={() => handleSaveKelas(item.id)}
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-all"
                                title="Simpan Perubahan"
                              >
                                <Check className="w-4 h-4 font-black" />
                              </button>
                              <button
                                onClick={cancelEditKelas}
                                className="p-1 text-slate-400 hover:bg-slate-100 rounded transition-all"
                                title="Batal"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-center items-center gap-1">
                              <button
                                onClick={() => startEditKelas(item)}
                                className="p-1 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded transition-all"
                                title="Edit Laporan"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteKelas(item.id, item.namaGuru)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all"
                                title="Hapus Laporan"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse" id="table-submissions-izin">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider bg-slate-50/20">
                  <th className="py-4 px-6">Hari / Tanggal</th>
                  <th className="py-4 px-6">Nama Guru</th>
                  <th className="py-4 px-6">Mata Pelajaran</th>
                  <th className="py-4 px-6">Jam Ke</th>
                  <th className="py-4 px-6">Izin/Sakit</th>
                  <th className="py-4 px-6">Keterangan/Alasan Izin</th>
                  {role === "BK" && <th className="py-4 px-6">Hubungi</th>}
                  {(role === "UTAMA" || role === "TU") && <th className="py-4 px-6 text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredIzin.length === 0 ? (
                  <tr>
                    <td colSpan={role === "BK" || role === "UTAMA" || role === "TU" ? 7 : 6} className="py-8 text-center text-xs text-slate-400">
                      Tidak ada laporan izin guru yang terdaftar.
                    </td>
                  </tr>
                ) : (
                  filteredIzin.map((item) => (
                    <tr key={item.id} className={`${editingIzinId === item.id ? 'bg-indigo-50/40 hover:bg-indigo-50/40' : 'hover:bg-slate-50/50'} transition-all text-xs`}>
                      <td className="py-3 px-6 font-medium text-slate-500">
                        {editingIzinId === item.id ? (
                          <div className="space-y-1">
                            <input
                              type="text"
                              value={editHari}
                              onChange={(e) => setEditHari(e.target.value)}
                              className="px-2 py-1 rounded border border-slate-200 text-xs w-full bg-white text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              placeholder="Hari"
                            />
                            <input
                              type="date"
                              value={editTanggal}
                              onChange={(e) => setEditTanggal(e.target.value)}
                              className="px-2 py-1 rounded border border-slate-200 text-[10px] w-full bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                        ) : (
                          <>
                            <div>{item.hari}</div>
                            <div className="text-[10px] text-slate-400">{item.tanggal}</div>
                          </>
                        )}
                      </td>
                      <td className="py-3 px-6 font-bold text-slate-800">
                        {editingIzinId === item.id ? (
                          <select
                            value={editNamaGuru}
                            onChange={(e) => setEditNamaGuru(e.target.value)}
                            className="px-2 py-1.5 rounded border border-slate-200 text-xs w-full max-w-[200px] bg-white text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            {scheduleData.namaGuruList.map(g => (
                              <option key={g} value={g}>{g}</option>
                            ))}
                          </select>
                        ) : (
                          item.namaGuru
                        )}
                      </td>
                      <td className="py-3 px-6 text-slate-600">
                        {editingIzinId === item.id ? (
                          <select
                            value={editMataPelajaran}
                            onChange={(e) => setEditMataPelajaran(e.target.value)}
                            className="px-2 py-1.5 rounded border border-slate-200 text-xs w-full max-w-[150px] bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            {scheduleData.mataPelajaranList.map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        ) : (
                          item.mataPelajaran
                        )}
                      </td>
                      <td className="py-3 px-6">
                        {editingIzinId === item.id ? (
                          <input
                            type="text"
                            value={editJamKe}
                            onChange={(e) => setEditJamKe(e.target.value)}
                            className="px-2 py-1.5 rounded border border-slate-200 text-xs w-full bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            placeholder="Contoh: 1, 2"
                          />
                        ) : (
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-semibold">Jam Ke-{item.jamKe}</span>
                        )}
                      </td>
                      <td className="py-3 px-6">
                        {editingIzinId === item.id ? (
                          <select
                            value={editKeteranganKehadiran}
                            onChange={(e) => setEditKeteranganKehadiran(e.target.value)}
                            className="px-2 py-1.5 rounded border border-slate-200 text-xs w-full bg-white text-slate-800 font-black focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="IZIN">IZIN</option>
                            <option value="SAKIT">SAKIT</option>
                          </select>
                        ) : (
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            item.keteranganKehadiran === "IZIN"
                              ? "bg-amber-50 text-amber-700 border border-amber-100"
                              : "bg-sky-50 text-sky-700 border border-sky-100"
                          }`}>
                            {item.keteranganKehadiran}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-6 text-slate-600 italic">
                        {editingIzinId === item.id ? (
                          <input
                            type="text"
                            value={editKeteranganIzinGuru}
                            onChange={(e) => setEditKeteranganIzinGuru(e.target.value)}
                            className="px-2 py-1 rounded border border-slate-200 text-xs w-full max-w-[200px] bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            placeholder="Alasan izin..."
                          />
                        ) : (
                          `"${item.keteranganIzinGuru}"`
                        )}
                      </td>

                      {/* BK Hubungi Column */}
                      {role === "BK" && (
                        <td className="py-4 px-6">
                          <a
                            href={`https://wa.me/?text=Halo%20Bapak/Ibu%20${encodeURIComponent(item.namaGuru)},%20kami%20dari%20BK%20ingin%20menanyakan%20perihal%20laporan%20izin%20terkait%20pelajaran%20${encodeURIComponent(item.mataPelajaran)}...`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 hover:text-emerald-700"
                          >
                            <Phone className="w-3 h-3" /> Chat WA
                          </a>
                        </td>
                      )}

                      {/* Main Admin / TU Action Column */}
                      {(role === "UTAMA" || role === "TU") && (
                        <td className="py-3 px-6 text-center">
                          {editingIzinId === item.id ? (
                            <div className="flex justify-center items-center gap-1.5">
                              <button
                                onClick={() => handleSaveIzin(item.id)}
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-all"
                                title="Simpan Perubahan"
                              >
                                <Check className="w-4 h-4 font-black" />
                              </button>
                              <button
                                onClick={cancelEditIzin}
                                className="p-1 text-slate-400 hover:bg-slate-100 rounded transition-all"
                                title="Batal"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-center items-center gap-1">
                              <button
                                onClick={() => startEditIzin(item)}
                                className="p-1 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded transition-all"
                                title="Edit Izin"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteIzin(item.id, item.namaGuru)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all"
                                title="Hapus Izin"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Role-specific instructions footer */}
      <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-6" id="admin-role-footer">
        <h4 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">Petunjuk Kerja Admin ({role})</h4>
        {role === "UTAMA" && (
          <p className="text-xs text-slate-500 leading-relaxed">
            Anda login sebagai <strong>Admin Utama</strong>. Anda memiliki kendali penuh terhadap seluruh sistem. Anda dapat menghapus data laporan siswa atau guru jika terjadi kesalahan input, serta memicu penyelarasan ulang data guru/jadwal langsung dari Google Sheet dengan mengklik tombol <strong>Sync GSheet</strong> di sudut kanan atas.
          </p>
        )}
        {role === "TU" && (
          <p className="text-xs text-slate-500 leading-relaxed">
            Anda login sebagai <strong>Admin Tata Usaha (TU)</strong>. Tanggung jawab Anda meliputi perekapan absensi berkala untuk laporan resmi sekolah. Gunakan tombol <strong>Ekspor CSV</strong> untuk memindahkan data absensi harian ke spreadsheet lokal, atau klik <strong>Cetak Rekap</strong> untuk mencetak langsung dokumen cetak.
          </p>
        )}
        {role === "BK" && (
          <p className="text-xs text-slate-500 leading-relaxed">
            Anda login sebagai <strong>Admin Bimbingan Konseling (BK)</strong>. Tugas utama Anda adalah mendampingi siswa/guru dan merumuskan solusi mengajar cadangan jika guru sakit/izin. Anda dapat menuliskan rekomendasi tindak lanjut langsung di tabel, atau mengklik tombol <strong>Chat WA</strong> untuk menghubungi guru bersangkutan.
          </p>
        )}
        {role === "TATIB" && (
          <p className="text-xs text-slate-500 leading-relaxed">
            Anda login sebagai <strong>Admin Tata Tertib</strong>. Fokus Anda adalah menegakkan disiplin waktu mengajar guru. Harap perhatikan guru dengan status <strong>TANPA KETERANGAN</strong> (Alpa). Gunakan tombol <strong>Tandai Alpa</strong> di kolom status disiplin untuk memflag laporan mencurigakan agar ditindaklanjuti kepala sekolah.
          </p>
        )}
      </div>
    </div>
  );
}

const APPS_SCRIPT_CODE = `function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000); // Tunggu sampai 10 detik jika ada proses lain
  
  try {
    var requestData = JSON.parse(e.postData.contents);
    var action = requestData.action; // 'add', 'edit', 'delete', 'sync_all'
    var type = requestData.type; // 'kelas' or 'izin'
    var payload = requestData.payload;
    
    var doc = null;
    try {
      doc = SpreadsheetApp.getActiveSpreadsheet();
    } catch (err) {
      // Abaikan error jika standalone script
    }
    
    if (!doc) {
      // JIKA ANDA MENGGUNAKAN STANDALONE SCRIPT (BUKAN EKSTENSI -> APPS SCRIPT),
      // SILAKAN MASUKKAN ID SPREADSHEET GOOGLE SHEET ANDA DI ANTARA TANDA KUTIP DI BAWAH INI:
      var SPREADSHEET_ID = ""; // Contoh: "1abc123XYZ..."
      if (SPREADSHEET_ID && SPREADSHEET_ID !== "") {
        doc = SpreadsheetApp.openById(SPREADSHEET_ID);
      }
    }
    
    if (!doc) {
      return ContentService.createTextOutput(JSON.stringify({ 
        success: false, 
        error: "Spreadsheet tidak ditemukan! Pastikan Anda membuka editor Apps Script lewat menu 'Ekstensi' > 'Apps Script' di dalam file Google Sheet yang bersangkutan, atau masukkan SPREADSHEET_ID secara manual di dalam kode Apps Script." 
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'sync_all') {
      var kelasData = requestData.kelasData || [];
      var izinData = requestData.izinData || [];
      
      // Update DATA_INPUT_KELAS sheet
      var sheetKelas = doc.getSheetByName("DATA_INPUT_KELAS");
      if (!sheetKelas) {
        sheetKelas = doc.insertSheet("DATA_INPUT_KELAS");
      }
      sheetKelas.clearContents();
      sheetKelas.appendRow(["ID", "Hari", "Tanggal", "Nama Guru", "Mata Pelajaran", "Jam Ke", "Keterangan Kehadiran", "Dilaporkan Oleh", "Waktu Input"]);
      for (var i = 0; i < kelasData.length; i++) {
        var item = kelasData[i];
        sheetKelas.appendRow([item.id, item.hari, item.tanggal, item.namaGuru, item.mataPelajaran, item.jamKe, item.keteranganKehadiran, item.submittedBy, item.submittedAt]);
      }
      
      // Update DATA_INPUT_IZIN_GURU sheet
      var sheetIzin = doc.getSheetByName("DATA_INPUT_IZIN_GURU");
      if (!sheetIzin) {
        sheetIzin = doc.insertSheet("DATA_INPUT_IZIN_GURU");
      }
      sheetIzin.clearContents();
      sheetIzin.appendRow(["ID", "Hari", "Tanggal", "Nama Guru", "Mata Pelajaran", "Jam Ke", "Status Kehadiran", "Keterangan Alasan", "Waktu Input"]);
      for (var j = 0; j < izinData.length; j++) {
        var item = izinData[j];
        sheetIzin.appendRow([item.id, item.hari, item.tanggal, item.namaGuru, item.mataPelajaran, item.jamKe, item.keteranganKehadiran, item.keteranganIzinGuru, item.submittedAt]);
      }
      
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Sinkronisasi massal seluruh data berhasil!" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var sheetName = type === 'kelas' ? "DATA_INPUT_KELAS" : "DATA_INPUT_IZIN_GURU";
    var sheet = doc.getSheetByName(sheetName);
    if (!sheet) {
      sheet = doc.insertSheet(sheetName);
      if (type === 'kelas') {
        sheet.appendRow(["ID", "Hari", "Tanggal", "Nama Guru", "Mata Pelajaran", "Jam Ke", "Keterangan Kehadiran", "Dilaporkan Oleh", "Waktu Input"]);
      } else {
        sheet.appendRow(["ID", "Hari", "Tanggal", "Nama Guru", "Mata Pelajaran", "Jam Ke", "Status Kehadiran", "Keterangan Alasan", "Waktu Input"]);
      }
    }
    
    if (action === 'add') {
      if (type === 'kelas') {
        sheet.appendRow([payload.id, payload.hari, payload.tanggal, payload.namaGuru, payload.mataPelajaran, payload.jamKe, payload.keteranganKehadiran, payload.submittedBy, payload.submittedAt]);
      } else {
        sheet.appendRow([payload.id, payload.hari, payload.tanggal, payload.namaGuru, payload.mataPelajaran, payload.jamKe, payload.keteranganKehadiran, payload.keteranganIzinGuru, payload.submittedAt]);
      }
    } else if (action === 'edit' || action === 'delete') {
      var data = sheet.getDataRange().getValues();
      var idColIndex = 0;
      var targetRow = -1;
      for (var r = 1; r < data.length; r++) {
        if (data[r][idColIndex].toString() === payload.id.toString()) {
          targetRow = r + 1;
          break;
        }
      }
      
      if (targetRow !== -1) {
        if (action === 'delete') {
          sheet.deleteRow(targetRow);
        } else if (action === 'edit') {
          if (type === 'kelas') {
            sheet.getRange(targetRow, 1, 1, 9).setValues([[payload.id, payload.hari, payload.tanggal, payload.namaGuru, payload.mataPelajaran, payload.jamKe, payload.keteranganKehadiran, payload.submittedBy, payload.submittedAt]]);
          } else {
            sheet.getRange(targetRow, 1, 1, 9).setValues([[payload.id, payload.hari, payload.tanggal, payload.namaGuru, payload.mataPelajaran, payload.jamKe, payload.keteranganKehadiran, payload.keteranganIzinGuru, payload.submittedAt]]);
          }
        }
      } else {
        if (action === 'edit') {
          if (type === 'kelas') {
            sheet.appendRow([payload.id, payload.hari, payload.tanggal, payload.namaGuru, payload.mataPelajaran, payload.jamKe, payload.keteranganKehadiran, payload.submittedBy, payload.submittedAt]);
          } else {
            sheet.appendRow([payload.id, payload.hari, payload.tanggal, payload.namaGuru, payload.mataPelajaran, payload.jamKe, payload.keteranganKehadiran, payload.keteranganIzinGuru, payload.submittedAt]);
          }
        }
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return ContentService.createTextOutput("Google Apps Script Web App untuk Presensi Sekolah Aktif!")
    .setMimeType(ContentService.MimeType.TEXT);
}`;
