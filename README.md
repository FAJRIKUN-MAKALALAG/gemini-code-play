# 🤖 UNKLAB AI Code — AI-Powered Python Coding Platform

> Platform coding interaktif berbasis AI untuk lingkungan akademik. Tulis, jalankan, dan pelajari Python dengan bantuan Gemini AI secara real-time.

[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.x-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## ✨ Fitur Utama

### 📓 Notebook Editor (Multi-Cell)
- Editor berformat **notebook** (mirip Jupyter Notebook) langsung di browser
- Tambah, hapus, susun ulang, dan jalankan per-cell secara independen
- Kirim kode cell ke AI Chat dengan satu klik
- Simpan kode ke database dan sinkronkan dengan sesi chat aktif

### ▶️ Python Runtime (Browser-Based)
- Jalankan Python **tanpa instalasi** menggunakan runtime [Skulpt](https://skulpt.org/) berbasis WebAssembly
- Dukungan penuh `stdin`/`stdout` untuk program interaktif
- Terminal terintegrasi untuk menampilkan output dan error

### 🤖 Gemini AI Chat Assistant
- Didukung oleh **Google Gemini Flash**
- Streaming response dengan tombol **Stop** untuk menghentikan generasi
- Manajemen histori dengan **sliding window** agar hemat token
- Konteks kode notebook aktif dikirim secara otomatis
- Modal **FAQ Interaktif** untuk membantu pengguna baru

### 🏆 Sistem Ujian Online (Challenge System)
- **Pengajar** dapat membuat ujian dengan:
  - Multiple soal per ujian
  - Deskripsi soal berupa **teks dan/atau gambar**
  - Ekspektasi output berupa **teks dan/atau gambar**
  - Batas waktu opsional (countdown timer)
  - Kode room otomatis untuk distribusi peserta
- **Peserta** bergabung via kode room dan mengerjakan soal di editor
- Soal ditampilkan dalam **tab navigasi** (multi-question)
- **Review jawaban real-time** — pengajar pantau status dan lihat kode jawaban peserta
- Upload gambar soal menggunakan **Supabase Storage** (via backend service role)

### 📋 Kuesioner Penelitian
- Sistem kuesioner terintegrasi untuk pengumpulan data penelitian
- Admin panel real-time dengan toggle aktif/nonaktif
- Statistik responden real-time
- Tampil otomatis di landing page saat diaktifkan admin

### 👤 Manajemen Pengguna
- Autentikasi aman via **Google OAuth 2.0**
- Halaman profil: ubah username dan avatar
- Sinkronisasi profil real-time lintas komponen
- Password reset via email (untuk akun email/password)

### 🎨 UI/UX
- **Dark / Light Mode** dengan persistensi via localStorage
- Animasi scroll-reveal dan particle canvas di landing page
- Responsive — mendukung mobile dengan bottom navigation bar
- Layout resizable panel (desktop) menggunakan `react-resizable-panels`
- CI/CD pipeline via **Jenkinsfile** (opsional)

---

## 🏗️ Tech Stack

| Layer | Teknologi |
|---|---|
| **Frontend Framework** | Vite + React 18 + TypeScript |
| **Styling** | Tailwind CSS + shadcn/ui |
| **State Management** | React Context + TanStack Query |
| **Routing** | React Router v6 |
| **Python Runtime** | Skulpt (WebAssembly) |
| **AI Backend** | Google Gemini Flash (via Node.js/Express) |
| **Database & Auth** | Supabase (PostgreSQL, RLS, OAuth) |
| **File Storage** | Supabase Storage |
| **Icons** | Lucide React |
| **SEO** | react-helmet-async |

---

## 🚀 Memulai (Development)

### Prasyarat
- Node.js >= 18
- npm atau bun

### 1. Clone repositori

```sh
git clone <YOUR_GIT_URL>
cd gemini-code-play
```

### 2. Install dependensi

```sh
npm install
# atau
bun install
```

### 3. Konfigurasi environment

Buat file `.env` di root project:

```env
VITE_API_BASE_URL=https://api.unklab-aicode.online/api
```

> Untuk development lokal, ganti dengan URL backend lokal Anda (misal `http://localhost:3000/api`).

### 4. Jalankan development server

```sh
npm run dev
```

Akses di `http://localhost:5173`

---

## 🔐 Variabel Environment

| Variabel | Deskripsi | Contoh |
|---|---|---|
| `VITE_API_BASE_URL` | Base URL API backend | `https://api.unklab-aicode.online/api` |

---

## 📁 Struktur Proyek

```
src/
├── components/
│   ├── LandingPage.tsx       # Landing page utama
│   ├── NotebookEditor.tsx    # Editor multi-cell (Jupyter-like)
│   ├── ChatInterface.tsx     # AI Chat panel
│   ├── ChatSidebar.tsx       # Sidebar histori percakapan
│   ├── Navbar.tsx            # Navigasi atas
│   ├── AuthScreen.tsx        # Modal login/register
│   ├── FAQModal.tsx          # FAQ interaktif
│   ├── Terminal.tsx          # Output terminal
│   └── ThemeProvider.tsx     # Dark/light mode provider
├── pages/
│   ├── Index.tsx             # Halaman utama (editor + chat)
│   ├── Profile.tsx           # Halaman profil pengguna
│   ├── CreateChallenge.tsx   # Buat & kelola ujian (pengajar)
│   ├── JoinChallenge.tsx     # Bergabung ujian (peserta)
│   ├── SolveChallenge.tsx    # Kerjakan ujian
│   ├── ReviewAnswers.tsx     # Review jawaban real-time
│   ├── Kuesioner.tsx         # Form kuesioner penelitian
│   ├── AdminKuesioner.tsx    # Admin panel kuesioner
│   ├── PrivacyPolicy.tsx     # Kebijakan privasi
│   └── TermsOfService.tsx    # Syarat layanan
├── context/
│   └── AuthContext.tsx       # Konteks autentikasi global
├── services/
│   ├── authService.ts        # Layanan autentikasi
│   ├── backendService.ts     # API calls ke backend
│   └── kuesionerService.ts   # Layanan kuesioner
├── hooks/                    # Custom React hooks
├── utils/
│   └── skulptRunner.ts       # Python runtime loader
└── App.tsx                   # Routing utama
```

---

## 🧪 Alur Sistem Ujian

```
Pengajar                           Peserta
   │                                  │
   ├─ Buat Ujian (judul + batas waktu)│
   ├─ Tambah Soal (teks/gambar)       │
   ├─ Bagikan Kode Room ──────────────┤
   │                                  ├─ Input Kode Room
   │                                  ├─ Mulai Ujian (timer aktif)
   │                                  ├─ Kerjakan Soal (per tab)
   │                                  └─ Submit Jawaban
   │
   └─ Review Jawaban Real-Time (live monitor)
```

---

## 📦 Build & Deployment

### Build produksi

```sh
npm run build
```

Output ada di folder `dist/`.

### Deploy

Deploy folder `dist/` ke static hosting mana pun:
- **Vercel** / **Netlify** (rekomendasikan untuk kemudahan CI/CD)
- **VPS + Nginx** (untuk kontrol penuh)
- **Jenkins CI/CD** — sudah tersedia `Jenkinsfile` di root project

### CI/CD dengan Jenkins

Lihat `Jenkinsfile` dan `SetUpJenkinsCICD.txt` untuk panduan setup pipeline otomatis.

---

## 🔗 Endpoint API Utama (Backend)

> Backend adalah repo terpisah (Node.js/Express + Supabase).

| Method | Endpoint | Deskripsi |
|---|---|---|
| `POST` | `/api/chat` | Kirim pesan ke Gemini AI |
| `GET` | `/api/challenges/creator` | Daftar ujian milik pengajar |
| `POST` | `/api/challenges` | Buat ujian baru |
| `POST` | `/api/challenges/:id/questions` | Tambah soal ke ujian |
| `POST` | `/api/challenges/upload-image` | Upload gambar soal ke Supabase |
| `GET` | `/api/challenges/:id/answers` | Ambil jawaban peserta |
| `GET` | `/api/kuesioner/status` | Status kuesioner aktif/tidak |
| `POST` | `/api/kuesioner/submit` | Submit respons kuesioner |

---

## 📄 Lisensi

MIT License © {new Date().getFullYear()} UNKLAB AI Code Team

---

> Dibangun untuk mendukung pembelajaran pemrograman berbasis AI di lingkungan akademik.
