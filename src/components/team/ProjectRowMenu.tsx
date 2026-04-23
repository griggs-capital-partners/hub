"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useRailFloatingPanel } from "@/components/team/useRailFloatingPanel";

type ProjectRowMenuMode = "menu" | "rename" | "delete";

function GhostActionButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-[#D3CEC7] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-[#F6F3EE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(247,148,29,0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#161616]"
    >
      <span className="text-[#8D877F]">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

export function ProjectRowMenu({
  active = false,
  onDeleteProject,
  onRenameProject,
  projectId,
  projectLabel,
  threadCount,
}: {
  active?: boolean;
  onDeleteProject: (projectId: string) => Promise<{ deletedProjectId: string; movedThreadCount: number }>;
  onRenameProject: (projectId: string, name: string) => Promise<unknown>;
  projectId: string;
  projectLabel: string;
  threadCount: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = `project-row-menu-${projectId}`;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ProjectRowMenuMode>("menu");
  const [draftName, setDraftName] = useState(projectLabel);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const panelDependencyKey = [mode, projectLabel, String(threadCount)].join("|");
  const { panelRef, panelStyle, triggerRef } = useRailFloatingPanel(open, panelDependencyKey);
  const projectNameChanged = draftName.trim() !== projectLabel.trim();

  function resetMenuState(nextMode: ProjectRowMenuMode = "menu") {
    setMode(nextMode);
    setDraftName(projectLabel);
    setError(null);
    setRenaming(false);
    setDeleting(false);
  }

  function closeMenu(options?: { restoreFocus?: boolean }) {
    setOpen(false);
    resetMenuState();

    if (options?.restoreFocus) {
      requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
    }
  }

  useEffect(() => {
    if (!open) {
      resetMenuState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId, projectLabel]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node) && !panelRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu({ restoreFocus: true });
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const preferredSelector = mode === "rename" ? "input" : "button";
    const nextTarget =
      panelRef.current?.querySelector<HTMLElement>(preferredSelector)
      ?? panelRef.current?.querySelector<HTMLElement>("button, input");

    nextTarget?.focus();
  }, [mode, open, panelRef]);

  async function handleRename() {
    setError(null);
    setRenaming(true);

    try {
      await onRenameProject(projectId, draftName.trim());
      closeMenu();
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : "Unable to rename this project right now.");
    } finally {
      setRenaming(false);
    }
  }

  async function handleDelete() {
    setError(null);
    setDeleting(true);

    try {
      await onDeleteProject(projectId);
      closeMenu();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete this project right now.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div ref={rootRef} className="relative shrink-0" onClick={(event) => event.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (open) {
            closeMenu({ restoreFocus: true });
            return;
          }

          resetMenuState();
          setOpen(true);
        }}
        aria-label={`Project actions for ${projectLabel}`}
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-lg border border-transparent bg-transparent text-[#7E786F] transition-all hover:bg-[rgba(255,255,255,0.05)] hover:text-[#F6F3EE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(247,148,29,0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#121212]",
          open || active ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
        )}
        title={`Manage ${projectLabel}`}
      >
        <MoreHorizontal size={14} />
      </button>

      {open ? (
        <div
          id={menuId}
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-label={
            mode === "menu"
              ? `Project actions for ${projectLabel}`
              : mode === "rename"
                ? `Rename ${projectLabel}`
                : `Delete ${projectLabel}`
          }
          style={panelStyle ?? { left: -9999, position: "fixed", top: -9999 }}
          className="z-40 w-[17rem] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#161616] p-2 shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
        >
          {mode === "menu" ? (
            <div className="space-y-1">
              <GhostActionButton
                icon={<Pencil size={14} />}
                label="Rename project"
                onClick={() => setMode("rename")}
              />
              <GhostActionButton
                icon={<Trash2 size={14} />}
                label="Delete project"
                onClick={() => setMode("delete")}
              />
            </div>
          ) : mode === "rename" ? (
            <div className="space-y-3 p-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-[#F6F3EE]">Rename project</p>
                  <p className="mt-1 text-[11px] leading-5 text-[#6F6A64]">
                    Update the rail label without changing the threads inside it.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMode("menu")}
                  className="text-[11px] font-medium text-[#8D877F] transition-colors hover:text-[#F6F3EE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(247,148,29,0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#161616]"
                >
                  Back
                </button>
              </div>

              <input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                disabled={renaming}
                className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#111111] px-3 py-2 text-sm text-[#F0F0F0] placeholder:text-[#606060] transition-all duration-200 focus:border-[#F7941D] focus:outline-none focus:ring-1 focus:ring-[rgba(247,148,29,0.2)]"
              />

              {error ? (
                <p className="text-xs leading-5 text-[#E7BBBB]">{error}</p>
              ) : null}

              <div className="flex justify-end">
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-xl"
                  loading={renaming}
                  disabled={!draftName.trim() || !projectNameChanged}
                  onClick={() => void handleRename()}
                >
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 p-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-[#F6F3EE]">Delete project</p>
                  <p className="mt-1 text-[11px] leading-5 text-[#6F6A64]">
                    {threadCount > 0
                      ? `${threadCount} thread${threadCount === 1 ? "" : "s"} will move to General.`
                      : "No threads will be deleted. Future threads can still use General."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMode("menu")}
                  className="text-[11px] font-medium text-[#8D877F] transition-colors hover:text-[#F6F3EE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(247,148,29,0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#161616]"
                >
                  Back
                </button>
              </div>

              {error ? (
                <p className="text-xs leading-5 text-[#E7BBBB]">{error}</p>
              ) : null}

              <div className="flex justify-end">
                <Button
                  variant="danger"
                  size="sm"
                  className="rounded-xl"
                  loading={deleting}
                  onClick={() => void handleDelete()}
                >
                  Delete Project
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
