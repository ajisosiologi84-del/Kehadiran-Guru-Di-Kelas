import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  collection,
  getDocFromServer
} from "firebase/firestore";
import firebaseConfigImport from "../firebase-applet-config.json";
import { ScheduleData, UserSession, AdminRole } from "./types";

// Fallback arrays
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
  "Pendidikan Agama Islam",
  "Pendidikan Agama Kristen",
  "Pendidikan Pancasila",
  "PJOK",
  "Sejarah",
  "Seni Budaya",
  "Sosiologi",
  "Prakarya dan Kewirausahaan"
];

const FALLBACK_JAM_KE = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

const FALLBACK_CLASS_ADMINS: Record<string, string> = {
  "adminkelasx1": "adminkelas2026",
  "adminkelasx2": "adminkelas2026",
  "adminkelasx3": "adminkelas2026",
  "adminkelasx4": "adminkelas2026"
};

const SHEETS_URL = "https://docs.google.com/spreadsheets/d/1I-L5m4C7jOK-3y2hKnzhQEb9GDFzqot7YylhvooC7AM/gviz/tq?tqx=out:csv&sheet=DATA_UTAMA";

// Initialize Firebase
let app: any = null;
let db: any = null;
let firebaseActive = false;

try {
  if (firebaseConfigImport && firebaseConfigImport.apiKey) {
    app = initializeApp(firebaseConfigImport);
    db = initializeFirestore(app, {}, firebaseConfigImport.firestoreDatabaseId || "(default)");
    firebaseActive = true;
    console.log("Client-side Firebase initialized successfully!");
  }
} catch (err: any) {
  console.error("Failed to initialize Firebase Client SDK:", err.message);
}

// Error logger as required by instructions
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on startup as required by instructions
async function testConnection() {
  if (!firebaseActive || !db) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection test passed.");
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration or internet connection.");
    }
  }
}
testConnection();

// CSV line parser helper
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

