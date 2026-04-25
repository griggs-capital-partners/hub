# A-03 Closeout

## Executive Summary

A-03 established the first stable, provenance-first context-planner foundation for GCPHUB thread-attached documents. The current Team Chat runtime can now truthfully extract, chunk, rank, budget, and cite uploaded thread documents while preserving source-native structure, separating referenced locations from body/source locations, and keeping Inspect/live-send aligned.

This matters because GCPHUB's long-term product goal is a ChatGPT-like collaborative workspace that can gather evidence from many source types without losing provenance, permissions, or runtime trustworthiness. A-03 does not solve every future context problem, but it creates the owned seams and runtime behavior that future adapters and deeper file intelligence can build on safely.

## Final A-03 Architecture

Pipeline:

`thread attachment`
`-> extraction`
`-> normalized text`
`-> source-native chunking`
`-> provenance/location metadata`
`-> referenced-location separation`
`-> deterministic ranking`
`-> occurrence inventory for exact phrase/listing tasks`
`-> model-profile-aware token budget selection`
`-> selected explanatory excerpts`
`-> ContextDebugTrace`
`-> model prompt/runtime`
`-> truthful answer`

Key ownership points:

- `resolveConversationContextBundle()` remains the owned context-planner seam.
- Team Chat, thread identity, permissions, and runtime orchestration remain app-owned.
- Inspect and live-send continue to consume the same resolver-owned context state.
- External frameworks do not own the canonical provenance model or debug surface.

## Current Capabilities

- Truthful thread-document source statuses: `used`, `failed`, `unsupported`, and `unavailable`.
- Deterministic document chunk candidates with stable chunk metadata and safe previews.
- Source-native location/provenance modeling for current supported thread-document sources.
- Referenced-location separation so cited body/source locations are not confused with cross-references mentioned inside text.
- Deterministic local chunk relevance ranking with exact-phrase and definition boosts.
- Occurrence/listing intent detection and exact-match occurrence inventory across all successfully extracted thread-document chunks.
- Model-profile-aware thread-document token budgeting with `standard` and `deep` resolver modes.
- Conservative fallback behavior when model/profile budget input is absent.
- Selected/skipped chunk metadata and budget trace visibility in `ContextDebugTrace`.
- Inspect/live-send parity preserved through the shared resolver bundle.
- No external framework ownership of Team Chat, provenance, permissions, or runtime orchestration.

## Known Limitations / Remaining Gaps

### Planner and budgeting

- Message history budgeting remains separate from thread-document budgeting.
- Org/project/company context budgeting remains separate.
- Final full-prompt budget enforcement remains separate from thread-document chunk budgeting.
- Output-token profile wiring is not yet complete.
- Deep mode is supported at resolver/test level but does not yet have an exposed UI control.

### Retrieval and adapters

- No embeddings or vector search are implemented yet.
- No external source adapters are implemented yet for company files, browser/web, email, GitHub/project context, SCADA/live data, or durable memory.
- Exact occurrence inventory currently applies only to successfully extracted thread-document chunks.

### File intelligence

- Source-specific deep intelligence is still needed for PDFs, OCR/scanned documents, tables, spreadsheets, PPT/decks, charts, and figures.
- Cross-file synthesis across multiple uploaded thread documents is still limited and should become a dedicated next track.

### UI and Inspector

- `ContextDebugTrace` is available internally but may not yet be fully surfaced in the visible Inspector UI.
- Inspector 2.0 provenance-first UX remains a future track.

## Manual Validation Results

- The Joint Operating Agreement occurrence stress test now returns materially correct article/source labels for `joint account`.
- Late-section references such as `Article XVI.4` and `Article XVI.5` are preserved instead of being crowded out by earlier excerpts.
- The runtime no longer mislabels `Article XVI` as `Article XV`, `Exhibit C`, or `Exhibit D`.
- Successful occurrence scans no longer tell the user to `Ctrl+F` or re-upload the same file.
- A small wording polish was applied in A-03e so successful occurrence/listing caveats are framed as based on the successfully extracted contents of the attached file rather than only on selected excerpts.

## Open-Source Strategy

Project rule:

- Do not reinvent the wheel when proven open-source or best-practice patterns exist.
- Inspect and adapt small, well-licensed, isolated patterns where helpful.
- Keep GCPHUB-owned seams as the architecture owner.
- External frameworks cannot own Team Chat, permissions, provenance, Inspector truth, runtime orchestration, or core context contracts.

Current strategy outcome:

- Open-source projects remain references or optional future adapters, not runtime owners.
- GCPHUB-owned contracts in `src/lib/context-seams.ts` and the bridge in `src/lib/context-debug-trace.ts` are the long-term internal seam.
- Hosted retrieval, parser helpers, or future agent-context libraries must remain behind GCPHUB-owned interfaces.

## Next Roadmap Tracks

