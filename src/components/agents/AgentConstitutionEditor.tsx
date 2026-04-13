"use client";

import { useEffect, useState, type CSSProperties } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import {
  AGENT_CONSTITUTION_SECTION_HINTS,
  AGENT_CONSTITUTION_SECTION_LABELS,
  AGENT_CONSTITUTION_SECTION_ORDER,
  AGENT_CONSTITUTION_TYPES,
  createAgentConstitutionSeed,
  createDefaultAgentConstitution,
  getAgentConstitutionForEditor,
  getConstitutionSection,
  hasStoredAgentConstitution,
  renderConstitutionAsPersona,
  serializeAgentConstitution,
  updateConstitutionAgentType,
  updateConstitutionSection,
  type AgentConstitution,
  type AgentConstitutionSection,
  type AgentConstitutionSectionId,
  type AgentConstitutionType,
} from "@/lib/agent-constitution";

const AGENT_COLOR = "#4B9CD3";
const AGENT_COLOR_DIM = "rgba(75,156,211,0.15)";

const constitutionMarkdownComponents: Components = {
  p: ({ children }) => <p className="mb-3 text-sm leading-6 text-[#D7D7D7] last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="list-disc space-y-2 pl-5 text-sm text-[#D7D7D7] marker:text-[#4B9CD3]">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal space-y-2 pl-5 text-sm text-[#D7D7D7] marker:text-[#4B9CD3]">{children}</ol>,
  li: ({ children }) => <li className="leading-6">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-[#F0F0F0]">{children}</strong>,
  em: ({ children }) => <em className="text-[#E0E0E0]">{children}</em>,
  code: ({ children }) => (
    <code className="rounded bg-[rgba(75,156,211,0.14)] px-1.5 py-0.5 text-xs text-[#8FD0FF]">
      {children}
    </code>
  ),
};

type ConstitutionPreviewBlockProps = {
  title: string;
  content: string;
};

function ConstitutionPreviewBlock({ title, content }: ConstitutionPreviewBlockProps) {
  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#151515] p-4">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#707070]">{title}</p>
      {content.trim() ? (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={constitutionMarkdownComponents}>
          {content}
        </ReactMarkdown>
      ) : (
        <p className="text-sm italic text-[#505050]">No content yet.</p>
      )}
    </div>
  );
}

export type AgentConstitutionEditorAgent = {
  name: string;
  role: string;
  description: string | null;
  constitution: string;
  persona: string;
};

type AgentConstitutionEditorProps = {
  agent: AgentConstitutionEditorAgent;
  onSave: (fields: Record<string, unknown>) => Promise<void>;
};

export function AgentConstitutionEditor({
  agent,
  onSave,
}: AgentConstitutionEditorProps) {
  function buildAgentSeed() {
    return createAgentConstitutionSeed({
      name: agent.name,
      role: agent.role,
      description: agent.description,
    });
  }

  function buildDraftFromAgent() {
    return getAgentConstitutionForEditor({
      constitution: agent.constitution,
      persona: agent.persona,
      fallbackAgentType: "custom",
      seed: buildAgentSeed(),
    });
  }

  const [constitution, setConstitution] = useState<AgentConstitution>(() => buildDraftFromAgent());
  const [baseline, setBaseline] = useState(() => serializeAgentConstitution(buildDraftFromAgent()));
  const [selectedSection, setSelectedSection] = useState<AgentConstitutionSectionId>("assistant_system");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPromptPreview, setShowPromptPreview] = useState(false);

  useEffect(() => {
    const next = buildDraftFromAgent();
    setConstitution(next);
    setBaseline(serializeAgentConstitution(next));
    setEditing(false);
  }, [agent.constitution, agent.persona, agent.name, agent.role, agent.description]);

  const dirty = serializeAgentConstitution(constitution) !== baseline;
  const selectedSectionContent = getConstitutionSection(constitution, selectedSection);
  const derivedPersona = renderConstitutionAsPersona(constitution);
  const selectedAgentType = AGENT_CONSTITUTION_TYPES.find((option) => option.id === constitution.agentType);
  const hasStructuredConstitution = hasStoredAgentConstitution(agent.constitution);
  const usesLegacyPersonaFallback = !hasStructuredConstitution && agent.persona.trim().length > 0;

  function updateSectionField(field: keyof AgentConstitutionSection, value: string) {
    setConstitution((current) => {
      if (field === "businessContext") {
        return updateConstitutionSection(current, selectedSection, { businessContext: value });
      }

      if (field === "personalContext") {
        return updateConstitutionSection(current, selectedSection, { personalContext: value });
      }

      return updateConstitutionSection(current, selectedSection, { content: value });
    });
  }

  function resetToTemplate() {
    setConstitution(createDefaultAgentConstitution(constitution.agentType, buildAgentSeed()));
    setEditing(true);
  }

  function cancelEditing() {
    const next = buildDraftFromAgent();
    setConstitution(next);
    setBaseline(serializeAgentConstitution(next));
    setEditing(false);
  }

  async function saveConstitution() {
    setSaving(true);
    try {
      await onSave({ constitution });
      setBaseline(serializeAgentConstitution(constitution));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  const sourceTitle = hasStructuredConstitution
    ? "Saved Constitution"
    : usesLegacyPersonaFallback
      ? "Legacy Persona Draft"
      : "Template Draft";

  const sourceDescription = hasStructuredConstitution
    ? "This saved Constitution is the source of truth. The runtime prompt preview is derived from it automatically."
    : usesLegacyPersonaFallback
      ? "This agent is still running from a legacy persona. Brain has imported that prompt into a structured draft; save once to persist the Constitution."
      : "This agent does not have a saved Constitution yet. Start from the template, then save to make it the source of truth.";

  return (
    <Card>
      <CardHeader className="border-b border-[rgba(255,255,255,0.06)] px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles size={15} style={{ color: AGENT_COLOR }} />
            <span className="text-sm font-bold text-[#F0F0F0]">Constitution</span>
          </div>
          <span
            className="rounded-full border px-2.5 py-1 text-[11px] font-semibold"
            style={{ color: AGENT_COLOR, borderColor: `${AGENT_COLOR}40`, backgroundColor: AGENT_COLOR_DIM }}
          >
            source of truth
          </span>
        </div>
      </CardHeader>
      <CardBody className="p-6 space-y-6">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
          <div className="rounded-xl border border-[rgba(75,156,211,0.18)] bg-[rgba(75,156,211,0.08)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: AGENT_COLOR }}>
              {sourceTitle}
            </p>
            <p className="mt-2 text-sm font-semibold text-[#F0F0F0]">Brain now manages the structured Constitution.</p>
            <p className="mt-1 text-xs leading-5 text-[#9A9A9A]">{sourceDescription}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            {dirty && (
              <span className="rounded-full border border-[rgba(251,191,36,0.24)] bg-[rgba(251,191,36,0.12)] px-2.5 py-1 text-[11px] font-semibold text-[#FBBF24]">
                Unsaved changes
              </span>
            )}

            {saved && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(34,197,94,0.25)] bg-[rgba(34,197,94,0.12)] px-2.5 py-1 text-[11px] font-semibold text-[#22C55E]">
                <Check size={11} />
                Saved
              </span>
            )}

            {editing ? (
              <>
                <Button size="sm" variant="secondary" onClick={resetToTemplate}>
                  Reset to Template
                </Button>
                <Button size="sm" variant="secondary" onClick={cancelEditing}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={saveConstitution}
                  loading={saving}
                  disabled={!dirty}
                  style={{ background: `linear-gradient(135deg, ${AGENT_COLOR}, #2980C4)` } as CSSProperties}
                >
                  Save Constitution
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="primary"
                onClick={() => setEditing(true)}
                style={{ background: `linear-gradient(135deg, ${AGENT_COLOR}, #2980C4)` } as CSSProperties}
              >
                Edit Constitution
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[220px_minmax(0,1fr)]">
          <div className="space-y-2">
            {AGENT_CONSTITUTION_SECTION_ORDER.map((sectionId) => {
              const isActive = selectedSection === sectionId;
              return (
                <button
                  key={sectionId}
                  type="button"
                  onClick={() => setSelectedSection(sectionId)}
                  className={cn(
                    "w-full rounded-xl border px-4 py-3 text-left transition-all",
                    isActive
                      ? "border-[rgba(75,156,211,0.35)] bg-[rgba(75,156,211,0.12)]"
                      : "border-[rgba(255,255,255,0.06)] bg-[#171717] hover:border-[rgba(75,156,211,0.18)]"
                  )}
                >
                  <p className="text-sm font-semibold text-[#F0F0F0]">{AGENT_CONSTITUTION_SECTION_LABELS[sectionId]}</p>
                  <p className="mt-1 text-xs leading-5 text-[#606060]">{AGENT_CONSTITUTION_SECTION_HINTS[sectionId]}</p>
                </button>
              );
            })}
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#151515] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: AGENT_COLOR }}>
                    {AGENT_CONSTITUTION_SECTION_LABELS[selectedSection]}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[#707070]">{AGENT_CONSTITUTION_SECTION_HINTS[selectedSection]}</p>
                </div>

                <div className="min-w-[220px] max-w-[320px] flex-1">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[#707070]">Agent Type</label>
                  <select
                    value={constitution.agentType}
                    onChange={(e) => {
                      const nextType = e.target.value as AgentConstitutionType;
                      setConstitution((current) => updateConstitutionAgentType(current, nextType));
                    }}
                    disabled={!editing}
                    className={cn(
                      "w-full rounded-lg border bg-[#1A1A1A] px-4 py-2.5 text-sm text-[#F0F0F0] transition-colors focus:outline-none",
                      editing
                        ? "border-[rgba(255,255,255,0.06)] focus:border-[rgba(75,156,211,0.4)]"
                        : "border-[rgba(255,255,255,0.04)] opacity-80"
                    )}
                  >
                    {AGENT_CONSTITUTION_TYPES.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {selectedAgentType && (
                    <p className="mt-1.5 text-xs leading-5 text-[#606060]">
                      {selectedAgentType.description} Use &quot;Reset to Template&quot; if you want section defaults for this type.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[#707070]">Guidance</label>
                  <textarea
                    rows={8}
                    value={selectedSectionContent.content}
                    onChange={(e) => updateSectionField("content", e.target.value)}
                    className="w-full rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] px-4 py-3 text-sm leading-6 text-[#F0F0F0] focus:outline-none focus:border-[rgba(75,156,211,0.4)] resize-y"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[#707070]">Business Context</label>
                    <textarea
                      rows={6}
                      value={selectedSectionContent.businessContext}
                      onChange={(e) => updateSectionField("businessContext", e.target.value)}
                      className="w-full rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] px-4 py-3 text-sm leading-6 text-[#F0F0F0] focus:outline-none focus:border-[rgba(75,156,211,0.4)] resize-y"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[#707070]">Personal Context</label>
                    <textarea
                      rows={6}
                      value={selectedSectionContent.personalContext}
                      onChange={(e) => updateSectionField("personalContext", e.target.value)}
                      className="w-full rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] px-4 py-3 text-sm leading-6 text-[#F0F0F0] focus:outline-none focus:border-[rgba(75,156,211,0.4)] resize-y"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <ConstitutionPreviewBlock title="Guidance" content={selectedSectionContent.content} />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <ConstitutionPreviewBlock title="Business Context" content={selectedSectionContent.businessContext} />
                  <ConstitutionPreviewBlock title="Personal Context" content={selectedSectionContent.personalContext} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#151515] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#F0F0F0]">Derived Runtime Prompt</p>
                <p className="mt-1 text-xs text-[#606060]">Read-only preview generated from the structured Constitution and written back to `persona`.</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setShowPromptPreview((current) => !current)}>
                {showPromptPreview ? "Hide Preview" : "Show Preview"}
              </Button>
            </div>
            {showPromptPreview && (
              <pre className="mt-4 max-h-96 overflow-auto rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111111] px-4 py-3 text-xs leading-6 text-[#D6D6D6] whitespace-pre-wrap">
                {derivedPersona}
              </pre>
            )}
          </div>

          <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#151515] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#F0F0F0]">Profile Suggestions</p>
                <p className="mt-1 text-xs text-[#606060]">Display-only in pass 1. Suggestions are surfaced for review and never auto-applied.</p>
              </div>
              <span
                className="rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                style={{ color: AGENT_COLOR, borderColor: `${AGENT_COLOR}40`, backgroundColor: AGENT_COLOR_DIM }}
              >
                {constitution.profileSuggestions.length}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {constitution.profileSuggestions.length > 0 ? constitution.profileSuggestions.map((suggestion) => (
                <div key={suggestion.id} className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111111] p-3">
                  <p className="text-sm font-semibold text-[#F0F0F0]">{suggestion.title}</p>
                  <p className="mt-1 text-xs leading-5 text-[#8D877F]">{suggestion.detail}</p>
                </div>
              )) : (
                <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111111] p-3">
                  <p className="text-sm text-[#9A9A9A]">No suggestions are queued yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
