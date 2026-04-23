"use client";

import { useEffect, useRef, useState } from "react";
import { Archive, FolderInput, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  type ChatProjectOption,
  type ConversationSummary,
  getConversationLabel,
} from "@/components/team/team-chat-shared";
import { useRailFloatingPanel } from "@/components/team/useRailFloatingPanel";
import { cn } from "@/lib/utils";

type ThreadRowMenuMode = "menu" | "rename" | "move" | "archive" | "delete";

function GhostActionButton({
  icon,
  label,
  onClick,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(247,148,29,0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#161616]",
        tone === "danger"
          ? "text-[#F0C6C6] hover:bg-[rgba(239,68,68,0.08)] hover:text-[#FFE5E5]"
          : "text-[#D3CEC7] hover:bg-[rgba(255,255,255,0.05)] hover:text-[#F6F3EE]"
      )}
    >
      <span className={tone === "danger" ? "text-[#D79C9C]" : "text-[#8D877F]"}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

export function ThreadRowMenu({
  conversation,
  currentUserId,
  projects,
  active = false,
  onRenameThread,
  onMoveThread,
  onArchiveThread,
  onDeleteThread,
}: {
  conversation: ConversationSummary;
  currentUserId: string;
  projects: ChatProjectOption[];
  active?: boolean;
  onRenameThread: (conversationId: string, name: string | null) => Promise<void>;
  onMoveThread: (conversationId: string, projectId: string | null) => Promise<void>;
  onArchiveThread: (conversationId: string) => Promise<void>;
  onDeleteThread: (conversationId: string) => Promise<void>;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const currentThreadName = conversation.name?.trim() ?? "";
  const currentProjectId = conversation.project?.id ?? "";
  const threadLabel = getConversationLabel(conversation, currentUserId);
  const menuId = `thread-row-menu-${conversation.id}`;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ThreadRowMenuMode>("menu");
  const [draftName, setDraftName] = useState(currentThreadName);
  const [targetProjectId, setTargetProjectId] = useState(currentProjectId);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [moving, setMoving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const panelDependencyKey = [
    conversation.id,
    conversation.name ?? "",
    conversation.project?.id ?? "",
    mode,
    String(projects.length),
  ].join("|");
  const { panelRef, panelStyle, triggerRef } = useRailFloatingPanel(open, panelDependencyKey);
  const threadNameChanged = draftName.trim() !== currentThreadName;
  const projectChanged = targetProjectId !== currentProjectId;

  function resetMenuState(nextMode: ThreadRowMenuMode = "menu") {
    setMode(nextMode);
    setDraftName(conversation.name?.trim() ?? "");
    setTargetProjectId(conversation.project?.id ?? "");
    setError(null);
    setRenaming(false);
    setMoving(false);
    setArchiving(false);
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
  }, [conversation.id, conversation.name, conversation.project?.id, open]);

  useEffect(() => {
    if (!open) return;

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
    if (!open) return;

    const preferredSelector =
      mode === "rename" ? "input" : mode === "move" ? "select" : "button";

    const nextTarget =
      panelRef.current?.querySelector<HTMLElement>(preferredSelector) ??
      panelRef.current?.querySelector<HTMLElement>("button, input, select");

    nextTarget?.focus();
  }, [mode, open, panelRef]);

  async function handleRename() {
    setError(null);
    setRenaming(true);

    try {
      await onRenameThread(conversation.id, draftName.trim() || null);
      closeMenu();
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : "Unable to rename this thread right now.");
    } finally {
      setRenaming(false);
    }
  }

  async function handleMove() {
    setError(null);
    setMoving(true);

    try {
      await onMoveThread(conversation.id, targetProjectId || null);
      closeMenu();
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : "Unable to move this thread right now.");
    } finally {
      setMoving(false);
    }
  }

  async function handleArchive() {
    setError(null);
    setArchiving(true);

    try {
      await onArchiveThread(conversation.id);
      closeMenu();
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Unable to archive this thread right now.");
    } finally {
      setArchiving(false);
    }
  }

  async function handleDelete() {
    setError(null);
    setDeleting(true);

    try {
      await onDeleteThread(conversation.id);
      closeMenu();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete this thread right now.");
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
        aria-label={`Thread actions for ${getConversationLabel(conversation, currentUserId)}`}
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-lg border border-transparent bg-transparent text-[#7E786F] transition-all hover:bg-[rgba(255,255,255,0.05)] hover:text-[#F6F3EE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(247,148,29,0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#121212]",
          open || active ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
        )}
        title={`Manage ${threadLabel}`}
      >
        <MoreHorizontal size={13} />
      </button>

      {open ? (
        <div
          id={menuId}
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-label={
            mode === "menu"
              ? `Thread actions for ${threadLabel}`
              : mode === "rename"
                ? `Rename ${threadLabel}`
                : mode === "move"
                  ? `Move ${threadLabel}`
                  : mode === "archive"
                    ? `Archive ${threadLabel}`
                    : `Delete ${threadLabel}`
          }
          style={panelStyle ?? { left: -9999, position: "fixed", top: -9999 }}
          className="z-40 w-[17rem] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#161616] p-2 shadow-[0_24px_60px_rgba(0,0,0,0.35)]"
        >
          {mode === "menu" ? (
            <div className="space-y-1">
              <GhostActionButton
                icon={<Pencil size={14} />}
                label="Rename thread"
                onClick={() => setMode("rename")}
              />
              <GhostActionButton
                icon={<FolderInput size={14} />}
                label="Move to project"
                onClick={() => setMode("move")}
              />
              <div className="my-1 border-t border-[rgba(255,255,255,0.06)]" />
              <GhostActionButton
                icon={<Archive size={14} />}
                label="Archive thread"
                onClick={() => setMode("archive")}
              />
              <GhostActionButton
                icon={<Trash2 size={14} />}
                label="Delete thread"
                tone="danger"
                onClick={() => setMode("delete")}
              />
            </div>
          ) : mode === "rename" ? (
            <div className="space-y-3 p-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-[#F6F3EE]">Rename thread</p>
                  <p className="mt-1 text-[11px] leading-5 text-[#6F6A64]">
                    Leave it blank to use the automatic title.
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
                placeholder={getConversationLabel(conversation, currentUserId)}
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
                  disabled={!threadNameChanged}
                  onClick={() => void handleRename()}
                >
                  {draftName.trim() ? "Save" : "Use Automatic"}
                </Button>
              </div>
            </div>
          ) : mode === "move" ? (
            <div className="space-y-3 p-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-[#F6F3EE]">Move thread</p>
                  <p className="mt-1 text-[11px] leading-5 text-[#6F6A64]">
                    Reassign this thread to a chat project or back to General.
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

              <select
                value={targetProjectId}
                onChange={(event) => setTargetProjectId(event.target.value)}
                disabled={moving}
                className="w-full rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#111111] px-3 py-2 text-sm text-[#F0F0F0] transition-all duration-200 focus:border-[#F7941D] focus:outline-none focus:ring-1 focus:ring-[rgba(247,148,29,0.2)]"
              >
                <option value="">General</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>

              {error ? (
                <p className="text-xs leading-5 text-[#E7BBBB]">{error}</p>
              ) : null}

              <div className="flex justify-end">
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-xl"
                  loading={moving}
                  disabled={!projectChanged}
                  onClick={() => void handleMove()}
                >
                  {targetProjectId ? "Move Thread" : "Send to General"}
                </Button>
              </div>
            </div>
          ) : mode === "archive" ? (
            <div className="space-y-3 p-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-[#F6F3EE]">Archive thread</p>
                  <p className="mt-1 text-[11px] leading-5 text-[#6F6A64]">
                    Hide this thread from the main chat rail. Messages, documents, and context history stay intact.
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

              <div className="rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.025)] px-3 py-3">
                <p className="text-sm font-medium text-[#F6F3EE]">{threadLabel}</p>
                <p className="mt-1 text-xs leading-5 text-[#8D877F]">
                  Archived threads stay in the database but disappear from normal Team Chat views.
                </p>
              </div>

              {error ? (
                <p className="text-xs leading-5 text-[#E7BBBB]">{error}</p>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMode("menu")}
                  disabled={archiving}
                >
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-xl"
                  loading={archiving}
                  onClick={() => void handleArchive()}
                >
                  Archive Thread
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 p-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-[#F6F3EE]">Delete thread</p>
                  <p className="mt-1 text-[11px] leading-5 text-[#6F6A64]">
                    Permanently remove this thread, including its messages, attachments, and saved context history.
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

              <div className="rounded-2xl border border-[rgba(239,68,68,0.14)] bg-[rgba(239,68,68,0.06)] px-3 py-3">
                <p className="text-sm font-medium text-[#F8D4D4]">{threadLabel}</p>
                <p className="mt-1 text-xs leading-5 text-[#D7A8A8]">
                  This action is final and removes the thread for everyone who still has access to it.
                </p>
              </div>

              {error ? (
                <p className="text-xs leading-5 text-[#E7BBBB]">{error}</p>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMode("menu")}
                  disabled={deleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-xl border-[rgba(239,68,68,0.18)] bg-[rgba(239,68,68,0.08)] text-[#F3C1C1] hover:bg-[rgba(239,68,68,0.14)] hover:text-[#F8D4D4]"
                  loading={deleting}
                  onClick={() => void handleDelete()}
                >
                  Delete Thread
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
