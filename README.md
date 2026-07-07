# Production Planning & Shopfloor Execution Integration System (SC-PROD)

Sistem Pemantauan Rencana Produksi & Eksekusi Shopfloor Realtime berbasis Web Kiosk Tablet.

---

## 📚 Dokumentasi Developer & Handover

Untuk kemudahan handover ke pengembang (developer) selanjutnya, dokumentasi sistem telah disusun secara lengkap:

- 📖 **[Dokumentasi Arsitektur & API Reference (Handover Guide)](./API_AND_SYSTEM_HANDOVER.md)** — Berisi spesifikasi lengkap endpoint `/api`, skema database Supabase, algoritma keamanan PIN, integrasi AI Gemini, dan mekanik Always-Awake tablet.
- 🤝 **[Panduan Kontribusi & Git Workflow](./CONTRIBUTING.md)** — Berisi aturan branch (`feature/`, `fix/`), konvensi commit, dan prosedur Pull Request.

---

## 🚀 Cara Menjalankan Lokal

### Prasyarat:
- Node.js (v18+)
- npm / yarn

### Langkah-langkah:
1. Clone repositori & install dependensi:
   ```bash
   git clone https://github.com/AKErikanoori/Production-Planning-Integration-System.git
   cd Production-Planning-Integration-System
   npm install
   ```

2. Salin environment template:
   ```bash
   cp .env.example .env
   ```
   *Isi file `.env` dengan kredensial Supabase & Gemini API Key.*

3. Jalankan server development lokal:
   ```bash
   npm run dev
   ```

---

## 🛠️ Fitur-Fitur Utama
- 📺 **Shopfloor Tablet Mode (Always-Awake)**: Mencegah layar tablet Android masuk ke mode *sleep* secara otomatis 24/7.
- ⚡ **Realtime Broadcast Sync**: Perubahan progress produksi ter-sync secara instan ke seluruh monitor shopfloor via Supabase Realtime.
- 🖨️ **Bluetooth Thermal Printer Integration**: Kuncian koneksi printer label Kanban sebelum produksi dimulai.
- 🤖 **AI Order Extractor**: Ekstraksi dokumen SPK/PO otomatis menggunakan Google Gemini 3.5 Flash.
- 🔐 **Security PIN Hashing**: Pengamanan PIN Leader menggunakan algoritma `scrypt` dan perlindungan *timing attack*.
