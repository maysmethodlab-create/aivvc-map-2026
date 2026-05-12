import React, { useState, useMemo } from "react";
import DATA from "../data/private_dashboard.json";

const PALETTE = {
  maroon: "#500000",
  maroonDeep: "#3C0000",
  maroonMuted: "#732F2F",
  ink: "#000000",
  inkSecondary: "#1A1A1A",
  inkMuted: "#2A2A2A",
  bg: "#FFFFFF",
  bgSubtle: "#F4F1EE",
  bgPanel: "#FAFAFA",
  line: "#999999",
  lineSoft: "#D1D1D1",
  bar: "#7A3838",
  barAccent: "#500000",
  bandLow: "#F5EFEF",
  bandMid: "#E0C9C9",
  bandHigh: "#B57878",
  bandTop: "#732F2F",
};

const FONT_DISPLAY = "'Oswald', Arial, sans-serif";
const FONT_BODY = "'Work Sans', Arial, sans-serif";

const N = 441; // baseline: deduped unique teams with a Team ID

// ---------- Shared primitives ----------

function Pct({ count, total = N, digits = 0 }) {
  if (!total) return null;
  const pct = (count / total) * 100;
  return (
    <span style={{ color: PALETTE.inkMuted, fontSize: "0.9em", marginLeft: 6 }}>
      ({pct.toFixed(digits)}%)
    </span>
  );
}

function Panel({ id, number, title, subtitle, children, note }) {
  return (
    <section
      id={id}
      style={{
        border: `1px solid ${PALETTE.line}`,
        background: PALETTE.bg,
        padding: "22px 24px",
        marginBottom: 24,
      }}
    >
      <header style={{ marginBottom: 14 }}>
        <div
          style={{
            fontFamily: FONT_BODY,
            fontSize: 12,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: PALETTE.maroonMuted,
            fontWeight: 600,
            marginBottom: 4,
          }}
        >
          {number}
        </div>
        <h3
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 500,
            fontSize: "1.35rem",
            margin: 0,
            color: PALETTE.maroon,
          }}
        >
          {title}
        </h3>
        {subtitle && (
          <p
            style={{
              fontFamily: FONT_BODY,
              fontSize: 14,
              color: PALETTE.inkSecondary,
              margin: "6px 0 0 0",
              maxWidth: 720,
            }}
          >
            {subtitle}
          </p>
        )}
      </header>
      <div>{children}</div>
      {note && (
        <p
          style={{
            fontFamily: FONT_BODY,
            fontSize: 12,
            color: PALETTE.inkMuted,
            margin: "14px 0 0 0",
            fontStyle: "italic",
          }}
        >
          {note}
        </p>
      )}
    </section>
  );
}

function SectionHeader({ letter, title, kicker }) {
  return (
    <div
      style={{
        marginTop: 36,
        marginBottom: 16,
        paddingTop: 24,
        borderTop: `2px solid ${PALETTE.maroon}`,
      }}
    >
      <div
        style={{
          fontFamily: FONT_BODY,
          fontSize: 12,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: PALETTE.maroonMuted,
          fontWeight: 700,
          marginBottom: 4,
        }}
      >
        Section {letter}
      </div>
      <h2
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 500,
          fontSize: "1.75rem",
          margin: "0 0 6px 0",
          color: PALETTE.maroon,
          letterSpacing: "0.01em",
        }}
      >
        {title}
      </h2>
      {kicker && (
        <p
          style={{
            fontFamily: FONT_BODY,
            fontSize: 14,
            color: PALETTE.inkSecondary,
            margin: 0,
            maxWidth: 760,
          }}
        >
          {kicker}
        </p>
      )}
    </div>
  );
}

