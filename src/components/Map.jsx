import React, { useState, useMemo, useEffect } from "react";
import * as d3 from "d3";
import RAW_DATA from "../data/institutions.json";
import THEMES from "../data/themes.json";

const THEME_ORDER = [
  "Healthcare",
  "Industrial / Energy",
  "Productivity & Workflow",
  "Education",
  "Personal & Lifestyle",
  "Media / Creative",
  "Public Sector / Civic",
  "Finance",
  "Frontier / Deep Tech",
  "Other",
];

const THEME_COLORS = {
  Healthcare: "#c41230",
  "Industrial / Energy": "#5a7d4a",
  "Productivity & Workflow": "#0a4d68",
  Education: "#2d5d3a",
  "Personal & Lifestyle": "#d4a017",
  "Media / Creative": "#9c5a3c",
  "Public Sector / Civic": "#5a3838",
  Finance: "#1f3a8a",
  "Frontier / Deep Tech": "#6b21a8",
  Other: "#999999",
};

const TAG_DISPLAY = {
  "llm-app": "LLM application",
  "decision-support": "Decision support",
  "data-analytics": "Data & analytics",
  "workflow-automation": "Workflow automation",
  "computer-vision": "Computer vision",
  "ai-agents": "AI agents",
  "voice-ai": "Voice / audio AI",
  marketplace: "Marketplace",
  "search-retrieval": "Search / retrieval",
  robotics: "Robotics",
  biotech: "Biotech",
  "video-gen": "Video generation",
  "image-gen": "Image generation",
  "developer-tools": "Developer tools",
};

const STAGE_DISPLAY = {
  idea: "Idea",
  prototype: "Prototype",
  mvp: "Working MVP",
  traction: "Has traction",
};

const TARGET_DISPLAY = {
  consumer: "Consumer",
  smb: "Small / mid-market",
  enterprise: "Enterprise",
  government: "Government",
  research: "Research",
  mixed: "Mixed segments",
};

const RAW = RAW_DATA;
// Computed total from data is 529; Levi reports 528 externally (single-app
// reconciliation diff). We display 528 to stay consistent with Levi's
// communications. Percentage math still uses the computed total.
const TOTAL_APPS_DISPLAY = 528;
const TOTAL_APPS = RAW.reduce((s, x) => s + x.count, 0);
const TOTAL_INSTITUTIONS = RAW.length;

const PALETTE = {
  maroon: "#500000",
  maroonDeep: "#3a0000",
  ink: "#1a1a1a",
  cream: "#f5f1e8",
  paper: "#fffdf7",
  rule: "#1a1a1a",
  muted: "#3a3a3a",
  faint: "#999",
  gold: "#d4a017",
  paleRule: "#e8e0cf",
};

const CARNEGIE_DISPLAY = {
  R1: "R1: Very High Research",
  R2: "R2: High Research",
  DPU: "Doctoral / Professional",
  Masters: "Master's",
  Baccalaureate: "Baccalaureate",
  BaccAssoc: "Baccalaureate / Associate's",
  Associates: "Associate's",
  SpecialFocus: "Special Focus",
  Tribal: "Tribal College",
  NotApplicable: "Other",
  NotClassified: "Other",
  Unknown: "Other",
};

const CARNEGIE_COLORS = {
  R1: "#500000",
  R2: "#9c5a3c",
  DPU: "#7a3838",
  Masters: "#0a4d68",
  Baccalaureate: "#2d5d3a",
  BaccAssoc: "#5a7d4a",
  Associates: "#d4a017",
  SpecialFocus: "#6b21a8",
  Tribal: "#8b6914",
  Other: "#666666",
};

const CARNEGIE_ORDER = [
  "R1",
  "R2",
  "DPU",
  "Masters",
  "Baccalaureate",
  "BaccAssoc",
  "Associates",
  "SpecialFocus",
  "Tribal",
  "Other",
];

function carnegieKey(d) {
  return CARNEGIE_DISPLAY[d.carnegie] ? d.carnegie : "Other";
}

function dotR(count) {
  if (count >= 100) return 22;
  if (count >= 20) return 14;
  if (count >= 10) return 11;
  if (count >= 5) return 8;
  if (count >= 2) return 5.5;
  return 3.8;
}

