import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import {
  getPageAwarePdfExtractionFixture,
  getT5DeckExpectations,
  getT5DeckPdfExtractionFixture,
} from "./fixtures/context-pdf-fixtures.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jiti = createJiti(import.meta.url, { moduleCache: false });
const {
  DEFAULT_DOCUMENT_CHUNK_STRATEGY,
  DEFAULT_DOCUMENT_CHUNK_RANKING_STRATEGY,
} = jiti(path.join(__dirname, "..", "src", "lib", "context-document-chunks.ts"));
const {
  MAX_THREAD_DOCUMENT_CONTEXT_BUNDLE_CHARS,
  resolveConversationContextBundle: resolveConversationContextBundleBase,
} = jiti(path.join(__dirname, "..", "src", "lib", "conversation-context.ts"));
const {
  CONVERSATION_DOCUMENT_ACCEPT,
  resolveConversationDocumentMetadata,
  validateConversationDocument,
} = jiti(path.join(__dirname, "..", "src", "lib", "conversation-documents.ts"));
const { buildPdfContextExtractionResult } = jiti(
  path.join(__dirname, "..", "src", "lib", "context-pdf.ts")
);

function makeDocument(overrides = {}) {
  return {
    id: overrides.id ?? "doc-1",
    conversationId: overrides.conversationId ?? "thread-1",
    filename: overrides.filename ?? "notes.md",
    mimeType: overrides.mimeType ?? "text/markdown",
    fileType: overrides.fileType ?? "text",
    storagePath: overrides.storagePath ?? "C:\\GitHub\\hub\\uploads\\thread-1\\notes.md",
  };
}

function makeAuthority(overrides = {}) {
  return {
    requestingUserId: overrides.requestingUserId ?? "user-1",
    activeUserIds: overrides.activeUserIds ?? ["user-1"],
    activeAgentId: overrides.activeAgentId ?? "agent-1",
    activeAgentIds: overrides.activeAgentIds ?? ["agent-1"],
  };
}

function resolveConversationContextBundle(params, dependencies) {
  return resolveConversationContextBundleBase(
    {
      ...params,
      authority: params.authority ?? makeAuthority(),
    },
    dependencies
  );
}

function createDocumentIntelligenceMemory() {
  const knowledgeArtifacts = [];
  const inspectionTasks = [];

  return {
    knowledgeArtifacts,
    inspectionTasks,
    dependencies: {
      listKnowledgeArtifacts: async (conversationDocumentIds) =>
        knowledgeArtifacts.filter((artifact) => conversationDocumentIds.includes(artifact.conversationDocumentId)),
      upsertKnowledgeArtifact: async (artifact) => {
        const existingIndex = knowledgeArtifacts.findIndex(
          (entry) =>
            entry.conversationDocumentId === artifact.sourceDocumentId &&
            entry.artifactKey === artifact.artifactKey
        );
        const now = new Date();
        const stored = {
          id:
            existingIndex >= 0
              ? knowledgeArtifacts[existingIndex].id
              : `${artifact.sourceDocumentId}:${artifact.artifactKey}`,
          conversationDocumentId: artifact.sourceDocumentId,
          artifactKey: artifact.artifactKey,
          kind: artifact.kind,
          status: artifact.status,
          title: artifact.title,
          summary: artifact.summary,
          content: artifact.content,
          tool: artifact.tool,
          sourcePageNumber: artifact.location.pageNumberStart,
          sourcePageLabel: artifact.location.pageLabelStart,
          tableId: artifact.location.tableId,
          figureId: artifact.location.figureId,
          sectionPath: JSON.stringify(artifact.location.sectionPath),
          headingPath: JSON.stringify(artifact.location.headingPath),
          sourceLocationLabel: artifact.sourceLocationLabel,
          payloadJson: JSON.stringify(artifact.payload),
          relevanceHints: JSON.stringify(artifact.relevanceHints),
          confidence: artifact.confidence,
          createdAt: existingIndex >= 0 ? knowledgeArtifacts[existingIndex].createdAt : now,
          updatedAt: now,
        };

        if (existingIndex >= 0) {
          knowledgeArtifacts[existingIndex] = stored;
        } else {
          knowledgeArtifacts.push(stored);
        }

        return stored;
      },
      listInspectionTasks: async (conversationDocumentIds) =>
        inspectionTasks.filter((task) => conversationDocumentIds.includes(task.conversationDocumentId)),
      upsertInspectionTask: async (task) => {
        const existingIndex = inspectionTasks.findIndex(
          (entry) =>
            entry.conversationDocumentId === task.sourceDocumentId &&
            entry.taskKey === task.taskKey
        );
        const now = new Date();
        const stored = {
          id:
            existingIndex >= 0
              ? inspectionTasks[existingIndex].id
              : `${task.sourceDocumentId}:${task.taskKey}`,
          conversationDocumentId: task.sourceDocumentId,
          taskKey: task.taskKey,
          kind: task.kind,
          status: task.status,
          tool: task.tool,
          rationale: task.rationale,
          sourcePageNumber: task.location.pageNumberStart,
          sourcePageLabel: task.location.pageLabelStart,
          tableId: task.location.tableId,
          figureId: task.location.figureId,
          sectionPath: JSON.stringify(task.location.sectionPath),
          headingPath: JSON.stringify(task.location.headingPath),
          sourceLocationLabel: task.sourceLocationLabel,
          resultSummary: task.resultSummary,
          resultJson: JSON.stringify(task.result),
          unresolvedJson: JSON.stringify(task.unresolved),
          createdArtifactKeys: JSON.stringify(task.createdArtifactKeys),
          createdAt: existingIndex >= 0 ? inspectionTasks[existingIndex].createdAt : now,
          updatedAt: now,
          completedAt: task.completedAt ? new Date(task.completedAt) : now,
        };

        if (existingIndex >= 0) {
          inspectionTasks[existingIndex] = stored;
        } else {
          inspectionTasks.push(stored);
        }

        return stored;
      },
    },
  };
}

function findSourceDecision(bundle, sourceId) {
  return bundle.sourceDecisions.find((source) => source.sourceId === sourceId) ?? null;
}

function escapePdfLiteralText(value) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function createMinimalPdfBuffer(text) {
  const stream = [
    "BT",
    "/F1 12 Tf",
    "72 720 Td",
    `(${escapePdfLiteralText(text)}) Tj`,
    "ET",
  ].join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}

function escapeXmlText(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function createMinimalDocxBuffer(text) {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
  );
  zip.folder("_rels").file(
    ".rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
  );
  zip.folder("word").file(
    "document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${escapeXmlText(text)}</w:t></w:r></w:p></w:body></w:document>`
  );

  return zip.generateAsync({ type: "nodebuffer" });
}

async function createMinimalPptxBuffer(slides = [
  {
    lines: ["Quarterly Update", "Revenue up 12%"],
    notes: ["Speaker note: highlight maintenance backlog."],
  },
]) {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  ${slides.map((_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("")}
  ${slides.map((slide, index) => slide.notes?.length ? `<Override PartName="/ppt/notesSlides/notesSlide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>` : "").join("")}
</Types>`
  );
  zip.folder("_rels").file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`
  );
  zip.folder("ppt").file(
    "presentation.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldIdLst>
    ${slides.map((_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 1}"/>`).join("")}
  </p:sldIdLst>
  <p:sldSz cx="9144000" cy="6858000"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`
  );
  zip.folder("ppt").folder("_rels").file(
    "presentation.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${slides.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`).join("")}
</Relationships>`
  );

  slides.forEach((slide, index) => {
    const slideNumber = index + 1;
    zip.folder("ppt").folder("slides").file(
      `slide${slideNumber}.xml`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title ${slideNumber}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          ${slide.lines.map((line) => `<a:p><a:r><a:t>${escapeXmlText(line)}</a:t></a:r></a:p>`).join("")}
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`
    );

    if (slide.notes?.length) {
      zip.folder("ppt").folder("slides").folder("_rels").file(
        `slide${slideNumber}.xml.rels`,
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide${slideNumber}.xml"/>
</Relationships>`
      );

      zip.folder("ppt").folder("notesSlides").file(
        `notesSlide${slideNumber}.xml`,
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Notes Placeholder ${slideNumber}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          ${slide.notes.map((line) => `<a:p><a:r><a:t>${escapeXmlText(line)}</a:t></a:r></a:p>`).join("")}
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:notes>`
      );
    }
  });

  return zip.generateAsync({ type: "nodebuffer" });
}

function createMinimalXlsxBuffer(sheetMap = {
  Summary: [
    ["Metric", "Value"],
    ["Pressure", "60 psi"],
  ],
}) {
  const workbook = XLSX.utils.book_new();

  for (const [sheetName, rows] of Object.entries(sheetMap)) {
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  }

  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
}

function createDelimitedBuffer(rows, delimiter) {
  return Buffer.from(rows.map((row) => row.join(delimiter)).join("\n"), "utf8");
}

function createMinimalCsvBuffer(rows = [
  ["Metric", "Value"],
  ["Pressure", "60 psi"],
]) {
  return createDelimitedBuffer(rows, ",");
}

function createMinimalTsvBuffer(rows = [
  ["Metric", "Value"],
  ["Pressure", "60 psi"],
]) {
  return createDelimitedBuffer(rows, "\t");
}

const failures = [];
let completed = 0;

async function runTest(name, fn) {
  try {
    await fn();
    completed += 1;
    console.log(`ok - ${name}`);
  } catch (error) {
    failures.push({ name, error });
    console.error(`not ok - ${name}`);
    console.error(error instanceof Error ? error.stack ?? error.message : error);
  }
}

await runTest("uses supported thread documents and preserves the higher-authority note", async () => {
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async () => [makeDocument()],
      readTextFile: async () => "# Incident Notes\n\nKeep the cooling loop under 60 psi.",
    }
  );

  assert.equal(bundle.sources.length, 1);
  assert.equal(bundle.sources[0].status, "used");
  assert.match(bundle.text, /## Thread-Attached Documents \(Current Conversation Only\)/);
  assert.match(bundle.text, /Recent thread messages and the user's current request remain higher authority\./);
  assert.ok(bundle.text.indexOf("Recent thread messages") < bundle.text.indexOf("## Thread Document: notes.md"));
});

await runTest("adds a parallel debug trace without changing the resolver-owned document chunking payload", async () => {
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1", currentUserPrompt: "Summarize the cooling loop note." },
    {
      listDocuments: async () => [makeDocument()],
      readTextFile: async () => "# Incident Notes\n\nKeep the cooling loop under 60 psi.",
    }
  );

  assert.ok(bundle.debugTrace);
  assert.equal(bundle.debugTrace.conversationId, "thread-1");
  assert.equal(bundle.debugTrace.documents.length, bundle.documentChunking.documents.length);
  assert.deepEqual(
    bundle.debugTrace.documents[0]?.selectedChunkIds,
    bundle.documentChunking.documents[0]?.selectedChunkIndexes.map(
      (chunkIndex) => `${bundle.documentChunking.documents[0]?.sourceId}:${chunkIndex}`
    )
  );
  assert.equal(bundle.debugTrace.renderedContext.text, null);
  assert.match(bundle.text, /Keep the cooling loop under 60 psi\./);
});

await runTest("accepts core image attachments in upload metadata", async () => {
  assert.match(CONVERSATION_DOCUMENT_ACCEPT, /\.png/);
  assert.match(CONVERSATION_DOCUMENT_ACCEPT, /\.jpg/);
  assert.match(CONVERSATION_DOCUMENT_ACCEPT, /\.jpeg/);
  assert.match(CONVERSATION_DOCUMENT_ACCEPT, /\.webp/);

  assert.deepEqual(
    resolveConversationDocumentMetadata({ name: "photo.png", type: "" }),
    {
      extension: "png",
      fileType: "image",
      mimeType: "image/png",
    }
  );
  assert.deepEqual(
    resolveConversationDocumentMetadata({ name: "camera.jpg", type: "" }),
    {
      extension: "jpg",
      fileType: "image",
      mimeType: "image/jpeg",
    }
  );
  assert.equal(validateConversationDocument({ name: "inspection.webp", size: 1024, type: "" }), null);
});