// Horizontal bar chart from [{label, count}].
function BarList({ items, total = N, maxRows = null, showPct = true, color = PALETTE.bar }) {
  if (!items?.length) return <p style={{ color: PALETTE.inkMuted }}>No data.</p>;
  const display = maxRows ? items.slice(0, maxRows) : items;
  const maxCount = Math.max(...display.map((i) => i.count));
  return (
    <div>
      {display.map((it, i) => {
        const w = maxCount ? (it.count / maxCount) * 100 : 0;
        return (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(180px, 32%) 1fr minmax(80px, auto)",
              gap: 10,
              alignItems: "center",
              padding: "4px 0",
              borderBottom: i < display.length - 1 ? `1px solid ${PALETTE.lineSoft}` : "none",
            }}
          >
            <div
              style={{
                fontFamily: FONT_BODY,
                fontSize: 14,
                color: PALETTE.ink,
                paddingRight: 8,
              }}
            >
              {it.label}
            </div>
            <div style={{ height: 14, background: PALETTE.bgSubtle, position: "relative" }}>
              <div
                style={{
                  height: "100%",
                  width: `${w}%`,
                  background: color,
                  opacity: 0.85,
                }}
              />
            </div>
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontVariantNumeric: "tabular-nums",
                fontWeight: 500,
                fontSize: 14,
                color: PALETTE.ink,
                textAlign: "right",
              }}
            >
              {it.count}
              {showPct && <Pct count={it.count} total={total} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Crosstab heatmap. rows / cols are string labels OR objects with `name`.
function Crosstab({ rows, cols, cells, rowLabel = "" }) {
  const max = Math.max(0, ...cells.flat());
  const colorFor = (n) => {
    if (!n) return PALETTE.bg;
    const t = max ? n / max : 0;
    if (t < 0.15) return PALETTE.bandLow;
    if (t < 0.35) return PALETTE.bandMid;
    if (t < 0.65) return PALETTE.bandHigh;
    return PALETTE.bandTop;
  };
  const textFor = (n) => {
    if (!n) return PALETTE.inkMuted;
    const t = max ? n / max : 0;
    return t < 0.35 ? PALETTE.ink : PALETTE.bg;
  };
  const rowLabels = rows.map((r) => (typeof r === "string" ? r : r.name || r.id));
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          borderCollapse: "collapse",
          fontFamily: FONT_BODY,
          fontSize: 13,
          minWidth: "100%",
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                textAlign: "left",
                padding: "8px 10px",
                color: PALETTE.inkMuted,
                fontWeight: 600,
                fontSize: 11,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                borderBottom: `1px solid ${PALETTE.line}`,
                position: "sticky",
                left: 0,
                background: PALETTE.bg,
              }}
            >
              {rowLabel}
            </th>
            {cols.map((c, i) => (
              <th
                key={i}
                style={{
                  padding: "8px 10px",
                  color: PALETTE.inkSecondary,
                  fontWeight: 600,
                  borderBottom: `1px solid ${PALETTE.line}`,
                  textAlign: "right",
                  whiteSpace: "nowrap",
                }}
              >
                {c}
              </th>
            ))}
            <th
              style={{
                padding: "8px 10px",
                color: PALETTE.inkMuted,
                fontWeight: 600,
                fontSize: 11,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                borderBottom: `1px solid ${PALETTE.line}`,
                textAlign: "right",
              }}
            >
              Row total
            </th>
          </tr>
        </thead>
        <tbody>
          {rowLabels.map((rl, ri) => {
            const rowTotal = cells[ri].reduce((s, x) => s + x, 0);
            return (
              <tr key={ri}>
                <td
                  style={{
                    padding: "6px 10px",
                    color: PALETTE.ink,
                    borderBottom: `1px solid ${PALETTE.lineSoft}`,
                    position: "sticky",
                    left: 0,
                    background: PALETTE.bg,
                    fontWeight: 500,
                  }}
                >
                  {rl}
                </td>
                {cells[ri].map((n, ci) => (
                  <td
                    key={ci}
                    style={{
                      padding: "6px 10px",
                      textAlign: "right",
                      borderBottom: `1px solid ${PALETTE.lineSoft}`,
                      background: colorFor(n),
                      color: textFor(n),
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: n ? 500 : 400,
                    }}
                  >
                    {n || "·"}
                  </td>
                ))}
                <td
                  style={{
                    padding: "6px 10px",
                    textAlign: "right",
                    borderBottom: `1px solid ${PALETTE.lineSoft}`,
                    fontVariantNumeric: "tabular-nums",
                    fontWeight: 600,
                    color: PALETTE.inkSecondary,
                  }}
                >
                  {rowTotal}
                </td>
              </tr>
            );
          })}
          <tr>
            <td
              style={{
                padding: "8px 10px",
                color: PALETTE.inkMuted,
                fontSize: 11,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                position: "sticky",
                left: 0,
                background: PALETTE.bg,
                borderTop: `1px solid ${PALETTE.line}`,
              }}
            >
              Col total
            </td>
            {cols.map((_, ci) => {
              const t = cells.reduce((s, row) => s + row[ci], 0);
              return (
                <td
                  key={ci}
                  style={{
                    padding: "8px 10px",
                    textAlign: "right",
                    borderTop: `1px solid ${PALETTE.line}`,
                    color: PALETTE.inkSecondary,
                    fontWeight: 600,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {t}
                </td>
              );
            })}
            <td
              style={{
                padding: "8px 10px",
                textAlign: "right",
                borderTop: `1px solid ${PALETTE.line}`,
                color: PALETTE.maroon,
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {cells.flat().reduce((s, x) => s + x, 0)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ThemeCard({ theme, total }) {
  if (theme.id === "unclassified") {
    return (
      <div
        style={{
          padding: "10px 12px",
          background: PALETTE.bgSubtle,
          fontFamily: FONT_BODY,
          fontSize: 13,
          color: PALETTE.inkMuted,
          marginTop: 8,
        }}
      >
        <strong style={{ color: PALETTE.inkSecondary }}>Unclassified:</strong>{" "}
        {theme.count} {theme.count === 1 ? "response" : "responses"} were blank
        or too vague to fit any theme. <Pct count={theme.count} total={total} />
      </div>
    );
  }
  return (
    <div
      style={{
        marginBottom: 14,
        border: `1px solid ${PALETTE.lineSoft}`,
        padding: "14px 16px",
        background: PALETTE.bg,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 16,
          marginBottom: 6,
        }}
      >
        <h4
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 500,
            fontSize: "1.05rem",
            margin: 0,
            color: PALETTE.ink,
          }}
        >
          {theme.name}
        </h4>
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontVariantNumeric: "tabular-nums",
            fontWeight: 600,
            fontSize: 16,
            color: PALETTE.maroon,
            whiteSpace: "nowrap",
          }}
        >
          {theme.count}
          <Pct count={theme.count} total={total} />
        </div>
      </div>
      {theme.description && (
        <p
          style={{
            fontFamily: FONT_BODY,
            fontSize: 13,
            color: PALETTE.inkSecondary,
            margin: "0 0 10px 0",
          }}
        >
          {theme.description}
        </p>
      )}
      {theme.quotes?.length > 0 && (
        <div style={{ borderLeft: `3px solid ${PALETTE.maroonMuted}`, paddingLeft: 12 }}>
          {theme.quotes.map((q, i) => (
            <blockquote
              key={i}
              style={{
                margin: i === 0 ? "0 0 8px 0" : "8px 0",
                fontFamily: FONT_BODY,
                fontStyle: "italic",
                fontSize: 13,
                color: PALETTE.inkSecondary,
                lineHeight: 1.5,
              }}
            >
              “{q.text}”
              <div
                style={{
                  fontStyle: "normal",
                  fontSize: 11,
                  color: PALETTE.inkMuted,
                  marginTop: 2,
                  letterSpacing: "0.05em",
                }}
              >
                — {q.teamId}
              </div>
            </blockquote>
          ))}
        </div>
      )}
    </div>
  );
}

function ThemeList({ themeBlock }) {
  const total = themeBlock.totalResponses || N;
  // Sort by count descending, unclassified always last.
  const sorted = [...themeBlock.themes].sort((a, b) => {
    if (a.id === "unclassified") return 1;
    if (b.id === "unclassified") return -1;
    return b.count - a.count;
  });
  return (
    <div>
      {sorted.map((th) => (
        <ThemeCard key={th.id} theme={th} total={total} />
      ))}
    </div>
  );
}

// ---------- Sections ----------

function SectionA() {
  const a = DATA.sectionA_pipeline;
  return (
    <>
      <SectionHeader
        letter="A"
        title="Pipeline & data hygiene"
        kicker="What's in the raw form export, and how we got from there to the working set the rest of the dashboard uses."
      />
      <Panel
        number="A1"
        title="Raw form → working set"
        subtitle={`The CSV had ${a.rawRows} rows. ${a.blankTeamIdRows} were submitted without a Team ID and excluded; the remaining ${a.nonEmptyTeamIdRows} include ${a.trueDuplicatesCollapsed} true duplicates (same Team ID, multiple submissions) which were collapsed to the latest. Every metric below is computed from the ${a.uniqueTeams}-team working set.`}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <Stat label="Raw form rows" value={a.rawRows} />
          <Stat label="Rows with blank Team ID (excluded)" value={a.blankTeamIdRows} />
          <Stat label="Non-empty Team ID rows" value={a.nonEmptyTeamIdRows} />
          <Stat label="True duplicates collapsed" value={a.trueDuplicatesCollapsed} />
          <Stat label="Unique Team IDs (working set)" value={a.uniqueTeams} highlight />
        </div>
        <p
          style={{
            fontFamily: FONT_BODY,
            fontSize: 13,
            color: PALETTE.inkSecondary,
            margin: 0,
          }}
        >
          <strong>Dedup rule:</strong> {a.rule}
        </p>
      </Panel>
    </>
  );
}

function Stat({ label, value, highlight = false }) {
  return (
    <div
      style={{
        border: `1px solid ${highlight ? PALETTE.maroon : PALETTE.lineSoft}`,
        padding: "12px 14px",
        background: highlight ? "#FFF8F5" : PALETTE.bg,
      }}
    >
      <div
        style={{
          fontFamily: FONT_BODY,
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: PALETTE.inkMuted,
          marginBottom: 4,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontVariantNumeric: "tabular-nums",
          fontSize: 28,
          fontWeight: 500,
          color: highlight ? PALETTE.maroon : PALETTE.ink,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SectionB() {
  const b = DATA.sectionB_diversity;
  const sc = b.stateCoverage;
  return (
    <>
      <SectionHeader
        letter="B"
        title="Institutional diversity"
        kicker="Deliberately complementary to the public map: this section surfaces breadth, gaps, and on-campus structure — not a leaderboard."
      />
      <Panel
        number="B1"
        title="Where teams sit inside their institution"
        subtitle="College / school / department of the primary contact. Useful for spotting where entrepreneurial energy actually lives on each campus — Engineering vs. Business vs. Liberal Arts, etc."
      >
        <BarList items={b.collegeMix} />
      </Panel>

      <Panel
        number="B2"
        title="State coverage"
        subtitle="How wide the geographic reach is, and where the gaps are for next year's outreach."
        note="State assignment is derived from the institution name matching the public IPEDS-enriched institution list used by the main map."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 16,
            marginBottom: 18,
          }}
        >
          <Stat label="States with ≥1 team" value={sc.statesRepresented} highlight />
          <Stat label="Thin states (1–2 teams)" value={sc.thinStates.length} />
          <Stat label="States with no teams" value={sc.statesZero.length} />
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 18,
            marginBottom: 16,
          }}
        >
          <div>
            <h5
              style={{
                fontFamily: FONT_BODY,
                fontSize: 12,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: PALETTE.inkMuted,
                margin: "0 0 8px 0",
                fontWeight: 700,
              }}
            >
              Thin states (≤2 teams)
            </h5>
            <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: PALETTE.ink }}>
              {sc.thinStates.length === 0 ? (
                <em style={{ color: PALETTE.inkMuted }}>None.</em>
              ) : (
                sc.thinStates.map((s, i) => (
                  <span key={s.state}>
                    {s.state} <span style={{ color: PALETTE.inkMuted }}>({s.count})</span>
                    {i < sc.thinStates.length - 1 ? " · " : ""}
                  </span>
                ))
              )}
            </div>
          </div>
          <div>
            <h5
              style={{
                fontFamily: FONT_BODY,
                fontSize: 12,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: PALETTE.inkMuted,
                margin: "0 0 8px 0",
                fontWeight: 700,
              }}
            >
              Zero-team states (gap list for 2027)
            </h5>
            <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: PALETTE.ink }}>
              {sc.statesZero.length === 0 ? (
                <em style={{ color: PALETTE.inkMuted }}>Every state had at least one team.</em>
              ) : (
                sc.statesZero.join(" · ")
              )}
            </div>
          </div>
        </div>
        <details>
          <summary
            style={{
              cursor: "pointer",
              fontFamily: FONT_BODY,
              fontSize: 12,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: PALETTE.maroonMuted,
              fontWeight: 700,
            }}
          >
            All states with team counts
          </summary>
          <div style={{ marginTop: 10 }}>
            <BarList items={sc.perState} showPct={false} />
          </div>
        </details>
      </Panel>

      <Panel
        number="B3"
        title="Faculty / staff contact role"
        subtitle="Who is signing off on each team's status. Tells you which kind of campus relationship — research faculty vs. entrepreneurship-center staff vs. dean — actually carried teams across the finish line."
      >
        <BarList items={b.facultyContactRole} />
      </Panel>

      {b.diagnostics?.institutionsUnmatchedToIPEDS?.length > 0 && (
        <Panel
          number="B4"
          title="Data hygiene: institutions not matched to IPEDS"
          subtitle="Institution names from the form that did not exactly match the public map's IPEDS-enriched institution list. Usually typos or abbreviations; these teams are still in every count but are not assigned to a state."
        >
          <details>
            <summary
              style={{
                cursor: "pointer",
                fontFamily: FONT_BODY,
                fontSize: 13,
                color: PALETTE.maroon,
                fontWeight: 600,
              }}
            >
              {b.diagnostics.institutionsUnmatchedToIPEDS.length} unmatched institution names
            </summary>
            <div
              style={{
                marginTop: 12,
                fontFamily: FONT_BODY,
                fontSize: 13,
                color: PALETTE.ink,
                lineHeight: 1.7,
              }}
            >
              {b.diagnostics.institutionsUnmatchedToIPEDS.join(" · ")}
            </div>
          </details>
        </Panel>
      )}
    </>
  );
}

