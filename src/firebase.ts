import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  setLogLevel,
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
  setLogLevel("error");
} catch (e) {}

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

let firestoreQuotaExceeded = false;

// Validate connection to Firestore on startup as required by instructions
async function testConnection() {
  if (!firebaseActive || !db || firestoreQuotaExceeded) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection test passed.");
  } catch (error: any) {
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg.includes('Quota') || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED')) {
      firestoreQuotaExceeded = true;
      console.warn("Firestore quota limit reached. Using Express API and local persistence fallback.");
    } else if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Please check your Firebase configuration or internet connection.");
    } else {
      console.warn("Firestore test connection note:", errMsg);
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

// Helper to catch and log Firestore errors without crashing the caller
function logAndCatchFirestoreError(err: unknown, operationType: OperationType, path: string | null) {
  const errMsg = err instanceof Error ? err.message : String(err);
  if (errMsg.includes('Quota') || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED')) {
    firestoreQuotaExceeded = true;
    console.warn(`[Firestore Quota Limit] Operation ${operationType} on ${path} bypassed via local/server fallback.`);
    return;
  }
  try {
    handleFirestoreError(err, operationType, path);
  } catch (e) {
    console.warn(`[Firestore Fallback] Operation ${operationType} on ${path} failed:`, e);
  }
}

// Core Firebase Client Service
export const FirebaseService = {
  isConfigured: () => firebaseActive,

  // 1. SETTINGS
  async getSettings() {
    // 1. Check local storage
    const local = localStorage.getItem("presence_settings");
    let localSettings: any = null;
    if (local) {
      try {
        localSettings = JSON.parse(local);
      } catch (e) {}
    }

    // 2. Query Firestore with 2s timeout
    if (firebaseActive && db && !firestoreQuotaExceeded) {
      const pathStr = "settings/main";
      try {
        const snap = await promiseWithTimeout(getDoc(doc(db, "settings", "main")), 2000, "getDoc settings/main");
        if (snap.exists()) {
          const data = snap.data();
          return {
            appsScriptUrl: data.appsScriptUrl || "https://script.google.com/macros/s/AKfycbyU3izS72BeaDMovgdNSx8nLMgRBqFDLxa-fcXX0o2YRsllUpJb5K1f-inPCYoG1es0/exec",
            logoUrl: data.logoUrl || "",
            informasiUmum: data.informasiUmum || ""
          };
        }
      } catch (err) {
        logAndCatchFirestoreError(err, OperationType.GET, pathStr);
      }
    }
    
    // 3. Try Server API with 2s timeout
    try {
      const res = await fetchWithTimeout("/api/settings", {}, 2000);
      if (res.ok) {
        const data = await res.json();
        if (data && data.appsScriptUrl !== undefined) {
          return {
            appsScriptUrl: data.appsScriptUrl || "https://script.google.com/macros/s/AKfycbyU3izS72BeaDMovgdNSx8nLMgRBqFDLxa-fcXX0o2YRsllUpJb5K1f-inPCYoG1es0/exec",
            logoUrl: data.logoUrl || "",
            informasiUmum: data.informasiUmum || ""
          };
        }
      }
    } catch (e) {}

    // 4. Fallback to local storage or fallback value
    if (localSettings) {
      return {
        appsScriptUrl: localSettings.appsScriptUrl || "https://script.google.com/macros/s/AKfycbyU3izS72BeaDMovgdNSx8nLMgRBqFDLxa-fcXX0o2YRsllUpJb5K1f-inPCYoG1es0/exec",
        logoUrl: localSettings.logoUrl || "",
        informasiUmum: localSettings.informasiUmum || ""
      };
    }

    return {
      appsScriptUrl: "https://script.google.com/macros/s/AKfycbyU3izS72BeaDMovgdNSx8nLMgRBqFDLxa-fcXX0o2YRsllUpJb5K1f-inPCYoG1es0/exec",
      logoUrl: "",
      informasiUmum: ""
    };
  },

  async saveSettings(settings: { appsScriptUrl: string; logoUrl?: string; informasiUmum?: string }) {
    localStorage.setItem("presence_settings", JSON.stringify(settings));

    try {
      await fetchWithTimeout("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      }, 3000);
    } catch (e) {}

    if (firebaseActive && db && !firestoreQuotaExceeded) {
      const pathStr = "settings/main";
      try {
        await setDoc(doc(db, "settings", "main"), settings);
      } catch (err) {
        logAndCatchFirestoreError(err, OperationType.WRITE, pathStr);
      }
    }
  },

  // 2. SCHEDULE & CLASS ADMINS
  async getScheduleData(): Promise<ScheduleData> {
    // 1. Check local storage for immediate result
    const local = localStorage.getItem("presence_schedule");
    let localSched: ScheduleData | null = null;
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (parsed && parsed.namaGuruList && parsed.namaGuruList.length > 0) {
          localSched = parsed;
        }
      } catch (e) {}
    }

    // 2. Query Firestore with 2s timeout
    if (firebaseActive && db && !firestoreQuotaExceeded) {
      const pathStr = "settings/cached_schedule";
      try {
        const snap = await promiseWithTimeout(getDoc(doc(db, "settings", "cached_schedule")), 2000, "getDoc cached_schedule");
        if (snap.exists()) {
          const data = snap.data() as ScheduleData;
          if (data && data.namaGuruList && data.namaGuruList.length > 0) {
            localStorage.setItem("presence_schedule", JSON.stringify(data));
            return data;
          }
        }
      } catch (err) {
        logAndCatchFirestoreError(err, OperationType.GET, pathStr);
      }
    }

    // 3. Query Server API with 2.5s timeout
    try {
      const res = await fetchWithTimeout("/api/schedule", {}, 2500);
      if (res.ok) {
        const data = await res.json();
        if (data && data.namaGuruList && data.namaGuruList.length > 0) {
          localStorage.setItem("presence_schedule", JSON.stringify(data));
          return data;
        }
      }
    } catch (e) {}

    // 4. Return local cached schedule if available
    if (localSched) {
      return localSched;
    }

    // 5. Default fallback
    return {
      namaGuruList: FALLBACK_NAMA_GURU,
      mataPelajaranList: FALLBACK_MATA_PELAJARAN,
      jamKeList: FALLBACK_JAM_KE,
      classAdmins: FALLBACK_CLASS_ADMINS,
      lastSync: "Never (Using Fallback)"
    };
  },

  async saveScheduleData(data: ScheduleData) {
    localStorage.setItem("presence_schedule", JSON.stringify(data));
    if (firebaseActive && db && !firestoreQuotaExceeded) {
      const pathStr = "settings/cached_schedule";
      try {
        await setDoc(doc(db, "settings", "cached_schedule"), data);
      } catch (err) {
        logAndCatchFirestoreError(err, OperationType.WRITE, pathStr);
      }
    }
  },

  // 3. SYNCHRONIZATION WITH GOOGLE SHEET (VIA SERVER API PROXY TO BYPASS CORS)
  async syncWithGoogleSheet(): Promise<ScheduleData> {
    try {
      console.log("Client-side syncing schedule via server api proxy...");
      const response = await fetch("/api/sync", {
        method: "POST"
      });
      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }
      
      const schedResponse = await fetch("/api/schedule");
      if (!schedResponse.ok) {
        throw new Error(`Failed to load updated schedule: ${schedResponse.status}`);
      }
      const data = await schedResponse.json();
      await this.saveScheduleData(data);
      return data;
    } catch (err: any) {
      console.error("Client Google Sheet synchronization failed, trying to read cached schedule:", err.message);
      const cached = await this.getScheduleData();
      return cached;
    }
  },

  // 4. SUBMISSIONS (KELAS)
  async getSubmissionsKelas(): Promise<any[]> {
    if (firebaseActive && db && !firestoreQuotaExceeded) {
      const pathStr = "submissions_kelas";
      try {
        const querySnapshot = await getDocs(collection(db, "submissions_kelas"));
        const list: any[] = [];
        querySnapshot.forEach((docSnap) => {
          list.push(docSnap.data());
        });
        return list.sort((a, b) => new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime());
      } catch (err) {
        logAndCatchFirestoreError(err, OperationType.LIST, pathStr);
      }
    }

    // Try server API
    try {
      const res = await fetch("/api/submissions/kelas");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          localStorage.setItem("presence_submissions_kelas", JSON.stringify(data));
          return data;
        }
      }
    } catch (e) {}

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
      submittedAt: new Date().toISOString(),
      kelas: record.kelas || ""
    };

    // Try server API
    try {
      await fetch("/api/submissions/kelas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRecord)
      });
    } catch (e) {}

    // Save to Firestore
    if (firebaseActive && db && !firestoreQuotaExceeded) {
      const pathStr = `submissions_kelas/${newRecord.id}`;
      try {
        await setDoc(doc(db, "submissions_kelas", newRecord.id), newRecord);
      } catch (err) {
        logAndCatchFirestoreError(err, OperationType.CREATE, pathStr);
      }
    }

    // Save to local cache
    const current = await this.getSubmissionsKelas();
    if (!current.some((item: any) => item.id === newRecord.id)) {
      current.push(newRecord);
      localStorage.setItem("presence_submissions_kelas", JSON.stringify(current));
    }

    // Async push to Sheets
    this.pushToGoogleSheet("add", "kelas", newRecord).catch(e => console.error("Sheet push failed:", e));

    return newRecord;
  },

  async saveAllSubmissionsKelas(records: any[], mode: 'merge' | 'overwrite' = 'merge'): Promise<any[]> {
    // 1. Try server API
    try {
      const res = await fetch("/api/submissions/kelas/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records, mode })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          localStorage.setItem("presence_submissions_kelas", JSON.stringify(data.data));
          return data.data;
        }
      }
    } catch (e) {}

    // 2. Fallback to local / Firestore
    let current = await this.getSubmissionsKelas();
    let finalList: any[] = [];

    if (mode === 'overwrite') {
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

    localStorage.setItem("presence_submissions_kelas", JSON.stringify(finalList));

    if (firebaseActive && db && !firestoreQuotaExceeded) {
      try {
        const writePromises = finalList.map(item => {
          return setDoc(doc(db, "submissions_kelas", item.id), item);
        });
        await Promise.all(writePromises);
      } catch (err) {
        logAndCatchFirestoreError(err, OperationType.WRITE, "submissions_kelas bulk");
      }
    }

    // Async sync to Apps Script if available
    this.bulkSyncWithAppsScript(finalList, []).catch(() => {});

    return finalList;
  },

  async clearAllSubmissionsKelas(): Promise<boolean> {
    // 1. Delete all docs from Firestore if active
    if (firebaseActive && db && !firestoreQuotaExceeded) {
      try {
        const snap = await getDocs(collection(db, "submissions_kelas"));
        const deletePromises = snap.docs.map(d => deleteDoc(d.ref));
        await Promise.all(deletePromises);
      } catch (err) {
        logAndCatchFirestoreError(err, OperationType.DELETE, "submissions_kelas clear all");
      }
    }

    // 2. Clear local storage
    localStorage.setItem("presence_submissions_kelas", JSON.stringify([]));

    // 3. Clear server-side JSON / file cache
    try {
      await fetch("/api/submissions/kelas/all", { method: "DELETE" });
    } catch (e) {}

    // 4. Sync with Google Sheets
    this.bulkSyncWithAppsScript([], []).catch(() => {});

    return true;
  },

  async clearAllSubmissionsIzin(): Promise<boolean> {
    // 1. Delete all docs from Firestore if active
    if (firebaseActive && db && !firestoreQuotaExceeded) {
      try {
        const snap = await getDocs(collection(db, "submissions_izin"));
        const deletePromises = snap.docs.map(d => deleteDoc(d.ref));
        await Promise.all(deletePromises);
      } catch (err) {
        logAndCatchFirestoreError(err, OperationType.DELETE, "submissions_izin clear all");
      }
    }

    // 2. Clear local storage
    localStorage.setItem("presence_submissions_izin", JSON.stringify([]));

    // 3. Clear server-side JSON / file cache
    try {
      await fetch("/api/submissions/izin/all", { method: "DELETE" });
    } catch (e) {}

    // 4. Sync with Google Sheets
    this.bulkSyncWithAppsScript([], []).catch(() => {});

    return true;
  },

  async deleteSubmissionKelas(id: string): Promise<boolean> {
    if (firebaseActive && db && !firestoreQuotaExceeded) {
      const pathStr = `submissions_kelas/${id}`;
      try {
        await deleteDoc(doc(db, "submissions_kelas", id));
      } catch (err) {
        logAndCatchFirestoreError(err, OperationType.DELETE, pathStr);
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
      tanggal: record.tanggal || current[index].tanggal,
      kelas: record.kelas !== undefined ? record.kelas : current[index].kelas
    };

    if (firebaseActive && db && !firestoreQuotaExceeded) {
      const pathStr = `submissions_kelas/${id}`;
      try {
        await setDoc(doc(db, "submissions_kelas", id), updatedRecord);
      } catch (err) {
        logAndCatchFirestoreError(err, OperationType.UPDATE, pathStr);
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
    if (firebaseActive && db && !firestoreQuotaExceeded) {
      const pathStr = "submissions_izin";
      try {
        const querySnapshot = await getDocs(collection(db, "submissions_izin"));
        const list: any[] = [];
        querySnapshot.forEach((docSnap) => {
          list.push(docSnap.data());
        });
        return list.sort((a, b) => new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime());
      } catch (err) {
        logAndCatchFirestoreError(err, OperationType.LIST, pathStr);
      }
    }

    // Try server API
    try {
      const res = await fetch("/api/submissions/izin");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          localStorage.setItem("presence_submissions_izin", JSON.stringify(data));
          return data;
        }
      }
    } catch (e) {}

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
      submittedAt: new Date().toISOString(),
      kelas: record.kelas || ""
    };

    try {
      await fetch("/api/submissions/izin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRecord)
      });
    } catch (e) {}

    if (firebaseActive && db && !firestoreQuotaExceeded) {
      const pathStr = `submissions_izin/${newRecord.id}`;
      try {
        await setDoc(doc(db, "submissions_izin", newRecord.id), newRecord);
      } catch (err) {
        logAndCatchFirestoreError(err, OperationType.CREATE, pathStr);
      }
    }

    const current = await this.getSubmissionsIzin();
    if (!current.some((item: any) => item.id === newRecord.id)) {
      current.push(newRecord);
      localStorage.setItem("presence_submissions_izin", JSON.stringify(current));
    }

    // Async push to Sheets
    this.pushToGoogleSheet("add", "izin", newRecord).catch(e => console.error("Sheet push failed:", e));

    return newRecord;
  },

  async deleteSubmissionIzin(id: string): Promise<boolean> {
    if (firebaseActive && db && !firestoreQuotaExceeded) {
      const pathStr = `submissions_izin/${id}`;
      try {
        await deleteDoc(doc(db, "submissions_izin", id));
      } catch (err) {
        logAndCatchFirestoreError(err, OperationType.DELETE, pathStr);
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
      tanggal: record.tanggal || current[index].tanggal,
      kelas: record.kelas !== undefined ? record.kelas : current[index].kelas
    };

    if (firebaseActive && db && !firestoreQuotaExceeded) {
      const pathStr = `submissions_izin/${id}`;
      try {
        await setDoc(doc(db, "submissions_izin", id), updatedRecord);
      } catch (err) {
        logAndCatchFirestoreError(err, OperationType.UPDATE, pathStr);
      }
    }

    current[index] = updatedRecord;
    localStorage.setItem("presence_submissions_izin", JSON.stringify(current));

    // Async push to Sheets
    this.pushToGoogleSheet("edit", "izin", updatedRecord).catch(e => console.error("Sheet push failed:", e));

    return updatedRecord;
  },

  // 6. ASYNC SHEET PUSH (VIA SERVER PROXY TO BYPASS BROWSER CORS)
  async pushToGoogleSheet(action: "add" | "edit" | "delete", type: "kelas" | "izin", payload: any) {
    try {
      console.log(`Pushing ${action} ${type} to Google Sheets via server proxy...`);
      const response = await fetch("/api/sync/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, type, payload })
      });
      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }
      const data = await response.json();
      console.log("Proxy push response:", data);
    } catch (e: any) {
      console.error("Failed to push to Google Sheet Web App via proxy:", e.message);
    }
  },

  // 7. CLIENT-SIDE AUTH CHECKER
  async performLogin(username: string, password: string, type: "ADMIN" | "STUDENT" | "TEACHER", role?: string): Promise<UserSession> {
    const rawUsername = username || "";
    const rawPassword = password || "";
    const normUsername = rawUsername.trim().toLowerCase().replace(/\s+/g, '').replace(/-/g, '');
    const normPassword = rawPassword.trim();
    const lowerPassword = normPassword.toLowerCase();

    if (type === "TEACHER") {
      if ((normUsername === "guru" || normUsername.includes("guru")) && (lowerPassword === "gurudoea123" || lowerPassword === "guru123" || lowerPassword === "guru")) {
        return {
          type: "TEACHER",
          username: "guru"
        };
      } else {
        throw new Error("Username atau Password Admin Guru tidak cocok. (Gunakan username: guru, password: gurudoea123)");
      }
    }

    if (type === "ADMIN") {
      if (normUsername !== "admin" && !normUsername.includes("admin")) {
        throw new Error("Username admin salah. Gunakan: admin");
      }

      let validRole: AdminRole | null = null;
      if (lowerPassword === "admin123junior") validRole = "UTAMA";
      else if (lowerPassword === "admin123tu") validRole = "TU";
      else if (lowerPassword === "admin123bk") validRole = "BK";
      else if (lowerPassword === "admin123tatib") validRole = "TATIB";

      // If valid role detected by password, verify role or auto-assign if match
      const targetRole = role || validRole;
      if (validRole && (targetRole === validRole || !role)) {
        return {
          type: "ADMIN",
          username: "admin",
          role: validRole
        };
      } else if (validRole) {
        // Role mismatch with password
        throw new Error(`Password yang dimasukkan adalah untuk Admin ${validRole}, tetapi peran yang dipilih adalah Admin ${role}`);
      } else {
        throw new Error("Password Admin tidak cocok. Silakan periksa kembali password Anda.");
      }
    } else {
      // Class Admin
      const schedule = await this.getScheduleData();
      
      // Helper to search classAdmins with normalized username key
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

      let match = findClassAdminPassword(schedule.classAdmins, normUsername);

      if (match && match.pass.toLowerCase() === lowerPassword) {
        return {
          type: "STUDENT",
          username: match.matchedUser
        };
      }

      // If not found or password mismatched, try sync with sheet on-demand
      try {
        const freshSchedule = await this.syncWithGoogleSheet();
        match = findClassAdminPassword(freshSchedule.classAdmins, normUsername);
        if (match && match.pass.toLowerCase() === lowerPassword) {
          return {
            type: "STUDENT",
            username: match.matchedUser
          };
        }
      } catch (e) {}

      throw new Error("Username atau Password Admin Kelas tidak cocok. Silakan periksa penulisan username & password.");
    }
  },
};