await runTest("marks unsupported files explicitly", async () => {
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async () => [makeDocument({ filename: "drawing.doc", mimeType: "application/msword", fileType: "document" })],
      readTextFile: async () => "",
    }
  );

  assert.equal(bundle.sources.length, 1);
  assert.equal(bundle.sources[0].status, "unsupported");
  assert.deepEqual(bundle.documentChunking.documents[0], {
    sourceId: "doc-1",
    attachmentId: "doc-1",
    fileId: "doc-1",
    filename: "drawing.doc",
    sourceType: "document",
    parentSourceStatus: "unsupported",
    extractionStatus: "unsupported",
    totalChunks: 0,
    selectedChunkIndexes: [],
    skippedChunkIndexes: [],
    selectedApproxTokenCount: 0,
    totalApproxTokenCount: 0,
    selectedCharCount: 0,
    totalCharCount: 0,
    documentBudgetTokens: null,
    selectionMode: null,
    selectionBudgetKind: null,
    selectionBudgetChars: null,
    selectionBudgetTokens: null,
    usedBudgetClamp: false,
    coverageSelectionApplied: false,
    skippedDueToBudgetCount: 0,
    rankingEnabled: false,
    rankingQueryTokenCount: 0,
    rankingStrategy: DEFAULT_DOCUMENT_CHUNK_RANKING_STRATEGY,
    rankingFallbackReason: null,
    occurrenceIntentDetected: false,
    occurrenceTargetPhrase: null,
    occurrence: {
      searchStatus: "not_requested",
      targetPhrase: null,
      scannedChunkCount: 0,
      exactMatchChunkCount: 0,
      exactMatchLocationCount: 0,
      exactMatchChunkIndexes: [],
      selectedRepresentativeChunkIndexes: [],
      skippedDueToBudgetChunkIndexes: [],
      locations: [],
      detail: null,
    },
    chunkCharRanges: [],
  });
  assert.match(bundle.text, /Thread Document Availability/);
  assert.match(bundle.text, /supports only plain text, markdown, PDF, DOCX, PPTX, XLSX, CSV, TSV, and baseline PNG\/JPG\/JPEG\/WEBP image attachment handling/i);
});

await runTest("marks image attachments as unavailable when the current runtime cannot consume image inputs", async () => {
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async () => [
        makeDocument({
          filename: "inspection.png",
          mimeType: "image/png",
          fileType: "image",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\inspection.png",
        }),
      ],
      readTextFile: async () => "",
    }
  );

  assert.equal(bundle.sources.length, 1);
  assert.equal(bundle.sources[0].status, "unavailable");
  assert.equal(bundle.documentChunking.documents[0]?.parentSourceStatus, "unavailable");
  assert.equal(bundle.documentChunking.documents[0]?.extractionStatus, "unavailable");
  assert.match(bundle.sources[0].detail, /does not yet load image attachments into the active model context/i);
  assert.match(bundle.text, /inspection\.png: Attached to this thread, but the current Team Chat runtime does not yet load image attachments into the active model context\./i);
  assert.match(bundle.summarySources[0].description, /1 unavailable/);
  assert.deepEqual(findSourceDecision(bundle, "thread_documents")?.execution.summary, {
    totalCount: 1,
    usedCount: 0,
    unsupportedCount: 0,
    failedCount: 0,
    unavailableCount: 1,
    excludedCategories: ["availability"],
  });
});

await runTest("uses supported PDF attachments when extraction succeeds", async () => {
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async () => [
        makeDocument({
          filename: "manual.pdf",
          mimeType: "application/pdf",
          fileType: "pdf",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\manual.pdf",
        }),
      ],
      readBinaryFile: async () => createMinimalPdfBuffer("Pressure limit is 60 psi."),
    }
  );

  assert.equal(bundle.sources.length, 1);
  assert.equal(bundle.sources[0].status, "used");
  assert.match(bundle.sources[0].detail, /Read .* readable characters from this thread attachment/);
  assert.match(bundle.text, /Thread Document: manual\.pdf/);
  assert.match(bundle.text, /Pressure limit is 60 psi\./);
});

await runTest("extracts PDFs successfully even when no pdf.js worker global is preloaded", async () => {
  const previousPdfJsWorker = globalThis.pdfjsWorker;

  try {
    delete globalThis.pdfjsWorker;

    const bundle = await resolveConversationContextBundle(
      { conversationId: "thread-1" },
      {
        listDocuments: async () => [
          makeDocument({
            filename: "runtime.pdf",
            mimeType: "application/pdf",
            fileType: "pdf",
            storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\runtime.pdf",
          }),
        ],
        readBinaryFile: async () => createMinimalPdfBuffer("Runtime-safe PDF text."),
      }
    );

    assert.equal(bundle.sources.length, 1);
    assert.equal(bundle.sources[0].status, "used");
    assert.match(bundle.text, /Runtime-safe PDF text\./);
  } finally {
    if (previousPdfJsWorker === undefined) {
      delete globalThis.pdfjsWorker;
    } else {
      globalThis.pdfjsWorker = previousPdfJsWorker;
    }
  }
});

await runTest("marks failed PDF extraction explicitly", async () => {
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async () => [
        makeDocument({
          filename: "broken.pdf",
          mimeType: "application/pdf",
          fileType: "pdf",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\broken.pdf",
        }),
      ],
      readBinaryFile: async () => Buffer.from("%PDF-1.4\nthis is not a valid pdf", "utf8"),
    }
  );

  assert.equal(bundle.sources.length, 1);
  assert.equal(bundle.sources[0].status, "failed");
  assert.equal(bundle.documentChunking.documents[0]?.parentSourceStatus, "failed");
  assert.equal(bundle.documentChunking.documents[0]?.extractionStatus, "failed");
  assert.match(bundle.sources[0].detail, /PDF parser failed before usable text could be extracted/);
  assert.match(bundle.text, /PDF parser failed before usable text could be extracted/);
});

await runTest("explains when a PDF parses but returns no readable text", async () => {
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async () => [
        makeDocument({
          filename: "scanned.pdf",
          mimeType: "application/pdf",
          fileType: "pdf",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\scanned.pdf",
        }),
      ],
      readBinaryFile: async () => Buffer.from("%PDF-1.4\nscanned fixture", "utf8"),
      extractPdfText: async () => "   \n\n",
    }
  );

  assert.equal(bundle.sources.length, 1);
  assert.equal(bundle.sources[0].status, "failed");
  assert.match(bundle.sources[0].detail, /PDF parser returned no readable text/);
  assert.match(bundle.sources[0].detail, /image-based\/scanned|unsupported text layer/);
});

await runTest("preserves page-aware PDF provenance, partial extraction detail, and PDF debug metadata", async () => {
  const bundle = await resolveConversationContextBundle(
    {
      conversationId: "thread-1",
      currentUserPrompt: "What does the attachment on page 2 say about contractor rates?",
    },
    {
      listDocuments: async () => [
        makeDocument({
          id: "doc-page-aware",
          filename: "rates.pdf",
          mimeType: "application/pdf",
          fileType: "pdf",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\rates.pdf",
        }),
      ],
      readBinaryFile: async () => Buffer.from("%PDF-1.4\npage-aware fixture", "utf8"),
      extractPdfText: async () =>
        buildPdfContextExtractionResult(getPageAwarePdfExtractionFixture()),
    }
  );

  assert.equal(bundle.sources[0].status, "used");
  assert.match(bundle.sources[0].detail, /Extracted readable text from 2 of 3 PDF pages/i);
  assert.match(bundle.sources[0].detail, /OCR is not implemented/i);
  const pageAwareChunkLabel = bundle.documentChunking.documents[0]?.chunkCharRanges.find(
    (chunk) => chunk.pageNumberStart === 2
  )?.sourceBodyLocationLabel;
  assert.match(pageAwareChunkLabel ?? "", /rates\.pdf.*page A-1.*Appendix A.*Attachment 1/i);
  assert.match(bundle.text, /SOURCE BODY LOCATION: rates\.pdf — page A-1 — Table 1/i);
  assert.equal(bundle.documentChunking.documents[0]?.extractionDetail?.includes("partial page-aware provenance"), true);
  assert.equal(bundle.documentChunking.documents[0]?.sourceMetadata?.detectedTableCount, 1);
  assert.deepEqual(bundle.documentChunking.documents[0]?.sourceMetadata?.lowTextPageNumbers, [3]);
  assert.equal(bundle.debugTrace?.documents[0]?.metadata?.detectedTableCount, 1);
  assert.equal(bundle.debugTrace?.chunks.some((chunk) => chunk.provenance.sourceBodyLocation.pageNumber === 2), true);
});

await runTest("classifies T5 deck table and visual excerpts without inventing fake repeated tables", async () => {
  const expectations = getT5DeckExpectations();
  const bundle = await resolveConversationContextBundle(
    {
      conversationId: "thread-1",
      currentUserPrompt: expectations.tableQuery,
    },
    {
      listDocuments: async () => [
        makeDocument({
          id: expectations.sourceId,
          filename: expectations.filename,
          mimeType: "application/pdf",
          fileType: "pdf",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\t5.pdf",
        }),
      ],
      readBinaryFile: async () => Buffer.from("%PDF-1.4\nt5 fixture", "utf8"),
      extractPdfText: async () =>
        buildPdfContextExtractionResult(getT5DeckPdfExtractionFixture()),
    }
  );

  assert.equal(bundle.sources[0].status, "used");
  assert.equal(
    bundle.documentChunking.documents[0].chunkCharRanges.some((chunk) => chunk.pageNumberStart === 15),
    true
  );
  assert.equal(
    bundle.documentChunking.documents[0].chunkCharRanges.some((chunk) => chunk.pageNumberStart === 18),
    true
  );
  assert.equal(
    bundle.documentChunking.documents[0].chunkCharRanges.some(
      (chunk) =>
        chunk.pageNumberStart != null &&
        chunk.pageNumberStart >= 9 &&
        chunk.pageNumberStart <= 13 &&
        chunk.tableId != null
    ),
    false
  );
  assert.match(bundle.text, /Smackover Water Chemistry/i);
  assert.match(bundle.text, /PDF STRUCTURE CLASSIFICATION: probable true data table/i);
  assert.match(bundle.text, /PDF STRUCTURE CLASSIFICATION: table-like schedule\/timeline visual/i);
  assert.equal(bundle.documentChunking.documents[0].sourceMetadata?.classificationCounts?.true_table, 1);
  assert.equal(bundle.debugTrace?.documents[0]?.metadata?.pageStructures?.find((page) => page.pageNumber === 15)?.primaryClassification, "true_table");
});

