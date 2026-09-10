# ADR-cross-capsule: Cross-Capsule AI Architecture & Embedding Source Selection

## Status
Accepted

## Context
VectOrEditOr was originally tightly bound to:
1. Local Transformers.js in Web Worker for text vectorization / embeddings.
2. Direct LLM provider calls (Gemini, Claude, OpenAI) for text completions and semantic suggestions.

Users and researchers required:
- The ability to freely swap embedding sources between offline local models and cloud LLM-as-Embedding endpoints to compare semantic precision, latencies, and determinism.
- High architectural depth: hiding complex adapter factories, fallbacks, model mapping, and IPC transport behind small, testable interfaces (`Vectorizer` and `Generator`).
- Loose coupling in UI and state layers to enable testing and maintenance without pollution or brittle DOM dependencies.

## Decision
1. **Defined Clean Seams (`aiAdapters.js`)**:
   - `Vectorizer`: `encode(text: string): Promise<number[]>`
     - Satisfied by `LocalEmbeddingAdapter` and `LLMEmbeddingAdapter`.
   - `Generator`: `generate(prompt: string): Promise<string>`
     - Satisfied by `GeminiLLMAdapter`, `ClaudeLLMAdapter`, and `OpenAILLMAdapter`.

2. **Singleton Adapter Registry (`adapterRegistry.js`)**:
   - Manages active vectorizer and generator instances.
   - Preserves state across app restarts via `localStorage` (`STORAGE_KEYS.EMBEDDING_SOURCE`).
   - Dispatches `app:embeddingSourceChanged` events for reactive UI synchronization.

3. **Controller Seam Injection (`embeddingSourceController.js`)**:
   - Controller accepts an optional registry parameter (`initEmbeddingSourceController(registry = adapterRegistry)`), allowing testing and component isolation.
   - UI reflects active source through badges and visual cards (`Local`, `Gemini`, `Claude`, `OpenAI`).
   - LLM warnings alert users of non-deterministic behavior and API key requirements.

4. **Testing Strategy**:
   - Pure domain rules, badge configurations, and controller contracts are verified using Vitest.
   - Vitest resolves `.js` to `.ts` imports natively via custom Vite configuration, maintaining parity with `electron-vite`.

## Consequences
### Positive
- Deep modules: Vector search pipelines (`vectorSearch.js`) simply call `adapterRegistry.getActiveVectorizer().encode(text)` without knowing provider details.
- Zero-cost testability: Components can be verified in standard CI environments without requiring heavy browser DOM emulators or mocking global network stacks.
- Future-proof: Adding new providers (e.g., Local LLM via Ollama or custom ONNX models) only requires implementing the `Vectorizer` or `Generator` interface.

### Negative / Trade-offs
- LLM-as-Embedding is non-deterministic and involves remote network round-trips compared to local onnx/transformers models. The UI explicitly warns the user of this trade-off.
