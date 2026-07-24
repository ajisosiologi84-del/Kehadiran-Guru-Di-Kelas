/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { initializeApp } from "firebase/app";
import { initializeFirestore, setLogLevel, doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "firebase/firestore";

// Read firebase-applet-config.json safely using fs to prevent ESM JSON runtime import errors in Node.js / Vercel
let firebaseConfigImport: any = null;
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    firebaseConfigImport = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  }
} catch (err: any) {
  console.error("Failed to read firebase-applet-config.json:", err.message);
}

const fallbackSettings = { appsScriptUrl: "" };
const fallbackSubmissionsKelas: any[] = [];
const fallbackSubmissionsIzin: any[] = [];

// Firebase configuration loader and DB initialization
let firebaseApp: any = null;
let db: any = null;
let firebaseActive = false;

try {
  setLogLevel("error");
} catch (e) {}

try {
  let firebaseConfig: any = firebaseConfigImport;
  
  // Fallback to dynamic reading in case config is empty in the import but updated on disk (for local development)
  if (!firebaseConfig || !firebaseConfig.apiKey) {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    }
  }

  if (firebaseConfig && firebaseConfig.apiKey) {
    firebaseApp = initializeApp(firebaseConfig);
    db = initializeFirestore(firebaseApp, {}, firebaseConfig.firestoreDatabaseId || "(default)");
    firebaseActive = true;
    console.log("Firebase Web SDK Firestore initialized successfully with databaseId:", firebaseConfig.firestoreDatabaseId || "(default)");
  } else {
    console.log("No valid Firebase configuration found, running without Firebase persistence.");
  }
} catch (err: any) {
  console.error("Failed to initialize Firebase:", err.message);
}

// Fallback backup schedule data if Google Sheet is unreachable
const FALLBACK_NAMA_GURU = [
  "R. Imam Soebagyo, S.Pd",
  "Didik Suryadi, S.Pd",
  "Mokh. Yusup, S.Pd",
  "M. Hidayat Rahman, S.Pd",
  "Kusmiati, S.Pd",
  "Arum Widyati, S.Si",
  "Verika Agus Dian W, S.Pd",
  "Priyo Siswanto, S. Pd",
  "Haula, S. Pd",
  "Hakkul Yaqin, S.Pd",
  "Astutik Mayjayanti, S.Pd",
  "Nina Safrina , S.Ant",
  "Ajiansyah Akbar, S.Sos",
  "Farida Agustina, S.Pd",
  "Dewi Anisah, S.E",
  "Muwafiqoh, S.Psi",
  "Ardhianto Cahyono, S.Pd",
  "Budi Ananto, S.Pd",
  "Dadang Ciputro, S.Pd",
  "Daddy Adi Bahtiar, S. Pd",
  "Eva Kurniawati, S.Pd",
  "Mohammad Romi Ahfad, S.Pd",
  "Elvi Sundari, S.Pd",
  "Farida Ariyani, S.Si.",
  "Oky Dony Mukharom, S.Pd",
  "Alfrida Wahyu Winanda, S.Pd",
  "Saptri Pusparetno, S.Pd",
  "Ika Hardiana, S.Pd",
  "Muhammad Ali, M.Pd",
  "Rizky Hanif Mahardika, M.Pd"
];

const FALLBACK_MATA_PELAJARAN = [
  "Antropologi",
  "Bahasa dan Sastra Jepang",
  "Bahasa Indonesia",
  "Bahasa Inggris",
  "Bimbingan Konseling",
  "Biologi",
  "Ekonomi",
  "Fisika",
  "Geografi",
  "Informatika",
  "Kimia",
  "Matematika",
  "Muatan Lokal Bahasa Daerah",
  "Pendidikan Agama Islam",
  "Pendidikan Pancasila",
  "Penjasorkes",
  "Sejarah",
  "Seni Budaya",
  "Sosiologi"
];

const FALLBACK_JAM_KE = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

// Generate class admin users: adminkelasx1 to adminkelasx10, xi1 to xi10, xii1 to xii10
const FALLBACK_CLASS_ADMINS: Record<string, string> = {};
const classesList = ["x", "xi", "xii"];
classesList.forEach(cls => {
  for (let i = 1; i <= 10; i++) {
    FALLBACK_CLASS_ADMINS[`adminkelas${cls}${i}`] = "adminkelas2026";
  }
});

