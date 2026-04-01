import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, KeySquare } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.unklab-aicode.online/api';

export default function JoinChallenge() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [roomCode, setRoomCode] = useState("");
  const [studentName, setStudentName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/");
    }
  }, [user, navigate]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode || roomCode.length < 3) {
      toast({ title: "Validasi", description: "Masukkan kode ujian yang valid.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // 1. Cek Ujian Berdasarkan Kode
      const getRes = await fetch(`${API_BASE_URL}/challenges/room/${roomCode.toUpperCase()}`, {
        credentials: "include"
      });

      if (!getRes.ok) {
        toast({ title: "Gagal", description: "Soal / Ujian tidak ditemukan.", variant: "destructive" });
        setLoading(false);
        return;
      }

      const challenge = await getRes.json();
      
      // 2. Join (ini juga akan membuat record jawaban baru atau melanjutkan jika in_progress)
      const joinRes = await fetch(`${API_BASE_URL}/challenges/${challenge.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_name: studentName }),
        credentials: "include"
      });

      if (joinRes.ok) {
        toast({ title: "Berhasil!", description: "Membuka halaman evaluasi...", duration: 2000 });
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

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-foreground">
      
      {/* Tombol Kembali (Absolute for clean UI) */}
      <div className="absolute top-6 left-6">
        <Link to="/">
          <Button variant="ghost" className="rounded-full gap-2 pl-2">
            <ArrowLeft className="w-5 h-5 mb-0.5" /> Beranda
          </Button>
        </Link>
      </div>

      <div className="w-full max-w-md bg-card border border-border/50 rounded-3xl p-8 shadow-2xl flex flex-col items-center">
        
        <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20">
          <KeySquare className="w-8 h-8 text-blue-500" />
        </div>
        
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent mb-2">
          Ruang Ujian Praktikum
        </h1>
        <p className="text-muted-foreground text-sm text-center mb-8 px-4">
          Masukkan kode 6 digit yang diberikan oleh dosen / asisten lab untuk memulai kerjakan koding.
        </p>

        <form onSubmit={handleJoin} className="w-full space-y-6">
          <div className="space-y-4">
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
          </div>

          <Button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 rounded-xl text-md" 
            disabled={loading}
          >
            {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> MENGHUBUNGKAN...</> : "MASUK KE RUANG UJIAN"}
          </Button>
        </form>

        <div className="mt-8 text-xs text-center text-muted-foreground bg-amber-500/5 p-4 rounded-xl border border-amber-500/10">
          <strong className="text-amber-500 block mb-1">Peringatan Anti-Curang:</strong>
          Sistem ini diawasi! Anda <b>tidak bisa keluar atau berpindah aplikasi/tab</b> saat mengerjakan tugas ini. Pelanggaran mengakibatkan diskualifikasi otomatis.
        </div>
      </div>
    </div>
  );
}
