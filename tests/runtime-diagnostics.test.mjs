import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const jiti = createJiti(import.meta.url, { moduleCache: false });

const { describeUnknownRuntimeError } = jiti(path.join(__dirname, "..", "src", "lib", "runtime-diagnostics.ts"));

{
  const described = describeUnknownRuntimeError(new Error("network unavailable"));
  assert.equal(described.name, "Error");
  assert.equal(described.message, "network unavailable");
}

{
  const described = describeUnknownRuntimeError({
    type: "error",
    [Symbol.toStringTag]: "ErrorEvent",
  });
  assert.equal(described.name, "error");
  assert.equal(described.message, "A runtime ErrorEvent was thrown without a message.");
}

{
  const described = describeUnknownRuntimeError({
    error: new TypeError("nested failure"),
  });
  assert.equal(described.name, "TypeError");
  assert.equal(described.message, "nested failure");
}

console.log("ok - runtime diagnostics describe Error and ErrorEvent-like failures safely");
