"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

const VIEWPORT_GUTTER = 12;
const PANEL_OFFSET = 8;

export function useRailFloatingPanel(open: boolean, dependencyKey = "") {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    function updatePanelPosition() {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (!trigger || !panel) {
        return;
      }

      const triggerRect = trigger.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const left = Math.min(
        triggerRect.right + PANEL_OFFSET,
        window.innerWidth - panelRect.width - VIEWPORT_GUTTER
      );
      const top = Math.min(
        Math.max(
          triggerRect.top + (triggerRect.height / 2) - (panelRect.height / 2),
          VIEWPORT_GUTTER
        ),
        window.innerHeight - panelRect.height - VIEWPORT_GUTTER
      );

      setPanelStyle({
        left: Math.max(VIEWPORT_GUTTER, left),
        position: "fixed",
        top,
      });
    }

    updatePanelPosition();
    window.addEventListener("resize", updatePanelPosition);
    document.addEventListener("scroll", updatePanelPosition, true);

    return () => {
      window.removeEventListener("resize", updatePanelPosition);
      document.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [dependencyKey, open]);

  return { panelRef, panelStyle, triggerRef };
}