await runTest("creates durable T5 page 15 table artifacts and preserves sparse extraction warnings", async () => {
  const expectations = getT5DeckExpectations();
  const intelligenceMemory = createDocumentIntelligenceMemory();
  const bundle = await resolveConversationContextBundle(
    {
      conversationId: "thread-1",
      currentUserPrompt: expectations.tableQuery,
    },
    {
      listDocuments: async () => [
        makeDocument({
          id: expectations.sourceId,
          filename: expectations.filename,
          mimeType: "application/pdf",
          fileType: "pdf",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\t5.pdf",
        }),
      ],
      readBinaryFile: async () => Buffer.from("%PDF-1.4\nt5 fixture", "utf8"),
      extractPdfText: async () =>
        buildPdfContextExtractionResult(getT5DeckPdfExtractionFixture()),
      ...intelligenceMemory.dependencies,
    }
  );

  assert.equal(
    intelligenceMemory.knowledgeArtifacts.some(
      (artifact) =>
        artifact.conversationDocumentId === expectations.sourceId &&
        artifact.artifactKey === "table_candidate:15" &&
        artifact.kind === "table_candidate"
    ),
    true
  );
  assert.equal(
    intelligenceMemory.knowledgeArtifacts.some(
      (artifact) =>
        artifact.conversationDocumentId === expectations.sourceId &&
        artifact.artifactKey === "extraction_warning:15:table_body_missing" &&
        artifact.kind === "extraction_warning"
    ),
    true
  );
  const storedInspectionTask = intelligenceMemory.inspectionTasks.find(
    (task) =>
      task.conversationDocumentId === expectations.sourceId &&
      task.taskKey === "inspect_table_candidate:15"
  );
  assert.ok(storedInspectionTask);
  const storedInspectionResult = JSON.parse(storedInspectionTask.resultJson);
  assert.equal(storedInspectionResult.toolTrace.requestedCapability, "pdf_table_detection");
  assert.equal(storedInspectionResult.toolTrace.selectedTool, "pdf_table_candidate_detection");
  assert.equal(storedInspectionResult.toolTrace.approvalStatus, "built_in");
  assert.equal(storedInspectionResult.toolTrace.runtimeClass, "local");
  assert.equal(storedInspectionResult.toolTrace.sideEffectLevel, "creates_internal_artifact");
  assert.equal(
    storedInspectionResult.toolTrace.benchmarkFixtureIds.includes("t5_pdf_page_15_visible_table"),
    true
  );
  assert.equal(storedInspectionResult.toolTrace.recommendedNextCapabilities.includes("ocr"), true);
  assert.equal(storedInspectionResult.toolTrace.executedUnapprovedTool, false);
  assert.equal(bundle.documentIntelligence.documents[0]?.state.stateStatus, "partial");
  assert.equal(bundle.documentIntelligence.documents[0]?.state.warningArtifactCount, 1);
  assert.equal(
    bundle.documentIntelligence.documents[0]?.artifacts.some(
      (artifact) => artifact.artifactKey === "table_candidate:15" && artifact.selected
    ),
    true
  );
  assert.match(bundle.text, /### Learned Artifacts/);
  assert.match(bundle.text, /Likely table detected on page 15/i);
  assert.match(bundle.text, /Do not infer missing columns, cell values, or headers/i);
  assert.doesNotMatch(bundle.text, /\bSodium\b|\bChloride\b|\bCalcium\b/i);
  assert.equal(
    bundle.debugTrace?.knowledgeArtifacts.some((artifact) => artifact.kind === "table_candidate"),
    true
  );
  assert.equal(
    bundle.debugTrace?.inspections.some((inspection) => inspection.kind === "inspect_table"),
    true
  );
  const traceInspection = bundle.debugTrace?.inspections.find(
    (inspection) => inspection.metadata?.taskKey === "inspect_table_candidate:15"
  );
  assert.equal(traceInspection?.requestedCapability, "pdf_table_detection");
  assert.equal(traceInspection?.selectedTool, "pdf_table_candidate_detection");
  assert.equal(traceInspection?.approvalStatus, "built_in");
  assert.equal(traceInspection?.runtimeClass, "local");
  assert.equal(traceInspection?.governanceTrace?.selectedTool, "pdf_table_candidate_detection");
  assert.equal(traceInspection?.recommendedNextCapabilities.includes("vision_page_understanding"), true);
  assert.equal(bundle.progressiveAssembly.plan.passes[0]?.name, "artifact_reuse");
  assert.equal(
    bundle.progressiveAssembly.passResults
      .find((pass) => pass.pass.name === "artifact_reuse")
      ?.reusedArtifactIds.some((artifactId) => artifactId.includes("table_candidate:15")),
    true
  );
  assert.equal(
    bundle.progressiveAssembly.gaps.some((gap) => gap.kind === "missing_table_body"),
    true
  );
  assert.equal(
    ["sufficient_with_limitations", "insufficient_needs_approval", "insufficient_needs_async"].includes(
      bundle.progressiveAssembly.sufficiency.status
    ),
    true
  );
});

await runTest("reuses stored artifacts ahead of weaker raw parser text for follow-up T5 table questions", async () => {
  const expectations = getT5DeckExpectations();
  const intelligenceMemory = createDocumentIntelligenceMemory();
  const dependencies = {
    listDocuments: async () => [
      makeDocument({
        id: expectations.sourceId,
        filename: expectations.filename,
        mimeType: "application/pdf",
        fileType: "pdf",
        storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\t5.pdf",
      }),
    ],
    readBinaryFile: async () => Buffer.from("%PDF-1.4\nt5 fixture", "utf8"),
    extractPdfText: async () =>
      buildPdfContextExtractionResult(getT5DeckPdfExtractionFixture()),
    ...intelligenceMemory.dependencies,
  };

  await resolveConversationContextBundle(
    {
      conversationId: "thread-1",
      currentUserPrompt: expectations.tableQuery,
    },
    dependencies
  );

  const artifactCountAfterFirstPass = intelligenceMemory.knowledgeArtifacts.length;
  const followUpBundle = await resolveConversationContextBundle(
    {
      conversationId: "thread-1",
      currentUserPrompt: "What do we already know about the water chemistry table on page 15?",
    },
    dependencies
  );

  assert.equal(intelligenceMemory.knowledgeArtifacts.length, artifactCountAfterFirstPass);
  assert.equal(
    followUpBundle.documentIntelligence.documents[0]?.state.selectedArtifactKeys.includes("table_candidate:15"),
    true
  );
  assert.equal(
    followUpBundle.documentIntelligence.selectedArtifactKeys.includes("table_candidate:15"),
    true
  );
  const selectedTableArtifact = followUpBundle.documentIntelligence.documents[0]?.artifacts.find(
    (artifact) => artifact.artifactKey === "table_candidate:15"
  );
  assert.equal(selectedTableArtifact?.selected, true);
  assert.equal(selectedTableArtifact?.tool, "pdf_table_candidate_detection");
  assert.equal(
    followUpBundle.text.indexOf("### Learned Artifacts") >= 0 &&
      followUpBundle.text.indexOf("### Excerpt 1") >= 0 &&
      followUpBundle.text.indexOf("### Learned Artifacts") < followUpBundle.text.indexOf("### Excerpt 1"),
    true
  );
  assert.equal(
    followUpBundle.progressiveAssembly.packingResults[0]?.selectedCandidates.some(
      (candidate) => candidate.metadata?.artifactKey === "table_candidate:15"
    ),
    true
  );
  assert.equal(
    followUpBundle.progressiveAssembly.expandedContextBundle.selectedCandidates[0]?.kind,
    "artifact"
  );
  assert.match(followUpBundle.text, /Smackover Water Chemistry/i);
  assert.match(followUpBundle.text, /Probable true data table detected on page 15/i);
});

await runTest("uses supported DOCX attachments when extraction succeeds", async () => {
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async () => [
        makeDocument({
          filename: "manual.docx",
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          fileType: "document",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\manual.docx",
        }),
      ],
      readBinaryFile: async () => createMinimalDocxBuffer("DOCX operating context."),
    }
  );

  assert.equal(bundle.sources.length, 1);
  assert.equal(bundle.sources[0].status, "used");
  assert.match(bundle.text, /Thread Document: manual\.docx/);
  assert.match(bundle.text, /DOCX operating context\./);
});

await runTest("splits long thread documents into ordered chunk excerpts with debug metadata", async () => {
  const repeatedSection = Array.from(
    { length: 48 },
    (_, index) => `Cooling loop ${index + 1} stayed stable overnight but still needs inspection before restart.`
  ).join(" ");
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async () => [makeDocument()],
      readTextFile: async () =>
        [
          "# Incident Overview",
          repeatedSection,
          "## Root Cause",
          repeatedSection,
          "## Mitigation",
          repeatedSection,
        ].join("\n\n"),
    }
  );

  assert.equal(bundle.sources[0].status, "used");
  assert.match(bundle.sources[0].detail, /included selected excerpts/i);
  assert.match(bundle.text, /Only selected excerpts from this attachment are available below in the current runtime context\./);
  assert.match(bundle.text, /Base your answer on the excerpts available here/i);
  assert.doesNotMatch(bundle.text, /need the full pdf/i);
  assert.match(bundle.text, /### Excerpt 1/);
  assert.match(bundle.text, /SOURCE BODY LOCATION: notes\.md — Incident Overview/);
  assert.match(bundle.text, /TEXT:/);
  assert.equal(bundle.documentChunking.strategy, DEFAULT_DOCUMENT_CHUNK_STRATEGY);
  assert.ok(bundle.documentChunking.documents[0].totalChunks > 1);
  assert.equal(bundle.documentChunking.documents[0].rankingEnabled, false);
  assert.equal(bundle.documentChunking.documents[0].rankingFallbackReason, "empty_query");
  assert.equal(bundle.documentChunking.documents[0].selectionMode, "document-order");
  assert.deepEqual(
    bundle.documentChunking.documents[0].selectedChunkIndexes,
    [...bundle.documentChunking.documents[0].selectedChunkIndexes].sort((left, right) => left - right)
  );
  assert.ok(
    bundle.documentChunking.documents[0].chunkCharRanges.every((chunk, index, all) =>
      index === 0 || chunk.charStart >= all[index - 1].charEnd
    )
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(bundle.documentChunking.documents[0].chunkCharRanges[0], "text"),
    false
  );
});

await runTest("uses location unclear only when a selected excerpt has no detected body heading metadata", async () => {
  const repeatedParagraph = Array.from(
    { length: 60 },
    (_, index) => `Plain paragraph ${index + 1} references the joint account but provides no explicit article or section heading.`
  ).join(" ");
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async () => [makeDocument({ filename: "plain-notes.txt", mimeType: "text/plain", fileType: "text" })],
      readTextFile: async () => repeatedParagraph,
    }
  );

  assert.match(bundle.text, /SOURCE BODY LOCATION: plain-notes\.txt — location unclear in excerpt provenance/);
  assert.ok(
    bundle.documentChunking.documents[0].chunkCharRanges.every((chunk) =>
      chunk.sectionPath.length === 0 ? /location unclear/i.test(chunk.sourceBodyLocationLabel) : true
    )
  );
});

await runTest("ranks a later relevant section ahead of earlier filler when the current user prompt has signal", async () => {
  const filler = Array.from(
    { length: 70 },
    (_, index) => `General operations note ${index + 1} covers staffing rotations, startup checks, and shift handoff detail.`
  ).join(" ");
  const relevant = Array.from(
    { length: 36 },
    (_, index) => `Relief assembly root cause note ${index + 1} links the compressor trip to maintenance backlog and valve scoring.`
  ).join(" ");
  const bundle = await resolveConversationContextBundle(
    {
      conversationId: "thread-1",
      currentUserPrompt: "root cause relief assembly maintenance backlog",
    },
    {
      listDocuments: async () => [makeDocument()],
      readTextFile: async () =>
        [
          "# Overview",
          filler,
          "## Root Cause",
          relevant,
          "## Follow-up",
          filler,
        ].join("\n\n"),
    }
  );

  assert.equal(bundle.sources[0].status, "used");
  assert.match(bundle.text, /Relief assembly root cause note/i);
  assert.equal(bundle.documentChunking.documents[0].rankingEnabled, true);
  assert.equal(bundle.documentChunking.documents[0].rankingStrategy, DEFAULT_DOCUMENT_CHUNK_RANKING_STRATEGY);
  assert.equal(bundle.documentChunking.documents[0].rankingFallbackReason, null);
  assert.equal(bundle.documentChunking.documents[0].selectionMode, "ranked-order");
  assert.ok(bundle.documentChunking.documents[0].rankingQueryTokenCount > 0);
  assert.ok(bundle.documentChunking.documents[0].selectedChunkIndexes[0] > 0);
  assert.ok(
    bundle.documentChunking.documents[0].chunkCharRanges.some((chunk) =>
      chunk.rankingSignals.includes("section_match") || chunk.rankingSignals.includes("phrase_overlap")
    )
  );
});