function SectionC() {
  const c = DATA.sectionC_who;
  return (
    <>
      <SectionHeader
        letter="C"
        title="Who the teams are"
        kicker="Team composition, student level, when they graduate, what they study."
      />
      <Panel number="C1" title="Team size distribution">
        <BarList items={c.teamSize} />
      </Panel>
      <Panel
        number="C2"
        title="Student level"
        subtitle="Level of the primary contact at the time of application (May 1, 2026)."
      >
        <BarList items={c.studentLevel} />
      </Panel>
      <Panel
        number="C3"
        title="Expected / actual graduation year"
        subtitle="When the primary contact leaves their institution — relevant for thinking about post-Challenge continuity."
      >
        <BarList items={c.gradYear} />
      </Panel>
      <Panel
        number="C4"
        title="Major / degree program rollup"
        subtitle="Coarse rollup of free-text degree-program responses — exact major taxonomies vary by school, so categories are normalized."
      >
        <BarList items={c.majorMix} />
      </Panel>
      <Panel
        number="C5"
        title="Teams with non-student contributors"
        subtitle="Teams that described at least one external advisor, mentor, or non-student contributor on the team roster."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
          }}
        >
          <Stat label="Teams with non-student contributors" value={c.nonStudentContributors.teamsWith} highlight />
          <Stat label="All-student teams" value={c.nonStudentContributors.teamsWithout} />
        </div>
      </Panel>
    </>
  );
}

