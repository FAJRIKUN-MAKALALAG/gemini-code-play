import { API_BASE_URL } from "@/config";

export interface KuesionerAnswers {
  q1: number; q2: number; q3: number; q4: number; q5: number;
  q6: number; q7: number; q8: number; q9: number; q10: number;
}

export interface KuesionerSubmitPayload {
  nama: string;
  email: string;
  answers: KuesionerAnswers;
  pesan?: string;
}

export interface KuesionerResponse extends KuesionerSubmitPayload {
  id: string;
  total_skor: number;
  submitted_at: string;
}

export interface AdminKuesionerStats {
  jumlah_pertanyaan: number;
  jumlah_responden: number;
  total_skor_semua: number;
  skor_maksimum: number;
  persentase: number;
  per_pertanyaan: { q: number; ss: number; s: number; n: number; ts: number; sts: number; total: number }[];
  responses: KuesionerResponse[];
}

class KuesionerService {
  // ── Submit kuesioner (tanpa login, public) ──────────────────────────────────
  async submit(payload: KuesionerSubmitPayload): Promise<{ success: boolean; error: string | null }> {
    try {
      const response = await fetch(`${API_BASE_URL}/kuesioner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        return { success: false, error: data.error || "Gagal mengirim kuesioner." };
      }

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message || "Koneksi gagal." };
    }
  }

  // ── Cek status kuesioner aktif/nonaktif (public) ─────────────────────────
  async getStatus(): Promise<{ is_active: boolean; error: string | null }> {
    try {
      const response = await fetch(`${API_BASE_URL}/kuesioner/status?t=${new Date().getTime()}`);
      if (!response.ok) return { is_active: false, error: "Gagal cek status." };
      const data = await response.json();
      return { is_active: data.is_active ?? false, error: null };
    } catch {
      return { is_active: false, error: "Koneksi gagal." };
    }
  }

  // ── Toggle status ON/OFF (admin only) ──────────────────────────────────
  async toggleStatus(): Promise<{ is_active: boolean | null; error: string | null }> {
    try {
      const response = await fetch(`${API_BASE_URL}/kuesioner/admin/toggle`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        return { is_active: null, error: data.error || "Gagal mengubah status." };
      }
      const data = await response.json();
      return { is_active: data.is_active, error: null };
    } catch {
      return { is_active: null, error: "Koneksi gagal." };
    }
  }

  // ── Fetch semua data untuk admin (perlu cookie auth + role admin) ───────────
  async fetchAdminStats(): Promise<{ data: AdminKuesionerStats | null; error: string | null }> {
    try {
      const response = await fetch(`${API_BASE_URL}/kuesioner/admin/stats?t=${new Date().getTime()}`, {
        method: "GET",
        credentials: "include",
      });

      if (response.status === 401) {
        return { data: null, error: "Sesi tidak valid. Silakan login ulang." };
      }
      if (response.status === 403) {
        return { data: null, error: "Akses ditolak. Hanya admin yang dapat melihat halaman ini." };
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        return { data: null, error: data.error || "Gagal memuat data." };
      }

      const data: AdminKuesionerStats = await response.json();
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message || "Koneksi ke server gagal." };
    }
  }

  // ── Fetch semua responses individual (untuk tabel detail) ──────────────────
  async fetchAllResponses(): Promise<{ data: KuesionerResponse[] | null; error: string | null }> {
    try {
      const response = await fetch(`${API_BASE_URL}/kuesioner/admin/responses?t=${new Date().getTime()}`, {
        method: "GET",
        credentials: "include",
      });

      if (response.status === 401) return { data: null, error: "Sesi tidak valid." };
      if (response.status === 403) return { data: null, error: "Akses ditolak." };
      if (!response.ok) return { data: null, error: "Gagal memuat data responden." };

      const data: KuesionerResponse[] = await response.json();
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err.message || "Koneksi gagal." };
    }
  }
}

export const kuesionerService = new KuesionerService();
