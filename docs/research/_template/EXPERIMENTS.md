# [Topic] — Experimental Log

This is an unnumbered log file to track hands-on trials, local benchmarks, and API responses.

---

## 🧪 Experiment 1: Local Setup & Latency Checks

**Date**: YYYY-MM-DD
**Tester**: [name]

### Objective
Verify connection latency and memory footprint in a Next.js Server Action context.

### Findings & Log Outputs
- Startup time: [X] ms
- First request roundtrip: [Y] ms
- Console dumps:
  ```json
  {
    "status": "success",
    "latencyMs": 48
  }
  ```

---

## 🧪 Experiment 2: Edge Cases & Error Boundaries

**Date**: YYYY-MM-DD

### Objective
Evaluate client behavior when the external API throws a 429 Rate Limit error.

### Findings
- Throw response code matched standard rate limits.
- Action successfully caught output and returned error envelope: `{ success: false, error: 'Rate limit exceeded' }`.
