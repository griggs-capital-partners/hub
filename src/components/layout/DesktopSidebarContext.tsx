"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type DesktopSidebarContextValue = {
  collapsed: boolean;
  collapseReason: "manual" | "chat-focus" | null;
  collapseForChatFocus: () => void;
  releaseChatFocus: () => void;
  collapseManually: () => void;
  expandManually: () => void;
  toggleManually: () => void;
};

const DesktopSidebarContext = createContext<DesktopSidebarContextValue>({
  collapsed: false,
  collapseReason: null,
  collapseForChatFocus: () => {},
  releaseChatFocus: () => {},
  collapseManually: () => {},
  expandManually: () => {},
  toggleManually: () => {},
});

export function DesktopSidebarProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
    collapsed: boolean;
    collapseReason: "manual" | "chat-focus" | null;
  }>({
    collapsed: false,
    collapseReason: null,
  });

  const collapseForChatFocus = useCallback(() => {
    setState((current) => {
      if (current.collapsed && current.collapseReason === "manual") {
        return current;
      }

      if (current.collapsed && current.collapseReason === "chat-focus") {
        return current;
      }

      return {
        collapsed: true,
        collapseReason: "chat-focus",
      };
    });
  }, []);

  const releaseChatFocus = useCallback(() => {
    setState((current) => (
      current.collapseReason === "chat-focus"
        ? {
            collapsed: false,
            collapseReason: null,
          }
        : current
    ));
  }, []);

  const collapseManually = useCallback(() => {
    setState({
      collapsed: true,
      collapseReason: "manual",
    });
  }, []);

  const expandManually = useCallback(() => {
    setState({
      collapsed: false,
      collapseReason: null,
    });
  }, []);

  const toggleManually = useCallback(() => {
    setState((current) => (
      current.collapsed
        ? {
            collapsed: false,
            collapseReason: null,
          }
        : {
            collapsed: true,
            collapseReason: "manual",
        }
    ));
  }, []);

  const value = useMemo<DesktopSidebarContextValue>(() => ({
    collapsed: state.collapsed,
    collapseReason: state.collapseReason,
    collapseForChatFocus,
    releaseChatFocus,
    collapseManually,
    expandManually,
    toggleManually,
  }), [
    collapseForChatFocus,
    collapseManually,
    expandManually,
    releaseChatFocus,
    state.collapsed,
    state.collapseReason,
    toggleManually,
  ]);

  return (
    <DesktopSidebarContext.Provider value={value}>
      {children}
    </DesktopSidebarContext.Provider>
  );
}

export function useDesktopSidebar() {
  return useContext(DesktopSidebarContext);
}