await runTest("keeps late article definition and audit excerpts for occurrence-style prompts", async () => {
  const articleVd = Array.from(
    { length: 3 },
    () => "The Operator shall discharge Joint Account obligations in accordance with Exhibit C and provide monthly support."
  ).join(" ");
  const articleViif = Array.from(
    { length: 3 },
    () => "Taxes charged through the Joint Account shall be allocated as provided in Exhibit C and supported through Joint Account records."
  ).join(" ");
  const articleXviOne = Array.from(
    { length: 4 },
    () => "Existing Operator-owned equipment shall not be charged to the Joint Account unless agreed in writing."
  ).join(" ");
  const articleXviDefinition = Array.from(
    { length: 4 },
    () => "The term Joint Account means the shared project cost ledger, and the Joint Account records charge allocations."
  ).join(" ");
  const articleXviFees = Array.from(
    { length: 4 },
    () => "Project Fees shall be charged to the Joint Account in the amount of $20,000 per month unless revised in writing."
  ).join(" ");
  const articleXviAudit = Array.from(
    { length: 4 },
    () => "Each Non-Operator may audit the Joint Account and inspect Joint Account entries, support, and project fee backup."
  ).join(" ");
  const realisticLegalAgreementContextText = [
    "TABLE OF CONTENTS",
    "Article V — Operator & Managing Partner ........ 9",
    "Article VII — Expenditures and Liability of Parties ........ 13",
    "Article XV — Miscellaneous ........ 17",
    "Article XVI — Other Provisions ........ 18",
    "Exhibit C — Accounting Procedure ........ 25",
    "Exhibit D — Insurance ........ 26",
    "ARTICLE V.",
    "OPERATOR & MANAGING PARTNER",
    "D. Rights and Duties of Operator",
    "1. Competitive Rates and Use of Affiliates: Operator may use affiliates at competitive rates.",
    `2. Discharge of Joint Account Obligations: ${articleVd}`,
    "3. Protection from Liens: Operations shall be protected from liens incurred during operations.",
    "5. Access to Contract Area and Records: Each Non-Operator may inspect support concerning Contract Area access and records.",
    "8. Cost Estimates: Upon written request, Operator shall furnish estimates of current and cumulative costs incurred for the joint account.",
    "9. Insurance: Operator shall maintain insurance and may charge insurance premiums to the joint account where allowed.",
    "ARTICLE VII.",
    "EXPENDITURES AND LIABILITY OF PARTIES",
    "F. Taxes",
    articleViif,
    "-- 15 of 22 --",
    "-13-",
    "ARTICLE XV.",
    "MISCELLANEOUS",
    "This article covers unrelated general provisions only and does not define the joint account.",
    "ARTICLE XVI.",
    "OTHER PROVISIONS",
    `1. ${articleXviOne}`,
    `2. ${articleXviDefinition}`,
    `4. ${articleXviFees}`,
    `5. ${articleXviAudit}`,
  ].join("\n");
  const bundle = await resolveConversationContextBundle(
    {
      conversationId: "thread-1",
      currentUserPrompt: "Summarize what articles the joint account appears in",
    },
    {
      listDocuments: async () => [
        makeDocument({
          filename: "Incendium - Joint Operating Agreement [Final].pdf",
          mimeType: "application/pdf",
          fileType: "pdf",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\joa.pdf",
        }),
      ],
      readTextFile: async () => "",
      readBinaryFile: async () => Buffer.from("joa fixture", "utf8"),
      extractPdfText: async () => realisticLegalAgreementContextText,
    }
  );

  assert.equal(bundle.sources[0].status, "used");
  assert.match(bundle.text, /SOURCE BODY LOCATION: Incendium - Joint Operating Agreement \[Final\]\.pdf — Article V — OPERATOR & MANAGING PARTNER — Article V\.D — Rights and Duties of Operator — Article V\.D\.2/i);
  assert.match(bundle.text, /SOURCE BODY LOCATION: Incendium - Joint Operating Agreement \[Final\]\.pdf — Article V — OPERATOR & MANAGING PARTNER — Article V\.D — Rights and Duties of Operator — Article V\.D\.8/i);
  assert.match(bundle.text, /SOURCE BODY LOCATION: Incendium - Joint Operating Agreement \[Final\]\.pdf — Article V — OPERATOR & MANAGING PARTNER — Article V\.D — Rights and Duties of Operator — Article V\.D\.9/i);
  assert.match(bundle.text, /SOURCE BODY LOCATION: Incendium - Joint Operating Agreement \[Final\]\.pdf — Article VII — EXPENDITURES AND LIABILITY OF PARTIES — Article VII\.F/i);
  assert.match(bundle.text, /SOURCE BODY LOCATION: Incendium - Joint Operating Agreement \[Final\]\.pdf — Article XVI/i);
  assert.match(bundle.text, /Article XVI — OTHER PROVISIONS/i);
  assert.match(bundle.text, /Article XVI\.1/i);
  assert.match(bundle.text, /Article XVI\.2/i);
  assert.match(bundle.text, /Article XVI\.4/i);
  assert.match(bundle.text, /Article XVI\.5/i);
  assert.match(bundle.text, /## Thread Document Occurrence Scan/i);
  assert.match(bundle.text, /### Occurrence Inventory/i);
  assert.match(
    bundle.text,
    new RegExp(
      `The occurrence inventory below was built by scanning ${bundle.documentChunking.occurrence?.scannedChunkCount ?? 0} successfully extracted chunks across 1 searchable attachment`,
      "i"
    )
  );
  assert.match(bundle.text, /Treat it as the authoritative scan over the successfully extracted contents of those searchable attached files/i);
  assert.match(bundle.text, /If you caveat the answer, describe it as based on the successfully extracted contents of the attached file in this scan, not only on selected excerpts/i);
  assert.match(bundle.text, /For this occurrence\/listing request, answer as a list of SOURCE BODY LOCATION labels/i);
  assert.doesNotMatch(bundle.text, /Ctrl\+F/i);
  assert.doesNotMatch(bundle.text, /re-upload/i);
  assert.doesNotMatch(bundle.text, /excerpted portions/i);
  assert.match(bundle.text, /REFERENCES MENTIONED IN TEXT \(referenced only; not the body location\): Exhibit C/i);
  assert.doesNotMatch(bundle.text, /SOURCE BODY LOCATION: .*location unclear/i);
  assert.doesNotMatch(bundle.text, /SOURCE BODY LOCATION: .*Article V\.B/i);
  assert.doesNotMatch(bundle.text, /SOURCE BODY LOCATION: .*Article VII\.B/i);
  assert.doesNotMatch(bundle.text, /SOURCE BODY LOCATION: .*Article VII\.D/i);
  assert.doesNotMatch(bundle.text, /SOURCE BODY LOCATION: .*Article XV\b/i);
  assert.doesNotMatch(bundle.text, /SOURCE BODY LOCATION: Incendium - Joint Operating Agreement \[Final\]\.pdf — Exhibit C/i);
  assert.doesNotMatch(bundle.text, /SOURCE BODY LOCATION: Incendium - Joint Operating Agreement \[Final\]\.pdf — Exhibit D/i);
  assert.doesNotMatch(bundle.text, /SOURCE BODY LOCATION: .*Article IV/i);
  assert.ok(bundle.text.indexOf("Article XVI.1") < bundle.text.indexOf("Article XVI.2"));
  assert.ok(bundle.text.indexOf("Article XVI.2") < bundle.text.indexOf("Article XVI.4"));
  assert.ok(bundle.text.indexOf("Article XVI.4") < bundle.text.indexOf("Article XVI.5"));
  assert.equal(bundle.documentChunking.documents[0].rankingEnabled, true);
  assert.equal(bundle.documentChunking.documents[0].occurrenceIntentDetected, true);
  assert.equal(bundle.documentChunking.documents[0].occurrenceTargetPhrase, "joint account");
  assert.equal(bundle.documentChunking.documents[0].occurrence.searchStatus, "searched");
  assert.ok(bundle.documentChunking.documents[0].occurrence.exactMatchLocationCount >= 4);
  assert.ok(bundle.documentChunking.documents[0].occurrence.locations.some((location) =>
    /Article XVI\.2/i.test(location.sourceBodyLocationLabel)
  ));
  assert.equal(bundle.documentChunking.documents[0].coverageSelectionApplied, true);
  assert.ok(
    bundle.documentChunking.documents[0].chunkCharRanges.some((chunk) =>
      /Article V\.D\.2/i.test(chunk.sectionLabel ?? "") &&
      chunk.referencedLocationLabels.includes("Exhibit C")
    )
  );
  assert.ok(
    bundle.documentChunking.documents[0].chunkCharRanges.some((chunk) =>
      /Article V\.D\.8/i.test(chunk.sourceBodyLocationLabel)
    )
  );
  assert.ok(
    bundle.documentChunking.documents[0].chunkCharRanges.some((chunk) =>
      /Article V\.D\.9/i.test(chunk.sourceBodyLocationLabel)
    )
  );
  assert.ok(
    bundle.documentChunking.documents[0].chunkCharRanges.some((chunk) =>
      /Article VII\.F/i.test(chunk.sectionLabel ?? "") &&
      chunk.referencedLocationLabels.includes("Exhibit C")
    )
  );
  assert.ok(
    bundle.documentChunking.documents[0].chunkCharRanges.some((chunk) =>
      /Article XVI\.2/i.test(chunk.sectionLabel ?? "") &&
      chunk.exactPhraseMatchCount >= 3 &&
      chunk.definitionBoostApplied &&
      /section:xvi\.2/i.test(chunk.coverageGroupKey ?? "")
    )
  );
  assert.ok(
    bundle.documentChunking.documents[0].chunkCharRanges.some((chunk) =>
      chunk.selectedDueToCoverage &&
      /section:xvi\.(1|4|5)/i.test(chunk.coverageGroupKey ?? "")
    )
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(bundle.documentChunking.documents[0].chunkCharRanges[0], "text"),
    false
  );
  assert.ok(
    bundle.documentChunking.documents[0].chunkCharRanges.some((chunk) =>
      /Article XVI\.2/i.test(chunk.sourceBodyLocationLabel) &&
      Array.isArray(chunk.sectionPath) &&
      chunk.sectionPath.length > 0
    )
  );
  assert.ok(
    bundle.documentChunking.documents[0].chunkCharRanges.every((chunk) =>
      typeof chunk.textPreview === "string" && chunk.textPreview.length <= 80
    )
  );
});

await runTest("keeps conservative fallback when no budget input is passed and expands selection in deep mode", async () => {
  const filler = Array.from(
    { length: 220 },
    (_, index) => `General operations note ${index + 1} covers staffing, handoff, and routine monitoring.`
  ).join(" ");
  const relevant = Array.from(
    { length: 220 },
    (_, index) => `Maintenance backlog risk ${index + 1} remains open because compressor restart depends on relief assembly verification and audit support.`
  ).join(" ");
  const largeDocument = [
    "# Overview",
    filler,
    "## Risk Register",
    relevant,
    "## Audit Follow-up",
    relevant,
    "## Appendix",
    filler,
  ].join("\n\n");

  const noBudgetBundle = await resolveConversationContextBundle(
    {
      conversationId: "thread-1",
      currentUserPrompt: "maintenance backlog risk relief assembly audit support",
    },
    {
      listDocuments: async () => [makeDocument()],
      readTextFile: async () => largeDocument,
    }
  );
  const standardBundle = await resolveConversationContextBundle(
    {
      conversationId: "thread-1",
      currentUserPrompt: "maintenance backlog risk relief assembly audit support",
      budget: {
        mode: "standard",
        lookup: {
          provider: "openai",
          protocol: "auto",
          model: "gpt-4.1",
        },
      },
    },
    {
      listDocuments: async () => [makeDocument()],
      readTextFile: async () => largeDocument,
    }
  );
  const deepBundle = await resolveConversationContextBundle(
    {
      conversationId: "thread-1",
      currentUserPrompt: "maintenance backlog risk relief assembly audit support",
      budget: {
        mode: "deep",
        lookup: {
          provider: "openai",
          protocol: "auto",
          model: "gpt-4.1",
        },
      },
    },
    {
      listDocuments: async () => [makeDocument()],
      readTextFile: async () => largeDocument,
    }
  );

  assert.equal(noBudgetBundle.documentChunking.budget.budgetInputProvided, false);
  assert.equal(noBudgetBundle.debugTrace?.budgetProfile, null);
  assert.equal(standardBundle.documentChunking.budget.budgetInputProvided, true);
  assert.equal(standardBundle.documentChunking.budget.mode, "standard");
  assert.equal(deepBundle.documentChunking.budget.mode, "deep");
  assert.ok(
    (deepBundle.documentChunking.budget.documentContextBudgetTokens ?? 0) >
      (standardBundle.documentChunking.budget.documentContextBudgetTokens ?? 0)
  );
  assert.ok(
    deepBundle.documentChunking.documents[0].selectedApproxTokenCount >=
      standardBundle.documentChunking.documents[0].selectedApproxTokenCount
  );
  assert.ok(
    standardBundle.documentChunking.documents[0].selectedChunkIndexes.length >=
      noBudgetBundle.documentChunking.documents[0].selectedChunkIndexes.length
  );
  assert.match(standardBundle.text, /Maintenance backlog risk/i);
  assert.match(deepBundle.text, /Maintenance backlog risk/i);
});

await runTest("builds a complete occurrence inventory before excerpt budgeting", async () => {
  const articleI = Array.from(
    { length: 80 },
    () => "General startup provisions cover personnel coordination and routine scheduling."
  ).join(" ");
  const articleV = Array.from(
    { length: 60 },
    () => "The Operator shall discharge Joint Account obligations in accordance with Exhibit C."
  ).join(" ");
  const articleXviDefinition = Array.from(
    { length: 60 },
    () => "The term Joint Account means the shared project cost ledger."
  ).join(" ");
  const articleXviAudit = Array.from(
    { length: 60 },
    () => "Each Party may audit the Joint Account and inspect Joint Account support."
  ).join(" ");
  const occurrenceDocument = [
    "ARTICLE I.",
    "GENERAL",
    articleI,
    "ARTICLE V.",
    "OPERATOR",
    `2. ${articleV}`,
    "ARTICLE XVI.",
    "OTHER PROVISIONS",
    `2. ${articleXviDefinition}`,
    `5. ${articleXviAudit}`,
  ].join("\n\n");

  const bundle = await resolveConversationContextBundle(
    {
      conversationId: "thread-1",
      currentUserPrompt: "What articles does joint account appear in",
      budget: {
        mode: "standard",
        lookup: {
          provider: "local",
          protocol: "ollama",
          model: "llama3.2",
        },
        documentContextBudgetTokens: 10,
      },
    },
    {
      listDocuments: async () => [
        makeDocument({
          filename: "joa.pdf",
          mimeType: "application/pdf",
          fileType: "pdf",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\joa.pdf",
        }),
      ],
      readTextFile: async () => "",
      readBinaryFile: async () => Buffer.from("occurrence fixture", "utf8"),
      extractPdfText: async () => occurrenceDocument,
    }
  );

  assert.equal(bundle.documentChunking.documents[0].occurrence.searchStatus, "searched");
  assert.ok(bundle.documentChunking.documents[0].occurrence.locations.length >= 3);
  assert.ok(
    bundle.documentChunking.documents[0].occurrence.locations.some((location) =>
      /Article XVI\.5/i.test(location.sourceBodyLocationLabel)
    )
  );
  assert.ok(
    !bundle.documentChunking.documents[0].selectedChunkIndexes.includes(
      bundle.documentChunking.documents[0].occurrence.locations.find((location) =>
        /Article XVI\.5/i.test(location.sourceBodyLocationLabel)
      )?.chunkIndex ?? -1
    )
  );
  assert.match(bundle.text, /Occurrence Inventory/i);
  assert.match(bundle.text, /Article XVI\.5/i);
  assert.match(bundle.text, /Selected excerpts remain a runtime-budgeted subset/i);
  assert.match(bundle.text, /No explanatory excerpt from this attachment fit within the current runtime budget/i);
  assert.match(
    bundle.text,
    /Use the occurrence inventory above as the authoritative extracted-chunk scan result for this file's successfully extracted contents/i
  );
});

await runTest("marks unsearchable files as outside occurrence scan coverage", async () => {
  const occurrenceDocument = [
    "ARTICLE V.",
    "OPERATOR",
    "2. The Operator shall discharge Joint Account obligations in accordance with Exhibit C.",
    "ARTICLE XVI.",
    "OTHER PROVISIONS",
    "2. The term Joint Account means the shared project cost ledger.",
  ].join("\n\n");

  const bundle = await resolveConversationContextBundle(
    {
      conversationId: "thread-1",
      currentUserPrompt: "What articles does joint account appear in",
    },
    {
      listDocuments: async () => [
        makeDocument({
          id: "doc-pdf",
          filename: "joa.pdf",
          mimeType: "application/pdf",
          fileType: "pdf",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\joa.pdf",
        }),
        makeDocument({
          id: "doc-image",
          filename: "scan.png",
          mimeType: "image/png",
          fileType: "image",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\scan.png",
        }),
      ],
      readTextFile: async () => "",
      readBinaryFile: async () => Buffer.from("occurrence fixture", "utf8"),
      extractPdfText: async () => occurrenceDocument,
    }
  );

  assert.equal(
    bundle.documentChunking.documents.find((document) => document.sourceId === "doc-pdf")?.occurrence.searchStatus,
    "searched"
  );
  assert.equal(
    bundle.documentChunking.documents.find((document) => document.sourceId === "doc-image")?.occurrence.searchStatus,
    "not_searchable"
  );
  assert.equal(bundle.documentChunking.occurrence?.unsearchableDocuments.length, 1);
  assert.match(bundle.text, /Files that could not be searched in this runtime:/i);
  assert.match(bundle.text, /scan\.png: Attached to this thread, but the current Team Chat runtime does not yet load image attachments into the active model context\./i);
  assert.match(bundle.text, /Only the files listed above fall outside this occurrence scan coverage\./i);
});

await runTest("falls back to document-order chunk selection for low-signal prompts", async () => {
  const repeatedSection = Array.from(
    { length: 48 },
    (_, index) => `Cooling loop ${index + 1} stayed stable overnight but still needs inspection before restart.`
  ).join(" ");
  const bundle = await resolveConversationContextBundle(
    {
      conversationId: "thread-1",
      currentUserPrompt: "please help",
    },
    {
      listDocuments: async () => [makeDocument()],
      readTextFile: async () =>
        [
          "# Incident Overview",
          repeatedSection,
          "## Root Cause",
          repeatedSection,
          "## Mitigation",
          repeatedSection,
        ].join("\n\n"),
    }
  );

  assert.equal(bundle.documentChunking.documents[0].rankingEnabled, false);
  assert.equal(bundle.documentChunking.documents[0].rankingFallbackReason, "low_signal_query");
  assert.equal(bundle.documentChunking.documents[0].selectionMode, "document-order");
  assert.deepEqual(
    bundle.documentChunking.documents[0].selectedChunkIndexes,
    [...bundle.documentChunking.documents[0].selectedChunkIndexes].sort((left, right) => left - right)
  );
});

await runTest("uses supported PPTX attachments when extraction succeeds", async () => {
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async () => [
        makeDocument({
          filename: "briefing.pptx",
          mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          fileType: "document",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\briefing.pptx",
        }),
      ],
      readBinaryFile: async () => createMinimalPptxBuffer([
        {
          lines: ["Quarterly Update", "Revenue up 12%", "Maintenance backlog remains the top risk."],
          notes: ["Speaker note: tie backlog risk to the staffing request."],
        },
        {
          lines: ["Operations Plan", "Stabilize compressor uptime", "Reduce deferred maintenance by 15%"],
          notes: [],
        },
      ]),
    }
  );

  assert.equal(bundle.sources.length, 1);
  assert.equal(bundle.sources[0].status, "used");
  assert.match(bundle.text, /Thread Document: briefing\.pptx/);
  assert.match(bundle.text, /### Slide 1/);
  assert.match(bundle.text, /Content:/);
  assert.match(bundle.text, /- Quarterly Update/);
  assert.match(bundle.text, /Speaker notes:/);
  assert.match(bundle.text, /- Speaker note: tie backlog risk to the staffing request\./);
  assert.match(bundle.text, /### Slide 2/);
});

await runTest("marks failed PPTX extraction explicitly", async () => {
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async () => [
        makeDocument({
          filename: "broken.pptx",
          mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          fileType: "document",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\broken.pptx",
        }),
      ],
      readBinaryFile: async () => Buffer.from("not a real pptx", "utf8"),
      extractPptxText: async () => {
        throw new Error("PowerPoint package structure could not be parsed");
      },
    }
  );

  assert.equal(bundle.sources.length, 1);
  assert.equal(bundle.sources[0].status, "failed");
  assert.match(bundle.sources[0].detail, /PPTX parser failed before usable slide text could be extracted/i);
  assert.match(bundle.text, /PPTX parser failed before usable slide text could be extracted/i);
});