function SectionD() {
  const d = DATA.sectionD_venture;
  return (
    <>
      <SectionHeader
        letter="D"
        title="Venture profile"
        kicker="Where each team is in the venture lifecycle, and what they brought with them."
      />
      <Panel number="D1" title="Current venture stage">
        <BarList items={d.stage} />
      </Panel>
      <Panel
        number="D2"
        title="Prior venture experience × current stage"
        subtitle="Did teams with prior founding experience self-report as further along on the venture-stage scale? Read across each row."
      >
        <Crosstab
          rows={d.priorVentureByStage.rows}
          cols={d.priorVentureByStage.cols}
          cells={d.priorVentureByStage.cells}
          rowLabel="Prior venture?"
        />
      </Panel>
      <Panel
        number="D3"
        title="“Did you consider yourself an entrepreneur before applying?”"
      >
        <BarList items={d.selfIdEntrepreneur} />
      </Panel>
      <Panel
        number="D4"
        title="Stage × team size"
        subtitle="Are solo founders concentrated at the idea stage, or do they ship MVPs too?"
      >
        <Crosstab
          rows={d.stageByTeamSize.rows}
          cols={d.stageByTeamSize.cols}
          cells={d.stageByTeamSize.cells}
          rowLabel="Stage"
        />
      </Panel>
    </>
  );
}

