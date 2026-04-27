import type {
  CapabilityCard,
  InspectionCapability,
  InspectionToolDefinition,
  ToolBenchmarkFixture,
  ToolBenchmarkResult,
} from "./inspection-tool-broker";

const DEFAULT_CAPABILITY_CARDS: CapabilityCard[] = [
  {
    id: "text_extraction",
    label: "Text extraction",
    description: "Extract text already available through approved local source readers.",
    artifactKinds: ["source_memory", "table_extraction"],
    recommendedFallbackCapabilities: ["ocr", "vision_page_understanding"],
    benchmarkFixtureIds: ["scanned_pdf_text_recovery"],
    requiresApprovalForExternalExecution: false,
  },
  {
    id: "pdf_page_classification",
    label: "PDF page classification",
    description: "Classify PDF pages from approved parser metadata and extracted text signals.",
    artifactKinds: ["inspection trace"],
    recommendedFallbackCapabilities: ["rendered_page_inspection", "vision_page_understanding"],
    benchmarkFixtureIds: ["t5_pdf_page_15_visible_table"],
    requiresApprovalForExternalExecution: false,
  },
  {
    id: "pdf_table_detection",
    label: "PDF table detection",
    description: "Identify likely table pages without inventing missing row or column content.",
    artifactKinds: ["table_candidate"],
    recommendedFallbackCapabilities: ["pdf_table_body_recovery", "rendered_page_inspection", "ocr"],
    benchmarkFixtureIds: ["t5_pdf_page_15_visible_table"],
    requiresApprovalForExternalExecution: false,
  },
  {
    id: "pdf_table_body_recovery",
    label: "PDF table body recovery",
    description: "Recover structured table body content only when approved extraction produced it.",
    artifactKinds: ["table_extraction", "extraction_warning"],
    recommendedFallbackCapabilities: [
      "rendered_page_inspection",
      "ocr",
      "vision_page_understanding",
      "document_ai_table_recovery",
    ],
    benchmarkFixtureIds: ["t5_pdf_page_15_visible_table", "scanned_pdf_text_recovery"],
    requiresApprovalForExternalExecution: false,
  },
  {
    id: "rendered_page_inspection",
    label: "Rendered page inspection",
    description: "Inspect rendered page snapshots where parser output is insufficient.",
    artifactKinds: ["table_extraction", "figure_interpretation", "extraction_warning"],
    recommendedFallbackCapabilities: ["vision_page_understanding", "document_ai_table_recovery"],
    benchmarkFixtureIds: ["t5_pdf_page_15_visible_table", "js_rendered_web_page"],
    requiresApprovalForExternalExecution: true,
  },
  {
    id: "ocr",
    label: "OCR",
    description: "Recover text from scanned or image-only source regions.",
    artifactKinds: ["source_memory", "table_extraction", "extraction_warning"],
    recommendedFallbackCapabilities: ["vision_page_understanding", "document_ai_table_recovery"],
    benchmarkFixtureIds: ["scanned_pdf_text_recovery", "t5_pdf_page_15_visible_table"],
    requiresApprovalForExternalExecution: true,
  },
  {
    id: "vision_page_understanding",
    label: "Vision page understanding",
    description: "Use approved vision capabilities to understand page layout, visuals, and tables.",
    artifactKinds: ["figure_interpretation", "chart_interpretation", "table_extraction"],
    recommendedFallbackCapabilities: ["document_ai_table_recovery"],
    benchmarkFixtureIds: ["chart_heavy_deck", "t5_pdf_page_15_visible_table"],
    requiresApprovalForExternalExecution: true,
  },
  {
    id: "document_ai_table_recovery",
    label: "Document AI table recovery",
    description: "Use approved document AI services to recover structured table bodies.",
    artifactKinds: ["table_extraction", "extraction_warning"],
    recommendedFallbackCapabilities: ["ocr", "vision_page_understanding"],
    benchmarkFixtureIds: ["t5_pdf_page_15_visible_table"],
    requiresApprovalForExternalExecution: true,
  },
  {
    id: "artifact_validation",
    label: "Artifact validation",
    description: "Validate learned artifacts and record warnings or supersession signals.",
    artifactKinds: ["extraction_warning", "open_question", "source_memory"],
    recommendedFallbackCapabilities: ["artifact_summarization"],
    benchmarkFixtureIds: ["t5_pdf_page_15_visible_table", "artifact_supersession"],
    requiresApprovalForExternalExecution: false,
  },
];