await runTest("explains when a PPTX parses but returns no readable slide text", async () => {
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async () => [
        makeDocument({
          filename: "visual-only.pptx",
          mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          fileType: "document",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\visual-only.pptx",
        }),
      ],
      readBinaryFile: async () => Buffer.from("pptx fixture", "utf8"),
      extractPptxText: async () => "   \n\n",
    }
  );

  assert.equal(bundle.sources.length, 1);
  assert.equal(bundle.sources[0].status, "failed");
  assert.match(bundle.sources[0].detail, /PPTX parser returned no readable slide text/);
  assert.match(bundle.sources[0].detail, /visuals, charts, or embedded media/);
});

await runTest("uses header-aware spreadsheet attachments when extraction succeeds", async () => {
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async () => [
        makeDocument({
          filename: "operations.xlsx",
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          fileType: "spreadsheet",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\operations.xlsx",
        }),
      ],
      readBinaryFile: async () => createMinimalXlsxBuffer({
        Summary: [
          ["Metric", "Value"],
          ["Pressure", "60 psi"],
        ],
        Schedule: [
          ["Day", "Status"],
          ["Monday", "Open"],
        ],
      }),
    }
  );

  assert.equal(bundle.sources.length, 1);
  assert.equal(bundle.sources[0].status, "used");
  assert.match(bundle.text, /Thread Document: operations\.xlsx/);
  assert.match(bundle.text, /### Sheet: Summary/);
  assert.match(bundle.text, /Columns: Metric \| Value/);
  assert.match(bundle.text, /Rows:/);
  assert.match(bundle.text, /- Pressure \| 60 psi/);
  assert.doesNotMatch(bundle.text, /R1: Metric \| Value/);
  assert.match(bundle.text, /### Sheet: Schedule/);
});

await runTest("uses header-aware CSV attachments when extraction succeeds", async () => {
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async () => [
        makeDocument({
          filename: "operations.csv",
          mimeType: "text/csv",
          fileType: "spreadsheet",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\operations.csv",
        }),
      ],
      readBinaryFile: async () => createMinimalCsvBuffer([
        ["Metric", "Value", "Owner"],
        ["Pressure", "60 psi", "Ops"],
      ]),
    }
  );

  assert.equal(bundle.sources.length, 1);
  assert.equal(bundle.sources[0].status, "used");
  assert.match(bundle.text, /Thread Document: operations\.csv/);
  assert.match(bundle.text, /### Sheet: operations/);
  assert.match(bundle.text, /Columns: Metric \| Value \| Owner/);
  assert.match(bundle.text, /- Pressure \| 60 psi \| Ops/);
});

await runTest("uses header-aware TSV attachments when extraction succeeds", async () => {
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async () => [
        makeDocument({
          filename: "schedule.tsv",
          mimeType: "text/tab-separated-values",
          fileType: "spreadsheet",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\schedule.tsv",
        }),
      ],
      readBinaryFile: async () => createMinimalTsvBuffer([
        ["Day", "Status"],
        ["Monday", "Open"],
      ]),
    }
  );

  assert.equal(bundle.sources.length, 1);
  assert.equal(bundle.sources[0].status, "used");
  assert.match(bundle.text, /Thread Document: schedule\.tsv/);
  assert.match(bundle.text, /### Sheet: schedule/);
  assert.match(bundle.text, /Columns: Day \| Status/);
  assert.match(bundle.text, /- Monday \| Open/);
});

