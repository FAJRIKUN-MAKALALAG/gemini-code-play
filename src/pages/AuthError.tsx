import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AuthError() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const error = searchParams.get('error') || 'Authentication Error';
  const description = searchParams.get('error_description') || 'Terjadi kesalahan saat proses autentikasi. Silakan coba lagi.';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-destructive/10 rounded-full blur-[100px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[100px] animate-pulse pointer-events-none" />

      <div className="relative z-10 w-full max-w-md bg-card/50 backdrop-blur-xl border border-border/50 shadow-2xl rounded-2xl p-8 text-center">
        <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6 transform transition-transform hover:scale-110 duration-500">
          <AlertTriangle className="w-8 h-8 text-destructive" />
        </div>
        
        <h2 className="text-2xl font-bold text-foreground mb-3">{error === 'access_denied' ? 'Akses Ditolak' : 'Autentikasi Gagal'}</h2>
        <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
          {description}
        </p>

        <div className="space-y-3">
          <Button 
            className="w-full font-semibold bg-primary hover:bg-primary/90"
            onClick={() => navigate('/', { replace: true })}
          >
            <Home className="w-4 h-4 mr-2" />
            Kembali ke Beranda
          </Button>
          <p className="text-xs text-muted-foreground">
            Jika masalah berlanjut, silakan hubungi dukungan.
          </p>
        </div>
      </div>
    </div>
  );
}