const DEFAULT_BENCHMARK_FIXTURES: ToolBenchmarkFixture[] = [
  {
    id: "t5_pdf_page_15_visible_table",
    label: "T5 PDF page 15 visible table",
    description:
      "A PDF page that visually signals a likely table while approved parser output does not recover a body.",
    status: "active",
    linkedCapabilities: ["pdf_table_detection", "pdf_table_body_recovery", "artifact_validation"],
    linkedToolIds: ["pdf_table_candidate_detection", "pdf_sparse_table_warning", "existing_parser_text_extraction"],
    acceptanceCriteria: [
      "Create a reusable table_candidate artifact for page 15.",
      "Create a reusable extraction_warning for the missing table body.",
      "Record rendered-page/OCR/vision/document-AI as recommended next capabilities only.",
      "Do not claim OCR, vision, rendered-page, or document-AI execution occurred.",
    ],
  },
  {
    id: "scanned_pdf_text_recovery",
    label: "Scanned PDF text recovery",
    description: "A scanned or image-only PDF page requiring OCR or vision-backed text recovery.",
    status: "pending",
    linkedCapabilities: ["ocr", "vision_page_understanding", "text_extraction"],
    linkedToolIds: [],
    acceptanceCriteria: [
      "Recover visible text with source-page provenance.",
      "Record confidence and limitations for uncertain recognition.",
      "Respect data class and external execution policies.",
    ],
  },
  {
    id: "chart_heavy_deck",
    label: "Chart-heavy deck",
    description: "A presentation dominated by charts and visual encodings.",
    status: "pending",
    linkedCapabilities: ["pptx_slide_inventory", "vision_page_understanding"],
    linkedToolIds: [],
    acceptanceCriteria: [
      "Inventory slides with chart/figure locations.",
      "Preserve uncertainty rather than inventing chart values.",
      "Create chart_interpretation or extraction_warning artifacts as appropriate.",
    ],
  },
  {
    id: "spreadsheet_hidden_sheets_and_formulas",
    label: "Spreadsheet hidden sheets and formulas",
    description: "A workbook with hidden sheets, formulas, named ranges, and visible summary tabs.",
    status: "pending",
    linkedCapabilities: ["spreadsheet_inventory", "spreadsheet_formula_map"],
    linkedToolIds: [],
    acceptanceCriteria: [
      "Inventory visible and hidden sheets.",
      "Map formulas and named ranges with workbook provenance.",
      "Avoid evaluating formulas outside approved local boundaries.",
    ],
  },
  {
    id: "docx_comments_redlines",
    label: "DOCX comments and redlines",
    description: "A Word document with comments, tracked changes, sections, and clause-like structure.",
    status: "pending",
    linkedCapabilities: ["docx_structure_extraction"],
    linkedToolIds: [],
    acceptanceCriteria: [
      "Extract comments and redlines as structured signals.",
      "Preserve author/date provenance when available.",
      "Create clause_inventory or open_question artifacts when relevant.",
    ],
  },
  {
    id: "js_rendered_web_page",
    label: "JavaScript rendered web page",
    description: "A web page whose useful content appears only after client-side rendering.",
    status: "pending",
    linkedCapabilities: ["web_snapshot", "rendered_page_inspection"],
    linkedToolIds: [],
    acceptanceCriteria: [
      "Capture rendered DOM or page snapshot through an approved boundary.",
      "Record scripts/network limitations.",
      "Never crawl or browse outside approved scope.",
    ],
  },
  {
    id: "code_repo_architecture_question",
    label: "Code repository architecture question",
    description: "A repository-level question that requires file discovery, call path inspection, and source summary.",
    status: "pending",
    linkedCapabilities: ["code_repository_inspection"],
    linkedToolIds: [],
    acceptanceCriteria: [
      "Return source-grounded architecture artifacts.",
      "Separate direct source evidence from inferred architecture.",
      "Respect repository access and tenant boundaries.",
    ],
  },
  {
    id: "external_tool_unavailable",
    label: "External tool unavailable",
    description: "A task where a normally eligible approved external tool cannot be reached or is disabled.",
    status: "pending",
    linkedCapabilities: ["source_connector_read", "document_ai_table_recovery"],
    linkedToolIds: [],
    acceptanceCriteria: [
      "Record unmet capability metadata without retry loops.",
      "Recommend fallback capabilities without executing unapproved tools.",
      "Preserve the original answer path using available artifacts where possible.",
    ],
  },
  {
    id: "unapproved_tool_recommendation",
    label: "Unapproved tool recommendation",
    description: "A task that requires a proposed tool category but must not execute it.",
    status: "pending",
    linkedCapabilities: ["ocr", "vision_page_understanding", "document_ai_table_recovery"],
    linkedToolIds: [],
    acceptanceCriteria: [
      "Record an unmet capability review item.",
      "Set executedUnapprovedTool to false.",
      "Name candidate tool categories rather than silently invoking a vendor tool.",
    ],
  },
  {
    id: "artifact_supersession",
    label: "Artifact supersession",
    description: "A document memory scenario where a stronger learned artifact supersedes a weaker prior artifact.",
    status: "pending",
    linkedCapabilities: ["artifact_validation", "artifact_summarization"],
    linkedToolIds: ["artifact_reuse_selector"],
    acceptanceCriteria: [
      "Keep superseded artifacts traceable.",
      "Prefer active stronger artifacts in future context assembly.",
      "Avoid parser-specific dependencies in ContextAssembler.",
    ],
  },
];