await runTest("prioritizes meaningful workbook sheets over sparse or noisy tabs", async () => {
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async () => [
        makeDocument({
          filename: "workbook.xlsx",
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          fileType: "spreadsheet",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\workbook.xlsx",
        }),
      ],
      readBinaryFile: async () => createMinimalXlsxBuffer({
        Cover: [["Q4 workbook"]],
        Notes: [["check formatting later"]],
        Summary: [
          ["Metric", "Value"],
          ["Revenue", "120000"],
        ],
        Operations: [
          ["Unit", "Status", "Capacity"],
          ["A-12", "Open", "85"],
        ],
        Forecast: [
          ["Month", "Forecast", "Variance"],
          ["January", "100", "12"],
        ],
      }),
    }
  );

  assert.equal(bundle.sources[0].status, "used");
  assert.match(bundle.text, /### Sheet: Summary/);
  assert.match(bundle.text, /### Sheet: Operations/);
  assert.match(bundle.text, /### Sheet: Forecast/);
  assert.doesNotMatch(bundle.text, /### Sheet: Cover/);
  assert.doesNotMatch(bundle.text, /### Sheet: Notes/);
  assert.match(bundle.text, /low-signal sheets omitted/i);
});

await runTest("stays truthful when a spreadsheet has no clear header row", async () => {
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async () => [
        makeDocument({
          filename: "notes.xlsx",
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          fileType: "spreadsheet",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\notes.xlsx",
        }),
      ],
      readBinaryFile: async () => createMinimalXlsxBuffer({
        Notes: [
          ["Call vendor"],
          ["Pump offline"],
          ["Return after inspection"],
        ],
      }),
    }
  );

  assert.equal(bundle.sources[0].status, "used");
  assert.match(bundle.text, /No clear header row detected/);
  assert.match(bundle.text, /Row 1: Call vendor/);
});

await runTest("samples representative spreadsheet rows when a table is large", async () => {
  const rows = [["Unit", "Status", "Capacity", "Variance"]];
  for (let index = 1; index <= 26; index += 1) {
    rows.push([
      `Unit-${String(index).padStart(2, "0")}`,
      index % 3 === 0 ? "Watch" : "Stable",
      String(40 + index),
      String((index % 5) - 2),
    ]);
  }
  rows.push(["Total", "Summary", "1711", "0"]);

  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async () => [
        makeDocument({
          filename: "capacity.csv",
          mimeType: "text/csv",
          fileType: "spreadsheet",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\capacity.csv",
        }),
      ],
      readBinaryFile: async () => createMinimalCsvBuffer(rows),
    }
  );

  assert.equal(bundle.sources[0].status, "used");
  assert.match(bundle.text, /Representative rows are shown to keep the table compact and decision-useful/);
  assert.match(bundle.text, /- Unit-01 \| Stable \| 41 \| -1/);
  assert.match(bundle.text, /- Total \| Summary \| 1711 \| 0/);
  assert.match(bundle.text, /additional data rows omitted after representative sampling/i);
});

await runTest("focuses on the strongest structured table region within a sheet", async () => {
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async () => [
        makeDocument({
          filename: "regions.xlsx",
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          fileType: "spreadsheet",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\regions.xlsx",
        }),
      ],
      readBinaryFile: async () => createMinimalXlsxBuffer({
        Operations: [
          ["Quarterly prep notes"],
          [""],
          ["Line", "Status", "Capacity"],
          ["A-12", "Open", "85"],
          ["B-04", "Closed", "0"],
          [""],
          ["Draft values pending approval"],
        ],
      }),
    }
  );

  assert.equal(bundle.sources[0].status, "used");
  assert.match(bundle.text, /Focused on the strongest structured table starting at row 3/);
  assert.match(bundle.text, /other low-signal or secondary table regions in this sheet were omitted/i);
  assert.doesNotMatch(bundle.text, /Quarterly prep notes/);
  assert.doesNotMatch(bundle.text, /Draft values pending approval/);
});

await runTest("preserves useful late spreadsheet columns beyond the old first-eight cutoff", async () => {
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async () => [
        makeDocument({
          filename: "wide.csv",
          mimeType: "text/csv",
          fileType: "spreadsheet",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\wide.csv",
        }),
      ],
      readBinaryFile: async () => createMinimalCsvBuffer([
        ["Region", "Status", "Owner", "Unused A", "Unused B", "Unused C", "Unused D", "Unused E", "Capacity", "Variance"],
        ["North", "Stable", "Alex", "", "", "", "", "", "85", "5"],
        ["South", "Watch", "Sam", "", "", "", "", "", "65", "-2"],
      ]),
    }
  );

  assert.equal(bundle.sources[0].status, "used");
  assert.match(bundle.text, /Columns: .*Capacity .*Variance/);
  assert.match(bundle.text, /- North \| Stable \| Alex .*85 \| 5/);
});

await runTest("handles title rows before a structured header without treating the title as columns", async () => {
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async () => [
        makeDocument({
          filename: "monthly.tsv",
          mimeType: "text/tab-separated-values",
          fileType: "spreadsheet",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\monthly.tsv",
        }),
      ],
      readBinaryFile: async () => createMinimalTsvBuffer([
        ["Monthly operating summary"],
        ["Region", "Status", "Variance"],
        ["North", "Stable", "5"],
        ["South", "Watch", "-2"],
      ]),
    }
  );

  assert.equal(bundle.sources[0].status, "used");
  assert.match(bundle.text, /Columns: Region \| Status \| Variance/);
  assert.match(bundle.text, /Focused on the strongest structured table starting at row 2/);
  assert.doesNotMatch(bundle.text, /Columns: Monthly operating summary/);
});

await runTest("marks failed spreadsheet extraction explicitly", async () => {
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async () => [
        makeDocument({
          filename: "broken.csv",
          mimeType: "text/csv",
          fileType: "spreadsheet",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\broken.csv",
        }),
      ],
      readBinaryFile: async () => Buffer.from("csv fixture", "utf8"),
      extractSpreadsheetText: async () => {
        throw new Error("Delimited content could not be decoded");
      },
    }
  );

  assert.equal(bundle.sources.length, 1);
  assert.equal(bundle.sources[0].status, "failed");
  assert.match(bundle.sources[0].detail, /spreadsheet parser failed before usable workbook content could be extracted/i);
  assert.match(bundle.text, /spreadsheet parser failed before usable workbook content could be extracted/i);
});

await runTest("marks failed DOCX extraction explicitly", async () => {
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async () => [
        makeDocument({
          filename: "broken.docx",
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          fileType: "document",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\broken.docx",
        }),
      ],
      readBinaryFile: async () => Buffer.from("not a real docx", "utf8"),
    }
  );

  assert.equal(bundle.sources.length, 1);
  assert.equal(bundle.sources[0].status, "failed");
  assert.match(bundle.sources[0].detail, /DOCX parser failed before usable text could be extracted/);
  assert.match(bundle.text, /DOCX parser failed before usable text could be extracted/);
});

await runTest("marks failed file reads explicitly", async () => {
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async () => [makeDocument({ filename: "missing.md" })],
      readTextFile: async () => {
        throw Object.assign(new Error("missing"), { code: "ENOENT" });
      },
    }
  );

  assert.equal(bundle.sources.length, 1);
  assert.equal(bundle.sources[0].status, "failed");
  assert.match(bundle.sources[0].detail, /missing from disk/);
  assert.match(bundle.text, /missing from disk/);
});

await runTest("handles mixed attachment sets without hiding unsupported or failed files", async () => {
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async () => [
        makeDocument({ id: "doc-used", filename: "plan.md" }),
        makeDocument({ id: "doc-unsupported", filename: "diagram.png", mimeType: "image/png", fileType: "image" }),
        makeDocument({ id: "doc-failed", filename: "empty.txt", storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\empty.txt" }),
      ],
      readTextFile: async (storagePath) => {
        if (storagePath.endsWith("empty.txt")) {
          return "   \n\n";
        }

        return "Initial plan\n\nLine one.\n\nLine two.";
      },
    }
  );

  assert.deepEqual(
    bundle.sources.map((source) => [source.target, source.status]),
    [
      ["plan.md", "used"],
      ["diagram.png", "unavailable"],
      ["empty.txt", "failed"],
    ]
  );
  assert.equal(bundle.summarySources.length, 1);
  assert.match(bundle.summarySources[0].description, /1 used, 1 failed, 1 unavailable/);
});

await runTest("handles mixed attachment sets with PDF, markdown, and unsupported files", async () => {
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async () => [
        makeDocument({
          id: "doc-pdf",
          filename: "operations.pdf",
          mimeType: "application/pdf",
          fileType: "pdf",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\operations.pdf",
        }),
        makeDocument({
          id: "doc-md",
          filename: "notes.md",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\notes.md",
        }),
        makeDocument({
          id: "doc-unsupported",
          filename: "diagram.png",
          mimeType: "image/png",
          fileType: "image",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\diagram.png",
        }),
      ],
      readBinaryFile: async () => createMinimalPdfBuffer("PDF operating context."),
      readTextFile: async () => "Markdown operating context.",
    }
  );

  assert.deepEqual(
    bundle.sources.map((source) => [source.target, source.status]),
    [
      ["operations.pdf", "used"],
      ["notes.md", "used"],
      ["diagram.png", "unavailable"],
    ]
  );
  assert.match(bundle.text, /PDF operating context\./);
  assert.match(bundle.text, /Markdown operating context\./);
  assert.match(bundle.summarySources[0].description, /2 used, 1 unavailable/);
});

await runTest("handles mixed attachment sets with DOCX, markdown, and unsupported files", async () => {
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async () => [
        makeDocument({
          id: "doc-docx",
          filename: "operations.docx",
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          fileType: "document",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\operations.docx",
        }),
        makeDocument({
          id: "doc-md",
          filename: "notes.md",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\notes.md",
        }),
        makeDocument({
          id: "doc-unsupported",
          filename: "diagram.png",
          mimeType: "image/png",
          fileType: "image",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\diagram.png",
        }),
      ],
      readBinaryFile: async () => createMinimalDocxBuffer("DOCX thread context."),
      readTextFile: async () => "Markdown operating context.",
    }
  );

  assert.deepEqual(
    bundle.sources.map((source) => [source.target, source.status]),
    [
      ["operations.docx", "used"],
      ["notes.md", "used"],
      ["diagram.png", "unavailable"],
    ]
  );
  assert.match(bundle.text, /DOCX thread context\./);
  assert.match(bundle.text, /Markdown operating context\./);
  assert.match(bundle.summarySources[0].description, /2 used, 1 unavailable/);
});

await runTest("handles mixed attachment sets with PPTX, markdown, and unsupported files", async () => {
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async () => [
        makeDocument({
          id: "doc-pptx",
          filename: "briefing.pptx",
          mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          fileType: "document",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\briefing.pptx",
        }),
        makeDocument({
          id: "doc-md",
          filename: "notes.md",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\notes.md",
        }),
        makeDocument({
          id: "doc-unsupported",
          filename: "diagram.png",
          mimeType: "image/png",
          fileType: "image",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\diagram.png",
        }),
      ],
      readBinaryFile: async () => createMinimalPptxBuffer([
        {
          lines: ["Quarterly Update", "Revenue up 12%"],
          notes: ["Speaker note: call out staffing risk."],
        },
      ]),
      readTextFile: async () => "Markdown operating context.",
    }
  );

  assert.deepEqual(
    bundle.sources.map((source) => [source.target, source.status]),
    [
      ["briefing.pptx", "used"],
      ["notes.md", "used"],
      ["diagram.png", "unavailable"],
    ]
  );
  assert.match(bundle.text, /### Slide 1/);
  assert.match(bundle.text, /Speaker note: call out staffing risk\./);
  assert.match(bundle.text, /Markdown operating context\./);
  assert.match(bundle.summarySources[0].description, /2 used, 1 unavailable/);
});