1. PDF Deep Intelligence
2. Spreadsheet + Table Deep Intelligence
3. PPT / Deck Deep Intelligence
4. Cross-file synthesis for uploaded thread documents
5. Company files/shared drive adapter
6. Browser/pasted-link retrieval
7. Email context adapter
8. GitHub/Codex project context adapter
9. SCADA/live data adapter
10. Memory and continuity
11. Agentic planning and orchestration
12. Inspector 2.0 / provenance-first UX
13. Deep mode UI and output-budget planning

## Next-Track Handoff Prompts

### 1. PDF Deep Intelligence

Goal:
Build the next PDF-specific extraction and structure intelligence layer on top of the A-03 foundation.

Current foundation from A-03:

- Resolver-owned extraction, chunking, ranking, occurrence inventory, budget selection, provenance, and debug trace.
- Legal/body-location correctness and referenced-location separation already established.

What to build:

- Better PDF-native structure detection for clauses, tables, figures, appendices, exhibits, schedules, and scanned/OCR pages.
- Stronger source-native location fidelity for legal and long-form PDFs.

What not to touch:

- Do not replace Team Chat, the resolver, permissions, chunk ranking ownership, or Inspector parity.
- Do not add vector DB or external connectors in this pass.

Source-native provenance requirements:

- Preserve page, heading, section, clause, table, figure, appendix, exhibit, and schedule semantics where truthfully available.
- Keep referenced locations separate from body/source location.

Open-source leverage requirement:

- Inspect and adapt small, well-licensed parser/output patterns only.
- Do not let an external parser or framework become the runtime owner.

Validation expectations:

- Add fixture-driven PDF tests for tables, exhibits, schedules, OCR/scanned pages, and provenance labeling.
- Re-run the A-03 regression suite.

### 2. Spreadsheet + Table Deep Intelligence

Goal:
Improve extraction, structure preservation, and reasoning readiness for spreadsheets, CSV/TSV, and table-heavy documents.

Current foundation from A-03:

- Header-aware spreadsheet extraction exists, with truthful status handling and source-native sheet/range metadata support.

What to build:

- Better workbook/sheet/table/range modeling, named ranges, formulas, row/column provenance, and large-table summarization.

What not to touch:

- Do not redesign Team Chat or replace the existing resolver-owned selection path.
- Do not add embeddings/vector infrastructure in this pass.

Source-native provenance requirements:

- Preserve workbook, sheet, table, range, row, column header, and formula context where available.
- Keep body/source ranges separate from referenced cells/ranges mentioned in formulas or text.

Open-source leverage requirement:

- Inspect and adapt narrow parser or range-modeling patterns where useful.
- Keep GCPHUB-owned context contracts as the canonical boundary.

Validation expectations:

- Add workbook fixtures with multi-sheet, sparse-tab, formula, and large-table cases.
- Re-run the A-03 regression suite.

### 3. PPT / Deck Deep Intelligence

Goal:
Improve slide-structured extraction, notes handling, and slide-region provenance for presentations.

Current foundation from A-03:

- PPTX extraction and truthful status handling already exist, with slide-aware support in the current thread-document path.

What to build:

- Better slide title detection, speaker note handling, chart/table region extraction, and deck-level context selection.

What not to touch:

- Do not move runtime orchestration out of the current resolver.
- Do not change Team Chat UI or stream lifecycle in this pass.

Source-native provenance requirements:

- Preserve deck, slide number, slide title, notes, chart region, and table region semantics where available.
- Keep references to other slides or appendices separate from the current slide body location.

Open-source leverage requirement:

- Inspect and adapt small, well-licensed parser or deck-structure patterns only.
- Do not adopt a presentation framework as the runtime owner.

Validation expectations:

- Add slide fixtures for title drift, notes-heavy decks, chart/table regions, and late-slide relevance.
- Re-run the A-03 regression suite.

### 4. Cross-File Synthesis for Uploaded Documents

Goal:
Let GCPHUB synthesize across multiple uploaded thread documents while preserving per-source provenance and budget truthfulness.

Current foundation from A-03:

- Single-file extraction, ranking, budgeting, occurrence inventory, and debug trace are stable and app-owned.

What to build:

- Cross-file ranking/diversity rules, per-file budget balancing, and provenance-preserving synthesis across multiple uploaded documents.

What not to touch:

- Do not replace thread identity, permissions, or the current resolver seam.
- Do not introduce external source adapters or vector DB in this pass.

Source-native provenance requirements:

- Preserve file-by-file body/source locations and never merge referenced locations into source locations.
- Keep per-file status truthfulness visible when some files fail or are unsearchable.

Open-source leverage requirement:

- Inspect and adapt narrow contextual-compression, diversity-packing, or retrieval-planning patterns only.
- Keep GCPHUB-owned interfaces and prompt rendering as the architecture owner.

Validation expectations:

- Add multi-document fixtures that prove cross-file selection, source balancing, provenance truthfulness, and mixed-status handling.
- Re-run the A-03 regression suite.
