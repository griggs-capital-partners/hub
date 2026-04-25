# Open-Source Context Acceleration Spike

## Scope

This spike answers one question: where can GCPHUB safely accelerate its long-term context architecture with open-source patterns or narrowly isolated helpers without surrendering source-of-truth provenance, permission control, Inspector parity, or Team Chat runtime ownership.

This is not an A-03d implementation pass. It is an architecture and interface spike.

## Existing GCPHUB Seam Map

### Files inspected

- `src/lib/conversation-context.ts`
- `src/lib/context-document-chunks.ts`
- `src/lib/context-token-budget.ts`
- `src/lib/model-budget-profiles.ts`
- `src/lib/context-formatting.ts`
- `src/lib/conversation-documents.ts`
- `src/lib/agent-llm.ts`
- `src/lib/agent-retrieval.ts`
- `src/app/api/chat/conversations/[id]/messages/route.ts`
- `src/app/api/chat/conversations/[id]/inspect/route.ts`
- `src/app/api/chat/conversations/[id]/documents/route.ts`
- `src/components/team/TeamClient.tsx`
- `src/components/team/team-chat-shared.tsx`
- `prisma/schema.prisma`
- `tests/conversation-context.test.mjs`
- `tests/context-document-chunks.test.mjs`
- `tests/context-formatting.test.mjs`
- `tests/context-token-budget.test.mjs`
- `tests/agent-llm-prompt.test.mjs`

### Current owned flow

GCPHUB already has a strong internal seam:

1. Thread documents are uploaded and stored against the conversation/thread object.
2. `resolveConversationContextBundle()` owns source admission, source eligibility, file extraction, chunk generation, ranking, budget selection, prompt rendering, and debug payload creation.
3. `buildAgentRuntimePreview()` / `agent-llm.ts` own prompt composition and live-send behavior.
4. `/messages` and `/inspect` both consume the same bundle/debug state, which is the current Inspector parity anchor.
5. Tests already enforce truthfulness constraints around legal provenance, referenced locations, ranking, and prompt-grounding language.

### Safe plug-in seams

- Parser adapters
- Source-native metadata contracts
- Structure-aware chunking helpers
- Embedding adapter interfaces
- Vector store adapter interfaces
- Retrieval/reranking adapter interfaces
- Context planner / budget compiler contracts
- Debug trace / observability payload shapes
- Optional hosted retrieval adapters that remain behind GCPHUB-owned provenance mapping

### Unsafe seams

- Conversation/thread identity and membership
- Team Chat UX and route ownership
- Permission/eligibility decisions
- Final prompt assembly ownership
- Inspector source of truth
- Agent runtime orchestration
- Canonical provenance model
- Any parallel ingestion/runtime stack that bypasses thread-attached documents

## Candidate Findings

