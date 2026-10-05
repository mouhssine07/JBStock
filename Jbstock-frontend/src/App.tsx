import { useEffect, useState } from "react";

type BackendHealth = {
  status: "UP" | "DOWN";
};

function App() {
  const [health, setHealth] = useState<BackendHealth | null>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/health")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Health request failed with HTTP ${response.status}`);
        }
        return response.json() as Promise<BackendHealth>;
      })
      .then(setHealth)
      .catch(() => {
        if (active) {
          setHealth({ status: "DOWN" });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-8 text-slate-900">
      <section className="text-center">
        <h1 className="text-3xl font-semibold">JBStock</h1>
        <p className="mt-3 text-sm text-slate-600" role="status" aria-live="polite">
          Backend: {health?.status ?? "checking…"}
        </p>
      </section>
    </main>
  )
}

export default App
