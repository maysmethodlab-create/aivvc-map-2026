import React, { useState, useMemo, useEffect } from "react";
import * as d3 from "d3";
import RAW_DATA from "../data/institutions.json";
import THEMES from "../data/themes.json";
import JOBS from "../data/jobs.json";

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

// Census-region lookup keyed by full state name (matches us-atlas TopoJSON properties.name).
const STATE_NAME_TO_REGION = {
  Connecticut: "Northeast", Maine: "Northeast", Massachusetts: "Northeast",
  "New Hampshire": "Northeast", "New Jersey": "Northeast", "New York": "Northeast",
  Pennsylvania: "Northeast", "Rhode Island": "Northeast", Vermont: "Northeast",
  Illinois: "Midwest", Indiana: "Midwest", Iowa: "Midwest", Kansas: "Midwest",
  Michigan: "Midwest", Minnesota: "Midwest", Missouri: "Midwest", Nebraska: "Midwest",
  "North Dakota": "Midwest", Ohio: "Midwest", "South Dakota": "Midwest", Wisconsin: "Midwest",
  Alabama: "South", Arkansas: "South", Delaware: "South", "District of Columbia": "South",
  Florida: "South", Georgia: "South", Kentucky: "South", Louisiana: "South",
  Maryland: "South", Mississippi: "South", "North Carolina": "South", Oklahoma: "South",
  "South Carolina": "South", Tennessee: "South", Texas: "South", Virginia: "South",
  "West Virginia": "South",
  Alaska: "West", Arizona: "West", California: "West", Colorado: "West",
  Hawaii: "West", Idaho: "West", Montana: "West", Nevada: "West",
  "New Mexico": "West", Oregon: "West", Utah: "West", Washington: "West", Wyoming: "West",
};

const STATE_FULL_NAMES = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

