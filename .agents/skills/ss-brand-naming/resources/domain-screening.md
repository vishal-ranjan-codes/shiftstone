# Domain & Collision Screening Procedures

Deterministic web search queries and DNS screening methods.

## Web Search Collision Screening (Mandatory)
Before presenting any candidate name, execute at least 3 live search queries:
1. `"<CandidateName>" (software OR platform OR SaaS OR company)`
2. `"<CandidateName>" site:github.com`
3. `"<CandidateName>" site:npmjs.com`

**Disqualification Threshold:**
- Drop candidate immediately if an active software product, VC-funded startup, or high-download package shares the exact name in a related tech category.

## Domain Availability Screening (Optional / User-Requested)
When the user requests domain checks (`.com`, `.dev`, `.ai`):
- Run DNS query or RDAP lookup via shell or system tools (e.g. `Resolve-DnsName` on Windows or `dig` / `whois`).
- Status classes:
  - `Available`: No active NS/A records and unassigned in RDAP.
  - `Taken / Active`: Resolves to active production application.
  - `Parked / Secondary Market`: Resolves to standard domain broker parking page.
