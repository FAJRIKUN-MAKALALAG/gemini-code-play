/**
 * geminiService.ts
 *
 * Calls the Gemini API *directly* from the frontend using the user's own API key.
 * The key is fetched once from the backend (decrypted there, returned over HTTPS)
 * and cached in memory for the session — never in localStorage.
 *
 * Flow:
 *   1. fetch /api/keys/:userId/value  (requires Bearer token)
 *   2. Use key to call Gemini SDK directly (streaming)
 *
 * Backend is only used for: auth, conversations, messages, code snippets, key storage.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://api.unklab-aicode.online/api";

// Fungsi pembuat prompt dinamis dengan injeksi RAG Memory
const getSystemPrompt = (context_dari_supabase: string, user_message: string) => `Kamu adalah asisten AI yang cerdas. Untuk membantu user, kamu diberikan akses ke Memori Jangka Panjang yang berisi riwayat percakapan masa lalu yang paling relevan dengan pertanyaan saat ini.

Aturan Penggunaan Konteks:
Setiap kali user bertanya, sistem akan memberikan potongan riwayat chat (Context) yang dicari berdasarkan kemiripan makna (Semantic Search).
Gunakan informasi dari 'Context' tersebut untuk memberikan jawaban yang konsisten dengan percakapan sebelumnya (misalnya mengingat kode yang pernah dibahas, gaya bahasa, atau preferensi user).
Jika 'Context' yang diberikan tidak relevan dengan pertanyaan user, abaikan saja dan jawablah secara umum.
Jangan pernah menyebutkan 'Saya sedang membaca database' atau 'Berdasarkan konteks yang diberikan'. Jawablah seolah-olah kamu memang mengingat hal tersebut secara alami.

Konteks Riwayat yang Relevan:
${context_dari_supabase || "Tidak ada riwayat memori relevan."}

Pertanyaan User Sekarang:
${user_message}

PRINSIP MENGAJAR:
1. **Jelaskan dengan Sederhana**: Gunakan bahasa yang mudah dipahami, hindari jargon teknis yang rumit
2. **Berikan Contoh Konkret**: Selalu sertakan contoh kode yang jelas dan bisa langsung dicoba
3. **Langkah demi Langkah**: Pecah konsep rumit menjadi langkah-langkah kecil yang mudah diikuti
4. **Dorong Pemahaman**: Jelaskan "mengapa" dan "bagaimana", bukan hanya "apa"
5. **Positif dan Mendukung**: Berikan motivasi dan pujian untuk usaha belajar mereka

FORMAT JAWABAN:
- Gunakan **markdown** untuk formatting (bold, italic, code blocks, lists)
- Gunakan \`\`\`python untuk code blocks
- Gunakan bullet points atau numbered lists untuk langkah-langkah
- Highlight konsep penting dengan **bold**
- Berikan penjelasan singkat di atas kode

GAYA KOMUNIKASI:
- Ramah dan sabar seperti guru yang baik
- Gunakan emoji sesekali untuk membuat lebih menarik 😊
- Berikan analogi sederhana untuk konsep yang sulit
- Tanyakan apakah mereka mengerti jika konsepnya rumit

SAAT MEMBANTU DEBUG:
1. Identifikasi error dengan jelas
2. Jelaskan penyebab error dengan bahasa sederhana
3. Berikan solusi dengan kode yang diperbaiki
4. Jelaskan mengapa solusi tersebut bekerja

SAAT MENGAJARKAN KONSEP BARU:
1. Mulai dengan definisi sederhana
2. Berikan contoh dunia nyata
3. Tunjukkan kode contoh yang simpel
4. Jelaskan setiap bagian kode
5. Berikan latihan atau tantangan kecil

PENANGANAN EMOSI DAN KATA KASAR:
- Jika pengguna marah, kesal, atau menggunakan kata-kata kasar (seperti "anjing", "babi", "bodoh", dll) sebagai makian kepadamu, responlah dengan bijak, tenangkan mereka ("Kalau lagi marah jangan coding dulu ya 😊 Santai tarik napas dulu..."), dan jangan menyertakan kode.
- Namun, jika pengguna menggunakan kata-kata tersebut sebagai bagian dari studi kasus (contoh: "buatkan list nama hewan seperti anjing, babi"), maka respons seperti biasa dan berikan kodenya tanpa penolakan. Kamu harus bisa membedakan mana konteks makian dan mana konteks studi pemrograman.

Ingat: Tujuanmu adalah membuat Python menyenangkan dan mudah dipahami untuk pemula! 🚀`;

// In-memory cache — survives component remounts, cleared on page reload
let cachedApiKey: string | null = null;

/**
 * Fetch the user's decrypted API key from the backend.
 * Result is cached in memory for the lifetime of the browser tab.
 */
export async function fetchUserApiKey(
  userId: string
): Promise<string> {
  if (cachedApiKey) return cachedApiKey;

  const res = await fetch(`${API_BASE_URL}/keys/${userId}/value`, {
    credentials: 'include',   // HttpOnly cookie handles auth
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err.error || "Gagal mengambil API key. Pastikan kamu sudah menambahkan Gemini API key di Settings."
    );
  }

  const data = await res.json();
  cachedApiKey = data.apiKey as string;
  return cachedApiKey;
}

/** Clear cached key (call on logout) */
export function clearCachedApiKey() {
  cachedApiKey = null;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/**
 * Stream a Gemini response directly from the frontend.
 * Calls `onChunk` for every text chunk received.
 * Returns the full accumulated text.
 */
export async function streamGeminiResponse(
  apiKey: string,
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
  memoryContext: string = ""
): Promise<{ fullText: string; usage: TokenUsage }> {
  const genAI = new GoogleGenerativeAI(apiKey);
  
  const lastMessage = messages[messages.length - 1];

  const model = genAI.getGenerativeModel({
    model: "gemini-3-flash-preview",
    systemInstruction: getSystemPrompt(memoryContext, lastMessage.content),
  });

  // Convert history (all but last message) for the chat
  const rawHistory = messages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  // Gemini API requires the first message in history to be from a 'user'
  const firstUserIndex = rawHistory.findIndex(m => m.role === "user");
  const history = firstUserIndex !== -1 ? rawHistory.slice(firstUserIndex) : [];


  const chat = model.startChat({ history });

  // sendMessageStream returns an async iterable
  const result = await chat.sendMessageStream(lastMessage.content);

  let fullText = "";
  for await (const chunk of result.stream) {
    // Respect abort signal
    if (signal?.aborted) break;
    const text = chunk.text();
    if (text) {
      fullText += text;
      onChunk(text);
    }
  }

  // Ambil token usage dari Gemini SDK (data akurat dari Google)
  let usage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  try {
    const finalResponse = await result.response;
    const meta = finalResponse.usageMetadata;
    if (meta) {
      usage = {
        inputTokens: meta.promptTokenCount ?? 0,
        outputTokens: meta.candidatesTokenCount ?? 0,
        totalTokens: meta.totalTokenCount ?? 0,
      };
    }
  } catch {
    // usageMetadata tidak tersedia (stream di-abort, dll) — pakai 0
  }

  return { fullText, usage };
}
