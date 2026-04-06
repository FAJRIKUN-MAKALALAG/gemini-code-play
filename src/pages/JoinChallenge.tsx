import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2, ArrowLeft, KeySquare, History,
  CheckCircle2, Clock, Star, BookOpen, Trophy,
  AlertTriangle, PlayCircle, Timer
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.unklab-aicode.online/api';

interface ExamHistory {
  id: string;
  status: 'in_progress' | 'submitted';
  grade: number | null;
  submitted_at: string | null;
  created_at: string;
  student_name: string;
  cheats_detected: number;
  challenge_id: string;
  challenges: {
    id: string;
    title: string;
    room_code: string;
    time_limit_minutes: number | null;
  };
}

// Hitung sisa waktu ujian berdasarkan created_at dan time_limit_minutes
function calcTimeRemaining(createdAt: string, timeLimitMinutes: number | null): string | null {
  if (!timeLimitMinutes) return null;
  const endTime = new Date(createdAt).getTime() + timeLimitMinutes * 60 * 1000;
  const diff = endTime - Date.now();
  if (diff <= 0) return "Waktu Habis";
  const totalSecs = Math.floor(diff / 1000);
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')} tersisa`;
}

export default function JoinChallenge() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [roomCode, setRoomCode] = useState("");
  const [studentName, setStudentName] = useState("");
  const [loading, setLoading] = useState(false);

  const [history, setHistory] = useState<ExamHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Ticker untuk update sisa waktu setiap detik
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user) { navigate("/"); return; }
    fetchHistory();
  }, [user, navigate]);

  // Polling real-time setiap 4 detik untuk update nilai / status terbaru
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      fetchHistory();
    }, 4000);
    return () => clearInterval(interval);
  }, [user]);

  // Tick setiap detik untuk update sisa waktu
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/challenges/my-history`, { credentials: "include" });
      if (res.ok) {
        const data: ExamHistory[] = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error("Gagal load history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode || roomCode.length < 3) {
      toast({ title: "Validasi", description: "Masukkan kode ujian yang valid.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const getRes = await fetch(`${API_BASE_URL}/challenges/room/${roomCode.toUpperCase()}`, {
        credentials: "include"
      });

      if (!getRes.ok) {
        toast({ title: "Gagal", description: "Soal / Ujian tidak ditemukan.", variant: "destructive" });
        setLoading(false);
        return;
      }

      const challenge = await getRes.json();

      const joinRes = await fetch(`${API_BASE_URL}/challenges/${challenge.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_name: studentName }),
        credentials: "include"
      });

      if (joinRes.ok) {
        toast({ title: "Berhasil!", description: "Membuka halaman ujian...", duration: 2000 });
        navigate(`/challenges/solve/${challenge.id}`);
      } else {
        const joinErr = await joinRes.json();
        toast({ title: "Gagal Mengakses", description: joinErr.error || "Gagal masuk ruang ujian.", variant: "destructive" });
      }

    } catch (error) {
      toast({ title: "Kesalahan Jaringan", description: "Tidak dapat terhubung ke server.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Langsung masuk ke halaman solve untuk lanjutkan ujian in_progress
  const handleResume = (item: ExamHistory) => {
    // Cek apakah waktu sudah habis
    if (item.challenges.time_limit_minutes) {
      const endTime = new Date(item.created_at).getTime() + item.challenges.time_limit_minutes * 60 * 1000;
      if (Date.now() > endTime + 60000) { // +60s toleransi
        toast({
          title: "Waktu Telah Habis",
          description: "Waktu pengerjaan ujian ini sudah berakhir. Jawaban kamu akan otomatis tersimpan.",
          variant: "destructive"
        });
        return;
      }
    }
    navigate(`/challenges/solve/${item.challenge_id}`);
  };

  const getGradeStyle = (grade: number | null) => {
    if (grade === null || grade === undefined) return { bg: "bg-muted/50 text-muted-foreground border-transparent" };
    if (grade >= 80) return { bg: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" };
    if (grade >= 60) return { bg: "bg-blue-500/10 text-blue-500 border-blue-500/30" };
    if (grade >= 40) return { bg: "bg-amber-500/10 text-amber-500 border-amber-500/30" };
    return { bg: "bg-red-500/10 text-red-500 border-red-500/30" };
  };

  const stats = {
    total: history.length,
    submitted: history.filter(h => h.status === 'submitted').length,
    inProgress: history.filter(h => h.status === 'in_progress').length,
    avgGrade: history.filter(h => h.grade !== null).length > 0
      ? Math.round(history.filter(h => h.grade !== null).reduce((sum, h) => sum + (h.grade || 0), 0) / history.filter(h => h.grade !== null).length)
      : null,
  };

  return (
    <div className="min-h-screen bg-background flex text-foreground">
      <Helmet>
        <title>Bergabung Ujian – AI Coding Assistant</title>
      </Helmet>

      {/* ── Panel Kiri: Riwayat Ujian ── */}
      <div className="w-80 min-h-screen border-r border-border/50 bg-card/40 backdrop-blur-sm flex flex-col shrink-0">
        {/* Header Panel */}
        <div className="p-5 border-b border-border/40 bg-card">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <History className="w-4 h-4 text-indigo-500" />
            </div>
            <h2 className="font-bold text-sm">Riwayat Ujian Saya</h2>
            {stats.inProgress > 0 && (
              <span className="ml-auto px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-bold border border-amber-500/20 animate-pulse">
                {stats.inProgress} aktif
              </span>
            )}
          </div>

          {/* Stats mini */}
          {!historyLoading && history.length > 0 && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-background/60 rounded-xl p-2 border border-border/40">
                <p className="text-lg font-black text-foreground">{stats.total}</p>
                <p className="text-[10px] text-muted-foreground">Total</p>
              </div>
              <div className="bg-background/60 rounded-xl p-2 border border-border/40">
                <p className="text-lg font-black text-emerald-500">{stats.submitted}</p>
                <p className="text-[10px] text-muted-foreground">Selesai</p>
              </div>
              <div className="bg-background/60 rounded-xl p-2 border border-border/40">
                <p className={`text-lg font-black ${stats.avgGrade !== null ? 'text-amber-500' : 'text-muted-foreground'}`}>
                  {stats.avgGrade !== null ? stats.avgGrade : '–'}
                </p>
                <p className="text-[10px] text-muted-foreground">Rata-rata</p>
              </div>
            </div>
          )}
        </div>

        {/* List Riwayat — scrollable dengan custom scrollbar */}
        <div className="relative flex-1 min-h-0">
          <div
            className="h-full overflow-y-auto p-3 space-y-2 scroll-smooth"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: 'hsl(var(--border)) transparent',
            }}
          >
          {historyLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 px-4">
              <BookOpen className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Belum ada ujian yang diikuti.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Masukkan kode soal di sebelah kanan untuk mulai.</p>
            </div>
          ) : (
            history.map((item) => {
              const gradeStyle = getGradeStyle(item.grade);
              const isSubmitted = item.status === 'submitted';
              const isInProgress = item.status === 'in_progress';
              const hasCheat = (item.cheats_detected || 0) > 0;
              const timeLimit = item.challenges?.time_limit_minutes;
              const sisaWaktu = isInProgress ? calcTimeRemaining(item.created_at, timeLimit) : null;
              const waktuHabis = sisaWaktu === "Waktu Habis";

              return (
                <div
                  key={item.id}
                  className={`border rounded-xl p-3 transition-all ${
                    isInProgress && !waktuHabis
                      ? 'bg-amber-500/5 border-amber-500/30 shadow-sm shadow-amber-500/10'
                      : 'bg-background/60 border-border/40 hover:border-indigo-500/30 hover:bg-indigo-500/5'
                  }`}
                >
                  {/* Judul Soal */}
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <p className="text-sm font-semibold leading-tight line-clamp-2 flex-1">
                      {item.challenges?.title || "Soal Ujian"}
                    </p>
                    {hasCheat && (
                      <span className="shrink-0 flex items-center gap-1 bg-red-500/10 text-red-500 text-[9px] px-1 py-0.5 rounded font-bold">
                        <AlertTriangle className="w-2.5 h-2.5" /> {item.cheats_detected}
                      </span>
                    )}
                  </div>

                  {/* Room Code */}
                  <p className="text-[10px] font-mono text-muted-foreground mb-2">
                    ROOM: <span className="text-indigo-500 font-bold">{item.challenges?.room_code}</span>
                  </p>

                  {/* Status bar */}
                  <div className="flex items-center justify-between mb-2">
                    <span className={`flex items-center gap-1 text-[10px] font-semibold ${
                      isSubmitted ? 'text-emerald-500' : waktuHabis ? 'text-red-500' : 'text-amber-500'
                    }`}>
                      {isSubmitted
                        ? <><CheckCircle2 className="w-3 h-3" /> Selesai</>
                        : waktuHabis
                          ? <><AlertTriangle className="w-3 h-3" /> Waktu Habis</>
                          : <><Clock className="w-3 h-3" /> Sedang Berlangsung</>
                      }
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(item.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>

                  {/* Sisa Waktu (jika in_progress dan belum habis) */}
                  {isInProgress && sisaWaktu && !waktuHabis && (
                    <div className="flex items-center gap-1.5 text-[10px] text-amber-600 bg-amber-500/10 px-2 py-1 rounded-lg mb-2 font-bold">
                      <Timer className="w-3 h-3" />
                      {sisaWaktu}
                    </div>
                  )}

                  {/* Tombol Lanjutkan (in_progress) atau Badge Nilai (submitted) */}
                  {isInProgress && !waktuHabis ? (
                    <button
                      onClick={() => handleResume(item)}
                      className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-sm shadow-amber-500/20 active:scale-95"
                    >
                      <PlayCircle className="w-3.5 h-3.5" />
                      Lanjutkan Ujian
                    </button>
                  ) : isSubmitted ? (
                    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold justify-center ${gradeStyle.bg}`}>
                      <Star className="w-3 h-3" />
                      {item.grade !== null ? `Nilai: ${item.grade} / 100` : 'Menunggu Penilaian'}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-500 text-xs font-bold justify-center">
                      <AlertTriangle className="w-3 h-3" />
                      Waktu Ujian Berakhir
                    </div>
                  )}
                </div>
              );
            })
          )}
          </div>{/* end inner scroll div */}

          {/* Fade gradient di bawah untuk indikasi ada konten lebih */}
          {history.length > 3 && (
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-card/80 to-transparent rounded-b-sm" />
          )}
        </div>{/* end outer relative div */}

        {/* Footer */}
        <div className="p-4 border-t border-border/40">
          <Link to="/">
            <Button variant="ghost" className="w-full rounded-xl gap-2" size="sm">
              <ArrowLeft className="w-4 h-4" /> Kembali ke Beranda
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Panel Kanan: Form Join ── */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md flex flex-col items-center">

          <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20">
            <KeySquare className="w-8 h-8 text-blue-500" />
          </div>

          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent mb-2">
            Ruang Ujian Praktikum
          </h1>
          <p className="text-muted-foreground text-sm text-center mb-8 px-4">
            Masukkan kode 6 digit yang diberikan oleh dosen / asisten lab untuk mulai mengerjakan.
          </p>

          <div className="w-full bg-card border border-border/50 rounded-3xl p-8 shadow-2xl">
            <form onSubmit={handleJoin} className="space-y-5">
              <Input
                type="text"
                placeholder="Masukkan Nama Lengkap Anda"
                value={studentName}
                onChange={e => setStudentName(e.target.value)}
                className="h-14 bg-background/50 text-center text-lg font-bold rounded-xl border-2 focus-visible:ring-indigo-500/50"
                required
                autoFocus
              />
              <Input
                type="text"
                placeholder="KODE RUANG LATIHAN"
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                className="h-14 bg-background/50 text-center text-xl tracking-widest font-bold uppercase rounded-xl border-2 focus-visible:ring-indigo-500/50"
                maxLength={8}
                required
              />

              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 rounded-xl text-md"
                disabled={loading}
              >
                {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> MENGHUBUNGKAN...</> : "MASUK KE RUANG UJIAN"}
              </Button>
            </form>

            <div className="mt-6 text-xs text-center text-muted-foreground bg-amber-500/5 p-4 rounded-xl border border-amber-500/10">
              <strong className="text-amber-500 block mb-1">Peringatan Anti-Curang:</strong>
              Sistem ini diawasi! Anda <b>tidak bisa keluar atau berpindah aplikasi/tab</b> saat mengerjakan. Pelanggaran mengakibatkan diskualifikasi otomatis.
            </div>
          </div>

          {/* Trophy jika rata-rata bagus */}
          {stats.avgGrade !== null && stats.avgGrade >= 80 && (
            <div className="mt-6 flex items-center gap-2 text-sm text-amber-500 bg-amber-500/10 px-4 py-2 rounded-xl border border-amber-500/20">
              <Trophy className="w-4 h-4" />
              <span>Rata-rata nilaimu <b>{stats.avgGrade}</b> – Pertahankan!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
