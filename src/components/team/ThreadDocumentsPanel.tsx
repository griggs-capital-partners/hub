"use client";

import { useRef } from "react";
import {
  AlertTriangle,
  Check,
  Download,
  File,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  type ConversationDocumentSummary,
  formatDocumentBytes,
  getConversationDocumentDownloadHref,
} from "@/components/team/team-chat-shared";
import { useTeamChatPerfCommit } from "@/components/team/team-chat-performance";
import { CONVERSATION_DOCUMENT_ACCEPT } from "@/lib/conversation-documents";
import { cn } from "@/lib/utils";

export type ThreadDocumentUploadState = {
  id: string;
  conversationId: string;
  filename: string;
  fileSize: number;
  status: "uploading" | "uploaded" | "failed";
  error: string | null;
};

function getDocumentIcon(fileType: string) {
  if (fileType === "image") return FileImage;
  if (fileType === "audio") return FileAudio;
  if (fileType === "spreadsheet") return FileSpreadsheet;
  if (fileType === "pdf" || fileType === "text" || fileType === "document") return FileText;
  return File;
}

export function ThreadDocumentsPanel({
  conversationId,
  documents,
  uploads,
  title = "Attached Documents",
  description,
  emptyLabel = "Attach files to keep working docs tied to this thread.",
  uploadButtonLabel = "Upload Files",
  canUpload = false,
  canRemove = false,
  removingDocumentId,
  error,
  compact = false,
  onUpload,
  onRemoveDocument,
  onDismissUpload,
}: {
  conversationId: string;
  documents: ConversationDocumentSummary[];
  uploads: ThreadDocumentUploadState[];
  title?: string;
  description?: string;
  emptyLabel?: string;
  uploadButtonLabel?: string;
  canUpload?: boolean;
  canRemove?: boolean;
  removingDocumentId?: string | null;
  error?: string | null;
  compact?: boolean;
  onUpload?: (files: File[]) => void;
  onRemoveDocument?: (document: ConversationDocumentSummary) => void;
  onDismissUpload?: (uploadId: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hasItems = uploads.length > 0 || documents.length > 0;
  useTeamChatPerfCommit("ThreadDocumentsPanel", {
    conversationId,
    documentCount: documents.length,
    uploadCount: uploads.length,
    compact,
    canUpload,
    canRemove,
    removingDocumentId: removingDocumentId ?? null,
  });

  return (
    <section
      className={cn(
        "rounded-[24px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]",
        compact ? "p-3" : "p-4"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#F6F3EE]">{title}</p>
          <p className="mt-1 text-xs leading-5 text-[#8D877F]">
            {description ?? "Thread-level files stay visible here and in the thread details drawer."}
          </p>
        </div>
        {canUpload && onUpload ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={CONVERSATION_DOCUMENT_ACCEPT}
              className="hidden"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                if (files.length > 0) {
                  onUpload(files);
                }
                event.currentTarget.value = "";
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              className="rounded-2xl px-3"
              icon={<Upload size={14} />}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadButtonLabel}
            </Button>
          </>
        ) : null}
      </div>

      {error ? (
        <div className="mt-3 rounded-2xl border border-[rgba(239,68,68,0.16)] bg-[rgba(239,68,68,0.08)] px-3 py-2 text-xs leading-5 text-[#F2C0C0]">
          {error}
        </div>
      ) : null}

      {!hasItems ? (
        <div className="mt-4 rounded-2xl border border-dashed border-[rgba(255,255,255,0.08)] bg-[#111111] px-4 py-4 text-sm text-[#8D877F]">
          {emptyLabel}
        </div>
      ) : (
        <div className="chat-scroll mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
          {uploads.map((upload) => (
            <div
              key={upload.id}
              className={cn(
                "flex items-start gap-3 rounded-2xl border px-3 py-3",
                upload.status === "failed"
                  ? "border-[rgba(239,68,68,0.18)] bg-[rgba(239,68,68,0.06)]"
                  : upload.status === "uploaded"
                    ? "border-[rgba(74,222,128,0.18)] bg-[rgba(74,222,128,0.06)]"
                    : "border-[rgba(255,255,255,0.06)] bg-[#111111]"
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                  upload.status === "failed"
                    ? "bg-[rgba(239,68,68,0.14)] text-[#EF4444]"
                    : upload.status === "uploaded"
                      ? "bg-[rgba(74,222,128,0.12)] text-[#4ADE80]"
                      : "bg-[rgba(247,148,29,0.12)] text-[#F7941D]"
                )}
              >
                {upload.status === "failed"
                  ? <AlertTriangle size={16} />
                  : upload.status === "uploaded"
                    ? <Check size={16} />
                    : <Loader2 size={16} className="animate-spin" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#F6F3EE]">{upload.filename}</p>
                <p className="mt-1 text-xs text-[#8D877F]">
                  {formatDocumentBytes(upload.fileSize)}
                  {" · "}
                  {upload.status === "failed"
                    ? upload.error ?? "Upload failed"
                    : upload.status === "uploaded"
                      ? "Attached to this thread"
                      : "Uploading..."}
                </p>
              </div>
              {upload.status === "failed" && onDismissUpload ? (
                <button
                  type="button"
                  onClick={() => onDismissUpload(upload.id)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-[#8D877F] transition-colors hover:text-[#F6F3EE]"
                  aria-label={`Dismiss failed upload ${upload.filename}`}
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>
          ))}

          {documents.map((document) => {
            const Icon = getDocumentIcon(document.fileType);
            const downloadHref = getConversationDocumentDownloadHref(conversationId, document.id);

            return (
              <div
                key={document.id}
                className="flex items-start gap-3 rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[#111111] px-3 py-3"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[rgba(247,148,29,0.12)] text-[#F7941D]">
                  <Icon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#F6F3EE]">{document.filename}</p>
                  <p className="mt-1 text-xs text-[#8D877F]">
                    {formatDocumentBytes(document.fileSize)}
                    {" · "}
                    {document.uploader.name}
                    {" · "}
                    {new Date(document.createdAt).toLocaleDateString()}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <a
                      href={downloadHref}
                      className="inline-flex items-center gap-1 rounded-full border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-2.5 py-1 text-[11px] font-medium text-[#CFC9C2] transition-colors hover:text-[#F6F3EE]"
                    >
                      <Download size={12} />
                      Download
                    </a>
                  </div>
                </div>
                {canRemove && onRemoveDocument ? (
                  <button
                    type="button"
                    onClick={() => onRemoveDocument(document)}
                    disabled={removingDocumentId === document.id}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-[#8D877F] transition-colors hover:text-[#EF4444] disabled:opacity-50"
                    aria-label={`Remove ${document.filename} from this thread`}
                  >
                    {removingDocumentId === document.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
