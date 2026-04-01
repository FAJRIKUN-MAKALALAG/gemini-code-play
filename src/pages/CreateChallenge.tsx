import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, ArrowLeft, Copy, Eye, CopyCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.unklab-aicode.online/api';

export default function CreateChallenge() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [expectedOutput, setExpectedOutput] = useState("");
  const [timeLimit, setTimeLimit] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }
    fetchChallenges();
  }, [user]);

  const fetchChallenges = async () => {
    try {
      setFetching(true);
      const res = await fetch(`${API_BASE_URL}/challenges/creator`, {
        credentials: "include"
      });
      if (res.ok) {
        const data = await res.json();
        setChallenges(data);
      }
    } catch (err) {
      console.error("Gagal load soal", err);
    } finally {
      setFetching(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) {
      toast({ title: "Validasi", description: "Judul dan Deskripsi wajib diisi.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/challenges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title,
          description,
          expected_output: expectedOutput,
          time_limit_minutes: timeLimit ? parseInt(timeLimit) : null
        })
      });

      if (res.ok) {
        toast({ title: "Berhasil", description: "Soal Ujian berhasil dibuat." });
        setTitle("");
        setDescription("");
        setExpectedOutput("");
        setTimeLimit("");
        fetchChallenges();
      } else {
        const err = await res.json();
        toast({ title: "Gagal", description: err.error || "Gagal membuat soal.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Kesalahan Jaringan", description: "Tidak dapat terhubung ke server.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(code);
    toast({ title: "Disalin", description: `Kode ${code} telah disalin ke clipboard.`, duration: 2000 });
    setTimeout(() => setCopiedId(null), 3000);
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 sm:p-10">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">Buat Soal Ujian</h1>
            <p className="text-muted-foreground text-sm">Buat tantangan koding untuk dikerjakan user lain.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Formulir Buat Soal */}
          <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-xl shadow-orange-500/5">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-orange-500"/> Form Soal Baru</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Judul Soal <span className="text-red-500">*</span></label>
                <Input 
                  placeholder="Misal: Mencari Bilangan Prima" 
                  value={title} onChange={e => setTitle(e.target.value)} 
                  className="bg-background/50"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Deskripsi / Perintah <span className="text-red-500">*</span></label>
                <textarea 
                  className="flex w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[120px]"
                  placeholder="Jelaskan apa yang harus dikerjakan oleh user..."
                  value={description} onChange={e => setDescription(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Ekspektasi Output (Opsional)</label>
                <textarea 
                  className="flex w-full font-mono rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed min-h-[80px]"
                  placeholder="Contoh: \nPrima pertama: 2\nPrima kedua: 3"
                  value={expectedOutput} onChange={e => setExpectedOutput(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Batas Waktu (Menit) - Opsional</label>
                <Input 
                  type="number" 
                  min="1"
                  placeholder="Kosongkan jika tidak ada batas" 
                  value={timeLimit} onChange={e => setTimeLimit(e.target.value)} 
                  className="bg-background/50"
                />
              </div>

              <Button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold h-11" disabled={loading}>
                {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> MENYIMPAN...</> : "SIMPAN SOAL"}
              </Button>
            </form>
          </div>

          {/* Daftar Soal yang Telah Dibuat */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">Soal Buatan Anda</h2>
            
            {fetching ? (
              <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
            ) : challenges.length === 0 ? (
              <div className="bg-card/50 border border-dashed border-border/60 rounded-xl p-10 text-center text-muted-foreground flex flex-col items-center">
                <FilePlus className="w-10 h-10 mb-3 opacity-20" />
                <p>Belum ada soal ujian yang dibuat.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                {challenges.map((c) => (
                  <div key={c.id} className="bg-card border border-border/50 rounded-xl p-4 shadow-sm hover:border-orange-500/30 transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-foreground line-clamp-1">{c.title}</h3>
                      <div 
                        className="bg-orange-500/10 text-orange-500 font-mono text-xs px-2 py-1 rounded-md font-bold cursor-pointer hover:bg-orange-500/20 flex items-center gap-1.5"
                        onClick={() => copyToClipboard(c.room_code)}
                        title="Klik untuk menyalin"
                      >
                        {c.room_code}
                        {copiedId === c.room_code ? <CopyCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{c.description}</p>
                    <div className="flex justify-between items-center text-[10px] text-muted-foreground border-t border-border/40 pt-2">
                      <span>Dibuat: {new Date(c.created_at).toLocaleDateString()}</span>
                      
                      <Link to={`/challenges/${c.id}/answers`}>
                        <Button variant="outline" size="sm" className="h-7 text-[10px]">
                          <Eye className="w-3 h-3 mr-1" /> LIHAT JAWABAN
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// Tambahkan Dummy Icon jika belum di import di lucide
const FilePlus = ({className}: {className?:string}) => <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>;
