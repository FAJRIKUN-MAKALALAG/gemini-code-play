import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { LifeBuoy, Key, Timer, RotateCcw, Cpu, AlertTriangle, Hourglass, WifiOff } from "lucide-react";

interface FAQModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const FAQModal = ({ open, onOpenChange }: FAQModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] bg-popover border-border/50 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <LifeBuoy className="w-6 h-6 text-primary" />
            Pusat Bantuan & FAQ
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Jawaban untuk kendala umum yang sering ditemukan saat menggunakan aplikasi ini.
          </DialogDescription>
        </DialogHeader>

        <Accordion type="single" collapsible className="w-full mt-4 space-y-3">
          <AccordionItem value="item-1" className="border border-border/50 rounded-xl px-4 bg-muted/20 hover:bg-muted/30 transition-all duration-200">
            <AccordionTrigger className="text-left font-semibold hover:no-underline hover:text-primary transition-colors py-4">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-lg">
                  <Key className="w-4 h-4 text-primary" />
                </div>
                <span>Bagaimana cara mendapatkan API Key Gemini?</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed text-sm pt-2 pb-5 pl-11">
              <ol className="list-decimal space-y-2">
                <li>Buka <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-primary hover:underline font-medium">Google AI Studio</a>.</li>
                <li>Login menggunakan akun Google-mu.</li>
                <li>Klik tombol biru <strong>Create API Key</strong>.</li>
                <li>Salin API Key tersebut, lalu simpan di menu <strong>Gemini API Key</strong> pada aplikasi ini.</li>
              </ol>
              <div className="mt-4 p-2.5 rounded-lg bg-primary/5 border border-primary/10 text-[11px] italic opacity-80">
                *API Key yang kita gunakan adalah versi Free Tier (gratis 100%).
              </div>
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="item-2" className="border border-border/50 rounded-xl px-4 bg-muted/20 hover:bg-muted/30 transition-all duration-200">
            <AccordionTrigger className="text-left font-semibold hover:no-underline hover:text-primary transition-colors py-4">
              <div className="flex items-center gap-3">
                <div className="bg-amber-500/10 p-2 rounded-lg">
                  <Timer className="w-4 h-4 text-amber-500" />
                </div>
                <span>Chat error "Too Many Requests" atau kuota habis?</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed text-sm pt-2 pb-5 pl-11">
              API gratis Google memberikan jatah maksimal <strong>15 pesan per menit</strong>. 
              Jika kamu terlalu asyik mengobrol, AI akan membatasi akses setiap menitnya.<br/><br/>
              <div className="flex items-start gap-2 text-foreground font-medium bg-amber-500/5 p-3 rounded-lg border border-amber-500/10">
                <span className="text-lg">💡</span>
                <span><strong>Solusi:</strong> Cukup istirahat <strong>1-2 menit</strong> tanpa mengirim pesan. Kuota akan ter-reset otomatis.</span>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-3" className="border border-border/50 rounded-xl px-4 bg-muted/20 hover:bg-muted/30 transition-all duration-200">
            <AccordionTrigger className="text-left font-semibold hover:no-underline hover:text-primary transition-colors py-4">
              <div className="flex items-center gap-3">
                <div className="bg-blue-500/10 p-2 rounded-lg">
                  <RotateCcw className="w-4 h-4 text-blue-500" />
                </div>
                <span>Perlu ganti API Key jika terkena limit?</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed text-sm pt-2 pb-5 pl-11">
              <strong>TIDAK PERLU.</strong><br/>
              Limit <em>Too Many Requests</em> adalah batas wajar. Cukup beri jeda sebentar, API Key kamu tetap valid. Ganti hanya jika kamu menghapusnya di Google AI Studio.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-4" className="border border-border/50 rounded-xl px-4 bg-muted/20 hover:bg-muted/30 transition-all duration-200">
            <AccordionTrigger className="text-left font-semibold hover:no-underline hover:text-primary transition-colors py-4">
              <div className="flex items-center gap-3">
                <div className="bg-purple-500/10 p-2 rounded-lg">
                  <Cpu className="w-4 h-4 text-purple-500" />
                </div>
                <span>Mengapa balasan AI tidak sesuai kode saya?</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed text-sm pt-2 pb-5 pl-11">
              AI secara otomatis membaca seluruh kode di Editor Anda saat ini.<br/>
              <ul className="list-disc mt-3 space-y-2">
                <li>Pastikan sudah ada kode di editor sebelum bertanya.</li>
                <li>Tanpa kode, AI tidak memiliki konteks teknis.</li>
                <li>Tanyakan pertanyaan spesifik (misal: "Kenapa baris 5 saya error?").</li>
              </ul>
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="item-5" className="border border-border/50 rounded-xl px-4 bg-muted/20 hover:bg-muted/30 transition-all duration-200">
            <AccordionTrigger className="text-left font-semibold hover:no-underline hover:text-primary transition-colors py-4">
              <div className="flex items-center gap-3">
                <div className="bg-red-500/10 p-2 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                </div>
                <span>Chat AI terus memproses (Nyangkut Tanda Loading)?</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed text-sm pt-2 pb-5 pl-11">
              Biasanya terjadi karena koneksi terputus atau gangguan server pihak ketiga.<br/><br/>
              <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-3 space-y-2">
                <p className="font-bold text-foreground">Langkah Solusi:</p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>Klik tombol silang <strong>( X )</strong> di input chat untuk menghentikan paksa.</li>
                  <li>Segarkan halaman browser (Refresh).</li>
                  <li>Kirim ulang pertanyaan Anda.</li>
                </ol>
              </div>
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="item-6" className="border border-border/50 rounded-xl px-4 bg-muted/20 hover:bg-muted/30 transition-all duration-200">
            <AccordionTrigger className="text-left font-semibold hover:no-underline hover:text-primary transition-colors py-4">
              <div className="flex items-center gap-3">
                <div className="bg-orange-500/10 p-2 rounded-lg">
                  <Hourglass className="w-4 h-4 text-orange-500" />
                </div>
                <span>Error: Waktu Proses Habis (Timeout)?</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed text-sm pt-2 pb-5 pl-11">
              Error ini muncul jika AI berpikir lebih dari 30 detik tanpa henti. AI memiliki batas waktu maksimal dalam menyusun jawaban agar browser tidak macet atau kehabisan memori.<br/><br/>
              <ul className="list-disc mt-2 space-y-2">
                <li><strong>Kenapa terjadi?</strong> Biasanya karena file kode yang kamu tanyakan terlalu rumit, panjang, atau kamu meminta AI untuk membuat terlalu banyak logic sekaligus.</li>
                <li><strong>Solusi Utama:</strong> Coba spesifikkan masalah. Hindari meminta "Tolong buatkan website penuh," alih-alih, tanyakan "Bantu saya buat tombol login," dan seterusnya untuk mengurangi beban AI.</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-7" className="border border-border/50 rounded-xl px-4 bg-muted/20 hover:bg-muted/30 transition-all duration-200">
            <AccordionTrigger className="text-left font-semibold hover:no-underline hover:text-primary transition-colors py-4">
              <div className="flex items-center gap-3">
                <div className="bg-red-500/10 p-2 rounded-lg">
                  <WifiOff className="w-4 h-4 text-red-500" />
                </div>
                <span>Error: Koneksi Internet Terputus?</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed text-sm pt-2 pb-5 pl-11">
              Aplikasi pendamping *coding* ini berjalan langsung di browser, dan berinteraksi dengan API Google secara langsung menggunakan koneksi jaringn komputer/HP kamu.<br/><br/>
              <ul className="list-disc mt-2 space-y-2">
                <li><strong>Kenapa terjadi?</strong> Jaringan Wi-Fi/data kamu sempat putus tiba-tiba atau tidak stabil. Terkadang ini juga diblokir oleh VPN/Firewall.</li>
                <li><strong>Solusi Utama:</strong> Matikan dan nyalakan ulang koneksimu, matikan VPN (jika menggunakannya), lalu klik kirim ulang pada jawabanmu.</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

        </Accordion>
      </DialogContent>
    </Dialog>
  );
};
