# Private internal dashboard — design (2026-05-12)

## What

A second page on the same React app, hidden behind an obscure URL and a
client-side password gate, that surfaces internal analytics from the
Team Confirmation Form (442 unique teams). Audience: Hari, Levi,
Mahadev, and the AIVVC core team. Not intended to be discovered by
applicants or the public.

## Why

The public map shows *where* the 528 ventures came from. The team
confirmation form has 35 columns of qualitative and quantitative detail
that the public map deliberately does not show (team composition,
venture stage, AI fluency, what teams hope to learn, how they heard
about the challenge, etc.). This data shapes program decisions
(marketing attribution, Stage 1 design, mentor matching) but should not
be surfaced publicly.

## Route, gate, data

- URL slug: `/levi-hari-private`
- Password: `levi2026` (client-side gate, security-by-obscurity, no PII
  in the bundle)
- Data: pre-aggregated JSON bundled into the JS at build time. No
  individual team names, applicant names, or emails ship to the
  browser. Quotes are anonymized (institution + personal identifiers
  scrubbed). Counts and shares are computed offline.
- Dedup rule: 466 raw rows deduped to 442 by Team ID, keeping the
  latest submission per Team ID (latest Timestamp wins).

## Sections (7)

A. Pipeline & data hygiene (1 panel: dedup note)
B. Institutional diversity (4 panels — *avoids what the public map
  already shows*): MSI representation deliberately omitted per Hari;
  breadth of institution types, state coverage, within-institution
  colleges/departments, faculty-contact role mix
C. Who the teams are (5 panels): team size, student level, graduation
  year, major rollup, non-student contributors
D. Venture profile (4 panels): stage, prior-venture × stage,
  entrepreneur self-id, stage × team-size
E. AI fluency (4 panels): self-rated experience, tools used, experience
  × stage, experience × student level
F. Qualitative themes (6 panels, 10-12 themes each, with quotes): what
  they hope to learn (overall + by student level + by stage), why they
  joined, how they expect AI to help, browsable "anything else"
G. Marketing attribution (5 panels): channel rollup, channel ×
  institution, channel × stage, channel × student level, TAMU vs
  non-TAMU channel mix

## Architecture

Single-page React (same Vite app). `main.jsx` switches between
`<Map />` and `<PasswordGate><PrivateDashboard /></PasswordGate>` based
on `window.location.pathname`. No router library added.

Data pipeline: `scripts/build_private_dashboard.mjs` reads the CSV,
dedupes, aggregates, and writes `src/data/private_dashboard.json`.
Themes (F section) are clustered by Claude offline (15-20 reduced to
10-12 per question per Hari) and written into the same JSON, with
quote attribution traceable to Team ID for verification.

## Verification (post-build)

Two parallel subagents, as Hari requested:

1. **Correctness agent**: independently re-derive numeric stats from
   the CSV; confirm dedup rule; confirm crosstab totals.
2. **Hallucination agent**: verify every quoted text exists verbatim
   in the CSV; confirm theme labels accurately describe the cluster
   contents; flag any unsupported claim.

## Out of scope (v1)

- Real server-side auth (would require moving off Render's static plan)
- Per-team detail drill-down (privacy)
- The 528 → 441 gap analysis (per Hari: "focus on 442 for now")
- Carnegie tier and leaderboard framing (per Hari: elitist)
- MSI representation panel (per Hari: out for v1)
