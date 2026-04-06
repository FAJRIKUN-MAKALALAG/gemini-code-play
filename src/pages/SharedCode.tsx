import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { backendService } from "@/services/backendService";
import { NotebookEditor } from "@/components/NotebookEditor";
import { loadSkulpt } from "@/utils/skulptRunner";
import { Loader2, ArrowLeft } from "lucide-react";

const SharedCode = () => {
  const { id } = useParams<{ id: string }>();
  const [code, setCode] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skulptReady, setSkulptReady] = useState(false);

  useEffect(() => {
    if (!skulptReady) {
      loadSkulpt().then(() => setSkulptReady(true)).catch(console.error);
    }
  }, [skulptReady]);

  useEffect(() => {
    const fetchSnippet = async () => {
      if (!id) return;
      setLoading(true);
      const { data, error } = await backendService.getSharedSnippet(id);
      if (error || !data) {
        setError(error?.message || "Kode tidak ditemukan.");
      } else {
        setCode(data.code_content);
      }
      setLoading(false);
    };
    fetchSnippet();
  }, [id]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Memuat kode publik...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background gap-4 text-center px-4">
        <div className="text-red-400 text-lg bg-red-500/10 px-6 py-4 rounded-xl border border-red-500/20">{error}</div>
        <Link to="/" className="text-primary hover:underline flex items-center gap-2 mt-2">
          <ArrowLeft className="w-4 h-4" /> Buka Workspace Sendiri
        </Link>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="h-14 border-b border-border flex items-center px-4 shrink-0 bg-secondary/10">
        <Link to="/" className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm font-medium transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Workspace Utama</span>
        </Link>
        <div className="ml-auto text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          Snapshot Kode Publik
        </div>
      </div>
      <div className="flex-1 min-h-0 bg-background">
        <NotebookEditor
          code={code}
          onChange={setCode}
          isRuntimeReady={skulptReady}
          disableAI={true}
        />
      </div>
    </div>
  );
};

export default SharedCode;
