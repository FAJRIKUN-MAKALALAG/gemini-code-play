declare const Skulpt: any;

export const loadSkulpt = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof Skulpt !== "undefined") {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/skulpt@1.2.0/dist/skulpt.min.js";
    script.onload = () => {
      const scriptStdlib = document.createElement("script");
      scriptStdlib.src = "https://cdn.jsdelivr.net/npm/skulpt@1.2.0/dist/skulpt-stdlib.js";
      scriptStdlib.onload = () => resolve();
      scriptStdlib.onerror = () => reject(new Error("Failed to load Skulpt stdlib"));
      document.head.appendChild(scriptStdlib);
    };
    script.onerror = () => reject(new Error("Failed to load Skulpt"));
    document.head.appendChild(script);
  });
};

export const runPythonCode = (code: string): Promise<string[]> => {
  return new Promise((resolve) => {
    const output: string[] = [];

    Skulpt.configure({
      output: (text: string) => {
        output.push(text);
      },
      read: (filename: string) => {
        if (
          Skulpt.builtinFiles === undefined ||
          Skulpt.builtinFiles["files"][filename] === undefined
        ) {
          throw new Error(`File not found: ${filename}`);
        }
        return Skulpt.builtinFiles["files"][filename];
      },
    });

    Skulpt.misceval
      .asyncToPromise(() => Skulpt.importMainWithBody("<stdin>", false, code, true))
      .then(() => {
        resolve(output);
      })
      .catch((err: any) => {
        output.push(`Error: ${err.toString()}`);
        resolve(output);
      });
  });
};
