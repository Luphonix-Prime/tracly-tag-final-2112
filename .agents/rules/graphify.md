---
trigger: always_on
description: Mandatory rule to query and maintain the Graphify knowledge graph (graphify-out/) for intelligent, token-efficient codebase navigation and impact analysis.
---

## Graphify Smart Knowledge Graph Rules

This repository maintains an active knowledge graph at `graphify-out/graph.json`.
Instead of blindly searching, repeatedly reading files, or brute-force grepping across the entire repository, you MUST use Graphify to navigate and reason about the architecture.

### 1. Mandatory Smart Code Search & Navigation
- **Architecture & Concept Questions:** Run `graphify query "<topic or query>"` (CLI) or call `query_graph` (MCP). This instantly extracts the relevant symbols, types, and caller/callee relations across the codebase without eating up your context window.
- **Trace Relationships & Data Flow:** When determining how component A connects to service B, run:
  ```bash
  graphify path "<SymbolA>" "<SymbolB>"
  ```
- **Inspect Specific Modules / Nodes:** Run:
  ```bash
  graphify explain "<SymbolOrFile>"
  ```
- **High-level Architectural View:** Consult `graphify-out/GRAPH_REPORT.md` for community clustering and architectural overview instead of opening dozens of files.

### 2. Smart Impact Analysis Before Refactoring
- Before modifying or refactoring an existing type, API route, database schema, or shared helper, query its incoming/outgoing edges in Graphify to identify all downstream consumers.
- Ensure all affected modules identified by Graphify are accounted for before finalizing changes.

### 3. Automatic Synchronization
- Whenever you create, modify, or delete source code files during a session, run:
  ```bash
  graphify update .
  ```
  This is a local, deterministic AST update (zero API cost and runs in seconds) to keep `graphify-out/graph.json` perpetually in sync with your changes.
