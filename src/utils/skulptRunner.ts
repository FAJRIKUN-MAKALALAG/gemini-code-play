declare global {
  interface Window {
    Skulpt: any;
  }
}

export const loadSkulpt = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.Skulpt) {
      console.log("Skulpt already loaded");
      resolve();
      return;
    }

    console.log("Loading Skulpt...");
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/skulpt@1.2.0/dist/skulpt.min.js";
    script.onload = () => {
      console.log("Skulpt core loaded");
      const scriptStdlib = document.createElement("script");
      scriptStdlib.src = "https://cdn.jsdelivr.net/npm/skulpt@1.2.0/dist/skulpt-stdlib.js";
      scriptStdlib.onload = () => {
        console.log("Skulpt stdlib loaded");
        resolve();
      };
      scriptStdlib.onerror = (error) => {
        console.error("Failed to load Skulpt stdlib:", error);
        reject(new Error("Failed to load Skulpt stdlib"));
      };
      document.head.appendChild(scriptStdlib);
    };
    script.onerror = (error) => {
      console.error("Failed to load Skulpt core:", error);
      reject(new Error("Failed to load Skulpt"));
    };
    document.head.appendChild(script);
  });
};

export const runPythonCode = (code: string): Promise<string[]> => {
  return new Promise((resolve) => {
    if (!window.Skulpt) {
      resolve(["Error: Skulpt is not loaded. Please refresh the page."]);
      return;
    }

    const output: string[] = [];

    window.Skulpt.configure({
      output: (text: string) => {
        output.push(text);
      },
      read: (filename: string) => {
        if (
          window.Skulpt.builtinFiles === undefined ||
          window.Skulpt.builtinFiles["files"][filename] === undefined
        ) {
          throw new Error(`File not found: ${filename}`);
        }
        return window.Skulpt.builtinFiles["files"][filename];
      },
    });

    window.Skulpt.misceval
      .asyncToPromise(() => window.Skulpt.importMainWithBody("<stdin>", false, code, true))
      .then(() => {
        resolve(output);
      })
      .catch((err: any) => {
        output.push(`Error: ${err.toString()}`);
        resolve(output);
      });
  });
};
