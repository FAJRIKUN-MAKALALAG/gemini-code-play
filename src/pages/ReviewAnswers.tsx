import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, User, AlertTriangle, CheckCircle2, Clock, TerminalSquare } from "lucide-react";
import { NotebookEditor } from "@/components/NotebookEditor";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { loadSkulpt } from "@/utils/skulptRunner";
import { Helmet } from "react-helmet-async";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.unklab-aicode.online/api';

export default function ReviewAnswers() {
  const { id: challengeId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [challenge, setChallenge] = useState<any>(null);
  const [answers, setAnswers] = useState<any[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [skulptReady, setSkulptReady] = useState(false);

  // Untuk me-reset/merender ulang code editor saat jawaban dipilih
  const [editorKey, setEditorKey] = useState(0);

  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }
    fetchData();
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

  const fetchAnswers = async (initial = false) => {
    try {
      const ansRes = await fetch(`${API_BASE_URL}/challenges/${challengeId}/answers`, { credentials: "include" });
      if (ansRes.ok) {
        const ObjectData = await ansRes.json();
        setAnswers(ObjectData);
        
        // Auto-select first answer only on initial load
        if (initial && ObjectData.length > 0) {
          handleSelectAnswer(ObjectData[0]);
        }
      }
    } catch (err: any) {
      console.error("Gagal load answers secara background:", err);
    }
  };

  const fetchData = async () => {
    try {
      // 1. Ambil detail Soalnya
      const chRes = await fetch(`${API_BASE_URL}/challenges/${challengeId}`, { credentials: "include" });
      if (!chRes.ok) throw new Error("Gagal load soal");
      const chData = await chRes.json();
      
      // Keamanan: Cek apakah user yang login ini adalah creatornya
      if (chData.creator_id !== user?.id) {
        toast({ title: "Akses Ditolak", description: "Anda bukan pemilik soal ujian ini.", variant: "destructive" });
        navigate("/challenges/create");
        return;
      }
      setChallenge(chData);

      // 2. Ambil semua jawaban (initial load)
      await fetchAnswers(true);

    } catch (err: any) {
      console.error(err);
      toast({ title: "Error", description: err.message || "Gagal memuat data jawaban.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // 3. Efek Real-Time (Polling 4 Detik)
  useEffect(() => {
    if (loading) return; // tunggu initial fetch selesai
    
    const interval = setInterval(() => {
      fetchAnswers(false);
    }, 4000);

    return () => clearInterval(interval);
  }, [loading, challengeId]);

  const handleSelectAnswer = (ans: any) => {
    setSelectedAnswer(ans);
    // Ubah key agar komponen NotebookEditor ter-remount dengan prop `code` yang baru, mencegah caching code lama
    setEditorKey(prev => prev + 1);
  };

  // Fungsi helper nama user
  const getUserName = (ans: any) => {
    if (ans.student_name) return ans.student_name;
    if (ans.user_id) return ans.user_id.split('-')[0]; // fallback pakai uuid dpnnya
    return "User Anonim";
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
        <h2 className="ml-4 text-xl font-bold text-foreground">Memuat Jawaban Ujian...</h2>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      <Helmet>
        <title>Evaluasi Jawaban - AI Coding Assistant</title>
      </Helmet>

      {/* Header Panel */}
      <div className="h-16 border-b border-border/60 bg-card flex items-center justify-between px-6 shrink-0 relative z-10">
        <div className="flex items-center gap-4">
          <Link to="/challenges/create">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent flex items-center gap-2">
              <TerminalSquare className="w-5 h-5 text-orange-500"/> Data Ujian Peserta
            </h1>
            <p className="text-xs text-muted-foreground font-medium">Soal: {challenge?.title}</p>
          </div>
        </div>

        <div className="text-xs font-mono bg-orange-500/10 text-orange-500 px-3 py-1.5 rounded-lg border border-orange-500/20 font-bold tracking-widest">
          ROOM: {challenge?.room_code}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <PanelGroup direction="horizontal">
          
          {/* Panel Kiri: Daftar Peserta */}
          <Panel defaultSize={25} minSize={20} maxSize={40} className="min-w-0 bg-secondary/10 border-r border-border/50">
            <div className="h-full flex flex-col">
              <div className="p-4 border-b border-border/40 shrink-0 flex items-center justify-between bg-secondary/5">
                <h2 className="font-semibold text-sm">Peserta Ujian ({answers.length})</h2>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  <span className="text-[10px] text-green-600 font-bold tracking-widest uppercase">Live Status</span>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {answers.length === 0 ? (
                  <div className="text-center p-8 text-muted-foreground text-sm">
                    Belum ada peserta yang bergabung atau menjawab soal ini.
                  </div>
                ) : (
                  answers.map((ans) => {
                    const isSelected = selectedAnswer?.id === ans.id;
                    const isSubmitted = ans.status === 'submitted';
                    const cheatCount = ans.cheats_detected || 0;

                    return (
                      <div 
                        key={ans.id}
                        onClick={() => handleSelectAnswer(ans)}
                        className={`p-3 rounded-xl cursor-pointer border transition-all ${
                          isSelected 
                            ? 'bg-primary/10 border-primary/30 shadow-sm' 
                            : 'bg-card border-border/40 hover:border-primary/20 hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                              <User className="w-3 h-3 text-primary" />
                            </div>
                            <span className="font-semibold text-sm">{getUserName(ans)}</span>
                          </div>
                          {cheatCount > 0 && (
                            <span className="flex items-center gap-1 bg-red-500/10 text-red-500 text-[10px] px-1.5 py-0.5 rounded font-bold" title="Curang terdeteksi">
                              <AlertTriangle className="w-3 h-3" /> {cheatCount}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={`flex items-center gap-1 font-medium ${isSubmitted ? 'text-green-500' : 'text-amber-500'}`}>
                            {isSubmitted ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {isSubmitted ? 'Selesai' : 'Mengerjakan'}
                          </span>
                          <span className="text-muted-foreground whitespace-nowrap">
                            {ans.updated_at ? new Date(ans.updated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className="w-1.5 bg-border hover:bg-orange-500/50 transition-colors cursor-col-resize z-20" />

          {/* Panel Kanan: Detil Jawaban & Editor Code */}
          <Panel defaultSize={75} minSize={50} className="min-w-0 bg-background relative flex flex-col">
            {selectedAnswer ? (
              <>
                <div className="h-12 bg-card border-b border-border/50 flex items-center px-6 justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-sm">Lembar Jawaban: {getUserName(selectedAnswer)}</span>
                    {selectedAnswer.status === 'submitted' ? (
                      <span className="text-[10px] bg-green-500/10 text-green-500 px-2 py-0.5 rounded font-bold uppercase">Submitted</span>
                    ) : (
                      <span className="text-[10px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded font-bold uppercase">Writing... (Live Draft)</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Terakhir disave: {new Date(selectedAnswer.updated_at).toLocaleString()}
                  </div>
                </div>

                {/* Info Box untuk Expected Output (Jika Bikin Soal ada Outputnya) */}
                {challenge?.expected_output && (
                  <div className="bg-secondary/30 p-4 border-b border-border/40 shrink-0 select-text overflow-y-auto max-h-[150px]">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Ekspektasi Output Soal:</div>
                    <pre className="text-green-400 font-mono text-xs whitespace-pre-wrap leading-relaxed">
                      {challenge.expected_output}
                    </pre>
                  </div>
                )}

                <div className="flex-1 min-h-0 relative">
                  <NotebookEditor 
                    key={editorKey} // Memaksa remount kalau beda jawaban supaya kodenya gak kecampur
                    code={selectedAnswer.code_content || '# Tidak ada kode (kosong)'}
                    // onChange tetap berfungsi agar dosen bisa otak atik jawaban siswa & mencoba nge-run (tapi tidak merubah DB otomatis jika guru ga save)
                    onChange={() => {}} 
                    isRuntimeReady={skulptReady}
                    disableAI={true}
                  />
                  
                  {/* Watermark / Bantuan */}
                  <div className="absolute bottom-6 right-6 pointer-events-none text-[10px] font-mono font-medium text-orange-500/70 border border-orange-500/20 bg-orange-500/5 px-2 py-1 rounded shadow-sm z-50">
                    Tekan (Run) Pada Cell untuk menguji jawaban murid ini.
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-60">
                <User className="w-16 h-16 mb-4" />
                <p>Pilih peserta ujian di sebelah kiri untuk melihat dan mengevaluasi jawabannya.</p>
              </div>
            )}
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}
