/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from "react";
import { StudentSubmission, ScheduleData, KELAS_LIST } from "../types";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, ReferenceLine
} from "recharts";
import {
  Award, AlertTriangle, CheckCircle2, TrendingUp, Search, Filter, Download,
  UserCheck, UserX, Clock, ChevronDown, ChevronUp, BookOpen, Layers, BarChart2, PieChartIcon, Calendar
} from "lucide-react";

interface TeacherPerformancePanelProps {
  submissionsKelas: StudentSubmission[];
  scheduleData: ScheduleData;
  activeTheme: {
    accentText: string;
    accentBg: string;
    buttonPrimary: string;
    borderActive: string;
    lightBadge: string;
    gradientHeader: string;
    ringColor: string;
    focusBorder: string;
    barColor: string;
    hoverBorder: string;
  };
  currentThemeKey: "INDIGO" | "EMERALD" | "TEAL" | "CHARCOAL";
}

export interface TeacherStat {
  namaGuru: string;
  mataPelajaranList: string[];
  kelasList: string[];
  totalJam: number;
  hadir: number;
  izin: number;
  sakit: number;
  alpa: number;
  persentaseHadir: number;
  persentaseIzinSakit: number;
  persentaseAlpa: number;
  predikat: "Sangat Baik" | "Baik" | "Cukup" | "Perlu Evaluasi" | "Belum Ada Data";
  recentLogs: StudentSubmission[];
}