| Candidate | Links | Relevant references found | License risk | Useful patterns | Main risks | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| Mastra | [Docs](https://mastra.ai/docs/rag/overview) - [Repo](https://github.com/mastra-ai/mastra) | RAG overview/retrieval docs, `examples/`, `observability/`, `server-adapters/`, `workflows/` | Moderate | Good examples for chunk/embed/query/rerank layering, metadata filtering, workflow-shaped retrieval, observability packaging | Dual-license repo with `ee/` paths; broad framework wants to own runtime shape; more opinionated than GCPHUB needs | Reference only |
| Vercel AI SDK + RAG starter | [Docs](https://ai-sdk.dev/docs/introduction) - [RAG guide](https://ai-sdk.dev/docs/guides/rag-chatbot) - [Middleware](https://ai-sdk.dev/docs/ai-sdk-core/middleware) - [Starter](https://github.com/vercel/ai-sdk-rag-starter) | RAG guide, middleware docs, starter templates | Low | Strong TypeScript/Next.js examples for embedding + retrieval + tool-call RAG, and especially a useful middleware seam for context injection | Default examples are generic semantic chunking and app-owned tools, not provenance-first context planning | Adapt small code segments |
| RAGFlow | [Repo](https://github.com/infiniflow/ragflow) - [DeepDoc](https://github.com/infiniflow/ragflow/blob/main/deepdoc/README.md) | `README.md`, `deepdoc/README.md`, `docs/`, Docker/dev stack | Low | Best source inspected for source-native document parsing ideas: positional chunks, table/figure extraction, citation/traceability emphasis, multi-format handling, fused reranking | Heavy Python service, separate product/runtime, operationally large, would create a parallel system if adopted directly | Reject for now |
| LangGraph.js / LangChain.js | [LangGraph docs](https://docs.langchain.com/oss/javascript/langgraph/agentic-rag) - [LangGraph.js repo](https://github.com/langchain-ai/langgraphjs) - [LangChain retrieval docs](https://docs.langchain.com/oss/javascript/langchain/retrieval) | Agentic RAG tutorial, graph/state/handoff docs, LangSmith tracing references | Low | Strong agentic retrieval planning patterns, explicit state-graph control, conditional retrieval, trace-aware debugging | Brings another orchestration model and message abstraction; weak fit for GCPHUB's already-owned thread/runtime path | Reference only |
| LlamaIndex.TS | [Repo](https://github.com/run-llama/LlamaIndexTS) - [TS docs](https://ts.llamaindex.ai/) | Repo README, TypeScript docs, query engine concepts | Low | Historical reference for loaders/index/query-engine boundaries | TypeScript repo is deprecated and no longer maintained; poor foundation for new adoption | Reject for now |
| OpenAI Agents SDK (JS/TS) | [OpenAI docs](https://developers.openai.com/api/docs/guides/agents) - [Repo](https://github.com/openai/openai-agents-js) - [Tracing guide](https://openai.github.io/openai-agents-js/guides/tracing/) - [Sessions guide](https://openai.github.io/openai-agents-js/guides/sessions/) | Agents overview, tracing, sessions/compaction, repo `examples/` | Low | Good patterns for trace/span structure, resumable sessions, compaction, handoffs, and observability contracts | Another runtime/orchestration layer; not a fit as the primary Team Chat engine | Reference only |
| OpenAI File Search / Retrieval | [File search guide](https://developers.openai.com/api/docs/guides/tools-file-search) - [Retrieval guide](https://developers.openai.com/api/docs/guides/retrieval) - [Cookbook example](https://github.com/openai/openai-cookbook/blob/main/examples/File_Search_Responses.ipynb) | Hosted vector store/file search flow, metadata filters, chunking controls, retrieval config | Unknown | Useful as an optional hosted adapter for external or temporary knowledge bases; metadata filters and chunking controls are relevant | Hosted service and vendor lock-in; OpenAI owns chunking/indexing internals unless GCPHUB wraps it carefully; Inspector parity must be mapped back in-app | Adopt directly only as an optional adapter |
| LiteParse | [Repo](https://github.com/run-llama/liteparse) | README, `OCR_API_SPEC.md`, CLI/library usage, local OCR hooks | Low | Narrow parser candidate with bounding boxes, screenshots, OCR plug points, and local execution; well aligned to provenance-first extraction | Young project; format conversion can introduce system dependencies; parser scope is narrower than full context planning | Adapt small code segments |

## Fit Matrix

Legend:

- `H` = high usefulness / good fit
- `M` = medium usefulness / conditional fit
- `L` = low usefulness / weak fit
- `N` = not a meaningful fit

| Candidate | Ingest | Parse | Structure | Provenance | Xref separation | Embed / store | Retrieve / rerank | Budget / assembly | Agentic planning | Observability | TS / Next fit | Prisma / PG fit | Dependency weight | License risk | Impl risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Mastra | M | L | M | M | L | H | H | M | H | H | H | M | H | Moderate | H |
| Vercel AI SDK | M | N | L | L | L | H | M | M | M | M | H | H | M | Low | M |
| RAGFlow | H | H | H | H | M | H | H | L | M | M | L | L | H | Low | H |
| LangGraph / LangChain | M | L | L | L | L | M | H | L | H | H | H | M | H | Low | H |
| LlamaIndex.TS | M | M | M | M | L | H | H | L | M | M | H | M | H | Low | H |
| OpenAI Agents SDK | N | N | N | L | L | N | M | M | H | H | H | M | M | Low | M |
| OpenAI File Search | M | M | L | L | L | H | H | L | N | M | H | M | L | Unknown | M |
| LiteParse | M | H | H | H | L | N | N | N | N | L | H | M | M | Low | M |

## Source-Specific Notes

### Mastra

- The docs expose a clean split between chunking, embedding, vector upsert, retrieval, reranking, and metadata filtering.
- The repo is TypeScript-first and has attractive `examples/`, `server-adapters/`, and `observability/` folders.
- The problem is not capability; it is ownership. Mastra is designed to be an application framework, while GCPHUB already owns the runtime, thread model, and debug path.
- Because the repository uses Apache-2.0 for most code but has enterprise-licensed `ee/` directories, license hygiene would need deliberate file-by-file scrutiny before copying anything.

### Vercel AI SDK

- The strongest reusable idea is not the starter's generic RAG pipeline; it is the middleware seam. The middleware docs show a compact place to inject retrieved evidence before generation.
- The RAG guide and starter are strong reference implementations for tool-call retrieval in a Next.js TypeScript app.
- GCPHUB should not import the example architecture wholesale, but the "context injection seam" is worth borrowing conceptually inside `resolveConversationContextBundle()` or a future internal planner layer.

### RAGFlow

- RAGFlow is the strongest parsing/reference candidate for the A-03 lesson itself because it is explicit about deep document understanding, template chunking, grounded citations, multi-format support, and fused reranking.
- `deepdoc/README.md` is especially relevant because it describes parser output with positional chunks, tables, and figures.
- Even so, direct adoption would create a second ingestion/runtime plane and materially increase operational complexity.
- Best use: reference its parsing/output concepts, not its service/runtime.

### LangGraph / LangChain

- The agentic RAG tutorial is valuable because it separates retrieval decisioning, retrieval execution, grading, rewrite, and final generation into explicit state transitions.
- That planning shape is useful for a future GCPHUB context planner, especially if context acquisition eventually spans thread files, email, browser, and live data.
- It is a poor fit as a runtime dependency for the current product because GCPHUB already has its own thread state, route flow, and Inspector contract.

### LlamaIndex.TS

- Historically useful for loaders/index/query-engine abstractions.
- Not recommended for new investment because the TypeScript repository is explicitly deprecated.
- If LlamaIndex-related inspiration is needed, the parsing side is better represented by LiteParse or LlamaParse product docs than by new LlamaIndex.TS adoption.

### OpenAI Agents SDK

- The strongest reusable patterns are tracing, span structure, session interfaces, and compaction/session ownership ideas.
- Those concepts map well to a future `ContextDebugTrace` shape and to durable multi-turn context history management.
- The SDK should not replace Team Chat orchestration, but its observability/session contracts are good references.

### OpenAI File Search

- This is the one candidate that is reasonable to use as a narrow optional adapter rather than just a reference.
- The file search guide requires a vector store and uploaded files, and the retrieval docs expose chunking controls and file metadata filters.
- The core caveat is provenance ownership: if GCPHUB uses it, GCPHUB must still translate results into its own `ContextLocation`, `ContextProvenance`, and Inspector/debug model instead of surfacing hosted retrieval as the canonical provenance truth.

### LiteParse

- LiteParse is a narrow, local parser with bounding boxes, screenshots, OCR hooks, and TypeScript distribution.
- It is a much better near-term parser candidate than a whole RAG framework because it can fit behind a parser adapter boundary and does not try to own retrieval or runtime orchestration.
- Best use: optional extraction backend experiments for PDFs and visually complex attachments, not default adoption without a measured spike.

## Recommended Architecture Path

### Primary recommendation

Choose **Path 3: Build GCPHUB-owned adapter interfaces first and use open-source projects as references.**

### Secondary recommendation

Allow **Path 4: Use hosted File Search as an optional adapter only** once the internal adapter contracts exist.

### Why this protects GCPHUB

- GCPHUB keeps source-of-truth provenance inside its own types and database-backed thread model.
- GCPHUB keeps permission and source-eligibility control inside its current resolver path.
- Inspector/live-send parity stays anchored to the same internal bundle/debug contract.
- External tools become swappable helpers instead of hidden system owners.
- The architecture stays source-flexible: thread files, company files, email, browser, memory, live data, and future adapters can all target the same contracts.

### What not to do

- Do not adopt Mastra, LangGraph, LangChain, or RAGFlow as the core runtime.
- Do not let a hosted vector search product define GCPHUB's final provenance labels.
- Do not build a second ingestion database or a second debug surface.

## Safe Near-Term Adoption Opportunities

### 1. Add GCPHUB-owned contracts first

- Define source, location, provenance, chunk, planner, and debug interfaces inside GCPHUB.
- Keep current runtime behavior unchanged.

### 2. Prototype a parser adapter, not a parser rewrite

- If a parser spike is needed later, evaluate LiteParse behind a `ContextSourceAdapter`.
- Compare its output to current extraction only on opt-in fixtures.

### 3. Borrow middleware and tracing ideas, not frameworks

- Borrow the AI SDK middleware pattern for context injection.
- Borrow OpenAI Agents SDK / LangSmith-style trace structure for future Inspector/debug improvements.

### 4. Treat hosted retrieval as optional and non-canonical

- If OpenAI File Search is tested, restrict it to an adapter whose outputs are remapped into GCPHUB-native provenance and debug objects.
- Do not let hosted chunking/citation output bypass GCPHUB's prompt rendering and Inspector path.

## Decision Summary

- **Best overall path:** GCPHUB-owned adapter layer first.
- **Best parsing-specific inspiration:** RAGFlow DeepDoc concepts and LiteParse's local parser shape.
- **Best Next.js/TypeScript reference patterns:** Vercel AI SDK RAG guide + middleware seam.
- **Best tracing/session reference:** OpenAI Agents SDK.
- **Best optional hosted adapter:** OpenAI File Search, but only after GCPHUB-native contracts exist.
- **Projects to reject for primary adoption:** RAGFlow, LangGraph/LangChain as runtime, LlamaIndex.TS.

## Bridge Status

`src/lib/context-seams.ts` is the long-term GCPHUB-owned contract layer for parser, retrieval, ranking, budgeting, provenance, and debug adapters.

`src/lib/context-debug-trace.ts` is the current non-behavioral bridge from the A-03 resolver bundle into those contracts. It exists for architecture alignment and Inspector/debug future-readiness only. It does not replace the resolver, change ranking or budget behavior, or introduce a parallel runtime path.