function SectionE() {
  const e = DATA.sectionE_ai;
  return (
    <>
      <SectionHeader
        letter="E"
        title="AI fluency"
        kicker="Self-rated experience, tools in the bag, and how that maps onto venture stage and student level."
      />
      <Panel number="E1" title="Self-rated AI experience">
        <BarList items={e.selfRated} />
      </Panel>
      <Panel
        number="E2"
        title="AI tools teams use or plan to use"
        subtitle="Multi-select. Each team can name several tools, so the column total exceeds 441."
      >
        <BarList items={e.toolsUsed} total={N} showPct={false} />
      </Panel>
      <Panel
        number="E3"
        title="AI experience × venture stage"
        subtitle="Does AI fluency track with venture maturity, or do beginners ship too?"
      >
        <Crosstab
          rows={e.experienceByStage.rows}
          cols={e.experienceByStage.cols}
          cells={e.experienceByStage.cells}
          rowLabel="AI experience"
        />
      </Panel>
      <Panel
        number="E4"
        title="AI experience × student level"
        subtitle="Are undergrads more or less AI-fluent than master's students in this cohort?"
      >
        <Crosstab
          rows={e.experienceByStudentLevel.rows}
          cols={e.experienceByStudentLevel.cols}
          cells={e.experienceByStudentLevel.cells}
          rowLabel="AI experience"
        />
      </Panel>
    </>
  );
}

