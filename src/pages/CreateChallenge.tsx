import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2, Plus, ArrowLeft, Copy, Eye, CopyCheck,
  Trash2, Image, X, FilePlus2,
  Pencil, CheckCircle2, BookOpen
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Helmet } from "react-helmet-async";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.unklab-aicode.online/api';

interface Question {
  id: string;
  nomor: number;
  description: string | null;
  description_image_url: string | null;
  expected_output: string | null;
  expected_output_image_url: string | null;
}

interface QuestionForm {
  description: string;
  descriptionImage: File | null;
  descriptionImagePreview: string | null;
  expectedOutput: string;
  expectedOutputImage: File | null;
  expectedOutputImagePreview: string | null;
}

const emptyForm = (): QuestionForm => ({
  description: '',
  descriptionImage: null,
  descriptionImagePreview: null,
  expectedOutput: '',
  expectedOutputImage: null,
  expectedOutputImagePreview: null,
});

export default function CreateChallenge() {
  const { user } = useAuth();
  const { toast } = useToast();

  // ── Formulir buat ujian baru ──
  const [title, setTitle] = useState("");
  const [timeLimit, setTimeLimit] = useState("");
  const [maxTabSwitches, setMaxTabSwitches] = useState("2");
  const [creating, setCreating] = useState(false);

  // ── Daftar challenge ──
  const [challenges, setChallenges] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Panel kelola soal ──
  const [selectedChallenge, setSelectedChallenge] = useState<any | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // ── Form tambah/edit soal ──
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [qForm, setQForm] = useState<QuestionForm>(emptyForm());
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [deleteQId, setDeleteQId] = useState<string | null>(null);

  const descImgRef = useRef<HTMLInputElement>(null);
  const outputImgRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    fetchChallenges();
  }, [user]);

  const fetchChallenges = async () => {
    setFetching(true);
    try {
      const res = await fetch(`${API_BASE_URL}/challenges/creator`, { credentials: "include" });
      if (res.ok) setChallenges(await res.json());
    } catch (err) { console.error(err); }
    finally { setFetching(false); }
  };

  const fetchQuestions = async (challengeId: string) => {
    setLoadingQuestions(true);
    try {
      const res = await fetch(`${API_BASE_URL}/challenges/${challengeId}/questions`, { credentials: "include" });
      if (res.ok) setQuestions(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoadingQuestions(false); }
  };

  // ── Buat ujian baru ──
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast({ title: "Validasi", description: "Judul ujian wajib diisi.", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE_URL}/challenges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
          title, 
          description: null, 
          expected_output: null, 
          time_limit_minutes: timeLimit ? parseInt(timeLimit) : null,
          max_tab_switches: maxTabSwitches ? parseInt(maxTabSwitches) : 2
        }),
      });
      if (res.ok) {
        const newChallenge = await res.json();
        toast({ title: "✅ Ujian Dibuat!", description: "Sekarang tambahkan soal-soal ujiannya." });
        setTitle(""); setTimeLimit(""); setMaxTabSwitches("2");
        await fetchChallenges();
        // Langsung buka panel soal untuk ujian baru
        setSelectedChallenge(newChallenge);
        await fetchQuestions(newChallenge.id);
        setShowQuestionForm(true);
      } else {
        const err = await res.json();
        toast({ title: "Gagal", description: err.error, variant: "destructive" });
      }
    } catch { toast({ title: "Kesalahan Jaringan", variant: "destructive", description: "Tidak dapat terhubung." }); }
    finally { setCreating(false); }
  };

  // ── Upload gambar via backend (service_role key) ──
  // Konversi File ke base64 lalu kirim ke endpoint backend
  const uploadImage = async (file: File, prefix: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(',')[1]; // hapus prefix data:...
        try {
          const res = await fetch(`${API_BASE_URL}/challenges/upload-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ base64, mimeType: file.type, prefix }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Upload gagal');
          resolve(data.url);
        } catch (err: any) {
          toast({ title: 'Upload Gagal', description: err.message, variant: 'destructive' });
          resolve(null);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'desc' | 'output'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    if (type === 'desc') {
      setQForm(f => ({ ...f, descriptionImage: file, descriptionImagePreview: preview }));
    } else {
      setQForm(f => ({ ...f, expectedOutputImage: file, expectedOutputImagePreview: preview }));
    }
  };

  const clearImage = (type: 'desc' | 'output') => {
    if (type === 'desc') setQForm(f => ({ ...f, descriptionImage: null, descriptionImagePreview: null }));
    else setQForm(f => ({ ...f, expectedOutputImage: null, expectedOutputImagePreview: null }));
  };

  // ── Simpan soal (tambah / edit) ──
  const handleSaveQuestion = async () => {
    if (!selectedChallenge) return;
    if (!qForm.description.trim() && !qForm.descriptionImage) {
      toast({ title: "Validasi", description: "Isi deskripsi soal (teks atau gambar).", variant: "destructive" });
      return;
    }

    setSavingQuestion(true);
    try {
      let descImgUrl = editingQuestionId
        ? (questions.find(q => q.id === editingQuestionId)?.description_image_url ?? null)
        : null;
      let outputImgUrl = editingQuestionId
        ? (questions.find(q => q.id === editingQuestionId)?.expected_output_image_url ?? null)
        : null;

      // Upload gambar baru jika ada
      if (qForm.descriptionImage) {
        descImgUrl = await uploadImage(qForm.descriptionImage, 'desc');
      }
      if (qForm.expectedOutputImage) {
        outputImgUrl = await uploadImage(qForm.expectedOutputImage, 'output');
      }

      const body = {
        description: qForm.description || null,
        description_image_url: descImgUrl,
        expected_output: qForm.expectedOutput || null,
        expected_output_image_url: outputImgUrl,
      };

      const url = editingQuestionId
        ? `${API_BASE_URL}/challenges/questions/${editingQuestionId}`
        : `${API_BASE_URL}/challenges/${selectedChallenge.id}/questions`;
      const method = editingQuestionId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error((await res.json()).error || "Gagal menyimpan soal.");

      toast({ title: editingQuestionId ? "✅ Soal Diperbarui" : "✅ Soal Ditambahkan" });
      setShowQuestionForm(false);
      setEditingQuestionId(null);
      setQForm(emptyForm());
      await fetchQuestions(selectedChallenge.id);
    } catch (err: any) {
      toast({ title: "Gagal", description: err.message, variant: "destructive" });
    } finally {
      setSavingQuestion(false);
    }
  };

  // ── Hapus soal ──
  const handleDeleteQuestion = async () => {
    if (!deleteQId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/challenges/questions/${deleteQId}`, {
        method: 'DELETE', credentials: "include",
      });
      if (res.ok) {
        toast({ title: "Soal dihapus" });
        await fetchQuestions(selectedChallenge!.id);
      } else {
        toast({ title: "Gagal hapus", variant: "destructive", description: "Coba lagi." });
      }
    } catch { toast({ title: "Kesalahan jaringan", variant: "destructive", description: "" }); }
    finally { setDeleteQId(null); }
  };

  const openEditQuestion = (q: Question) => {
    setQForm({
      description: q.description || '',
      descriptionImage: null,
      descriptionImagePreview: q.description_image_url,
      expectedOutput: q.expected_output || '',
      expectedOutputImage: null,
      expectedOutputImagePreview: q.expected_output_image_url,
    });
    setEditingQuestionId(q.id);
    setShowQuestionForm(true);
  };

  // ── Hapus ujian ──
  const handleDeleteChallenge = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/challenges/${deleteTargetId}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        toast({ title: "Terhapus", description: "Ujian berhasil dihapus." });
        if (selectedChallenge?.id === deleteTargetId) setSelectedChallenge(null);
        fetchChallenges();
      } else {
        toast({ title: "Gagal", description: (await res.json()).error, variant: "destructive" });
      }
    } catch { toast({ title: "Kesalahan Jaringan", variant: "destructive", description: "" }); }
    finally { setIsDeleting(false); setDeleteTargetId(null); }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(code);
    toast({ title: "Disalin", description: `Kode ${code} disalin.`, duration: 2000 });
    setTimeout(() => setCopiedId(null), 3000);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet><title>Buat Soal Ujian – AI Coding Assistant</title></Helmet>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8 pb-20">
        {/* Header */}
        <div className="flex items-start sm:items-center gap-3 sm:gap-4">
          <Link to="/"><Button variant="ghost" size="icon" className="rounded-full shrink-0"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent mt-0.5 sm:mt-0">Buat Soal Ujian</h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-1 sm:mt-0">Buat ujian dengan multiple soal, teks, dan gambar untuk peserta.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">

          {/* ── Kolom Kiri: Form + List Ujian ── */}
          <div className="space-y-6">
            {/* Form Buat Ujian */}
            <div className="bg-card border border-border/50 rounded-2xl p-5 sm:p-6 shadow-xl shadow-orange-500/5">
              <h2 className="text-base sm:text-lg font-bold mb-4 flex items-center gap-2"><Plus className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" /> Buat Ujian Baru</h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Judul Ujian *</label>
                  <Input placeholder="Misal: Ujian Praktikum Python" value={title} onChange={e => setTitle(e.target.value)} className="bg-background/50" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Batas Waktu (Menit) - Opsional</label>
                  <Input type="number" min="1" placeholder="Kosongkan = tak terbatas" value={timeLimit} onChange={e => setTimeLimit(e.target.value)} className="bg-background/50" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Maksimal Pindah Tab (Anti-Cheat)</label>
                  <Input type="number" min="1" placeholder="Default: 2" value={maxTabSwitches} onChange={e => setMaxTabSwitches(e.target.value)} className="bg-background/50" />
                </div>
                <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold h-11" disabled={creating}>
                  {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Membuat...</> : "BUAT UJIAN"}
                </Button>
              </form>
            </div>

            {/* Daftar Ujian */}
            <div className="bg-card border border-border/50 rounded-2xl p-4">
              <h2 className="text-sm font-bold mb-3 text-muted-foreground uppercase tracking-wider">Ujian Buatan Anda</h2>
              {fetching ? (
                <div className="flex justify-center p-6"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : challenges.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm"><BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>Belum ada ujian.</p></div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'hsl(var(--border)) transparent' }}>
                  {challenges.map(c => (
                    <div
                      key={c.id}
                      onClick={() => { setSelectedChallenge(c); fetchQuestions(c.id); setShowQuestionForm(false); }}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${selectedChallenge?.id === c.id ? 'bg-orange-500/10 border-orange-500/30' : 'bg-background/50 border-border/40 hover:border-orange-500/20'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{c.title}</p>
                          <p className="text-[10px] text-muted-foreground">{c.time_limit_minutes ? `${c.time_limit_minutes} menit` : 'Tak terbatas'}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span
                            onClick={e => { e.stopPropagation(); copyToClipboard(c.room_code); }}
                            className="bg-orange-500/10 text-orange-500 font-mono text-[10px] px-1.5 py-0.5 rounded font-bold cursor-pointer hover:bg-orange-500/20 flex items-center gap-1"
                          >
                            {c.room_code}
                            {copiedId === c.room_code ? <CopyCheck className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                          </span>
                          <button
                            onClick={e => { e.stopPropagation(); setDeleteTargetId(c.id); }}
                            className="p-1 rounded-lg text-red-500/50 hover:text-red-500 hover:bg-red-500/10 transition-all"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <Link to={`/challenges/${c.id}/answers`} onClick={e => e.stopPropagation()}>
                        <button className="mt-2 w-full flex items-center justify-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted rounded-lg py-1 transition-all">
                          <Eye className="w-3 h-3" /> Lihat Jawaban
                        </button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Kolom Kanan: Kelola Soal ── */}
          <div className="lg:col-span-2">
            {!selectedChallenge ? (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-border/40 rounded-2xl text-muted-foreground gap-3">
                <FilePlus2 className="w-12 h-12 opacity-20" />
                <p className="text-sm">Pilih ujian di sebelah kiri untuk kelola soalnya</p>
                <p className="text-xs opacity-60">Atau buat ujian baru terlebih dahulu</p>
              </div>
            ) : (
              <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
                {/* Header panel soal */}
                <div className="p-4 sm:p-5 border-b border-border/40 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-bold text-base sm:text-lg truncate w-full">{selectedChallenge.title}</h2>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                      {questions.length} soal · Room: <span className="font-mono text-orange-500 font-bold">{selectedChallenge.room_code}</span>
                    </p>
                  </div>
                  <Button
                    onClick={() => { setShowQuestionForm(true); setEditingQuestionId(null); setQForm(emptyForm()); }}
                    className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white font-bold h-10 sm:h-9 px-4 text-xs sm:text-sm"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Tambah Soal
                  </Button>
                </div>

                {/* Form tambah/edit soal */}
                {showQuestionForm && (
                  <div className="p-5 border-b border-border/40 bg-secondary/10">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-sm">{editingQuestionId ? '✏️ Edit Soal' : `📝 Tambah Soal ${questions.length + 1}`}</h3>
                      <button onClick={() => { setShowQuestionForm(false); setEditingQuestionId(null); setQForm(emptyForm()); }} className="text-muted-foreground hover:text-foreground">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-5">
                      {/* Deskripsi Soal */}
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground">📋 Deskripsi Soal</label>
                        <textarea
                          rows={4}
                          placeholder="Jelaskan instruksi soal... (opsional jika pakai gambar)"
                          value={qForm.description}
                          onChange={e => setQForm(f => ({ ...f, description: e.target.value }))}
                          className="flex w-full rounded-xl border border-input bg-background/50 px-3 py-2 text-xs sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                        {/* Upload gambar deskripsi */}
                        <div>
                          {qForm.descriptionImagePreview ? (
                            <div className="relative inline-block">
                              <img src={qForm.descriptionImagePreview} alt="preview" className="max-h-32 rounded-xl border border-border/50 object-contain" />
                              <button onClick={() => clearImage('desc')} className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => descImgRef.current?.click()}
                              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-border/60 text-xs text-muted-foreground hover:text-foreground hover:border-orange-500/40 transition-all"
                            >
                              <Image className="w-3.5 h-3.5" /> Tambah Gambar Soal (opsional)
                            </button>
                          )}
                          <input ref={descImgRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageSelect(e, 'desc')} />
                        </div>
                      </div>

                      {/* Expected Output */}
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground">📤 Ekspektasi Output (Opsional)</label>
                        <textarea
                          rows={3}
                          placeholder="Output yang diharapkan... (opsional)"
                          value={qForm.expectedOutput}
                          onChange={e => setQForm(f => ({ ...f, expectedOutput: e.target.value }))}
                          className="flex w-full rounded-xl border border-input bg-background/50 px-3 py-2 text-xs sm:text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                        <div>
                          {qForm.expectedOutputImagePreview ? (
                            <div className="relative inline-block">
                              <img src={qForm.expectedOutputImagePreview} alt="preview output" className="max-h-32 rounded-xl border border-border/50 object-contain" />
                              <button onClick={() => clearImage('output')} className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => outputImgRef.current?.click()}
                              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-border/60 text-xs text-muted-foreground hover:text-foreground hover:border-orange-500/40 transition-all"
                            >
                              <Image className="w-3.5 h-3.5" /> Tambah Gambar Output (opsional)
                            </button>
                          )}
                          <input ref={outputImgRef} type="file" accept="image/*" className="hidden" onChange={e => handleImageSelect(e, 'output')} />
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 pt-2">
                        <Button onClick={handleSaveQuestion} disabled={savingQuestion} className="bg-orange-600 hover:bg-orange-700 text-white font-bold h-10 sm:h-9 text-sm flex-1">
                          {savingQuestion ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Menyimpan...</> : <><CheckCircle2 className="w-4 h-4 mr-1" />{editingQuestionId ? 'Perbarui Soal' : 'Simpan Soal'}</>}
                        </Button>
                        <Button variant="outline" onClick={() => { setShowQuestionForm(false); setEditingQuestionId(null); setQForm(emptyForm()); }} className="h-10 sm:h-9 text-sm w-full sm:w-auto px-6">Batal</Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* List soal */}
                <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'hsl(var(--border)) transparent' }}>
                  {loadingQuestions ? (
                    <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                  ) : questions.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <FilePlus2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
                      <p className="text-sm">Belum ada soal. Klik "Tambah Soal" untuk mulai.</p>
                    </div>
                  ) : (
                    questions.map(q => (
                      <div key={q.id} className="bg-background border border-border/40 rounded-xl p-4 hover:border-orange-500/20 transition-all">
                        <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4">
                          <div className="flex-1 min-w-0 w-full">
                            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 mb-2">
                              <span className="w-6 h-6 rounded-full bg-orange-500/10 text-orange-500 text-xs font-black flex items-center justify-center border border-orange-500/20">{q.nomor}</span>
                              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Soal {q.nomor}</span>
                            </div>
                            {q.description && (
                              <p className="text-sm text-foreground/80 whitespace-pre-wrap mb-2 line-clamp-3">{q.description}</p>
                            )}
                            {q.description_image_url && (
                              <img src={q.description_image_url} alt="soal" className="max-h-32 rounded-lg border border-border/40 object-contain mb-2" />
                            )}
                            {(q.expected_output || q.expected_output_image_url) && (
                              <div className="bg-secondary/30 rounded-lg p-2 border border-border/30 mt-2">
                                <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Output yang Diharapkan:</p>
                                {q.expected_output && <p className="font-mono text-xs text-green-400 whitespace-pre-wrap">{q.expected_output}</p>}
                                {q.expected_output_image_url && (
                                  <img src={q.expected_output_image_url} alt="output" className="max-h-24 rounded object-contain mt-1" />
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2 shrink-0 self-end sm:self-auto w-full sm:w-auto justify-end mt-2 sm:mt-0 border-t sm:border-t-0 border-border/40 pt-3 sm:pt-0">
                            <button onClick={() => openEditQuestion(q)} className="py-2 px-3 sm:p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all text-sm flex items-center gap-2"><Pencil className="w-4 h-4 sm:w-3.5 sm:h-3.5" /><span className="sm:hidden font-medium">Edit</span></button>
                            <button onClick={() => setDeleteQId(q.id)} className="py-2 px-3 sm:p-1.5 rounded-lg text-red-500/50 hover:text-red-500 hover:bg-red-500/10 transition-all text-sm flex items-center gap-2"><Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" /><span className="sm:hidden font-medium">Hapus</span></button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dialog hapus ujian */}
      <AlertDialog open={!!deleteTargetId} onOpenChange={() => !isDeleting && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-500">Hapus Ujian Permanen?</AlertDialogTitle>
            <AlertDialogDescription>Semua soal dan jawaban peserta ujian ini akan ikut terhapus. Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteChallenge} disabled={isDeleting} className="bg-red-600 hover:bg-red-700 text-white font-bold">
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog hapus soal */}
      <AlertDialog open={!!deleteQId} onOpenChange={() => setDeleteQId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-500">Hapus Soal Ini?</AlertDialogTitle>
            <AlertDialogDescription>Soal akan dihapus dan nomor urut soal lainnya akan disesuaikan otomatis.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteQuestion} className="bg-red-600 hover:bg-red-700 text-white font-bold">Ya, Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
