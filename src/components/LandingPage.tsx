import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Code, Play, MessageSquare, Zap, Cpu, Terminal, Moon, Sun, ClipboardList } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { kuesionerService } from "@/services/kuesionerService";

interface LandingPageProps {
  onGetStarted: () => void;
}

export const LandingPage = ({ onGetStarted }: LandingPageProps) => {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [isVisible, setIsVisible] = useState(false);
  const [isKuesionerActive, setIsKuesionerActive] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Check if the questionnaire is active
    kuesionerService.getStatus().then(({ is_active }) => {
      setIsKuesionerActive(is_active);
    });
  }, []);

  // Intersection Observer hook
  const useScrollAnimation = () => {
    const ref = useRef<HTMLDivElement>(null);
    const [isIntersecting, setIntersecting] = useState(false);

    useEffect(() => {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIntersecting(true);
          } else {
            setIntersecting(false);
          }
        },
        { threshold: 0.1 }
      );

      if (ref.current) {
        observer.observe(ref.current);
      }

      return () => {
        if (ref.current) observer.unobserve(ref.current);
      };
    }, []);

    return [ref, isIntersecting] as const;
  };

  const [heroRef, heroVisible] = useScrollAnimation();
  const [featureRef1, feature1Visible] = useScrollAnimation();
  const [featureRef2, feature2Visible] = useScrollAnimation();
  const [featureRef3, feature3Visible] = useScrollAnimation();
  const [featuresRef, featuresVisible] = useScrollAnimation();

  useEffect(() => {
    setIsVisible(true);
  }, []);

  // ── Particle Effect ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const COLORS = [
      'rgba(139, 92, 246, ',   // violet
      'rgba(99, 102, 241, ',   // indigo
      'rgba(59, 130, 246, ',   // blue
      'rgba(168, 85, 247, ',   // purple
    ];

    type Particle = {
      x: number; y: number;
      r: number; speed: number;
      drift: number; opacity: number;
      color: string; pulse: number;
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
    // Scatter initial positions vertically
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

        if (p.y < -10) {
          Object.assign(p, makeParticle());
        }
      });
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ── Theme Toggle — Fixed top-right, production-grade pill button ── */}
      <div className="fixed top-4 right-4 z-[60]">
        <button
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Light mode' : 'Dark mode'}
          className="group flex items-center gap-2 pl-3 pr-4 py-2 rounded-full
            bg-background/70 backdrop-blur-xl
            border border-border/60
            shadow-lg shadow-black/10
            hover:shadow-xl hover:shadow-primary/10
            hover:border-primary/40
            transition-all duration-300 ease-out
            hover:scale-105 active:scale-95"
        >
          {/* Animated icon swap */}
          <span className="relative w-4 h-4 flex items-center justify-center">
            <Sun
              className={`absolute w-4 h-4 text-amber-400 transition-all duration-300 ${
                isDark ? 'opacity-0 scale-50 rotate-90' : 'opacity-100 scale-100 rotate-0'
              }`}
            />
            <Moon
              className={`absolute w-4 h-4 text-violet-400 transition-all duration-300 ${
                isDark ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 -rotate-90'
              }`}
            />
          </span>
          <span className="text-xs font-semibold text-foreground/80 group-hover:text-foreground transition-colors tracking-wide">
            {isDark ? 'Dark' : 'Light'}
          </span>
        </button>
      </div>
      {/* Hero Section */}
      <section
        className={`relative min-h-screen flex flex-col items-center justify-center p-6 text-center transition-all duration-1000 transform ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
      >
        {/* Particle Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ zIndex: 0 }}
        />
        {/* Content above particles */}
        <div className="relative z-10 flex flex-col items-center">
          <div className="relative mb-8 group">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl group-hover:bg-primary/30 transition-all duration-700"></div>
            <img
              src="/AicodeLogo.png"
              alt="AIcode Logo"
              className="w-32 h-32 sm:w-48 sm:h-48 relative z-10 drop-shadow-2xl transition-transform duration-700 hover:scale-110 cursor-pointer dark-invert"
              draggable={false}
            />
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-4 sm:mb-6 bg-clip-text text-transparent bg-gradient-to-r from-primary via-purple-500 to-blue-600 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            AI Code Assistant
          </h1>

          <p className="text-sm sm:text-xl md:text-2xl text-muted-foreground max-w-2xl mb-8 sm:mb-12 leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
            Experience the future of coding. Write Python, run it instantly, and get AI-powered assistance in real-time.
          </p>

          <div className="animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300">
            <Button
              onClick={onGetStarted}
              size="lg"
              className="text-base px-6 py-4 sm:text-lg sm:px-10 sm:py-6 rounded-full shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-105 transition-all duration-300"
            >
              Start Coding Now
            </Button>
            {/* Privacy Policy link — visible di hero agar Google OAuth verifier mendeteksinya */}
            <p className="mt-4 text-xs text-muted-foreground">
              By using this service, you agree to our{" "}
              <a
                href="/privacy"
                className="underline text-primary hover:text-primary/80 transition-colors font-medium"
              >
                Privacy Policy
              </a>
            </p>
          </div>
        </div> {/* end z-10 wrapper */}

        <div className="absolute bottom-10 animate-bounce z-10">
          <p className="text-sm text-muted-foreground mb-2">Scroll to learn more</p>
          <div className="w-6 h-10 border-2 border-muted-foreground rounded-full mx-auto flex justify-center p-1">
            <div className="w-1 h-2 bg-muted-foreground rounded-full animate-pulse"></div>
          </div>
        </div>
      </section>

      {/* How it works Section */}
      <section
        id="how-it-works"
        ref={featuresRef}
        className={`py-32 px-6 bg-secondary/30 transition-opacity duration-1000 ${featuresVisible ? 'opacity-100' : 'opacity-0'}`}
      >
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl md:text-5xl font-bold text-center mb-16 sm:mb-24 bg-clip-text text-transparent bg-gradient-to-br from-foreground to-muted-foreground">
            How to use AI Coding Assistants
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {/* Feature 1 */}
            <div
              ref={featureRef1}
              className={`p-8 rounded-2xl bg-card border border-border/50 shadow-xl hover:shadow-2xl hover:border-primary/50 transition-all duration-700 transform ${feature1Visible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"
                }`}
            >
              <div className="w-16 h-16 bg-blue-900/20 rounded-2xl flex items-center justify-center mb-6 text-blue-400">
                <Code className="w-8 h-8" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-4">1. Write & Edit</h3>
              <p className="text-muted-foreground leading-relaxed">
                Use the powerful code editor to write your Python scripts. It supports syntax highlighting, auto-formatting, and intelligent suggestions to keep your code clean.
              </p>
            </div>

            {/* Feature 2 */}
            <div
              ref={featureRef2}
              className={`p-8 rounded-2xl bg-card border border-border/50 shadow-xl hover:shadow-2xl hover:border-primary/50 transition-all duration-700 delay-200 transform ${feature2Visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-20"
                }`}
            >
              <div className="w-16 h-16 bg-green-900/20 rounded-2xl flex items-center justify-center mb-6 text-green-400">
                <Play className="w-8 h-8" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-4">2. Run Instantly</h3>
              <p className="text-muted-foreground leading-relaxed">
                Execute your code directly in the browser with our embedded Python runtime. See output instantly in the integrated terminal without any server setup.
              </p>
            </div>

            {/* Feature 3 */}
            <div
              ref={featureRef3}
              className={`p-8 rounded-2xl bg-card border border-border/50 shadow-xl hover:shadow-2xl hover:border-primary/50 transition-all duration-700 delay-400 transform ${feature3Visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-20"
                }`}
            >
              <div className="w-16 h-16 bg-purple-900/20 rounded-2xl flex items-center justify-center mb-6 text-purple-400">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold mb-4">3. AI Assistance</h3>
              <p className="text-muted-foreground leading-relaxed">
                Stuck? Ask the AI assistant to debug your code, explain concepts, or suggest improvements. It's like having a senior developer pair-programming with you.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Advanced Features */}
      <section className="py-32 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-16 items-center">
          <div className="space-y-12 flex-1">
            <div className="flex items-start gap-6 group">
              <div className="p-4 bg-primary/10 rounded-2xl text-primary group-hover:scale-110 transition-transform duration-300">
                <Zap className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2 group-hover:text-primary transition-colors">Lightning Fast Execution</h3>
                <p className="text-muted-foreground text-lg">Local execution means zero latency. Your code runs instantly in your browser without waiting for server round-trips.</p>
              </div>
            </div>
            <div className="flex items-start gap-6 group">
              <div className="p-4 bg-primary/10 rounded-2xl text-primary group-hover:scale-110 transition-transform duration-300">
                <Cpu className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2 group-hover:text-primary transition-colors">Browser-Based Runtime</h3>
                <p className="text-muted-foreground text-lg">No installation required. Our advanced runtime works on any device with a modern web browser, powered by WebAssembly.</p>
              </div>
            </div>
            <div className="flex items-start gap-6 group">
              <div className="p-4 bg-primary/10 rounded-2xl text-primary group-hover:scale-110 transition-transform duration-300">
                <Terminal className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2 group-hover:text-primary transition-colors">Interactive Terminal</h3>
                <p className="text-muted-foreground text-lg">Full standard input/output support. Build interactive CLI tools, games, and data scripts effortlessly.</p>
              </div>
            </div>
          </div>
          <div className="flex-1 w-full relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-purple-600 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-1000"></div>
            <div className="relative bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl p-8 shadow-2xl overflow-hidden">
              <div className="flex gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
              <pre className="text-sm md:text-base font-mono text-muted-foreground font-medium">
                <span className="text-purple-400">def</span> <span className="text-blue-400">welcome</span>(user):{'\n'}
                {'    '}print(<span className="text-green-400">f"Hello, &#123;user&#125;!"</span>){'\n'}
                {'    '}ai_assist.start_session(){'\n'}
                {'\n'}
                <span className="text-slate-500"># Start coding journey</span>{'\n'}
                welcome(<span className="text-green-400">"Developer"</span>)
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Data Privacy & Transparency Section */}
      <section className="py-20 px-6 bg-background/50 border-t border-border">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-6">Data Privacy & Transparency</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            At <strong>aicode-unklab</strong>, we value your privacy. We use Google OAuth to securely authenticate users and provide a personalized experience.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8 text-left">
            <div className="p-6 rounded-xl bg-card border border-border">
              <h4 className="font-bold mb-2 text-primary">Why we collect data?</h4>
              <p className="text-sm text-muted-foreground">We request your email and basic profile info to create your account and allow you to save/load your Python code snippets across devices.</p>
            </div>
            <div className="p-6 rounded-xl bg-card border border-border">
              <h4 className="font-bold mb-2 text-primary">How we use it?</h4>
              <p className="text-sm text-muted-foreground">Your data is only used for authentication and to store your personal projects. We never share your data with third parties or use it for advertising.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-12 bg-secondary/50 text-center text-muted-foreground border-t border-border">
        <div className="flex flex-col items-center gap-4">
          <img src="/AicodeLogo.png" alt="Logo" className="w-12 h-12 grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-500" />
          <p className="text-sm">© {new Date().getFullYear()} aicode-unklab. Built for developers.</p>
          <div className="flex gap-6 mt-2">
            <a href="/privacy" className="text-xs underline hover:text-primary transition-colors font-medium">Privacy Policy</a>
            <a href="/terms" className="text-xs underline hover:text-primary transition-colors">Terms of Service</a>
          </div>
          {isKuesionerActive && (
            <div className="mt-4">
              <a
                href="/kuesioner"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-full hover:bg-primary/90 transition-all shadow-md hover:shadow-lg"
              >
                <ClipboardList className="w-4 h-4" />
                Beri Masukan (Kuesioner)
              </a>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
};
