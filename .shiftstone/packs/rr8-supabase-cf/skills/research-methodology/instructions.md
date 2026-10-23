
# Research Methodology

---

## The Core Principle

Research is a structured, multi-phase activity:
1. **Resolve topics**: Classify multi-topic relationships before creating folders.
2. **Orchestrate**: Main agent defines the scope in `00-BRIEF.md`.
3. **Scan & Dive**: Gather authoritative data across documentation, release notes, and benchmarks.
4. **Synthesise & Conclude**: Write `04-CONCLUSION.md` first.
5. **Document**: Write remaining files using the 8-file template.

---

## File Structure

Every research topic lives in its own numbered folder under `docs/research/<topic-area>/<topic-slug>/`:

```
docs/research/
├── README.md                    ← Master index
├── _template/                   ← Template cloned for new topics
│   ├── 00-BRIEF.md              ← Research question & scope
│   ├── 01-SUMMARY.md            ← Plain-language overview
│   ├── 02-FINDINGS.md           ← Full technical research data
│   ├── 03-COMPARISON.md         ← Side-by-side evaluation & trade-offs
│   ├── 04-CONCLUSION.md         ← Direct recommendation & action plan
│   ├── 05-IMPLEMENTATION.md     ← Working code patterns
│   ├── 06-SOURCES.md            ← Full source log
│   └── EXPERIMENTS.md           ← Hands-on test results
```

---

## Quality Gates

- `00-BRIEF.md` contains a single-sentence objective: "We are researching [topic] in order to decide [decision]."
- `04-CONCLUSION.md` answers the brief directly with an unequivocal recommendation.
- Code patterns in `05-IMPLEMENTATION.md` must be compatible with React Router 8 and Cloudflare Workers.
- `docs/research/README.md` master index is updated with the topic entry.