export default function Map() {
  const [hovered, setHovered] = useState(null);
  const [search, setSearch] = useState("");
  const [colorMode, setColorMode] = useState("default"); // default | carnegie
  const [scaleMode, setScaleMode] = useState("count"); // count | percapita
  const [topojson, setTopojson] = useState(null);
  const [zoomedSchool, setZoomedSchool] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [selectedTheme, setSelectedTheme] = useState(null);

  const themePresence = THEMES.themeByUnitidPresence || {};
  const matchesFilter = (d) => {
    if (selectedRegion && d.region !== selectedRegion) return false;
    if (selectedTheme) {
      const themes = themePresence[String(d.unitid)] || [];
      if (!themes.includes(selectedTheme)) return false;
    }
    return true;
  };
  const hasFilter = !!(selectedRegion || selectedTheme);

  const W = 980,
    H = 580;

  const projection = useMemo(
    () =>
      d3
        .geoAlbersUsa()
        .scale(1180)
        .translate([W / 2, H / 2 - 20]),
    []
  );

  useEffect(() => {
    let cancelled = false;
    fetch("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setTopojson(data);
      })
      .catch((err) => console.error("Topojson load failed", err));
    return () => {
      cancelled = true;
    };
  }, []);

  const stateFeatures = useMemo(() => {
    if (!topojson) return [];
    return decodeTopojson(topojson, "states");
  }, [topojson]);

  const pathGenerator = useMemo(
    () => d3.geoPath().projection(projection),
    [projection]
  );

  const top10 = useMemo(() => {
    return [...RAW].sort((a, b) => b.count - a.count).slice(0, 10);
  }, []);
  const top10Set = useMemo(() => new Set(top10.map((d) => d.unitid)), [top10]);

  const filtered = useMemo(() => {
    if (search === "") return RAW;
    const q = search.toLowerCase();
    return RAW.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.cityState.toLowerCase().includes(q)
    );
  }, [search]);

  const sorted = useMemo(() => [...RAW].sort((a, b) => b.count - a.count), []);

  const perCapitaSorted = useMemo(() => {
    return [...RAW]
      .filter((d) => d.enrollment && d.enrollment > 0)
      .map((d) => ({ ...d, perCapita: (d.count / d.enrollment) * 1000 }))
      .sort((a, b) => b.perCapita - a.perCapita);
  }, []);

  const regionStats = useMemo(() => {
    const order = ["South", "Northeast", "West", "Midwest"];
    return order.map((r) => {
      const items = RAW.filter((d) => d.region === r);
      const apps = items.reduce((s, x) => s + x.count, 0);
      const top = items.sort((a, b) => b.count - a.count)[0];
      return {
        region: r,
        apps,
        share: (apps / TOTAL_APPS) * 100,
        schools: items.length,
        topSchool: top?.name || "—",
        topCount: top?.count || 0,
      };
    });
  }, []);

  const paretoData = useMemo(() => {
    let cum = 0;
    return sorted.map((d, i) => {
      cum += d.count;
      return {
        rank: i + 1,
        name: d.name,
        cumPct: (cum / TOTAL_APPS) * 100,
      };
    });
  }, [sorted]);

  const carnegieStats = useMemo(() => {
    const map = {};
    RAW.forEach((d) => {
      const k = carnegieKey(d);
      if (!map[k]) map[k] = { key: k, label: CARNEGIE_DISPLAY[k], apps: 0, schools: 0 };
      map[k].apps += d.count;
      map[k].schools += 1;
    });
    return CARNEGIE_ORDER.map((k) => map[k]).filter(Boolean);
  }, []);

  const top10Apps = top10.reduce((s, x) => s + x.count, 0);
  const top30Apps = sorted.slice(0, 30).reduce((s, x) => s + x.count, 0);
  const longTailInstitutions = RAW.filter((d) => d.count === 1).length;

  const getDotColor = (d) => {
    if (colorMode === "carnegie") {
      const k = carnegieKey(d);
      return CARNEGIE_COLORS[k] || PALETTE.muted;
    }
    return "#7a3838";
  };

  useEffect(() => {
    if (search.length >= 3) {
      const match = RAW.find((d) =>
        d.name.toLowerCase().includes(search.toLowerCase())
      );
      if (match) setZoomedSchool(match);
      else setZoomedSchool(null);
    } else {
      setZoomedSchool(null);
    }
  }, [search]);

  return (
    <div
      style={{
        fontFamily: "'Source Serif Pro', 'Crimson Text', Georgia, serif",
        background: PALETTE.cream,
        minHeight: "100vh",
        color: PALETTE.ink,
        padding: "32px 24px",
      }}
    >
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            borderBottom: `2px solid ${PALETTE.maroon}`,
            paddingBottom: 20,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 11,
              letterSpacing: "0.18em",
              color: PALETTE.maroon,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Mays Business School · Texas A&amp;M University
          </div>
          <h1
            style={{
              fontFamily: "'Playfair Display', serif",
              fontWeight: 900,
              fontSize: 44,
              lineHeight: 1.05,
              margin: "0 0 12px 0",
              letterSpacing: "-0.01em",
            }}
          >
            The 2026 AI Venture Velocity Challenge,
            <br />
            <span
              style={{
                fontStyle: "italic",
                fontWeight: 700,
                color: PALETTE.maroon,
              }}
            >
              mapped.
            </span>
          </h1>
          <p
            style={{
              fontSize: 17,
              lineHeight: 1.5,
              maxWidth: 760,
              margin: 0,
              color: PALETTE.muted,
            }}
          >
            {TOTAL_APPS_DISPLAY} applications. {TOTAL_INSTITUTIONS} institutions. The
            inaugural Challenge drew submissions from research universities,
            regional campuses, liberal arts colleges, and master's-focused
            universities across all four U.S. census regions.
          </p>
        </div>

        {/* Find your school */}
        <div
          style={{
            background: PALETTE.ink,
            color: PALETTE.cream,
            padding: "20px 24px",
            marginBottom: 28,
            display: "flex",
            alignItems: "center",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 10,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: PALETTE.gold,
                marginBottom: 4,
              }}
            >
              Step 1
            </div>
            <div
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 24,
                fontWeight: 700,
                fontStyle: "italic",
              }}
            >
              Find your institution.
            </div>
          </div>
          <input
            type="text"
            placeholder="Type a school or city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: "12px 16px",
              fontFamily: "'Source Serif Pro', serif",
              fontSize: 15,
              border: `1px solid ${PALETTE.cream}`,
              background: PALETTE.paper,
              color: PALETTE.ink,
              minWidth: 320,
              outline: "none",
              flex: "1 1 320px",
            }}
          />
          {zoomedSchool && (
            <div
              style={{
                padding: "12px 18px",
                background: PALETTE.maroon,
                fontFamily: "'Source Serif Pro', serif",
                fontSize: 14,
                flex: "0 1 auto",
              }}
            >
              <strong>{zoomedSchool.name}</strong> sent{" "}
              <strong style={{ color: PALETTE.gold }}>
                {zoomedSchool.count}
              </strong>{" "}
              application{zoomedSchool.count !== 1 ? "s" : ""}.
            </div>
          )}
        </div>

        {/* Stat strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 0,
            marginBottom: 28,
            borderTop: `1px solid ${PALETTE.ink}`,
            borderBottom: `1px solid ${PALETTE.ink}`,
          }}
        >
          {[
            { num: TOTAL_APPS_DISPLAY, label: "Applications" },
            { num: TOTAL_INSTITUTIONS, label: "Institutions" },
            { num: top10Apps, label: "From Top 10 Schools" },
            {
              num: Math.round((top10Apps / TOTAL_APPS) * 100) + "%",
              label: "Concentrated in Top 10",
            },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                padding: "18px 20px",
                borderRight: i < 3 ? `1px solid ${PALETTE.ink}` : "none",
              }}
            >
              <div
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 38,
                  fontWeight: 900,
                  lineHeight: 1,
                  color: PALETTE.maroon,
                }}
              >
                {s.num}
              </div>
              <div
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 10,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  marginTop: 6,
                  color: PALETTE.muted,
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Region rollup */}
        <div style={{ marginBottom: 32 }}>
          <SectionHeading num="01" title="By Census Region" />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 16,
            }}
          >
            {regionStats.map((r) => {
              const active = selectedRegion === r.region;
              return (
              <div
                key={r.region}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setSelectedRegion(active ? null : r.region);
                  setSelectedTheme(null);
                }}
                style={{
                  background: active ? PALETTE.maroon : PALETTE.paper,
                  color: active ? PALETTE.cream : PALETTE.ink,
                  border: `1px solid ${PALETTE.ink}`,
                  padding: 18,
                  cursor: "pointer",
                  transition: "background 0.15s ease",
                }}
              >
                <div
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 10,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: active ? PALETTE.gold : PALETTE.maroon,
                    marginBottom: 6,
                  }}
                >
                  {r.region}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <div
                    style={{
                      fontFamily: "'Playfair Display', serif",
                      fontWeight: 900,
                      fontSize: 32,
                      color: PALETTE.ink,
                      lineHeight: 1,
                    }}
                  >
                    {r.apps}
                  </div>
                  <div
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 12,
                      color: "#666",
                    }}
                  >
                    {r.share.toFixed(1)}%
                  </div>
                </div>
                <div
                  style={{
                    height: 4,
                    background: active ? "rgba(255,255,255,0.2)" : PALETTE.paleRule,
                    marginTop: 8,
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      width: `${r.share}%`,
                      height: "100%",
                      background: active ? PALETTE.gold : PALETTE.maroon,
                    }}
                  />
                </div>
                <div
                  style={{
                    fontSize: 12,
                    lineHeight: 1.4,
                    color: active ? PALETTE.cream : PALETTE.muted,
                  }}
                >
                  {r.schools} institutions · anchored by{" "}
                  <em>{r.topSchool}</em> ({r.topCount})
                </div>
              </div>
              );
            })}
          </div>
        </div>

        {/* Map */}
        <SectionHeading num="02" title="The National Footprint" />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 320px",
            gap: 24,
            alignItems: "start",
            marginBottom: 32,
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                gap: 14,
                alignItems: "center",
                marginBottom: 12,
                fontFamily: "'DM Mono', monospace",
                fontSize: 10,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                flexWrap: "wrap",
              }}
            >
              <span style={{ color: "#666" }}>Color by:</span>
              {[
                { id: "default", label: "Default" },
                { id: "carnegie", label: "Carnegie" },
              ].map((opt) => (
                <ToggleButton
                  key={opt.id}
                  active={colorMode === opt.id}
                  onClick={() => setColorMode(opt.id)}
                >
                  {opt.label}
                </ToggleButton>
              ))}
              <span style={{ marginLeft: 16, color: "#666" }}>Rank by:</span>
              {[
                { id: "count", label: "Total apps" },
                { id: "percapita", label: "Per 1k students" },
              ].map((opt) => (
                <ToggleButton
                  key={opt.id}
                  active={scaleMode === opt.id}
                  onClick={() => setScaleMode(opt.id)}
                >
                  {opt.label}
                </ToggleButton>
              ))}
            </div>

            {/* Theme & region filter chips */}
            <div
              style={{
                display: "flex",
                gap: 6,
                alignItems: "center",
                marginBottom: 12,
                fontFamily: "'DM Mono', monospace",
                fontSize: 10,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                flexWrap: "wrap",
              }}
            >
              <span style={{ color: "#666", marginRight: 4 }}>Filter by theme:</span>
              {THEME_ORDER.filter((k) => (THEMES.themeTotals[k] || 0) > 0).map((k) => {
                const active = selectedTheme === k;
                const n = THEMES.themeTotals[k] || 0;
                return (
                  <button
                    key={k}
                    onClick={() => {
                      setSelectedTheme(active ? null : k);
                      setSelectedRegion(null);
                    }}
                    style={{
                      padding: "5px 9px",
                      background: active ? THEME_COLORS[k] : "transparent",
                      color: active ? "#fff" : PALETTE.ink,
                      border: `1px solid ${active ? THEME_COLORS[k] : PALETTE.ink}`,
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 10,
                      cursor: "pointer",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {k.replace(" / ", "/").replace(" & ", "&")}
                    <span
                      style={{
                        marginLeft: 6,
                        color: active ? "rgba(255,255,255,0.7)" : "#999",
                      }}
                    >
                      {n}
                    </span>
                  </button>
                );
              })}
              {(selectedTheme || selectedRegion) && (
                <button
                  onClick={() => {
                    setSelectedTheme(null);
                    setSelectedRegion(null);
                  }}
                  style={{
                    padding: "5px 9px",
                    marginLeft: 6,
                    background: PALETTE.ink,
                    color: PALETTE.cream,
                    border: `1px solid ${PALETTE.ink}`,
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 10,
                    cursor: "pointer",
                    letterSpacing: "0.1em",
                  }}
                >
                  Clear ✕
                </button>
              )}
            </div>

            {(selectedTheme || selectedRegion) && (
              <div
                style={{
                  fontFamily: "'Source Serif Pro', serif",
                  fontSize: 13,
                  marginBottom: 10,
                  padding: "8px 12px",
                  background: "#fff8e0",
                  border: `1px solid ${PALETTE.gold}`,
                  color: PALETTE.ink,
                }}
              >
                {selectedTheme ? (
                  <>
                    Showing schools that submitted{" "}
                    <strong style={{ color: THEME_COLORS[selectedTheme] }}>
                      {selectedTheme}
                    </strong>{" "}
                    ventures —{" "}
                    <strong>
                      {THEMES.themeTotals[selectedTheme] || 0}
                    </strong>{" "}
                    submissions across the map.
                  </>
                ) : (
                  <>
                    Showing the <strong>{selectedRegion}</strong> region only.
                  </>
                )}
              </div>
            )}

            <div
              style={{
                background: PALETTE.paper,
                border: `1px solid ${PALETTE.ink}`,
                position: "relative",
              }}
            >
              <svg
                viewBox={`0 0 ${W} ${H}`}
                style={{ width: "100%", height: "auto", display: "block" }}
              >
                <defs>
                  <filter
                    id="dotShadow"
                    x="-50%"
                    y="-50%"
                    width="200%"
                    height="200%"
                  >
                    <feDropShadow
                      dx="0"
                      dy="1"
                      stdDeviation="1.2"
                      floodColor="#000"
                      floodOpacity="0.18"
                    />
                  </filter>
                </defs>

                {stateFeatures.map((feat, i) => (
                  <path
                    key={i}
                    d={pathGenerator(feat) || ""}
                    fill="#faf6ec"
                    stroke="#c9bfa6"
                    strokeWidth={0.8}
                    strokeLinejoin="round"
                  />
                ))}

                {/* Non-top-10 dots, smallest first */}
                {filtered
                  .filter((d) => !top10Set.has(d.unitid))
                  .sort((a, b) => a.count - b.count)
                  .map((d, i) => {
                    const projected = projection([d.lng, d.lat]);
                    if (!projected) return null;
                    const [x, y] = projected;
                    const r = dotR(d.count);
                    const isHov = hovered === d.unitid;
                    const isZoomed = zoomedSchool?.unitid === d.unitid;
                    const isMatch = matchesFilter(d);
                    const dimmed = hasFilter && !isMatch;
                    return (
                      <g
                        key={`${d.unitid}-${i}`}
                        onMouseEnter={() => setHovered(d.unitid)}
                        onMouseLeave={() => setHovered(null)}
                        style={{ cursor: "pointer", opacity: dimmed ? 0.12 : 1 }}
                      >
                        {isZoomed && (
                          <circle
                            cx={x}
                            cy={y}
                            r={r + 8}
                            fill="none"
                            stroke={PALETTE.gold}
                            strokeWidth={2}
                            opacity={0.8}
                          >
                            <animate
                              attributeName="r"
                              from={r + 4}
                              to={r + 12}
                              dur="1.5s"
                              repeatCount="indefinite"
                            />
                            <animate
                              attributeName="opacity"
                              from={0.8}
                              to={0}
                              dur="1.5s"
                              repeatCount="indefinite"
                            />
                          </circle>
                        )}
                        {hasFilter && isMatch && (
                          <circle
                            cx={x}
                            cy={y}
                            r={r + 4}
                            fill="none"
                            stroke={PALETTE.gold}
                            strokeWidth={1.5}
                            opacity={0.55}
                          />
                        )}
                        <circle
                          cx={x}
                          cy={y}
                          r={r}
                          fill={isHov || isZoomed ? PALETTE.maroon : getDotColor(d)}
                          fillOpacity={0.78}
                          stroke={PALETTE.paper}
                          strokeWidth={1}
                          filter="url(#dotShadow)"
                        />
                      </g>
                    );
                  })}

                {/* Top 10 logos */}
                {filtered
                  .filter((d) => top10Set.has(d.unitid))
                  .map((d, i) => {
                    const projected = projection([d.lng, d.lat]);
                    if (!projected) return null;
                    const [x, y] = projected;
                    const isHov = hovered === d.unitid;
                    const isZoomed = zoomedSchool?.unitid === d.unitid;
                    const isMatch = matchesFilter(d);
                    const dimmed = hasFilter && !isMatch;
                    const r = d.unitid === 228723 ? 24 : 18;
                    const fill = colorMode === "default" && d.color
                      ? d.color
                      : getDotColor(d);
                    return (
                      <g
                        key={`top-${d.unitid}`}
                        onMouseEnter={() => setHovered(d.unitid)}
                        onMouseLeave={() => setHovered(null)}
                        style={{ cursor: "pointer", opacity: dimmed ? 0.18 : 1 }}
                        transform={`translate(${x},${y}) scale(${
                          isHov || isZoomed ? 1.12 : 1
                        })`}
                      >
                        {isZoomed && (
                          <circle
                            cx={0}
                            cy={0}
                            r={r + 12}
                            fill="none"
                            stroke={PALETTE.gold}
                            strokeWidth={2}
                            opacity={0.8}
                          >
                            <animate
                              attributeName="r"
                              from={r + 6}
                              to={r + 18}
                              dur="1.5s"
                              repeatCount="indefinite"
                            />
                            <animate
                              attributeName="opacity"
                              from={0.8}
                              to={0}
                              dur="1.5s"
                              repeatCount="indefinite"
                            />
                          </circle>
                        )}
                        <circle cx={0} cy={0} r={r + 2} fill={PALETTE.paper} />
                        <circle
                          cx={0}
                          cy={0}
                          r={r}
                          fill={fill}
                          filter="url(#dotShadow)"
                        />
                        <text
                          x={0}
                          y={1}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontFamily="'Playfair Display', serif"
                          fontWeight={900}
                          fontSize={
                            (d.mono?.length ?? 1) > 3
                              ? 8
                              : (d.mono?.length ?? 1) > 2
                              ? 9
                              : 12
                          }
                          fill="#fff"
                          letterSpacing="0.02em"
                        >
                          {d.mono ?? "•"}
                        </text>
                      </g>
                    );
                  })}

                {/* Hover label */}
                {hovered &&
                  (() => {
                    const d = RAW.find((x) => x.unitid === hovered);
                    if (!d) return null;
                    const projected = projection([d.lng, d.lat]);
                    if (!projected) return null;
                    const [x, y] = projected;
                    const labelW = Math.max(d.name.length * 7, 120) + 16;
                    const flip = x + 25 + labelW > W;
                    const lx = flip ? x - 25 - labelW : x + 25;
                    const carnLabel = CARNEGIE_DISPLAY[carnegieKey(d)];
                    return (
                      <g pointerEvents="none">
                        <rect
                          x={lx}
                          y={y - 32}
                          width={labelW}
                          height={42}
                          fill={PALETTE.ink}
                        />
                        <text
                          x={lx + 8}
                          y={y - 16}
                          fontFamily="'Source Serif Pro', serif"
                          fontWeight={600}
                          fontSize={13}
                          fill={PALETTE.cream}
                        >
                          {d.name}
                        </text>
                        <text
                          x={lx + 8}
                          y={y}
                          fontFamily="'DM Mono', monospace"
                          fontSize={10}
                          fill={PALETTE.gold}
                          letterSpacing="0.1em"
                        >
                          {d.count} APP{d.count !== 1 ? "S" : ""} · {carnLabel}
                        </text>
                      </g>
                    );
                  })()}
              </svg>

              {/* Legend */}
              <div
                style={{
                  padding: "12px 18px",
                  borderTop: `1px solid ${PALETTE.ink}`,
                  display: "flex",
                  gap: 20,
                  alignItems: "center",
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: PALETTE.muted,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontWeight: 600 }}>Size:</span>
                {[
                  { r: 3.8, label: "1" },
                  { r: 5.5, label: "2-4" },
                  { r: 8, label: "5-9" },
                  { r: 11, label: "10-19" },
                  { r: 14, label: "20+" },
                  { r: 22, label: "100+" },
                ].map((l, i) => (
                  <div
                    key={i}
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <svg width={l.r * 2 + 4} height={l.r * 2 + 4}>
                      <circle
                        cx={l.r + 2}
                        cy={l.r + 2}
                        r={l.r}
                        fill="#7a3838"
                        fillOpacity={0.78}
                        stroke={PALETTE.paper}
                      />
                    </svg>
                    <span>{l.label}</span>
                  </div>
                ))}
                {colorMode === "carnegie" && (
                  <>
                    <span style={{ marginLeft: 12, fontWeight: 600 }}>Color:</span>
                    {Object.entries(CARNEGIE_COLORS)
                      .filter(([k]) => k !== "Other" && k !== "Tribal")
                      .map(([k, v]) => (
                        <div
                          key={k}
                          style={{ display: "flex", alignItems: "center", gap: 4 }}
                        >
                          <div
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: "50%",
                              background: v,
                            }}
                          />
                          <span>{k}</span>
                        </div>
                      ))}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* SIDE LIST */}
          <div
            style={{
              background: PALETTE.paper,
              border: `1px solid ${PALETTE.ink}`,
              maxHeight: 720,
              overflowY: "auto",
            }}
          >
            <div
              style={{
                padding: "14px 18px",
                borderBottom: `1px solid ${PALETTE.ink}`,
                fontFamily: "'DM Mono', monospace",
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                background: PALETTE.ink,
                color: PALETTE.cream,
                position: "sticky",
                top: 0,
              }}
            >
              {scaleMode === "count"
                ? "Ranked: Total Applications"
                : "Ranked: Apps per 1k Students"}
            </div>
            {(scaleMode === "count" ? sorted : perCapitaSorted).map((d, i) => {
              const isFiltered = filtered.includes(d) || filtered.some((f) => f.unitid === d.unitid);
              const isZoomed = zoomedSchool?.unitid === d.unitid;
              return (
                <div
                  key={d.unitid + "-" + i}
                  onMouseEnter={() => setHovered(d.unitid)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    padding: "10px 18px",
                    borderBottom: `1px solid ${PALETTE.paleRule}`,
                    display: "grid",
                    gridTemplateColumns: "32px 1fr auto",
                    gap: 10,
                    alignItems: "baseline",
                    cursor: "pointer",
                    opacity: isFiltered ? 1 : 0.3,
                    background: isZoomed
                      ? "#fff8e0"
                      : hovered === d.unitid
                      ? PALETTE.cream
                      : "transparent",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 11,
                      color: PALETTE.faint,
                    }}
                  >
                    {String(i + 1).padStart(3, "0")}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        lineHeight: 1.2,
                      }}
                    >
                      {d.name}
                    </div>
                    <div
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 9,
                        color: PALETTE.faint,
                        marginTop: 2,
                        letterSpacing: "0.05em",
                      }}
                    >
                      {d.cityState} · {CARNEGIE_DISPLAY[carnegieKey(d)]}
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: "'Playfair Display', serif",
                      fontWeight: 900,
                      fontSize: 18,
                      color: i < 10 ? PALETTE.maroon : PALETTE.ink,
                    }}
                  >
                    {scaleMode === "count" ? d.count : d.perCapita.toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Concentration / Pareto */}
        <div style={{ marginBottom: 32 }}>
          <SectionHeading num="03" title="Concentration of Applications" />
          <div
            style={{
              background: PALETTE.paper,
              border: `1px solid ${PALETTE.ink}`,
              padding: 24,
              display: "grid",
              gridTemplateColumns: "1.6fr 1fr",
              gap: 32,
            }}
          >
            <div>
              <ParetoChart data={paretoData} />
              <div
                style={{
                  marginTop: 14,
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "#666",
                }}
              >
                Cumulative share of applications, by school rank
              </div>
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.55 }}>
              <p style={{ margin: "0 0 12px 0" }}>
                Texas A&amp;M alone sent{" "}
                <strong style={{ color: PALETTE.maroon }}>
                  {Math.round((148 / TOTAL_APPS) * 100)}%
                </strong>{" "}
                of all applications, the natural gravity of the host institution.
              </p>
              <p style={{ margin: "0 0 12px 0" }}>
                The top <strong>10</strong> schools accounted for{" "}
                <strong style={{ color: PALETTE.maroon }}>
                  {Math.round((top10Apps / TOTAL_APPS) * 100)}%
                </strong>
                . The top <strong>30</strong> schools accounted for{" "}
                <strong style={{ color: PALETTE.maroon }}>
                  {Math.round((top30Apps / TOTAL_APPS) * 100)}%
                </strong>
                .
              </p>
              <p style={{ margin: "0 0 12px 0" }}>
                <strong>{longTailInstitutions}</strong> institutions sent
                exactly one application. The shape of the curve says this:
                a host-led launch with a genuinely long national tail.
              </p>
              <p
                style={{
                  margin: 0,
                  fontStyle: "italic",
                  color: "#666",
                  fontSize: 13,
                }}
              >
                A national platform with a heavy host anchor, broadening
                across R1, regional, and master's-focused institutions.
              </p>
            </div>
          </div>
        </div>

        {/* Carnegie breakdown */}
        <div style={{ marginBottom: 32 }}>
          <SectionHeading num="04" title="By Institution Type" />
          <BarBreakdown
            data={carnegieStats}
            total={TOTAL_APPS}
            colorMap={CARNEGIE_COLORS}
          />
        </div>

        {/* Venture Themes */}
        <ThemesSection
          selectedTheme={selectedTheme}
          setSelectedTheme={(t) => {
            setSelectedTheme(t);
            setSelectedRegion(null);
          }}
        />

        {/* Footer */}
        <div
          style={{
            marginTop: 24,
            paddingTop: 16,
            borderTop: `1px solid ${PALETTE.paleRule}`,
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            color: PALETTE.faint,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            textAlign: "center",
          }}
        >
          Built for the AI Venture Velocity Challenge · Mays Business School
        </div>
      </div>
    </div>
  );
}

function ToggleButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 10px",
        background: active ? PALETTE.maroon : "transparent",
        color: active ? PALETTE.cream : PALETTE.ink,
        border: `1px solid ${PALETTE.ink}`,
        fontFamily: "'DM Mono', monospace",
        fontSize: 10,
        cursor: "pointer",
        letterSpacing: "0.1em",
      }}
    >
      {children}
    </button>
  );
}

function SectionHeading({ num, title }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 14,
        marginBottom: 14,
      }}
    >
      <div
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 11,
          letterSpacing: "0.2em",
          color: PALETTE.maroon,
          fontWeight: 600,
        }}
      >
        {num}
      </div>
      <h2
        style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 22,
          fontWeight: 700,
          margin: 0,
          fontStyle: "italic",
        }}
      >
        {title}
      </h2>
      <div
        style={{
          flex: 1,
          height: 1,
          background: PALETTE.ink,
          marginLeft: 8,
        }}
      />
    </div>
  );
}

function ParetoChart({ data }) {
  const W = 560,
    H = 220;
  const pad = { l: 40, r: 20, t: 14, b: 36 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const xMax = data.length;
  const points = data.map((d, i) => {
    const x = pad.l + (i / (xMax - 1)) * innerW;
    const y = pad.t + innerH - (d.cumPct / 100) * innerH;
    return [x, y];
  });
  const pathD = "M " + points.map((p) => p.join(",")).join(" L ");
  const areaD =
    pathD + ` L ${pad.l + innerW},${pad.t + innerH} L ${pad.l},${pad.t + innerH} Z`;

  const markers = [
    { rank: 1, label: "TAMU" },
    { rank: 10, label: "Top 10" },
    { rank: 30, label: "Top 30" },
    { rank: 60, label: "Top 60" },
  ];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      {[0, 25, 50, 75, 100].map((p) => {
        const y = pad.t + innerH - (p / 100) * innerH;
        return (
          <g key={p}>
            <line
              x1={pad.l}
              x2={pad.l + innerW}
              y1={y}
              y2={y}
              stroke={PALETTE.paleRule}
              strokeWidth={0.6}
            />
            <text
              x={pad.l - 6}
              y={y + 3}
              textAnchor="end"
              fontFamily="'DM Mono', monospace"
              fontSize={9}
              fill={PALETTE.faint}
            >
              {p}%
            </text>
          </g>
        );
      })}
      <path d={areaD} fill={PALETTE.maroon} fillOpacity={0.08} />
      <path d={pathD} fill="none" stroke={PALETTE.maroon} strokeWidth={2} />
      {markers.map((m) => {
        if (m.rank > data.length) return null;
        const i = m.rank - 1;
        const [x, y] = points[i];
        const pct = data[i].cumPct;
        return (
          <g key={m.rank}>
            <line
              x1={x}
              x2={x}
              y1={pad.t + innerH}
              y2={y}
              stroke={PALETTE.ink}
              strokeWidth={0.7}
              strokeDasharray="2,2"
            />
            <circle
              cx={x}
              cy={y}
              r={3.5}
              fill={PALETTE.maroon}
              stroke={PALETTE.paper}
              strokeWidth={1.5}
            />
            <text
              x={x + 6}
              y={y - 6}
              fontFamily="'DM Mono', monospace"
              fontSize={10}
              fill={PALETTE.ink}
              fontWeight={600}
            >
              {m.label}: {Math.round(pct)}%
            </text>
          </g>
        );
      })}
      <line
        x1={pad.l}
        x2={pad.l + innerW}
        y1={pad.t + innerH}
        y2={pad.t + innerH}
        stroke={PALETTE.ink}
      />
      <text
        x={pad.l}
        y={H - 10}
        fontFamily="'DM Mono', monospace"
        fontSize={9}
        fill="#666"
      >
        1
      </text>
      <text
        x={pad.l + innerW}
        y={H - 10}
        textAnchor="end"
        fontFamily="'DM Mono', monospace"
        fontSize={9}
        fill="#666"
      >
        {data.length}
      </text>
      <text
        x={pad.l + innerW / 2}
        y={H - 10}
        textAnchor="middle"
        fontFamily="'DM Mono', monospace"
        fontSize={9}
        fill="#666"
        letterSpacing="0.1em"
      >
        SCHOOL RANK →
      </text>
    </svg>
  );
}

