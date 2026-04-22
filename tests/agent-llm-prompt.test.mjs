import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jiti = createJiti(import.meta.url, { moduleCache: false });
const { buildSystemPrompt } = jiti(path.join(__dirname, "..", "src", "lib", "agent-llm.ts"));

const prompt = buildSystemPrompt({
  name: "Ops Engineer",
  role: "Operations Engineer",
  orgContext: [
    "## Thread-Attached Documents (Current Conversation Only)",
    "## Thread Document: engineering-update.pdf",
    "Pressure limit is 60 psi.",
  ].join("\n\n"),
  contextSources: [
    {
      id: "thread-documents",
      label: "Thread-attached documents",
      description: "Current thread only. 1 used. Thread-document context currently supports plain text, markdown, PDF, and DOCX attachments.",
    },
  ],
  resolvedSources: [
    {
      label: "engineering-update.pdf",
      target: "engineering-update.pdf",
      status: "used",
      detail: "Read 2,068 readable characters from this thread attachment and truncated it to fit the active runtime context budget.",
    },
  ],
});

assert.match(prompt, /Runtime context status:/);
assert.match(prompt, /Thread-attached documents: Current thread only\. 1 used\./);
assert.match(prompt, /Thread attachment resolution:/);
assert.match(prompt, /Used - engineering-update\.pdf: Read 2,068 readable characters/);
assert.match(prompt, /Context grounding rules:/);
assert.match(prompt, /If this prompt includes a `## Thread Document:` section, that attachment was successfully read/);
assert.match(prompt, /Treat the `Thread attachment resolution` lines as authoritative status/);
assert.match(prompt, /Only say a thread attachment could not be read, did not load, or was unavailable when the prompt explicitly says so/);

console.log("ok - agent prompt grounding rules include thread-document truthfulness guidance");
