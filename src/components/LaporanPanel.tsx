/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from "react";
import { StudentSubmission, TeacherLeaveSubmission } from "../types";
import {
  FileSpreadsheet,
  FileText,
  Calendar,
  Settings,
  Download,
  AlertCircle,
  FileBox,
  CheckCircle,
  Clock,
  Layers
} from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface LaporanPanelProps {
  submissionsKelas: StudentSubmission[];
  submissionsIzin: TeacherLeaveSubmission[];
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

export default function LaporanPanel({
  submissionsKelas,
  submissionsIzin,
  activeTheme,
  currentThemeKey
}: LaporanPanelProps) {
  // Report selection states
  const [reportType, setReportType] = useState<"KELAS" | "IZIN" | "SEMUA">("KELAS");
  
  // Date range state (default: 30 days ago to today)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Settings
  const [paperSize, setPaperSize] = useState<"A4" | "F4">("A4");
  const [orientation, setOrientation] = useState<"PORTRAIT" | "LANDSCAPE">("PORTRAIT");
  const [fileFormat, setFileFormat] = useState<"EXCEL" | "PDF">("PDF");

  const themeColors = {
    EMERALD: [16, 185, 129] as [number, number, number],
    TEAL: [13, 148, 136] as [number, number, number],
    INDIGO: [99, 102, 241] as [number, number, number],
    CHARCOAL: [71, 85, 105] as [number, number, number]
  };

  const selectedThemeColorRGB = themeColors[currentThemeKey] || [16, 185, 129];

  // Quick select presets
  const handlePreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
  };

  const handleThisMonth = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(now.toISOString().split("T")[0]);
  };

  // Filtered data based on period
  const filteredKelas = useMemo(() => {
    return submissionsKelas.filter((item) => {
      if (!item.tanggal) return false;
      return item.tanggal >= startDate && item.tanggal <= endDate;
    });
  }, [submissionsKelas, startDate, endDate]);

  const filteredIzin = useMemo(() => {
    return submissionsIzin.filter((item) => {
      if (!item.tanggal) return false;
      return item.tanggal >= startDate && item.tanggal <= endDate;
    });
  }, [submissionsIzin, startDate, endDate]);

  // Statistics
  const totalRecords = filteredKelas.length + filteredIzin.length;

  const countKelasStats = useMemo(() => {
    let hadir = 0;
    let izin = 0;
    let sakit = 0;
    let alpa = 0;
    filteredKelas.forEach((item) => {
      if (item.keteranganKehadiran === "HADIR") hadir++;
      else if (item.keteranganKehadiran === "IZIN") izin++;
      else if (item.keteranganKehadiran === "SAKIT") sakit++;
      else if (item.keteranganKehadiran === "TANPA KETERANGAN") alpa++;
    });
    return { hadir, izin, sakit, alpa };
  }, [filteredKelas]);

  const countIzinStats = useMemo(() => {
    let izin = 0;
    let sakit = 0;
    filteredIzin.forEach((item) => {
      if (item.keteranganKehadiran === "IZIN") izin++;
      else if (item.keteranganKehadiran === "SAKIT") sakit++;
    });
    return { izin, sakit };
  }, [filteredIzin]);

  // Handle Download Excel
  const handleDownloadExcel = () => {
    const wb = XLSX.utils.book_new();

    if (reportType === "KELAS" || reportType === "SEMUA") {
      if (filteredKelas.length === 0) {
        if (reportType === "KELAS") {
          alert("Tidak ada data INPUT KELAS (Siswa) pada periode ini.");
          return;
        }
      } else {
        const formattedKelas = filteredKelas.map((item, idx) => ({
          "No": idx + 1,
          "Hari": item.hari,
          "Tanggal": item.tanggal,
          "Kelas": item.kelas || "-",
          "Nama Guru": item.namaGuru,
          "Mata Pelajaran": item.mataPelajaran,
          "Jam Ke": item.jamKe,
          "Keterangan Kehadiran": item.keteranganKehadiran,
          "Dilaporkan Oleh": item.submittedBy,
          "Waktu Input": item.submittedAt ? new Date(item.submittedAt).toLocaleString("id-ID") : "-"
        }));
        const wsKelas = XLSX.utils.json_to_sheet(formattedKelas);
        XLSX.utils.book_append_sheet(wb, wsKelas, "Hasil Input Kelas");
      }
    }

    if (reportType === "IZIN" || reportType === "SEMUA") {
      if (filteredIzin.length === 0) {
        if (reportType === "IZIN") {
          alert("Tidak ada data INPUT IZIN (Guru) pada periode ini.");
          return;
        }
      } else {
        const formattedIzin = filteredIzin.map((item, idx) => ({
          "No": idx + 1,
          "Hari": item.hari,
          "Tanggal": item.tanggal,
          "Kelas": item.kelas || "-",
          "Nama Guru": item.namaGuru,
          "Mata Pelajaran": item.mataPelajaran,
          "Jam Ke": item.jamKe,
          "Izin / Sakit": item.keteranganKehadiran,
          "Alasan Izin": item.keteranganIzinGuru,
          "Waktu Input": item.submittedAt ? new Date(item.submittedAt).toLocaleString("id-ID") : "-"
        }));
        const wsIzin = XLSX.utils.json_to_sheet(formattedIzin);
        XLSX.utils.book_append_sheet(wb, wsIzin, "Hasil Input Izin");
      }
    }

    const titlePrefix = reportType === "KELAS" ? "Kelas" : reportType === "IZIN" ? "Izin" : "Gabungan";
    XLSX.writeFile(wb, `Laporan_SAPA_Guru_${titlePrefix}_${startDate}_sd_${endDate}.xlsx`);
  };

  // Handle Download PDF
  const handleDownloadPDF = () => {
    // PDF orientation
    const pdfOrientation = orientation.toLowerCase() as "portrait" | "landscape";
    
    // Page sizes in mm (F4 standard size: 215.9 x 330.2 mm)
    // A4 is standard 'a4' string or [210, 297]
    const size = paperSize === "A4" 
      ? "a4" 
      : (orientation === "LANDSCAPE" ? [330.2, 215.9] : [215.9, 330.2]);

    const doc = new jsPDF({
      orientation: pdfOrientation,
      unit: "mm",
      format: size
    });

    const primaryColorRGB = selectedThemeColorRGB;

    // Header Helper
    const drawHeader = (title: string, subTitle: string) => {
      // Background Accent bar
      doc.setFillColor(primaryColorRGB[0], primaryColorRGB[1], primaryColorRGB[2]);
      doc.rect(10, 10, doc.internal.pageSize.getWidth() - 20, 6, "F");

      // App Title
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(33, 41, 54); // Slate 800
      doc.text("SAPA GURU", 12, 24);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139); // Slate 500
      doc.text("Sistem Absensi & Pelaporan Akuntabel Guru", 12, 29);

      // Report Specific title
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(33, 41, 54);
      doc.text(title, doc.internal.pageSize.getWidth() - 12, 24, { align: "right" });

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(subTitle, doc.internal.pageSize.getWidth() - 12, 29, { align: "right" });

      // Decorative divider line
      doc.setDrawColor(226, 232, 240); // Slate 200
      doc.setLineWidth(0.5);
      doc.line(10, 34, doc.internal.pageSize.getWidth() - 10, 34);

      // Report Period & Info metadata block
      doc.setFillColor(248, 250, 252); // Slate 50
      doc.rect(10, 38, doc.internal.pageSize.getWidth() - 20, 16, "F");
      
      doc.setDrawColor(241, 245, 249); // Slate 100
      doc.rect(10, 38, doc.internal.pageSize.getWidth() - 20, 16, "D");

      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105); // Slate 600
      doc.setFont("Helvetica", "bold");
      doc.text("INFORMASI LAPORAN:", 14, 44);
      
      doc.setFont("Helvetica", "normal");
      doc.text(`Periode Laporan :  ${startDate} s.d. ${endDate}`, 14, 49);
      
      const width = doc.internal.pageSize.getWidth();
      doc.setFont("Helvetica", "bold");
      doc.text("PROPERTI CETAK:", width - 90, 44);
      doc.setFont("Helvetica", "normal");
      doc.text(`Kertas / Orientasi : ${paperSize} (${orientation})`, width - 90, 49);
      
      doc.setFont("Helvetica", "bold");
      doc.text("DICETAK PADA:", width - 45, 44);
      doc.setFont("Helvetica", "normal");
      doc.text(new Date().toLocaleDateString("id-ID"), width - 45, 49);
    };

    if (reportType === "KELAS" || reportType === "SEMUA") {
      if (filteredKelas.length === 0 && reportType === "KELAS") {
        alert("Tidak ada data INPUT KELAS (Siswa) pada periode ini.");
        return;
      }
      
      if (filteredKelas.length > 0) {
        drawHeader("LAPORAN HASIL DATA INPUT KELAS (SISWA)", "Merekam Kehadiran Mengajar Guru Di Setiap Kelas");

        // Format data
        const headers = ["No", "Hari / Tanggal", "Kelas", "Nama Guru", "Mata Pelajaran", "Jam Ke", "Status Kehadiran", "Pelapor"];
        const rows = filteredKelas.map((item, idx) => [
          idx + 1,
          `${item.hari}\n${item.tanggal}`,
          item.kelas || "-",
          item.namaGuru,
          item.mataPelajaran,
          `Jam Ke-${item.jamKe}`,
          item.keteranganKehadiran,
          item.submittedBy
        ]);

        autoTable(doc, {
          startY: 60,
          head: [headers],
          body: rows,
          styles: { fontSize: 8.5, cellPadding: 3, font: "Helvetica", textColor: [33, 41, 54] },
          headStyles: {
            fillColor: primaryColorRGB,
            textColor: [255, 255, 255],
            fontStyle: "bold",
            halign: "left"
          },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          margin: { left: 10, right: 10 },
          didParseCell: function (data) {
            if (data.section === 'body' && data.column.index === 6) {
              const val = data.cell.raw;
              if (val === "HADIR") {
                data.cell.styles.textColor = [16, 185, 129]; // Emerald
                data.cell.styles.fontStyle = "bold";
              } else if (val === "TANPA KETERANGAN") {
                data.cell.styles.textColor = [239, 68, 68]; // Rose
                data.cell.styles.fontStyle = "bold";
              } else if (val === "IZIN" || val === "SAKIT") {
                data.cell.styles.textColor = [245, 158, 11]; // Amber
                data.cell.styles.fontStyle = "bold";
              }
            }
          }
        });
      }
    }

    if (reportType === "SEMUA" && filteredKelas.length > 0 && filteredIzin.length > 0) {
      doc.addPage();
    }

    if (reportType === "IZIN" || reportType === "SEMUA") {
      if (filteredIzin.length === 0 && reportType === "IZIN") {
        alert("Tidak ada data INPUT IZIN (Guru) pada periode ini.");
        return;
      }

      if (filteredIzin.length > 0) {
        drawHeader("LAPORAN DATA INPUT IZIN MENGAJAR (GURU)", "Merekam Pengajuan Absensi Izin & Sakit Guru Resmi");

        // Format data
        const headers = ["No", "Hari / Tanggal", "Kelas", "Nama Guru", "Mata Pelajaran", "Jam Ke", "Status Izin", "Keterangan / Alasan Izin"];
        const rows = filteredIzin.map((item, idx) => [
          idx + 1,
          `${item.hari}\n${item.tanggal}`,
          item.kelas || "-",
          item.namaGuru,
          item.mataPelajaran,
          `Jam Ke-${item.jamKe}`,
          item.keteranganKehadiran,
          item.keteranganIzinGuru
        ]);

        autoTable(doc, {
          startY: 60,
          head: [headers],
          body: rows,
          styles: { fontSize: 8.5, cellPadding: 3, font: "Helvetica", textColor: [33, 41, 54] },
          headStyles: {
            fillColor: [217, 119, 6], // Amber accent color for teacher leaves
            textColor: [255, 255, 255],
            fontStyle: "bold",
            halign: "left"
          },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          margin: { left: 10, right: 10 },
          didParseCell: function (data) {
            if (data.section === 'body' && data.column.index === 6) {
              data.cell.styles.textColor = [217, 119, 6];
              data.cell.styles.fontStyle = "bold";
            }
          }
        });
      }
    }

    const titlePrefix = reportType === "KELAS" ? "Kelas" : reportType === "IZIN" ? "Izin" : "Gabungan";
    doc.save(`Laporan_SAPA_Guru_${titlePrefix}_${startDate}_sd_${endDate}.pdf`);
  };

  const executeExport = () => {
    if (fileFormat === "EXCEL") {
      handleDownloadExcel();
    } else {
      handleDownloadPDF();
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" id="panel-laporan-advanced">
      {/* Introduction Card */}
      <div className={`p-5 rounded-2xl border bg-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm transition-all ${activeTheme.hoverBorder}`}>
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl shrink-0 bg-rose-50 text-rose-600`}>
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-800">Cetak & Unduh Laporan Rekapitulasi</h4>
            <p className="text-xs text-slate-500 leading-relaxed mt-1">
              Halaman khusus untuk mencetak dan mengunduh data pelaporan kehadiran guru dari siswa maupun izin dari guru secara periodik. Format file tersedia dalam <strong>Excel</strong> dan <strong>PDF berkualitas cetak (A4/F4)</strong>.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Settings Panel */}
        <div className="lg:col-span-5 bg-white border border-slate-200/60 rounded-2xl p-5 md:p-6 space-y-5 shadow-sm">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Settings className={`w-4 h-4 ${activeTheme.accentText}`} />
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Konfigurasi Laporan</h3>
          </div>

          {/* Report Type */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-600 block">1. Pilih Sumber Data</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setReportType("KELAS")}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                  reportType === "KELAS"
                    ? `${activeTheme.lightBadge} border-slate-200 shadow-sm`
                    : "bg-slate-50 text-slate-600 border-slate-200/50 hover:bg-slate-100"
                }`}
              >
                Data Siswa
              </button>
              <button
                type="button"
                onClick={() => setReportType("IZIN")}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                  reportType === "IZIN"
                    ? "bg-amber-50 text-amber-700 border-amber-200 shadow-sm"
                    : "bg-slate-50 text-slate-600 border-slate-200/50 hover:bg-slate-100"
                }`}
              >
                Data Guru
              </button>
              <button
                type="button"
                onClick={() => setReportType("SEMUA")}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                  reportType === "SEMUA"
                    ? "bg-purple-50 text-purple-700 border-purple-200 shadow-sm"
                    : "bg-slate-50 text-slate-600 border-slate-200/50 hover:bg-slate-100"
                }`}
              >
                Keduanya
              </button>
            </div>
          </div>

          {/* Date Period */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-600 block">2. Tentukan Periode Tanggal</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Mulai Dari</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={`w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-opacity-10 ${activeTheme.focusBorder}`}
                />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Sampai Dengan</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`w-full mt-1 px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-opacity-10 ${activeTheme.focusBorder}`}
                />
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1.5 pt-2">
              <button
                type="button"
                onClick={() => handlePreset(0)}
                className="px-2.5 py-1 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200/60 rounded-md hover:bg-slate-100 transition-all"
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => handlePreset(7)}
                className="px-2.5 py-1 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200/60 rounded-md hover:bg-slate-100 transition-all"
              >
                7 Hari Terakhir
              </button>
              <button
                type="button"
                onClick={() => handlePreset(30)}
                className="px-2.5 py-1 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200/60 rounded-md hover:bg-slate-100 transition-all"
              >
                30 Hari Terakhir
              </button>
              <button
                type="button"
                onClick={handleThisMonth}
                className="px-2.5 py-1 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200/60 rounded-md hover:bg-slate-100 transition-all"
              >
                Bulan Ini
              </button>
            </div>
          </div>

          {/* File Format */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-600 block">3. Format Unduhan</label>
            <div className="grid grid-cols-2 gap-3">
              <label className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                fileFormat === "PDF"
                  ? "border-red-200 bg-red-50/50"
                  : "border-slate-100 hover:bg-slate-50/50"
              }`}>
                <input
                  type="radio"
                  name="fileFormat"
                  value="PDF"
                  checked={fileFormat === "PDF"}
                  onChange={() => setFileFormat("PDF")}
                  className="accent-red-600"
                />
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <FileText className="w-4 h-4 text-red-600" />
                  PDF Document
                </div>
              </label>

              <label className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                fileFormat === "EXCEL"
                  ? "border-emerald-200 bg-emerald-50/50"
                  : "border-slate-100 hover:bg-slate-50/50"
              }`}>
                <input
                  type="radio"
                  name="fileFormat"
                  value="EXCEL"
                  checked={fileFormat === "EXCEL"}
                  onChange={() => setFileFormat("EXCEL")}
                  className="accent-emerald-600"
                />
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  Excel Worksheet
                </div>
              </label>
            </div>
          </div>

          {/* Paper and layout settings - only relevant for PDF */}
          {fileFormat === "PDF" && (
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-3">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Setelan Lembar PDF</span>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-500">Ukuran Kertas</span>
                  <select
                    value={paperSize}
                    onChange={(e) => setPaperSize(e.target.value as "A4" | "F4")}
                    className="w-full mt-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white text-slate-800 focus:outline-none"
                  >
                    <option value="A4">A4 (Standard)</option>
                    <option value="F4">F4 / Folio (Administrasi)</option>
                  </select>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500">Orientasi Halaman</span>
                  <select
                    value={orientation}
                    onChange={(e) => setOrientation(e.target.value as "PORTRAIT" | "LANDSCAPE")}
                    className="w-full mt-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white text-slate-800 focus:outline-none"
                  >
                    <option value="PORTRAIT">Portrait (Tegak)</option>
                    <option value="LANDSCAPE">Landscape (Lebar)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Download button */}
          <button
            type="button"
            onClick={executeExport}
            className={`w-full py-3 px-4 rounded-xl text-white text-xs font-black tracking-wide flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95 transition-all ${
              fileFormat === "PDF"
                ? "bg-rose-600 hover:bg-rose-700"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            <Download className="w-4 h-4" />
            UNDUH LAPORAN ({fileFormat})
          </button>
        </div>

        {/* Real-time Preview stats of Filtered Data */}
        <div className="lg:col-span-7 bg-white border border-slate-200/60 rounded-2xl p-5 md:p-6 space-y-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <FileBox className="w-4 h-4 text-rose-500" />
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Preview & Ringkasan Data Periode</h3>
            </div>

            {/* Stats list */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl text-center">
                <div className="text-xl font-black text-slate-800">{totalRecords}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">Total Laporan</div>
              </div>
              <div className="bg-emerald-50/40 border border-emerald-100 p-3 rounded-xl text-center">
                <div className="text-xl font-black text-emerald-700">{filteredKelas.length}</div>
                <div className="text-[10px] text-emerald-500 font-bold uppercase mt-1">Input Siswa</div>
              </div>
              <div className="bg-amber-50/40 border border-amber-100 p-3 rounded-xl text-center">
                <div className="text-xl font-black text-amber-700">{filteredIzin.length}</div>
                <div className="text-[10px] text-amber-500 font-bold uppercase mt-1">Input Izin</div>
              </div>
              <div className="bg-blue-50/40 border border-blue-100 p-3 rounded-xl text-center">
                <div className="text-sm font-black text-blue-700">Ready</div>
                <div className="text-[10px] text-blue-500 font-bold uppercase mt-2">Status</div>
              </div>
            </div>

            {/* Quick Summary list of contents */}
            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Statistik Detail Kehadiran Kelas (Siswa)</span>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="bg-emerald-50 text-emerald-700 rounded-lg py-1 px-2 font-semibold">
                  Hadir: {countKelasStats.hadir}
                </div>
                <div className="bg-amber-50 text-amber-700 rounded-lg py-1 px-2 font-semibold">
                  Izin: {countKelasStats.izin}
                </div>
                <div className="bg-cyan-50 text-cyan-700 rounded-lg py-1 px-2 font-semibold">
                  Sakit: {countKelasStats.sakit}
                </div>
                <div className="bg-red-50 text-red-700 rounded-lg py-1 px-2 font-semibold">
                  Alpa: {countKelasStats.alpa}
                </div>
              </div>

              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block pt-2">Statistik Detail Surat Izin Resmi (Guru)</span>
              <div className="grid grid-cols-2 gap-3 text-center text-xs">
                <div className="bg-amber-50 text-amber-700 rounded-lg py-1 px-2 font-semibold">
                  Izin Guru: {countIzinStats.izin}
                </div>
                <div className="bg-cyan-50 text-cyan-700 rounded-lg py-1 px-2 font-semibold">
                  Sakit Guru: {countIzinStats.sakit}
                </div>
              </div>
            </div>

            {/* Warning if no data found */}
            {totalRecords === 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 leading-relaxed">
                  <strong>Tidak Ada Data:</strong> Belum ada data pelaporan pada periode tanggal yang dipilih. Silakan ubah periode penanggalan untuk mengunduh laporan rekapitulasi.
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-[11px] text-slate-500 leading-relaxed mt-4">
            <span className="font-bold text-slate-700 block mb-1">💡 Catatan Kerapian Cetak PDF:</span>
            Untuk laporan dengan kolom yang cukup lebar atau jumlah data yang banyak, sangat direkomendasikan memilih orientasi <strong>Landscape (Lebar)</strong> agar data tercetak rapi tanpa terpotong batas kertas.
          </div>
        </div>
      </div>
    </div>
  );
}
