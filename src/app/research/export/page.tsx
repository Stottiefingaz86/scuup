"use client";

import { useEffect, useState } from "react";

const KEY = "scuup-research-projects-v1";

export default function ResearchExportPage() {
  const [status, setStatus] = useState("Reading local project…");

  useEffect(() => {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      setStatus("No local research data in this browser.");
      return;
    }
    let projects: unknown;
    try {
      projects = JSON.parse(raw);
    } catch {
      setStatus("Local data was not valid JSON.");
      return;
    }
    void fetch("/api/research/snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projects }),
    })
      .then(async (res) => {
        const data = (await res.json()) as {
          ok?: boolean;
          runs?: number;
          error?: string;
        };
        if (!res.ok || !data.ok) {
          setStatus(data.error ?? "Export failed.");
          return;
        }
        setStatus(`Saved ${data.runs ?? 0} run(s) to disk. You can close this tab.`);
      })
      .catch(() => setStatus("Export failed — is localhost running?"));
  }, []);

  return (
    <main className="flex min-h-[50vh] items-center justify-center px-6 text-sm text-[var(--rs-muted)]">
      {status}
    </main>
  );
}
