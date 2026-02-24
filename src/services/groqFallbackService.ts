/**
 * groqFallbackService.ts
 *
 * Fallback AI service menggunakan Groq (moonshotai/kimi-k2-instruct-0905).
 * Dipanggil otomatis dari ChatInterface ketika Gemini tidak merespons
 * dalam 30 detik — untuk menghindari user menunggu terlalu lama
 * dan agar token Gemini user tidak terbuang sia-sia.
 *
 * Flow:
 *   1. ChatInterface détects Gemini timeout (30s)
 *   2. ChatInterface aborts Gemini stream (stop konsumsi token Gemini)
 *   3. ChatInterface calls streamGroqFallback()
 *   4. This service calls POST /api/chat/groq-fallback (backend)
 *   5. Backend uses GROQ_API_KEY (server-side) — tidak pakai token user
 *   6. SSE stream diteruskan ke ChatInterface via onChunk callback
 */

import { authService } from "./authService";
import { API_BASE_URL } from "@/config";

export interface FallbackMessage {
    role: "user" | "assistant";
    content: string;
}

/**
 * Stream response dari Groq via backend endpoint.
 * Backend expects: POST /api/chat/groq-fallback
 * Body: { messages: FallbackMessage[] }
 * Response: SSE stream dengan format: data: {"text":"..."}\n\n  |  data: [DONE]\n\n
 *
 * @param messages  Full conversation history (termasuk user message terakhir)
 * @param onChunk   Callback dipanggil untuk setiap text chunk yang diterima
 * @param signal    AbortSignal untuk membatalkan request (user cancel)
 * @returns         Full accumulated text dari Groq
 */
export async function streamGroqFallback(
    messages: FallbackMessage[],
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/chat/groq-fallback`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...authService.getAuthHeaders(),
        },
        body: JSON.stringify({ messages }),
        signal,
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
            errData.error || `Groq fallback gagal: ${response.status} ${response.statusText}`
        );
    }

    if (!response.body) {
        throw new Error("Response body kosong dari Groq fallback.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";

    try {
        while (true) {
            if (signal?.aborted) break;

            const { done, value } = await reader.read();
            if (done) break;

            // Decode chunk dan tambahkan ke buffer
            buffer += decoder.decode(value, { stream: true });

            // Parse baris SSE — pisahkan per newline, simpan baris tidak lengkap
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? ""; // baris terakhir mungkin belum lengkap

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith("data:")) continue;

                const data = trimmed.slice(5).trim();
                if (data === "[DONE]") return fullText;

                try {
                    const parsed = JSON.parse(data) as { text?: string; error?: string };
                    // Backend kirim error chunk → lempar agar ChatInterface handle
                    if (parsed.error) {
                        throw new Error(parsed.error);
                    }
                    const text = parsed.text ?? "";
                    if (text) {
                        fullText += text;
                        onChunk(text);
                    }
                } catch (parseErr) {
                    // Re-throw error eksplisit, abaikan JSON parse error biasa
                    if (parseErr instanceof Error && parseErr.message !== "Unexpected token") {
                        throw parseErr;
                    }
                }
            }
        }
    } finally {
        reader.releaseLock();
    }

    return fullText;
}
