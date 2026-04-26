function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

const PAGE_AWARE_PDF_EXTRACTION_INPUT = {
  textPages: [
    {
      num: 1,
      text: [
        "CONFIDENTIAL",
        "Section 1 Safety Controls",
        "Valve testing remains open until startup verification is complete.",
        "Page 1 of 3",
      ].join("\n"),
    },
    {
      num: 2,
      text: [
        "CONFIDENTIAL",
        "Appendix A Pricing Terms",
        "Attachment 1 Contractor Rates",
        "Contractor rates remain fixed through the current quarter.",
        "Figure 2: Escalation curve for capex planning",
        "Page 2 of 3",
      ].join("\n"),
    },
    {
      num: 3,
      text: [
        "CONFIDENTIAL",
        "Page 3 of 3",
      ].join("\n"),
    },
  ],
  infoPages: [
    { pageNumber: 1, pageLabel: "1" },
    { pageNumber: 2, pageLabel: "A-1" },
    { pageNumber: 3, pageLabel: "A-2" },
  ],
  tablePages: [
    {
      num: 2,
      tables: [
        [
          ["Quarter", "Volume"],
          ["Q1", "14,200"],
          ["Q2", "15,700"],
        ],
      ],
    },
  ],
  extractorVersion: "pdf-parse@2.4.5",
};

const PAGE_AWARE_PDF_EXPECTATIONS = {
  filename: "rates.pdf",
  sourceId: "doc-page-aware",
  pageOneHeading: "Section 1 Safety Controls",
  appendixHeading: "Appendix A Pricing Terms",
  attachmentHeading: "Attachment 1 Contractor Rates",
  figureLabel: "Figure 2",
  tableLabel: "Table 1",
  lowTextPageNumbers: [3],
  lowTextPageLabels: ["page A-2"],
};

const T5_DECK_PDF_EXTRACTION_INPUT = {
  textPages: [
    {
      num: 9,
      text: [
        "Regional Smackover Structure",
        "Lithium Smackover Trend",
        "Bounded by the Mexia-Talco Fault System",
        "Smackover Top",
        "11,525' MD",
      ].join("\n"),
    },
    {
      num: 10,
      text: [
        "Regional Smackover TDS",
        "T5 Project",
        "TDS 250,000 ppm",
        "Mapped using USGS water database",
      ].join("\n"),
    },
    {
      num: 11,
      text: [
        "Regional Smackover Bottom Hole Temps",
        "T5 Project",
        "Temp 235 F / 112 C",
      ].join("\n"),
    },
    {
      num: 12,
      text: [
        "Phase 1 Test Well",
        "Lundell Creek #1 Well",
        "Tested 613 - 663 ppm of Lithium from Smackover",
        "T5 Blondie Lady #1 Well",
        "650 ppm",
        "Lithium Proposed",
        "Location",
      ].join("\n"),
    },
    {
      num: 13,
      text: [
        "Smackover Core - Lundell Creek #1",
        "Photo credit: James St. John",
        "Oolite intervals",
        "Oolite intervals",
      ].join("\n"),
    },
    {
      num: 14,
      text: [
        "Smackover Brine Mining for Lithium & Bromide",
        "Sustained Brine Production Rates",
        "20,000 barrels/day",
      ].join("\n"),
    },
    {
      num: 15,
      text: [
        "Smackover Water Chemistry",
        "17",
      ].join("\n"),
    },
    {
      num: 16,
      text: [
        "2D Seismic Review",
        "Proposed Location",
        "Check Shot Survey",
        "Lundell CRK #1 - 650 PPM",
      ].join("\n"),
    },
    {
      num: 17,
      text: [
        "T5 Blondie Lady #1 Well Schematic",
        "Proposed Total Depth 12,200'",
        "Top Smackover 11,250'",
        "Reynolds Thickness 295'",
        "Entire well will be logged with Quad Combo wireline logs",
      ].join("\n"),
    },
    {
      num: 18,
      text: [
        "T5 Smackover Partners Project Scope & Timeline",
        "Aug Sept Oct Nov Dec",
        "Injection Well",
        "Pilot Scale DLE",
        "Test & Production Well",
        "Qtr 1 Qtr 2 Qtr 3 Qtr 4",
        "2025 2026 2027",
      ].join("\n"),
    },
  ],
  tablePages: [
    { num: 9, tables: [[["Smackover Top\n11,525' MD"]]] },
    { num: 10, tables: [[["T5 Project\nTDS 250,000 ppm"]]] },
    { num: 11, tables: [[["T5 Project\nTemp 235 F / 112 C"], [""], [""]]] },
    { num: 12, tables: [[["650 ppm\nLithium"], []], [["", ""], []]] },
    { num: 13, tables: [[["", "", "Oolite\nintervals\nOolite\nintervals"], [""], [""], [""]]] },
    { num: 14, tables: [] },
    { num: 15, tables: [] },
    { num: 16, tables: [[[""]]] },
    { num: 17, tables: [] },
    { num: 18, tables: [[[""]]] },
  ],
  extractorVersion: "pdf-parse@2.4.5",
};

const T5_DECK_EXPECTATIONS = {
  filename: "T5 Summary Deck V1.7ext.pdf",
  sourceId: "doc-t5-deck",
  tableQuery: "summarize the tables",
  timelineQuery: "summarize the project timeline",
  expectedPageClassifications: {
    9: "chart_or_plot",
    10: "map_or_location_figure",
    11: "chart_or_plot",
    12: "map_or_location_figure",
    13: "photo_or_core_image",
    14: "chart_or_plot",
    15: "true_table",
    16: "map_or_location_figure",
    17: "schematic_or_diagram",
    18: "table_like_schedule_or_timeline",
  },
};

export function getPageAwarePdfExtractionFixture() {
  return deepClone(PAGE_AWARE_PDF_EXTRACTION_INPUT);
}

export function getPageAwarePdfExpectations() {
  return deepClone(PAGE_AWARE_PDF_EXPECTATIONS);
}

export function getT5DeckPdfExtractionFixture() {
  return deepClone(T5_DECK_PDF_EXTRACTION_INPUT);
}

export function getT5DeckExpectations() {
  return deepClone(T5_DECK_EXPECTATIONS);
}
