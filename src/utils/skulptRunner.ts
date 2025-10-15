// Deklarasi global untuk TypeScript
declare global {
  interface Window {
    // Skulpt mengekspor objek utama sebagai `Sk`
    Sk: any;
  }
}

// Fungsi untuk memuat Skulpt secara dinamis dari CDN
export const loadSkulpt = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.Sk) {
      console.log("Skulpt already loaded");
      resolve();
      return;
    }

    console.log("Loading Skulpt...");

    const CORE_SRCS = [
      "https://cdn.jsdelivr.net/npm/skulpt@1.2.0/dist/skulpt.min.js",
      "https://unpkg.com/skulpt@1.2.0/dist/skulpt.min.js",
      "/skulpt.min.js",
    ];
    const STDLIB_SRCS = [
      "https://cdn.jsdelivr.net/npm/skulpt@1.2.0/dist/skulpt-stdlib.js",
      "https://unpkg.com/skulpt@1.2.0/dist/skulpt-stdlib.js",
      "/skulpt-stdlib.js",
    ];

    const TIMEOUT_MS = 15000;
    let settled = false;
    const finish = (ok: boolean, err?: any) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      ok ? resolve() : reject(err || new Error("Failed to load Skulpt"));
    };
    const timer = window.setTimeout(() => {
      console.error("Timed out loading Skulpt");
      finish(false, new Error("Timed out loading Skulpt"));
    }, TIMEOUT_MS);

    const tryLoad = (urls: string[], onLoaded: () => void) => {
      let i = 0;
      const next = () => {
        if (i >= urls.length) {
          onLoaded();
          return;
        }
        const url = urls[i++];
        const s = document.createElement("script");
        s.async = true;
        s.src = url;
        s.crossOrigin = "anonymous";
        s.onload = () => {
          s.remove();
          onLoaded();
        };
        s.onerror = () => {
          console.warn("Failed loading", url, "— trying next");
          s.remove();
          next();
        };
        document.head.appendChild(s);
      };
      next();
    };

    // Load core → then stdlib
    tryLoad(CORE_SRCS, () => {
      if (!window.Sk) {
        // If core not attached after trying all URLs
        finish(false, new Error("Skulpt core not available"));
        return;
      }
      console.log("Skulpt core loaded");
      tryLoad(STDLIB_SRCS, () => {
        if (!window.Sk || !window.Sk.builtinFiles) {
          finish(false, new Error("Skulpt stdlib not available"));
          return;
        }
        console.log("Skulpt stdlib loaded");
        finish(true);
      });
    });
  });
};

// Fungsi untuk menjalankan kode Python di browser
export const runPythonCode = async (
  code: string,
  opts?: {
    inputProvider?: (prompt?: string) => Promise<string>;
    onStdout?: (text: string) => void;
    onStderr?: (text: string) => void;
  }
): Promise<string[]> => {
  return new Promise((resolve) => {
    if (!window.Sk) {
      resolve(["Error: Skulpt is not loaded. Please refresh the page."]);
      return;
    }

    const output: string[] = [];

    // Konfigurasi Skulpt
    window.Sk.configure({
      output: (text: string) => {
        output.push(text);
        if (opts?.onStdout) opts.onStdout(text);
      },
      read: (filename: string) => {
        if (
          window.Sk.builtinFiles === undefined ||
          window.Sk.builtinFiles["files"][filename] === undefined
        ) {
          throw new Error(`File not found: ${filename}`);
        }
        return window.Sk.builtinFiles["files"][filename];
      },
      execLimit: 10000, // batas waktu eksekusi (opsional)
      inputfun: async (prompt?: string) => {
        if (opts?.inputProvider) {
          try {
            const val = await opts.inputProvider(prompt);
            return val;
          } catch (e) {
            throw e;
          }
        }
        // Fallback ke prompt browser jika tidak ada provider
        const val = window.prompt(prompt || "Input:") || "";
        return val;
      },
      inputfunTakesPrompt: true,
    });

    // Jalankan kode Python secara asynchronous
    window.Sk.misceval
      .asyncToPromise(() =>
        window.Sk.importMainWithBody("<stdin>", false, code, true)
      )
      .then(() => {
        resolve(output);
      })
      .catch((err: any) => {
        const msg = `Error: ${err.toString()}`;
        if (opts?.onStderr) opts.onStderr(msg);
        resolve([msg]);
      });
  });
};
