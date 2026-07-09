/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { initializeApp } from "firebase/app";
import { initializeFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "firebase/firestore";

const fallbackSettings = { appsScriptUrl: "" };
const fallbackSubmissionsKelas: any[] = [];
const fallbackSubmissionsIzin: any[] = [];

// Firebase configuration loader and DB initialization
let firebaseApp: any = null;
let db: any = null;
let firebaseActive = false;

try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    firebaseApp = initializeApp(firebaseConfig);
    db = initializeFirestore(firebaseApp, {}, firebaseConfig.firestoreDatabaseId || "(default)");
    firebaseActive = true;
    console.log("Firebase Web SDK Firestore initialized successfully with databaseId:", firebaseConfig.firestoreDatabaseId || "(default)");
  } else {
    console.log("firebase-applet-config.json not found, running without Firebase persistence.");
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
    console.log("Checking if Google Apps Script URL is configured for schedule sync...");
    const settings = await loadSettings();
    if (settings.appsScriptUrl) {
      const trimmedUrl = settings.appsScriptUrl.trim();
      if (trimmedUrl && !trimmedUrl.includes("docs.google.com/spreadsheets")) {
        console.log("Syncing schedule and class admins via Apps Script Web App...");
        try {
          const response = await fetchWithTimeout(trimmedUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "get_schedule" })
          }, 4000);
          
          if (response.ok) {
            const text = await response.text();
            if (!text.trim().startsWith("<!DOCTYPE") && !text.trim().startsWith("<html")) {
              const result = JSON.parse(text);
              if (result.success && result.namaGuruList && result.namaGuruList.length > 0) {
                cachedScheduleData = {
                  namaGuruList: result.namaGuruList,
                  mataPelajaranList: result.mataPelajaranList && result.mataPelajaranList.length > 0 ? result.mataPelajaranList : FALLBACK_MATA_PELAJARAN,
                  jamKeList: result.jamKeList && result.jamKeList.length > 0 ? result.jamKeList : FALLBACK_JAM_KE,
                  classAdmins: result.classAdmins && Object.keys(result.classAdmins).length > 0 ? result.classAdmins : FALLBACK_CLASS_ADMINS,
                  lastSync: new Date().toISOString()
                };
                console.log("Successfully synced schedule and class admins via Apps Script Web App!");
                return;
              } else {
                console.warn("Apps Script schedule sync returned unsuccessful or empty data:", result.error || "unknown error");
              }
            } else {
              console.warn("Apps Script schedule sync returned HTML. Falling back to public spreadsheet CSV.");
            }
          } else {
            console.warn("Apps Script schedule sync request failed with status:", response.status);
          }
        } catch (scriptErr: any) {
          console.error("Failed to fetch from Apps Script Web App, falling back to public spreadsheet:", scriptErr.message);
        }
      }
    }

    console.log("Fetching live data from Google Sheet CSV directly...");
    const response = await fetchWithTimeout(SHEETS_URL, {}, 4000);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const text = await response.text();
    const lines = text.split(/\r?\n/);
    if (lines.length <= 1) {
      throw new Error("Empty CSV or invalid format received from Google Sheets");
    }

    const namaGuruSet = new Set<string>();
    const mataPelajaranSet = new Set<string>();
    const jamKeSet = new Set<string>();
    const classAdminsMap: Record<string, string> = {};

    // First line is header
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const columns = parseCSVLine(lines[i]);
      
      // Col 2: Nama Guru
      if (columns[2]) {
        // Strip quotes if any
        const val = columns[2].replace(/^"|"$/g, '').trim();
        if (val) namaGuruSet.add(val);
      }
      // Col 3: Mata Pelajaran
      if (columns[3]) {
        const val = columns[3].replace(/^"|"$/g, '').trim();
        if (val) mataPelajaranSet.add(val);
      }
      // Col 4: Jam Ke
      if (columns[4]) {
        const val = columns[4].replace(/^"|"$/g, '').trim();
        if (val) jamKeSet.add(val);
      }
      // Col 6: Username, Col 7: Password
      if (columns[6]) {
        const username = columns[6].replace(/^"|"$/g, '').trim().toLowerCase();
        const password = columns[7] ? columns[7].replace(/^"|"$/g, '').trim() : "adminkelas2026";
        if (username) {
          classAdminsMap[username] = password;
        }
      }
    }

    // Update Cache if we got valid lists
    if (namaGuruSet.size > 0) {
      cachedScheduleData = {
        namaGuruList: Array.from(namaGuruSet),
        mataPelajaranList: mataPelajaranSet.size > 0 ? Array.from(mataPelajaranSet) : FALLBACK_MATA_PELAJARAN,
        jamKeList: jamKeSet.size > 0 ? Array.from(jamKeSet) : FALLBACK_JAM_KE,
        classAdmins: Object.keys(classAdminsMap).length > 0 ? classAdminsMap : FALLBACK_CLASS_ADMINS,
        lastSync: new Date().toISOString()
      };
      console.log("Successfully synced Google Sheet data via CSV fallback!");
      console.log(`Teachers loaded: ${cachedScheduleData.namaGuruList.length}`);
      console.log(`Class Admins loaded: ${Object.keys(cachedScheduleData.classAdmins).length}`);
    } else {
      console.warn("Parsed 0 teachers from Google Sheets. Keeping fallback data.");
    }
  } catch (err: any) {
    console.error("Error syncing with Google Sheets, using fallback or previous cache:", err.message);
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

async function loadSettings(): Promise<{ appsScriptUrl: string }> {
  if (firebaseActive && db) {
    try {
      const docRef = doc(db, "settings", "config");
      const docSnap = await promiseWithTimeout(getDoc(docRef), 3000, "getDoc settings/config");
      if (docSnap.exists()) {
        return docSnap.data() as { appsScriptUrl: string };
      }
    } catch (err: any) {
      console.error("Failed to load settings from Firestore:", err.message);
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

  if (firebaseActive && db) {
    try {
      const docRef = doc(db, "settings", "config");
      await promiseWithTimeout(setDoc(docRef, settings), 3000, "setDoc settings/config");
      console.log("Settings synced to Firestore successfully.");
    } catch (err: any) {
      console.error("Failed to sync settings to Firestore:", err.message);
    }
  }
}

async function loadCachedScheduleFromFirestore() {
  if (firebaseActive && db) {
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
      console.error("Failed to load cached schedule from Firestore:", err.message);
    }
  }
}

async function saveCachedScheduleToFirestore() {
  if (firebaseActive && db) {
    try {
      const docRef = doc(db, "settings", "cached_schedule");
      await promiseWithTimeout(setDoc(docRef, cachedScheduleData), 3000, "setDoc settings/cached_schedule");
      console.log("Cached schedule data saved to Firestore successfully.");
    } catch (err: any) {
      console.error("Failed to save cached schedule to Firestore:", err.message);
    }
  }
}

async function asyncPushToSheets(action: "add" | "edit" | "delete", type: "kelas" | "izin", payload: any) {
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
    }, 4000);
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

async function loadSubmissionsKelas(): Promise<any[]> {
  if (firebaseActive && db) {
    try {
      const colRef = collection(db, "submissions_kelas");
      const querySnapshot = await promiseWithTimeout(getDocs(colRef), 3000, "getDocs submissions_kelas");
      const list: any[] = [];
      querySnapshot.forEach((doc) => {
        list.push(doc.data());
      });
      return list.sort((a, b) => new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime());
    } catch (err: any) {
      console.error("Failed to load submissions kelas from Firestore:", err.message);
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

  if (firebaseActive && db) {
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
      console.error("Failed to sync submissions kelas to Firestore:", err.message);
    }
  }
}

async function loadSubmissionsIzin(): Promise<any[]> {
  if (firebaseActive && db) {
    try {
      const colRef = collection(db, "submissions_izin");
      const querySnapshot = await promiseWithTimeout(getDocs(colRef), 3000, "getDocs submissions_izin");
      const list: any[] = [];
      querySnapshot.forEach((doc) => {
        list.push(doc.data());
      });
      return list.sort((a, b) => new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime());
    } catch (err: any) {
      console.error("Failed to load submissions izin from Firestore:", err.message);
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

  if (firebaseActive && db) {
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
      console.error("Failed to sync submissions izin to Firestore:", err.message);
    }
  }
}

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize data files & load firebase cache on server startup
async function initApp() {
  ensureDataDirectory();
  await loadCachedScheduleFromFirestore();
  // Sync with Google Sheet in background
  syncWithGoogleSheet().then(async () => {
    await saveCachedScheduleToFirestore();
  }).catch(err => {
    console.error("Background sync with Google Sheet failed:", err.message);
  });
}

initApp();

  // API: Sync Google Sheets manually (can be triggered by main admin)
  app.post("/api/sync", async (req, res) => {
    await syncWithGoogleSheet();
    await saveCachedScheduleToFirestore();
    res.json({ success: true, lastSync: cachedScheduleData.lastSync });
  });

  // API: Get reference schedule data
  app.get("/api/schedule", (req, res) => {
    // Return cached schedule immediately (lightning fast!)
    res.json(cachedScheduleData);

    // If still fallback, trigger loading/syncing in the background so it updates for future requests
    if (cachedScheduleData.lastSync === "Never (Using Fallback)") {
      // Run in background without blocking the response
      (async () => {
        try {
          console.log("Loading schedule from Firestore in background...");
          await loadCachedScheduleFromFirestore();
          if (cachedScheduleData.lastSync === "Never (Using Fallback)") {
            console.log("No schedule in cache, syncing live from Sheets in background...");
            await syncWithGoogleSheet();
            await saveCachedScheduleToFirestore();
          }
        } catch (err: any) {
          console.error("Background initial sync failed:", err.message);
        }
      })();
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

  // API: Sync All local data to Google Sheets
  app.post("/api/sync/sheets", async (req, res) => {
    const settings = await loadSettings();
    if (!settings.appsScriptUrl) {
      return res.status(400).json({ success: false, error: "URL Google Apps Script belum dikonfigurasi!" });
    }

    const trimmedUrl = settings.appsScriptUrl.trim();
    if (trimmedUrl.includes("docs.google.com/spreadsheets")) {
      return res.status(400).json({
        success: false,
        error: "URL yang dimasukkan adalah link Spreadsheet, bukan URL Aplikasi Web hasil Deploy. Harap buat Deployment Aplikasi Web di menu Ekstensi > Apps Script dan gunakan URL akhiran '/exec'!"
      });
    }

    try {
      const kelasData = await loadSubmissionsKelas();
      const izinData = await loadSubmissionsIzin();

      console.log("Syncing all data to Google Sheets via Apps Script...");
      const response = await fetchWithTimeout(trimmedUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync_all",
          kelasData,
          izinData
        })
      }, 5000);

      const text = await response.text();
      console.log("Apps Script sync response text (length):", text.length);

      if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html") || text.trim().startsWith("<script")) {
        console.error("Received HTML response instead of JSON. Snippet:", text.substring(0, 300));
        const scriptError = extractAppsScriptError(text);
        return res.status(400).json({
          success: false,
          error: `Google Apps Script Error: ${scriptError}. \n\nPastikan Anda sudah mengikuti petunjuk dengan benar: \n1. Buka Apps Script dari menu Ekstensi > Apps Script di dalam Google Sheet.\n2. Klik tombol "Jalankan" sekali untuk mengizinkan otorisasi Akun Google.\n3. Deploy ulang Web App Anda dengan "Execute as: Me (Saya)" dan "Who has access: Anyone (Siapa saja)".\n4. Pastikan URL berakhiran /exec.`
        });
      }

      let result;
      try {
        result = JSON.parse(text);
      } catch (parseError: any) {
        console.error("Failed to parse response as JSON. Content:", text);
        return res.status(500).json({
          success: false,
          error: `Respon dari Google Apps Script tidak valid JSON. Pastikan script Anda sudah disimpan dan di-Deploy dengan benar. Isi respon: ${text.substring(0, 150)}...`
        });
      }

      if (result.success) {
        return res.json({ success: true, message: "Semua data berhasil disinkronisasikan ke Google Sheets!" });
      } else {
        return res.status(500).json({ success: false, error: result.error || "Gagal sinkronisasi dari Google Apps Script" });
      }
    } catch (e: any) {
      console.error("Error syncing all data:", e);
      return res.status(500).json({ success: false, error: "Gagal terhubung dengan URL Google Apps Script: " + e.message });
    }
  });

  // API: Login verification
  app.post("/api/login", async (req, res) => {
    const { username, password, type, role } = req.body;

    if (!username || !password || !type) {
      return res.status(400).json({ success: false, error: "Username, password, and type are required" });
    }

    const normUsername = username.trim().toLowerCase();

    if (type === "ADMIN") {
      // Validate Admins
      // Admin Utama: admin / admin123junior
      // Admin Tata Usaha: admin / admin123TU
      // Admin BK: admin / admin123BK
      // Admin Tata Tertib: admin / admin123tatib
      if (normUsername !== "admin") {
        return res.status(401).json({ success: false, error: "Username admin salah" });
      }

      let validRole: string | null = null;
      if (password === "admin123junior") validRole = "UTAMA";
      else if (password === "admin123TU") validRole = "TU";
      else if (password === "admin123BK") validRole = "BK";
      else if (password === "admin123tatib") validRole = "TATIB";

      if (validRole && role === validRole) {
        return res.json({
          success: true,
          session: {
            type: "ADMIN",
            username: "admin",
            role: validRole
          }
        });
      } else {
        return res.status(401).json({ success: false, error: "Password atau Role Admin tidak cocok" });
      }
    } else if (type === "STUDENT") {
      // If we haven't synced yet, or if the user is not in the cached list, let's sync live first!
      if (cachedScheduleData.lastSync === "Never (Using Fallback)" || !cachedScheduleData.classAdmins[normUsername]) {
        console.log(`User ${normUsername} not in cache or first sync. Performing on-demand sync from Google Sheet...`);
        try {
          await syncWithGoogleSheet();
        } catch (syncErr: any) {
          console.error("Failed on-demand sync with Google Sheet during student login:", syncErr.message);
        }
      }

      // Validate Class Admin against cached spreadsheet logins
      const expectedPassword = cachedScheduleData.classAdmins[normUsername];
      if (expectedPassword && expectedPassword === password) {
        return res.json({
          success: true,
          session: {
            type: "STUDENT",
            username: normUsername
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
    const data = await loadSubmissionsKelas();
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
      submittedAt: new Date().toISOString()
    };

    data.push(newRecord);
    await saveSubmissionsKelas(data);
    await asyncPushToSheets("add", "kelas", newRecord);

    res.status(201).json({ success: true, data: newRecord });
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
      tanggal: record.tanggal || data[index].tanggal
    };
    await saveSubmissionsKelas(data);
    await asyncPushToSheets("edit", "kelas", data[index]);
    res.json({ success: true, data: data[index] });
  });

  // API: Get Teacher Leave Submissions
  app.get("/api/submissions/izin", async (req, res) => {
    const data = await loadSubmissionsIzin();
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
      submittedAt: new Date().toISOString()
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
      tanggal: record.tanggal || data[index].tanggal
    };
    await saveSubmissionsIzin(data);
    await asyncPushToSheets("edit", "izin", data[index]);
    res.json({ success: true, data: data[index] });
  });

  // Vite integration
  if (!process.env.VERCEL) {
    if (process.env.NODE_ENV !== "production") {
      import("vite").then(({ createServer: createViteServer }) => {
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
