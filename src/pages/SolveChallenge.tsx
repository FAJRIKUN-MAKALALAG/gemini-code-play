import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, ShieldAlert, Timer } from "lucide-react";
import { NotebookEditor } from "@/components/NotebookEditor";
import { loadSkulpt } from "@/utils/skulptRunner";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Helmet } from "react-helmet-async";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.unklab-aicode.online/api';

export default function SolveChallenge() {
  const { id: challengeId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [challenge, setChallenge] = useState<any>(null);
  const [answerId, setAnswerId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [questions, setQuestions] = useState<any[]>([]);
  const [activeQuestion, setActiveQuestion] = useState(0); // index
  
  const [loading, setLoading] = useState(true);
  const [skulptReady, setSkulptReady] = useState(false);
  const [cheatsDetected, setCheatsDetected] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null); // Pesan error jika diblokir
  
  const [endTime, setEndTime] = useState<number | null>(null);
  const [timeRemainingStr, setTimeRemainingStr] = useState<string>("");

  const [cheatWarning, setCheatWarning] = useState<string | null>(null);
  const [showTimeUp, setShowTimeUp] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  const cheatsRef = useRef(0);
  const codeRef = useRef(code);
  const submittingRef = useRef(submitting);

  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);

  // Selalu perbarui ref kode agar interval save bisa baca data terbaru
  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }
    loadData();
    initSkulpt();
  }, [user, navigate, challengeId]);

  const initSkulpt = async () => {
    try {
      if (!skulptReady) {
        await loadSkulpt();
        setSkulptReady(true);
      }
    } catch (e) {
      console.error("Failed to load runtime");
    }
  };

  const loadData = async () => {
    try {
      // Ambil detail soal
      const chRes = await fetch(`${API_BASE_URL}/challenges/${challengeId}`, { credentials: "include" });
      if (!chRes.ok) {
        toast({ title: "Gagal", description: "Soal tidak ditemukan.", variant: "destructive" });
        navigate("/challenges/join");
        return;
      }
      const chData = await chRes.json();

      // Ambil daftar soal dari challenge_questions
      const qRes = await fetch(`${API_BASE_URL}/challenges/${challengeId}/questions`, { credentials: "include" });
      if (qRes.ok) {
        const qData = await qRes.json();
        setQuestions(qData);
      }

      // Join (atau lanjutkan jika in_progress)
      const joinRes = await fetch(`${API_BASE_URL}/challenges/${challengeId}/join`, {
        method: "POST",
        credentials: "include"
      });

      if (!joinRes.ok) {
        const errData = await joinRes.json().catch(() => ({}));

        if (joinRes.status === 403) {
          // Sudah submit → blokir dengan pesan
          setBlocked(errData.error || "Anda sudah mensubmit jawaban untuk ujian ini.");
          setLoading(false);
          return;
        }

        // Error lain (500, dsb)
        toast({ title: "Gagal Membuka Ujian", description: errData.error || "Terjadi kesalahan.", variant: "destructive" });
        navigate("/challenges/join");
        return;
      }
      const joinData = await joinRes.json();

      setChallenge(chData);
      
      // Load current code
      if (joinData.answer) {
        setAnswerId(joinData.answer.id);
        const savedCode = joinData.answer.code_content;
        
        // Cek if saved code is empty or single empty string
        if (savedCode && savedCode !== '""' && savedCode !== "[]") {
          setCode(savedCode);
        } else {
          // Template awal
          setCode(`# Jawab soal "${chData.title}" di sini\n\n`);
        }
        
        setCheatsDetected(joinData.answer.cheats_detected || 0);
        cheatsRef.current = joinData.answer.cheats_detected || 0;

        // Inisialisasi Timer Ujian dari waktu answer dibuat
        if (chData.time_limit_minutes) {
          // Fallback ke Date.now() jika created_at entah kenapa string kosong
          const startTimestamp = joinData.answer.created_at ? new Date(joinData.answer.created_at).getTime() : Date.now();
          const calculatedEndTime = startTimestamp + (chData.time_limit_minutes * 60 * 1000);
          setEndTime(calculatedEndTime);
        }
      }

    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Koneksi terputus.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // 1. Auto Save Timer: Setiap 30 Detik
  useEffect(() => {
    if (!answerId) return;
    
    const interval = setInterval(() => {
      saveProgress(codeRef.current, "in_progress", cheatsRef.current);
    }, 30000);

    return () => clearInterval(interval);
  }, [answerId]);

  // 2. Anti-Cheat: Deteksi Visibilitas Layar (Ganti Tab / Minimize)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.hidden) {
        // Terdeteksi Pindah Tab
        const newCheats = cheatsRef.current + 1;
        cheatsRef.current = newCheats;
        setCheatsDetected(newCheats);

        if (newCheats === 1) {
          setCheatWarning(`⚠️ PERINGATAN SISTEM: Sistem mendeteksi pemindahan tab atau aplikasi. Ini adalah peringatan pertama. Jika Anda melakukannya lagi, ujian Anda akan OTOMATIS DIHENTIKAN!`);
          saveProgress(codeRef.current, "in_progress", newCheats);
        } else if (newCheats >= 2) {
          setCheatWarning(`🚫 PELANGGARAN TERDETEKSI: Anda telah melanggar aturan ujian (pindah tab/app 2 kali). Jawaban Anda sedang disubmit secara otomatis...`);
          await handleFinalSubmit(true);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [answerId]);

  // 3. Anti-Copy Paste untuk elemen deskripsi soal
  useEffect(() => {
    const disableCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      toast({ title: "Fitur Di-lock", description: "Copy/Paste dilarang selama ujian.", variant: "destructive", duration: 2000 });
    };

    const qPanel = document.getElementById("question-panel");
    if (qPanel) {
      qPanel.addEventListener("copy", disableCopy as any);
    }
    return () => {
      if (qPanel) qPanel.removeEventListener("copy", disableCopy as any);
    };
  }, [loading]);

  // 4. Hitung Mundur Waktu Ujian (Realtime)
  useEffect(() => {
    if (!endTime) return;

    // Evaluasi awal agar komponen langsung update tanpa delay 1 detik
    const nowInit = Date.now();
    if (endTime - nowInit <= 0 && !submittingRef.current) {
      setTimeRemainingStr("00:00");
      handleFinalSubmit(true);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = endTime - now;

      if (diff <= 0) {
        clearInterval(interval);
        setTimeRemainingStr("00:00");
        if (!submittingRef.current) {
          setShowTimeUp(true);
          handleFinalSubmit(true);
        }
      } else {
        const totalSecs = Math.floor(diff / 1000);
        const h = Math.floor(totalSecs / 3600);
        const m = Math.floor((totalSecs % 3600) / 60);
        const s = totalSecs % 60;
        
        const formatTime = (v: number) => v.toString().padStart(2, "0");
        if (h > 0) {
          setTimeRemainingStr(`${formatTime(h)}:${formatTime(m)}:${formatTime(s)}`);
        } else {
          setTimeRemainingStr(`${formatTime(m)}:${formatTime(s)}`);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [endTime]);


  const saveProgress = async (currentCode: string, status: "in_progress" | "submitted" = "in_progress", cheats = cheatsDetected) => {
    if (!answerId) return false;
    try {
      const res = await fetch(`${API_BASE_URL}/challenges/answers/${answerId}/save`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          code_content: currentCode,
          status,
          cheats_detected: cheats
        })
      });
      return res.ok;
    } catch (e) {
      console.error("Gagal auto-save", e);
      return false;
    }
  };

  const handleFinalSubmit = async (forced = false) => {
    setSubmitting(true);
    // Jika tidak forced, pastikan dialog konfirmasi kita tutup
    if (!forced) setShowSubmitConfirm(false);
    const success = await saveProgress(codeRef.current, "submitted", cheatsRef.current);
    setSubmitting(false);

    if (success || forced) {
      toast({ title: "Selesai", description: "Jawaban ujian Anda berhasil dikirim." });
      navigate("/"); // Kembali ke home
    } else {
      toast({ title: "Gagal Kirim", description: "Gagal menghubungi server.", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
        <h2 className="ml-4 text-xl font-bold">Menyiapkan Environment Ujian...</h2>
      </div>
    );
  }

  // Tampilan jika sudah submit / diblokir
  if (blocked) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background p-6 gap-6">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <ShieldAlert className="w-8 h-8 text-red-500" />
        </div>
        <div className="text-center max-w-md">
          <h2 className="text-xl font-bold text-red-500 mb-2">Akses Ditolak</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">{blocked}</p>
        </div>
        <Button
          onClick={() => navigate("/challenges/join")}
          variant="outline"
          className="gap-2"
        >
          Kembali ke Halaman Ujian
        </Button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background text-foreground">
      <Helmet>
        <title>Ujian Aktif - AI Coding Assistant</title>
      </Helmet>

      {/* Dialog Peringatan Anti-Cheat */}
      <AlertDialog open={!!cheatWarning} onOpenChange={() => !submitting && setCheatWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-500 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5"/> Peringatan Sistem
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium leading-relaxed">
              {cheatWarning}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setCheatWarning(null)} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin"/> : "Saya Mengerti"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Waktu Habis */}
      <AlertDialog open={showTimeUp}>
        <AlertDialogContent className="pointer-events-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-500 flex items-center gap-2">
               <Timer className="w-5 h-5 animate-pulse"/> Waktu Ujian Habis!
            </AlertDialogTitle>
            <AlertDialogDescription>
              Waktu pengerjaan telah selesai. Menyiapkan pengiriman dan menyimpan jawaban secara otomatis ke server...
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-start">
             <div className="flex items-center text-muted-foreground gap-2 text-sm pt-2">
               <Loader2 className="w-4 h-4 animate-spin text-blue-500"/> Sedang mengirimkan...
             </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Konfirmasi Submit Manual */}
      <AlertDialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Pengumpulan</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menyelesaikan dan mengirim jawaban ini? <br/>
              <b>Anda tidak akan bisa mengubah kodenya setelah ini dikirim.</b>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleFinalSubmit(false)} className="bg-green-600 hover:bg-green-700 text-white font-bold">
              Ya, Kirim Sekarang
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Top Navbar for Evaluation */}
      <div className="h-14 bg-red-600/10 border-b border-red-500/20 flex items-center justify-between px-6 shrink-0 z-10 shadow-sm relative">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-red-500" />
          <h1 className="font-bold text-red-500 tracking-wider text-sm md:text-base hidden sm:block">MODE PENILAIAN & AI DISABLED</h1>
        </div>

        <div className="flex items-center gap-4">
          {endTime && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold font-mono border ${
              timeRemainingStr.length === 5 && parseInt(timeRemainingStr.split(":")[0]) < 3 
                ? "bg-red-500 text-white border-red-600 animate-pulse" 
                : "bg-orange-500/10 text-orange-500 border-orange-500/20"
            }`}>
              <Timer className="w-4 h-4" />
              <span>{timeRemainingStr || "--:--"}</span>
            </div>
          )}

          <div className="flex items-center gap-2 bg-red-500/10 text-red-500 px-3 py-1.5 rounded-lg text-xs font-bold font-mono border border-red-500/20">
            <AlertTriangle className="w-4 h-4" />
            <span className="hidden sm:inline">PELANGGARAN:</span> {cheatsDetected}/2
          </div>
          
          <Button 
            onClick={() => setShowSubmitConfirm(true)} 
            disabled={submitting}
            className="bg-green-600 hover:bg-green-700 text-white font-bold h-9 px-6 shadow-md"
          >
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "SUBMIT JAWABAN"}
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <PanelGroup direction="horizontal">
          {/* Panel Soal (Kiri) */}
          <Panel defaultSize={35} minSize={25} className="min-w-0 bg-secondary/20">
            <div id="question-panel" className="h-full flex flex-col overflow-hidden" style={{ userSelect: 'none' }}>

              {/* Tab navigasi soal */}
              {questions.length > 1 && (
                <div className="flex items-center gap-1 px-3 pt-3 pb-0 overflow-x-auto shrink-0" style={{ scrollbarWidth: 'none' }}>
                  {questions.map((q, idx) => (
                    <button
                      key={q.id}
                      onClick={() => setActiveQuestion(idx)}
                      className={`shrink-0 px-3 py-1.5 rounded-t-lg text-xs font-bold transition-all border-b-2 ${
                        activeQuestion === idx
                          ? 'bg-card text-orange-500 border-orange-500'
                          : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-card/50'
                      }`}
                    >
                      Soal {q.nomor}
                    </button>
                  ))}
                </div>
              )}

              {/* Konten soal aktif */}
              <div className="flex-1 overflow-y-auto p-5 select-none" style={{ scrollbarWidth: 'thin', scrollbarColor: 'hsl(var(--border)) transparent' }}>
                {questions.length === 0 ? (
                  // Fallback ke deskripsi challenge lama jika belum ada questions
                  <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
                    <h2 className="text-2xl font-bold text-foreground mb-4 leading-tight">{challenge?.title}</h2>
                    <div className="flex gap-4 mb-6 text-xs font-medium border-b border-border/50 pb-4">
                      <div className="flex flex-col gap-1 text-muted-foreground">
                        <span className="uppercase text-[10px] font-bold">Dibuat Oleh</span>
                        <span className="font-mono text-foreground font-medium">{challenge?.creator_name || 'Author'}</span>
                      </div>
                      {challenge?.time_limit_minutes && (
                        <div className="flex flex-col gap-1 text-orange-500">
                          <span className="uppercase text-[10px] font-bold flex items-center gap-1"><Timer className="w-3 h-3" /> Waktu</span>
                          <span className="font-bold">{challenge.time_limit_minutes} Menit</span>
                        </div>
                      )}
                    </div>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">{challenge?.description}</div>
                    {challenge?.expected_output && (
                      <pre className="bg-black/50 p-4 rounded-xl border border-border/30 text-green-400 font-mono text-xs whitespace-pre-wrap mt-4">{challenge.expected_output}</pre>
                    )}
                  </div>
                ) : (
                  // Tampilkan soal aktif
                  questions[activeQuestion] && (
                    <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm space-y-4">
                      <div className="flex items-center gap-3 border-b border-border/50 pb-4">
                        <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 font-black text-sm">
                          {questions[activeQuestion].nomor}
                        </div>
                        <div>
                          <h2 className="font-bold text-base">Soal {questions[activeQuestion].nomor} dari {questions.length}</h2>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {challenge?.creator_name && <span>Oleh: {challenge.creator_name}</span>}
                            {challenge?.time_limit_minutes && (
                              <span className="flex items-center gap-1 text-orange-500">
                                <Timer className="w-3 h-3" /> {challenge.time_limit_minutes} Menit
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Deskripsi teks */}
                      {questions[activeQuestion].description && (
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">{questions[activeQuestion].description}</div>
                      )}

                      {/* Gambar deskripsi */}
                      {questions[activeQuestion].description_image_url && (
                        <img
                          src={questions[activeQuestion].description_image_url}
                          alt={`Gambar soal ${questions[activeQuestion].nomor}`}
                          className="w-full max-h-64 rounded-xl border border-border/40 object-contain bg-black/20"
                        />
                      )}

                      {/* Expected output */}
                      {(questions[activeQuestion].expected_output || questions[activeQuestion].expected_output_image_url) && (
                        <div>
                          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-bold">Ekspektasi Output:</h3>
                          {questions[activeQuestion].expected_output && (
                            <pre className="bg-black/50 p-4 rounded-xl border border-border/30 text-green-400 font-mono text-xs whitespace-pre-wrap">{questions[activeQuestion].expected_output}</pre>
                          )}
                          {questions[activeQuestion].expected_output_image_url && (
                            <img
                              src={questions[activeQuestion].expected_output_image_url}
                              alt="Expected output"
                              className="mt-2 max-h-48 rounded-xl border border-border/40 object-contain bg-black/20"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className="w-1.5 bg-border hover:bg-red-500/50 transition-colors cursor-col-resize z-20" />

          {/* Panel Kode (Kanan) */}
          <Panel defaultSize={65} minSize={40} className="min-w-0 relative">
            <NotebookEditor 
              code={code}
              onChange={setCode}
              isRuntimeReady={skulptReady}
              disableAI={true}
            />
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}