await runTest("handles mixed attachment sets with image, markdown, and unsupported files truthfully", async () => {
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async () => [
        makeDocument({
          id: "doc-image",
          filename: "inspection.jpg",
          mimeType: "image/jpeg",
          fileType: "image",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\inspection.jpg",
        }),
        makeDocument({
          id: "doc-md",
          filename: "notes.md",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\notes.md",
        }),
        makeDocument({
          id: "doc-unsupported",
          filename: "recording.wav",
          mimeType: "audio/wav",
          fileType: "audio",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\recording.wav",
        }),
      ],
      readTextFile: async () => "Markdown operating context.",
    }
  );

  assert.deepEqual(
    bundle.sources.map((source) => [source.target, source.status]),
    [
      ["inspection.jpg", "unavailable"],
      ["notes.md", "used"],
      ["recording.wav", "unsupported"],
    ]
  );
  assert.match(bundle.text, /inspection\.jpg: Attached to this thread, but the current Team Chat runtime does not yet load image attachments into the active model context\./i);
  assert.match(bundle.text, /Markdown operating context\./);
  assert.match(bundle.summarySources[0].description, /1 used, 1 unsupported, 1 unavailable/);
});

await runTest("handles mixed attachment sets with spreadsheet, markdown, and unsupported files", async () => {
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async () => [
        makeDocument({
          id: "doc-sheet",
          filename: "operations.xlsx",
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          fileType: "spreadsheet",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\operations.xlsx",
        }),
        makeDocument({
          id: "doc-md",
          filename: "notes.md",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\notes.md",
        }),
        makeDocument({
          id: "doc-unsupported",
          filename: "diagram.png",
          mimeType: "image/png",
          fileType: "image",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\diagram.png",
        }),
      ],
      readBinaryFile: async () => createMinimalXlsxBuffer({
        Summary: [
          ["Metric", "Value"],
          ["Temperature", "180 F"],
        ],
      }),
      readTextFile: async () => "Markdown operating context.",
    }
  );

  assert.deepEqual(
    bundle.sources.map((source) => [source.target, source.status]),
    [
      ["operations.xlsx", "used"],
      ["notes.md", "used"],
      ["diagram.png", "unavailable"],
    ]
  );
  assert.match(bundle.text, /### Sheet: Summary/);
  assert.match(bundle.text, /Temperature \| 180 F/);
  assert.match(bundle.summarySources[0].description, /2 used, 1 unavailable/);
});

await runTest("handles mixed attachment sets with CSV, markdown, and unsupported files", async () => {
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async () => [
        makeDocument({
          id: "doc-csv",
          filename: "readings.csv",
          mimeType: "text/csv",
          fileType: "spreadsheet",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\readings.csv",
        }),
        makeDocument({
          id: "doc-md",
          filename: "notes.md",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\notes.md",
        }),
        makeDocument({
          id: "doc-unsupported",
          filename: "diagram.png",
          mimeType: "image/png",
          fileType: "image",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\diagram.png",
        }),
      ],
      readBinaryFile: async () => createMinimalCsvBuffer([
        ["Metric", "Value"],
        ["Temperature", "180 F"],
      ]),
      readTextFile: async () => "Markdown operating context.",
    }
  );

  assert.deepEqual(
    bundle.sources.map((source) => [source.target, source.status]),
    [
      ["readings.csv", "used"],
      ["notes.md", "used"],
      ["diagram.png", "unavailable"],
    ]
  );
  assert.match(bundle.text, /### Sheet: readings/);
  assert.match(bundle.text, /Columns: Metric \| Value/);
  assert.match(bundle.summarySources[0].description, /2 used, 1 unavailable/);
});

await runTest("stays truthful when a CSV has no clear header row", async () => {
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async () => [
        makeDocument({
          filename: "notes.csv",
          mimeType: "text/csv",
          fileType: "spreadsheet",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\notes.csv",
        }),
      ],
      readBinaryFile: async () => createMinimalCsvBuffer([
        ["Call vendor"],
        ["Pump offline"],
        ["Return after inspection"],
      ]),
    }
  );

  assert.equal(bundle.sources[0].status, "used");
  assert.match(bundle.text, /No clear header row detected/);
  assert.match(bundle.text, /Row 1: Call vendor/);
});

await runTest("reports source decisions even when no attachments exist", async () => {
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async () => [],
      readTextFile: async () => "",
    }
  );

  assert.equal(bundle.text, "");
  assert.deepEqual(bundle.sources, []);
  assert.deepEqual(bundle.summarySources, []);
  assert.deepEqual(bundle.sourceSelection, {
    requestMode: "default",
    consideredSourceIds: ["thread_documents", "company_documents", "browsing", "memory", "live_data"],
    defaultCandidateSourceIds: ["thread_documents", "company_documents", "browsing", "memory", "live_data"],
    explicitUserRequestedSourceIds: [],
    requestedSourceIds: [],
    plannerProposedSourceIds: [],
    policyRequiredSourceIds: [],
    fallbackCandidateSourceIds: [],
    allowedSourceIds: ["thread_documents"],
    executedSourceIds: ["thread_documents"],
    excludedSourceIds: ["company_documents", "browsing", "memory", "live_data"],
  });
  assert.deepEqual(
    bundle.sourceDecisions.map((source) => [source.sourceId, source.status, source.reason]),
    [
      ["thread_documents", "allowed", "allowed"],
      ["company_documents", "excluded", "not_implemented"],
      ["browsing", "excluded", "not_implemented"],
      ["memory", "excluded", "not_implemented"],
      ["live_data", "excluded", "not_implemented"],
    ]
  );
  assert.deepEqual(findSourceDecision(bundle, "thread_documents")?.request, {
    status: "candidate",
    mode: "default",
    origins: ["default_system_candidate"],
    detail: "Considered as a default system candidate for this conversation runtime.",
  });
  assert.deepEqual(findSourceDecision(bundle, "thread_documents")?.admission, {
    status: "allowed",
  });
  assert.deepEqual(findSourceDecision(bundle, "thread_documents")?.execution, {
    status: "executed",
    detail: "Executed thread-attached document retrieval for this conversation, but no in-scope thread attachments were available.",
    summary: {
      totalCount: 0,
      usedCount: 0,
      unsupportedCount: 0,
      failedCount: 0,
      unavailableCount: 0,
      excludedCategories: [],
    },
  });
  assert.equal(findSourceDecision(bundle, "company_documents")?.exclusion?.category, "implementation");
});

await runTest("honors an explicit empty source plan without falling back to the default registry sweep", async () => {
  let listDocumentsCalled = false;
  const bundle = await resolveConversationContextBundle(
    {
      conversationId: "thread-1",
      sourcePlan: {
        requestedSourceIds: [],
      },
    },
    {
      listDocuments: async () => {
        listDocumentsCalled = true;
        return [makeDocument()];
      },
    }
  );

  assert.equal(listDocumentsCalled, false);
  assert.equal(bundle.text, "");
  assert.deepEqual(bundle.sources, []);
  assert.deepEqual(bundle.sourceSelection, {
    requestMode: "plan",
    consideredSourceIds: [],
    defaultCandidateSourceIds: [],
    explicitUserRequestedSourceIds: [],
    requestedSourceIds: [],
    plannerProposedSourceIds: [],
    policyRequiredSourceIds: [],
    fallbackCandidateSourceIds: [],
    allowedSourceIds: [],
    executedSourceIds: [],
    excludedSourceIds: [],
  });
  assert.deepEqual(bundle.sourceDecisions, []);
});

await runTest("supports an explicit requested source plan without widening live execution", async () => {
  let listDocumentsCalled = false;
  const bundle = await resolveConversationContextBundle(
    {
      conversationId: "thread-1",
      sourcePlan: {
        requestedSourceIds: ["thread_documents", "browsing"],
      },
    },
    {
      listDocuments: async () => {
        listDocumentsCalled = true;
        return [];
      },
    }
  );

  assert.equal(listDocumentsCalled, true);
  assert.deepEqual(bundle.sourceSelection, {
    requestMode: "plan",
    consideredSourceIds: ["thread_documents", "browsing"],
    defaultCandidateSourceIds: [],
    explicitUserRequestedSourceIds: [],
    requestedSourceIds: ["thread_documents", "browsing"],
    plannerProposedSourceIds: ["thread_documents", "browsing"],
    policyRequiredSourceIds: [],
    fallbackCandidateSourceIds: [],
    allowedSourceIds: ["thread_documents"],
    executedSourceIds: ["thread_documents"],
    excludedSourceIds: ["browsing"],
  });
  assert.deepEqual(
    bundle.sourceDecisions.map((source) => [source.sourceId, source.request.status, source.request.mode, source.request.origins, source.admission.status, source.execution.status]),
    [
      ["thread_documents", "proposed", "plan", ["planner_proposed"], "allowed", "executed"],
      ["browsing", "proposed", "plan", ["planner_proposed"], "excluded", "not_executed"],
    ]
  );
  assert.equal(findSourceDecision(bundle, "browsing")?.exclusion?.category, "implementation");
});

await runTest("marks unknown requested sources as registration exclusions", async () => {
  const bundle = await resolveConversationContextBundle({
    conversationId: "thread-1",
    sourcePlan: {
      requestedSourceIds: ["not_real"],
    },
  });

  assert.deepEqual(bundle.sourceSelection, {
    requestMode: "plan",
    consideredSourceIds: ["not_real"],
    defaultCandidateSourceIds: [],
    explicitUserRequestedSourceIds: [],
    requestedSourceIds: ["not_real"],
    plannerProposedSourceIds: ["not_real"],
    policyRequiredSourceIds: [],
    fallbackCandidateSourceIds: [],
    allowedSourceIds: [],
    executedSourceIds: [],
    excludedSourceIds: ["not_real"],
  });
  assert.equal(findSourceDecision(bundle, "not_real")?.reason, "not_registered");
  assert.equal(findSourceDecision(bundle, "not_real")?.request.status, "proposed");
  assert.deepEqual(findSourceDecision(bundle, "not_real")?.request.origins, ["planner_proposed"]);
  assert.equal(findSourceDecision(bundle, "not_real")?.exclusion?.category, "registration");
});

await runTest("preserves explicit user request origin separately from planner proposals", async () => {
  const bundle = await resolveConversationContextBundle(
    {
      conversationId: "thread-1",
      sourcePlan: {
        sourceRequests: [
          { sourceId: "thread_documents", origin: "explicit_user_request" },
        ],
      },
    },
    {
      listDocuments: async () => [],
    }
  );

  assert.deepEqual(bundle.sourceSelection, {
    requestMode: "plan",
    consideredSourceIds: ["thread_documents"],
    defaultCandidateSourceIds: [],
    explicitUserRequestedSourceIds: ["thread_documents"],
    requestedSourceIds: ["thread_documents"],
    plannerProposedSourceIds: [],
    policyRequiredSourceIds: [],
    fallbackCandidateSourceIds: [],
    allowedSourceIds: ["thread_documents"],
    executedSourceIds: ["thread_documents"],
    excludedSourceIds: [],
  });
  assert.deepEqual(findSourceDecision(bundle, "thread_documents")?.request, {
    status: "requested",
    mode: "plan",
    origins: ["explicit_user_request"],
    detail: "Included because the user explicitly requested this source for the conversation.",
  });
});

await runTest("preserves policy-required sources separately from user or planner requests", async () => {
  const bundle = await resolveConversationContextBundle({
    conversationId: "thread-1",
    sourcePlan: {
      sourceRequests: [
        { sourceId: "company_documents", origin: "policy_required" },
      ],
    },
  });

  assert.deepEqual(bundle.sourceSelection, {
    requestMode: "plan",
    consideredSourceIds: ["company_documents"],
    defaultCandidateSourceIds: [],
    explicitUserRequestedSourceIds: [],
    requestedSourceIds: ["company_documents"],
    plannerProposedSourceIds: [],
    policyRequiredSourceIds: ["company_documents"],
    fallbackCandidateSourceIds: [],
    allowedSourceIds: [],
    executedSourceIds: [],
    excludedSourceIds: ["company_documents"],
  });
  assert.deepEqual(findSourceDecision(bundle, "company_documents")?.request, {
    status: "required",
    mode: "plan",
    origins: ["policy_required"],
    detail: "Included because app-side policy marked this source as required before execution could proceed.",
  });
  assert.equal(findSourceDecision(bundle, "company_documents")?.reason, "not_implemented");
  assert.equal(findSourceDecision(bundle, "company_documents")?.exclusion?.category, "implementation");
});

