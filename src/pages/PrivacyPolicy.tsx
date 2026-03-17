import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background text-foreground py-20 px-4 sm:px-6 lg:px-8">
      <Helmet>
        <title>Kebijakan Privasi | AICODE UNKLAB</title>
        <meta name="description" content="Kebijakan Privasi untuk layanan AICODE UNKLAB" />
      </Helmet>

      <div className="max-w-3xl mx-auto prose prose-invert">
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600 mb-8">
          Kebijakan Privasi
        </h1>
        
        <p className="text-muted-foreground mb-8">Terakhir Diperbarui: 18 Maret 2026</p>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">1. Informasi yang Kami Kumpulkan</h2>
          <p>
            Kami mengumpulkan informasi yang Anda berikan secara langsung kepada kami, seperti saat Anda membuat akun, memperbarui profil Anda, menggunakan fitur interaktif layanan kami, berpartisipasi dalam kontes atau promosi, meminta dukungan pelanggan, atau berkomunikasi dengan kami.
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-4 text-muted-foreground">
            <li><strong>Akun Google:</strong> Jika Anda mendaftar atau login menggunakan Google OAuth, kami mengumpulkan informasi profil dasar Anda (nama, alamat email, dan foto profil) yang diizinkan oleh Google.</li>
            <li><strong>Data Penggunaan:</strong> Kami mengumpulkan informasi tentang bagaimana Anda mengakses dan menggunakan Layanan, termasuk log chat dan interaksi AI, snippet kode yang Anda simpan, dan metrik kinerja.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">2. Bagaimana Kami Menggunakan Informasi Anda</h2>
          <p>Kami menggunakan informasi yang kami kumpulkan untuk berbagai tujuan, termasuk untuk:</p>
          <ul className="list-disc pl-6 space-y-2 mt-4 text-muted-foreground">
            <li>Menyediakan, memelihara, dan meningkatkan Layanan kami.</li>
            <li>Memproses dan menyelesaikan transaksi, serta mengirimkan informasi terkait.</li>
            <li>Memverifikasi identitas Anda untuk mencegah akses tidak sah.</li>
            <li>Merespons pertanyaan, permintaan, dan komentar dukungan Anda.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">3. Keamanan Data</h2>
          <p>
            Kami menerapkan berbagai langkah pengamanan teknis dan organisasi yang wajar untuk membantu melindungi informasi pribadi dari akses, penggunaan, atau pengungkapan yang tidak sah. Kredensial penting seperti API Key (misalnya Gemini API Key) akan dienkripsi sebelum disimpan di database kami.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">4. Perubahan Pada Kebijakan Privasi Ini</h2>
          <p>
            Kami dapat memperbarui kebijakan privasi ini dari waktu ke waktu. Kami akan memberi tahu Anda tentang setiap perubahan dengan memposting kebijakan privasi yang baru di halaman ini.
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
