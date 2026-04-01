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
import { HelpCircle } from "lucide-react";

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
            <HelpCircle className="w-6 h-6 text-primary" />
            Pusat Bantuan & FAQ
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Jawaban untuk kendala umum yang sering ditemukan saat menggunakan aplikasi ini.
          </DialogDescription>
        </DialogHeader>

        <Accordion type="single" collapsible className="w-full mt-4 space-y-2">
          <AccordionItem value="item-1" className="border border-border/50 rounded-lg px-4 bg-muted/20">
            <AccordionTrigger className="text-left font-semibold hover:no-underline hover:text-primary transition-colors py-4">
              🔑 Bagaimana cara mendapatkan API Key Gemini?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed text-sm">
              <ol className="list-decimal pl-5 space-y-1">
                <li>Buka <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-primary hover:underline">Google AI Studio</a>.</li>
                <li>Login menggunakan akun Google-mu.</li>
                <li>Klik tombol biru <strong>Create API Key</strong>.</li>
                <li>Copy API Key tersebut, lalu salin dan simpan di menu <strong>Gemini API Key</strong> pada aplikasi ini.</li>
              </ol>
              <p className="mt-3 text-xs italic opacity-80">*API Key yang kita gunakan adalah versi Free Tier (gratis 100%).</p>
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="item-2" className="border border-border/50 rounded-lg px-4 bg-muted/20">
            <AccordionTrigger className="text-left font-semibold hover:no-underline hover:text-primary transition-colors py-4">
              ⏳ Bagaimana kalau chat error "Too Many Requests" atau kuota habis?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed text-sm">
              API gratis Google memberikan jatah maksimal <strong>15 pesan per menit</strong>. 
              Jika kamu terlalu asyik mengobrol dan menekan kirim berturut-turut tanpa jeda, AI akan membatasi sesaat.<br/><br/>
              💡 <strong>Solusi:</strong> Jangan panik! Cukup istirahat <strong>1-2 menit</strong> tanpa klik kirim. Kuota per menit-mu akan ter-reset otomatis dan kamu bisa kembali menggunakan AI seperti biasa.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-3" className="border border-border/50 rounded-lg px-4 bg-muted/20">
            <AccordionTrigger className="text-left font-semibold hover:no-underline hover:text-primary transition-colors py-4">
              🔄 Perlu ganti API Key tidak kalau kena limit?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed text-sm">
              <strong>TIDAK PERLU.</strong><br/>
              Limit <em>Too Many Requests</em> (Error 429) itu hanyalah batas harian atau menit-an wajar dari Google. Selama kamu memberinya jeda sebentar, kuncimu yang asli masih bisa digunakan sampai kapanpun. Hanya ganti kunci jika kamu memang menghapusnya dari dashboard Google AI Studio.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-4" className="border border-border/50 rounded-lg px-4 bg-muted/20">
            <AccordionTrigger className="text-left font-semibold hover:no-underline hover:text-primary transition-colors py-4">
              🤖 Mengapa AI menjawab asal-asalan / tidak nyambung dengan kodingan saya?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed text-sm">
              AI sebenarnya <strong>secara otomatis membaca seluruh kode yang ada di Editor kodemu</strong> lho. 
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Pastikan kamu sudah mengetik kode yang relevan di editor sebelum bertanya.</li>
                <li>Jika layar editormu kosong, AI akan kesulitan karena tidak punya konteks.</li>
                <li>Cobalah bertanya lebih spesifik, seperti: <em>"Kenapa fungsi hitung() ini error terus?"</em></li>
              </ul>
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="item-5" className="border border-border/50 rounded-lg px-4 bg-muted/20">
            <AccordionTrigger className="text-left font-semibold hover:no-underline hover:text-primary transition-colors py-4">
              🚫 Chat AI terus muter-muter tanpa balasan (Nyangkut Tanda Loading)?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed text-sm">
              Hal ini wajar terjadi jika koneksi internet terputus di tengah jalan, atau ada kendala koneksi ke server Google. <br/><br/>
              💡 <strong>Solusi:</strong> 
              <ol className="list-decimal pl-5 mt-2">
                <li>Klik tombol bulat berbentuk silang <strong>( X )</strong> di sebelah kanan teks input chat untuk 'Force Stop'.</li>
                <li>Coba refresh browser (Tekan F5).</li>
                <li>Ketik ulang pertanyaanmu.</li>
              </ol>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </DialogContent>
    </Dialog>
  );
};
