"use client";

import { useEffect, useRef, useState } from "react";

interface MermaidBlockProps {
  code: string;
}

let mermaidInitialized = false;

export function MermaidBlock({ code }: MermaidBlockProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const mermaid = (await import("mermaid")).default;

        if (!mermaidInitialized) {
          mermaid.initialize({
            startOnLoad: false,
            theme: "dark",
            themeVariables: {
              primaryColor: "#F7941D",
              primaryTextColor: "#F0F0F0",
              primaryBorderColor: "rgba(255,255,255,0.1)",
              lineColor: "#9A9A9A",
              secondaryColor: "#1A1A1A",
              tertiaryColor: "#111111",
              background: "#111111",
              mainBkg: "#1A1A1A",
              nodeBorder: "rgba(255,255,255,0.1)",
              clusterBkg: "#161616",
              titleColor: "#F0F0F0",
              edgeLabelBackground: "#1A1A1A",
            },
          });
          mermaidInitialized = true;
        }

        if (cancelled || !ref.current) return;

        const id = `mermaid-${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.render(id, code);

        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render diagram");
        }
      }
    }

    render();
    return () => { cancelled = true; };
  }, [code]);

  if (error) {
    return (
      <div className="my-4 rounded-lg border border-red-900/40 bg-red-950/20 p-4">
        <p className="text-xs text-red-400 font-mono">{error}</p>
        <pre className="mt-2 text-xs text-[#606060] font-mono whitespace-pre-wrap">{code}</pre>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="my-6 flex justify-center rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] p-4 overflow-x-auto"
    />
  );
}