export default function TeacherPerformancePanel({
  submissionsKelas,
  scheduleData,
  activeTheme,
  currentThemeKey
}: TeacherPerformancePanelProps) {
  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [filterKelas, setFilterKelas] = useState("SEMUA");
  const [filterHari, setFilterHari] = useState("SEMUA");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortBy, setSortBy] = useState<"HADIR_DESC" | "HADIR_ASC" | "ALPA_DESC" | "JAM_DESC" | "NAMA_ASC">("HADIR_DESC");
  
  // View Toggle: Table vs Chart
  const [activeChartType, setActiveChartType] = useState<"BAR" | "PIE">("BAR");
  
  // Expanded Teacher Detail Row
  const [expandedTeacher, setExpandedTeacher] = useState<string | null>(null);

  // Quick Date Range Preset
  const handlePresetDays = (days: number) => {
    if (days === 0) {
      setStartDate("");
      setEndDate("");
      return;
    }
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
  };

  // Filter raw submissions first
  const filteredSubmissions = useMemo(() => {
    return submissionsKelas.filter(item => {
      // Kelas Filter
      if (filterKelas !== "SEMUA" && item.kelas !== filterKelas) return false;
      // Hari Filter
      if (filterHari !== "SEMUA" && item.hari !== filterHari) return false;
      // Date Range Filter
      if (startDate && item.tanggal && item.tanggal < startDate) return false;
      if (endDate && item.tanggal && item.tanggal > endDate) return false;
      return true;
    });
  }, [submissionsKelas, filterKelas, filterHari, startDate, endDate]);

  // Calculate teacher stats based on filtered submissions
  const teacherStatsList = useMemo(() => {
    // Collect all master teacher names
    const teacherMap = new Map<string, {
      namaGuru: string;
      mapelSet: Set<string>;
      kelasSet: Set<string>;
      totalJam: number;
      hadir: number;
      izin: number;
      sakit: number;
      alpa: number;
      recentLogs: StudentSubmission[];
    }>();

    // Initialize with schedule teacher master list
    scheduleData.namaGuruList.forEach(nama => {
      teacherMap.set(nama.trim(), {
        namaGuru: nama.trim(),
        mapelSet: new Set<string>(),
        kelasSet: new Set<string>(),
        totalJam: 0,
        hadir: 0,
        izin: 0,
        sakit: 0,
        alpa: 0,
        recentLogs: []
      });
    });

    // Populate with filtered submissions
    filteredSubmissions.forEach(sub => {
      const gName = sub.namaGuru.trim();
      if (!teacherMap.has(gName)) {
        teacherMap.set(gName, {
          namaGuru: gName,
          mapelSet: new Set<string>(),
          kelasSet: new Set<string>(),
          totalJam: 0,
          hadir: 0,
          izin: 0,
          sakit: 0,
          alpa: 0,
          recentLogs: []
        });
      }

      const record = teacherMap.get(gName)!;
      if (sub.mataPelajaran) record.mapelSet.add(sub.mataPelajaran);
      if (sub.kelas) record.kelasSet.add(sub.kelas);
      
      record.totalJam += 1;
      record.recentLogs.push(sub);

      const ket = (sub.keteranganKehadiran || "").toUpperCase();
      if (ket === "HADIR") record.hadir += 1;
      else if (ket === "IZIN") record.izin += 1;
      else if (ket === "SAKIT") record.sakit += 1;
      else if (ket === "TANPA KETERANGAN" || ket === "ALPA") record.alpa += 1;
      else record.hadir += 1; // Default
    });

    // Convert map to array and compute percentages & ratings
    const result: TeacherStat[] = Array.from(teacherMap.values()).map(rec => {
      const total = rec.totalJam;
      const persentaseHadir = total > 0 ? parseFloat(((rec.hadir / total) * 100).toFixed(1)) : 0;
      const persentaseIzinSakit = total > 0 ? parseFloat((((rec.izin + rec.sakit) / total) * 100).toFixed(1)) : 0;
      const persentaseAlpa = total > 0 ? parseFloat(((rec.alpa / total) * 100).toFixed(1)) : 0;

      let predikat: TeacherStat["predikat"] = "Belum Ada Data";
      if (total === 0) {
        predikat = "Belum Ada Data";
      } else if (persentaseHadir >= 90) {
        predikat = "Sangat Baik";
      } else if (persentaseHadir >= 80) {
        predikat = "Baik";
      } else if (persentaseHadir >= 70) {
        predikat = "Cukup";
      } else {
        predikat = "Perlu Evaluasi";
      }

      // Sort recent logs descending by time
      rec.recentLogs.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

      return {
        namaGuru: rec.namaGuru,
        mataPelajaranList: Array.from(rec.mapelSet),
        kelasList: Array.from(rec.kelasSet),
        totalJam: total,
        hadir: rec.hadir,
        izin: rec.izin,
        sakit: rec.sakit,
        alpa: rec.alpa,
        persentaseHadir,
        persentaseIzinSakit,
        persentaseAlpa,
        predikat,
        recentLogs: rec.recentLogs
      };
    });

    // Filter by Search Term
    return result.filter(item => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const matchName = item.namaGuru.toLowerCase().includes(term);
      const matchMapel = item.mataPelajaranList.some(m => m.toLowerCase().includes(term));
      const matchKelas = item.kelasList.some(k => k.toLowerCase().includes(term));
      return matchName || matchMapel || matchKelas;
    });
  }, [scheduleData.namaGuruList, filteredSubmissions, searchTerm]);

  // Sort teacher stats
  const sortedTeacherStats = useMemo(() => {
    const list = [...teacherStatsList];
    list.sort((a, b) => {
      // Put teachers with no data at the end when sorting by percentage
      if (a.totalJam === 0 && b.totalJam > 0) return 1;
      if (b.totalJam === 0 && a.totalJam > 0) return -1;

      if (sortBy === "HADIR_DESC") return b.persentaseHadir - a.persentaseHadir || b.totalJam - a.totalJam;
      if (sortBy === "HADIR_ASC") return a.persentaseHadir - b.persentaseHadir || a.totalJam - b.totalJam;
      if (sortBy === "ALPA_DESC") return b.alpa - a.alpa || a.persentaseHadir - b.persentaseHadir;
      if (sortBy === "JAM_DESC") return b.totalJam - a.totalJam || b.persentaseHadir - a.persentaseHadir;
      if (sortBy === "NAMA_ASC") return a.namaGuru.localeCompare(b.namaGuru);
      return 0;
    });
    return list;
  }, [teacherStatsList, sortBy]);

  // Overall KPIs
  const overallKPIs = useMemo(() => {
    const activeTeachers = teacherStatsList.filter(t => t.totalJam > 0);
    const totalSessions = activeTeachers.reduce((acc, t) => acc + t.totalJam, 0);
    const totalHadirSessions = activeTeachers.reduce((acc, t) => acc + t.hadir, 0);
    const overallRate = totalSessions > 0 ? Math.round((totalHadirSessions / totalSessions) * 100) : 0;

    const countSangatBaik = activeTeachers.filter(t => t.predikat === "Sangat Baik").length;
    const countBaik = activeTeachers.filter(t => t.predikat === "Baik").length;
    const countCukup = activeTeachers.filter(t => t.predikat === "Cukup").length;
    const countEvaluasi = activeTeachers.filter(t => t.predikat === "Perlu Evaluasi").length;

    return {
      totalActiveTeachers: activeTeachers.length,
      totalMasterTeachers: scheduleData.namaGuruList.length,
      totalSessions,
      overallRate,
      countSangatBaik,
      countBaik,
      countCukup,
      countEvaluasi
    };
  }, [teacherStatsList, scheduleData.namaGuruList]);

  // Prepare Recharts Data
  const chartBarData = useMemo(() => {
    return sortedTeacherStats
      .filter(t => t.totalJam > 0)
      .slice(0, 15) // Top 15 for readable bar chart
      .map(t => {
        // Shorten teacher name for chart X-Axis
        const shortName = t.namaGuru.split(",")[0].replace(/(S\.Pd|M\.Pd|S\.Ag|S\.T|M\.T|S\.Kom)/gi, "").trim();
        return {
          fullName: t.namaGuru,
          name: shortName.length > 14 ? shortName.slice(0, 12) + ".." : shortName,
          "Persentase Hadir (%)": t.persentaseHadir,
          "Jam Hadir": t.hadir,
          "Jam Alpa": t.alpa,
          "Total Jam": t.totalJam
        };
      });
  }, [sortedTeacherStats]);

  const chartPieData = useMemo(() => {
    return [
      { name: "Sangat Baik (≥90%)", value: overallKPIs.countSangatBaik, color: "#10b981" },
      { name: "Baik (80-89%)", value: overallKPIs.countBaik, color: "#3b82f6" },
      { name: "Cukup (70-79%)", value: overallKPIs.countCukup, color: "#f59e0b" },
      { name: "Perlu Evaluasi (<70%)", value: overallKPIs.countEvaluasi, color: "#ef4444" }
    ].filter(d => d.value > 0);
  }, [overallKPIs]);

  // Export CSV Handler
  const handleExportCSV = () => {
    if (teacherStatsList.length === 0) {
      alert("Tidak ada data performa untuk diekspor.");
      return;
    }

    const headers = [
      "No",
      "Nama Guru",
      "Mata Pelajaran Terdata",
      "Kelas Mengajar",
      "Total Jam Terlapor",
      "Hadir (Jam)",
      "Izin (Jam)",
      "Sakit (Jam)",
      "Tanpa Keterangan / Alpa (Jam)",
      "Persentase Kehadiran (%)",
      "Predikat Disiplin"
    ];

    const rows = sortedTeacherStats.map((t, idx) => [
      idx + 1,
      t.namaGuru,
      t.mataPelajaranList.join("; ") || "-",
      t.kelasList.join("; ") || "-",
      t.totalJam,
      t.hadir,
      t.izin,
      t.sakit,
      t.alpa,
      `${t.persentaseHadir}%`,
      t.predikat
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Performa_Kehadiran_Guru_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 p-4 md:p-6" id="teacher-performance-panel">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border border-emerald-500/30">
              Analisis Presensi Siswa
            </span>
            <span className="text-slate-400 text-xs">• Laporan Kehadiran Mengajar Guru</span>
          </div>
          <h2 className="text-xl md:text-2xl font-black text-white">
            Performa Kehadiran Guru di Kelas
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Statistik dan akumulasi proses persentase kehadiran guru di dalam kelas berdasarkan data absensi riil yang dilaporkan oleh perwakilan siswa (Admin Kelas) di setiap jam pelajaran.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCSV}
          id="btn-export-performa-csv"
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-sm shrink-0 cursor-pointer"
        >
          <Download className="w-4 h-4" /> Ekspor Rekap Performa (CSV)
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Rata-Rata Kehadiran */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Rata-Rata Kehadiran Guru</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-600">{overallKPIs.overallRate}%</span>
              <span className="text-[10px] text-slate-400 font-semibold">({overallKPIs.totalSessions} jam terlapor)</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Dari {overallKPIs.totalActiveTeachers} guru terpantau di kelas
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 2: Sangat Disiplin */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Sangat Baik (≥ 90%)</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-800">{overallKPIs.countSangatBaik}</span>
              <span className="text-xs text-emerald-600 font-bold">
                Guru ({overallKPIs.totalActiveTeachers > 0 ? Math.round((overallKPIs.countSangatBaik / overallKPIs.totalActiveTeachers) * 100) : 0}%)
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Kehadiran mengajar prima</p>
          </div>
          <div className="p-3 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100">
            <Award className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 3: Cukup & Baik */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Baik & Cukup (70-89%)</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-800">{overallKPIs.countBaik + overallKPIs.countCukup}</span>
              <span className="text-xs text-amber-600 font-bold">Guru</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Memerlukan pemantauan rutin</p>
          </div>
          <div className="p-3 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 4: Perlu Evaluasi */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Perlu Evaluasi (&lt; 70%)</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-rose-600">{overallKPIs.countEvaluasi}</span>
              <span className="text-xs text-rose-600 font-bold">Guru</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Tingkat ketidakhadiran tinggi</p>
          </div>
          <div className="p-3 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Visual Chart Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-emerald-600" />
              Grafik Visualisasi Performa Kehadiran Guru
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Grafik persentase kehadiran guru dihitung dari total laporan jam mengajar siswa.
            </p>
          </div>

          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl text-xs shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveChartType("BAR")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                activeChartType === "BAR"
                  ? "bg-white text-slate-800 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" /> Bar Persentase
            </button>
            <button
              type="button"
              onClick={() => setActiveChartType("PIE")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                activeChartType === "PIE"
                  ? "bg-white text-slate-800 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <PieChartIcon className="w-3.5 h-3.5" /> Distribusi Disiplin
            </button>
          </div>
        </div>

        {activeChartType === "BAR" ? (
          <div className="h-72 w-full pt-2">
            {chartBarData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                Belum ada data kehadiran guru untuk ditampilkan pada grafik.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartBarData} margin={{ top: 10, right: 20, left: -10, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="name"
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    fontSize={10}
                    stroke="#64748b"
                  />
                  <YAxis domain={[0, 100]} unit="%" fontSize={10} stroke="#64748b" />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-xl text-xs space-y-1 shadow-lg border border-slate-700">
                            <p className="font-bold text-emerald-400 border-b border-slate-800 pb-1 mb-1">{data.fullName}</p>
                            <p className="flex justify-between gap-4">
                              <span>Persentase Hadir:</span>
                              <strong className="text-emerald-400">{data["Persentase Hadir (%)"]}%</strong>
                            </p>
                            <p className="flex justify-between gap-4">
                              <span>Jam Hadir / Total:</span>
                              <strong>{data["Jam Hadir"]} / {data["Total Jam"]} Jam</strong>
                            </p>
                            {data["Jam Alpa"] > 0 && (
                              <p className="flex justify-between gap-4 text-rose-400">
                                <span>Tanpa Keterangan:</span>
                                <strong>{data["Jam Alpa"]} Jam</strong>
                              </p>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine y={80} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Target 80%', fill: '#f59e0b', fontSize: 10, position: 'insideTopRight' }} />
                  <ReferenceLine y={90} stroke="#10b981" strokeDasharray="4 4" label={{ value: 'Target 90%', fill: '#10b981', fontSize: 10, position: 'insideTopRight' }} />
                  <Bar
                    dataKey="Persentase Hadir (%)"
                    fill={activeTheme.barColor || "#10b981"}
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        ) : (
          <div className="h-72 w-full flex flex-col md:flex-row items-center justify-center gap-8 pt-2">
            {chartPieData.length === 0 ? (
              <div className="text-slate-400 text-xs italic">Belum ada data distribusi disiplin.</div>
            ) : (
              <>
                <div className="w-full md:w-1/2 h-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {chartPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} Guru`, "Jumlah Guru"]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black text-slate-800">{overallKPIs.totalActiveTeachers}</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Guru Terdata</span>
                  </div>
                </div>

                <div className="w-full md:w-1/2 space-y-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2">Rincian Kategori Predikat</h4>
                  {chartPieData.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                        <span className="font-semibold text-slate-700">{item.name}</span>
                      </div>
                      <span className="font-black text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {item.value} Guru
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <Filter className="w-4 h-4 text-emerald-600" />
          <span>Filter & Pencarian Data Performa Guru</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Name/Mapel */}
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama guru / mata pelajaran..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {/* Filter Kelas */}
          <div>
            <select
              value={filterKelas}
              onChange={(e) => setFilterKelas(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-semibold"
            >
              <option value="SEMUA">Semua Kelas</option>
              {KELAS_LIST.map(k => (
                <option key={k} value={k}>Kelas {k}</option>
              ))}
            </select>
          </div>

          {/* Filter Hari */}
          <div>
            <select
              value={filterHari}
              onChange={(e) => setFilterHari(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-semibold"
            >
              <option value="SEMUA">Semua Hari</option>
              <option value="Senin">Senin</option>
              <option value="Selasa">Selasa</option>
              <option value="Rabu">Rabu</option>
              <option value="Kamis">Kamis</option>
              <option value="Jum'at">Jum'at</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="HADIR_DESC">🏆 Persentase Tertinggi</option>
              <option value="HADIR_ASC">⚠️ Persentase Terendah</option>
              <option value="ALPA_DESC">🔴 Tanpa Keterangan Terbanyak</option>
              <option value="JAM_DESC">📚 Total Jam Terbanyak</option>
              <option value="NAMA_ASC">🔤 Nama Guru (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Date Range Preset Buttons */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100 text-xs">
          <span className="text-[11px] font-semibold text-slate-400">Rentang Waktu:</span>
          <button
            type="button"
            onClick={() => handlePresetDays(0)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
              !startDate && !endDate ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Semua Data
          </button>
          <button
            type="button"
            onClick={() => handlePresetDays(7)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
              startDate ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            7 Hari Terakhir
          </button>
          <button
            type="button"
            onClick={() => handlePresetDays(30)}
            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200"
          >
            30 Hari Terakhir
          </button>

          {(startDate || endDate) && (
            <span className="ml-auto text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Periode: {startDate || "Awal"} s/d {endDate || "Sekarang"}
            </span>
          )}
        </div>
      </div>

      {/* Main Performance Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 bg-slate-50/80 border-b border-slate-200/60 flex justify-between items-center flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              Tabel Akumulasi Performa Kehadiran Guru
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Menampilkan {sortedTeacherStats.length} guru hasil rekapitulasi presensi siswa
            </p>
          </div>

          <span className="text-[11px] font-bold text-slate-500 bg-white px-3 py-1 rounded-lg border border-slate-200">
            Diurutkan: <strong className="text-slate-800">{sortBy.replace("_DESC", " ↓").replace("_ASC", " ↑")}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" id="table-performa-guru">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-black uppercase text-slate-400 tracking-wider bg-slate-50/50">
                <th className="py-3.5 px-4 text-center w-12">#</th>
                <th className="py-3.5 px-4">Nama Guru &amp; Mata Pelajaran</th>
                <th className="py-3.5 px-4 text-center">Kelas Terdata</th>
                <th className="py-3.5 px-4 text-center">Total Jam</th>
                <th className="py-3.5 px-4 text-center">Hadir</th>
                <th className="py-3.5 px-4 text-center">Izin / Sakit</th>
                <th className="py-3.5 px-4 text-center">Alpa</th>
                <th className="py-3.5 px-4 min-w-[180px]">Persentase Kehadiran</th>
                <th className="py-3.5 px-4 text-center">Predikat</th>
                <th className="py-3.5 px-4 text-center w-16">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {sortedTeacherStats.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 text-xs italic">
                    Tidak ditemukan data guru yang sesuai dengan kriteria pencarian/filter.
                  </td>
                </tr>
              ) : (
                sortedTeacherStats.map((item, index) => {
                  const isExpanded = expandedTeacher === item.namaGuru;
                  const isTop3 = index < 3 && item.totalJam > 0 && item.persentaseHadir >= 90;

                  return (
                    <tr key={item.namaGuru} className={`hover:bg-slate-50/80 transition-colors ${isExpanded ? 'bg-slate-50' : ''}`}>
                      {/* Rank */}
                      <td className="py-3.5 px-4 text-center font-bold text-slate-400">
                        {isTop3 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-800 text-[11px] font-black border border-amber-200">
                            {index + 1}
                          </span>
                        ) : (
                          index + 1
                        )}
                      </td>

                      {/* Nama Guru & Mapel */}
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                          <span>{item.namaGuru}</span>
                          {isTop3 && <span className="text-amber-500 text-xs" title="Top Performa">🌟</span>}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium line-clamp-1 mt-0.5">
                          {item.mataPelajaranList.length > 0 ? item.mataPelajaranList.join(", ") : "Mata pelajaran belum terdata"}
                        </div>
                      </td>

                      {/* Kelas */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-wrap gap-1 justify-center max-w-[140px] mx-auto">
                          {item.kelasList.length > 0 ? (
                            item.kelasList.slice(0, 3).map((k, i) => (
                              <span key={i} className="text-[9px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200/60">
                                {k}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-slate-300">-</span>
                          )}
                          {item.kelasList.length > 3 && (
                            <span className="text-[9px] font-bold text-slate-400">+{item.kelasList.length - 3}</span>
                          )}
                        </div>
                      </td>

                      {/* Total Jam */}
                      <td className="py-3.5 px-4 text-center font-black text-slate-800">
                        {item.totalJam} <span className="text-[9px] font-normal text-slate-400">jam</span>
                      </td>

                      {/* Hadir */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 text-xs">
                          {item.hadir}
                        </span>
                      </td>

                      {/* Izin/Sakit */}
                      <td className="py-3.5 px-4 text-center font-semibold text-slate-600">
                        {item.izin + item.sakit > 0 ? (
                          <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100 text-xs">
                            {item.izin + item.sakit}
                          </span>
                        ) : (
                          <span className="text-slate-300">0</span>
                        )}
                      </td>

                      {/* Alpa */}
                      <td className="py-3.5 px-4 text-center font-semibold text-slate-600">
                        {item.alpa > 0 ? (
                          <span className="text-rose-700 font-extrabold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 text-xs animate-pulse">
                            {item.alpa}
                          </span>
                        ) : (
                          <span className="text-slate-300">0</span>
                        )}
                      </td>

                      {/* Visual Progress Bar & % */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[11px] font-black">
                            <span className={`${
                              item.persentaseHadir >= 90 ? "text-emerald-600" :
                              item.persentaseHadir >= 80 ? "text-blue-600" :
                              item.persentaseHadir >= 70 ? "text-amber-600" :
                              item.totalJam === 0 ? "text-slate-400" : "text-rose-600"
                            }`}>
                              {item.persentaseHadir}%
                            </span>
                            <span className="text-[9px] text-slate-400 font-normal">
                              ({item.hadir}/{item.totalJam} Jam)
                            </span>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/50">
                            <div
                              className={`h-full transition-all duration-500 ${
                                item.persentaseHadir >= 90 ? "bg-emerald-500" :
                                item.persentaseHadir >= 80 ? "bg-blue-500" :
                                item.persentaseHadir >= 70 ? "bg-amber-500" :
                                item.totalJam === 0 ? "bg-slate-200" : "bg-rose-500"
                              }`}
                              style={{ width: `${Math.min(100, item.persentaseHadir)}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>

                      {/* Predikat */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border inline-block ${
                          item.predikat === "Sangat Baik"
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : item.predikat === "Baik"
                            ? "bg-blue-50 text-blue-800 border-blue-200"
                            : item.predikat === "Cukup"
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : item.predikat === "Perlu Evaluasi"
                            ? "bg-rose-50 text-rose-800 border-rose-200"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        }`}>
                          {item.predikat}
                        </span>
                      </td>

                      {/* Expand Toggle */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setExpandedTeacher(isExpanded ? null : item.namaGuru)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-all cursor-pointer"
                          title="Lihat Rincian Laporan Class Input"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-emerald-600" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Expanded Row Detail Drawer */}
        {expandedTeacher && (() => {
          const stat = sortedTeacherStats.find(t => t.namaGuru === expandedTeacher);
          if (!stat) return null;

          return (
            <div className="bg-slate-900 text-slate-200 p-5 border-t border-slate-800 animate-fadeIn space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold text-white">
                    Riwayat Laporan Siswa untuk Guru: <span className="text-emerald-400 font-black">{stat.namaGuru}</span>
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setExpandedTeacher(null)}
                  className="text-[10px] text-slate-400 hover:text-white bg-slate-800 px-2 py-1 rounded"
                >
                  Tutup Rincian ✕
                </button>
              </div>

              {stat.recentLogs.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Belum ada catatan absensi siswa untuk guru ini.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto pr-1">
                  {stat.recentLogs.map((log) => (
                    <div key={log.id} className="bg-slate-800 p-3 rounded-xl border border-slate-700/60 space-y-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-blue-400 bg-blue-900/40 px-1.5 py-0.5 rounded text-[10px]">
                          Kelas {log.kelas}
                        </span>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                          log.keteranganKehadiran === "HADIR"
                            ? "bg-emerald-900/60 text-emerald-300 border border-emerald-700/50"
                            : log.keteranganKehadiran === "IZIN"
                            ? "bg-amber-900/60 text-amber-300 border border-amber-700/50"
                            : "bg-rose-900/60 text-rose-300 border border-rose-700/50"
                        }`}>
                          {log.keteranganKehadiran}
                        </span>
                      </div>
                      <div className="font-semibold text-white text-[11px]">{log.mataPelajaran}</div>
                      <div className="text-[10px] text-slate-400 flex justify-between">
                        <span>{log.hari}, {log.tanggal} (Jam {log.jamKe})</span>
                        <span>Pelapor: {log.submittedBy}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
