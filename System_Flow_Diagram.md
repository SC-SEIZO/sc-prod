# System Flow — Integrated Production Planning System
### PT. Sugity Creatives

---

## 1. Overview — Alur Sistem & Role

```mermaid
flowchart TD
    A([🌐 Entrance Portal]) --> B{Pilih Role}

    B --> C[🗂️ PLANNER\nPIN: 5555]
    B --> D[👔 LEADER\nPIN Individu]
    B --> E[🏭 MEMBER\nPIN per Mesin]
    B --> F[👁️ VIEWER\nTanpa PIN]

    C --> C1[Orders\nUpload & Inject]
    C --> C2[Database\nMaster Parts]
    C --> C3[Production\nMonitoring]
    C --> C4[Dashboard\nKPI Overview]

    D --> D1[Production\nMonitoring]
    D --> D2[Pattern Edit\nHeijunka]
    D --> D3[Dandori\nApproval]

    E --> E1[Execute\nKanban View]
    E --> E2[Part List\nJadwal Harian]
    E --> E3[Pattern View\nTimeline]
    E --> E4[Print Label\nPer Box]

    F --> F1[Dashboard\nRead-Only]
    F --> F2[Production\nStatus View]

    C1 -->|Inject to Shopfloor| G[(🗄️ Supabase\nCloud DB)]
    C2 -->|Sync Master Data| G
    D2 -->|Save Pattern| G
    E4 -->|Record Progress| G
    G -->|Realtime Sync| D1
    G -->|Realtime Sync| E1
    G -->|Realtime Sync| F1

    style A fill:#1e293b,color:#fff
    style G fill:#3b82f6,color:#fff
    style C fill:#7c3aed,color:#fff
    style D fill:#0f766e,color:#fff
    style E fill:#b45309,color:#fff
    style F fill:#475569,color:#fff
```

---

## 2. Alur Order — Dari Forecast ke Shopfloor

```mermaid
flowchart TD
    A([📥 Planner\nTerima Forecast]) --> B[Buka Menu Orders\nTab Monthly Forecast]
    B --> C[Upload CSV /\nPaste Data Forecast]
    C --> D{Format CSV\nValid?}

    D -->|❌ Tidak Valid| E[⚠️ Error Parsing\nPerbaiki Format CSV]
    E --> C

    D -->|✅ Valid| F[Preview Mapping\nCustomer Part → Sebango]
    F --> G{Semua Part\nTerdaftar di Master?}

    G -->|❌ Ada Part Baru| H[Buka Database Manager\nTambah Master Part]
    H --> F

    G -->|✅ Semua Terdaftar| I[Klik Inject to Shopfloor]
    I --> J[(Supabase\nProduction Plans)]
    J --> K[Heijunka Engine\nHitung Jadwal Optimal]
    K --> L[Pattern Harian\nper Mesin Terbentuk]

    L --> M[👔 Leader\nMelihat Pattern di Gantt Chart]
    L --> N[🏭 Member\nMelihat Job di Execute Tab]

    style A fill:#7c3aed,color:#fff
    style J fill:#3b82f6,color:#fff
    style K fill:#059669,color:#fff
    style H fill:#dc2626,color:#fff
```

---

## 3. Alur Eksekusi Produksi Harian (Per Mesin)

```mermaid
flowchart TD
    START([🌅 Awal Shift]) --> A[Member Login\nPilih Factory & Mesin\nMasukkan Nama + PIN]
    A --> B{PIN\nValid?}
    B -->|❌| A
    B -->|✅| C[Masuk Member Console]

    C --> D[Cek Part List\nJadwal Produksi Hari Ini]
    D --> E{Sesuai dengan\nKondisi Aktual?}
    E -->|❌ Tidak Sesuai| F[Lapor ke Leader\nMinta Adjustment Pattern]
    F --> D
    E -->|✅ Sesuai| G

    G([▶️ Mulai Produksi\nJob Pertama])

    G --> H{Pergantian\nPart / Dandori?}
    H -->|Ya| I[🤝 Minta Persetujuan Leader]
    I --> J{Leader\nSetuju?}
    J -->|❌ Belum Siap| K[Tunggu / Siapkan\nMold & Material]
    K --> J
    J -->|✅ Disetujui| L[Mulai Dandori\nSetup Mesin]
    L --> M[Sistem Catat\nDandori Start Time]
    M --> N[Dandori Selesai\nKonfirmasi ke Leader]
    N --> O[Sistem Catat\nDandori End Time]
    O --> P[▶️ Produksi Running]

    H -->|Tidak| P

    P --> Q{Satu Box\nPenuh?}
    Q -->|Belum| P

    Q -->|✅ Box Penuh| R{Print Lock\nAktif?}
    R -->|🔒 Terkunci\nMesin belum cukup jalan| S[Tunggu Sampai\nSystem Unlock Otomatis]
    S --> R
    R -->|🔓 Bebas| T[Klik Print Label\ndi Console]

    T --> U[Preview Label\nCek: Part, Qty, Nama, Jam]
    U --> V{Label\nSudah Benar?}
    V -->|❌ Salah| W[Tutup / Koreksi\nTidak Dicetak]
    W --> T
    V -->|✅ Benar| X[Print ke Printer]
    X --> Y[Tempel Label\ndi Box]
    Y --> Z[Sistem Record Progress\nSync ke Supabase]

    Z --> AA{Semua Box\nSelesai untuk Job Ini?}
    AA -->|Belum| P
    AA -->|✅ Selesai| AB{Ada Job\nBerikutnya?}
    AB -->|Ya| H
    AB -->|Tidak / Akhir Shift| DONE

    DONE([🌙 Akhir Shift\nLapor Leader & Logout])

    style START fill:#1e293b,color:#fff
    style DONE fill:#1e293b,color:#fff
    style I fill:#0f766e,color:#fff
    style J fill:#0f766e,color:#fff
    style X fill:#b45309,color:#fff
    style Z fill:#3b82f6,color:#fff
    style R fill:#dc2626,color:#fff
```

