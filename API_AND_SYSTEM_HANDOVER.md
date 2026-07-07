# System Architecture & API Handover Documentation
**Project**: Production Planning & Shopfloor Execution Integration System (SC-PROD)
**Date**: July 2026

Dokumen ini disusun sebagai panduan teknis resmi (*Handover Guide*) untuk pengembang (developer) selanjutnya yang akan melanjutkan maintainability, pengembangan fitur, atau integrasi pada sistem **SC-PROD**.

---

## 📌 1. Ikhtisar Sistem (System Overview)

SC-PROD adalah platform pemantauan & eksekusi produksi shopfloor manufaktur berbasis web yang dirancang khusus untuk berjalan 24/7 di Android Tablet / Kiosk Display.

### High-Level Tech Stack:
- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Vite.
- **Backend Serverless API**: Vercel Node.js Serverless Functions (`/api`).
- **Database & Realtime Engine**: Supabase (PostgreSQL) + Row-Level Realtime Subscriptions.
- **AI Engine**: Google Gemini 3.5 Flash (`@google/genai`) untuk ekstraksi otomatis dokumen SPK/PO.
- **Hardware Integration**: Web Bluetooth LE API (Thermal Label Printer) & Native Screen Wake Lock API.

---

## 📡 2. Dokumentasi Endpoint API (API Reference)

Semua endpoint backend terletak di folder `/api` dan berjalan sebagai Vercel Serverless Functions.

---

### 1. Verifikasi PIN Leader
Menverifikasi autentikasi PIN Leader saat menyelesaikan lot produksi atau sign-off abnormality.

- **Endpoint**: `POST /api/leaders/verify`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "pin": "1234"
  }
  ```
- **Response Success (200 OK)**:
  ```json
  {
    "leader": {
      "id": "ldr-001",
      "name": "Budi Santoso"
    }
  }
  ```
- **Response Error (401 Unauthorized / 400 Bad Request)**:
  ```json
  {
    "error": "Invalid Leader PIN."
  }
  ```
- **Keamanan**: PIN diverifikasi menggunakan hashing `scrypt` + random 16-byte salt dan perbandingan aman `timingSafeEqual()` untuk mencegah *timing attack*.

---

### 2. Ekstraksi Dokumen SPK/PO via AI
Membaca gambar/PDF dokumen SPK atau Forecast pesanan dari customer dan mengonversinya menjadi data order terstruktur.

- **Endpoint**: `POST /api/extract-order`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "fileData": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "mimeType": "image/png"
  }
  ```
- **Response Success (200 OK)**:
  ```json
  {
    "success": true,
    "orders": [
      {
        "customer": "TOYOTA",
        "modelGroup": "INNOVA ZENIX",
        "partName": "COVER BUMPER REAR",
        "volume": 2500,
        "qtyDay": 125,
        "homeMachine": "#MC 08",
        "tonnage": "3500T"
      }
    ]
  }
  ```
- **Engine**: Google Gemini 3.5 Flash dengan JSON Schema Response.

---

### 3. Daftar Leader & Pengelolaan
Mengambil daftar akun leader terdaftar.

- **Endpoint**: `GET /api/leaders`
- **Response Success (200 OK)**:
  ```json
  [
    {
      "id": "ldr-001",
      "name": "Budi Santoso",
      "role": "Leader Shift Day"
    }
  ]
  ```

---

## 🗄️ 3. Skema Database Supabase & File Migrasi SQL

Database menggunakan Supabase (PostgreSQL). File skrip SQL tersedia di akar direktori:

1. `migration_supabase.sql`: Skema utama tabel `jobs`, `rawJobs`, dan `logs`.
2. `migration_leader_pins.sql`: Tabel `leaders` dengan kolom `pin_hash` (`scrypt`) dan `pin_encrypted`.
3. `migration_ng_and_label_counters.sql`: Pelacakan counter label cetak & log NG per job.
4. `seed_master_parts.sql`: Data master parts (Part Number, Spec Kanban, Mold, Cycle Time, Kaviti).

---

## 📱 4. Fitur Khusus Tablet Shopfloor (Kiosk Mechanics)

Developer selanjutnya perlu memahami 3 mekanik utama yang ada pada tablet shopfloor:

### A. Fitur Always-Awake (Anti Sleep Mode)
- **Komponen**: `src/components/layout/TabletControls.tsx`
- **Mekanisme**: Kombinasi `navigator.wakeLock` dan **Canvas-to-MediaStream Loop (30fps)**. Browser dipaksa memperlakukan aplikasi seperti pemutaran video aktif, mencegah Chrome Android masuk ke mode *sleep*.

### B. Bluetooth Printer & Dev Bypass Mode
- **Komponen**: `src/components/production/MachineExecutionView.tsx`
- **Mekanisme**: Menggunakan Web Bluetooth LE (`navigator.bluetooth`).
- **Kuncian Strict Mode**: Sebelum produksi dimulai, koneksi Bluetooth ke printer thermal Wajib aktif.
- **Dev Mode Bypass**: Menyediakan toggle `sugity_dev_bypass_bt` di `localStorage` untuk mematikan kuncian saat testing di lingkungan development.

### C. Penanganan Status Mesin Idle / No Job
- Jika mesin tidak memiliki job aktif, komponen `MachineExecutionView` secara otomatis menampilkan **Card Standby/Idle** berskala penuh dan tidak lagi menampilkan placeholder `N/A`.

---

## ⚙️ 5. Konfigurasi Environment Variables (`.env`)

Developer selanjutnya perlu menyiapkan file `.env` lokal berdasarkan `.env.example`:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Serverless PIN Security
MASTER_LEADER_PIN=8888
PLANNER_PIN=5555
PIN_ENCRYPTION_KEY=64-character-hex-string

# AI Gemini API Key
GEMINI_API_KEY=your-gemini-api-key
```

---

## 🚀 6. Panduan Menjalankan Aplikasi

```bash
# 1. Install dependencies
npm install

# 2. Jalankan lokal server pengujian
npm run dev

# 3. Build produksi
npm run build
```

---
*Dokumentasi ini dibuat untuk menjamin kelancaran handover ke developer selanjutnya.*