function SectionF() {
  const f = DATA.sectionF_qualitative;
  return (
    <>
      <SectionHeader
        letter="F"
        title="What teams said in their own words"
        kicker="Open-text responses clustered into 10–12 themes per question, with verbatim quotes. Quotes are anonymized for institution / personal identifiers but otherwise unchanged."
      />
      <Panel
        number="F1"
        title="What teams hope to learn, test, prove, or build by end of June"
        subtitle="Single most important qualitative question. Each team's response is assigned to one primary theme; if responses were genuinely multi-theme, the dominant one was chosen."
        note="Verified: every quote shown is a verbatim substring of an actual form response (anonymized for emails/URLs)."
      >
        {f.hopeToLearn?.themes ? (
          <ThemeList themeBlock={f.hopeToLearn} />
        ) : (
          <em>Themes not yet generated.</em>
        )}
      </Panel>

      {f.hopeToLearnByLevel?.rows && (
        <Panel
          number="F2"
          title="What they hope to learn × student level"
          subtitle="Same themes as F1, broken out by undergraduate / master's / doctoral. Helps tailor Stage 1 programming for each cohort."
        >
          <Crosstab
            rows={f.hopeToLearnByLevel.rows}
            cols={f.hopeToLearnByLevel.cols}
            cells={f.hopeToLearnByLevel.cells}
            rowLabel="Theme"
          />
        </Panel>
      )}

      {f.hopeToLearnByStage?.rows && (
        <Panel
          number="F3"
          title="What they hope to learn × current venture stage"
          subtitle="Idea-stage teams tend to want validation; later-stage teams tend to want pricing and growth. Quantifies that intuition."
        >
          <Crosstab
            rows={f.hopeToLearnByStage.rows}
            cols={f.hopeToLearnByStage.cols}
            cells={f.hopeToLearnByStage.cells}
            rowLabel="Theme"
          />
        </Panel>
      )}

      <Panel
        number="F4"
        title="Why teams joined the AI Venture Velocity Challenge"
        subtitle="Useful for messaging next year's outreach — and for understanding which program elements actually attract teams."
      >
        {f.whyJoined?.themes ? (
          <ThemeList themeBlock={f.whyJoined} />
        ) : (
          <em>Themes not yet generated.</em>
        )}
      </Panel>

      <Panel
        number="F5"
        title="How teams expect AI to help during the Challenge"
        subtitle="Together with E2 (tools used), this shows where AI is expected to do real work vs. provide marginal assist."
      >
        {f.aiHelpHow?.themes ? (
          <ThemeList themeBlock={f.aiHelpHow} />
        ) : (
          <em>Themes not yet generated.</em>
        )}
      </Panel>

      <Panel
        number="F6"
        title="Anything else they wanted us to know"
        subtitle={`Curated browsable list of substantive non-empty responses (out of 441 — most teams left this blank or wrote thank-you boilerplate).`}
      >
        {f.anythingElse?.curatedList ? (
          <div style={{ borderLeft: `3px solid ${PALETTE.maroonMuted}`, paddingLeft: 14 }}>
            {f.anythingElse.curatedList.map((q, i) => (
              <blockquote
                key={i}
                style={{
                  margin: i === 0 ? "0 0 14px 0" : "14px 0",
                  fontFamily: FONT_BODY,
                  fontStyle: "italic",
                  fontSize: 14,
                  color: PALETTE.inkSecondary,
                  lineHeight: 1.55,
                }}
              >
                “{q.text}”
                <div
                  style={{
                    fontStyle: "normal",
                    fontSize: 11,
                    color: PALETTE.inkMuted,
                    marginTop: 4,
                    letterSpacing: "0.05em",
                  }}
                >
                  — {q.teamId}
                </div>
              </blockquote>
            ))}
          </div>
        ) : (
          <em>No curated list available.</em>
        )}
      </Panel>
    </>
  );
}

function SectionG() {
  const g = DATA.sectionG_marketing;
  return (
    <>
      <SectionHeader
        letter="G"
        title="Marketing attribution: how teams heard about the Challenge"
        kicker="The most decision-relevant section for the 2027 marketing plan. Where did teams come in from, and which channels brought which kinds of teams?"
      />
      <Panel
        number="G1"
        title="Channel rollup"
        subtitle="One primary channel per team, mapped from the free-text “How did you hear about it?” field."
        note="Free-text responses are bucketed by keyword. Where a response mentioned multiple sources, the first identifiable channel is used."
      >
        <BarList items={g.channelRollup} color={PALETTE.barAccent} />
      </Panel>

      <Panel
        number="G2"
        title="Channel × top 12 institutions"
        subtitle="Which channels are doing the actual work at each of the 12 institutions with the most confirmed teams?"
      >
        <Crosstab
          rows={g.channelByInstitution.rows}
          cols={g.channelByInstitution.cols}
          cells={g.channelByInstitution.cells}
          rowLabel="Channel"
        />
      </Panel>

      <Panel
        number="G3"
        title="Channel × venture stage"
        subtitle="Do certain channels attract more mature ventures, or is the mix flat?"
      >
        <Crosstab
          rows={g.channelByStage.rows}
          cols={g.channelByStage.cols}
          cells={g.channelByStage.cells}
          rowLabel="Channel"
        />
      </Panel>

      <Panel
        number="G4"
        title="Channel × student level"
        subtitle="Are undergrads coming in through different doors than master's students?"
      >
        <Crosstab
          rows={g.channelByStudentLevel.rows}
          cols={g.channelByStudentLevel.cols}
          cells={g.channelByStudentLevel.cells}
          rowLabel="Channel"
        />
      </Panel>

      <Panel
        number="G5"
        title="Texas A&M vs. non-TAMU channel mix"
        subtitle="Side-by-side comparison of how home-base teams found the Challenge vs. how everyone else did. Big mix differences are signal for the 2027 plan."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 24,
          }}
        >
          <div>
            <h5
              style={{
                fontFamily: FONT_BODY,
                fontSize: 12,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: PALETTE.maroonMuted,
                margin: "0 0 10px 0",
                fontWeight: 700,
              }}
            >
              Texas A&M teams ({g.tamuVsNonTAMU.TAMU.reduce((s, x) => s + x.count, 0)})
            </h5>
            <BarList
              items={g.tamuVsNonTAMU.TAMU}
              total={g.tamuVsNonTAMU.TAMU.reduce((s, x) => s + x.count, 0)}
              color={PALETTE.barAccent}
            />
          </div>
          <div>
            <h5
              style={{
                fontFamily: FONT_BODY,
                fontSize: 12,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: PALETTE.maroonMuted,
                margin: "0 0 10px 0",
                fontWeight: 700,
              }}
            >
              All other institutions ({g.tamuVsNonTAMU.NonTAMU.reduce((s, x) => s + x.count, 0)})
            </h5>
            <BarList
              items={g.tamuVsNonTAMU.NonTAMU}
              total={g.tamuVsNonTAMU.NonTAMU.reduce((s, x) => s + x.count, 0)}
              color={PALETTE.bar}
            />
          </div>
        </div>
      </Panel>
    </>
  );
}