// Helper with timeout
function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 5000): Promise<Response> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Request timeout")), timeout);
    fetch(url, options)
      .then(res => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch(err => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// Core Firebase Client Service
export const FirebaseService = {
  isConfigured: () => firebaseActive,

  // 1. SETTINGS
  async getSettings() {
    if (firebaseActive && db) {
      const pathStr = "settings/main";
      try {
        const snap = await getDoc(doc(db, "settings", "main"));
        if (snap.exists()) {
          return snap.data() as { appsScriptUrl: string };
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, pathStr);
      }
    }
    
    // Fallback to local storage or fallback value
    const local = localStorage.getItem("presence_settings");
    if (local) {
      try { return JSON.parse(local); } catch (e) {}
    }
    return { appsScriptUrl: "https://script.google.com/macros/s/AKfycbyU3izS72BeaDMovgdNSx8nLMgRBqFDLxa-fcXX0o2YRsllUpJb5K1f-inPCYoG1es0/exec" };
  },

  async saveSettings(settings: { appsScriptUrl: string }) {
    localStorage.setItem("presence_settings", JSON.stringify(settings));
    if (firebaseActive && db) {
      const pathStr = "settings/main";
      try {
        await setDoc(doc(db, "settings", "main"), settings);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, pathStr);
      }
    }
  },

  // 2. SCHEDULE & CLASS ADMINS
  async getScheduleData(): Promise<ScheduleData> {
    if (firebaseActive && db) {
      const pathStr = "settings/cached_schedule";
      try {
        const snap = await getDoc(doc(db, "settings", "cached_schedule"));
        if (snap.exists()) {
          return snap.data() as ScheduleData;
        }
      } catch (err) {
        console.warn("Failed to load cached schedule from Firestore:", err);
      }
    }

    // Try localStorage
    const local = localStorage.getItem("presence_schedule");
    if (local) {
      try { return JSON.parse(local); } catch (e) {}
    }

    // Direct fetch from Google Sheet CSV or fallback
    try {
      const liveData = await this.syncWithGoogleSheet();
      return liveData;
    } catch (e) {
      console.error("Direct fetch failed, returning default fallback data.", e);
      return {
        namaGuruList: FALLBACK_NAMA_GURU,
        mataPelajaranList: FALLBACK_MATA_PELAJARAN,
        jamKeList: FALLBACK_JAM_KE,
        classAdmins: FALLBACK_CLASS_ADMINS,
        lastSync: "Never (Using Fallback)"
      };
    }
  },

  async saveScheduleData(data: ScheduleData) {
    localStorage.setItem("presence_schedule", JSON.stringify(data));
    if (firebaseActive && db) {
      const pathStr = "settings/cached_schedule";
      try {
        await setDoc(doc(db, "settings", "cached_schedule"), data);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, pathStr);
      }
    }
  },

  // 3. SYNCHRONIZATION WITH GOOGLE SHEET (DIRECTLY FROM BROWSER)
  async syncWithGoogleSheet(): Promise<ScheduleData> {
    try {
      console.log("Client-side syncing schedule from Google Sheet...");
      const settings = await this.getSettings();
      
      if (settings.appsScriptUrl) {
        const trimmedUrl = settings.appsScriptUrl.trim();
        if (trimmedUrl && !trimmedUrl.includes("docs.google.com/spreadsheets")) {
          try {
            console.log("Attempting sheet sync via Web App...");
            const response = await fetchWithTimeout(trimmedUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "get_schedule" })
            }, 5000);
            
            if (response.ok) {
              const text = await response.text();
              if (!text.trim().startsWith("<!DOCTYPE") && !text.trim().startsWith("<html")) {
                const result = JSON.parse(text);
                if (result && result.namaGuruList && result.namaGuruList.length > 0) {
                  const schedule: ScheduleData = {
                    namaGuruList: result.namaGuruList,
                    mataPelajaranList: result.mataPelajaranList && result.mataPelajaranList.length > 0 ? result.mataPelajaranList : FALLBACK_MATA_PELAJARAN,
                    jamKeList: result.jamKeList && result.jamKeList.length > 0 ? result.jamKeList : FALLBACK_JAM_KE,
                    classAdmins: result.classAdmins && Object.keys(result.classAdmins).length > 0 ? result.classAdmins : FALLBACK_CLASS_ADMINS,
                    lastSync: new Date().toISOString()
                  };
                  await this.saveScheduleData(schedule);
                  return schedule;
                }
              }
            }
          } catch (scriptErr: any) {
            console.warn("Client Apps Script fetch failed/timed out, falling back to direct CSV fetch:", scriptErr.message);
          }
        }
      }

      // Direct CSV Fetch
      console.log("Fetching live CSV data directly from Google Sheets...");
      const csvResponse = await fetchWithTimeout(SHEETS_URL, {}, 6000);
      if (!csvResponse.ok) {
        throw new Error(`Google Sheets returned HTTP Status ${csvResponse.status}`);
      }
      const text = await csvResponse.text();
      const lines = text.split(/\r?\n/);
      if (lines.length <= 1) {
        throw new Error("Invalid or empty spreadsheet format");
      }

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
          if (username) {
            classAdminsMap[username] = password;
          }
        }
      }

      const finalSchedule: ScheduleData = {
        namaGuruList: namaGuruSet.size > 0 ? Array.from(namaGuruSet) : FALLBACK_NAMA_GURU,
        mataPelajaranList: mataPelajaranSet.size > 0 ? Array.from(mataPelajaranSet) : FALLBACK_MATA_PELAJARAN,
        jamKeList: jamKeSet.size > 0 ? Array.from(jamKeSet).sort((a,b)=>parseInt(a)-parseInt(b)) : FALLBACK_JAM_KE,
        classAdmins: Object.keys(classAdminsMap).length > 0 ? classAdminsMap : FALLBACK_CLASS_ADMINS,
        lastSync: new Date().toISOString()
      };

      await this.saveScheduleData(finalSchedule);
      return finalSchedule;
    } catch (err: any) {
      console.error("Client Google Sheet synchronization failed:", err.message);
      throw err;
    }
  },

  // 4. SUBMISSIONS (KELAS)
  async getSubmissionsKelas(): Promise<any[]> {
    if (firebaseActive && db) {
      const pathStr = "submissions_kelas";
      try {
        const querySnapshot = await getDocs(collection(db, "submissions_kelas"));
        const list: any[] = [];
        querySnapshot.forEach((docSnap) => {
          list.push(docSnap.data());
        });
        return list.sort((a, b) => new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime());
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, pathStr);
      }
    }

    const local = localStorage.getItem("presence_submissions_kelas");
    return local ? JSON.parse(local) : [];
  },

  async addSubmissionKelas(record: any): Promise<any> {
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

    // Save to Firestore
    if (firebaseActive && db) {
      const pathStr = `submissions_kelas/${newRecord.id}`;
      try {
        await setDoc(doc(db, "submissions_kelas", newRecord.id), newRecord);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, pathStr);
      }
    }

    // Save to local cache
    const current = await this.getSubmissionsKelas();
    current.push(newRecord);
    localStorage.setItem("presence_submissions_kelas", JSON.stringify(current));

    // Async push to Sheets
    this.pushToGoogleSheet("add", "kelas", newRecord).catch(e => console.error("Sheet push failed:", e));

    return newRecord;
  },

  async deleteSubmissionKelas(id: string): Promise<boolean> {
    if (firebaseActive && db) {
      const pathStr = `submissions_kelas/${id}`;
      try {
        await deleteDoc(doc(db, "submissions_kelas", id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, pathStr);
      }
    }

    const current = await this.getSubmissionsKelas();
    const updated = current.filter(item => item.id !== id);
    localStorage.setItem("presence_submissions_kelas", JSON.stringify(updated));

    // Async push to Sheets
    this.pushToGoogleSheet("delete", "kelas", { id }).catch(e => console.error("Sheet push failed:", e));

    return true;
  },

  async updateSubmissionKelas(id: string, record: any): Promise<any> {
    const current = await this.getSubmissionsKelas();
    const index = current.findIndex(item => item.id === id);
    if (index === -1) throw new Error("Data tidak ditemukan");

    const updatedRecord = {
      ...current[index],
      namaGuru: record.namaGuru || current[index].namaGuru,
      mataPelajaran: record.mataPelajaran || current[index].mataPelajaran,
      jamKe: record.jamKe || current[index].jamKe,
      keteranganKehadiran: record.keteranganKehadiran || current[index].keteranganKehadiran,
      hari: record.hari || current[index].hari,
      tanggal: record.tanggal || current[index].tanggal
    };

    if (firebaseActive && db) {
      const pathStr = `submissions_kelas/${id}`;
      try {
        await setDoc(doc(db, "submissions_kelas", id), updatedRecord);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, pathStr);
      }
    }

    current[index] = updatedRecord;
    localStorage.setItem("presence_submissions_kelas", JSON.stringify(current));

    // Async push to Sheets
    this.pushToGoogleSheet("edit", "kelas", updatedRecord).catch(e => console.error("Sheet push failed:", e));

    return updatedRecord;
  },

  // 5. SUBMISSIONS (IZIN)
  async getSubmissionsIzin(): Promise<any[]> {
    if (firebaseActive && db) {
      const pathStr = "submissions_izin";
      try {
        const querySnapshot = await getDocs(collection(db, "submissions_izin"));
        const list: any[] = [];
        querySnapshot.forEach((docSnap) => {
          list.push(docSnap.data());
        });
        return list.sort((a, b) => new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime());
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, pathStr);
      }
    }

    const local = localStorage.getItem("presence_submissions_izin");
    return local ? JSON.parse(local) : [];
  },

  async addSubmissionIzin(record: any): Promise<any> {
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

    if (firebaseActive && db) {
      const pathStr = `submissions_izin/${newRecord.id}`;
      try {
        await setDoc(doc(db, "submissions_izin", newRecord.id), newRecord);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, pathStr);
      }
    }

    const current = await this.getSubmissionsIzin();
    current.push(newRecord);
    localStorage.setItem("presence_submissions_izin", JSON.stringify(current));

    // Async push to Sheets
    this.pushToGoogleSheet("add", "izin", newRecord).catch(e => console.error("Sheet push failed:", e));

    return newRecord;
  },

  async deleteSubmissionIzin(id: string): Promise<boolean> {
    if (firebaseActive && db) {
      const pathStr = `submissions_izin/${id}`;
      try {
        await deleteDoc(doc(db, "submissions_izin", id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, pathStr);
      }
    }

    const current = await this.getSubmissionsIzin();
    const updated = current.filter(item => item.id !== id);
    localStorage.setItem("presence_submissions_izin", JSON.stringify(updated));

    // Async push to Sheets
    this.pushToGoogleSheet("delete", "izin", { id }).catch(e => console.error("Sheet push failed:", e));

    return true;
  },

  async updateSubmissionIzin(id: string, record: any): Promise<any> {
    const current = await this.getSubmissionsIzin();
    const index = current.findIndex(item => item.id === id);
    if (index === -1) throw new Error("Data tidak ditemukan");

    const updatedRecord = {
      ...current[index],
      namaGuru: record.namaGuru || current[index].namaGuru,
      mataPelajaran: record.mataPelajaran || current[index].mataPelajaran,
      jamKe: record.jamKe || current[index].jamKe,
      keteranganKehadiran: record.keteranganKehadiran || current[index].keteranganKehadiran,
      keteranganIzinGuru: record.keteranganIzinGuru || current[index].keteranganIzinGuru,
      hari: record.hari || current[index].hari,
      tanggal: record.tanggal || current[index].tanggal
    };

    if (firebaseActive && db) {
      const pathStr = `submissions_izin/${id}`;
      try {
        await setDoc(doc(db, "submissions_izin", id), updatedRecord);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, pathStr);
      }
    }

    current[index] = updatedRecord;
    localStorage.setItem("presence_submissions_izin", JSON.stringify(current));

    // Async push to Sheets
    this.pushToGoogleSheet("edit", "izin", updatedRecord).catch(e => console.error("Sheet push failed:", e));

    return updatedRecord;
  },

  // 6. ASYNC SHEET PUSH (CLIENT SIDE VIA PROXY OR DIRECT)
  async pushToGoogleSheet(action: "add" | "edit" | "delete", type: "kelas" | "izin", payload: any) {
    const settings = await this.getSettings();
    if (!settings.appsScriptUrl) {
      console.log("Apps Script URL not configured, skipping Google Sheets sync.");
      return;
    }
    const trimmedUrl = settings.appsScriptUrl.trim();
    if (trimmedUrl.includes("docs.google.com/spreadsheets")) {
      console.error("Configured Apps Script URL is a spreadsheet URL, not Web App.");
      return;
    }

    try {
      console.log(`Pushing ${action} ${type} directly to Google Sheets...`);
      const response = await fetchWithTimeout(trimmedUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, type, payload })
      }, 5000);
      
      const text = await response.text();
      console.log("Apps Script push response:", text);
    } catch (e: any) {
      console.error("Failed to push to Google Sheet Web App:", e.message);
    }
  },

  // 7. CLIENT-SIDE AUTH CHECKER
  async performLogin(username: string, password: string, type: "ADMIN" | "STUDENT", role?: string): Promise<UserSession> {
    const normUsername = username.trim().toLowerCase();

    if (type === "ADMIN") {
      if (normUsername !== "admin") {
        throw new Error("Username admin salah");
      }

      let validRole: AdminRole | null = null;
      if (password === "admin123junior") validRole = "UTAMA";
      else if (password === "admin123TU") validRole = "TU";
      else if (password === "admin123BK") validRole = "BK";
      else if (password === "admin123tatib") validRole = "TATIB";

      if (validRole && role === validRole) {
        return {
          type: "ADMIN",
          username: "admin",
          role: validRole
        };
      } else {
        throw new Error("Password atau Role Admin tidak cocok");
      }
    } else {
      // Class Admin
      const schedule = await this.getScheduleData();
      const expectedPassword = schedule.classAdmins[normUsername];
      
      if (expectedPassword && expectedPassword === password) {
        return {
          type: "STUDENT",
          username: normUsername
        };
      } else {
        // If not found, try sync with sheet on-demand first
        try {
          const freshSchedule = await this.syncWithGoogleSheet();
          const freshPassword = freshSchedule.classAdmins[normUsername];
          if (freshPassword && freshPassword === password) {
            return {
              type: "STUDENT",
              username: normUsername
            };
          }
        } catch (e) {}
        
        throw new Error("Username atau Password Admin Kelas tidak cocok");
      }
    }
  },

  // 8. SYNC ALL TO GOOGLE SHEET
  async syncAllToGoogleSheet(kelasData: any[], izinData: any[]) {
    const settings = await this.getSettings();
    if (!settings.appsScriptUrl) {
      throw new Error("URL Google Apps Script belum dikonfigurasi!");
    }
    const trimmedUrl = settings.appsScriptUrl.trim();
    if (trimmedUrl.includes("docs.google.com/spreadsheets")) {
      throw new Error("URL yang dimasukkan adalah link Spreadsheet, bukan URL Aplikasi Web hasil Deploy. Harap buat Deployment Aplikasi Web di menu Ekstensi > Apps Script dan gunakan URL akhiran '/exec'!");
    }

    try {
      console.log("Syncing all data to Google Sheets via Apps Script...");
      const response = await fetchWithTimeout(trimmedUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync_all",
          kelasData,
          izinData
        })
      }, 7000);

      const text = await response.text();
      if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
        throw new Error("Apps Script mengembalikan halaman HTML. Pastikan setelan deployment Apps Script Anda memiliki akses 'Anyone'!");
      }
      return text;
    } catch (error: any) {
      throw new Error(error.message || "Gagal mengirim seluruh data ke Google Sheet.");
    }
  }
};
