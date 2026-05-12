import React, { useState, useMemo, useEffect } from "react";
import * as d3 from "d3";
import RAW_DATA from "../data/institutions.json";
import THEMES from "../data/themes.json";
import TEAM_PROFILE from "../data/team_profile_public.json";

const THEME_ORDER = [
  "Healthcare",
  "Industrial/Energy",
  "Productivity/Workflow",
  "Education",
  "Personal/Lifestyle",
  "Media/Creative",
  "Public Sector/Civic",
  "Finance",
  "Frontier/Deep Tech",
  "Other",
];

const THEME_COLORS = {
  Healthcare: "#c41230",
  "Industrial/Energy": "#3d5e30",
  "Productivity/Workflow": "#0a4d68",
  Education: "#1f4528",
  "Personal/Lifestyle": "#a87f0a",
  "Media/Creative": "#7a4429",
  "Public Sector/Civic": "#5a3838",
  Finance: "#1f3a8a",
  "Frontier/Deep Tech": "#6b21a8",
  Other: "#5A5A5A",
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

// Mays brand tokens. See BRAND.md in Method Lab project.
const PALETTE = {
  maroon: "#500000",       // Aggie Maroon. Headings, primary buttons.
  maroonDeep: "#3C0000",   // Link color, button border.
  maroonMuted: "#732F2F",  // Eyebrows, dotted frame outline, muted accents.
  ink: "#000000",          // Strong text, body copy when emphasis matters.
  inkSecondary: "#1A1A1A", // Default body paragraph color. Darkened per Cindy for stronger type contrast.
  inkMuted: "#2A2A2A",     // Captions, helper text. Darkened per Cindy. ~14:1 on white.
  bg: "#FFFFFF",           // Default background.
  bgSubtle: "#EAEAEA",     // Footer / alternating section background.
  line: "#999999",         // Default 1px border / divider. Bumped from #D1D1D1 to clear WCAG 1.4.11 (3:1 non-text contrast) on white.
  // Legacy names preserved for code that still references them; mapped to
  // new tokens so a brand-pure surface comes through.
  cream: "#FFFFFF",
  paper: "#FFFFFF",
  rule: "#000000",
  muted: "#1A1A1A",
  faint: "#2A2A2A",
  gold: "#500000",
  paleRule: "#D1D1D1",
};

const FONT_DISPLAY = "'Oswald', Arial, sans-serif";
const FONT_BODY = "'Work Sans', Arial, sans-serif";

// Helper: collapse spaces around slashes for inline display.
function dispLabel(s) {
  return typeof s === "string" ? s.replace(/\s*\/\s*/g, "/") : s;
}

// AP-style title case: capitalize all major words, lowercase short articles/prepositions/conjunctions
// EXCEPT when first or last in the title.
const TITLE_LOWERCASE = new Set([
  "a", "an", "and", "as", "at", "but", "by", "en", "for", "if", "in", "is", "of",
  "on", "or", "the", "to", "v", "vs", "via",
]);
function titleCase(str) {
  if (!str) return str;
  const words = str.split(/(\s+)/);
  let firstSeen = false;
  const lastIdx = words.findLastIndex((w) => /\S/.test(w));
  return words
    .map((w, i) => {
      if (!/\S/.test(w)) return w;
      // Preserve all-caps acronyms (e.g., "AI", "MVP", "U.S.").
      if (w.length > 1 && w === w.toUpperCase() && /[A-Z]/.test(w)) return w;
      const lower = w.toLowerCase();
      const isFirst = !firstSeen;
      const isLast = i === lastIdx;
      firstSeen = true;
      if (!isFirst && !isLast && TITLE_LOWERCASE.has(lower)) return lower;
      return lower[0].toUpperCase() + lower.slice(1);
    })
    .join("");
}

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
    const tokens = q.split(/\s+/).filter(Boolean);
    return RAW.filter((d) => {
      const stateName = STATE_FULL_NAMES[d.state]?.toLowerCase() || "";
      const haystack = `${d.name.toLowerCase()} ${d.cityState.toLowerCase()} ${stateName} ${d.state?.toLowerCase() || ""}`;
      // Every token in the query must appear somewhere in the haystack.
      return tokens.every((t) => haystack.includes(t));
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
        fontFamily: FONT_BODY,
        background: PALETTE.bg,
        minHeight: "100vh",
        color: PALETTE.ink,
      }}
    >
      <style>{`
        @media (max-width: 900px) {
          .map-grid { grid-template-columns: 1fr !important; }
          .stat-strip { grid-template-columns: repeat(2, 1fr) !important; }
          .region-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .where-grid { grid-template-columns: 1fr !important; }
          .who-grid { grid-template-columns: 1fr !important; }
          .focus-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 600px) {
          .stat-strip { grid-template-columns: 1fr !important; }
          .region-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      {/* Brand ribbon — TAMU → Mays breadcrumb. Mirrors mays.tamu.edu's site-wide ribbon. */}
      <div
        role="banner"
        style={{
          background: PALETTE.maroon,
          color: PALETTE.bg,
          fontFamily: FONT_BODY,
          fontSize: "1rem",
          padding: "8px 24px",
          letterSpacing: "0.02em",
        }}
      >
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <a
            href="https://www.tamu.edu/"
            style={{ color: PALETTE.bg, textDecoration: "none", marginRight: 8 }}
          >
            Texas A&amp;M University
          </a>
          <span aria-hidden="true" style={{ opacity: 0.6 }}>›</span>
          <a
            href="https://mays.tamu.edu/"
            style={{ color: PALETTE.bg, textDecoration: "none", marginLeft: 8 }}
          >
            Mays Business School
          </a>
        </div>
      </div>

      <main style={{ maxWidth: 1240, margin: "0 auto", padding: "32px 24px" }}>
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
              fontFamily: FONT_BODY,
              fontSize: "1rem",
              letterSpacing: "0.18em",
              color: PALETTE.maroonMuted,
              textTransform: "uppercase",
              marginBottom: 8,
              fontWeight: 600,
            }}
          >
            Mays Business School · Texas A&amp;M University
          </div>
          <h1
            style={{
              fontFamily: FONT_DISPLAY,
              fontWeight: 400,
              fontSize: "clamp(2rem, 4.5vw, 3rem)",
              lineHeight: 1.2,
              margin: "0 0 0.75rem 0",
              color: PALETTE.maroon,
            }}
          >
            The 2026 AI Venture Velocity Challenge, Mapped.
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
            {TOTAL_APPS_DISPLAY} applications. {TOTAL_INSTITUTIONS_DISPLAY} institutions.
            The inaugural Challenge drew submissions from research universities,
            regional campuses, liberal arts colleges, master's-focused universities,
            community colleges, and technical colleges across all four U.S. Census regions.
          </p>
          <p style={{ margin: "12px 0 0 0", fontSize: "1rem", color: PALETTE.inkSecondary }}>
            <a
              href="https://mays.tamu.edu/ai/competition/ai-competition-details/"
              style={{
                color: PALETTE.maroonDeep,
                fontWeight: 600,
                textDecoration: "underline",
              }}
            >
              Learn more about the competition →
            </a>
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
            <h2
              id="find-institution-heading"
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: "1.375rem",
                fontWeight: 600,
                color: PALETTE.bg,
                margin: 0,
              }}
            >
              Find Your Institution
            </h2>
          </div>
          <div style={{ flex: "1 1 320px", position: "relative", minWidth: 320 }}>
            <input
              type="text"
              placeholder="Type a school, city, or state…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSearch("");
                  setZoomedSchool(null);
                }
              }}
              style={{
                padding: "12px 38px 12px 16px",
                fontFamily: FONT_BODY,
                fontSize: 16,
                border: `1px solid ${PALETTE.cream}`,
                background: PALETTE.paper,
                color: PALETTE.ink,
                width: "100%",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            {search.length > 0 && (
              <button
                onClick={() => {
                  setSearch("");
                  setZoomedSchool(null);
                }}
                aria-label="Clear search"
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  border: "none",
                  background: PALETTE.ink,
                  color: PALETTE.cream,
                  fontSize: 16,
                  lineHeight: "24px",
                  textAlign: "center",
                  cursor: "pointer",
                  padding: 0,
                  fontFamily: FONT_BODY,
                  zIndex: 11,
                }}
                title="Clear search (Esc)"
              >
                ×
              </button>
            )}
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
                  borderColor: PALETTE.maroon,
                }}
              >
                <div
                  style={{
                    padding: "8px 14px",
                    fontFamily: FONT_BODY,
                    fontSize: 16,
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
                        <div style={{ fontSize: 16, fontWeight: 600, color: PALETTE.ink }}>
                          {d.name}
                        </div>
                        <div
                          style={{
                            fontFamily: FONT_BODY,
                            fontSize: 16,
                            color: PALETTE.faint,
                            marginTop: 2,
                          }}
                        >
                          {d.cityState}
                        </div>
                      </div>
                      <div
                        style={{
                          fontFamily: FONT_DISPLAY,
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
          <button
            onClick={() => {
              if (search.trim() && filtered.length > 0 && filtered.length < RAW.length) {
                const top = filtered.slice().sort((a, b) => b.count - a.count)[0];
                setZoomedSchool(top);
                document.getElementById("national-footprint")?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }
            }}
            disabled={!search.trim()}
            style={{
              padding: "12px 22px",
              background: search.trim() ? PALETTE.bg : "#B8B8B8",
              color: search.trim() ? PALETTE.maroon : "#1A1A1A",
              border: `2px solid ${PALETTE.bg}`,
              fontFamily: FONT_BODY,
              fontSize: "1rem",
              fontWeight: 700,
              cursor: search.trim() ? "pointer" : "not-allowed",
              minWidth: 96,
              minHeight: 44,
            }}
          >
            Explore →
          </button>
          {zoomedSchool && (
            <div
              role="status"
              aria-live="polite"
              style={{
                padding: "12px 18px",
                background: PALETTE.maroonDeep,
                color: PALETTE.bg,
                fontFamily: FONT_BODY,
                fontSize: "1rem",
                flex: "0 1 auto",
              }}
            >
              <strong>{zoomedSchool.name}</strong> sent{" "}
              <strong style={{ color: PALETTE.bg, textDecoration: "underline" }}>
                {zoomedSchool.count}
              </strong>{" "}
              application{zoomedSchool.count !== 1 ? "s" : ""}.
            </div>
          )}
        </div>

        {/* Stat strip */}
        <div
          className="stat-strip"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 0,
            marginBottom: 28,
            borderTop: `1px solid ${PALETTE.ink}`,
            borderBottom: `1px solid ${PALETTE.ink}`,
          }}
        >
          {[
            { num: TOTAL_APPS_DISPLAY, label: "Applications" },
            { num: TOTAL_INSTITUTIONS_DISPLAY, label: "Institutions" },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                padding: "18px 20px",
                borderRight: i < 1 ? `1px solid ${PALETTE.ink}` : "none",
              }}
            >
              <div
                style={{
                  fontFamily: FONT_DISPLAY,
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
                  fontFamily: FONT_BODY,
                  fontSize: 16,
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
        <section aria-labelledby="region-heading" style={{ marginBottom: 32 }}>
          <SectionHeading id="region-heading" num="01" title="By Census Region" />
          <div
            className="region-grid"
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
                aria-pressed={active}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedRegion(active ? null : r.region);
                    clearAllThemes();
                  }
                }}
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
                <h3
                  style={{
                    fontFamily: FONT_BODY,
                    fontSize: 16,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: active ? PALETTE.gold : PALETTE.maroon,
                    margin: "0 0 6px 0",
                    fontWeight: 600,
                  }}
                >
                  {r.region}
                </h3>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <div
                    style={{
                      fontFamily: FONT_DISPLAY,
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
                      fontFamily: FONT_BODY,
                      fontSize: 16,
                      color: PALETTE.inkSecondary,
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
                    fontSize: 16,
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
        </section>

        {/* Map */}
        <section aria-labelledby="footprint-heading" id="national-footprint">
          <SectionHeading id="footprint-heading" num="02" title="The National Footprint" />
        <div
          className="map-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 320px",
            gap: 24,
            alignItems: "start",
            marginBottom: 32,
          }}
        >
          <div>
            {(hasFilter || search) && (
              <button
                onClick={() => {
                  clearAllThemes();
                  setSelectedRegion(null);
                  setSearch("");
                  setZoomedSchool(null);
                }}
                style={{
                  marginBottom: 12,
                  padding: "10px 18px",
                  background: PALETTE.bg,
                  color: PALETTE.maroonDeep,
                  border: `2px solid ${PALETTE.maroonDeep}`,
                  fontFamily: FONT_BODY,
                  fontSize: "1rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  minHeight: 44,
                }}
                aria-label="Reset map: clear all filters and search"
              >
                ← Reset Map
              </button>
            )}
            <div
              style={{
                display: "flex",
                gap: 14,
                alignItems: "center",
                marginBottom: 12,
                fontFamily: FONT_BODY,
                fontSize: "1rem",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                flexWrap: "wrap",
                fontWeight: 600,
              }}
            >
              <span style={{ color: PALETTE.inkSecondary }}>Rank by:</span>
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
                fontFamily: FONT_BODY,
                fontSize: 16,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                flexWrap: "wrap",
              }}
            >
              <span style={{ color: PALETTE.inkSecondary, marginRight: 4 }}>Filter by theme:</span>
              {THEME_ORDER.filter((k) => (THEMES.themeTotals[k] || 0) > 0).map((k) => {
                const active = selectedThemes.has(k);
                const n = THEMES.themeTotals[k] || 0;
                return (
                  <button
                    key={k}
                    onClick={() => toggleTheme(k)}
                    aria-pressed={active}
                    style={{
                      padding: "5px 9px",
                      background: active ? THEME_COLORS[k] : "transparent",
                      color: active ? "#fff" : PALETTE.ink,
                      border: `1px solid ${active ? THEME_COLORS[k] : PALETTE.ink}`,
                      fontFamily: FONT_BODY,
                      fontSize: 16,
                      cursor: "pointer",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {dispLabel(k)}
                    <span
                      style={{
                        marginLeft: 6,
                        color: active ? "#FFFFFF" : PALETTE.inkMuted,
                        fontWeight: 600,
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
                    fontFamily: FONT_BODY,
                    fontSize: 16,
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
                  fontFamily: FONT_BODY,
                  fontSize: 16,
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
                            <strong style={{ color: THEME_COLORS[t] }}>{dispLabel(t)}</strong>
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
                aspectRatio: `${W} / ${H}`,
              }}
            >
              <svg
                viewBox={`0 0 ${W} ${H}`}
                role="img"
                aria-label={`Map of the United States showing ${TOTAL_INSTITUTIONS_DISPLAY} institutions that submitted to the AI Venture Velocity Challenge. ${selectedRegion ? `Currently spotlighting the ${selectedRegion} region.` : ""}${hasThemeFilter ? ` Currently filtered to show schools with submissions in: ${[...selectedThemes].map(dispLabel).join(", ")}.` : ""}`}
                style={{ width: "100%", height: "100%", display: "block" }}
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
                        />
                        <text
                          x={0}
                          y={1}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontFamily={FONT_DISPLAY}
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
                          aria-hidden="true"
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
                          fontFamily={FONT_BODY}
                          fontWeight={600}
                          fontSize={14}
                          fill={PALETTE.cream}
                        >
                          {d.name}
                        </text>
                        <text
                          x={lx + 8}
                          y={y}
                          fontFamily={FONT_BODY}
                          fontSize={14}
                          fill={PALETTE.gold}
                          letterSpacing="0.1em"
                        >
                          {(() => {
                            if (hasThemeFilter) {
                              const tc = themeCountForSchool(d.unitid);
                              const themeLabel = onlyTheme || "selected themes";
                              if (tc !== null) {
                                return `${tc} ${dispLabel(themeLabel).toUpperCase()} APP${tc !== 1 ? "S" : ""}`;
                              }
                              return `1–2 ${dispLabel(themeLabel).toUpperCase()} APPS`;
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
                  fontFamily: FONT_BODY,
                  fontSize: 16,
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
            <h3
              style={{
                padding: "14px 18px",
                margin: 0,
                borderBottom: `1px solid ${PALETTE.ink}`,
                fontFamily: FONT_BODY,
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                background: PALETTE.ink,
                color: PALETTE.cream,
                position: "sticky",
                top: 0,
              }}
            >
              {hasThemeFilter
                ? `Ranked: ${onlyTheme ? dispLabel(onlyTheme) + " " : ""}Submissions`
                : scaleMode === "count"
                ? "Ranked: Total Applications"
                : "Ranked: Apps per 1k Students"}
            </h3>
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
                          role="button"
                          tabIndex={0}
                          aria-label={`${d.name}. ${d.cityState} · ${total} of ${d.count}. ${total} ${onlyTheme ? dispLabel(onlyTheme) + " " : ""}submissions. Activate to spotlight on the map.`}
                          onMouseEnter={() => setHovered(d.unitid)}
                          onMouseLeave={() => setHovered(null)}
                          onClick={() => {
                            setSearch(d.name);
                            setZoomedSchool(d);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSearch(d.name);
                              setZoomedSchool(d);
                            }
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
                            aria-hidden="true"
                            style={{
                              fontFamily: FONT_BODY,
                              fontSize: 16,
                              color: PALETTE.faint,
                            }}
                          >
                            {String(i + 1).padStart(3, "0")}
                          </div>
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.2 }}>
                              {d.name}
                            </div>
                            <div
                              style={{
                                fontFamily: FONT_BODY,
                                fontSize: 16,
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
                              fontFamily: FONT_DISPLAY,
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
                          fontSize: 16,
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
                    role="button"
                    tabIndex={0}
                    aria-label={`${d.name}. ${d.cityState}. ${scaleMode === "count" ? `${d.count} applications` : `${d.perCapita.toFixed(2)} apps per 1k students`}. Activate to spotlight on the map.`}
                    onMouseEnter={() => setHovered(d.unitid)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => {
                      setSearch(d.name);
                      setZoomedSchool(d);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSearch(d.name);
                        setZoomedSchool(d);
                      }
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
                      aria-hidden="true"
                      style={{
                        fontFamily: FONT_BODY,
                        fontSize: 16,
                        color: PALETTE.faint,
                      }}
                    >
                      {String(i + 1).padStart(3, "0")}
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.2 }}>
                        {d.name}
                      </div>
                      <div
                        style={{
                          fontFamily: FONT_BODY,
                          fontSize: 16,
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
                        fontFamily: FONT_DISPLAY,
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
        </section>

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
            fontFamily: FONT_BODY,
            fontSize: 16,
            color: PALETTE.faint,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            textAlign: "center",
          }}
        >
          Built for the AI Venture Velocity Challenge · Mays Business School
        </div>
      </main>
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
        fontFamily: FONT_BODY,
        fontSize: 16,
        cursor: "pointer",
        letterSpacing: "0.1em",
      }}
    >
      {children}
    </button>
  );
}

function SectionHeading({ num, title, id }) {
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
        aria-hidden="true"
        style={{
          fontFamily: FONT_BODY,
          fontSize: "1rem",
          letterSpacing: "0.18em",
          color: PALETTE.maroonMuted,
          fontWeight: 600,
          textTransform: "uppercase",
        }}
      >
        {num}
      </div>
      <h2
        id={id}
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: "clamp(1.5rem, 2.6vw, 2rem)",
          fontWeight: 400,
          margin: 0,
          color: PALETTE.maroon,
          lineHeight: 1.2,
        }}
      >
        {titleCase(title)}
      </h2>
      <div
        style={{
          flex: 1,
          height: 1,
          background: PALETTE.line,
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
              fontFamily={FONT_BODY}
              fontSize={14}
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
              fontFamily={FONT_BODY}
              fontSize={14}
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
        fontFamily={FONT_BODY}
        fontSize={14}
        fill="#2A2A2A"
      >
        1
      </text>
      <text
        x={pad.l + innerW}
        y={H - 10}
        textAnchor="end"
        fontFamily={FONT_BODY}
        fontSize={14}
        fill="#2A2A2A"
      >
        {data.length}
      </text>
      <text
        x={pad.l + innerW / 2}
        y={H - 10}
        textAnchor="middle"
        fontFamily={FONT_BODY}
        fontSize={14}
        fill="#2A2A2A"
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
        const RowEl = onRowClick ? "button" : "div";
        const interactiveProps = onRowClick
          ? {
              type: "button",
              "aria-pressed": !!isActiveRow,
              onClick: () => onRowClick(colorKey),
            }
          : {};
        return (
          <RowEl
            key={colorKey}
            {...interactiveProps}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              font: "inherit",
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
                fontSize: 16,
                marginBottom: 3,
              }}
            >
              <span style={{ fontWeight: 600 }}>{dispLabel(d.label)}</span>
              <span
                style={{
                  fontFamily: FONT_BODY,
                  fontSize: "1rem",
                  color: PALETTE.inkSecondary,
                }}
              >
                {meta}
              </span>
            </div>
            <div style={{ height: 8, background: PALETTE.line }}>
              <div
                style={{
                  width: `${w}%`,
                  height: "100%",
                  background: colorMap[colorKey] || colorMap[d.label] || PALETTE.maroon,
                }}
              />
            </div>
          </RowEl>
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
      <section aria-labelledby="where-heading">
      <div style={{ marginBottom: 8 }}>
        <SectionHeading id="where-heading" num="03" title="Where the building is happening" />
      </div>
      <p
        style={{
          fontFamily: FONT_BODY,
          fontSize: "1rem",
          color: PALETTE.inkSecondary,
          marginTop: 0,
          marginBottom: 18,
          maxWidth: 760,
        }}
      >
        Click any industry below to spotlight only those schools on the map. Click again to clear, or pick more than one to combine.
      </p>
      <div
        className="where-grid"
        style={{
          marginBottom: 32,
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: 20,
        }}
      >
        <div>
          <h3
            style={{
              fontFamily: FONT_BODY,
              fontSize: "1rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: PALETTE.maroonMuted,
              margin: "0 0 8px 0",
              fontWeight: 600,
            }}
          >
            Industries
          </h3>
          <BarBreakdown
            data={themeRows}
            total={readableTotal}
            colorMap={THEME_COLORS}
            onRowClick={(k) => toggleTheme(k)}
            isActive={(k) => selectedThemes.has(k)}
          />
        </div>

        <div>
          <h3
            style={{
              fontFamily: FONT_BODY,
              fontSize: 16,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: PALETTE.maroonMuted,
              margin: "0 0 8px 0",
              fontWeight: 600,
            }}
          >
            What's Powering Them
          </h3>
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
                      fontSize: 16,
                      marginBottom: 3,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{TAG_DISPLAY[key]}</span>
                    <span
                      style={{
                        fontFamily: FONT_BODY,
                        fontSize: 16,
                        color: PALETTE.inkSecondary,
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
              fontFamily: FONT_BODY,
              fontSize: 16,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: PALETTE.faint,
            }}
          >
            Themes inferred from {readableTotal} submitted snapshots ({Math.round((readableTotal / TOTAL_APPS_DISPLAY) * 100)}% coverage).
          </div>
        </div>
      </div>

      </section>

      {/* Section 04: Who's Building */}
      <section aria-labelledby="who-heading">
      <div style={{ marginBottom: 14 }}>
        <SectionHeading id="who-heading" num="04" title="Who's building" />
      </div>
      <div
        className="who-grid"
        style={{
          marginBottom: 32,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
        }}
      >
        <div>
          <h3
            style={{
              fontFamily: FONT_BODY,
              fontSize: 16,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: PALETTE.maroonMuted,
              margin: "0 0 8px 0",
              fontWeight: 600,
            }}
          >
            Venture Stage
          </h3>
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
                      fontSize: 16,
                      marginBottom: 3,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{s.label}</span>
                    <span
                      style={{
                        fontFamily: FONT_BODY,
                        fontSize: 16,
                        color: PALETTE.inkSecondary,
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
          <h3
            style={{
              fontFamily: FONT_BODY,
              fontSize: 16,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: PALETTE.maroonMuted,
              margin: "0 0 8px 0",
              fontWeight: 600,
            }}
          >
            Target Customer
          </h3>
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
                      fontSize: 16,
                      marginBottom: 3,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{t.label}</span>
                    <span
                      style={{
                        fontFamily: FONT_BODY,
                        fontSize: 16,
                        color: PALETTE.inkSecondary,
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

      {/* Section 04, row 2: who the builders themselves are. Confirmation-form basis. */}
      {(() => {
        const collegeMix = TEAM_PROFILE?.collegeMix || [];
        const studentLevel = TEAM_PROFILE?.studentLevel || [];
        const confirmedTotal = TEAM_PROFILE?.totals?.confirmedTeams || 0;
        const collegeMax = Math.max(1, ...collegeMix.map((d) => d.count));
        const levelMax = Math.max(1, ...studentLevel.map((d) => d.count));
        const Bar = ({ items, max, total, color }) => (
          <div
            style={{
              background: PALETTE.paper,
              border: `1px solid ${PALETTE.ink}`,
              padding: 18,
            }}
          >
            {items.map((d) => {
              const w = (d.count / max) * 100;
              const pct = total ? (d.count / total) * 100 : 0;
              return (
                <div key={d.label} style={{ marginBottom: 10 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      fontSize: 16,
                      marginBottom: 3,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{d.label}</span>
                    <span
                      style={{
                        fontFamily: FONT_BODY,
                        fontSize: 16,
                        color: PALETTE.inkSecondary,
                      }}
                    >
                      {d.count} · {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div style={{ height: 8, background: PALETTE.paleRule }}>
                    <div
                      style={{
                        width: `${w}%`,
                        height: "100%",
                        background: color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        );
        return (
          <>
            <div
              className="who-grid"
              style={{
                marginTop: 8,
                marginBottom: 12,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 24,
              }}
            >
              <div>
                <h3
                  style={{
                    fontFamily: FONT_BODY,
                    fontSize: 16,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: PALETTE.maroonMuted,
                    margin: "0 0 8px 0",
                    fontWeight: 600,
                  }}
                >
                  Home College or School
                </h3>
                <Bar items={collegeMix} max={collegeMax} total={confirmedTotal} color={PALETTE.maroon} />
              </div>
              <div>
                <h3
                  style={{
                    fontFamily: FONT_BODY,
                    fontSize: 16,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: PALETTE.maroonMuted,
                    margin: "0 0 8px 0",
                    fontWeight: 600,
                  }}
                >
                  Student Level
                </h3>
                <Bar items={studentLevel} max={levelMax} total={confirmedTotal} color={PALETTE.maroon} />
              </div>
            </div>
            <p
              style={{
                fontFamily: FONT_BODY,
                fontSize: 14,
                color: PALETTE.inkMuted,
                marginTop: 0,
                marginBottom: 32,
                fontStyle: "italic",
                maxWidth: 760,
              }}
            >
              The two panels above are drawn from the {confirmedTotal} teams that have completed
              the post-application Confirmation Form. The remaining {528 - confirmedTotal} applications
              had not returned a profile when this snapshot was generated.
            </p>
          </>
        );
      })()}
      </section>
    </>
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
            fontFamily: FONT_BODY,
            fontSize: 16,
            letterSpacing: "0.2em",
            color: themeColor,
            fontWeight: 600,
          }}
        >
          ZOOM IN
        </div>
        <h2
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: "clamp(1.5rem, 2.6vw, 2rem)",
            fontWeight: 400,
            margin: 0,
            color: PALETTE.maroon,
            lineHeight: 1.2,
          }}
        >
          {dispLabel(theme)}
        </h2>
        <div style={{ flex: 1, height: 1, background: PALETTE.ink, marginLeft: 8 }} />
        <button
          onClick={onClear}
          style={{
            padding: "5px 10px",
            background: PALETTE.ink,
            color: PALETTE.cream,
            border: `1px solid ${PALETTE.ink}`,
            fontFamily: FONT_BODY,
            fontSize: 16,
            cursor: "pointer",
            letterSpacing: "0.1em",
          }}
        >
          Clear ✕
        </button>
      </div>

      <div
        className="focus-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
        }}
      >
        <div>
          <h3
            style={{
              fontFamily: FONT_BODY,
              fontSize: 16,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: themeColor,
              margin: "0 0 8px 0",
              fontWeight: 600,
            }}
          >
            Volume — most {theme.split(" ")[0].toLowerCase()} ventures
          </h3>
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
                      fontSize: 16,
                      marginBottom: 3,
                      gap: 8,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{inst.name}</span>
                    <span
                      style={{
                        fontFamily: FONT_BODY,
                        fontSize: 16,
                        color: PALETTE.inkSecondary,
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
                  fontSize: 16,
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
          <h3
            style={{
              fontFamily: FONT_BODY,
              fontSize: 16,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: themeColor,
              margin: "0 0 8px 0",
              fontWeight: 600,
            }}
          >
            Lean — {theme.split(" ")[0].toLowerCase()} as % of school's mix
          </h3>
          <div
            style={{
              background: PALETTE.paper,
              border: `1px solid ${PALETTE.ink}`,
              padding: 18,
            }}
          >
            {namedLean.length === 0 && (
              <div style={{ fontSize: 16, color: PALETTE.muted, fontStyle: "italic" }}>
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
                      fontSize: 16,
                      marginBottom: 3,
                      gap: 8,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{inst.name}</span>
                    <span
                      style={{
                        fontFamily: FONT_BODY,
                        fontSize: 16,
                        color: PALETTE.inkSecondary,
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
                  fontSize: 16,
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
