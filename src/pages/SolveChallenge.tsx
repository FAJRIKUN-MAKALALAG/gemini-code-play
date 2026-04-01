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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.unklab-aicode.online/api';

export default function SolveChallenge() {
  const { id: challengeId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [challenge, setChallenge] = useState<any>(null);
  const [answerId, setAnswerId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [skulptReady, setSkulptReady] = useState(false);
  const [cheatsDetected, setCheatsDetected] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const cheatsRef = useRef(0);
  const codeRef = useRef(code);

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
      const [chRes, joinRes] = await Promise.all([
        fetch(`${API_BASE_URL}/challenges/${challengeId}`, { credentials: "include" }),
        fetch(`${API_BASE_URL}/challenges/${challengeId}/join`, { method: "POST", credentials: "include" })
      ]);

      if (!chRes.ok || !joinRes.ok) {
        toast({ title: "Gagal Membuka Ujian", description: "Terjadi kesalahan atau Anda sudah pernah submit.", variant: "destructive" });
        navigate("/");
        return;
      }

      const chData = await chRes.json();
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
          alert(`⚠️ PERINGATAN SISTEM: Anda terbar mendeteksi pemindahan tab atau aplikasi. Ini adalah peringatan pertama. Jika Anda melakukannya lagi, jawaban ujian Anda akan OTOMATIS DIKIRIM dan ujian dihentikan!`);
          saveProgress(codeRef.current, "in_progress", newCheats);
        } else if (newCheats >= 2) {
          alert(`🚫 PELANGGARAN TERDETEKSI: Anda telah melanggar aturan ujian (pindah tab/app 2 kali). Jawaban Anda disubmit secara otomatis.`);
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
    if (!forced && !window.confirm("Apakah Anda yakin ingin menyelesaikan dan mengirim jawaban ini? Anda tidak bisa mengubahnya setelah ini.")) {
      return;
    }
    
    setSubmitting(true);
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

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background text-foreground">
      <Helmet>
        <title>Ujian Aktif - AI Coding Assistant</title>
      </Helmet>

      {/* Top Navbar for Evaluation */}
      <div className="h-14 bg-red-600/10 border-b border-red-500/20 flex items-center justify-between px-6 shrink-0 z-10 shadow-sm relative">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-red-500" />
          <h1 className="font-bold text-red-500 tracking-wider">MODE PENILAIAN TERAWASI AKTIF</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-red-500/10 text-red-500 px-3 py-1.5 rounded-lg text-xs font-bold font-mono">
            <AlertTriangle className="w-4 h-4" />
            <span>PELANGGARAN: {cheatsDetected}/2</span>
          </div>
          
          <Button 
            onClick={() => handleFinalSubmit(false)} 
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
            <div id="question-panel" className="h-full p-6 overflow-y-auto select-none" style={{ userSelect: 'none' }}>
              <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm mb-6">
                <h2 className="text-2xl font-bold text-foreground mb-4 leading-tight">{challenge?.title}</h2>
                <div className="flex gap-4 mb-6 text-xs font-medium border-b border-border/50 pb-4">
                  <div className="flex flex-col gap-1 text-muted-foreground">
                    <span className="uppercase text-[10px] font-bold">Author ID</span>
                    <span className="font-mono text-foreground">{challenge?.creator_id?.slice(0, 8)}...</span>
                  </div>
                  {challenge?.time_limit_minutes && (
                    <div className="flex flex-col gap-1 text-orange-500">
                      <span className="uppercase text-[10px] font-bold flex items-center gap-1"><Timer className="w-3 h-3"/> Waktu Pengerjaan</span>
                      <span className="font-bold">{challenge.time_limit_minutes} Menit</span>
                    </div>
                  )}
                </div>

                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-2">Instruksi:</h3>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed mb-6">{challenge?.description}</div>

                  {challenge?.expected_output && (
                    <>
                      <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-2 mt-4">Ekspektasi Output:</h3>
                      <pre className="bg-black/50 p-4 rounded-xl border border-border/30 text-green-400 font-mono text-xs whitespace-pre-wrap">
                        {challenge.expected_output}
                      </pre>
                    </>
                  )}
                </div>
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
            
            {/* Overlay Cover untuk AI Chat / Tombol Send AI yang mungkin ad di notebook */}
            <div className="absolute top-2 right-4 pointer-events-none opacity-50 text-xs font-mono text-muted-foreground flex items-center gap-2">
              <ShieldAlert className="w-3 h-3 text-red-500"/> AI ASSISTANCE DISABLED
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}
