import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-background text-foreground py-20 px-4 sm:px-6 lg:px-8">
      <Helmet>
        <title>Syarat & Ketentuan Layanan | aicode-unklab</title>
        <meta name="description" content="Syarat dan Ketentuan Layanan untuk aicode-unklab" />
      </Helmet>

      <div className="max-w-3xl mx-auto prose prose-invert">
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600 mb-8">
          Syarat dan Ketentuan Layanan
        </h1>
        
        <p className="text-muted-foreground mb-8">Terakhir Diperbarui: 18 Maret 2026</p>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">1. Penerimaan Syarat</h2>
          <p>
            Dengan mengakses dan menggunakan aicode-unklab ("Layanan"), Anda menerima dan menyetujui untuk terikat oleh syarat dan ketentuan perjanjian ini. Jika Anda tidak menyetujui syarat-syarat ini, harap jangan gunakan Layanan.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">2. Akun Pengguna</h2>
          <p>
            Untuk menggunakan fitur tertentu dari Layanan, Anda mungkin diharuskan untuk mendaftarkan akun.
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-4 text-muted-foreground">
            <li>Anda bertanggung jawab menjaga kerahasiaan kata sandi/kredensial akun Anda.</li>
            <li>Anda setuju untuk tidak membagikan kunci API pihak ketiga (seperti Gemini API) Anda secara publik di luar platform jika tidak diperlukan.</li>
            <li>Kami berhak menangguhkan atau menghentikan akun Anda jika ada aktivitas yang melanggar ketentuan operasi perangkat lunak atau keamanan.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">3. Penggunaan yang Diperbolehkan</h2>
          <p>
            Layanan ini ditujukan untuk tujuan edukasi dan pengembangan perangkat lunak (khususnya membantu pengguna menganalisis kode atau mencari bug via AI). Pengguna setuju untuk tidak menggunakan layanan ini untuk tujuan peretasan, pengiriman spam, atau aktivitas ilegal lainnya.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">4. Batasan Tanggung Jawab</h2>
          <p>
            Dalam keadaan apa pun, AICODE UNKLAB tidak bertanggung jawab atas kerugian langsung, tidak langsung, insidental, atau konsekuensial yang timbul karena penggunaan atau ketidakmampuan untuk menggunakan layanan ini. Modifikasi kode yang disarankan oleh AI dalam sistem ini sepenuhnya adalah tanggung jawab pengguna untuk memverifikasi kebenarannya sebelum digunakan pada tahap produksi.
          </p>
        </section>

        <div className="mt-12 pt-8 border-t border-border">
          <Link to="/" className="text-primary hover:underline font-medium">
            &larr; Kembali ke Beranda
          </Link>
        </div>
      </div>
    </div>
  );
}
