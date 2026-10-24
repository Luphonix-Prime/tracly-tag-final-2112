Here is a complete cheatsheet of **Graphify commands** for your project:

---

### 1. Instant Codebase Exploration & Search
Instead of grepping or scanning files manually, use these commands in your terminal:

```bash
# Search concepts, models, endpoints, or variables (returns exact nodes and code references)
graphify query "QR code generation"
graphify query "batchesTable"
graphify query "GS1"

# Find relationships / data flow between two concepts or files
graphify path "productsTable" "codesTable"
graphify path "generateUnitCode" "routes/codes.ts"

# Explain a specific function, component, or file in plain language
graphify explain "artifacts/api-server/src/lib/gs1.ts"
graphify explain "DataMatrixBarcode"
```

---

### 2. Updating & Syncing the Knowledge Graph

```bash
# Fast local AST update (0 API cost, takes ~2 seconds)
# Run this whenever you add, change, or delete source files:
graphify update .

# Check if an update is needed:
graphify check-update .

# Automatic watch mode (auto-rebuilds the graph whenever files change):
graphify watch .
```

---

### 3. Architecture Reports & Visualization

```bash
# View key architectural hub nodes (the most connected files and functions):
graphify god-nodes --top 15

# Re-run community clustering and update GRAPH_REPORT.md:
graphify cluster-only .

# Generate an interactive collapsible tree view HTML:
graphify tree --output graphify-out/GRAPH_TREE.html
```

> **Tip:** You can double-click and open [`graphify-out/graph.html`](file:///c:/Users/Keval/Documents/tracelytag/my-merger/tracly-tag-final/graphify-out/graph.html) in your browser at any time to explore the interactive visual graph of your codebase!

---

### 4. In-Chat Assistant Commands (Antigravity)
In your Antigravity chat, you can directly run:

- `/graphify` — Runs the full analysis pipeline on the current directory.
- `/graphify <path>` — Analyzes a specific subfolder or module.
- `/graphify . --update` — Re-extracts only newly modified files.