import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import createJiti from "jiti";
import JSZip from "jszip";
import * as XLSX from "xlsx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jiti = createJiti(import.meta.url, { moduleCache: false });
const {
  MAX_THREAD_DOCUMENT_CONTEXT_BUNDLE_CHARS,
  resolveConversationContextBundle: resolveConversationContextBundleBase,
} = jiti(path.join(__dirname, "..", "src", "lib", "conversation-context.ts"));
const {
  CONVERSATION_DOCUMENT_ACCEPT,
  resolveConversationDocumentMetadata,
  validateConversationDocument,
} = jiti(path.join(__dirname, "..", "src", "lib", "conversation-documents.ts"));

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