---

## 4. Alur Penanganan Abnormality

```mermaid
flowchart TD
    A([⚠️ Terjadi Gangguan\ndi Mesin]) --> B{Jenis\nGangguan?}

    B -->|Mesin Trouble| C[Hentikan Mesin\nAmankan Kondisi]
    B -->|Mold Problem| D[Lapor ke Leader\nJangan Paksa Produksi]
    B -->|Material Habis| E[Lapor ke Leader\nMinta Resupply]
    B -->|Kualitas NG| F[Pisahkan Produk NG\nJangan Campur dengan OK]

    C --> G[📱 Lapor Verbal\nke Leader]
    D --> G
    E --> G
    F --> G

    G --> H[Member Input\nLog Abnormality di Console]
    H --> I[Pilih Tipe Abnormality\nCatat Keterangan]
    I --> J[(Sistem Catat\nLog + Timestamp)]

    J --> K[👔 Leader Terima\nNotifikasi di System]
    K --> L[Leader Cek Kondisi\ndi Genba]
    L --> M{Bisa\nDiselesaikan?}

    M -->|✅ Ya| N[Tindakan Perbaikan]
    N --> O[Produksi Dilanjutkan]
    O --> P[Leader / Member\nCatat Resolusi di System]

    M -->|❌ Butuh Eskalasi| Q[Eskalasi ke\nPlanner / Maintenance]
    Q --> R[Hentikan Produksi\nMesin Tersebut]
    R --> S[Planner Adjust\nJadwal Mesin Lain]

    style A fill:#dc2626,color:#fff
    style J fill:#3b82f6,color:#fff
    style K fill:#0f766e,color:#fff
    style Q fill:#7c3aed,color:#fff
```

---

## 5. Alur Data Sync — Client ↔ Supabase

```mermaid
flowchart LR
    subgraph CLIENT["📱 Client (Browser)"]
        direction TB
        C1[User Action\ne.g. Print Label]
        C2[State Update\nReact Context]
        C3[localStorage\nOffline Cache]
    end

    subgraph SYNC["🔄 Sync Layer"]
        direction TB
        S1[Optimistic Update\nUI langsung berubah]
        S2[Supabase Upsert\nasync background]
        S3[Realtime Channel\nPostgres Changes]
        S4[Polling Fallback\nSetiap 10 detik]
    end

    subgraph DB["☁️ Supabase"]
        direction TB
        D1[(production_plans)]
        D2[(label_counters)]
        D3[(parts)]
        D4[(orders)]
    end

    C1 --> S1
    S1 --> C2
    C2 --> C3
    C2 --> S2
    S2 --> D1
    S2 --> D2

    D1 -->|INSERT/UPDATE event| S3
    S3 -->|Push ke semua device| C2

    D1 -->|Backup polling| S4
    S4 --> C2

    style CLIENT fill:#1e293b,color:#fff
    style SYNC fill:#0f766e,color:#fff
    style DB fill:#3b82f6,color:#fff
```

---

## 6. Ringkasan Interaksi Antar Role

```mermaid
sequenceDiagram
    participant P as 🗂️ Planner
    participant S as ☁️ Supabase
    participant L as 👔 Leader
    participant M as 🏭 Member

    Note over P,M: Fase Planning (Awal Bulan)
    P->>S: Upload Forecast & Inject to Shopfloor
    S->>S: Heijunka Engine hitung jadwal
    S-->>L: Pattern tersedia di Production Page
    S-->>M: Job list tersedia di Member Console

    Note over P,M: Fase Produksi (Harian)
    M->>L: Minta persetujuan Dandori
    L->>M: ✅ Setuju — Mulai Dandori
    M->>S: Konfirmasi Dandori Start
    M->>S: Konfirmasi Dandori End + Produksi Running

    loop Setiap Box Penuh
        M->>S: Print Label → Record Progress
        S-->>L: Update progress real-time
        S-->>P: Update KPI Dashboard
    end

    Note over P,M: Jika Ada Abnormality
    M->>L: Lapor Abnormality (verbal + log di sistem)
    L->>S: Catat resolusi
    L->>M: Instruksi tindak lanjut
    alt Bisa diselesaikan
        M->>S: Lanjut produksi
    else Butuh eskalasi
        L->>P: Eskalasi → Adjust jadwal
    end
```

---

*Flow diagram ini mencerminkan arsitektur dan alur kerja sistem **Integrated Production Planning System** PT. Sugity Creatives berdasarkan source code produksi terkini.*