// ---------- Password gate ----------

const PASSWORD = "levi2026";
const SESSION_KEY = "aivvc-levi-hari-unlocked";

function PasswordGate({ children }) {
  const [unlocked, setUnlocked] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY) === "yes";
    } catch {
      return false;
    }
  });
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  if (unlocked) return children;

  const submit = (e) => {
    e.preventDefault();
    if (input.trim() === PASSWORD) {
      try {
        sessionStorage.setItem(SESSION_KEY, "yes");
      } catch {}
      setUnlocked(true);
    } else {
      setError(true);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: PALETTE.bg,
        fontFamily: FONT_BODY,
        color: PALETTE.ink,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <form
        onSubmit={submit}
        style={{
          maxWidth: 420,
          width: "100%",
          border: `1px solid ${PALETTE.line}`,
          padding: "28px 28px",
          background: PALETTE.bg,
        }}
      >
        <div
          style={{
            fontFamily: FONT_BODY,
            fontSize: 12,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: PALETTE.maroonMuted,
            fontWeight: 700,
            marginBottom: 6,
          }}
        >
          AIVVC 2026 · internal
        </div>
        <h1
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 500,
            fontSize: "1.5rem",
            margin: "0 0 8px 0",
            color: PALETTE.maroon,
          }}
        >
          Restricted page
        </h1>
        <p
          style={{
            fontSize: 14,
            color: PALETTE.inkSecondary,
            margin: "0 0 18px 0",
            lineHeight: 1.5,
          }}
        >
          This page is for the AIVVC core team. Enter the access phrase to continue.
        </p>
        <label
          htmlFor="aivvc-password"
          style={{
            display: "block",
            fontSize: 12,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: PALETTE.inkMuted,
            marginBottom: 4,
            fontWeight: 600,
          }}
        >
          Access phrase
        </label>
        <input
          id="aivvc-password"
          type="password"
          autoFocus
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError(false);
          }}
          style={{
            width: "100%",
            padding: "10px 12px",
            fontFamily: FONT_BODY,
            fontSize: 16,
            border: `1px solid ${error ? PALETTE.maroon : PALETTE.ink}`,
            background: PALETTE.bg,
            color: PALETTE.ink,
            boxSizing: "border-box",
            outline: "none",
            marginBottom: 14,
          }}
        />
        <button
          type="submit"
          style={{
            width: "100%",
            padding: "10px 14px",
            background: PALETTE.maroon,
            color: PALETTE.bg,
            border: "none",
            fontFamily: FONT_BODY,
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
            letterSpacing: "0.02em",
          }}
        >
          Enter
        </button>
        {error && (
          <p
            style={{
              color: PALETTE.maroon,
              fontSize: 13,
              marginTop: 10,
              marginBottom: 0,
            }}
            role="alert"
          >
            That doesn't look right. Try again.
          </p>
        )}
        <p
          style={{
            fontSize: 12,
            color: PALETTE.inkMuted,
            marginTop: 18,
            marginBottom: 0,
            lineHeight: 1.5,
          }}
        >
          If you reached this page by accident, you can return to the{" "}
          <a href="/" style={{ color: PALETTE.maroonDeep }}>
            public AIVVC map
          </a>
          .
        </p>
      </form>
    </div>
  );
}

// ---------- Top-level dashboard ----------

