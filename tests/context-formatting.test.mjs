import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jiti = createJiti(import.meta.url, { moduleCache: false });
const {
  joinMarkdownFragments,
  joinMarkdownSections,
} = jiti(path.join(__dirname, "..", "src", "lib", "context-formatting.ts"));

assert.equal(joinMarkdownFragments(["two", "primary"]), "two primary");
assert.equal(
  joinMarkdownFragments(["Storage/Database", "Root cause:"]),
  "Storage/Database Root cause:"
);
assert.equal(
  joinMarkdownFragments(["updates.", "### 2"]),
  "updates.\n\n### 2"
);
assert.equal(
  joinMarkdownFragments(["Evidence:", "- Client"]),
  "Evidence:\n- Client"
);
assert.equal(
  joinMarkdownFragments(["Fix:", "**Requires** coordination."]),
  "Fix: **Requires** coordination."
);
assert.equal(
  joinMarkdownFragments(["already", " separated"], { trimOuterWhitespace: false }),
  "already separated"
);
assert.equal(
  joinMarkdownFragments(["two", " primary"], { trimOuterWhitespace: false }),
  "two primary"
);
assert.equal(
  joinMarkdownSections(["First section", "", "### 2", "Evidence:\n- Client\n\n\n- Server"]),
  "First section\n\n### 2\n\nEvidence:\n- Client\n\n- Server"
);

console.log("ok - markdown/context formatting preserves safe word and section boundaries");
