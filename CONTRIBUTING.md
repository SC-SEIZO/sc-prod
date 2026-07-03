# Contributing Guide — Production Planning Integration System

Terima kasih sudah berkontribusi! Harap baca panduan ini sebelum mulai.

---

## ⚠️ Aturan Wajib

> **JANGAN pernah push langsung ke branch `main`.**
> Semua perubahan HARUS melalui Pull Request dan menunggu approval dari pemilik repo.

---

## Alur Kerja (Workflow)

### 1. Clone & Setup

```bash
git clone https://github.com/AKErikanoori/Production-Planning-Integration-System.git
cd Production-Planning-Integration-System
npm install
cp .env.example .env
# Isi .env dengan kredensial yang diberikan oleh pemilik repo
```

### 2. Buat Branch Baru

**Selalu** buat branch baru dari `main` yang terbaru:

```bash
git checkout main
git pull origin main
git checkout -b nama-branch-kamu
```

**Konvensi penamaan branch:**

| Jenis | Format | Contoh |
|-------|--------|--------|
| Fitur baru | `feature/nama-fitur` | `feature/export-pdf` |
| Bug fix | `fix/nama-bug` | `fix/timer-label-error` |
| Perbaikan kecil | `chore/nama-task` | `chore/update-readme` |

### 3. Commit Perubahan

```bash
git add .
git commit -m "feat: deskripsi singkat perubahan"
```

**Format pesan commit:**

| Prefix | Kapan dipakai |
|--------|---------------|
| `feat:` | Menambah fitur baru |
| `fix:` | Memperbaiki bug |
| `chore:` | Update config/dependencies |
| `docs:` | Perubahan dokumentasi |
| `refactor:` | Refactoring kode |

### 4. Push & Buat Pull Request

```bash
git push origin nama-branch-kamu
```

Lalu buka GitHub → klik **"Compare & pull request"** → isi deskripsi → klik **"Create pull request"**.

### 5. Tunggu Review

- Pemilik repo akan mereview perubahan kamu
- Jika ada yang perlu diperbaiki, akan ada komentar di PR
- Setelah **diapprove**, baru bisa di-merge ke `main`

---

## ❌ Yang Tidak Boleh Dilakukan

- ❌ Push langsung ke `main`
- ❌ Commit file `.env` (sudah di-gitignore, tapi tetap hati-hati)
- ❌ Commit folder `node_modules/` atau `dist/`
- ❌ Merge PR sendiri tanpa approval pemilik repo

---

## 📁 Struktur Project

```
src/
├── components/     # React components
├── pages/          # Halaman utama
├── hooks/          # Custom hooks
├── utils/          # Helper functions
└── types/          # TypeScript types

server.ts           # Backend server
vite.config.ts      # Vite config
```

---

## 🔐 Keamanan

- Kredensial (Supabase URL, API keys) **tidak boleh** di-commit
- Gunakan file `.env` lokal (lihat `.env.example` sebagai template)
- Minta kredensial development langsung ke pemilik repo

---

## ❓ Pertanyaan?

Hubungi pemilik repo langsung atau buka [GitHub Issue](https://github.com/AKErikanoori/Production-Planning-Integration-System/issues).
