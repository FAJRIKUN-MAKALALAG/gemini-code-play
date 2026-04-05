import { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import {
  Loader2, ShieldCheck, LogOut, BarChart3, Users, Award,
  TrendingUp, RefreshCw, ChevronDown, ChevronUp
} from "lucide-react";
import { kuesionerService, AdminKuesionerStats, KuesionerResponse } from "@/services/kuesionerService";
import { authService } from "@/services/authService";
import { useAuth } from "@/context/AuthContext";

// ─── Label pertanyaan ─────────────────────────────────────────────────────────
const PERTANYAAN_LABEL = [
  "Tampilan sistem mudah dipahami",
  "Login dan registrasi berjalan dengan baik",
  "Code editor mudah digunakan",
  "Fitur Run Code berjalan dengan baik",
  "Output program ditampilkan dengan jelas",
  "AI Chat membantu memahami kode",
  "AI memberikan jawaban yang relevan",
  "AI Debug membantu menemukan kesalahan kode",
  "Sistem membantu proses belajar pemrograman",
  "Sistem mudah digunakan secara keseluruhan",
];

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({
  icon: Icon, label, value, sub, color
}: { icon: React.ElementType; label: string; value: string | number; sub?: string; color: string }) => (
  <div className={`relative overflow-hidden rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm p-5 shadow-sm`}>
    <div className={`absolute -top-4 -right-4 w-20 h-20 rounded-full ${color} opacity-10 blur-xl`} />
    <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${color} bg-opacity-15 mb-3`}>
      <Icon className={`w-5 h-5 ${color.replace("bg-", "text-")}`} />
    </div>
    <p className="text-2xl font-bold">{value}</p>
    <p className="text-xs font-medium text-muted-foreground mt-0.5">{label}</p>
    {sub && <p className="text-[11px] text-muted-foreground/70 mt-1">{sub}</p>}
  </div>
);

// ─── Bar visual ───────────────────────────────────────────────────────────────
const MiniBar = ({ value, max, color }: { value: number; max: number; color: string }) => (
  <div className="flex items-center gap-2 min-w-[80px]">
    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
      <div
        className={`h-full ${color} rounded-full transition-all duration-700`}
        style={{ width: max > 0 ? `${(value / max) * 100}%` : "0%" }}
      />
    </div>
    <span className="text-xs text-muted-foreground w-5 text-right">{value}</span>
  </div>
);

// ─── Main admin page ──────────────────────────────────────────────────────────
const AdminKuesioner = () => {
  const { user, isLoading: isAuthLoading, logout } = useAuth();
  const navigate = useNavigate();

  // Auth states
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  // Admin login form (jika belum login)
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Data states
  const [stats, setStats] = useState<AdminKuesionerStats | null>(null);
  const [responses, setResponses] = useState<KuesionerResponse[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // UI states
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ── Load data setelah konfirmasi admin ──────────────────────────────────────
  const loadData = useCallback(async () => {
    setDataLoading(true);
    setDataError(null);

    const [statsResult, responsesResult] = await Promise.all([
      kuesionerService.fetchAdminStats(),
      kuesionerService.fetchAllResponses(),
    ]);

    if (statsResult.error === "Akses ditolak. Hanya admin yang dapat melihat halaman ini." ||
        responsesResult.error === "Akses ditolak.") {
      setIsAdmin(false);
      setAccessDenied(true);
    } else {
      if (statsResult.error) setDataError(statsResult.error);
      else setStats(statsResult.data);

      if (responsesResult.data) setResponses(responsesResult.data);
    }

    setDataLoading(false);
  }, []);

  // ── Cek role admin dari backend ─────────────────────────────────────────────
  useEffect(() => {
    if (isAuthLoading) return;

    if (!user) {
      // Belum login — tampilkan form login
      setAuthChecked(true);
      return;
    }

    // Sudah login, verify ke backend apakah admin
    (async () => {
      const { data, error } = await kuesionerService.fetchAdminStats();
      if (error === "Akses ditolak. Hanya admin yang dapat melihat halaman ini.") {
        setIsAdmin(false);
        setAccessDenied(true);
      } else if (error === "Sesi tidak valid. Silakan login ulang.") {
        setIsAdmin(false);
      } else {
        setIsAdmin(true);
        setStats(data);
        // juga load responses
        const respResult = await kuesionerService.fetchAllResponses();
        if (respResult.data) setResponses(respResult.data);
      }
      setAuthChecked(true);
      setDataLoading(false);
    })();
  }, [user, isAuthLoading, loadData]);

  // ── Handle login form ───────────────────────────────────────────────────────
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    const { error } = await authService.login(loginEmail, loginPassword);
    if (error) {
      setLoginLoading(false);
      setLoginError("Email atau password salah.");
      return;
    }

    // Setelah login, cek admin
    const { data, error: adminError } = await kuesionerService.fetchAdminStats();
    setLoginLoading(false);

    if (adminError === "Akses ditolak. Hanya admin yang dapat melihat halaman ini.") {
      setAccessDenied(true);
      return;
    }
    if (adminError) {
      setLoginError(adminError);
      return;
    }

    setIsAdmin(true);
    setStats(data);
    const respResult = await kuesionerService.fetchAllResponses();
    if (respResult.data) setResponses(respResult.data);
    setAuthChecked(true);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const handleLogout = async () => {
    await logout();
    setIsAdmin(false);
    setStats(null);
    setResponses([]);
    setLoginEmail("");
    setLoginPassword("");
  };

  // ── Loading awal ────────────────────────────────────────────────────────────
  if (!authChecked || isAuthLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  // ── Akses ditolak (login tapi bukan admin) ──────────────────────────────────
  if (accessDenied) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Helmet><title>Akses Ditolak</title></Helmet>
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Akses Ditolak</h1>
          <p className="text-muted-foreground text-sm mb-6">
            Akun yang Anda gunakan tidak memiliki akses admin.
          </p>
          <button
            onClick={() => navigate("/")}
            className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 transition-all"
          >
            Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  // ── Belum login → form login admin ─────────────────────────────────────────
  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Helmet><title>Admin Panel – Kuesioner</title></Helmet>

        {/* Background blobs */}
        <div className="fixed inset-0 pointer-events-none -z-10">
          <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] bg-primary/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[120px]" />
        </div>

        <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-5 duration-500">
          <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 text-center bg-gradient-to-b from-primary/5 to-transparent border-b border-border/30">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="w-7 h-7 text-primary" />
              </div>
              <h1 className="text-xl font-bold">Admin Panel</h1>
              <p className="text-muted-foreground text-xs mt-1">Login dengan akun admin untuk melanjutkan</p>
            </div>

            <form onSubmit={handleAdminLogin} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="admin-email" className="text-sm font-medium">Email</label>
                <input
                  id="admin-email"
                  type="email"
                  placeholder="admin@example.com"
                  value={loginEmail}
                  onChange={(e) => { setLoginEmail(e.target.value); setLoginError(null); }}
                  className="w-full px-3 py-2.5 rounded-xl border border-border/60 bg-background/50 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                  required
                  disabled={loginLoading}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="admin-password" className="text-sm font-medium">Password</label>
                <input
                  id="admin-password"
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => { setLoginPassword(e.target.value); setLoginError(null); }}
                  className="w-full px-3 py-2.5 rounded-xl border border-border/60 bg-background/50 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                  required
                  disabled={loginLoading}
                />
              </div>

              {loginError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-500 animate-in fade-in duration-200">
                  {loginError}
                </div>
              )}

              <button
                id="admin-login-btn"
                type="submit"
                disabled={loginLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-purple-600 text-white font-semibold text-sm shadow-lg shadow-primary/20 hover:opacity-90 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loginLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Memverifikasi...</> : "Masuk sebagai Admin"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── Dashboard admin ─────────────────────────────────────────────────────────
  const SKOR_MAKS = stats ? stats.skor_maksimum : 0;
  const TOTAL_SKOR = stats ? stats.total_skor_semua : 0;
  const PERSENTASE = stats ? stats.persentase : 0;
  const JUMLAH_RESPONDEN = stats ? stats.jumlah_responden : 0;

  // Kategori kepuasan berdasarkan 5 tingkat
  const getKategori = (p: number) => {
    if (p >= 81) return { label: "Sangat Baik", emoji: "🟢", color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/30" };
    if (p >= 61) return { label: "Baik",        emoji: "🟦", color: "text-teal-500",    bg: "bg-teal-500/10 border-teal-500/30" };
    if (p >= 41) return { label: "Cukup",       emoji: "🟡", color: "text-amber-500",  bg: "bg-amber-500/10 border-amber-500/30" };
    if (p >= 21) return { label: "Kurang",      emoji: "🟠", color: "text-orange-500", bg: "bg-orange-500/10 border-orange-500/30" };
    return              { label: "Sangat Kurang",emoji: "🔴", color: "text-red-500",    bg: "bg-red-500/10 border-red-500/30" };
  };
  const kategori = getKategori(PERSENTASE);
  const persentaseColor = kategori.color;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Dashboard Admin – Hasil Kuesioner</title>
      </Helmet>

      {/* Top bar */}
      <div className="h-1 w-full bg-gradient-to-r from-primary via-purple-500 to-pink-500" />

      {/* Background blobs */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[-5%] left-[-5%] w-[350px] h-[350px] bg-primary/8 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-5%] right-[-5%] w-[350px] h-[350px] bg-purple-500/8 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        {/* ── Navbar admin ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-none">Admin Panel</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Hasil Kuesioner Kepuasan Pengguna</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border/50 bg-card/50 text-xs font-medium hover:bg-muted/50 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-500/30 bg-red-500/5 text-xs font-medium text-red-500 hover:bg-red-500/10 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </div>

        {dataLoading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : dataError ? (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-sm text-red-500">
            {dataError}
          </div>
        ) : (
          <>
            {/* ── Stat Cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={BarChart3} label="Jumlah Pertanyaan" value={10} color="bg-primary" />
              <StatCard icon={Users} label="Jumlah Responden" value={JUMLAH_RESPONDEN} color="bg-purple-500" />
              <StatCard icon={Award} label="Skor Maksimum" value={SKOR_MAKS} sub={`10 × ${JUMLAH_RESPONDEN} × 5`} color="bg-amber-500" />
              <StatCard icon={TrendingUp} label="Total Skor" value={TOTAL_SKOR} color="bg-emerald-500" />
            </div>

            {/* ── Formula & Persentase ── */}
            <div className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl p-6 shadow-sm">
              <h2 className="text-base font-semibold mb-5 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Perhitungan Persentase Kepuasan
              </h2>
              <div className="grid md:grid-cols-2 gap-6 items-center">
                <div className="space-y-3">
                  <div className="overflow-hidden rounded-xl border border-border/40">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/40">
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Parameter</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-xs">Nilai</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        <tr>
                          <td className="px-4 py-2.5 text-sm">Jumlah Pertanyaan</td>
                          <td className="px-4 py-2.5 text-sm font-mono text-right font-semibold">10</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2.5 text-sm">Jumlah Responden</td>
                          <td className="px-4 py-2.5 text-sm font-mono text-right font-semibold">{JUMLAH_RESPONDEN}</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2.5 text-sm">Skor Tertinggi</td>
                          <td className="px-4 py-2.5 text-sm font-mono text-right font-semibold">5</td>
                        </tr>
                        <tr className="bg-muted/20">
                          <td className="px-4 py-2.5 text-sm font-medium">Skor Maksimum</td>
                          <td className="px-4 py-2.5 text-sm font-mono text-right font-bold text-primary">
                            10 × {JUMLAH_RESPONDEN} × 5 = {SKOR_MAKS}
                          </td>
                        </tr>
                        <tr className="bg-muted/20">
                          <td className="px-4 py-2.5 text-sm font-medium">Total Skor</td>
                          <td className="px-4 py-2.5 text-sm font-mono text-right font-bold text-emerald-500">{TOTAL_SKOR}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-muted/30 rounded-xl px-4 py-3 text-sm font-mono">
                    Persentase = ({TOTAL_SKOR} / {SKOR_MAKS}) × 100%{" "}
                    <span className={`font-bold text-base ${persentaseColor}`}>= {PERSENTASE.toFixed(2)}%</span>
                  </div>
                </div>

                {/* Gauge visual */}
                <div className="flex flex-col items-center gap-3">
                  <div className="relative w-44 h-44">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/30" />
                      <circle
                        cx="50" cy="50" r="42" fill="none"
                        stroke="url(#gaugeGrad)" strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={`${(PERSENTASE / 100) * 263.9} 263.9`}
                        className="transition-all duration-1000"
                      />
                      <defs>
                        <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="hsl(var(--primary))" />
                          <stop offset="100%" stopColor="#a855f7" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
                      <span className={`text-3xl font-black ${persentaseColor}`}>{PERSENTASE.toFixed(1)}%</span>
                      <span className="text-xs text-muted-foreground mt-1">Kepuasan</span>
                    </div>
                  </div>
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold ${kategori.bg} ${kategori.color}`}>
                    <span>{kategori.emoji}</span>
                    <span>{kategori.label}</span>
                    <span className="font-normal text-xs opacity-70">({PERSENTASE.toFixed(2)}%)</span>
                  </div>
                </div>
              </div>

              {/* ── Tabel Kategori Penilaian ── */}
              <div className="mt-5 pt-5 border-t border-border/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Tabel Kategori Penilaian</p>
                <div className="overflow-hidden rounded-xl border border-border/40">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40">
                        <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs">Persentase</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground text-xs">Kategori</th>
                        <th className="px-4 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {[
                        { range: "81% – 100%", label: "Sangat Baik",   emoji: "🟢", min: 81, max: 100, color: "text-emerald-500" },
                        { range: "61% – 80%",  label: "Baik",           emoji: "🟦", min: 61, max: 80,  color: "text-teal-500" },
                        { range: "41% – 60%",  label: "Cukup",         emoji: "🟡", min: 41, max: 60,  color: "text-amber-500" },
                        { range: "21% – 40%",  label: "Kurang",        emoji: "🟠", min: 21, max: 40,  color: "text-orange-500" },
                        { range: "0% – 20%",   label: "Sangat Kurang", emoji: "🔴", min: 0,  max: 20,  color: "text-red-500" },
                      ].map((cat) => {
                        const isActive = PERSENTASE >= cat.min && PERSENTASE <= cat.max;
                        return (
                          <tr
                            key={cat.label}
                            className={`transition-colors ${
                              isActive ? "bg-primary/8 dark:bg-primary/10" : "hover:bg-muted/20"
                            }`}
                          >
                            <td className="px-4 py-2.5 font-mono text-xs font-medium">{cat.range}</td>
                            <td className={`px-4 py-2.5 font-semibold text-sm ${cat.color}`}>
                              {cat.emoji} {cat.label}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {isActive && (
                                <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold border border-primary/20">
                                  ✓ Hasil Anda
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ── Rekap per pertanyaan ── */}
            {stats && stats.per_pertanyaan.length > 0 && (
              <div className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-border/40">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    Rekap Skor Per Pertanyaan
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[700px]">
                    <thead>
                      <tr className="bg-muted/30">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-8">No</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pernyataan</th>
                        {["SS","S","N","TS","STS"].map(s => (
                          <th key={s} className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-16">{s}</th>
                        ))}
                        <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {stats.per_pertanyaan.map((item, idx) => (
                        <tr key={item.q} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3.5 text-muted-foreground font-bold text-xs">{idx + 1}</td>
                          <td className="px-4 py-3.5 text-sm leading-snug max-w-[240px]">
                            {PERTANYAAN_LABEL[idx]}
                          </td>
                          <td className="px-3 py-3.5">
                            <MiniBar value={item.ss} max={JUMLAH_RESPONDEN} color="bg-emerald-500" />
                          </td>
                          <td className="px-3 py-3.5">
                            <MiniBar value={item.s} max={JUMLAH_RESPONDEN} color="bg-teal-500" />
                          </td>
                          <td className="px-3 py-3.5">
                            <MiniBar value={item.n} max={JUMLAH_RESPONDEN} color="bg-amber-500" />
                          </td>
                          <td className="px-3 py-3.5">
                            <MiniBar value={item.ts} max={JUMLAH_RESPONDEN} color="bg-orange-500" />
                          </td>
                          <td className="px-3 py-3.5">
                            <MiniBar value={item.sts} max={JUMLAH_RESPONDEN} color="bg-red-500" />
                          </td>
                          <td className="px-4 py-3.5 text-center font-bold text-primary">{item.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Tabel detail responden ── */}
            {responses.length > 0 && (
              <div className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    Data Responden ({responses.length})
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[800px]">
                    <thead>
                      <tr className="bg-muted/30">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">No</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nama</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</th>
                        {Array.from({ length: 10 }, (_, i) => (
                          <th key={i} className="text-center px-2 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Q{i+1}</th>
                        ))}
                        <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Waktu</th>
                        <th className="px-2 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {responses.map((resp, idx) => {
                        const isExpanded = expandedRow === resp.id;
                        const qValues = [
                          resp.answers.q1, resp.answers.q2, resp.answers.q3, resp.answers.q4, resp.answers.q5,
                          resp.answers.q6, resp.answers.q7, resp.answers.q8, resp.answers.q9, resp.answers.q10,
                        ];
                        const scoreColor = (v: number) =>
                          v >= 5 ? "text-emerald-500" : v >= 4 ? "text-teal-500" : v >= 3 ? "text-amber-500" : "text-red-500";

                        return (
                          <tr key={resp.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3 text-muted-foreground text-xs">{idx + 1}</td>
                            <td className="px-4 py-3 font-medium max-w-[140px] truncate">{resp.nama}</td>
                            <td className="px-4 py-3 text-muted-foreground text-xs max-w-[160px] truncate">{resp.email}</td>
                            {qValues.map((v, qi) => (
                              <td key={qi} className={`px-2 py-3 text-center font-bold text-sm ${scoreColor(v)}`}>{v}</td>
                            ))}
                            <td className="px-4 py-3 text-center font-black text-primary">{resp.total_skor}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(resp.submitted_at).toLocaleDateString("id-ID", {
                                day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
                              })}
                            </td>
                            <td className="px-2 py-3">
                              <button
                                onClick={() => setExpandedRow(isExpanded ? null : resp.id)}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {responses.length === 0 && !dataLoading && (
              <div className="text-center py-16 text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Belum ada responden yang mengisi kuesioner.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminKuesioner;