function BarBreakdown({ data, total, colorMap, onRowClick, activeKey }) {
  const max = Math.max(...data.map((d) => d.apps));
  return (
    <div
      style={{
        background: PALETTE.paper,
        border: `1px solid ${PALETTE.ink}`,
        padding: 18,
      }}
    >
      {data.map((d) => {
        const pct = (d.apps / total) * 100;
        const w = max > 0 ? (d.apps / max) * 100 : 0;
        const colorKey = d.key || d.label;
        const meta =
          d.schools !== undefined
            ? `${d.apps} apps · ${d.schools} schools · ${pct.toFixed(1)}%`
            : `${d.apps} ventures · ${pct.toFixed(1)}%`;
        const isActive = onRowClick && activeKey === colorKey;
        return (
          <div
            key={colorKey}
            onClick={() => onRowClick && onRowClick(colorKey)}
            style={{
              marginBottom: 10,
              padding: onRowClick ? "4px 6px" : 0,
              margin: onRowClick ? "0 -6px 6px -6px" : "0 0 10px 0",
              cursor: onRowClick ? "pointer" : "default",
              background: isActive ? "rgba(80,0,0,0.08)" : "transparent",
              border: isActive ? `1px solid ${PALETTE.maroon}` : "1px solid transparent",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                fontSize: 13,
                marginBottom: 3,
              }}
            >
              <span style={{ fontWeight: 600 }}>{d.label}</span>
              <span
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 11,
                  color: "#666",
                }}
              >
                {meta}
              </span>
            </div>
            <div style={{ height: 8, background: PALETTE.paleRule }}>
              <div
                style={{
                  width: `${w}%`,
                  height: "100%",
                  background: colorMap[colorKey] || colorMap[d.label] || PALETTE.maroon,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ThemesSection({ selectedTheme, setSelectedTheme }) {
  const totals = THEMES.themeTotals;
  const classifiedTotal = THEMES.classifiedTotal;
  const readableTotal = (THEMES.coverage?.readableClassified) || classifiedTotal;
  const themeRows = THEME_ORDER
    .filter((k) => (totals[k] || 0) > 0)
    .map((k) => ({ key: k, label: k, apps: totals[k] || 0 }));

  const tagEntries = Object.entries(THEMES.secondaryTagTotals || {})
    .filter(([k, n]) => n > 0 && TAG_DISPLAY[k])
    .slice(0, 10);

  const stages = ["traction", "mvp", "prototype", "idea"]
    .map((k) => ({ key: k, label: STAGE_DISPLAY[k] || k, apps: THEMES.stageTotals?.[k] || 0 }))
    .filter((s) => s.apps > 0);

  const targets = ["enterprise", "consumer", "smb", "mixed", "government", "research"]
    .map((k) => ({ key: k, label: TARGET_DISPLAY[k] || k, apps: THEMES.targetTotals?.[k] || 0 }))
    .filter((t) => t.apps > 0);

  const stageMax = Math.max(...stages.map((s) => s.apps), 1);
  const targetMax = Math.max(...targets.map((t) => t.apps), 1);

  return (
    <>
      <div style={{ marginBottom: 32 }}>
        <SectionHeading num="05" title="By Venture Theme" />
        <BarBreakdown
          data={themeRows}
          total={readableTotal}
          colorMap={THEME_COLORS}
          onRowClick={(k) => setSelectedTheme(selectedTheme === k ? null : k)}
          activeKey={selectedTheme}
        />
        <div
          style={{
            marginTop: 10,
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: PALETTE.faint,
          }}
        >
          Click a theme to see where those ventures came from on the map. Themes inferred from {readableTotal} submitted venture snapshots ({Math.round((readableTotal / TOTAL_APPS_DISPLAY) * 100)}% coverage).
        </div>
      </div>

      <div
        style={{
          marginBottom: 32,
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr 1fr",
          gap: 24,
        }}
      >
        <div>
          <SectionHeading num="06" title="What students are building" />
          <div
            style={{
              background: PALETTE.paper,
              border: `1px solid ${PALETTE.ink}`,
              padding: 18,
            }}
          >
            {tagEntries.map(([key, n]) => {
              const max = tagEntries[0]?.[1] || 1;
              const w = (n / max) * 100;
              const pct = (n / readableTotal) * 100;
              return (
                <div key={key} style={{ marginBottom: 10 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      fontSize: 13,
                      marginBottom: 3,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{TAG_DISPLAY[key]}</span>
                    <span
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 11,
                        color: "#666",
                      }}
                    >
                      {n} ventures · {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div style={{ height: 8, background: PALETTE.paleRule }}>
                    <div
                      style={{
                        width: `${w}%`,
                        height: "100%",
                        background: PALETTE.maroon,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <SectionHeading num="07" title="Stage" />
          <div
            style={{
              background: PALETTE.paper,
              border: `1px solid ${PALETTE.ink}`,
              padding: 18,
            }}
          >
            {stages.map((s) => {
              const w = (s.apps / stageMax) * 100;
              const pct = (s.apps / readableTotal) * 100;
              return (
                <div key={s.key} style={{ marginBottom: 10 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      fontSize: 13,
                      marginBottom: 3,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{s.label}</span>
                    <span
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 11,
                        color: "#666",
                      }}
                    >
                      {s.apps} · {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div style={{ height: 8, background: PALETTE.paleRule }}>
                    <div
                      style={{
                        width: `${w}%`,
                        height: "100%",
                        background: PALETTE.gold,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <SectionHeading num="08" title="Target customer" />
          <div
            style={{
              background: PALETTE.paper,
              border: `1px solid ${PALETTE.ink}`,
              padding: 18,
            }}
          >
            {targets.map((t) => {
              const w = (t.apps / targetMax) * 100;
              const pct = (t.apps / readableTotal) * 100;
              return (
                <div key={t.key} style={{ marginBottom: 10 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      fontSize: 13,
                      marginBottom: 3,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{t.label}</span>
                    <span
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 11,
                        color: "#666",
                      }}
                    >
                      {t.apps} · {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div style={{ height: 8, background: PALETTE.paleRule }}>
                    <div
                      style={{
                        width: `${w}%`,
                        height: "100%",
                        background: "#0a4d68",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

function decodeTopojson(topology, objectName) {
  const obj = topology.objects[objectName];
  if (!obj) return [];
  const transform = topology.transform;
  const arcs = topology.arcs;

  function decodeArc(arcIndex) {
    const reverse = arcIndex < 0;
    const idx = reverse ? ~arcIndex : arcIndex;
    const arc = arcs[idx];
    const points = [];
    let x = 0,
      y = 0;
    for (const [dx, dy] of arc) {
      x += dx;
      y += dy;
      const lng = x * transform.scale[0] + transform.translate[0];
      const lat = y * transform.scale[1] + transform.translate[1];
      points.push([lng, lat]);
    }
    return reverse ? points.slice().reverse() : points;
  }

  function decodeRing(arcIndices) {
    const ring = [];
    for (let i = 0; i < arcIndices.length; i++) {
      const decoded = decodeArc(arcIndices[i]);
      if (i > 0) ring.pop();
      ring.push(...decoded);
    }
    return ring;
  }

  function decodeGeometry(g) {
    if (g.type === "Polygon") {
      return { type: "Polygon", coordinates: g.arcs.map(decodeRing) };
    }
    if (g.type === "MultiPolygon") {
      return {
        type: "MultiPolygon",
        coordinates: g.arcs.map((poly) => poly.map(decodeRing)),
      };
    }
    return null;
  }

  const features = [];
  if (obj.type === "GeometryCollection") {
    for (const g of obj.geometries) {
      const geom = decodeGeometry(g);
      if (geom)
        features.push({
          type: "Feature",
          properties: g.properties || {},
          geometry: geom,
        });
    }
  }
  return features;
}