await runTest("marks thread-scoped sources as out of scope when no conversation id is available", async () => {
  let listDocumentsCalled = false;
  const bundle = await resolveConversationContextBundle(
    {
      conversationId: "",
    },
    {
      listDocuments: async () => {
        listDocumentsCalled = true;
        return [makeDocument()];
      },
    }
  );

  assert.equal(listDocumentsCalled, false);
  assert.equal(findSourceDecision(bundle, "thread_documents")?.reason, "not_in_scope");
  assert.equal(findSourceDecision(bundle, "thread_documents")?.exclusion?.category, "scope");
});

await runTest("skips thread-document loading when the requesting user is not an active thread member", async () => {
  let listDocumentsCalled = false;
  const bundle = await resolveConversationContextBundle(
    {
      conversationId: "thread-1",
      authority: makeAuthority({
        requestingUserId: "user-2",
        activeUserIds: ["user-1"],
      }),
    },
    {
      listDocuments: async () => {
        listDocumentsCalled = true;
        return [makeDocument()];
      },
      readTextFile: async () => "This should never load.",
    }
  );

  assert.equal(listDocumentsCalled, false);
  assert.deepEqual(bundle.sources, []);
  assert.equal(bundle.text, "");
  const decision = findSourceDecision(bundle, "thread_documents");
  assert.equal(decision?.status, "excluded");
  assert.equal(decision?.reason, "requesting_user_not_allowed");
  assert.equal(decision?.request.status, "candidate");
  assert.equal(decision?.request.mode, "default");
  assert.deepEqual(decision?.request.origins, ["default_system_candidate"]);
  assert.equal(decision?.admission.status, "excluded");
  assert.equal(decision?.execution.status, "not_executed");
  assert.equal(decision?.exclusion?.category, "authorization");
  assert.equal(decision?.eligibility.isRequestingUserAllowed, false);
});

await runTest("skips thread-document loading when no authoritative active agent is available", async () => {
  let listDocumentsCalled = false;
  const bundle = await resolveConversationContextBundle(
    {
      conversationId: "thread-1",
      authority: makeAuthority({
        activeAgentId: null,
        activeAgentIds: [],
      }),
    },
    {
      listDocuments: async () => {
        listDocumentsCalled = true;
        return [makeDocument()];
      },
      readTextFile: async () => "This should never load.",
    }
  );

  assert.equal(listDocumentsCalled, false);
  assert.deepEqual(bundle.sources, []);
  assert.equal(bundle.text, "");
  const decision = findSourceDecision(bundle, "thread_documents");
  assert.equal(decision?.status, "excluded");
  assert.equal(decision?.reason, "active_agent_not_allowed");
  assert.equal(decision?.request.status, "candidate");
  assert.deepEqual(decision?.request.origins, ["default_system_candidate"]);
  assert.equal(decision?.admission.status, "excluded");
  assert.equal(decision?.execution.status, "not_executed");
  assert.equal(decision?.exclusion?.category, "authorization");
  assert.equal(decision?.eligibility.isActiveAgentAllowed, false);
});

await runTest("enforces thread scope even when the document provider returns extra records", async () => {
  const requestedConversationIds = [];
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async (conversationId) => {
        requestedConversationIds.push(conversationId);
        return [
          makeDocument({ id: "doc-1", conversationId: "thread-1", filename: "thread-1.md" }),
          makeDocument({ id: "doc-2", conversationId: "thread-2", filename: "thread-2.md" }),
        ];
      },
      readTextFile: async () => "Scoped thread content.",
    }
  );

  assert.deepEqual(requestedConversationIds, ["thread-1"]);
  assert.deepEqual(bundle.sources.map((source) => source.target), ["thread-1.md"]);
});

await runTest("caps total thread-document context and marks oversized PDF overflow as unavailable", async () => {
  const largeText = "A".repeat(MAX_THREAD_DOCUMENT_CONTEXT_BUNDLE_CHARS);
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async () => [
        makeDocument({ id: "doc-1", filename: "alpha.pdf", mimeType: "application/pdf", fileType: "pdf", storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\alpha.pdf" }),
        makeDocument({ id: "doc-2", filename: "beta.pdf", mimeType: "application/pdf", fileType: "pdf", storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\beta.pdf" }),
        makeDocument({ id: "doc-3", filename: "gamma.pdf", mimeType: "application/pdf", fileType: "pdf", storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\gamma.pdf" }),
        makeDocument({ id: "doc-4", filename: "delta.pdf", mimeType: "application/pdf", fileType: "pdf", storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\delta.pdf" }),
      ],
      readBinaryFile: async () => Buffer.from("%PDF-1.4\nbudget fixture", "utf8"),
      extractPdfText: async () => largeText,
    }
  );

  assert.deepEqual(
    bundle.sources.map((source) => [source.target, source.status]),
    [
      ["alpha.pdf", "used"],
      ["beta.pdf", "used"],
      ["gamma.pdf", "used"],
      ["delta.pdf", "unavailable"],
    ]
  );
  assert.match(bundle.text, /delta\.pdf: Attached to this thread, but not included in this runtime/);
  assert.match(bundle.summarySources[0].description, /1 unavailable/);
  const decision = findSourceDecision(bundle, "thread_documents");
  assert.equal(decision?.admission.status, "allowed");
  assert.equal(decision?.execution.status, "executed");
  assert.deepEqual(decision?.execution.summary, {
    totalCount: 4,
    usedCount: 3,
    unsupportedCount: 0,
    failedCount: 0,
    unavailableCount: 1,
    excludedCategories: ["budget"],
  });
});

await runTest("caps total thread-document context and marks oversized DOCX overflow as unavailable", async () => {
  const largeText = "B".repeat(MAX_THREAD_DOCUMENT_CONTEXT_BUNDLE_CHARS);
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async () => [
        makeDocument({ id: "doc-1", filename: "alpha.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", fileType: "document", storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\alpha.docx" }),
        makeDocument({ id: "doc-2", filename: "beta.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", fileType: "document", storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\beta.docx" }),
        makeDocument({ id: "doc-3", filename: "gamma.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", fileType: "document", storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\gamma.docx" }),
        makeDocument({ id: "doc-4", filename: "delta.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", fileType: "document", storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\delta.docx" }),
      ],
      readBinaryFile: async () => Buffer.from("docx budget fixture", "utf8"),
      extractDocxText: async () => largeText,
    }
  );

  assert.deepEqual(
    bundle.sources.map((source) => [source.target, source.status]),
    [
      ["alpha.docx", "used"],
      ["beta.docx", "used"],
      ["gamma.docx", "used"],
      ["delta.docx", "unavailable"],
    ]
  );
  assert.match(bundle.text, /delta\.docx: Attached to this thread, but not included in this runtime/);
  assert.match(bundle.summarySources[0].description, /1 unavailable/);
});

await runTest("caps total thread-document context and marks oversized PPTX overflow as unavailable", async () => {
  const largeText = "Slide summary ".repeat(Math.ceil(MAX_THREAD_DOCUMENT_CONTEXT_BUNDLE_CHARS / 14));
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async () => [
        makeDocument({ id: "doc-1", filename: "alpha.pptx", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", fileType: "document", storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\alpha.pptx" }),
        makeDocument({ id: "doc-2", filename: "beta.pptx", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", fileType: "document", storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\beta.pptx" }),
        makeDocument({ id: "doc-3", filename: "gamma.pptx", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", fileType: "document", storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\gamma.pptx" }),
        makeDocument({ id: "doc-4", filename: "delta.pptx", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", fileType: "document", storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\delta.pptx" }),
      ],
      readBinaryFile: async () => Buffer.from("pptx budget fixture", "utf8"),
      extractPptxText: async () => largeText,
    }
  );

  assert.deepEqual(
    bundle.sources.map((source) => [source.target, source.status]),
    [
      ["alpha.pptx", "used"],
      ["beta.pptx", "used"],
      ["gamma.pptx", "used"],
      ["delta.pptx", "unavailable"],
    ]
  );
  assert.match(bundle.text, /delta\.pptx: Attached to this thread, but not included in this runtime/);
  assert.match(bundle.summarySources[0].description, /1 unavailable/);
});

await runTest("caps total thread-document context and marks oversized spreadsheet overflow as unavailable", async () => {
  const largeText = "Sheet summary ".repeat(Math.ceil(MAX_THREAD_DOCUMENT_CONTEXT_BUNDLE_CHARS / 14));
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async () => [
        makeDocument({ id: "doc-1", filename: "alpha.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileType: "spreadsheet", storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\alpha.xlsx" }),
        makeDocument({ id: "doc-2", filename: "beta.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileType: "spreadsheet", storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\beta.xlsx" }),
        makeDocument({ id: "doc-3", filename: "gamma.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileType: "spreadsheet", storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\gamma.xlsx" }),
        makeDocument({ id: "doc-4", filename: "delta.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileType: "spreadsheet", storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\delta.xlsx" }),
      ],
      readBinaryFile: async () => Buffer.from("spreadsheet budget fixture", "utf8"),
      extractSpreadsheetText: async () => largeText,
    }
  );

  assert.deepEqual(
    bundle.sources.map((source) => [source.target, source.status]),
    [
      ["alpha.xlsx", "used"],
      ["beta.xlsx", "used"],
      ["gamma.xlsx", "used"],
      ["delta.xlsx", "unavailable"],
    ]
  );
  assert.match(bundle.text, /delta\.xlsx: Attached to this thread, but not included in this runtime/);
  assert.match(bundle.summarySources[0].description, /1 unavailable/);
});

await runTest("caps total thread-document context and marks oversized CSV overflow as unavailable", async () => {
  const largeText = "Delimited table summary ".repeat(Math.ceil(MAX_THREAD_DOCUMENT_CONTEXT_BUNDLE_CHARS / 24));
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async () => [
        makeDocument({ id: "doc-1", filename: "alpha.csv", mimeType: "text/csv", fileType: "spreadsheet", storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\alpha.csv" }),
        makeDocument({ id: "doc-2", filename: "beta.csv", mimeType: "text/csv", fileType: "spreadsheet", storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\beta.csv" }),
        makeDocument({ id: "doc-3", filename: "gamma.csv", mimeType: "text/csv", fileType: "spreadsheet", storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\gamma.csv" }),
        makeDocument({ id: "doc-4", filename: "delta.csv", mimeType: "text/csv", fileType: "spreadsheet", storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\delta.csv" }),
      ],
      readBinaryFile: async () => Buffer.from("csv budget fixture", "utf8"),
      extractSpreadsheetText: async () => largeText,
    }
  );

  assert.deepEqual(
    bundle.sources.map((source) => [source.target, source.status]),
    [
      ["alpha.csv", "used"],
      ["beta.csv", "used"],
      ["gamma.csv", "used"],
      ["delta.csv", "unavailable"],
    ]
  );
  assert.match(bundle.text, /delta\.csv: Attached to this thread, but not included in this runtime/);
  assert.match(bundle.summarySources[0].description, /1 unavailable/);
});

await runTest("summarizes larger workbook tables without dumping every row", async () => {
  const dataRows = Array.from({ length: 28 }, (_, index) => [`Line ${index + 1}`, `${index + 10}`, `Owner ${index + 1}`]);
  const bundle = await resolveConversationContextBundle(
    { conversationId: "thread-1" },
    {
      listDocuments: async () => [
        makeDocument({
          filename: "large.xlsx",
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          fileType: "spreadsheet",
          storagePath: "C:\\GitHub\\hub\\uploads\\thread-1\\large.xlsx",
        }),
      ],
      readBinaryFile: async () => createMinimalXlsxBuffer({
        Summary: [
          ["Item", "Value", "Owner"],
          ...dataRows,
        ],
      }),
    }
  );

  assert.equal(bundle.sources[0].status, "used");
  assert.match(bundle.text, /Columns: Item \| Value \| Owner/);
  assert.match(bundle.text, /Representative rows are shown to keep the table compact and decision-useful/);
  assert.match(bundle.text, /additional data rows omitted after representative sampling/);
});

if (failures.length > 0) {
  console.error(`\n${failures.length} conversation-context test(s) failed.`);
  process.exitCode = 1;
} else {
  console.log(`\n${completed} conversation-context test(s) passed.`);
}
