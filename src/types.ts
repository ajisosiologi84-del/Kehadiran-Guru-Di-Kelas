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
  kelas?: string;
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
  kelas?: string;
}

export type AdminRole = "UTAMA" | "TU" | "BK" | "TATIB";

export interface UserSession {
  type: "STUDENT" | "ADMIN" | "TEACHER";
  username: string;
  role?: AdminRole;
}

export interface ScheduleData {
  namaGuruList: string[];
  mataPelajaranList: string[];
  jamKeList: string[];
  classAdmins: Record<string, string>; // username -> password
  lastSync?: string;
}

export const KELAS_LIST = [
  "X-1", "X-2", "X-3", "X-4", "X-5", "X-6", "X-7", "X-8", "X-9", "X-10",
  "XI-1", "XI-2", "XI-3", "XI-4", "XI-5", "XI-6", "XI-7", "XI-8", "XI-9", "XI-10",
  "XII-1", "XII-2", "XII-3", "XII-4", "XII-5", "XII-6", "XII-7", "XII-8", "XII-9", "XII-10"
];
