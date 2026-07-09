/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type KeteranganKehadiran = "HADIR" | "IZIN" | "SAKIT" | "TANPA KETERANGAN";

export interface ClassAdmin {
  username: string;
  kelas: string; // Derived from username, e.g. "Kelas X-1" from "adminkelasx1"
}

export interface StudentSubmission {
  id: string;
  hari: string;
  tanggal: string;
  namaGuru: string;
  mataPelajaran: string;
  jamKe: string;
  keteranganKehadiran: KeteranganKehadiran;
  submittedBy: string; // username of Class Admin
  submittedAt: string; // ISO string
}

export interface TeacherLeaveSubmission {
  id: string;
  hari: string;
  tanggal: string;
  namaGuru: string;
  mataPelajaran: string;
  jamKe: string;
  keteranganKehadiran: "IZIN" | "SAKIT";
  keteranganIzinGuru: string;
  submittedAt: string; // ISO string
}

export type AdminRole = "UTAMA" | "TU" | "BK" | "TATIB";

export interface UserSession {
  type: "STUDENT" | "ADMIN";
  username: string;
  role?: AdminRole;
}

export interface ScheduleData {
  namaGuruList: string[];
  mataPelajaranList: string[];
  jamKeList: string[];
  classAdmins: Record<string, string>; // username -> password
}