export function getDefaultCapabilityCards() {
  return DEFAULT_CAPABILITY_CARDS.map((card) => ({
    ...card,
    artifactKinds: [...card.artifactKinds],
    recommendedFallbackCapabilities: [...card.recommendedFallbackCapabilities],
    benchmarkFixtureIds: [...card.benchmarkFixtureIds],
  }));
}

export function getDefaultCapabilityCard(capability: InspectionCapability) {
  return getDefaultCapabilityCards().find((card) => card.id === capability) ?? null;
}

export function getDefaultToolBenchmarkFixtures() {
  return DEFAULT_BENCHMARK_FIXTURES.map((fixture) => ({
    ...fixture,
    linkedCapabilities: [...fixture.linkedCapabilities],
    linkedToolIds: [...fixture.linkedToolIds],
    acceptanceCriteria: [...fixture.acceptanceCriteria],
  }));
}

export class CapabilityEvaluationHarness {
  constructor(
    private readonly fixtures: ToolBenchmarkFixture[] = getDefaultToolBenchmarkFixtures()
  ) {}

  getFixture(fixtureId: string) {
    return this.fixtures.find((fixture) => fixture.id === fixtureId) ?? null;
  }

  getFixturesForCapability(capability: InspectionCapability) {
    return this.fixtures.filter((fixture) => fixture.linkedCapabilities.includes(capability));
  }

  getFixturesForTool(tool: InspectionToolDefinition) {
    const fixtureIds = new Set(tool.benchmarkFixtureIds);

    return this.fixtures.filter(
      (fixture) => fixtureIds.has(fixture.id) || fixture.linkedToolIds.includes(tool.id)
    );
  }

  evaluateToolCard(tool: InspectionToolDefinition): ToolBenchmarkResult[] {
    return this.getFixturesForTool(tool).map((fixture) => ({
      fixtureId: fixture.id,
      toolId: tool.id,
      capability:
        fixture.linkedCapabilities.find((capability) => tool.capabilities.includes(capability)) ??
        tool.capabilities[0] ??
        "artifact_validation",
      status: fixture.status === "active" && fixture.linkedToolIds.includes(tool.id) ? "pass" : "pending",
      summary:
        fixture.status === "active" && fixture.linkedToolIds.includes(tool.id)
          ? "Active fixture is linked to existing targeted behavioral coverage."
          : "Fixture is registered for future approval evaluation; no runtime tool execution is performed by the harness.",
      evidence: {
        fixtureStatus: fixture.status,
        linkedToolIds: fixture.linkedToolIds,
        acceptanceCriteria: fixture.acceptanceCriteria,
        executedTool: false,
      },
    }));
  }
}
