/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, ChangeEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { StudentSubmission, TeacherLeaveSubmission, AdminRole, ScheduleData, KELAS_LIST, KeteranganKehadiran } from "../types";
import { FirebaseService } from "../firebase";
import LaporanPanel from "./LaporanPanel";
import TeacherPerformancePanel from "./TeacherPerformancePanel";

// @ts-ignore
import sapaGuruMockup from "../assets/sapa_guru_mockup.svg";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import * as XLSX from "xlsx";
import {
  FileSpreadsheet, Filter, Search, RotateCw, Trash2, Calendar, FileText, CheckCircle,
  AlertTriangle, UserX, Printer, Download, MessageSquarePlus, RefreshCw, Layers, BellRing, Phone,
  Edit, Check, X, ExternalLink, BookOpen, Award, Settings, Users, CheckCircle2, ShieldAlert,
  Upload, UploadCloud
} from "lucide-react";

interface AdminDashboardProps {
  role: AdminRole;
  scheduleData: ScheduleData;
  onLogout: () => void;
}

export default function AdminDashboard({ role, scheduleData, onLogout }: AdminDashboardProps) {
  const [submissionsKelas, setSubmissionsKelas] = useState<StudentSubmission[]>([]);
  const [submissionsIzin, setSubmissionsIzin] = useState<TeacherLeaveSubmission[]>([]);
  
  // Dashboard theme selection state
  const [currentTheme, setCurrentTheme] = useState<"INDIGO" | "EMERALD" | "TEAL" | "CHARCOAL">("EMERALD");

  const themeConfig = {
    INDIGO: {
      accentText: "text-indigo-600",
      accentBg: "bg-indigo-50/80 text-indigo-700 border-indigo-100",
      buttonPrimary: "bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500/20",
      borderActive: "border-indigo-600 text-indigo-600",
      lightBadge: "bg-indigo-50 text-indigo-700 border-indigo-100",
      gradientHeader: "from-indigo-600 to-blue-700",
      ringColor: "focus:ring-indigo-500",
      focusBorder: "focus:border-indigo-500 focus:ring-indigo-500/10",
      barColor: "#6366f1",
      hoverBorder: "hover:border-indigo-200"
    },
    EMERALD: {
      accentText: "text-emerald-600",
      accentBg: "bg-emerald-50/80 text-emerald-700 border-emerald-100",
      buttonPrimary: "bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500/20",
      borderActive: "border-emerald-600 text-emerald-600",
      lightBadge: "bg-emerald-50 text-emerald-700 border-emerald-100",
      gradientHeader: "from-emerald-600 to-teal-700",
      ringColor: "focus:ring-emerald-500",
      focusBorder: "focus:border-emerald-500 focus:ring-emerald-500/10",
      barColor: "#10b981",
      hoverBorder: "hover:border-emerald-200"
    },
    TEAL: {
      accentText: "text-teal-600",
      accentBg: "bg-teal-50/80 text-teal-700 border-teal-100",
      buttonPrimary: "bg-teal-600 hover:bg-teal-700 focus:ring-teal-500/20",
      borderActive: "border-teal-600 text-teal-600",
      lightBadge: "bg-teal-50 text-teal-700 border-teal-100",
      gradientHeader: "from-teal-600 to-cyan-700",
      ringColor: "focus:ring-teal-500",
      focusBorder: "focus:border-teal-500 focus:ring-teal-500/10",
      barColor: "#0d9488",
      hoverBorder: "hover:border-teal-200"
    },
    CHARCOAL: {
      accentText: "text-slate-800",
      accentBg: "bg-slate-100 text-slate-800 border-slate-200",
      buttonPrimary: "bg-slate-800 hover:bg-slate-950 focus:ring-slate-500/20",
      borderActive: "border-slate-800 text-slate-800",
      lightBadge: "bg-slate-100 text-slate-800 border-slate-200",
      gradientHeader: "from-slate-700 to-slate-950",
      ringColor: "focus:ring-slate-800",
      focusBorder: "focus:border-slate-800 focus:ring-slate-800/10",
      barColor: "#475569",
      hoverBorder: "hover:border-slate-300"
    }
  };

  const activeTheme = themeConfig[currentTheme];
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterHari, setFilterHari] = useState("SEMUA");
  const [filterTanggal, setFilterTanggal] = useState("");
  const [activeTab, setActiveTab] = useState<"KELAS" | "IZIN" | "PERFORMA" | "LAPORAN" | "SYNC" | "PENGATURAN">("KELAS");

  // School Settings
  const [tempLogoUrl, setTempLogoUrl] = useState("");
  const [tempInformasiUmum, setTempInformasiUmum] = useState("");
  const [isSavingSchoolSettings, setIsSavingSchoolSettings] = useState(false);

  // Google Apps Script state
  const [appsScriptUrl, setAppsScriptUrl] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Sync state
  const [lastSync, setLastSync] = useState(scheduleData.classAdmins ? "Tersinkronisasi" : "Belum");
  const [isSyncing, setIsSyncing] = useState(false);

  // DATA_INPUT_SISWA Backup Upload states
  const [importedStudentRecords, setImportedStudentRecords] = useState<StudentSubmission[] | null>(null);
  const [importStudentMode, setImportStudentMode] = useState<"merge" | "overwrite">("merge");
  const [isProcessingStudentImport, setIsProcessingStudentImport] = useState(false);
  const [studentImportFileName, setStudentImportFileName] = useState<string>("");
  const [studentImportStatusMsg, setStudentImportStatusMsg] = useState<string | null>(null);

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
  const [editKelas, setEditKelas] = useState("");

  const startEditKelas = (item: StudentSubmission) => {
    setEditingKelasId(item.id);
    setEditNamaGuru(item.namaGuru);
    setEditMataPelajaran(item.mataPelajaran);
    setEditJamKe(item.jamKe);
    setEditKeteranganKehadiran(item.keteranganKehadiran);
    setEditHari(item.hari || "");
    setEditTanggal(item.tanggal || "");
    setEditKelas(item.kelas || "");
  };

  const cancelEditKelas = () => {
    setEditingKelasId(null);
  };

  const handleSaveKelas = async (id: string) => {
    try {
      const updated = await FirebaseService.updateSubmissionKelas(id, {
        namaGuru: editNamaGuru,
        mataPelajaran: editMataPelajaran,
        jamKe: editJamKe,
        keteranganKehadiran: editKeteranganKehadiran,
        hari: editHari,
        tanggal: editTanggal,
        kelas: editKelas
      });
      setSubmissionsKelas(prev => prev.map(item => item.id === id ? { ...item, ...updated } : item));
      setEditingKelasId(null);
    } catch (e: any) {
      console.error(e);
      alert("Gagal menyimpan perubahan: " + (e.message || e));
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
    setEditKelas(item.kelas || "");
  };

  const cancelEditIzin = () => {
    setEditingIzinId(null);
  };

  const handleSaveIzin = async (id: string) => {
    try {
      const updated = await FirebaseService.updateSubmissionIzin(id, {
        namaGuru: editNamaGuru,
        mataPelajaran: editMataPelajaran,
        jamKe: editJamKe,
        keteranganKehadiran: editKeteranganKehadiran,
        keteranganIzinGuru: editKeteranganIzinGuru,
        hari: editHari,
        tanggal: editTanggal,
        kelas: editKelas
      });
      setSubmissionsIzin(prev => prev.map(item => item.id === id ? { ...item, ...updated } : item));
      setEditingIzinId(null);
    } catch (e: any) {
      console.error(e);
      alert("Gagal menyimpan perubahan: " + (e.message || e));
    }
  };

  useEffect(() => {
    fetchData();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const data = await FirebaseService.getSettings();
      setAppsScriptUrl(data.appsScriptUrl || "");
      setTempLogoUrl(data.logoUrl || "");
      setTempInformasiUmum(data.informasiUmum || "");
    } catch (e) {
      console.error("Gagal memuat konfigurasi Google Apps Script:", e);
    }
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      await FirebaseService.saveSettings({ 
        appsScriptUrl,
        logoUrl: tempLogoUrl,
        informasiUmum: tempInformasiUmum
      });
      alert("URL Google Apps Script berhasil disimpan!");
    } catch (e: any) {
      console.error(e);
      alert("Gagal menyimpan URL: " + (e.message || e));
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSaveSchoolSettings = async () => {
    setIsSavingSchoolSettings(true);
    try {
      await FirebaseService.saveSettings({
        appsScriptUrl,
        logoUrl: tempLogoUrl,
        informasiUmum: tempInformasiUmum
      });
      alert("Pengaturan logo dan Informasi Umum berhasil disimpan!");
      window.location.reload(); // reload to apply changes globally
    } catch (e: any) {
      console.error(e);
      alert("Gagal menyimpan pengaturan sekolah: " + (e.message || e));
    } finally {
      setIsSavingSchoolSettings(false);
    }
  };

  const fetchData = async () => {
    try {
      const [dataKelas, dataIzin] = await Promise.all([
        FirebaseService.getSubmissionsKelas(),
        FirebaseService.getSubmissionsIzin()
      ]);

      // Sort newest first
      dataKelas.sort((a: any, b: any) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
      setSubmissionsKelas(dataKelas);

      dataIzin.sort((a: any, b: any) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
      setSubmissionsIzin(dataIzin);
    } catch (e) {
      console.error("Gagal memuat data dashboard:", e);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await FirebaseService.syncWithGoogleSheet();
      setLastSync(new Date(result.lastSync).toLocaleTimeString("id-ID") + " " + new Date(result.lastSync).toLocaleDateString("id-ID"));
      alert("Berhasil menyinkronkan data guru dan admin kelas dengan Google Sheet!");
      window.location.reload();
    } catch (e: any) {
      alert("Gagal menyinkronkan data: " + (e.message || e));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDownloadStudentTemplate = () => {
    const headers = [
      ["ID", "Hari", "Tanggal", "Kelas", "Nama Guru", "Mata Pelajaran", "Jam Ke", "Keterangan Kehadiran", "Dilaporkan Oleh", "Waktu Input"]
    ];
    const todayStr = new Date().toISOString().split("T")[0];
    const nowStr = new Date().toISOString().replace("T", " ").substring(0, 19);
    const sampleRows = [
      ["ks_001", "Senin", todayStr, "X-1", "Drs. Budi Santoso", "Matematika", "1-2", "Hadir", "Admin X-1", nowStr],
      ["ks_002", "Senin", todayStr, "X-1", "Siti Aminah, S.Pd", "Bahasa Indonesia", "3-4", "Izin", "Admin X-1", nowStr],
      ["ks_003", "Selasa", todayStr, "XI-2", "Ahmad Fauzi, M.Pd", "Fisika", "1-2", "Sakit", "Admin XI-2", nowStr]
    ];

    const ws = XLSX.utils.aoa_to_sheet([...headers, ...sampleRows]);

    ws["!cols"] = [
      { wch: 14 }, // ID
      { wch: 10 }, // Hari
      { wch: 14 }, // Tanggal
      { wch: 10 }, // Kelas
      { wch: 26 }, // Nama Guru
      { wch: 22 }, // Mata Pelajaran
      { wch: 10 }, // Jam Ke
      { wch: 22 }, // Keterangan Kehadiran
      { wch: 18 }, // Dilaporkan Oleh
      { wch: 22 }, // Waktu Input
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DATA_INPUT_SISWA");
    XLSX.writeFile(wb, "Template_DATA_INPUT_SISWA.xlsx");
  };

  const handleStudentFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStudentImportFileName(file.name);
    setStudentImportStatusMsg(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (data.length < 2) {
          alert("File Excel/CSV kosong atau tidak berisi baris data!");
          return;
        }

        // Columns: 0:ID | 1:Hari | 2:Tanggal | 3:Kelas | 4:Nama Guru | 5:Mata Pelajaran | 6:Jam Ke | 7:Keterangan Kehadiran | 8:Dilaporkan Oleh | 9:Waktu Input
        const rows = data.slice(1);
        const parsed: StudentSubmission[] = [];

        rows.forEach((row) => {
          if (!row || row.length === 0) return;
          const hasData = row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== "");
          if (!hasData) return;

          const id = row[0] ? String(row[0]).trim() : `imp_${Math.random().toString(36).substring(2, 9)}`;
          const hari = row[1] ? String(row[1]).trim() : "Senin";
          let tanggal = row[2] ? String(row[2]).trim() : new Date().toISOString().split('T')[0];
          
          if (!isNaN(Number(tanggal)) && Number(tanggal) > 30000) {
            const dateObj = new Date((Number(tanggal) - (25567 + 2)) * 86400 * 1000);
            tanggal = dateObj.toISOString().split('T')[0];
          }

          const kelas = row[3] ? String(row[3]).trim() : "";
          const namaGuru = row[4] ? String(row[4]).trim() : "-";
          const mataPelajaran = row[5] ? String(row[5]).trim() : "-";
          const jamKe = row[6] ? String(row[6]).trim() : "1";
          const rawKet = row[7] ? String(row[7]).trim() : "Hadir";
          const keteranganKehadiran: KeteranganKehadiran = (
            ["Hadir", "Izin", "Sakit", "Terlambat", "Alpa"].includes(rawKet) ? rawKet : "Hadir"
          ) as KeteranganKehadiran;
          const submittedBy = row[8] ? String(row[8]).trim() : "Admin Import";
          const submittedAt = row[9] ? String(row[9]).trim() : new Date().toISOString();

          parsed.push({
            id,
            hari,
            tanggal,
            kelas,
            namaGuru,
            mataPelajaran,
            jamKe,
            keteranganKehadiran,
            submittedBy,
            submittedAt
          });
        });

        if (parsed.length === 0) {
          alert("Tidak ditemukan baris data valid pada file yang diunggah.");
          return;
        }

        setImportedStudentRecords(parsed);
      } catch (err: any) {
        alert("Gagal membaca file Excel/CSV: " + (err.message || err));
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmStudentImport = async () => {
    if (!importedStudentRecords || importedStudentRecords.length === 0) return;

    setIsProcessingStudentImport(true);
    try {
      const updatedList = await FirebaseService.saveAllSubmissionsKelas(importedStudentRecords, importStudentMode);
      setSubmissionsKelas(updatedList);
      setStudentImportStatusMsg(`Berhasil mengimpor ${importedStudentRecords.length} data DATA_INPUT_SISWA ke sistem!`);
      setImportedStudentRecords(null);
      setStudentImportFileName("");
    } catch (err: any) {
      alert("Gagal mengimpor data: " + (err.message || err));
    } finally {
      setIsProcessingStudentImport(false);
    }
  };

  const handleDeleteKelas = async (id: string, name: string) => {
    if (!window.confirm(`Hapus laporan kehadiran guru ${name}? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      await FirebaseService.deleteSubmissionKelas(id);
      setSubmissionsKelas(prev => prev.filter(item => item.id !== id));
    } catch (e: any) {
      alert("Terjadi kesalahan: " + (e.message || e));
    }
  };

  const handleDeleteAllKelas = async () => {
    const totalCount = submissionsKelas.length;
    if (totalCount === 0) {
      alert("Tidak ada data laporan kehadiran kelas untuk dihapus.");
      return;
    }
    if (!window.confirm(`Apakah Anda yakin ingin MENGHAPUS SEMUA (${totalCount}) data laporan kehadiran kelas/siswa? Tindakan ini tidak dapat dibatalkan!`)) return;
    try {
      await FirebaseService.clearAllSubmissionsKelas();
      setSubmissionsKelas([]);
      alert(`Berhasil menghapus seluruh ${totalCount} data laporan kehadiran kelas.`);
    } catch (e: any) {
      alert("Terjadi kesalahan saat menghapus data: " + (e.message || e));
    }
  };

  const handleDeleteIzin = async (id: string, name: string) => {
    if (!window.confirm(`Hapus laporan izin guru ${name}? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      await FirebaseService.deleteSubmissionIzin(id);
      setSubmissionsIzin(prev => prev.filter(item => item.id !== id));
    } catch (e: any) {
      alert("Terjadi kesalahan: " + (e.message || e));
    }
  };

  const handleDeleteAllIzin = async () => {
    const totalCount = submissionsIzin.length;
    if (totalCount === 0) {
      alert("Tidak ada data laporan izin guru untuk dihapus.");
      return;
    }
    if (!window.confirm(`Apakah Anda yakin ingin MENGHAPUS SEMUA (${totalCount}) data laporan izin guru? Tindakan ini tidak dapat dibatalkan!`)) return;
    try {
      await FirebaseService.clearAllSubmissionsIzin();
      setSubmissionsIzin([]);
      alert(`Berhasil menghapus seluruh ${totalCount} data laporan izin guru.`);
    } catch (e: any) {
      alert("Terjadi kesalahan saat menghapus data: " + (e.message || e));
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
      headers = ["Hari", "Tanggal", "Kelas", "Nama Guru", "Mata Pelajaran", "Jam Ke", "Keterangan Kehadiran", "Dilaporkan Oleh", "Waktu Input"];
      rows = (dataToExport as StudentSubmission[]).map(s => [
        s.hari, s.tanggal, s.kelas || "", s.namaGuru, s.mataPelajaran, s.jamKe, s.keteranganKehadiran, s.submittedBy, s.submittedAt
      ]);
    } else {
      headers = ["Hari", "Tanggal", "Kelas", "Nama Guru", "Mata Pelajaran", "Jam Ke", "Keterangan Kehadiran", "Keterangan Izin Guru", "Waktu Input"];
      rows = (dataToExport as TeacherLeaveSubmission[]).map(s => [
        s.hari, s.tanggal, s.kelas || "", s.namaGuru, s.mataPelajaran, s.jamKe, s.keteranganKehadiran, s.keteranganIzinGuru, s.submittedAt
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
    { name: "Hadir", value: countHadir, color: activeTheme.barColor },
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

      {/* Visual Showcase Banner SAPA Guru */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl overflow-hidden shadow-xl border border-slate-700/50 flex flex-col lg:flex-row items-center gap-6 p-6 lg:p-8 relative" id="sapaguru-visual-showcase">
        {/* Subtle decorative glowing lights */}
        <div className="absolute top-0 left-0 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex-1 space-y-4 z-10">
          <div className="flex items-center gap-3">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">Aplikasi Mobile SAPA Guru Aktif</span>
          </div>
          
          <h2 className="text-xl lg:text-2xl font-black text-white leading-tight tracking-tight">
            Sistem Absensi Mandiri &amp; Transparan Terintegrasi Realtime
          </h2>
          
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
        <div className="w-full lg:w-[480px] shrink-0 z-10 transition-transform duration-500 hover:scale-[1.01]" id="sapaguru-mockup-frame">
          <img 
            src={sapaGuruMockup} 
            alt="SAPA Guru Mobile App Mockup Showcase" 
            className="w-full h-auto object-contain rounded-2xl shadow-lg border border-slate-700/30"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>

      {/* Rekomendasi Tema Warna Panel */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col md:flex-row md:items-center justify-between gap-4" id="theme-recommendation-panel">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-base">🎨</span>
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Rekomendasi Tema Warna Dashboard (Kenyamanan Mata)</h3>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Pilihan palet warna premium yang didesain khusus agar nyaman di mata saat Anda memantau absensi dalam jangka waktu lama.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCurrentTheme("EMERALD")}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
              currentTheme === "EMERALD"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm scale-[1.02]"
                : "bg-slate-50 text-slate-600 border-slate-200/60 hover:bg-slate-100"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shrink-0"></span>
            Emerald Sage (Rekomendasi)
          </button>
          <button
            type="button"
            onClick={() => setCurrentTheme("TEAL")}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
              currentTheme === "TEAL"
                ? "bg-teal-50 text-teal-700 border-teal-200 shadow-sm scale-[1.02]"
                : "bg-slate-50 text-slate-600 border-slate-200/60 hover:bg-slate-100"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-teal-500 inline-block shrink-0"></span>
            Ocean Teal
          </button>
          <button
            type="button"
            onClick={() => setCurrentTheme("INDIGO")}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
              currentTheme === "INDIGO"
                ? "bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm scale-[1.02]"
                : "bg-slate-50 text-slate-600 border-slate-200/60 hover:bg-slate-100"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block shrink-0"></span>
            Classic Indigo
          </button>
          <button
            type="button"
            onClick={() => setCurrentTheme("CHARCOAL")}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
              currentTheme === "CHARCOAL"
                ? "bg-slate-800 text-white border-slate-700 shadow-sm scale-[1.02]"
                : "bg-slate-50 text-slate-600 border-slate-200/60 hover:bg-slate-100"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-slate-800 inline-block shrink-0"></span>
            Dark Charcoal
          </button>
        </div>
      </div>

      {/* Statistics Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Total Kelas Terlapor */}
        <div className={`bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 transition-all duration-300 ${activeTheme.hoverBorder} hover:shadow-md hover:bg-slate-50/20`}>
          <div className={`p-3 bg-blue-500/10 text-blue-600 rounded-2xl shadow-inner shrink-0`}>
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Laporan Kelas</div>
            <div className="text-2xl font-black text-slate-800" id="stat-total-laporan">{totalReportedKelas}</div>
            <div className="text-[10px] text-slate-400">Total jam pelajaran terlapor</div>
          </div>
        </div>

        {/* Card 2: Tingkat Kehadiran Guru */}
        <div className={`bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 transition-all duration-300 ${activeTheme.hoverBorder} hover:shadow-md hover:bg-slate-50/20`}>
          <div className={`p-3 bg-emerald-500/10 text-emerald-600 rounded-2xl shadow-inner shrink-0`}>
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Hadir (Persentase)</div>
            <div className={`text-2xl font-black ${activeTheme.accentText}`} id="stat-kehadiran-persen">
              {totalReportedKelas > 0 ? Math.round((countHadir / totalReportedKelas) * 100) : 0}%
            </div>
            <div className="text-[10px] text-slate-400">{countHadir} dari {totalReportedKelas} jam terlapor</div>
          </div>
        </div>

        {/* Card 3: Total Guru Izin & Sakit */}
        <div className={`bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 transition-all duration-300 ${activeTheme.hoverBorder} hover:shadow-md hover:bg-slate-50/20`}>
          <div className={`p-3 bg-amber-500/10 text-amber-600 rounded-2xl shadow-inner shrink-0`}>
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
        <div className={`bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 transition-all duration-300 ${activeTheme.hoverBorder} hover:shadow-md hover:bg-slate-50/20`}>
          <div className={`p-3 bg-rose-500/10 text-rose-600 rounded-2xl shadow-inner shrink-0`}>
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
                <Bar dataKey="Hadir" fill={activeTheme.barColor} radius={[4, 4, 0, 0]} />
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
            <div className="flex flex-col items-center">
              <span className="w-2.5 h-2.5 rounded-full mb-1" style={{ backgroundColor: activeTheme.barColor }}></span>
              Hadir ({countHadir})
            </div>
            <div className="flex flex-col items-center">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 mb-1"></span>
              Izin ({countIzin})
            </div>
            <div className="flex flex-col items-center">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 mb-1"></span>
              Sakit ({countSakit})
            </div>
            <div className="flex flex-col items-center">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 mb-1"></span>
              Alpa ({countAlpa})
            </div>
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
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-opacity-10 transition-all ${activeTheme.focusBorder}`}
            />
          </div>

          {/* Hari */}
          <select
            id="filter-hari-select"
            value={filterHari}
            onChange={(e) => setFilterHari(e.target.value)}
            className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-opacity-10 transition-all ${activeTheme.focusBorder}`}
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
            className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-opacity-10 transition-all ${activeTheme.focusBorder}`}
          />
        </div>
      </div>

      {/* Tab Data Table Submissions */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden" id="admin-table-panel">
        <div className="flex flex-col lg:flex-row border-b border-slate-200/80 bg-slate-50/80 justify-between items-stretch lg:items-center p-3 md:p-4 gap-3">
          {/* Distinct Colored Tabs Bar */}
          <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0 scrollbar-none items-center">
            {/* TAB 1: KELAS */}
            <button
              onClick={() => setActiveTab("KELAS")}
              id="tab-btn-kelas"
              className={`relative flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition-all shrink-0 cursor-pointer ${
                activeTab === "KELAS"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "bg-white text-slate-600 hover:bg-blue-50/80 hover:text-blue-700 border border-slate-200/80"
              }`}
            >
              <BookOpen className={`w-4 h-4 ${activeTab === "KELAS" ? "text-white" : "text-blue-600"}`} />
              <span>DATA INPUT KELAS (SISWA)</span>
              <span className={`px-2 py-0.5 text-[10px] font-black rounded-full transition-all ${
                activeTab === "KELAS" ? "bg-white/20 text-white" : "bg-blue-100 text-blue-800"
              }`}>
                {filteredKelas.length}
              </span>
              {activeTab === "KELAS" && (
                <motion.div
                  layoutId="activeAdminTabBorder"
                  className="absolute -bottom-1.5 left-2 right-2 h-1 bg-blue-600 rounded-full"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>

            {/* TAB 2: IZIN */}
            <button
              onClick={() => setActiveTab("IZIN")}
              id="tab-btn-izin"
              className={`relative flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition-all shrink-0 cursor-pointer ${
                activeTab === "IZIN"
                  ? "bg-amber-600 text-white shadow-md shadow-amber-500/20"
                  : "bg-white text-slate-600 hover:bg-amber-50/80 hover:text-amber-700 border border-slate-200/80"
              }`}
            >
              <UserX className={`w-4 h-4 ${activeTab === "IZIN" ? "text-white" : "text-amber-600"}`} />
              <span>DATA INPUT IZIN (GURU)</span>
              <span className={`px-2 py-0.5 text-[10px] font-black rounded-full transition-all ${
                activeTab === "IZIN" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800"
              }`}>
                {filteredIzin.length}
              </span>
              {activeTab === "IZIN" && (
                <motion.div
                  layoutId="activeAdminTabBorder"
                  className="absolute -bottom-1.5 left-2 right-2 h-1 bg-amber-600 rounded-full"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>

            {/* TAB 3: PERFORMA GURU */}
            <button
              onClick={() => setActiveTab("PERFORMA")}
              id="tab-btn-performa"
              className={`relative flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition-all shrink-0 cursor-pointer ${
                activeTab === "PERFORMA"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                  : "bg-white text-slate-600 hover:bg-emerald-50/80 hover:text-emerald-700 border border-slate-200/80"
              }`}
            >
              <Award className={`w-4 h-4 ${activeTab === "PERFORMA" ? "text-white" : "text-emerald-600"}`} />
              <span>📊 PERFORMA GURU</span>
              <span className={`px-2 py-0.5 text-[10px] font-black rounded-full transition-all ${
                activeTab === "PERFORMA" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
              }`}>
                Analisis
              </span>
              {activeTab === "PERFORMA" && (
                <motion.div
                  layoutId="activeAdminTabBorder"
                  className="absolute -bottom-1.5 left-2 right-2 h-1 bg-emerald-600 rounded-full"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>

            {/* TAB 4: LAPORAN */}
            <button
              onClick={() => setActiveTab("LAPORAN")}
              id="tab-btn-laporan"
              className={`relative flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition-all shrink-0 cursor-pointer ${
                activeTab === "LAPORAN"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
                  : "bg-white text-slate-600 hover:bg-purple-50/80 hover:text-purple-700 border border-slate-200/80"
              }`}
            >
              <FileSpreadsheet className={`w-4 h-4 ${activeTab === "LAPORAN" ? "text-white" : "text-purple-600"}`} />
              <span>📋 CETAK & LAPORAN</span>
              <span className={`px-2 py-0.5 text-[10px] font-black rounded-full transition-all ${
                activeTab === "LAPORAN" ? "bg-white/20 text-white" : "bg-purple-100 text-purple-800"
              }`}>
                Rekap
              </span>
              {activeTab === "LAPORAN" && (
                <motion.div
                  layoutId="activeAdminTabBorder"
                  className="absolute -bottom-1.5 left-2 right-2 h-1 bg-purple-600 rounded-full"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>

            {/* TAB 5: SYNC GSHEET */}
            <button
              onClick={() => setActiveTab("SYNC")}
              id="tab-btn-sync"
              className={`relative flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition-all shrink-0 cursor-pointer ${
                activeTab === "SYNC"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                  : "bg-white text-slate-600 hover:bg-indigo-50/80 hover:text-indigo-700 border border-slate-200/80"
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${activeTab === "SYNC" ? "text-white" : "text-indigo-600"}`} />
              <span>SINKRONISASI GSHEET</span>
              <span className={`px-2 py-0.5 text-[10px] font-black rounded-full transition-all ${
                appsScriptUrl
                  ? activeTab === "SYNC" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
                  : activeTab === "SYNC" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800"
              }`}>
                {appsScriptUrl ? "Terhubung" : "Offline"}
              </span>
              {activeTab === "SYNC" && (
                <motion.div
                  layoutId="activeAdminTabBorder"
                  className="absolute -bottom-1.5 left-2 right-2 h-1 bg-indigo-600 rounded-full"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>

            {/* TAB 6: PENGATURAN SEKOLAH (Utama Only) */}
            {role === "UTAMA" && (
              <button
                onClick={() => setActiveTab("PENGATURAN")}
                id="tab-btn-pengaturan"
                className={`relative flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition-all shrink-0 cursor-pointer ${
                  activeTab === "PENGATURAN"
                    ? "bg-rose-600 text-white shadow-md shadow-rose-500/20"
                    : "bg-white text-slate-600 hover:bg-rose-50/80 hover:text-rose-700 border border-slate-200/80"
                }`}
              >
                <Settings className={`w-4 h-4 ${activeTab === "PENGATURAN" ? "text-white" : "text-rose-600"}`} />
                <span>PENGATURAN SEKOLAH</span>
                {activeTab === "PENGATURAN" && (
                  <motion.div
                    layoutId="activeAdminTabBorder"
                    className="absolute -bottom-1.5 left-2 right-2 h-1 bg-rose-600 rounded-full"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            )}
          </div>

          {/* Action Buttons Right Side */}
          <div className="flex gap-2 shrink-0 items-center justify-end flex-wrap">
            {activeTab === "KELAS" && submissionsKelas.length > 0 && (
              <button
                type="button"
                onClick={handleDeleteAllKelas}
                id="btn-delete-all-kelas"
                className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-black bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md shadow-rose-600/20 transition-all cursor-pointer border border-rose-400/30 active:scale-95"
                title="Hapus Seluruh Data Laporan Kehadiran Kelas"
              >
                <Trash2 className="w-4 h-4 shrink-0" />
                <span>Hapus Semua Laporan Kelas ({submissionsKelas.length})</span>
              </button>
            )}
            {activeTab === "IZIN" && submissionsIzin.length > 0 && (
              <button
                type="button"
                onClick={handleDeleteAllIzin}
                id="btn-delete-all-izin"
                className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-black bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md shadow-rose-600/20 transition-all cursor-pointer border border-rose-400/30 active:scale-95"
                title="Hapus Seluruh Data Laporan Izin Guru"
              >
                <Trash2 className="w-4 h-4 shrink-0" />
                <span>Hapus Semua Laporan Izin ({submissionsIzin.length})</span>
              </button>
            )}
            {role === "TU" && (
              <button
                onClick={() => window.print()}
                id="btn-print"
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs transition-all cursor-pointer hover:scale-[1.02]"
              >
                <Printer className="w-3.5 h-3.5" /> Cetak Rekap
              </button>
            )}
            <button
              onClick={handleDownloadCSV}
              id="btn-download-csv"
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-black bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/30 transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0 border border-emerald-400/30"
              title="Ekspor Seluruh Data Kehadiran ke Format CSV"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>Ekspor CSV</span>
            </button>
          </div>
        </div>

        {/* Distinct Active View Indicator Banner */}
        <div className="px-4 md:px-6 pt-4 pb-2">
          <div className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition-all ${
            activeTab === "KELAS" ? "bg-blue-50/90 border-blue-200 text-blue-900" :
            activeTab === "IZIN" ? "bg-amber-50/90 border-amber-200 text-amber-900" :
            activeTab === "PERFORMA" ? "bg-emerald-50/90 border-emerald-200 text-emerald-900" :
            activeTab === "LAPORAN" ? "bg-purple-50/90 border-purple-200 text-purple-900" :
            activeTab === "SYNC" ? "bg-indigo-50/90 border-indigo-200 text-indigo-900" :
            "bg-rose-50/90 border-rose-200 text-rose-900"
          }`}>
            <div className="flex items-center gap-2.5 font-extrabold">
              <span className={`p-1.5 rounded-lg text-white font-black text-xs shrink-0 ${
                activeTab === "KELAS" ? "bg-blue-600" :
                activeTab === "IZIN" ? "bg-amber-600" :
                activeTab === "PERFORMA" ? "bg-emerald-600" :
                activeTab === "LAPORAN" ? "bg-purple-600" :
                activeTab === "SYNC" ? "bg-indigo-600" :
                "bg-rose-600"
              }`}>
                {activeTab === "KELAS" && <BookOpen className="w-4 h-4" />}
                {activeTab === "IZIN" && <UserX className="w-4 h-4" />}
                {activeTab === "PERFORMA" && <Award className="w-4 h-4" />}
                {activeTab === "LAPORAN" && <FileSpreadsheet className="w-4 h-4" />}
                {activeTab === "SYNC" && <RefreshCw className="w-4 h-4" />}
                {activeTab === "PENGATURAN" && <Settings className="w-4 h-4" />}
              </span>
              <div>
                <span className="font-black tracking-wide uppercase text-[11px] block sm:inline">
                  {activeTab === "KELAS" && "Halaman Input Kelas (Siswa)"}
                  {activeTab === "IZIN" && "Halaman Input Izin Guru"}
                  {activeTab === "PERFORMA" && "Analisis Performa & Disiplin Guru"}
                  {activeTab === "LAPORAN" && "Cetak & Rekap Laporan Bulanan"}
                  {activeTab === "SYNC" && "Integrasi Google Spreadsheet Real-Time"}
                  {activeTab === "PENGATURAN" && "Pengaturan Identitas & Logo Sekolah"}
                </span>
                <span className="text-[10px] opacity-80 block font-medium">
                  {activeTab === "KELAS" && `Menampilkan ${filteredKelas.length} data laporan dari Admin Kelas (perwakilan siswa)`}
                  {activeTab === "IZIN" && `Menampilkan ${filteredIzin.length} data laporan permohonan izin mengajar guru`}
                  {activeTab === "PERFORMA" && "Statistik persentase kehadiran mengajar dan tingkat keaktifan guru di kelas"}
                  {activeTab === "LAPORAN" && "Generasi dokumen resmi untuk arsip kurikulum, tata tertib, dan kepala sekolah"}
                  {activeTab === "SYNC" && (appsScriptUrl ? "Status Google Apps Script: Terhubung Aktif ✓" : "Status: Menunggu konfigurasi Web App URL")}
                  {activeTab === "PENGATURAN" && "Penyesuaian nama instansi, logo sekolah, dan teks informasi umum"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 text-[10px] self-end sm:self-auto">
              <span className="font-bold opacity-75">Visual Active View:</span>
              <span className="font-black px-2.5 py-0.5 rounded-full bg-white/90 border border-current shadow-2xs">
                {activeTab}
              </span>
            </div>
          </div>
        </div>

        {/* DATA TABLE ANIMATED CONTENT WRAPPER */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12, scale: 0.995 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.995 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {activeTab === "PERFORMA" ? (
              <TeacherPerformancePanel
                submissionsKelas={submissionsKelas}
                scheduleData={scheduleData}
                activeTheme={activeTheme}
                currentThemeKey={currentTheme}
              />
            ) : activeTab === "LAPORAN" ? (
              <LaporanPanel
                submissionsKelas={submissionsKelas}
                submissionsIzin={submissionsIzin}
                activeTheme={activeTheme}
                currentThemeKey={currentTheme}
              />
            ) : (
              <div className="overflow-x-auto">
                {activeTab === "PENGATURAN" && role === "UTAMA" ? (
                <div className="p-6 max-w-2xl mx-auto space-y-8" id="panel-pengaturan-utama">
              {/* Card Header */}
              <div className="p-5 rounded-xl border bg-purple-50/50 border-purple-100 flex items-start gap-4">
                <span className="text-2xl">⚙️</span>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">Pengaturan Identitas & Informasi Sekolah</h4>
                  <p className="text-xs text-slate-500 leading-relaxed mt-1">
                    Sebagai <strong>Admin Utama</strong>, Anda dapat menyesuaikan logo instansi sekolah dan mengupdate Informasi Umum/Pengumuman yang muncul di halaman beranda utama sistem.
                  </p>
                </div>
              </div>

              {/* Logo Settings Card */}
              <div className="bg-white border border-slate-200/60 rounded-xl p-5 md:p-6 space-y-4 shadow-sm">
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Logo Instansi Sekolah</h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Tempelkan tautan URL gambar logo sekolah Anda di bawah ini (misalnya logo tut wuri handayani, logo dinas, atau logo sekolah).
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  {/* Logo Preview */}
                  <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 shadow-sm">
                    {tempLogoUrl ? (
                      <img src={tempLogoUrl} alt="Preview Logo" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-xs text-slate-400 font-bold">No Logo</span>
                    )}
                  </div>
                  <div className="flex-1 w-full">
                    <input
                      type="url"
                      placeholder="https://contoh.com/logo-sekolah.png"
                      value={tempLogoUrl}
                      onChange={(e) => setTempLogoUrl(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/10 focus:border-purple-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Informasi Umum Card */}
              <div className="bg-white border border-slate-200/60 rounded-xl p-5 md:p-6 space-y-4 shadow-sm">
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Informasi Umum & Pengumuman Sekolah</h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Teks pengumuman atau instruksi umum yang akan dipajang secara menonjol di halaman depan (Lobby) bagi seluruh perwakilan siswa dan guru.
                  </p>
                </div>

                <div>
                  <textarea
                    rows={4}
                    placeholder="Contoh: Selamat Datang di Sistem PresensiGuru Kelas! Mohon agar setiap perwakilan siswa (Admin Kelas) melaporkan kehadiran guru maksimal 15 menit setelah jam pelajaran dimulai. Terima kasih atas kerja samanya."
                    value={tempInformasiUmum}
                    onChange={(e) => setTempInformasiUmum(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/10 focus:border-purple-500 leading-relaxed"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSaveSchoolSettings}
                  disabled={isSavingSchoolSettings}
                  className="px-6 py-2.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 rounded-lg shadow-sm transition-all cursor-pointer"
                >
                  {isSavingSchoolSettings ? "Menyimpan Perubahan..." : "Simpan Pengaturan Sekolah"}
                </button>
              </div>
            </div>
          ) : activeTab === "SYNC" ? (
            <div className="p-6 max-w-4xl mx-auto space-y-6" id="panel-sync-apps-script">
              {/* Alert status */}
              <div className="p-5 rounded-xl border bg-indigo-50/50 border-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <FileSpreadsheet className="w-6 h-6 text-indigo-600 mt-1 shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Sinkronisasi Otomatis Google Sheets via Google Apps Script</h4>
                    <p className="text-xs text-slate-500 leading-relaxed mt-1">
                      Fitur ini memungkinkan data absensi kelas (oleh siswa) dan laporan izin (oleh guru) otomatis terkirim dan tercatat langsung pada sheet <strong>DATA_INPUT_KELAS</strong> dan <strong>DATA_INPUT_IZIN_GURU</strong> di Google Spreadsheet Anda secara real-time saat disubmit, diedit, atau dihapus!
                    </p>
                  </div>
                </div>
                {/* Button placed beside SINKRONISASI GSHEET (Otomatis) */}
                <a
                  href="https://docs.google.com/spreadsheets/d/1I-L5m4C7jOK-3y2hKnzhQEb9GDFzqot7YylhvooC7AM/edit?usp=sharing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-xl transition-all hover:bg-emerald-100 shrink-0 self-center"
                >
                  <ExternalLink className="w-4 h-4" /> Lihat Google Sheet
                </a>
              </div>

              {/* URL Configuration Card */}
              <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-5 md:p-6 space-y-4">
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">Konfigurasi URL Google Apps Script</h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {role === "UTAMA" || role === "TU" 
                      ? "Masukkan URL Aplikasi Web Google Apps Script yang didapatkan setelah melakukan deploy script di bawah."
                      : "Tautan integrasi Web App Google Apps Script sekolah yang terhubung aktif saat ini."}
                  </p>
                </div>
                <div className="flex flex-col md:flex-row gap-3">
                  <input
                    type="url"
                    placeholder="https://script.google.com/macros/s/.../exec"
                    value={appsScriptUrl}
                    onChange={(e) => setAppsScriptUrl(e.target.value)}
                    disabled={role !== "UTAMA" && role !== "TU"}
                    className="flex-1 px-4 py-2 rounded-lg border border-slate-200 bg-white disabled:bg-slate-100 text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 font-mono"
                  />
                  {(role === "UTAMA" || role === "TU") && (
                    <button
                      onClick={handleSaveSettings}
                      disabled={isSavingSettings}
                      className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 rounded-lg shadow-sm transition-all shrink-0 cursor-pointer"
                    >
                      {isSavingSettings ? "Menyimpan..." : "Simpan URL"}
                    </button>
                  )}
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

              {/* Upload Backup DATA_INPUT_SISWA (Data Input Kelas) Card */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 md:p-6 space-y-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <UploadCloud className="w-5 h-5 text-indigo-600" />
                      Upload Backup DATA_INPUT_SISWA (Data Input Kelas)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Upload file Excel/CSV hasil backup untuk mengimpor atau memulihkan data absensi kelas (siswa) secara mudah.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadStudentTemplate}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 rounded-xl transition-all shrink-0 cursor-pointer shadow-2xs"
                  >
                    <Download className="w-4 h-4" /> Unduh Template Excel
                  </button>
                </div>

                {/* Column Format Legend */}
                <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3.5 text-[11px] text-slate-600 space-y-2">
                  <div className="font-bold text-slate-700 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Format Kolom Template Excel DATA_INPUT_SISWA:
                  </div>
                  <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
                    {["ID", "Hari", "Tanggal", "Kelas", "Nama Guru", "Mata Pelajaran", "Jam Ke", "Keterangan Kehadiran", "Dilaporkan Oleh", "Waktu Input"].map((col) => (
                      <span key={col} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-800 font-semibold shadow-2xs">
                        {col}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Upload File Input Area */}
                <div className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/20 hover:bg-indigo-50/50 rounded-2xl p-6 text-center transition-all">
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    id="student-excel-upload"
                    className="hidden"
                    onChange={handleStudentFileUpload}
                  />
                  <label htmlFor="student-excel-upload" className="cursor-pointer flex flex-col items-center justify-center space-y-2">
                    <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center shadow-xs">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        Klik untuk memilih file Excel / CSV DATA_INPUT_SISWA
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Mendukung format .XLSX, .XLS, dan .CSV
                      </p>
                    </div>
                    {studentImportFileName && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-lg mt-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> File Terpilih: {studentImportFileName}
                      </span>
                    )}
                  </label>
                </div>

                {studentImportStatusMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    {studentImportStatusMsg}
                  </div>
                )}

                {/* Preview Parsed Data */}
                {importedStudentRecords && importedStudentRecords.length > 0 && (
                  <div className="bg-slate-900 text-slate-100 rounded-2xl p-5 space-y-4 border border-slate-800 shadow-xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                          <Check className="w-4 h-4" /> Pratinjau Data ({importedStudentRecords.length} Baris Terdeteksi)
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Periksa data sebelum mengimpor ke sistem.
                        </p>
                      </div>

                      {/* Mode Selector */}
                      <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-xl border border-slate-700">
                        <button
                          type="button"
                          onClick={() => setImportStudentMode("merge")}
                          className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                            importStudentMode === "merge"
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          Gabungkan Data
                        </button>
                        <button
                          type="button"
                          onClick={() => setImportStudentMode("overwrite")}
                          className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                            importStudentMode === "overwrite"
                              ? "bg-amber-600 text-white shadow-xs"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          Timpa Semua Data
                        </button>
                      </div>
                    </div>

                    {/* Preview Table */}
                    <div className="max-h-60 overflow-y-auto border border-slate-800 rounded-xl">
                      <table className="w-full text-left text-[11px] text-slate-300">
                        <thead className="sticky top-0 bg-slate-800 text-slate-200 font-bold border-b border-slate-700">
                          <tr>
                            <th className="px-3 py-2">ID</th>
                            <th className="px-3 py-2">Hari</th>
                            <th className="px-3 py-2">Tanggal</th>
                            <th className="px-3 py-2">Kelas</th>
                            <th className="px-3 py-2">Nama Guru</th>
                            <th className="px-3 py-2">Mata Pelajaran</th>
                            <th className="px-3 py-2">Jam Ke</th>
                            <th className="px-3 py-2">Keterangan</th>
                            <th className="px-3 py-2">Dilaporkan Oleh</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {importedStudentRecords.slice(0, 50).map((rec, idx) => (
                            <tr key={idx} className="hover:bg-slate-800/40">
                              <td className="px-3 py-1.5 font-mono text-[10px] text-slate-400">{rec.id}</td>
                              <td className="px-3 py-1.5">{rec.hari}</td>
                              <td className="px-3 py-1.5">{rec.tanggal}</td>
                              <td className="px-3 py-1.5 font-bold text-indigo-400">{rec.kelas}</td>
                              <td className="px-3 py-1.5 font-medium text-white">{rec.namaGuru}</td>
                              <td className="px-3 py-1.5">{rec.mataPelajaran}</td>
                              <td className="px-3 py-1.5">{rec.jamKe}</td>
                              <td className="px-3 py-1.5">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  rec.keteranganKehadiran === "Hadir" ? "bg-emerald-500/20 text-emerald-300" :
                                  rec.keteranganKehadiran === "Izin" ? "bg-blue-500/20 text-blue-300" :
                                  rec.keteranganKehadiran === "Sakit" ? "bg-amber-500/20 text-amber-300" :
                                  "bg-rose-500/20 text-rose-300"
                                }`}>
                                  {rec.keteranganKehadiran}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 text-slate-400">{rec.submittedBy}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {importedStudentRecords.length > 50 && (
                        <div className="p-2 text-center text-[10px] text-slate-400 bg-slate-800/30">
                          + {importedStudentRecords.length - 50} baris lainnya...
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setImportedStudentRecords(null)}
                        className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white bg-slate-800 rounded-xl transition-all cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmStudentImport}
                        disabled={isProcessingStudentImport}
                        className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        {isProcessingStudentImport ? "Memproses Import..." : `Simpan ${importedStudentRecords.length} Data ke Sistem`}
                      </button>
                    </div>
                  </div>
                )}
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
                  <th className="py-4 px-6">Kelas</th>
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
                    <td colSpan={role === "BK" || role === "TATIB" || role === "UTAMA" || role === "TU" ? 9 : 8} className="py-8 text-center text-xs text-slate-400">
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
                      <td className="py-3 px-6">
                        {editingKelasId === item.id ? (
                          <select
                            value={editKelas}
                            onChange={(e) => setEditKelas(e.target.value)}
                            className="px-2 py-1.5 rounded border border-slate-200 text-xs w-full max-w-[100px] bg-white text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            {KELAS_LIST.map(k => (
                              <option key={k} value={k}>{k}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded font-bold text-xs">{item.kelas || "-"}</span>
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
                  <th className="py-4 px-6">Kelas</th>
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
                    <td colSpan={role === "BK" || role === "UTAMA" || role === "TU" ? 8 : 7} className="py-8 text-center text-xs text-slate-400">
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
                      <td className="py-3 px-6">
                        {editingIzinId === item.id ? (
                          <select
                            value={editKelas}
                            onChange={(e) => setEditKelas(e.target.value)}
                            className="px-2 py-1.5 rounded border border-slate-200 text-xs w-full max-w-[100px] bg-white text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            {KELAS_LIST.map(k => (
                              <option key={k} value={k}>{k}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded font-bold text-xs">{item.kelas || "-"}</span>
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
        )}
          </motion.div>
        </AnimatePresence>
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
    var requestData = {};
    if (e && e.postData && e.postData.contents) {
      try {
        requestData = JSON.parse(e.postData.contents);
      } catch (errP) {}
    }
    
    var action = requestData.action || (e && e.parameter ? e.parameter.action : null);
    var type = requestData.type || (e && e.parameter ? e.parameter.type : null);
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
    
    if (action === 'get_schedule' || action === 'get_all') {
      var sheetUtama = doc.getSheetByName("DATA_UTAMA");
      var namaGuruList = [];
      var mataPelajaranList = [];
      var jamKeList = [];
      var classAdmins = {};
      
      if (sheetUtama) {
        var values = sheetUtama.getDataRange().getValues();
        for (var r = 1; r < values.length; r++) {
          var row = values[r];
          if (row[2]) {
            var val = row[2].toString().trim();
            if (val && namaGuruList.indexOf(val) === -1) {
              namaGuruList.push(val);
            }
          }
          if (row[3]) {
            var val = row[3].toString().trim();
            if (val && mataPelajaranList.indexOf(val) === -1) {
              mataPelajaranList.push(val);
            }
          }
          if (row[4]) {
            var val = row[4].toString().trim();
            if (val && jamKeList.indexOf(val) === -1) {
              jamKeList.push(val);
            }
          }
          if (row[6]) {
            var username = row[6].toString().trim().toLowerCase();
            var password = row[7] ? row[7].toString().trim() : "adminkelas2026";
            if (username) {
              classAdmins[username] = password;
            }
          }
        }
      }

      var kelasData = [];
      var sheetKelas = doc.getSheetByName("DATA_INPUT_SISWA") || doc.getSheetByName("DATA_INPUT_KELAS");
      if (sheetKelas) {
        var valsS = sheetKelas.getDataRange().getValues();
        for (var s = 1; s < valsS.length; s++) {
          var rS = valsS[s];
          if (rS[4] || rS[1] || rS[3]) {
            kelasData.push({
              id: rS[0] ? rS[0].toString() : "gs_" + s,
              hari: rS[1] ? rS[1].toString() : "",
              tanggal: rS[2] ? rS[2].toString() : "",
              kelas: rS[3] ? rS[3].toString() : "",
              namaGuru: rS[4] ? rS[4].toString() : "",
              mataPelajaran: rS[5] ? rS[5].toString() : "",
              jamKe: rS[6] ? rS[6].toString() : "1",
              keteranganKehadiran: rS[7] ? rS[7].toString() : "Hadir",
              submittedBy: rS[8] ? rS[8].toString() : "Google Sheet",
              submittedAt: rS[9] ? rS[9].toString() : new Date().toISOString()
            });
          }
        }
      }

      var izinData = [];
      var sheetIzin = doc.getSheetByName("DATA_INPUT_IZIN_GURU");
      if (sheetIzin) {
        var valsI = sheetIzin.getDataRange().getValues();
        for (var z = 1; z < valsI.length; z++) {
          var rI = valsI[z];
          if (rI[4] || rI[1] || rI[3]) {
            izinData.push({
              id: rI[0] ? rI[0].toString() : "gsi_" + z,
              hari: rI[1] ? rI[1].toString() : "",
              tanggal: rI[2] ? rI[2].toString() : "",
              kelas: rI[3] ? rI[3].toString() : "",
              namaGuru: rI[4] ? rI[4].toString() : "",
              mataPelajaran: rI[5] ? rI[5].toString() : "",
              jamKe: rI[6] ? rI[6].toString() : "1",
              keteranganKehadiran: rI[7] ? rI[7].toString() : "Izin",
              keteranganIzinGuru: rI[8] ? rI[8].toString() : "-",
              submittedAt: rI[9] ? rI[9].toString() : new Date().toISOString()
            });
          }
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        namaGuruList: namaGuruList,
        mataPelajaranList: mataPelajaranList,
        jamKeList: jamKeList,
        classAdmins: classAdmins,
        kelasData: kelasData,
        izinData: izinData
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
      
      var kelasValues = [["ID", "Hari", "Tanggal", "Kelas", "Nama Guru", "Mata Pelajaran", "Jam Ke", "Keterangan Kehadiran", "Dilaporkan Oleh", "Waktu Input"]];
      for (var i = 0; i < kelasData.length; i++) {
        var item = kelasData[i];
        kelasValues.push([
          item.id ? item.id.toString() : "",
          item.hari ? item.hari.toString() : "",
          item.tanggal ? item.tanggal.toString() : "",
          item.kelas ? item.kelas.toString() : "",
          item.namaGuru ? item.namaGuru.toString() : "",
          item.mataPelajaran ? item.mataPelajaran.toString() : "",
          item.jamKe ? item.jamKe.toString() : "",
          item.keteranganKehadiran ? item.keteranganKehadiran.toString() : "",
          item.submittedBy ? item.submittedBy.toString() : "",
          item.submittedAt ? item.submittedAt.toString() : ""
        ]);
      }
      sheetKelas.getRange(1, 1, kelasValues.length, 10).setValues(kelasValues);
      
      // Update DATA_INPUT_IZIN_GURU sheet
      var sheetIzin = doc.getSheetByName("DATA_INPUT_IZIN_GURU");
      if (!sheetIzin) {
        sheetIzin = doc.insertSheet("DATA_INPUT_IZIN_GURU");
      }
      sheetIzin.clearContents();
      
      var izinValues = [["ID", "Hari", "Tanggal", "Kelas", "Nama Guru", "Mata Pelajaran", "Jam Ke", "Status Kehadiran", "Keterangan Alasan", "Waktu Input"]];
      for (var j = 0; j < izinData.length; j++) {
        var item = izinData[j];
        izinValues.push([
          item.id ? item.id.toString() : "",
          item.hari ? item.hari.toString() : "",
          item.tanggal ? item.tanggal.toString() : "",
          item.kelas ? item.kelas.toString() : "",
          item.namaGuru ? item.namaGuru.toString() : "",
          item.mataPelajaran ? item.mataPelajaran.toString() : "",
          item.jamKe ? item.jamKe.toString() : "",
          item.keteranganKehadiran ? item.keteranganKehadiran.toString() : "",
          item.keteranganIzinGuru ? item.keteranganIzinGuru.toString() : "",
          item.submittedAt ? item.submittedAt.toString() : ""
        ]);
      }
      sheetIzin.getRange(1, 1, izinValues.length, 10).setValues(izinValues);
      
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Sinkronisasi massal seluruh data berhasil!" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var sheetName = type === 'kelas' ? "DATA_INPUT_KELAS" : "DATA_INPUT_IZIN_GURU";
    var sheet = doc.getSheetByName(sheetName);
    if (!sheet) {
      sheet = doc.insertSheet(sheetName);
      if (type === 'kelas') {
        sheet.appendRow(["ID", "Hari", "Tanggal", "Kelas", "Nama Guru", "Mata Pelajaran", "Jam Ke", "Keterangan Kehadiran", "Dilaporkan Oleh", "Waktu Input"]);
      } else {
        sheet.appendRow(["ID", "Hari", "Tanggal", "Kelas", "Nama Guru", "Mata Pelajaran", "Jam Ke", "Status Kehadiran", "Keterangan Alasan", "Waktu Input"]);
      }
    }
    
    if (action === 'add') {
      if (type === 'kelas') {
        sheet.appendRow([payload.id, payload.hari, payload.tanggal, payload.kelas || "", payload.namaGuru, payload.mataPelajaran, payload.jamKe, payload.keteranganKehadiran, payload.submittedBy, payload.submittedAt]);
      } else {
        sheet.appendRow([payload.id, payload.hari, payload.tanggal, payload.kelas || "", payload.namaGuru, payload.mataPelajaran, payload.jamKe, payload.keteranganKehadiran, payload.keteranganIzinGuru, payload.submittedAt]);
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
            sheet.getRange(targetRow, 1, 1, 10).setValues([[payload.id, payload.hari, payload.tanggal, payload.kelas || "", payload.namaGuru, payload.mataPelajaran, payload.jamKe, payload.keteranganKehadiran, payload.submittedBy, payload.submittedAt]]);
          } else {
            sheet.getRange(targetRow, 1, 1, 10).setValues([[payload.id, payload.hari, payload.tanggal, payload.kelas || "", payload.namaGuru, payload.mataPelajaran, payload.jamKe, payload.keteranganKehadiran, payload.keteranganIzinGuru, payload.submittedAt]]);
          }
        }
      } else {
        if (action === 'edit') {
          if (type === 'kelas') {
            sheet.appendRow([payload.id, payload.hari, payload.tanggal, payload.kelas || "", payload.namaGuru, payload.mataPelajaran, payload.jamKe, payload.keteranganKehadiran, payload.submittedBy, payload.submittedAt]);
          } else {
            sheet.appendRow([payload.id, payload.hari, payload.tanggal, payload.kelas || "", payload.namaGuru, payload.mataPelajaran, payload.jamKe, payload.keteranganKehadiran, payload.keteranganIzinGuru, payload.submittedAt]);
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
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var doc = null;
    try {
      doc = SpreadsheetApp.getActiveSpreadsheet();
    } catch (err) {}
    
    if (!doc) {
      var SPREADSHEET_ID = ""; // Masukkan ID manual jika standalone
      if (SPREADSHEET_ID && SPREADSHEET_ID !== "") {
        doc = SpreadsheetApp.openById(SPREADSHEET_ID);
      }
    }
    
    if (!doc) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Spreadsheet tidak ditemukan!" })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var sheetUtama = doc.getSheetByName("DATA_UTAMA");
    var namaGuruList = [];
    var mataPelajaranList = [];
    var jamKeList = [];
    var classAdmins = {};
    
    if (sheetUtama) {
      var values = sheetUtama.getDataRange().getValues();
      for (var r = 1; r < values.length; r++) {
        var row = values[r];
        if (row[2]) {
          var val = row[2].toString().trim();
          if (val && namaGuruList.indexOf(val) === -1) { namaGuruList.push(val); }
        }
        if (row[3]) {
          var val = row[3].toString().trim();
          if (val && mataPelajaranList.indexOf(val) === -1) { mataPelajaranList.push(val); }
        }
        if (row[4]) {
          var val = row[4].toString().trim();
          if (val && jamKeList.indexOf(val) === -1) { jamKeList.push(val); }
        }
        if (row[6]) {
          var username = row[6].toString().trim().toLowerCase();
          var password = row[7] ? row[7].toString().trim() : "adminkelas2026";
          if (username) { classAdmins[username] = password; }
        }
      }
    }

    var kelasData = [];
    var sheetKelas = doc.getSheetByName("DATA_INPUT_SISWA") || doc.getSheetByName("DATA_INPUT_KELAS");
    if (sheetKelas) {
      var valsS = sheetKelas.getDataRange().getValues();
      for (var s = 1; s < valsS.length; s++) {
        var rS = valsS[s];
        if (rS[4] || rS[1] || rS[3]) {
          kelasData.push({
            id: rS[0] ? rS[0].toString() : "gs_" + s,
            hari: rS[1] ? rS[1].toString() : "",
            tanggal: rS[2] ? rS[2].toString() : "",
            kelas: rS[3] ? rS[3].toString() : "",
            namaGuru: rS[4] ? rS[4].toString() : "",
            mataPelajaran: rS[5] ? rS[5].toString() : "",
            jamKe: rS[6] ? rS[6].toString() : "1",
            keteranganKehadiran: rS[7] ? rS[7].toString() : "Hadir",
            submittedBy: rS[8] ? rS[8].toString() : "Google Sheet",
            submittedAt: rS[9] ? rS[9].toString() : new Date().toISOString()
          });
        }
      }
    }

    var izinData = [];
    var sheetIzin = doc.getSheetByName("DATA_INPUT_IZIN_GURU");
    if (sheetIzin) {
      var valsI = sheetIzin.getDataRange().getValues();
      for (var z = 1; z < valsI.length; z++) {
        var rI = valsI[z];
        if (rI[4] || rI[1] || rI[3]) {
          izinData.push({
            id: rI[0] ? rI[0].toString() : "gsi_" + z,
            hari: rI[1] ? rI[1].toString() : "",
            tanggal: rI[2] ? rI[2].toString() : "",
            kelas: rI[3] ? rI[3].toString() : "",
            namaGuru: rI[4] ? rI[4].toString() : "",
            mataPelajaran: rI[5] ? rI[5].toString() : "",
            jamKe: rI[6] ? rI[6].toString() : "1",
            keteranganKehadiran: rI[7] ? rI[7].toString() : "Izin",
            keteranganIzinGuru: rI[8] ? rI[8].toString() : "-",
            submittedAt: rI[9] ? rI[9].toString() : new Date().toISOString()
          });
        }
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      namaGuruList: namaGuruList,
      mataPelajaranList: mataPelajaranList,
      jamKeList: jamKeList,
      classAdmins: classAdmins,
      kelasData: kelasData,
      izinData: izinData
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}`;