const RAW = RAW_DATA;
// Computed total from data is 529; Levi reports 528 externally (single-app
// reconciliation diff). We display 528 to stay consistent with Levi's
// communications. Percentage math still uses the computed total.
const TOTAL_APPS_DISPLAY = 528;
const TOTAL_INSTITUTIONS_DISPLAY = 160; // Levi's external number; deduped data has 152
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
  const [selectedThemes, setSelectedThemes] = useState(() => new Set());

  const themePresence = THEMES.themeByUnitidPresence || {};
  const themeByUnitidSafe = THEMES.themeByUnitid || {};

  const toggleTheme = (theme) => {
    setSelectedThemes((prev) => {
      const next = new Set(prev);
      if (next.has(theme)) next.delete(theme);
      else next.add(theme);
      return next;
    });
    setSelectedRegion(null);
  };
  const clearAllThemes = () => setSelectedThemes(new Set());
  const hasThemeFilter = selectedThemes.size > 0;
  const onlyTheme = selectedThemes.size === 1 ? [...selectedThemes][0] : null;

  const matchesFilter = (d) => {
    if (selectedRegion && d.region !== selectedRegion) return false;
    if (hasThemeFilter) {
      const schoolThemes = themePresence[String(d.unitid)] || [];
      // OR logic: include schools that match ANY selected theme.
      const intersects = schoolThemes.some((t) => selectedThemes.has(t));
      if (!intersects) return false;
    }
    return true;
  };
  const hasFilter = !!selectedRegion || hasThemeFilter;

  // When themes are selected: total count across all selected themes for one school.
  // Returns null if all selected themes are privacy-suppressed (count < 3) for this school.
  const themeCountForSchool = (unitid) => {
    if (!hasThemeFilter) return null;
    const safe = themeByUnitidSafe[String(unitid)] || {};
    let total = 0;
    let anyKnown = false;
    for (const t of selectedThemes) {
      if (safe[t] !== undefined) {
        total += safe[t];
        anyKnown = true;
      }
    }
    return anyKnown ? total : null;
  };

  // Theme-mode dot sizing.
  const themeDotR = (unitid) => {
    const n = themeCountForSchool(unitid);
    if (n === null) return 5; // small floor for 1-2 count (privacy-safe)
    if (n >= 25) return 22;
    if (n >= 10) return 14;
    if (n >= 5) return 10;
    if (n >= 3) return 7.5;
    return 5;
  };

  // For backwards-compat with existing render code that referenced `selectedTheme`.
  const selectedTheme = onlyTheme;

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
    const q = search.toLowerCase().trim();
    if (!q) return RAW;
    return RAW.filter((d) => {
      if (d.name.toLowerCase().includes(q)) return true;
      if (d.cityState.toLowerCase().includes(q)) return true;
      const stateName = STATE_FULL_NAMES[d.state]?.toLowerCase() || "";
      if (stateName.includes(q)) return true;
      // 2-letter state code exact match: e.g. "ca" → state="CA"
      if (q.length <= 2 && d.state?.toLowerCase() === q) return true;
      return false;
    });
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
    if (search.length >= 3 && filtered.length > 0 && filtered.length < RAW.length) {
      // Pick the highest-count match so a "California" search highlights UC Berkeley,
      // not the alphabetical first match.
      const top = filtered.slice().sort((a, b) => b.count - a.count)[0];
      setZoomedSchool(top);
    } else {
      setZoomedSchool(null);
    }
  }, [search, filtered]);

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
            {TOTAL_APPS_DISPLAY} applications. {TOTAL_INSTITUTIONS_DISPLAY} institutions. The
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
          <div style={{ flex: "1 1 320px", position: "relative", minWidth: 320 }}>
            <input
              type="text"
              placeholder="Type a school, city, or state…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: "12px 16px",
                fontFamily: "'Source Serif Pro', serif",
                fontSize: 15,
                border: `1px solid ${PALETTE.cream}`,
                background: PALETTE.paper,
                color: PALETTE.ink,
                width: "100%",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            {search.length >= 2 && filtered.length > 0 && filtered.length < RAW.length && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  right: 0,
                  background: PALETTE.paper,
                  border: `1px solid ${PALETTE.ink}`,
                  zIndex: 10,
                  maxHeight: 320,
                  overflowY: "auto",
                  boxShadow: "0 6px 16px rgba(0,0,0,0.18)",
                }}
              >
                <div
                  style={{
                    padding: "8px 14px",
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 10,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    color: PALETTE.faint,
                    borderBottom: `1px solid ${PALETTE.paleRule}`,
                    background: PALETTE.cream,
                  }}
                >
                  {filtered.length} match{filtered.length !== 1 ? "es" : ""} · click to spotlight
                </div>
                {filtered
                  .slice()
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 30)
                  .map((d) => (
                    <div
                      key={d.unitid}
                      onClick={() => {
                        setSearch(d.name);
                        setZoomedSchool(d);
                      }}
                      style={{
                        padding: "8px 14px",
                        borderBottom: `1px solid ${PALETTE.paleRule}`,
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        gap: 12,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = PALETTE.cream)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: PALETTE.ink }}>
                          {d.name}
                        </div>
                        <div
                          style={{
                            fontFamily: "'DM Mono', monospace",
                            fontSize: 10,
                            color: PALETTE.faint,
                            marginTop: 2,
                          }}
                        >
                          {d.cityState}
                        </div>
                      </div>
                      <div
                        style={{
                          fontFamily: "'Playfair Display', serif",
                          fontWeight: 900,
                          fontSize: 16,
                          color: PALETTE.maroon,
                        }}
                      >
                        {d.count}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
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
            { num: TOTAL_INSTITUTIONS_DISPLAY, label: "Institutions" },
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
                  clearAllThemes();
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
              <span style={{ color: "#666" }}>Rank by:</span>
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
                const active = selectedThemes.has(k);
                const n = THEMES.themeTotals[k] || 0;
                return (
                  <button
                    key={k}
                    onClick={() => toggleTheme(k)}
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
              {(hasThemeFilter || selectedRegion) && (
                <button
                  onClick={() => {
                    clearAllThemes();
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

            {(hasThemeFilter || selectedRegion) && (
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
                {hasThemeFilter ? (
                  (() => {
                    const themesArr = [...selectedThemes];
                    const totalSubs = themesArr.reduce(
                      (s, t) => s + (THEMES.themeTotals[t] || 0),
                      0
                    );
                    return (
                      <>
                        Showing schools with{" "}
                        {themesArr.map((t, i) => (
                          <span key={t}>
                            <strong style={{ color: THEME_COLORS[t] }}>{t}</strong>
                            {i < themesArr.length - 2
                              ? ", "
                              : i === themesArr.length - 2
                              ? " or "
                              : ""}
                          </span>
                        ))}{" "}
                        ventures — <strong>{totalSubs}</strong> submission
                        {totalSubs !== 1 ? "s" : ""} across the map.
                      </>
                    );
                  })()
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

                {stateFeatures.map((feat, i) => {
                  const stateName = feat.properties?.name || "";
                  const stateRegion = STATE_NAME_TO_REGION[stateName] || null;
                  let fill = "#faf6ec";
                  let stroke = "#c9bfa6";
                  if (selectedRegion) {
                    if (stateRegion === selectedRegion) {
                      fill = "#f5d9d9"; // soft maroon tint
                      stroke = PALETTE.maroon;
                    } else {
                      fill = "#ece5d5"; // muted, dimmed
                      stroke = "#d6cdb5";
                    }
                  }
                  return (
                    <path
                      key={i}
                      d={pathGenerator(feat) || ""}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={selectedRegion && stateRegion === selectedRegion ? 1.4 : 0.8}
                      strokeLinejoin="round"
                    />
                  );
                })}

                {/* Non-top-10 dots, smallest first */}
                {filtered
                  .filter((d) => !top10Set.has(d.unitid))
                  .filter((d) => !selectedTheme || matchesFilter(d))
                  .sort((a, b) => a.count - b.count)
                  .map((d, i) => {
                    const projected = projection([d.lng, d.lat]);
                    if (!projected) return null;
                    const [x, y] = projected;
                    const r = selectedTheme ? themeDotR(d.unitid) : dotR(d.count);
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
                  .filter((d) => !selectedTheme || matchesFilter(d))
                  .map((d, i) => {
                    const projected = projection([d.lng, d.lat]);
                    if (!projected) return null;
                    const [x, y] = projected;
                    const isHov = hovered === d.unitid;
                    const isZoomed = zoomedSchool?.unitid === d.unitid;
                    const isMatch = matchesFilter(d);
                    const dimmed = hasFilter && !isMatch;
                    // When a theme is selected, top-10 logos resize by their
                    // theme count (so a school that's strong in this theme
                    // grows; a school weak in this theme shrinks).
                    const themeR = selectedTheme ? themeDotR(d.unitid) + 6 : null;
                    const r = themeR ?? (d.unitid === 228723 ? 24 : 18);
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
                          {(() => {
                            if (hasThemeFilter) {
                              const tc = themeCountForSchool(d.unitid);
                              const themeLabel = onlyTheme || "selected themes";
                              if (tc !== null) {
                                return `${tc} ${themeLabel.toUpperCase()} APP${tc !== 1 ? "S" : ""}`;
                              }
                              return `1–2 ${themeLabel.toUpperCase()} APPS`;
                            }
                            return `${d.count} APP${d.count !== 1 ? "S" : ""} · ${carnLabel}`;
                          })()}
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
              {hasThemeFilter
                ? `Ranked: ${onlyTheme ? onlyTheme + " " : ""}Submissions`
                : scaleMode === "count"
                ? "Ranked: Total Applications"
                : "Ranked: Apps per 1k Students"}
            </div>
            {(() => {
              // When a theme is selected, build a theme-specific ranking.
              // Show only schools with safe count >= 3 (privacy rule), sorted by
              // sum of selected theme counts. Schools with 1-2 in theme appear
              // as a single aggregated row at the bottom.
              if (hasThemeFilter) {
                const named = [];
                let smallCount = 0;
                let smallApps = 0;
                for (const d of RAW) {
                  const safe = themeByUnitidSafe[String(d.unitid)] || {};
                  const presence = themePresence[String(d.unitid)] || [];
                  let total = 0;
                  let anyKnown = false;
                  for (const t of selectedThemes) {
                    if (safe[t] !== undefined) {
                      total += safe[t];
                      anyKnown = true;
                    }
                  }
                  if (anyKnown) {
                    named.push({ d, total });
                  } else if (presence.some((t) => selectedThemes.has(t))) {
                    smallCount++;
                    smallApps += 1;
                  }
                }
                named.sort((a, b) => b.total - a.total);
                return (
                  <>
                    {named.map(({ d, total }, i) => {
                      const isZoomed = zoomedSchool?.unitid === d.unitid;
                      return (
                        <div
                          key={d.unitid + "-" + i}
                          onMouseEnter={() => setHovered(d.unitid)}
                          onMouseLeave={() => setHovered(null)}
                          onClick={() => {
                            setSearch(d.name);
                            setZoomedSchool(d);
                          }}
                          style={{
                            padding: "10px 18px",
                            borderBottom: `1px solid ${PALETTE.paleRule}`,
                            display: "grid",
                            gridTemplateColumns: "32px 1fr auto",
                            gap: 10,
                            alignItems: "baseline",
                            cursor: "pointer",
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
                            <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>
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
                              {d.cityState} · {total} of {d.count}
                            </div>
                          </div>
                          <div
                            style={{
                              fontFamily: "'Playfair Display', serif",
                              fontWeight: 900,
                              fontSize: 18,
                              color: PALETTE.maroon,
                            }}
                          >
                            {total}
                          </div>
                        </div>
                      );
                    })}
                    {smallCount > 0 && (
                      <div
                        style={{
                          padding: "12px 18px",
                          borderBottom: `1px solid ${PALETTE.paleRule}`,
                          fontSize: 12,
                          color: PALETTE.muted,
                          fontStyle: "italic",
                          background: PALETTE.cream,
                        }}
                      >
                        + {smallCount} more institution{smallCount === 1 ? "" : "s"} with 1–2 submission{smallCount === 1 ? "" : "s"} each
                        (names not shown to protect small-team identity).
                      </div>
                    )}
                  </>
                );
              }

              // Default ranking: all institutions by total apps or per-capita.
              return (scaleMode === "count" ? sorted : perCapitaSorted).map((d, i) => {
                const isFiltered = filtered.includes(d) || filtered.some((f) => f.unitid === d.unitid);
                const isZoomed = zoomedSchool?.unitid === d.unitid;
                return (
                  <div
                    key={d.unitid + "-" + i}
                    onMouseEnter={() => setHovered(d.unitid)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => {
                      setSearch(d.name);
                      setZoomedSchool(d);
                    }}
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
                      <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>
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
                        {d.cityState}
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
              });
            })()}
          </div>
        </div>

        {/* Theme-specific Volume vs. Lean panel — only shown when EXACTLY ONE theme is selected */}
        {onlyTheme && (
          <ThemeFocusPanel
            theme={onlyTheme}
            allInstitutions={RAW}
            themeByUnitidSafe={themeByUnitidSafe}
            themePresence={themePresence}
            onClear={clearAllThemes}
          />
        )}

        {/* Venture Themes (with the small Carnegie box inside "Where the building is happening") */}
        <ThemesSection
          selectedThemes={selectedThemes}
          toggleTheme={toggleTheme}
          carnegieStats={carnegieStats}
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

function BarBreakdown({ data, total, colorMap, onRowClick, activeKey, isActive }) {
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
        const isActiveRow =
          onRowClick && (isActive ? isActive(colorKey) : activeKey === colorKey);
        return (
          <div
            key={colorKey}
            onClick={() => onRowClick && onRowClick(colorKey)}
            style={{
              marginBottom: 10,
              padding: onRowClick ? "4px 6px" : 0,
              margin: onRowClick ? "0 -6px 6px -6px" : "0 0 10px 0",
              cursor: onRowClick ? "pointer" : "default",
              background: isActiveRow ? "rgba(80,0,0,0.08)" : "transparent",
              border: isActiveRow ? `1px solid ${PALETTE.maroon}` : "1px solid transparent",
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

function ThemesSection({ selectedThemes, toggleTheme, carnegieStats }) {
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
      {/* Section 03: Where the building is happening */}
      <div style={{ marginBottom: 14 }}>
        <SectionHeading num="03" title="Where the building is happening" />
      </div>
      <div
        style={{
          marginBottom: 32,
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: 20,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: PALETTE.maroon,
              marginBottom: 8,
            }}
          >
            Industries
          </div>
          <BarBreakdown
            data={themeRows}
            total={readableTotal}
            colorMap={THEME_COLORS}
            onRowClick={(k) => toggleTheme(k)}
            isActive={(k) => selectedThemes.has(k)}
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
            Click a theme to spotlight those schools on the map.
          </div>
        </div>

        <div>
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: PALETTE.maroon,
              marginBottom: 8,
            }}
          >
            What's powering them
          </div>
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
                      {n} · {pct.toFixed(0)}%
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
            Themes inferred from {readableTotal} submitted snapshots ({Math.round((readableTotal / TOTAL_APPS_DISPLAY) * 100)}% coverage).
          </div>
        </div>
      </div>

      {/* Section 04: What students are getting done */}
      <JobsSection />

      {/* Section 05: Who's Building */}
      <div style={{ marginBottom: 14 }}>
        <SectionHeading num="05" title="Who's building" />
      </div>
      <div
        style={{
          marginBottom: 32,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: PALETTE.maroon,
              marginBottom: 8,
            }}
          >
            Venture stage
          </div>
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
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: PALETTE.maroon,
              marginBottom: 8,
            }}
          >
            Target customer
          </div>
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

function JobsSection() {
  const cards = JOBS.cards || [];
  const [activeId, setActiveId] = useState(null);

  return (
    <div style={{ marginBottom: 32 }}>
      <SectionHeading num="04" title="What they're getting done" />
      <div
        style={{
          fontSize: 14,
          lineHeight: 1.5,
          color: PALETTE.muted,
          marginBottom: 18,
          maxWidth: 760,
        }}
      >
        Each card is one of the recurring{" "}
        <em>jobs to be done</em> we saw across the submissions. Click a card to
        see the full pattern — the persona, the situation, what they want, and
        why it matters. Each card represents 5 or more ventures so no single
        team is identifiable.
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 14,
        }}
      >
        {cards.map((c) => {
          const isOpen = activeId === c.id;
          const themeColor = THEME_COLORS[c.theme] || PALETTE.maroon;
          return (
            <div
              key={c.id}
              onClick={() => setActiveId(isOpen ? null : c.id)}
              style={{
                background: PALETTE.paper,
                border: `1px solid ${PALETTE.ink}`,
                borderTop: `4px solid ${themeColor}`,
                padding: "14px 16px 16px 16px",
                cursor: "pointer",
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
                transform: isOpen ? "translateY(-2px)" : "none",
                boxShadow: isOpen ? "0 6px 16px rgba(0,0,0,0.12)" : "none",
                minHeight: 160,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = PALETTE.cream)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = PALETTE.paper)
              }
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 9,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                }}
              >
                <span style={{ color: themeColor, fontWeight: 600 }}>
                  {c.theme}
                </span>
                <span style={{ color: PALETTE.faint }}>
                  ~{c.cluster_size} ventures
                </span>
              </div>

              <div
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 17,
                  fontWeight: 700,
                  fontStyle: "italic",
                  lineHeight: 1.25,
                  color: PALETTE.ink,
                }}
              >
                When I'm a {c.persona}…
              </div>

              {isOpen ? (
                <>
                  <div
                    style={{
                      fontSize: 13,
                      lineHeight: 1.45,
                      color: PALETTE.muted,
                    }}
                  >
                    …and {c.situation},
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      lineHeight: 1.45,
                      color: PALETTE.ink,
                    }}
                  >
                    <strong>I want</strong> {c.want},
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      lineHeight: 1.45,
                      color: PALETTE.ink,
                    }}
                  >
                    <strong>so I can</strong> {c.outcome}.
                  </div>
                </>
              ) : (
                <div
                  style={{
                    fontSize: 12,
                    color: PALETTE.faint,
                    fontFamily: "'DM Mono', monospace",
                    letterSpacing: "0.05em",
                  }}
                >
                  Click to read the full job →
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ThemeFocusPanel({ theme, allInstitutions, themeByUnitidSafe, themePresence, onClear }) {
  const themeColor = THEME_COLORS[theme] || PALETTE.maroon;
  const themeTotal = THEMES.themeTotals[theme] || 0;
  const classifiedTotal = THEMES.coverage?.readableClassified || THEMES.classifiedTotal || 1;
  const globalShare = themeTotal / classifiedTotal;

  const insts = allInstitutions.filter((d) => d.unitid > 0);
  const byUnitid = {};
  insts.forEach((d) => (byUnitid[String(d.unitid)] = d));

  // Volume: schools by absolute count of this theme — only schools with >=3
  // can be displayed by name (privacy rule). Others are aggregated.
  const namedVolume = [];
  let smallSchoolApps = 0;
  let smallSchoolCount = 0;
  for (const [uidStr, themes] of Object.entries(themePresence)) {
    if (!themes.includes(theme)) continue;
    const uid = uidStr;
    const inst = byUnitid[uid];
    if (!inst) continue;
    const safeCount = themeByUnitidSafe[uid]?.[theme];
    if (safeCount !== undefined) {
      namedVolume.push({ inst, count: safeCount });
    } else {
      smallSchoolCount++;
      // We know presence but not exact count; treat as 1 or 2 (avg ~1.5).
      smallSchoolApps += 1;
    }
  }
  namedVolume.sort((a, b) => b.count - a.count);

  // Lean: same schools, but ranked by share of their total submissions in this theme.
  const namedLean = namedVolume
    .map(({ inst, count }) => ({
      inst,
      count,
      share: count / Math.max(inst.count, 1),
    }))
    .filter((x) => x.share > globalShare)
    .sort((a, b) => b.share - a.share);

  return (
    <div style={{ marginBottom: 32 }}>
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
            color: themeColor,
            fontWeight: 600,
          }}
        >
          ZOOM IN
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
          {theme}
        </h2>
        <div style={{ flex: 1, height: 1, background: PALETTE.ink, marginLeft: 8 }} />
        <button
          onClick={onClear}
          style={{
            padding: "5px 10px",
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
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: themeColor,
              marginBottom: 8,
            }}
          >
            Volume — most {theme.split(" ")[0].toLowerCase()} ventures
          </div>
          <div
            style={{
              background: PALETTE.paper,
              border: `1px solid ${PALETTE.ink}`,
              padding: 18,
            }}
          >
            {namedVolume.slice(0, 8).map(({ inst, count }) => {
              const max = namedVolume[0]?.count || 1;
              const w = (count / max) * 100;
              return (
                <div key={inst.unitid} style={{ marginBottom: 10 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      fontSize: 13,
                      marginBottom: 3,
                      gap: 8,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{inst.name}</span>
                    <span
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 11,
                        color: "#666",
                      }}
                    >
                      {count} of {inst.count}
                    </span>
                  </div>
                  <div style={{ height: 8, background: PALETTE.paleRule }}>
                    <div style={{ width: `${w}%`, height: "100%", background: themeColor }} />
                  </div>
                </div>
              );
            })}
            {smallSchoolCount > 0 && (
              <div
                style={{
                  marginTop: 12,
                  fontSize: 12,
                  color: PALETTE.muted,
                  fontStyle: "italic",
                }}
              >
                + {smallSchoolCount} more institutions with 1–2 {theme} submissions each
                (names not shown to protect small-team identity).
              </div>
            )}
          </div>
        </div>

        <div>
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: themeColor,
              marginBottom: 8,
            }}
          >
            Lean — {theme.split(" ")[0].toLowerCase()} as % of school's mix
          </div>
          <div
            style={{
              background: PALETTE.paper,
              border: `1px solid ${PALETTE.ink}`,
              padding: 18,
            }}
          >
            {namedLean.length === 0 && (
              <div style={{ fontSize: 13, color: PALETTE.muted, fontStyle: "italic" }}>
                No school is over-indexed on {theme} above the global average of{" "}
                {Math.round(globalShare * 100)}%.
              </div>
            )}
            {namedLean.slice(0, 8).map(({ inst, count, share }) => {
              const w = Math.min(share, 1) * 100;
              return (
                <div key={inst.unitid} style={{ marginBottom: 10 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      fontSize: 13,
                      marginBottom: 3,
                      gap: 8,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{inst.name}</span>
                    <span
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 11,
                        color: "#666",
                      }}
                    >
                      {Math.round(share * 100)}% ({count}/{inst.count})
                    </span>
                  </div>
                  <div style={{ height: 8, background: PALETTE.paleRule, position: "relative" }}>
                    <div
                      style={{
                        width: `${w}%`,
                        height: "100%",
                        background: themeColor,
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: -2,
                        left: `${globalShare * 100}%`,
                        height: 12,
                        width: 1,
                        background: PALETTE.ink,
                      }}
                      title={`Global avg: ${Math.round(globalShare * 100)}%`}
                    />
                  </div>
                </div>
              );
            })}
            {namedLean.length > 0 && (
              <div
                style={{
                  marginTop: 12,
                  fontSize: 12,
                  color: PALETTE.muted,
                  fontStyle: "italic",
                }}
              >
                Vertical line on each bar = global average for {theme} ({Math.round(globalShare * 100)}%).
                Schools shown have proportionally more of their portfolio in this theme than the field as a whole.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
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