function Header() {
  return (
    <header
      style={{
        borderBottom: `2px solid ${PALETTE.maroon}`,
        paddingBottom: 18,
        marginBottom: 24,
      }}
    >
      <div
        style={{
          fontFamily: FONT_BODY,
          fontSize: 12,
          letterSpacing: "0.18em",
          color: PALETTE.maroonMuted,
          textTransform: "uppercase",
          marginBottom: 6,
          fontWeight: 700,
        }}
      >
        AIVVC 2026 · internal dashboard · not for distribution
      </div>
      <h1
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 400,
          fontSize: "clamp(1.7rem, 3.5vw, 2.4rem)",
          lineHeight: 1.2,
          margin: "0 0 0.4rem 0",
          color: PALETTE.maroon,
        }}
      >
        Team Confirmation Form — internal deep dive
      </h1>
      <p
        style={{
          fontSize: 15,
          lineHeight: 1.55,
          maxWidth: 780,
          margin: 0,
          color: PALETTE.inkSecondary,
        }}
      >
        Twenty-five panels across seven sections — institutional diversity,
        team composition, venture profile, AI fluency, open-text themes, and
        marketing attribution — drawn from {N} unique confirmed teams.
        Generated {new Date(DATA.generatedAt).toLocaleString()}.
      </p>
      <p
        style={{
          fontSize: 13,
          marginTop: 10,
          marginBottom: 0,
          color: PALETTE.inkMuted,
        }}
      >
        Quotes are anonymized; per-team identifiers are limited to the opaque
        Team ID. Numbers in this dashboard come from the confirmation-form
        export only — they do not include the ~87 of the 528 original
        applications that have not (yet) submitted a confirmation form.
      </p>
    </header>
  );
}

function TableOfContents() {
  const items = [
    ["A", "Pipeline & data hygiene", "sec-A"],
    ["B", "Institutional diversity", "sec-B"],
    ["C", "Who the teams are", "sec-C"],
    ["D", "Venture profile", "sec-D"],
    ["E", "AI fluency", "sec-E"],
    ["F", "What teams said in their own words", "sec-F"],
    ["G", "Marketing attribution", "sec-G"],
  ];
  return (
    <nav
      aria-label="Section navigation"
      style={{
        border: `1px solid ${PALETTE.lineSoft}`,
        padding: "14px 16px",
        marginBottom: 24,
        background: PALETTE.bgPanel,
      }}
    >
      <div
        style={{
          fontFamily: FONT_BODY,
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: PALETTE.inkMuted,
          marginBottom: 6,
          fontWeight: 700,
        }}
      >
        Jump to section
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        {items.map(([l, t, id]) => (
          <a
            key={l}
            href={`#${id}`}
            style={{
              fontFamily: FONT_BODY,
              fontSize: 13,
              color: PALETTE.maroonDeep,
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            <strong>{l}.</strong> {t}
          </a>
        ))}
      </div>
    </nav>
  );
}

function DashboardBody() {
  // Wire ids onto SectionHeader anchors via wrappers.
  return (
    <div
      style={{
        fontFamily: FONT_BODY,
        background: PALETTE.bg,
        minHeight: "100vh",
        color: PALETTE.ink,
      }}
    >
      <div
        role="banner"
        style={{
          background: PALETTE.maroon,
          color: PALETTE.bg,
          fontFamily: FONT_BODY,
          fontSize: 14,
          padding: "8px 24px",
          letterSpacing: "0.02em",
        }}
      >
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <a
            href="/"
            style={{ color: PALETTE.bg, textDecoration: "none", marginRight: 8 }}
          >
            ← Public AIVVC map
          </a>
          <span aria-hidden="true" style={{ opacity: 0.6, margin: "0 8px" }}>
            ·
          </span>
          <span style={{ opacity: 0.85 }}>
            Internal dashboard (not linked from the public site)
          </span>
        </div>
      </div>

      <main style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 24px 48px" }}>
        <Header />
        <TableOfContents />
        <div id="sec-A"><SectionA /></div>
        <div id="sec-B"><SectionB /></div>
        <div id="sec-C"><SectionC /></div>
        <div id="sec-D"><SectionD /></div>
        <div id="sec-E"><SectionE /></div>
        <div id="sec-F"><SectionF /></div>
        <div id="sec-G"><SectionG /></div>

        <footer
          style={{
            marginTop: 48,
            paddingTop: 18,
            borderTop: `1px solid ${PALETTE.line}`,
            fontFamily: FONT_BODY,
            fontSize: 12,
            color: PALETTE.inkMuted,
            lineHeight: 1.6,
          }}
        >
          Internal AIVVC dashboard · for Hari, Levi, and the core team. Not for
          public distribution. Built {new Date(DATA.generatedAt).toLocaleDateString()}.
          Data source: Team Confirmation Form responses (Google Forms export).
        </footer>
      </main>
    </div>
  );
}

export default function PrivateDashboard() {
  return (
    <PasswordGate>
      <DashboardBody />
    </PasswordGate>
  );
}
