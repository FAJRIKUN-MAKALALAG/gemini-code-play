import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Loader2, ArrowLeft, User, AlertTriangle,
  CheckCircle2, Clock, TerminalSquare, Star, Save, Pencil, X
} from "lucide-react";
import { NotebookEditor } from "@/components/NotebookEditor";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { loadSkulpt } from "@/utils/skulptRunner";
import { Helmet } from "react-helmet-async";
import { API_BASE_URL } from "@/config";

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
  const [editorKey, setEditorKey] = useState(0);

  // Grade & Comment state
  const [gradeInput, setGradeInput] = useState<string>("");
  const [commentInput, setCommentInput] = useState<string>("");
  const [savingGrade, setSavingGrade] = useState(false);
  const [isEditingGrade, setIsEditingGrade] = useState(false);

  // Ref to keep selected answer ID when polling merges fresh data
  const selectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) { navigate("/"); return; }
    fetchData();
    initSkulpt();
  }, [user, navigate, challengeId]);

  const initSkulpt = async () => {
    try {
      if (!skulptReady) { await loadSkulpt(); setSkulptReady(true); }
    } catch (e) { console.error("Failed to load runtime"); }
  };

  const fetchAnswers = async (initial = false) => {
    try {
      const ansRes = await fetch(`${API_BASE_URL}/challenges/${challengeId}/answers`, { credentials: "include" });
      if (ansRes.ok) {
        const fresh: any[] = await ansRes.json();
        setAnswers(fresh);

        // Sync selectedAnswer with fresh data (preserve selection)
        if (selectedIdRef.current) {
          const refreshed = fresh.find(a => a.id === selectedIdRef.current);
          if (refreshed) {
            setSelectedAnswer(refreshed);
            // Update grade & comment input only if user hasn't started typing
            setGradeInput(prev => {
              const dbGrade = refreshed.grade !== null && refreshed.grade !== undefined ? String(refreshed.grade) : "";
              return prev === "" ? dbGrade : prev;
            });
            setCommentInput(prev => {
              const dbComment = refreshed.teacher_comment || "";
              return prev === "" ? dbComment : prev;
            });
          }
        }

        if (initial && fresh.length > 0) {
          handleSelectAnswer(fresh[0]);
        }
      }
    } catch (err) {
      console.error("Gagal load answers:", err);
    }
  };

  const fetchData = async () => {
    try {
      const chRes = await fetch(`${API_BASE_URL}/challenges/${challengeId}`, { credentials: "include" });
      if (!chRes.ok) throw new Error("Gagal load soal");
      const chData = await chRes.json();
      if (chData.creator_id !== user?.id) {
        toast({ title: "Akses Ditolak", description: "Anda bukan pemilik soal ujian ini.", variant: "destructive" });
        navigate("/challenges/create");
        return;
      }
      setChallenge(chData);
      await fetchAnswers(true);
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error", description: err.message || "Gagal memuat data.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Polling setiap 4 detik
  useEffect(() => {
    if (loading) return;
    const interval = setInterval(() => fetchAnswers(false), 4000);
    return () => clearInterval(interval);
  }, [loading, challengeId]);

  const handleSelectAnswer = (ans: any) => {
    selectedIdRef.current = ans.id;
    setSelectedAnswer(ans);
    setEditorKey(prev => prev + 1);
    // Set grade & comment input dari data DB
    setGradeInput(ans.grade !== null && ans.grade !== undefined ? String(ans.grade) : "");
    setCommentInput(ans.teacher_comment || "");
    // Reset mode edit saat ganti peserta
    setIsEditingGrade(false);
  };

  const handleSaveGrade = async () => {
    if (!selectedAnswer) return;
    const gradeNum = Number(gradeInput);
    if (gradeInput === "" || isNaN(gradeNum) || gradeNum < 0 || gradeNum > 100) {
      toast({ title: "Validasi", description: "Masukkan nilai antara 0–100.", variant: "destructive" });
      return;
    }

    setSavingGrade(true);
    try {
      const res = await fetch(`${API_BASE_URL}/challenges/answers/${selectedAnswer.id}/grade`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ grade: gradeNum, teacher_comment: commentInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan nilai.");

      // Update local state langsung tanpa nunggu polling
      const updated = { ...selectedAnswer, grade: gradeNum, teacher_comment: commentInput };
      setSelectedAnswer(updated);
      selectedIdRef.current = updated.id;
      setAnswers(prev => prev.map(a => a.id === updated.id ? { ...a, grade: gradeNum, teacher_comment: commentInput } : a));
      setIsEditingGrade(false); // Kembali ke mode tampil

      toast({ title: "✅ Nilai Tersimpan!", description: `Nilai ${gradeNum} berhasil disimpan untuk ${getUserName(selectedAnswer)}.` });
    } catch (err: any) {
      toast({ title: "Gagal", description: err.message, variant: "destructive" });
    } finally {
      setSavingGrade(false);
    }
  };

  const getUserName = (ans: any) => {
    if (ans.student_name) return ans.student_name;
    if (ans.user_id) return ans.user_id.split('-')[0];
    return "User Anonim";
  };

  const getGradeBadgeStyle = (grade: number | null) => {
    if (grade === null || grade === undefined) return "bg-muted text-muted-foreground";
    if (grade >= 80) return "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30";
    if (grade >= 60) return "bg-blue-500/15 text-blue-500 border border-blue-500/30";
    if (grade >= 40) return "bg-amber-500/15 text-amber-500 border border-amber-500/30";
    return "bg-red-500/15 text-red-500 border border-red-500/30";
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

      {/* Header */}
      <div className="h-16 border-b border-border/60 bg-card flex items-center justify-between px-6 shrink-0 relative z-10">
        <div className="flex items-center gap-4">
          <Link to="/challenges/create">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent flex items-center gap-2">
              <TerminalSquare className="w-5 h-5 text-orange-500" /> Data Ujian Peserta
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
                  <span className="text-[10px] text-green-600 font-bold tracking-widest uppercase">Live</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {answers.length === 0 ? (
                  <div className="text-center p-8 text-muted-foreground text-sm">
                    Belum ada peserta yang bergabung.
                  </div>
                ) : (
                  answers.map((ans) => {
                    const isSelected = selectedAnswer?.id === ans.id;
                    const isSubmitted = ans.status === 'submitted';
                    const cheatCount = ans.cheats_detected || 0;
                    const hasGrade = ans.grade !== null && ans.grade !== undefined;

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
                            <span className="font-semibold text-sm truncate max-w-[110px]">{getUserName(ans)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {cheatCount > 0 && (
                              <span className="flex items-center gap-1 bg-red-500/10 text-red-500 text-[10px] px-1.5 py-0.5 rounded font-bold" title="Curang terdeteksi">
                                <AlertTriangle className="w-3 h-3" /> {cheatCount}
                              </span>
                            )}
                            {hasGrade && (
                              <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${getGradeBadgeStyle(ans.grade)}`}>
                                {ans.grade}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={`flex items-center gap-1 font-medium ${isSubmitted ? 'text-green-500' : 'text-amber-500'}`}>
                            {isSubmitted ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {isSubmitted ? 'Selesai' : 'Mengerjakan'}
                          </span>
                          <span className="text-muted-foreground whitespace-nowrap">
                            {ans.updated_at ? new Date(ans.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className="w-1.5 bg-border hover:bg-orange-500/50 transition-colors cursor-col-resize z-20" />

          {/* Panel Kanan */}
          <Panel defaultSize={75} minSize={50} className="min-w-0 bg-background relative flex flex-col">
            {selectedAnswer ? (
              <>
                {/* Sub-header: Info + Input Nilai */}
                <div className="shrink-0 bg-card border-b border-border/50">
                  <div className="h-12 flex items-center px-6 justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm">Lembar Jawaban: {getUserName(selectedAnswer)}</span>
                      {selectedAnswer.status === 'submitted' ? (
                        <span className="text-[10px] bg-green-500/10 text-green-500 px-2 py-0.5 rounded font-bold uppercase">Submitted</span>
                      ) : (
                        <span className="text-[10px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded font-bold uppercase">Writing... (Live)</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Disave: {new Date(selectedAnswer.updated_at).toLocaleString()}
                    </span>
                  </div>

                  {/* ── Row Pemberian / Edit Nilai ── */}
                  <div className="px-6 py-3 border-t border-border/30 bg-secondary/5 flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 shrink-0">
                      <Star className="w-4 h-4 text-amber-500" />
                      <span className="text-sm font-semibold">Nilai:</span>
                    </div>

                    {/* Mode tampil: sudah ada nilai */}
                    {!isEditingGrade && selectedAnswer.grade !== null && selectedAnswer.grade !== undefined ? (
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-xl text-sm font-black ${getGradeBadgeStyle(selectedAnswer.grade)}`}>
                          {selectedAnswer.grade} / 100
                        </span>
                        {/* Tampil Komentar */}
                        {selectedAnswer.teacher_comment && (
                           <div className="ml-4 px-3 py-1 bg-background border border-border/50 text-[11px] rounded-lg italic text-muted-foreground flex items-center gap-1.5 max-w-[250px] truncate" title={selectedAnswer.teacher_comment}>
                             💬 {selectedAnswer.teacher_comment}
                           </div>
                        )}
                        {/* Tombol Edit */}
                        <button
                          onClick={() => {
                            setGradeInput(String(selectedAnswer.grade));
                            setCommentInput(selectedAnswer.teacher_comment || "");
                            setIsEditingGrade(true);
                          }}
                          className="ml-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground text-[11px] font-semibold transition-all border border-border/50"
                          title="Edit nilai dan komentar"
                        >
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                      </div>
                    ) : !isEditingGrade ? (
                      /* Mode tampil: belum ada nilai */
                      <span className="text-xs text-muted-foreground italic">Belum dinilai</span>
                    ) : null}

                    {/* Mode Edit / Input */}
                    {(isEditingGrade || (selectedAnswer.grade === null || selectedAnswer.grade === undefined)) && (
                      <div className="flex items-center gap-2 ml-auto w-full md:w-auto mt-2 md:mt-0">
                        {isEditingGrade && (
                          <button
                            onClick={() => setIsEditingGrade(false)}
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                            title="Batal"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        <input
                          type="number"
                          min={0}
                          max={100}
                          placeholder="0 – 100"
                          value={gradeInput}
                          onChange={e => setGradeInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSaveGrade()}
                          autoFocus={isEditingGrade}
                          className="w-24 h-8 bg-background border border-border/60 rounded-lg text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-orange-500/30 transition-all shrink-0"
                        />
                        <input
                          type="text"
                          placeholder="Masukkan komentar/masukan (opsional)..."
                          value={commentInput}
                          onChange={e => setCommentInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSaveGrade()}
                          className="w-full md:w-64 h-8 px-3 bg-background border border-border/60 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/30 transition-all"
                        />
                        <Button
                          size="sm"
                          onClick={handleSaveGrade}
                          disabled={savingGrade || gradeInput === ""}
                          className="h-8 bg-orange-600 hover:bg-orange-700 text-white flex items-center gap-1.5 text-xs font-bold shrink-0"
                        >
                          {savingGrade
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Save className="w-3.5 h-3.5" />
                          }
                          {isEditingGrade ? 'Perbarui' : 'Simpan'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ekspektasi Output */}
                {challenge?.expected_output && (
                  <div className="bg-secondary/30 p-4 border-b border-border/40 shrink-0 select-text overflow-y-auto max-h-[130px]">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Ekspektasi Output Soal:</div>
                    <pre className="text-green-400 font-mono text-xs whitespace-pre-wrap leading-relaxed">
                      {challenge.expected_output}
                    </pre>
                  </div>
                )}

                <div className="flex-1 min-h-0 relative">
                  <NotebookEditor
                    key={editorKey}
                    code={selectedAnswer.code_content || '# Tidak ada kode (kosong)'}
                    onChange={() => {}}
                    isRuntimeReady={skulptReady}
                    disableAI={true}
                  />
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
