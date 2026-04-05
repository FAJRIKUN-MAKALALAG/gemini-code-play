import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { Loader2, CheckCircle2, ClipboardList, ChevronLeft, Lock } from "lucide-react";
import { kuesionerService, KuesionerAnswers } from "@/services/kuesionerService";

// ─── Data soal ────────────────────────────────────────────────────────────────
const PERTANYAAN = [
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

const SKALA = [
  { label: "SS", title: "Sangat Setuju", value: 5, color: "from-emerald-500 to-green-400" },
  { label: "S",  title: "Setuju",        value: 4, color: "from-teal-500 to-cyan-400" },
  { label: "N",  title: "Netral",        value: 3, color: "from-amber-500 to-yellow-400" },
  { label: "TS", title: "Tidak Setuju",  value: 2, color: "from-orange-500 to-amber-400" },
  { label: "STS",title: "Sangat Tidak Setuju", value: 1, color: "from-red-500 to-rose-400" },
];

const DEFAULT_ANSWERS: KuesionerAnswers = {
  q1: 0, q2: 0, q3: 0, q4: 0, q5: 0,
  q6: 0, q7: 0, q8: 0, q9: 0, q10: 0,
};

// ─── Tipe helper ──────────────────────────────────────────────────────────────
type QKey = keyof KuesionerAnswers;
const Q_KEYS: QKey[] = ["q1","q2","q3","q4","q5","q6","q7","q8","q9","q10"];

// ─── Component ────────────────────────────────────────────────────────────────
const Kuesioner = () => {
  const navigate = useNavigate();
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [pesan, setPesan] = useState("");
  const [answers, setAnswers] = useState<KuesionerAnswers>({ ...DEFAULT_ANSWERS });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Status kuesioner — cek saat halaman dibuka
  const [statusLoading, setStatusLoading] = useState(true);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    kuesionerService.getStatus().then(({ is_active }) => {
      setIsActive(is_active);
      setStatusLoading(false);
    });
  }, []);

  // Hitung progress pengisian
  const totalDiisi = Q_KEYS.filter((k) => answers[k] > 0).length;
  const progress = Math.round((totalDiisi / 10) * 100);

  const handleAnswer = (qKey: QKey, value: number) => {
    setAnswers((prev) => ({ ...prev, [qKey]: value }));
    setErrorMsg(null);
  };

  const validate = (): boolean => {
    if (!nama.trim()) { setErrorMsg("Nama lengkap wajib diisi."); return false; }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMsg("Masukkan alamat email yang valid."); return false;
    }
    if (totalDiisi < 10) {
      setErrorMsg(`Masih ada ${10 - totalDiisi} pertanyaan yang belum dijawab.`); return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!validate()) return;

    setLoading(true);
    const { success, error } = await kuesionerService.submit({ nama, email, answers, pesan });
    setLoading(false);

    if (!success) {
      setErrorMsg(error || "Gagal mengirim. Coba lagi.");
      return;
    }
    setSubmitted(true);
  };

  // ── Loading status check ────────────────────────────────────────────────────
  if (statusLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  // ── Kuesioner tidak aktif ─────────────────────────────────────────────────
  if (!isActive) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Helmet>
          <title>Kuesioner Ditutup – AI Code Playground</title>
        </Helmet>
        <div className="text-center max-w-md animate-in fade-in slide-in-from-bottom-5 duration-500">
          <div className="w-20 h-20 rounded-full bg-muted/60 border border-border/50 flex items-center justify-center mx-auto mb-5">
            <Lock className="w-9 h-9 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold mb-3">Kuesioner Belum Dibuka</h1>
          <p className="text-muted-foreground text-sm mb-2">
            Pengumpulan jawaban kuesioner saat ini <strong>belum dibuka</strong> atau telah ditutup oleh administrator.
          </p>
          <p className="text-muted-foreground text-xs mb-8">
            Silakan coba lagi nanti atau hubungi peneliti untuk informasi lebih lanjut.
          </p>
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
            Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  // ── Halaman sukses ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Helmet>
          <title>Kuesioner Terkirim – AI Code Playground</title>
        </Helmet>
        <div
          className="max-w-md w-full text-center animate-in fade-in slide-in-from-bottom-6 duration-700"
          style={{ animationFillMode: "both" }}
        >
          <div className="w-24 h-24 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
          </div>
          <h1 className="text-3xl font-bold mb-3">Terima Kasih! 🎉</h1>
          <p className="text-muted-foreground mb-2">
            Kuesioner Anda sudah kami terima, <span className="text-foreground font-semibold">{nama}</span>.
          </p>
          <p className="text-muted-foreground text-sm mb-8">
            Masukan Anda sangat berarti untuk pengembangan sistem ini ke depannya.
          </p>
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 active:scale-95 transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
            Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  // ── Halaman form ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Kuesioner Kepuasan Pengguna – AI Code Playground</title>
        <meta name="description" content="Isi kuesioner kepuasan pengguna sistem AI Code Playground." />
      </Helmet>

      {/* Header gradient bar */}
      <div className="h-1.5 w-full bg-gradient-to-r from-primary via-purple-500 to-pink-500" />

      {/* Background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-5%] w-[400px] h-[400px] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">

        {/* ── Header ── */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-5">
            <ClipboardList className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
            Kuesioner Kepuasan Pengguna
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto text-sm md:text-base">
            Evaluasi pengalaman Anda menggunakan <span className="text-primary font-medium">AI Code Playground</span>.
            Hasil kuesioner ini digunakan untuk keperluan penelitian skripsi.
          </p>
        </div>

        {/* ── Progress bar ── */}
        <div className="mb-8">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>{totalDiisi}/10 pertanyaan dijawab</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── Identitas ── */}
          <div className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">i</span>
              Identitas Responden
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="nama" className="text-sm font-medium">
                  Nama Lengkap <span className="text-red-500">*</span>
                </label>
                <input
                  id="nama"
                  type="text"
                  placeholder="Masukkan nama lengkap..."
                  value={nama}
                  onChange={(e) => { setNama(e.target.value); setErrorMsg(null); }}
                  className="w-full px-3 py-2.5 rounded-xl border border-border/60 bg-background/50 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  disabled={loading}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium">
                  Alamat Email <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="nama@email.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrorMsg(null); }}
                  className="w-full px-3 py-2.5 rounded-xl border border-border/60 bg-background/50 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  disabled={loading}
                  required
                />
              </div>
            </div>
          </div>

          {/* ── Legenda skala ── */}
          <div className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Keterangan Skala</p>
            <div className="flex flex-wrap gap-2">
              {SKALA.map((s) => (
                <span key={s.value} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-muted/60 border border-border/40">
                  <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${s.color}`} />
                  <strong>{s.label}</strong> = {s.title} ({s.value})
                </span>
              ))}
            </div>
          </div>

          {/* ── Tabel pertanyaan ── */}
          <div className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl shadow-sm overflow-hidden">
            {/* Header tabel */}
            <div className="hidden md:grid grid-cols-[2rem_1fr_repeat(5,3.5rem)] gap-x-2 px-6 py-3 bg-muted/40 border-b border-border/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <span>No</span>
              <span>Pernyataan</span>
              {SKALA.map((s) => (
                <span key={s.value} className="text-center">{s.label}</span>
              ))}
            </div>

            <div className="divide-y divide-border/30">
              {PERTANYAAN.map((soal, idx) => {
                const qKey = Q_KEYS[idx];
                const selected = answers[qKey];

                return (
                  <div
                    key={qKey}
                    className={`px-4 md:px-6 py-4 transition-colors duration-200 ${
                      selected > 0 ? "bg-primary/5" : "hover:bg-muted/30"
                    }`}
                  >
                    {/* Desktop layout */}
                    <div className="hidden md:grid grid-cols-[2rem_1fr_repeat(5,3.5rem)] gap-x-2 items-center">
                      <span className="text-sm font-bold text-muted-foreground">{idx + 1}</span>
                      <span className="text-sm leading-snug">{soal}</span>
                      {SKALA.map((s) => (
                        <div key={s.value} className="flex justify-center">
                          <button
                            type="button"
                            onClick={() => handleAnswer(qKey, s.value)}
                            title={s.title}
                            className={`w-8 h-8 rounded-full border-2 transition-all duration-200 flex items-center justify-center ${
                              selected === s.value
                                ? `bg-gradient-to-br ${s.color} border-transparent shadow-md scale-110`
                                : "border-border/50 hover:border-primary/50 hover:bg-primary/10"
                            }`}
                          >
                            {selected === s.value && (
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Mobile layout */}
                    <div className="md:hidden">
                      <p className="text-sm font-medium mb-3">
                        <span className="text-muted-foreground mr-2">{idx + 1}.</span>{soal}
                      </p>
                      <div className="flex gap-2 justify-between">
                        {SKALA.map((s) => (
                          <button
                            key={s.value}
                            type="button"
                            onClick={() => handleAnswer(qKey, s.value)}
                            className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl border-2 text-xs font-semibold transition-all duration-200 ${
                              selected === s.value
                                ? `bg-gradient-to-b ${s.color} border-transparent text-white shadow-md`
                                : "border-border/50 hover:border-primary/40 hover:bg-primary/5 text-muted-foreground"
                            }`}
                          >
                            <span>{s.label}</span>
                            <span className={`text-[10px] ${selected === s.value ? "opacity-90" : "opacity-60"}`}>({s.value})</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Pesan / Saran (Optional) ── */}
          <div className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">✎</span>
              Pesan & Saran untuk Sistem
            </h2>
            <div className="space-y-1.5">
              <label htmlFor="pesan" className="text-sm font-medium text-muted-foreground">
                Tambahkan pesan, kesan, atau kritik Anda mengenai sistem (Opsional)
              </label>
              <textarea
                id="pesan"
                placeholder="Menurut saya sistem ini..."
                value={pesan}
                onChange={(e) => setPesan(e.target.value)}
                rows={4}
                className="w-full px-3 py-2.5 rounded-xl border border-border/60 bg-background/50 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all resize-y"
                disabled={loading}
              />
            </div>
          </div>

          {/* ── Error message ── */}
          {errorMsg && (
            <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl animate-in fade-in duration-300">
              <svg className="w-5 h-5 text-red-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-sm text-red-600 dark:text-red-400">{errorMsg}</p>
            </div>
          )}

          {/* ── Submit button ── */}
          <button
            id="kuesioner-submit-btn"
            type="submit"
            disabled={loading}
            className="w-full h-13 py-3.5 rounded-2xl bg-gradient-to-r from-primary to-purple-600 text-white font-semibold text-base shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:opacity-95 active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Mengirim...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                Kirim Kuesioner
              </>
            )}
          </button>

          <p className="text-center text-xs text-muted-foreground">
            Data Anda hanya digunakan untuk keperluan penelitian skripsi dan tidak akan dipublikasikan.
          </p>
        </form>
      </div>
    </div>
  );
};

export default Kuesioner;
