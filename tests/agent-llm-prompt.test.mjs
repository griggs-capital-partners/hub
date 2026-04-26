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
assert.match(prompt, /When a thread attachment was read and is relevant, use its contents directly instead of claiming you do not have access to it/i);
assert.match(prompt, /If the prompt says selected excerpts were included to fit budget, answer from the excerpts available in the current context/i);
assert.match(prompt, /Do not imply the uploaded file was unavailable, and do not imply the full extracted text is present unless the prompt says so/i);
assert.match(prompt, /When excerpt provenance headers name an article, section, exhibit, or schedule, use those exact labels/);
assert.match(prompt, /do not invent article titles/i);
assert.match(prompt, /Treat excerpt provenance headers as the document-body location where the excerpt appears/i);
assert.match(prompt, /Do not relabel an excerpt as a different article, section, exhibit, or schedule merely because the excerpt references that location/i);
assert.match(prompt, /Do not use standard industry framing or background assumptions to infer article, section, exhibit, or schedule locations/i);
assert.match(prompt, /treat that inventory as the authoritative extracted-file search result over the successfully extracted contents of the searchable attached files/i);
assert.match(prompt, /Do not tell the user to re-upload the same file, use Ctrl\+F, or manually verify the file unless the prompt explicitly says extraction or search failed or the user explicitly asks for manual verification/i);
assert.match(prompt, /When caveating a successful scan, use extraction-scope limits only/i);
assert.match(prompt, /describe the answer as based on the successfully extracted contents of the attached file or files rather than only on selected excerpts or excerpted portions/i);
assert.match(prompt, /Distinguish 'located in' from 'references\.'/i);
assert.match(prompt, /say the location is unclear rather than inventing an article title or exhibit location/i);
assert.match(prompt, /Match depth to the ask\./);
assert.match(prompt, /Do not cut off important caveats, rationale, or next steps just to stay short\./);
assert.doesNotMatch(prompt, /Be concise\./);

console.log("ok - agent prompt grounding rules include thread-document truthfulness guidance");
