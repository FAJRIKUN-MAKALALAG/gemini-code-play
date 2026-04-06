import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Code, Play, MessageSquare, Zap, Cpu, Terminal,
  Moon, Sun, ClipboardList, Trophy, Users, Shield,
  BookOpen, CheckCircle, GitBranch, Star, GraduationCap,
  Image, Clock, BarChart3, ChevronRight
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { kuesionerService } from "@/services/kuesionerService";

interface LandingPageProps {
  onGetStarted: () => void;
}

export const LandingPage = ({ onGetStarted }: LandingPageProps) => {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [isVisible, setIsVisible] = useState(false);
  const [isKuesionerActive, setIsKuesionerActive] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    kuesionerService.getStatus().then(({ is_active }) => {
      setIsKuesionerActive(is_active);
    });
  }, []);

  // ── Scroll-reveal hook ──────────────────────────────────────────────────────
  const useScrollAnimation = () => {
    const ref = useRef<HTMLDivElement>(null);
    const [isIntersecting, setIntersecting] = useState(false);
    useEffect(() => {
      const observer = new IntersectionObserver(
        ([entry]) => setIntersecting(entry.isIntersecting),
        { threshold: 0.08 }
      );
      if (ref.current) observer.observe(ref.current);
      return () => { if (ref.current) observer.unobserve(ref.current); };
    }, []);
    return [ref, isIntersecting] as const;
  };

  const [heroRef, heroVisible] = useScrollAnimation();
  const [howRef, howVisible] = useScrollAnimation();
  const [featuresRef, featuresVisible] = useScrollAnimation();
  const [challengeRef, challengeVisible] = useScrollAnimation();
  const [privacyRef, privacyVisible] = useScrollAnimation();

  useEffect(() => { setIsVisible(true); }, []);

  // ── Particle canvas ─────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const COLORS = [
      "rgba(139, 92, 246, ",
      "rgba(99, 102, 241, ",
      "rgba(59, 130, 246, ",
      "rgba(168, 85, 247, ",
    ];

    type Particle = {
      x: number; y: number; r: number; speed: number;
      drift: number; opacity: number; color: string; pulse: number;
    };

    const makeParticle = (): Particle => ({
      x: Math.random() * canvas.width,
      y: canvas.height + Math.random() * 100,
      r: Math.random() * 2.5 + 0.5,
      speed: Math.random() * 0.6 + 0.2,
      drift: (Math.random() - 0.5) * 0.4,
      opacity: Math.random() * 0.5 + 0.15,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      pulse: Math.random() * Math.PI * 2,
    });

    const particles: Particle[] = Array.from({ length: 90 }, makeParticle);
    particles.forEach(p => { p.y = Math.random() * canvas.height; });

    let animId: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.pulse += 0.015;
        const alpha = p.opacity * (0.8 + 0.2 * Math.sin(p.pulse));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${alpha.toFixed(2)})`;
        ctx.fill();
        p.y -= p.speed;
        p.x += p.drift;
        if (p.y < -10) Object.assign(p, makeParticle());
      });
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // ── Shared badge component ──────────────────────────────────────────────────
  const Badge = ({ text }: { text: string }) => (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
      bg-primary/10 text-primary border border-primary/20 mb-4">
      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
      {text}
    </span>
  );

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ── Theme Toggle ─────────────────────────────────────────────────────── */}
      <div className="fixed top-4 right-4 z-[60]">
        <button
          onClick={() => setTheme(isDark ? "light" : "dark")}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          className="group flex items-center gap-2 pl-3 pr-4 py-2 rounded-full
            bg-background/70 backdrop-blur-xl border border-border/60
            shadow-lg shadow-black/10 hover:shadow-xl hover:shadow-primary/10
            hover:border-primary/40 transition-all duration-300 ease-out
            hover:scale-105 active:scale-95"
        >
          <span className="relative w-4 h-4 flex items-center justify-center">
            <Sun className={`absolute w-4 h-4 text-amber-400 transition-all duration-300 ${isDark ? "opacity-0 scale-50 rotate-90" : "opacity-100 scale-100 rotate-0"}`} />
            <Moon className={`absolute w-4 h-4 text-violet-400 transition-all duration-300 ${isDark ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-50 -rotate-90"}`} />
          </span>
          <span className="text-xs font-semibold text-foreground/80 group-hover:text-foreground transition-colors tracking-wide">
            {isDark ? "Dark" : "Light"}
          </span>
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* HERO                                                                   */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section
        ref={heroRef}
        className={`relative min-h-screen flex flex-col items-center justify-center p-6 text-center
          transition-all duration-1000 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
      >
        {/* Gradient backdrop */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background pointer-events-none" />
        {/* Radial glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px]
          bg-primary/8 rounded-full blur-3xl pointer-events-none" />

        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }} />

        <div className="relative z-10 flex flex-col items-center gap-6 max-w-4xl">
          {/* Logo */}
          <div className="relative group">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl group-hover:bg-primary/30 transition-all duration-700" />
            <img
              src="/AicodeLogo.png"
              alt="AIcode Logo"
              className="w-28 h-28 sm:w-44 sm:h-44 relative z-10 drop-shadow-2xl
                transition-transform duration-700 hover:scale-110 cursor-pointer"
              draggable={false}
            />
          </div>

          {/* Pill badge */}
          <Badge text="Platform AI Coding untuk Kampus" />

          {/* Title */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold
            bg-clip-text text-transparent bg-gradient-to-r from-primary via-purple-400 to-blue-500
            leading-tight animate-in fade-in slide-in-from-bottom-4 duration-1000">
            AI Code Assistant
            <br />
            <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground/80">
              Platform Coding Cerdas
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed
            animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
            Tulis kode Python, jalankan langsung di browser, dan dapatkan bantuan AI real-time.
            Tersedia fitur ujian online, analisis jawaban, serta kuisioner penelitian terintegrasi.
          </p>

          {/* Stats row */}
          <div className="flex flex-wrap justify-center gap-6 text-center animate-in fade-in duration-1000 delay-300">
            {[
              { label: "Notebook Editor", icon: "📓" },
              { label: "Gemini AI Powered", icon: "🤖" },
              { label: "Challenge System", icon: "🏆" },
              { label: "Real-time Review", icon: "📊" },
            ].map(s => (
              <div key={s.label} className="flex flex-col items-center gap-1">
                <span className="text-2xl">{s.icon}</span>
                <span className="text-xs font-semibold text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-3 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-400">
            <Button
              onClick={onGetStarted}
              size="lg"
              className="text-base px-8 py-5 sm:text-lg sm:px-10 sm:py-6 rounded-full
                shadow-lg shadow-primary/25 hover:shadow-primary/50 hover:scale-105 transition-all duration-300
                bg-gradient-to-r from-primary to-purple-600 border-0"
            >
              Mulai Coding Sekarang
              <ChevronRight className="w-5 h-5 ml-1" />
            </Button>
            <a href="#how-it-works">
              <Button
                variant="outline"
                size="lg"
                className="text-base px-8 py-5 sm:text-lg sm:px-10 sm:py-6 rounded-full
                  border-border/60 hover:border-primary/40 hover:scale-105 transition-all duration-300"
              >
                Lihat Fitur
              </Button>
            </a>
          </div>

          {/* Privacy note */}
          <p className="text-xs text-muted-foreground">
            Dengan menggunakan layanan ini, Anda menyetujui{" "}
            <a href="/privacy" className="underline text-primary hover:text-primary/80 transition-colors font-medium">
              Kebijakan Privasi
            </a>{" "}
            kami.
          </p>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 animate-bounce z-10">
          <p className="text-xs text-muted-foreground mb-2">Scroll untuk selengkapnya</p>
          <div className="w-6 h-10 border-2 border-muted-foreground/40 rounded-full mx-auto flex justify-center p-1">
            <div className="w-1 h-2 bg-muted-foreground rounded-full animate-pulse" />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* HOW IT WORKS                                                           */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section
        id="how-it-works"
        ref={howRef}
        className={`py-28 px-6 transition-all duration-1000 ${howVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge text="Cara Kerja" />
            <h2 className="text-3xl md:text-5xl font-bold bg-clip-text text-transparent
              bg-gradient-to-br from-foreground to-muted-foreground">
              Tiga Langkah Mudah
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Dari menulis kode hingga mendapat feedback AI — semua dalam satu platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: <Code className="w-8 h-8" />,
                color: "blue",
                step: "1",
                title: "Tulis & Edit",
                desc: "Gunakan Notebook Editor yang powerful lengkap dengan syntax highlighting, multi-cell support, dan auto-formatting. Mirip Jupyter Notebook langsung di browser.",
              },
              {
                icon: <Play className="w-8 h-8" />,
                color: "green",
                step: "2",
                title: "Jalankan Seketika",
                desc: "Eksekusi kode Python langsung di browser menggunakan runtime berbasis WebAssembly. Lihat output dan error di terminal terintegrasi — tanpa instalasi apapun.",
              },
              {
                icon: <MessageSquare className="w-8 h-8" />,
                color: "purple",
                step: "3",
                title: "Tanya AI",
                desc: "Terjebak? Chat dengan Gemini AI untuk debug, penjelasan konsep, atau review kode. Kirim snippet kode dan error langsung dari editor ke chat.",
              },
            ].map((item, i) => (
              <div
                key={i}
                className={`relative p-8 rounded-2xl bg-card border border-border/50 shadow-xl
                  hover:shadow-2xl hover:border-primary/30 transition-all duration-500
                  transform ${howVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-16"}
                `}
                style={{ transitionDelay: `${i * 150}ms` }}
              >
                {/* Step number */}
                <div className="absolute -top-4 -left-4 w-8 h-8 rounded-full bg-primary text-primary-foreground
                  text-sm font-black flex items-center justify-center shadow-lg shadow-primary/30">
                  {item.step}
                </div>
                <div className={`w-16 h-16 bg-${item.color}-900/20 rounded-2xl flex items-center justify-center mb-6 text-${item.color}-400`}>
                  {item.icon}
                </div>
                <h3 className="text-xl sm:text-2xl font-bold mb-3">{item.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* FEATURE HIGHLIGHTS                                                     */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section
        ref={featuresRef}
        className={`py-28 px-6 bg-secondary/20 border-y border-border/50 transition-all duration-1000
          ${featuresVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge text="Fitur Unggulan" />
            <h2 className="text-3xl md:text-5xl font-bold">Lengkap untuk Belajar & Mengajar</h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Dirancang khusus untuk lingkungan akademik — siswa belajar, pengajar memantau.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: <BookOpen className="w-6 h-6" />,
                title: "Notebook Multi-Cell",
                desc: "Editor berformat notebook (seperti Jupyter) dengan dukungan beberapa cell, jalankan per-cell atau semua sekaligus.",
                badge: "Editor",
              },
              {
                icon: <Zap className="w-6 h-6" />,
                title: "Eksekusi Cepat",
                desc: "Runtime Python berbasis Skulpt berjalan lokal di browser — tanpa server, tanpa delay, tanpa instalasi pip.",
                badge: "Runtime",
              },
              {
                icon: <Terminal className="w-6 h-6" />,
                title: "Terminal Interaktif",
                desc: "Dukungan stdin/stdout penuh. Buat CLI tools, scripts data, dan program interaktif dengan mudah.",
                badge: "Terminal",
              },
              {
                icon: <Trophy className="w-6 h-6" />,
                title: "Sistem Ujian Online",
                desc: "Pengajar bisa buat ujian multi-soal dengan kode unik room. Peserta bergabung, kerjakan soal, dan submit jawaban langsung.",
                badge: "Challenge",
              },
              {
                icon: <Image className="w-6 h-6" />,
                title: "Soal Berbasis Gambar",
                desc: "Tambahkan gambar pada deskripsi soal atau ekspektasi output — ideal untuk soal visual dan flowchart.",
                badge: "Challenge",
              },
              {
                icon: <BarChart3 className="w-6 h-6" />,
                title: "Review Jawaban Real-Time",
                desc: "Pengajar dapat memantau status pengerjaan siswa secara live dan melihat jawaban kode mereka.",
                badge: "Challenge",
              },
              {
                icon: <Clock className="w-6 h-6" />,
                title: "Batas Waktu Ujian",
                desc: "Atur batas waktu per ujian. Countdown timer muncul di layar siswa, auto-submission saat waktu habis.",
                badge: "Challenge",
              },
              {
                icon: <Cpu className="w-6 h-6" />,
                title: "Gemini AI Chat",
                desc: "Asisten AI berbasis Google Gemini dengan sliding window history, stop streaming, dan konteks kode aktif.",
                badge: "AI",
              },
              {
                icon: <ClipboardList className="w-6 h-6" />,
                title: "Kuesioner Penelitian",
                desc: "Sistem kuesioner terintegrasi untuk pengumpulan data penelitian. Admin panel real-time dengan toggle aktif/nonaktif.",
                badge: "Research",
              },
              {
                icon: <Users className="w-6 h-6" />,
                title: "Autentikasi Google OAuth",
                desc: "Login aman dengan Google. Profil pengguna tersinkronisasi — avatar dan username dapat diubah.",
                badge: "Auth",
              },
              {
                icon: <GitBranch className="w-6 h-6" />,
                title: "Simpan Snippet Kode",
                desc: "Simpan kode ke database, terhubung dengan sesi chat aktif. Akses dari perangkat manapun.",
                badge: "Storage",
              },
              {
                icon: <GraduationCap className="w-6 h-6" />,
                title: "FAQ & Onboarding",
                desc: "Modal FAQ interaktif membantu pengguna baru memahami fitur platform dengan cepat.",
                badge: "UX",
              },
            ].map((f, i) => (
              <div
                key={i}
                className={`group p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/40
                  hover:shadow-xl hover:shadow-primary/5 transition-all duration-500 cursor-default
                  transform ${featuresVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}
                `}
                style={{ transitionDelay: `${i * 60}ms` }}
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300 shrink-0">
                    {f.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-sm group-hover:text-primary transition-colors">{f.title}</h3>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold uppercase tracking-wide">
                        {f.badge}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* CHALLENGE SYSTEM SHOWCASE                                              */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section
        ref={challengeRef}
        className={`py-28 px-6 transition-all duration-1000
          ${challengeVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
      >
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-16 items-center">

          {/* Left: Text */}
          <div className="flex-1 space-y-8">
            <div>
              <Badge text="Sistem Ujian" />
              <h2 className="text-3xl md:text-4xl font-bold mt-2 leading-tight">
                Ujian Coding Online
                <br />
                <span className="text-primary">berbasis Kode Room</span>
              </h2>
              <p className="mt-4 text-muted-foreground leading-relaxed max-w-lg">
                Pengajar membuat ujian dengan multiple soal, menentukan batas waktu,
                dan membagikan kode room ke peserta. Siswa mengerjakan soal langsung
                di platform dengan dukungan AI dan editor notebook.
              </p>
            </div>

            <div className="space-y-5">
              {[
                {
                  icon: <Trophy className="w-5 h-5 text-orange-400" />,
                  title: "Pengajar Buat Ujian",
                  desc: "Multi-soal dengan teks & gambar, batas waktu opsional, kode room otomatis.",
                },
                {
                  icon: <Users className="w-5 h-5 text-blue-400" />,
                  title: "Siswa Bergabung",
                  desc: "Masukkan kode room, kerjakan soal di editor, submit jawaban.",
                },
                {
                  icon: <BarChart3 className="w-5 h-5 text-green-400" />,
                  title: "Review Real-Time",
                  desc: "Pantau status pengerjaan semua peserta dan lihat jawaban kode mereka secara live.",
                },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-4 group">
                  <div className="p-2.5 rounded-xl bg-card border border-border/50 group-hover:scale-105 transition-transform duration-300 shrink-0">
                    {item.icon}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm mb-0.5">{item.title}</h4>
                    <p className="text-muted-foreground text-sm">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Code card */}
          <div className="flex-1 w-full relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-rose-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000" />
            <div className="relative bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl">
              {/* Window chrome */}
              <div className="flex items-center gap-2 px-4 py-3 bg-white/5 border-b border-white/10">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="ml-2 text-xs text-white/40 font-mono">challenge_mode.py</span>
              </div>
              <div className="p-6">
                <pre className="text-sm font-mono leading-7">
                  <span className="text-slate-500"># 🎯 TANTANGAN: Buat fungsi fibonacci</span>{"\n"}
                  <span className="text-slate-500"># Room: XK92 · Batas Waktu: 30 menit</span>{"\n\n"}
                  <span className="text-purple-400">def</span>{" "}
                  <span className="text-blue-400">fibonacci</span>
                  <span className="text-white">(n):</span>{"\n"}
                  {"    "}
                  <span className="text-yellow-300">"""</span>
                  <span className="text-yellow-300">Kembalikan deret fibonacci ke-n</span>
                  <span className="text-yellow-300">"""</span>{"\n"}
                  {"    "}
                  <span className="text-purple-400">if</span>{" "}
                  <span className="text-white">n {"<="} 1:</span>{"\n"}
                  {"        "}
                  <span className="text-purple-400">return</span>{" "}
                  <span className="text-orange-400">n</span>{"\n"}
                  {"    "}
                  <span className="text-purple-400">return</span>{" "}
                  <span className="text-blue-400">fibonacci</span>
                  <span className="text-white">(n-1) + </span>
                  <span className="text-blue-400">fibonacci</span>
                  <span className="text-white">(n-2)</span>{"\n\n"}
                  <span className="text-white">print(</span>
                  <span className="text-green-400">fibonacci(10)</span>
                  <span className="text-white">)</span>
                </pre>
                {/* Output bar */}
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-white/30 font-mono uppercase tracking-wider">Output</span>
                    <div className="flex-1 h-px bg-white/5" />
                    <span className="text-xs font-mono text-green-400">✓ Jawaban Disubmit</span>
                  </div>
                  <pre className="text-green-400 text-sm font-mono">55</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ADVANCED PLATFORM FEATURES                                             */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-28 px-6 bg-secondary/20 border-t border-border/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge text="Platform" />
            <h2 className="text-3xl md:text-4xl font-bold">Fitur Platform Lanjutan</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                title: "Notebook Editor (Multi-Cell)",
                icon: <Star className="w-5 h-5 text-amber-400" />,
                points: [
                  "Tambah, hapus, dan susun ulang cell",
                  "Jalankan per-cell atau semua sekaligus",
                  "Kirim kode cell langsung ke AI Chat",
                  "Sinkronisasi dengan sesi chat aktif",
                ],
              },
              {
                title: "Gemini AI Assistant",
                icon: <Cpu className="w-5 h-5 text-violet-400" />,
                points: [
                  "Powered by Google Gemini Flash",
                  "Streaming response dengan tombol stop",
                  "Sliding window history management",
                  "Konteks kode notebook aktif",
                ],
              },
              {
                title: "Sistem Profil Pengguna",
                icon: <Users className="w-5 h-5 text-blue-400" />,
                points: [
                  "Login via Google OAuth 2.0",
                  "Ubah username dan avatar",
                  "Histori percakapan tersimpan",
                  "Sinkronisasi lintas perangkat",
                ],
              },
              {
                title: "Dark / Light Mode",
                icon: <Moon className="w-5 h-5 text-indigo-400" />,
                points: [
                  "Toggle tema kapan saja",
                  "Persisten via localStorage",
                  "Optimized untuk baca kode malam hari",
                  "Responsive di semua ukuran layar",
                ],
              },
            ].map((card, i) => (
              <div
                key={i}
                className="p-7 rounded-2xl bg-card border border-border/50 hover:border-primary/30
                  hover:shadow-xl transition-all duration-500 group"
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2 rounded-lg bg-primary/10 group-hover:scale-110 transition-transform duration-300">
                    {card.icon}
                  </div>
                  <h3 className="font-bold text-base">{card.title}</h3>
                </div>
                <ul className="space-y-2.5">
                  {card.points.map((p, j) => (
                    <li key={j} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* DATA PRIVACY                                                           */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section
        ref={privacyRef}
        className={`py-20 px-6 transition-all duration-1000
          ${privacyVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
      >
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex p-3 rounded-2xl bg-primary/10 mb-6">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Privasi Data & Transparansi</h2>
          <p className="text-muted-foreground leading-relaxed mb-8 max-w-2xl mx-auto">
            Kami berkomitmen menjaga privasi Anda. Data yang dikumpulkan hanya digunakan untuk
            mendukung pengalaman belajar Anda di platform ini.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
            {[
              {
                title: "Mengapa kami kumpulkan data?",
                desc: "Kami meminta akses ke profil Google dasar (email & nama) untuk membuat akun dan memungkinkan Anda menyimpan kode serta histori chat antar sesi.",
              },
              {
                title: "Bagaimana kami menggunakannya?",
                desc: "Data hanya digunakan untuk autentikasi dan menyimpan proyek Anda. Kami tidak membagikan data ke pihak ketiga atau menggunakannya untuk iklan.",
              },
            ].map((item, i) => (
              <div key={i} className="p-6 rounded-xl bg-card border border-border">
                <h4 className="font-bold mb-2 text-primary">{item.title}</h4>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* FOOTER                                                                 */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <footer className="py-14 bg-secondary/30 text-center text-muted-foreground border-t border-border">
        <div className="max-w-7xl mx-auto px-6">
          {/* CTA band */}
          <div className="mb-12 p-10 rounded-2xl bg-gradient-to-r from-primary/10 via-purple-500/10 to-blue-500/10
            border border-primary/20">
            <h3 className="text-2xl font-bold mb-3">Siap Mulai Coding?</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Bergabunglah dan rasakan pengalaman coding dengan bantuan AI yang intuitif.
            </p>
            <Button
              onClick={onGetStarted}
              size="lg"
              className="rounded-full px-10 shadow-lg shadow-primary/25 hover:shadow-primary/50
                hover:scale-105 transition-all duration-300 bg-gradient-to-r from-primary to-purple-600 border-0"
            >
              Mulai Sekarang — Gratis
            </Button>
          </div>

          <div className="flex flex-col items-center gap-4">
            <img
              src="/AicodeLogo.png"
              alt="Logo"
              className="w-12 h-12 grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-500"
            />
            <p className="text-sm">© {new Date().getFullYear()} aicode-unklab. Dibangun untuk para developer.</p>
            <div className="flex gap-6 mt-1">
              <a href="/privacy" className="text-xs underline hover:text-primary transition-colors font-medium">
                Kebijakan Privasi
              </a>
              <a href="/terms" className="text-xs underline hover:text-primary transition-colors">
                Syarat Layanan
              </a>
            </div>

            {/* Kuesioner CTA — only when active */}
            {isKuesionerActive && (
              <div className="mt-4">
                <a
                  href="/kuesioner"
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold
                    text-primary-foreground bg-primary rounded-full
                    hover:bg-primary/90 transition-all shadow-md hover:shadow-lg hover:scale-105"
                >
                  <ClipboardList className="w-4 h-4" />
                  Isi Kuesioner Penelitian
                </a>
              </div>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};