// Helper to fetch with a timeout using AbortController (prevents Vercel 10s timeout)
async function fetchWithTimeout(url: string, options: any = {}, timeoutMs = 4000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// Helper to wrap any Promise with a timeout
function promiseWithTimeout<T>(promise: Promise<T>, timeoutMs = 3000, label = "Operation"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then(
      (res) => {
        clearTimeout(timer);
        resolve(res);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

const SHEETS_URL = "https://docs.google.com/spreadsheets/d/1I-L5m4C7jOK-3y2hKnzhQEb9GDFzqot7YylhvooC7AM/gviz/tq?tqx=out:csv&sheet=DATA_UTAMA";

// Helper to parse a line of CSV handling quoted commas
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function extractSpreadsheetId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

// In-Memory cache for Schedule
let cachedScheduleData = {
  namaGuruList: FALLBACK_NAMA_GURU,
  mataPelajaranList: FALLBACK_MATA_PELAJARAN,
  jamKeList: FALLBACK_JAM_KE,
  classAdmins: FALLBACK_CLASS_ADMINS,
  lastSync: "Never (Using Fallback)"
};

// Function to fetch and parse spreadsheet data
async function syncWithGoogleSheet() {
  try {
    console.log("Starting Google Sheet sync process...");
    const settings = await loadSettings();
    const rawUrl = settings.appsScriptUrl ? settings.appsScriptUrl.trim() : "";

    let fetchedSchedule: any = null;
    let fetchedKelasSubmissions: any[] = [];
    let fetchedIzinSubmissions: any[] = [];

    // Mode 1: Apps Script Web App
    if (rawUrl && (rawUrl.includes("script.google.com") || rawUrl.endsWith("/exec"))) {
      console.log("Syncing via Apps Script Web App URL...");
      try {
        const getUrl = `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}action=get_all`;
        let response = await fetchWithTimeout(getUrl, { method: "GET", redirect: "follow" }, 3500).catch(() => null);

        if (!response || !response.ok) {
          response = await fetchWithTimeout(rawUrl, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "get_all" }),
            redirect: "follow"
          }, 3500).catch(() => null);
        }

        if (response && response.ok) {
          const text = await response.text();
          if (!text.trim().startsWith("<!DOCTYPE") && !text.trim().startsWith("<html")) {
            const result = JSON.parse(text);
            if (result && result.namaGuruList && result.namaGuruList.length > 0) {
              fetchedSchedule = {
                namaGuruList: result.namaGuruList,
                mataPelajaranList: result.mataPelajaranList && result.mataPelajaranList.length > 0 ? result.mataPelajaranList : FALLBACK_MATA_PELAJARAN,
                jamKeList: result.jamKeList && result.jamKeList.length > 0 ? result.jamKeList : FALLBACK_JAM_KE,
                classAdmins: result.classAdmins && Object.keys(result.classAdmins).length > 0 ? result.classAdmins : FALLBACK_CLASS_ADMINS,
                lastSync: new Date().toISOString()
              };
              if (Array.isArray(result.kelasData) && result.kelasData.length > 0) {
                fetchedKelasSubmissions = result.kelasData;
              }
              if (Array.isArray(result.izinData) && result.izinData.length > 0) {
                fetchedIzinSubmissions = result.izinData;
              }
              console.log("Successfully fetched schedule and submissions from Apps Script!");
            }
          }
        }
      } catch (err: any) {
        console.warn("Apps Script sync attempt failed:", err.message);
      }
    }

    // Mode 2: Google Spreadsheet direct link OR fallback CSV
    const spreadsheetId = extractSpreadsheetId(rawUrl) || extractSpreadsheetId(SHEETS_URL) || "1I-L5m4C7jOK-3y2hKnzhQEb9GDFzqot7YylhvooC7AM";

    if (!fetchedSchedule) {
      console.log(`Fetching schedule CSV directly from Spreadsheet ID: ${spreadsheetId}...`);
      const mainCsvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=DATA_UTAMA`;
      try {
        const response = await fetchWithTimeout(mainCsvUrl, {}, 3500);
        if (response.ok) {
          const text = await response.text();
          const lines = text.split(/\r?\n/);
          if (lines.length > 1) {
            const namaGuruSet = new Set<string>();
            const mataPelajaranSet = new Set<string>();
            const jamKeSet = new Set<string>();
            const classAdminsMap: Record<string, string> = {};

            for (let i = 1; i < lines.length; i++) {
              if (!lines[i].trim()) continue;
              const columns = parseCSVLine(lines[i]);
              if (columns[2]) {
                const val = columns[2].replace(/^"|"$/g, '').trim();
                if (val) namaGuruSet.add(val);
              }
              if (columns[3]) {
                const val = columns[3].replace(/^"|"$/g, '').trim();
                if (val) mataPelajaranSet.add(val);
              }
              if (columns[4]) {
                const val = columns[4].replace(/^"|"$/g, '').trim();
                if (val) jamKeSet.add(val);
              }
              if (columns[6]) {
                const username = columns[6].replace(/^"|"$/g, '').trim().toLowerCase();
                const password = columns[7] ? columns[7].replace(/^"|"$/g, '').trim() : "adminkelas2026";
                if (username) classAdminsMap[username] = password;
              }
            }

            if (namaGuruSet.size > 0) {
              fetchedSchedule = {
                namaGuruList: Array.from(namaGuruSet),
                mataPelajaranList: mataPelajaranSet.size > 0 ? Array.from(mataPelajaranSet) : FALLBACK_MATA_PELAJARAN,
                jamKeList: jamKeSet.size > 0 ? Array.from(jamKeSet) : FALLBACK_JAM_KE,
                classAdmins: Object.keys(classAdminsMap).length > 0 ? classAdminsMap : FALLBACK_CLASS_ADMINS,
                lastSync: new Date().toISOString()
              };
              console.log("Successfully parsed DATA_UTAMA schedule from Spreadsheet CSV.");
            }
          }
        }
      } catch (err: any) {
        console.warn("Failed to fetch DATA_UTAMA CSV:", err.message);
      }
    }

    // Always attempt CSV fetch for Submissions if Apps Script didn't provide them
    if (fetchedKelasSubmissions.length === 0) {
      const trySheetsSiswa = ["DATA_INPUT_SISWA", "DATA_INPUT_KELAS"];
      for (const sheetName of trySheetsSiswa) {
        const siswaCsvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${sheetName}`;
        try {
          const resSiswa = await fetchWithTimeout(siswaCsvUrl, {}, 3500);
          if (resSiswa.ok) {
            const textSiswa = await resSiswa.text();
            if (!textSiswa.trim().startsWith("<!DOCTYPE") && !textSiswa.trim().startsWith("<html")) {
              const linesS = textSiswa.split(/\r?\n/);
              if (linesS.length > 1) {
                for (let i = 1; i < linesS.length; i++) {
                  if (!linesS[i].trim()) continue;
                  const cols = parseCSVLine(linesS[i]);
                  const id = cols[0] ? cols[0].replace(/^"|"$/g, '').trim() : "";
                  const hari = cols[1] ? cols[1].replace(/^"|"$/g, '').trim() : "";
                  const tanggal = cols[2] ? cols[2].replace(/^"|"$/g, '').trim() : "";
                  const kelas = cols[3] ? cols[3].replace(/^"|"$/g, '').trim() : "";
                  const namaGuru = cols[4] ? cols[4].replace(/^"|"$/g, '').trim() : "";
                  const mataPelajaran = cols[5] ? cols[5].replace(/^"|"$/g, '').trim() : "";
                  const jamKe = cols[6] ? cols[6].replace(/^"|"$/g, '').trim() : "1";
                  const keteranganKehadiran = cols[7] ? cols[7].replace(/^"|"$/g, '').trim() : "Hadir";
                  const submittedBy = cols[8] ? cols[8].replace(/^"|"$/g, '').trim() : "Google Sheet";
                  const submittedAt = cols[9] ? cols[9].replace(/^"|"$/g, '').trim() : new Date().toISOString();

                  if (namaGuru && namaGuru.toLowerCase() !== "nama guru") {
                    fetchedKelasSubmissions.push({
                      id: id || "gs_" + Math.random().toString(36).substring(2, 9),
                      hari: hari || "Senin",
                      tanggal: tanggal || new Date().toISOString().split("T")[0],
                      kelas: kelas || "-",
                      namaGuru,
                      mataPelajaran: mataPelajaran || "-",
                      jamKe: jamKe || "1",
                      keteranganKehadiran,
                      submittedBy,
                      submittedAt
                    });
                  }
                }
                if (fetchedKelasSubmissions.length > 0) break;
              }
            }
          }
        } catch (e: any) {
          console.warn(`Failed to fetch ${sheetName} CSV:`, e.message);
        }
      }
    }

    if (fetchedIzinSubmissions.length === 0) {
      const izinCsvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=DATA_INPUT_IZIN_GURU`;
      try {
        const resIzin = await fetchWithTimeout(izinCsvUrl, {}, 3500);
        if (resIzin.ok) {
          const textIzin = await resIzin.text();
          if (!textIzin.trim().startsWith("<!DOCTYPE") && !textIzin.trim().startsWith("<html")) {
            const linesI = textIzin.split(/\r?\n/);
            if (linesI.length > 1) {
              for (let i = 1; i < linesI.length; i++) {
                if (!linesI[i].trim()) continue;
                const cols = parseCSVLine(linesI[i]);
                const id = cols[0] ? cols[0].replace(/^"|"$/g, '').trim() : "";
                const hari = cols[1] ? cols[1].replace(/^"|"$/g, '').trim() : "";
                const tanggal = cols[2] ? cols[2].replace(/^"|"$/g, '').trim() : "";
                const kelas = cols[3] ? cols[3].replace(/^"|"$/g, '').trim() : "";
                const namaGuru = cols[4] ? cols[4].replace(/^"|"$/g, '').trim() : "";
                const mataPelajaran = cols[5] ? cols[5].replace(/^"|"$/g, '').trim() : "";
                const jamKe = cols[6] ? cols[6].replace(/^"|"$/g, '').trim() : "1";
                const keteranganKehadiran = cols[7] ? cols[7].replace(/^"|"$/g, '').trim() : "Izin";
                const keteranganIzinGuru = cols[8] ? cols[8].replace(/^"|"$/g, '').trim() : "-";
                const submittedAt = cols[9] ? cols[9].replace(/^"|"$/g, '').trim() : new Date().toISOString();

                if (namaGuru && namaGuru.toLowerCase() !== "nama guru") {
                  fetchedIzinSubmissions.push({
                    id: id || "gsi_" + Math.random().toString(36).substring(2, 9),
                    hari: hari || "Senin",
                    tanggal: tanggal || new Date().toISOString().split("T")[0],
                    kelas: kelas || "-",
                    namaGuru,
                    mataPelajaran: mataPelajaran || "-",
                    jamKe: jamKe || "1",
                    keteranganKehadiran,
                    keteranganIzinGuru,
                    submittedAt
                  });
                }
              }
            }
          }
        }
      } catch (e: any) {
        console.warn("Failed to fetch DATA_INPUT_IZIN_GURU CSV:", e.message);
      }
    }

    // Save Schedule Cache
    if (fetchedSchedule) {
      cachedScheduleData = fetchedSchedule;
      await saveCachedScheduleToFirestore();
    }

    // Merge & Save Submissions Kelas
    if (fetchedKelasSubmissions.length > 0) {
      const existingKelas = await loadSubmissionsKelas();
      const map = new Map<string, any>();
      for (const item of existingKelas) {
        if (item.id) map.set(item.id, item);
      }
      for (const item of fetchedKelasSubmissions) {
        if (item.id) map.set(item.id, item);
      }
      const updatedKelas = Array.from(map.values()).sort((a, b) => new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime());
      await saveSubmissionsKelas(updatedKelas);
      console.log(`Merged ${fetchedKelasSubmissions.length} class submissions from Google Sheets (Total: ${updatedKelas.length}).`);
    }

    // Merge & Save Submissions Izin
    if (fetchedIzinSubmissions.length > 0) {
      const existingIzin = await loadSubmissionsIzin();
      const map = new Map<string, any>();
      for (const item of existingIzin) {
        if (item.id) map.set(item.id, item);
      }
      for (const item of fetchedIzinSubmissions) {
        if (item.id) map.set(item.id, item);
      }
      const updatedIzin = Array.from(map.values()).sort((a, b) => new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime());
      await saveSubmissionsIzin(updatedIzin);
      console.log(`Merged ${fetchedIzinSubmissions.length} teacher leave submissions from Google Sheets (Total: ${updatedIzin.length}).`);
    }

  } catch (err: any) {
    console.error("Error in syncWithGoogleSheet:", err.message);
  }
}

// Submissions File Database setup
const isVercel = !!process.env.VERCEL;
const DATA_DIR = isVercel ? "/tmp" : path.join(process.cwd(), "src", "data");
const KELAS_SUBMISSIONS_FILE = path.join(DATA_DIR, "submissions_kelas.json");
const IZIN_SUBMISSIONS_FILE = path.join(DATA_DIR, "submissions_izin.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

// Helper to load/save JSON files
function ensureDataDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const filesToEnsure = [
    { file: KELAS_SUBMISSIONS_FILE, data: fallbackSubmissionsKelas },
    { file: IZIN_SUBMISSIONS_FILE, data: fallbackSubmissionsIzin },
    { file: SETTINGS_FILE, data: fallbackSettings }
  ];

  for (const item of filesToEnsure) {
    if (!fs.existsSync(item.file)) {
      try {
        fs.writeFileSync(item.file, JSON.stringify(item.data, null, 2));
        console.log(`Initialized ${path.basename(item.file)} in ${DATA_DIR}`);
      } catch (err: any) {
        console.error(`Failed to initialize ${path.basename(item.file)}:`, err.message);
      }
    }
  }
}

function extractAppsScriptError(html: string): string {
  // Coba cari class="errorMessage"
  const errMatch = html.match(/class=["']errorMessage["'][^>]*>([\s\S]*?)<\/div>/i) || 
                   html.match(/<div[^>]*id=["']error-message["'][^>]*>([\s\S]*?)<\/div>/i) ||
                   html.match(/<div[^>]*class=["']errorMessage["'][^>]*>([\s\S]*?)<\/div>/i);
  if (errMatch && errMatch[1]) {
    return errMatch[1].replace(/<[^>]*>/g, '').trim();
  }
  
  // Coba cari body text umum
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch && bodyMatch[1]) {
    const textOnly = bodyMatch[1]
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (textOnly.length > 0 && textOnly.length < 500) {
      return textOnly;
    }
  }
  
  // Coba cari title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    return `Error: ${titleMatch[1].trim()}`;
  }
  
  return "Google Apps Script Error (Otorisasi diperlukan atau script bermasalah)";
}

let serverFirestoreQuotaExceeded = false;

function handleServerFirestoreError(err: any, context: string) {
  const msg = err?.message || String(err);
  if (msg.includes("Quota") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED")) {
    serverFirestoreQuotaExceeded = true;
    console.warn(`[Server Firestore Quota Exceeded] ${context}. Falling back to local disk storage.`);
  } else {
    console.warn(`[Server Firestore Note] ${context}: ${msg}`);
  }
}

async function loadSettings(): Promise<{ appsScriptUrl: string }> {
  if (firebaseActive && db && !serverFirestoreQuotaExceeded) {
    try {
      const docRef = doc(db, "settings", "config");
      const docSnap = await promiseWithTimeout(getDoc(docRef), 3000, "getDoc settings/config");
      if (docSnap.exists()) {
        return docSnap.data() as { appsScriptUrl: string };
      }
    } catch (err: any) {
      handleServerFirestoreError(err, "loadSettings");
    }
  }

  try {
    ensureDataDirectory();
    const data = fs.readFileSync(SETTINGS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (e) {
    console.error("Error reading settings:", e);
    return { appsScriptUrl: "" };
  }
}

async function saveSettings(settings: { appsScriptUrl: string }) {
  try {
    ensureDataDirectory();
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (e) {
    console.error("Error writing settings:", e);
  }

  if (firebaseActive && db && !serverFirestoreQuotaExceeded) {
    try {
      const docRef = doc(db, "settings", "config");
      await promiseWithTimeout(setDoc(docRef, settings), 3000, "setDoc settings/config");
      console.log("Settings synced to Firestore successfully.");
    } catch (err: any) {
      handleServerFirestoreError(err, "saveSettings");
    }
  }
}

async function loadCachedScheduleFromFirestore() {
  if (firebaseActive && db && !serverFirestoreQuotaExceeded) {
    try {
      const docRef = doc(db, "settings", "cached_schedule");
      const docSnap = await promiseWithTimeout(getDoc(docRef), 3000, "getDoc settings/cached_schedule");
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && data.namaGuruList && data.namaGuruList.length > 0) {
          cachedScheduleData = data as any;
          console.log("Loaded cached schedule data from Firestore successfully. Last sync:", cachedScheduleData.lastSync);
        }
      }
    } catch (err: any) {
      handleServerFirestoreError(err, "loadCachedScheduleFromFirestore");
    }
  }
}

async function saveCachedScheduleToFirestore() {
  if (firebaseActive && db && !serverFirestoreQuotaExceeded) {
    try {
      const docRef = doc(db, "settings", "cached_schedule");
      await promiseWithTimeout(setDoc(docRef, cachedScheduleData), 3000, "setDoc settings/cached_schedule");
      console.log("Cached schedule data saved to Firestore successfully.");
    } catch (err: any) {
      handleServerFirestoreError(err, "saveCachedScheduleToFirestore");
    }
  }
}

async function asyncPushToSheets(action: "add" | "edit" | "delete" | "sync_all", type: "kelas" | "izin", payload: any) {
  const settings = await loadSettings();
  if (!settings.appsScriptUrl) {
    console.log("Apps Script URL not configured, skipping sheet sync.");
    return;
  }
  
  const trimmedUrl = settings.appsScriptUrl.trim();
  if (trimmedUrl.includes("docs.google.com/spreadsheets")) {
    console.error("Configured Apps Script URL is actually a spreadsheet link, skipping sync.");
    return;
  }
  
  try {
    console.log(`Pushing ${action} of ${type} to Google Sheet via Apps Script...`);
    const res = await fetchWithTimeout(trimmedUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        type,
        payload
      })
    }, 30000); // GSheet sync push: 30s timeout
    const text = await res.text();
    if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
      console.error("Apps Script push returned HTML instead of JSON. Ensure web app is deployed with 'Anyone' access.");
    } else {
      console.log("Apps Script sync response text:", text);
    }
  } catch (error: any) {
    console.error("Error pushing to Apps Script:", error.message);
  }
}

async function syncAllSubmissionsToSheets() {
  const settings = await loadSettings();
  if (!settings.appsScriptUrl) {
    console.log("Apps Script URL not configured, skipping bulk submissions sheet sync.");
    return;
  }
  
  const trimmedUrl = settings.appsScriptUrl.trim();
  if (trimmedUrl.includes("docs.google.com/spreadsheets")) {
    console.error("Configured Apps Script URL is actually a spreadsheet link, skipping bulk sync.");
    return;
  }
  
  try {
    console.log("Loading all submissions for bulk GSheet sync...");
    const kelasData = await loadSubmissionsKelas();
    const izinData = await loadSubmissionsIzin();
    
    console.log(`Pushing bulk sync_all to Google Sheet via Apps Script... (Kelas: ${kelasData.length}, Izin: ${izinData.length})`);
    const res = await fetchWithTimeout(trimmedUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "sync_all",
        kelasData,
        izinData
      })
    }, 45000); // 45s timeout for bulk sync
    
    const text = await res.text();
    console.log("Apps Script bulk sync response text:", text);
  } catch (error: any) {
    console.error("Error bulk syncing to Apps Script:", error.message);
  }
}

async function loadSubmissionsKelas(): Promise<any[]> {
  if (firebaseActive && db && !serverFirestoreQuotaExceeded) {
    try {
      const colRef = collection(db, "submissions_kelas");
      const querySnapshot = await promiseWithTimeout(getDocs(colRef), 3000, "getDocs submissions_kelas");
      const list: any[] = [];
      querySnapshot.forEach((doc) => {
        list.push(doc.data());
      });
      return list.sort((a, b) => new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime());
    } catch (err: any) {
      handleServerFirestoreError(err, "loadSubmissionsKelas");
    }
  }

  try {
    ensureDataDirectory();
    const data = fs.readFileSync(KELAS_SUBMISSIONS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (e) {
    console.error("Error reading submissions kelas:", e);
    return [];
  }
}

async function saveSubmissionsKelas(data: any[]) {
  try {
    ensureDataDirectory();
    fs.writeFileSync(KELAS_SUBMISSIONS_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Error writing submissions kelas:", e);
  }

  if (firebaseActive && db && !serverFirestoreQuotaExceeded) {
    try {
      // Set all documents concurrently with a timeout
      const writePromises = data.map(item => {
        const docRef = doc(db, "submissions_kelas", item.id);
        return setDoc(docRef, item);
      });
      await promiseWithTimeout(Promise.all(writePromises), 3000, "setDoc submissions_kelas batch");

      // Cleanup stale documents in Firestore
      const colRef = collection(db, "submissions_kelas");
      const querySnapshot = await promiseWithTimeout(getDocs(colRef), 2000, "getDocs submissions_kelas for cleanup");
      const currentIds = new Set(data.map(item => item.id));
      const deletePromises: Promise<any>[] = [];
      for (const docSnap of querySnapshot.docs) {
        if (!currentIds.has(docSnap.id)) {
          deletePromises.push(deleteDoc(docSnap.ref));
        }
      }
      if (deletePromises.length > 0) {
        await promiseWithTimeout(Promise.all(deletePromises), 2000, "deleteDoc submissions_kelas stale batch");
        console.log(`Successfully deleted ${deletePromises.length} stale submissions_kelas from Firestore.`);
      }
    } catch (err: any) {
      handleServerFirestoreError(err, "saveSubmissionsKelas");
    }
  }
}

async function loadSubmissionsIzin(): Promise<any[]> {
  if (firebaseActive && db && !serverFirestoreQuotaExceeded) {
    try {
      const colRef = collection(db, "submissions_izin");
      const querySnapshot = await promiseWithTimeout(getDocs(colRef), 3000, "getDocs submissions_izin");
      const list: any[] = [];
      querySnapshot.forEach((doc) => {
        list.push(doc.data());
      });
      return list.sort((a, b) => new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime());
    } catch (err: any) {
      handleServerFirestoreError(err, "loadSubmissionsIzin");
    }
  }

  try {
    ensureDataDirectory();
    const data = fs.readFileSync(IZIN_SUBMISSIONS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (e) {
    console.error("Error reading submissions izin:", e);
    return [];
  }
}

async function saveSubmissionsIzin(data: any[]) {
  try {
    ensureDataDirectory();
    fs.writeFileSync(IZIN_SUBMISSIONS_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Error writing submissions izin:", e);
  }

  if (firebaseActive && db && !serverFirestoreQuotaExceeded) {
    try {
      // Set all documents concurrently with a timeout
      const writePromises = data.map(item => {
        const docRef = doc(db, "submissions_izin", item.id);
        return setDoc(docRef, item);
      });
      await promiseWithTimeout(Promise.all(writePromises), 3000, "setDoc submissions_izin batch");

      // Cleanup stale documents in Firestore
      const colRef = collection(db, "submissions_izin");
      const querySnapshot = await promiseWithTimeout(getDocs(colRef), 2000, "getDocs submissions_izin for cleanup");
      const currentIds = new Set(data.map(item => item.id));
      const deletePromises: Promise<any>[] = [];
      for (const docSnap of querySnapshot.docs) {
        if (!currentIds.has(docSnap.id)) {
          deletePromises.push(deleteDoc(docSnap.ref));
        }
      }
      if (deletePromises.length > 0) {
        await promiseWithTimeout(Promise.all(deletePromises), 2000, "deleteDoc submissions_izin stale batch");
        console.log(`Successfully deleted ${deletePromises.length} stale submissions_izin from Firestore.`);
      }
    } catch (err: any) {
      handleServerFirestoreError(err, "saveSubmissionsIzin");
    }
  }
}

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Initialize data files & load firebase cache on server startup (non-blocking to prevent startup timeouts in serverless environments like Vercel)
function initApp() {
  try {
    ensureDataDirectory();
  } catch (err: any) {
    console.error("Failed to ensure data directory on startup:", err.message);
  }
  
  // Load cached schedule from Firestore on startup (non-blocking, fast)
  loadCachedScheduleFromFirestore().then(async () => {
    // Only perform an automatic sheet sync on startup IF we have no cached schedule at all
    if (cachedScheduleData.lastSync === "Never (Using Fallback)") {
      console.log("No schedule cache found in Firestore, initiating initial sync with Google Sheets...");
      try {
        await syncWithGoogleSheet();
        await saveCachedScheduleToFirestore();
      } catch (err: any) {
        console.error("Initial Google Sheets sync failed:", err.message);
      }
    } else {
      console.log("Schedule loaded from Firestore cache. Skipping automatic Google Sheets sync on startup.");
    }
  }).catch(err => {
    console.error("Failed to load schedule cache from Firestore on startup:", err.message);
  });
}

initApp();

  // API: Sync Google Sheets manually (can be triggered by main admin)
  app.post("/api/sync", async (req, res) => {
    try {
      // 1. Pull latest reference lists from sheet DATA_UTAMA
      await syncWithGoogleSheet();
      await saveCachedScheduleToFirestore();

      // 2. Push all existing submissions in Firestore/local db to Google Sheets in bulk
      await syncAllSubmissionsToSheets();

      res.json({ success: true, lastSync: cachedScheduleData.lastSync });
    } catch (err: any) {
      console.error("Manual GSheets sync failed:", err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API: Get reference schedule data
  app.get("/api/schedule", async (req, res) => {
    try {
      if (cachedScheduleData.lastSync === "Never (Using Fallback)") {
        await loadCachedScheduleFromFirestore();
        if (cachedScheduleData.lastSync === "Never (Using Fallback)") {
          console.log("No schedule in Firestore, syncing live from Sheets...");
          await syncWithGoogleSheet();
          await saveCachedScheduleToFirestore();
        }
      }
      res.json(cachedScheduleData);
    } catch (err: any) {
      console.error("Error fetching schedule:", err?.message || err);
      res.json(cachedScheduleData);
    }
  });

  // API: Get App Settings
  app.get("/api/settings", async (req, res) => {
    const settings = await loadSettings();
    res.json(settings);
  });

  // API: Update App Settings
  app.post("/api/settings", async (req, res) => {
    const { appsScriptUrl } = req.body;
    await saveSettings({ appsScriptUrl: appsScriptUrl || "" });
    res.json({ success: true });
  });

  // API: Proxy individual push to Apps Script to bypass CORS
  app.post("/api/sync/push", async (req, res) => {
    const { action, type, payload } = req.body;
    if (!action || !type || !payload) {
      return res.status(400).json({ success: false, error: "Action, type, and payload are required" });
    }
    try {
      await asyncPushToSheets(action, type, payload);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Proxy push failed:", err.message);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API: Login verification
  app.post("/api/login", async (req, res) => {
    const { username, password, type, role } = req.body;

    if (!username || !password || !type) {
      return res.status(400).json({ success: false, error: "Username, password, and type are required" });
    }

    const normUsername = String(username).trim().toLowerCase().replace(/\s+/g, '').replace(/-/g, '');
    const normPassword = String(password).trim();
    const lowerPassword = normPassword.toLowerCase();

    if (type === "TEACHER") {
      if ((normUsername === "guru" || normUsername.includes("guru")) && (lowerPassword === "gurudoea123" || lowerPassword === "guru123" || lowerPassword === "guru")) {
        return res.json({
          success: true,
          session: {
            type: "TEACHER",
            username: "guru"
          }
        });
      } else {
        return res.status(401).json({ success: false, error: "Username atau Password Admin Guru tidak cocok" });
      }
    } else if (type === "ADMIN") {
      // Validate Admins
      // Admin Utama: admin / admin123junior
      // Admin Tata Usaha: admin / admin123TU
      // Admin BK: admin / admin123BK
      // Admin Tata Tertib: admin / admin123tatib
      if (normUsername !== "admin" && !normUsername.includes("admin")) {
        return res.status(401).json({ success: false, error: "Username admin salah" });
      }

      let validRole: string | null = null;
      if (lowerPassword === "admin123junior") validRole = "UTAMA";
      else if (lowerPassword === "admin123tu") validRole = "TU";
      else if (lowerPassword === "admin123bk") validRole = "BK";
      else if (lowerPassword === "admin123tatib") validRole = "TATIB";

      const targetRole = role || validRole;
      if (validRole && (targetRole === validRole || !role)) {
        return res.json({
          success: true,
          session: {
            type: "ADMIN",
            username: "admin",
            role: validRole
          }
        });
      } else if (validRole) {
        return res.status(401).json({ success: false, error: `Password yang dimasukkan adalah untuk Admin ${validRole}, tetapi peran yang dipilih adalah Admin ${role}` });
      } else {
        return res.status(401).json({ success: false, error: "Password Admin tidak cocok" });
      }
    } else if (type === "STUDENT") {
      const findClassAdminPassword = (classAdmins: Record<string, string>, targetUser: string): { matchedUser: string; pass: string } | null => {
        if (!classAdmins) return null;
        for (const [key, pass] of Object.entries(classAdmins)) {
          const normKey = key.trim().toLowerCase().replace(/\s+/g, '').replace(/-/g, '');
          if (normKey === targetUser) {
            return { matchedUser: key, pass: String(pass || "").trim() };
          }
        }
        return null;
      };

      let match = findClassAdminPassword(cachedScheduleData.classAdmins, normUsername);

      // If we haven't synced yet, or if user was not found, perform live sync
      if (!match || cachedScheduleData.lastSync === "Never (Using Fallback)") {
        console.log(`User ${normUsername} not in cache or first sync. Performing on-demand sync from Google Sheet...`);
        try {
          await syncWithGoogleSheet();
          match = findClassAdminPassword(cachedScheduleData.classAdmins, normUsername);
        } catch (syncErr: any) {
          console.error("Failed on-demand sync with Google Sheet during student login:", syncErr.message);
        }
      }

      if (match && match.pass.toLowerCase() === lowerPassword) {
        return res.json({
          success: true,
          session: {
            type: "STUDENT",
            username: match.matchedUser
          }
        });
      } else {
        return res.status(401).json({ success: false, error: "Username atau Password Admin Kelas salah" });
      }
    }

    return res.status(400).json({ success: false, error: "Format Login tidak didukung" });
  });

  // API: Get Student Class Submissions
  app.get("/api/submissions/kelas", async (req, res) => {
    let data = await loadSubmissionsKelas();
    if (!data || data.length === 0) {
      console.log("Submissions kelas is empty, syncing live from Sheets...");
      await syncWithGoogleSheet();
      data = await loadSubmissionsKelas();
    }
    res.json(data);
  });

  // API: Add Student Class Submission
  app.post("/api/submissions/kelas", async (req, res) => {
    const record = req.body;
    if (!record.namaGuru || !record.mataPelajaran || !record.keteranganKehadiran || !record.submittedBy) {
      return res.status(400).json({ success: false, error: "Data input kelas tidak lengkap" });
    }

    const data = await loadSubmissionsKelas();
    const newRecord = {
      id: Math.random().toString(36).substring(2, 9),
      hari: record.hari || "Senin",
      tanggal: record.tanggal || new Date().toISOString().split('T')[0],
      namaGuru: record.namaGuru,
      mataPelajaran: record.mataPelajaran,
      jamKe: record.jamKe || "1",
      keteranganKehadiran: record.keteranganKehadiran,
      submittedBy: record.submittedBy,
      submittedAt: new Date().toISOString(),
      kelas: record.kelas || ""
    };

    data.push(newRecord);
    await saveSubmissionsKelas(data);
    await asyncPushToSheets("add", "kelas", newRecord);

    res.status(201).json({ success: true, data: newRecord });
  });

  // API: Bulk Import / Restore Student Class Submissions (DATA_INPUT_SISWA)
  app.post("/api/submissions/kelas/bulk", async (req, res) => {
    const { records, mode } = req.body; // mode: 'merge' | 'overwrite'
    if (!Array.isArray(records)) {
      return res.status(400).json({ success: false, error: "Data records harus berupa array" });
    }

    const current = await loadSubmissionsKelas();
    let finalList: any[] = [];

    if (mode === "overwrite") {
      finalList = records;
    } else {
      const existingMap = new Map(current.map((item: any) => [item.id, item]));
      records.forEach((rec: any) => {
        if (rec && rec.id) {
          existingMap.set(rec.id, rec);
        }
      });
      finalList = Array.from(existingMap.values());
    }

    await saveSubmissionsKelas(finalList);

    // Optionally push bulk update to Apps Script if configured
    await asyncPushToSheets("sync_all", "kelas", finalList);

    res.json({ success: true, count: finalList.length, data: finalList });
  });

  // API: Delete All Student Class Submissions
  app.delete("/api/submissions/kelas/all", async (req, res) => {
    await saveSubmissionsKelas([]);
    await asyncPushToSheets("sync_all", "kelas", []);
    res.json({ success: true, count: 0 });
  });

  // API: Delete All Teacher Leave Submissions
  app.delete("/api/submissions/izin/all", async (req, res) => {
    await saveSubmissionsIzin([]);
    await asyncPushToSheets("sync_all", "izin", []);
    res.json({ success: true, count: 0 });
  });

  // API: Delete Student Class Submission
  app.delete("/api/submissions/kelas/:id", async (req, res) => {
    const { id } = req.params;
    let data = await loadSubmissionsKelas();
    const initialLen = data.length;
    data = data.filter(item => item.id !== id);
    if (data.length === initialLen) {
      return res.status(404).json({ success: false, error: "Data tidak ditemukan" });
    }
    await saveSubmissionsKelas(data);
    await asyncPushToSheets("delete", "kelas", { id });
    res.json({ success: true });
  });

  // API: Update Student Class Submission
  app.put("/api/submissions/kelas/:id", async (req, res) => {
    const { id } = req.params;
    const record = req.body;
    const data = await loadSubmissionsKelas();
    const index = data.findIndex(item => item.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: "Data tidak ditemukan" });
    }
    data[index] = {
      ...data[index],
      namaGuru: record.namaGuru || data[index].namaGuru,
      mataPelajaran: record.mataPelajaran || data[index].mataPelajaran,
      jamKe: record.jamKe || data[index].jamKe,
      keteranganKehadiran: record.keteranganKehadiran || data[index].keteranganKehadiran,
      hari: record.hari || data[index].hari,
      tanggal: record.tanggal || data[index].tanggal,
      kelas: record.kelas !== undefined ? record.kelas : data[index].kelas
    };
    await saveSubmissionsKelas(data);
    await asyncPushToSheets("edit", "kelas", data[index]);
    res.json({ success: true, data: data[index] });
  });

  // API: Get Teacher Leave Submissions
  app.get("/api/submissions/izin", async (req, res) => {
    let data = await loadSubmissionsIzin();
    if (!data || data.length === 0) {
      console.log("Submissions izin is empty, syncing live from Sheets...");
      await syncWithGoogleSheet();
      data = await loadSubmissionsIzin();
    }
    res.json(data);
  });

  // API: Add Teacher Leave Submission
  app.post("/api/submissions/izin", async (req, res) => {
    const record = req.body;
    if (!record.namaGuru || !record.mataPelajaran || !record.keteranganKehadiran || !record.keteranganIzinGuru) {
      return res.status(400).json({ success: false, error: "Data input izin guru tidak lengkap" });
    }

    const data = await loadSubmissionsIzin();
    const newRecord = {
      id: Math.random().toString(36).substring(2, 9),
      hari: record.hari || "Senin",
      tanggal: record.tanggal || new Date().toISOString().split('T')[0],
      namaGuru: record.namaGuru,
      mataPelajaran: record.mataPelajaran,
      jamKe: record.jamKe || "1",
      keteranganKehadiran: record.keteranganKehadiran, // "IZIN" or "SAKIT"
      keteranganIzinGuru: record.keteranganIzinGuru,
      submittedAt: new Date().toISOString(),
      kelas: record.kelas || ""
    };

    data.push(newRecord);
    await saveSubmissionsIzin(data);
    await asyncPushToSheets("add", "izin", newRecord);

    res.status(201).json({ success: true, data: newRecord });
  });

  // API: Delete Teacher Leave Submission
  app.delete("/api/submissions/izin/:id", async (req, res) => {
    const { id } = req.params;
    let data = await loadSubmissionsIzin();
    const initialLen = data.length;
    data = data.filter(item => item.id !== id);
    if (data.length === initialLen) {
      return res.status(404).json({ success: false, error: "Data tidak ditemukan" });
    }
    await saveSubmissionsIzin(data);
    await asyncPushToSheets("delete", "izin", { id });
    res.json({ success: true });
  });

  // API: Update Teacher Leave Submission
  app.put("/api/submissions/izin/:id", async (req, res) => {
    const { id } = req.params;
    const record = req.body;
    const data = await loadSubmissionsIzin();
    const index = data.findIndex(item => item.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: "Data tidak ditemukan" });
    }
    data[index] = {
      ...data[index],
      namaGuru: record.namaGuru || data[index].namaGuru,
      mataPelajaran: record.mataPelajaran || data[index].mataPelajaran,
      jamKe: record.jamKe || data[index].jamKe,
      keteranganKehadiran: record.keteranganKehadiran || data[index].keteranganKehadiran,
      keteranganIzinGuru: record.keteranganIzinGuru || data[index].keteranganIzinGuru,
      hari: record.hari || data[index].hari,
      tanggal: record.tanggal || data[index].tanggal,
      kelas: record.kelas !== undefined ? record.kelas : data[index].kelas
    };
    await saveSubmissionsIzin(data);
    await asyncPushToSheets("edit", "izin", data[index]);
    res.json({ success: true, data: data[index] });
  });

  // Vite integration
  if (!process.env.VERCEL) {
    if (process.env.NODE_ENV !== "production") {
      const viteModuleName = "vite";
      import(viteModuleName).then(({ createServer: createViteServer }) => {
        createViteServer({
          server: { middlewareMode: true },
          appType: "spa",
        }).then((vite) => {
          app.use(vite.middlewares);
          app.listen(PORT, "0.0.0.0", () => {
            console.log(`Server running on http://0.0.0.0:${PORT}`);
          });
        });
      });
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://0.0.0.0:${PORT}`);
      });
    }
  }

export default app;
