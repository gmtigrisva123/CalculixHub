# Instructions for Claude

## Weekly Arena routine (standing instruction from the repo owner)

When the scheduled weekly-Arena task runs, finish the job end to end: generate the new arena
(`npx tsx scripts/weekly-arena.ts`, see `docs/admin-arena.md`), commit, push, open a pull request
into `main` using `.github/PULL_REQUEST_TEMPLATE.md`, and **merge it yourself** once CI is green.
The owner does not want to merge these PRs by hand. If CI fails or there is a conflict, make the
smallest fix (never skip tests); only notify the owner if it cannot be resolved or merging is blocked.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. When the answer is under a Markdown heading, `graphify section "<heading>"` prints that section's text, so the .md need not be opened. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
