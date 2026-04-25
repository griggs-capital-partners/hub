import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jiti = createJiti(import.meta.url, { moduleCache: false });
const {
  estimateContextSectionTokens,
  estimateContextSectionsTokens,
  estimateFormattingOverheadTokens,
  estimateProvenanceLineTokens,
  estimateSourceTextTokens,
  estimateTextTokens,
  estimateThreadMessageTokens,
  estimateThreadMessagesTokens,
} = jiti(path.join(__dirname, "..", "src", "lib", "context-token-budget.ts"));

assert.equal(estimateTextTokens(""), 0);
assert.equal(estimateTextTokens("abcd"), 1);
assert.equal(estimateTextTokens("abcdefgh"), 2);
assert.equal(estimateTextTokens("abcdefgh", { fixedOverheadTokens: 2 }), 4);

assert.equal(
  estimateFormattingOverheadTokens({
    fixedTokens: 1,
    lineCount: 2,
    perLineTokens: 3,
    sectionCount: 1,
    perSectionTokens: 4,
    metadataEntryCount: 2,
    metadataEntryTokens: 5,
  }),
  21
);

assert.equal(estimateThreadMessageTokens({ role: "user", content: "" }), 0);
assert.equal(estimateThreadMessageTokens({ role: "user", content: "abcd" }), 3);
assert.equal(
  estimateThreadMessagesTokens([
    { role: "user", content: "abcd" },
    { role: "assistant", content: "abcdefgh" },
  ]),
  8
);

assert.equal(
  estimateProvenanceLineTokens("prov"),
  estimateTextTokens("prov") + 1
);

assert.equal(
  estimateContextSectionTokens({
    heading: "## Section",
    body: "abcdefgh",
    metadataLines: ["meta"],
    provenanceLines: ["prov"],
  }),
  15
);

assert.equal(
  estimateContextSectionsTokens([
    { heading: "## A", body: "abcd" },
    { heading: "## B", body: "abcdefgh" },
  ]),
  12
);

assert.equal(
  estimateSourceTextTokens({
    label: "Doc",
    text: "abcdefgh",
    provenanceLines: ["prov"],
  }),
  11
);

console.log("ok - context token budget helpers centralize approximate token estimation");
