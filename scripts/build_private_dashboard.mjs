#!/usr/bin/env node
// Build the private dashboard data from the Team Confirmation Form CSV.
//
// Reads the raw Google Forms CSV, dedupes 466 rows -> 442 unique Team IDs
// (latest Timestamp wins), aggregates all quantitative panels, extracts
// anonymized text responses for offline theme clustering, and writes the
// merged dashboard JSON.
//
// Two-pass workflow:
//   Pass 1 (no themes_input.json): writes _text_dump.json for human review.
//   Pass 2 (themes_input.json present): merges themes into the final JSON.
//
// Run from the aivvc-map directory:
//   node scripts/build_private_dashboard.mjs \
//     "../AI Venture Velocity Challenge 2026 Team Confirmation Form (Responses) - Form Responses 1 (2).csv"

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const CSV_PATH = process.argv[2];
if (!CSV_PATH) {
  console.error("Usage: build_private_dashboard.mjs <csv-path>");
  process.exit(2);
}
if (!fs.existsSync(CSV_PATH)) {
  console.error(`CSV not found: ${CSV_PATH}`);
  process.exit(2);
}

// ---------- CSV parser (handles quoted fields with commas/newlines) ----------

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let i = 0;
  let inQuotes = false;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function rowsToObjects(rows) {
  if (rows.length === 0) return [];
  // Google Forms exports sometimes wrap a long header across a literal newline
  // inside a quoted field. parseCSV already handles that, so headers come back
  // as a single row.
  const header = rows[0].map((h) => h.replace(/\s+/g, " ").trim());
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length === 1 && row[0].trim() === "") continue;
    const obj = {};
    for (let c = 0; c < header.length; c++) {
      obj[header[c]] = (row[c] ?? "").trim();
    }
    out.push(obj);
  }
  return out;
}

// ---------- Anonymization ----------

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_RE = /\+?\d{1,3}[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;
const URL_RE = /https?:\/\/\S+/gi;

function anonymizeQuote(text) {
  if (!text) return "";
  return text
    .replace(EMAIL_RE, "[email]")
    .replace(PHONE_RE, "[phone]")
    .replace(URL_RE, "[url]")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------- Bucket helpers ----------

function counterToList(counter) {
  return Object.entries(counter)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ label: k, count: v }));
}

function counterToListPreserveOrder(counter, order) {
  return order
    .filter((k) => counter[k] !== undefined)
    .map((k) => ({ label: k, count: counter[k] }));
}

function crosstab(rows, rowKeyFn, colKeyFn, rowOrder, colOrder) {
  const table = {};
  const rowKeys = new Set();
  const colKeys = new Set();
  for (const r of rows) {
    const rk = rowKeyFn(r);
    const ck = colKeyFn(r);
    if (!rk || !ck) continue;
    rowKeys.add(rk);
    colKeys.add(ck);
    if (!table[rk]) table[rk] = {};
    table[rk][ck] = (table[rk][ck] || 0) + 1;
  }
  const finalRows = rowOrder ? rowOrder.filter((k) => rowKeys.has(k)) : [...rowKeys];
  const finalCols = colOrder ? colOrder.filter((k) => colKeys.has(k)) : [...colKeys];
  return {
    rows: finalRows,
    cols: finalCols,
    cells: finalRows.map((rk) => finalCols.map((ck) => table[rk]?.[ck] || 0)),
  };
}

// ---------- Bucketers (normalize raw form responses) ----------

function parseTimestamp(s) {
  // "5/3/2026 22:45:58" -> Date
  if (!s) return new Date(0);
  const [d, t] = s.split(" ");
  const [mo, da, yr] = d.split("/").map((x) => parseInt(x, 10));
  const [hh = 0, mm = 0, ss = 0] = (t || "0:0:0").split(":").map((x) => parseInt(x, 10));
  return new Date(yr, mo - 1, da, hh, mm, ss);
}

function bucketTeamSize(s) {
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n <= 0) return "Unspecified";
  if (n === 1) return "1 (solo)";
  if (n === 2) return "2";
  if (n === 3) return "3";
  if (n === 4) return "4";
  if (n >= 5 && n <= 6) return "5–6";
  return "7+";
}
const TEAM_SIZE_ORDER = ["1 (solo)", "2", "3", "4", "5–6", "7+", "Unspecified"];

function bucketStudentLevel(s) {
  if (!s) return "Unspecified";
  const t = s.toLowerCase();
  if (t.includes("undergrad")) return "Undergraduate";
  if (t.includes("master")) return "Master's";
  if (t.includes("phd") || t.includes("doctor")) return "Doctoral";
  if (t.includes("postdoc")) return "Postdoctoral";
  if (t.includes("recent grad") || t.includes("alum")) return "Recent grad / alum";
  return "Other";
}
const STUDENT_LEVEL_ORDER = [
  "Undergraduate",
  "Master's",
  "Doctoral",
  "Postdoctoral",
  "Recent grad / alum",
  "Other",
  "Unspecified",
];

function bucketStage(s) {
  if (!s) return "Unspecified";
  const t = s.toLowerCase();
  if (t.includes("customer discovery") || t.includes("problem validation") || t.includes("idea"))
    return "Idea / discovery";
  if (t.includes("prototype")) return "Prototype";
  if (t.includes("mvp")) return "Working MVP";
  if (t.includes("traction") || t.includes("paying") || t.includes("users")) return "Has traction";
  if (t.includes("scale") || t.includes("scaling") || t.includes("growth")) return "Scaling";
  return "Other";
}
const STAGE_ORDER = ["Idea / discovery", "Prototype", "Working MVP", "Has traction", "Scaling", "Other", "Unspecified"];

function bucketAIExperience(s) {
  if (!s) return "Unspecified";
  const t = s.toLowerCase();
  if (t.includes("never") || t.includes("no experience")) return "None / new to AI";
  if (t.includes("beginner") || t.includes("light") || t.includes("limited") || t.includes("basic") || t.includes("some experience"))
    return "Beginner";
  if (t.includes("comfortable") || t.includes("intermediate") || t.includes("regular"))
    return "Comfortable / intermediate";
  if (t.includes("advanced") || t.includes("expert") || t.includes("daily") || t.includes("power user"))
    return "Advanced / power user";
  if (t.includes("build") || t.includes("ship") || t.includes("develop")) return "Builds AI products";
  return "Other";
}
const AI_EXP_ORDER = [
  "None / new to AI",
  "Beginner",
  "Comfortable / intermediate",
  "Advanced / power user",
  "Builds AI products",
  "Other",
  "Unspecified",
];

function bucketChannel(s) {
  if (!s) return "Unspecified";
  const t = s.toLowerCase();
  if (t.includes("entrepreneurship center") || t.includes("campus program") || t.includes("incubator"))
    return "Campus entrepreneurship center / program";
  if (t.includes("faculty") || t.includes("professor") || t.includes("instructor"))
    return "Faculty / professor";
  if (t.includes("classmate") || t.includes("friend") || t.includes("peer") || t.includes("teammate"))
    return "Peer / classmate";
  if (t.includes("email") && (t.includes("newsletter") || t.includes("listserv") || t.includes("blast")))
    return "Email newsletter / listserv";
  if (t.includes("email")) return "Direct email";
  if (t.includes("linkedin")) return "LinkedIn";
  if (t.includes("instagram")) return "Instagram";
  if (t.includes("tiktok")) return "TikTok";
  if (t.includes("twitter") || t.includes(" x ") || t === "x")
    return "X / Twitter";
  if (t.includes("reddit")) return "Reddit";
  if (t.includes("discord") || t.includes("slack")) return "Discord / Slack";
  if (t.includes("hackathon")) return "Hackathon";
  if (t.includes("flyer") || t.includes("poster")) return "Flyer / poster";
  if (t.includes("mays") || t.includes("texas a&m") || t.includes("tamu"))
    return "Mays / Texas A&M channel";
  if (t.includes("google") || t.includes("search")) return "Search";
  if (t.includes("word of mouth") || t.includes("told me") || t.includes("mentioned"))
    return "Word of mouth";
  if (t.includes("youtube")) return "YouTube";
  if (t.includes("podcast")) return "Podcast";
  return "Other";
}

function bucketCollege(s) {
  if (!s) return "Unspecified";
  const t = s.toLowerCase();
  if (t.includes("engineer")) return "Engineering";
  if (t.includes("business") || t.includes("management") || t.includes("mba"))
    return "Business / management";
  if (t.includes("comput") || t.includes("informatics") || t.includes("data sci"))
    return "Computing / informatics";
  if (t.includes("liberal arts") || t.includes("humanities") || t.includes("arts and sciences"))
    return "Liberal arts / humanities";
  if (t.includes("medicine") || t.includes("medical") || t.includes("health") || t.includes("nursing"))
    return "Medicine / health";
  if (t.includes("law")) return "Law";
  if (t.includes("public policy") || t.includes("public affairs") || t.includes("government"))
    return "Public policy / affairs";
  if (t.includes("education")) return "Education";
  if (t.includes("design") || t.includes("architecture")) return "Design / architecture";
  if (t.includes("science")) return "Sciences";
  if (t.includes("agric")) return "Agriculture";
  return "Other";
}

function bucketMajor(s) {
  if (!s) return "Unspecified";
  const t = s.toLowerCase();
  if (t.includes("comput") || t.includes("software") || t.includes("cs ") || t.startsWith("cs"))
    return "Computer / software";
  if (t.includes("data") || t.includes("analytics") || t.includes("statistics")) return "Data / analytics / stats";
  if (t.includes("electrical") || t.includes("ece") || t.includes("computer engineer"))
    return "Electrical / computer engineering";
  if (t.includes("mechanical") || t.includes("aerospace") || t.includes("civil") || t.includes("chemical"))
    return "Other engineering";
  if (t.includes("business") || t.includes("finance") || t.includes("marketing") || t.includes("management") || t.includes("entrepreneur") || t.includes("mba"))
    return "Business / finance / marketing";
  if (t.includes("econom")) return "Economics";
  if (t.includes("psych") || t.includes("cog ") || t.includes("cognitive")) return "Psychology / cognitive science";
  if (t.includes("bio") || t.includes("neuro") || t.includes("genetics")) return "Biology / life sciences";
  if (t.includes("medic") || t.includes("nursing") || t.includes("health")) return "Medicine / health";
  if (t.includes("design") || t.includes("ux") || t.includes("graphic") || t.includes("art"))
    return "Design / art";
  if (t.includes("law")) return "Law";
  if (t.includes("public policy") || t.includes("public affairs") || t.includes("political"))
    return "Policy / political science";
  if (t.includes("math")) return "Mathematics";
  if (t.includes("physics")) return "Physics";
  return "Other";
}

function bucketContactRole(s) {
  if (!s) return "Unspecified";
  const t = s.toLowerCase();
  if (t.includes("entrepreneurship") || t.includes("incubator") || t.includes("startup") || t.includes("center")) {
    if (t.includes("director") || t.includes("staff") || t.includes("coordinator"))
      return "Entrepreneurship center staff";
  }
  if (t.includes("professor") || t.includes("faculty") || t.includes("instructor") || t.includes("lecturer"))
    return "Professor / faculty";
  if (t.includes("advisor") || t.includes("adviser") || t.includes("mentor")) return "Advisor / mentor";
  if (t.includes("dean") || t.includes("president") || t.includes("provost") || t.includes("admin") || t.includes("chair") || t.includes("director"))
    return "Dean / admin / director";
  if (t.includes("staff") || t.includes("coordinator")) return "Staff / coordinator";
  if (t.includes("phd") || t.includes("postdoc") || t.includes("ta ") || t.includes("graduate")) return "Grad student / postdoc";
  return "Other";
}
const CONTACT_ROLE_ORDER = [
  "Professor / faculty",
  "Entrepreneurship center staff",
  "Advisor / mentor",
  "Dean / admin / director",
  "Staff / coordinator",
  "Grad student / postdoc",
  "Other",
  "Unspecified",
];

function bucketPriorExp(s) {
  if (!s) return "Unspecified";
  const t = s.toLowerCase().trim();
  if (t === "yes" || t.startsWith("yes")) return "Yes";
  if (t === "no" || t.startsWith("no")) return "No";
  return "Other";
}

function bucketEntrepreneurSelfId(s) {
  if (!s) return "Unspecified";
  const t = s.toLowerCase().trim();
  if (t === "yes" || t.startsWith("yes")) return "Yes";
  if (t === "no" || t.startsWith("no")) return "No";
  if (t.includes("not sure") || t.includes("maybe")) return "Not sure";
  return "Other";
}

function parseGradYear(s) {
  const n = parseInt(s, 10);
  if (!Number.isFinite(n)) return null;
  if (n < 2024 || n > 2035) return null;
  return n;
}

function splitMultiSelect(s) {
  if (!s) return [];
  return s
    .split(/[,;]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function bucketAITool(raw) {
  const t = raw.toLowerCase();
  if (t.includes("chatgpt") || t === "gpt" || t.includes("openai")) return "ChatGPT / OpenAI";
  if (t.includes("claude")) return "Claude";
  if (t.includes("gemini") || t.includes("bard")) return "Gemini";
  if (t.includes("perplexity")) return "Perplexity";
  if (t.includes("notebook")) return "NotebookLM";
  if (t.includes("copilot") || t.includes("github")) return "GitHub Copilot";
  if (t.includes("cursor")) return "Cursor";
  if (t.includes("v0")) return "v0";
  if (t.includes("bolt")) return "Bolt";
  if (t.includes("lovable")) return "Lovable";
  if (t.includes("replit")) return "Replit";
  if (t.includes("dall") || t.includes("image gen") || t.includes("midjourney") || t.includes("stable diff"))
    return "Image gen (DALL·E / Midjourney / SD)";
  if (t.includes("runway") || t.includes("sora") || t.includes("video gen")) return "Video gen";
  if (t.includes("eleven") || t.includes("whisper") || t.includes("voice")) return "Voice / speech";
  if (t.includes("hugging") || t.includes("hf ")) return "Hugging Face";
  if (t.includes("llama")) return "Llama";
  if (t.includes("gemma")) return "Gemma";
  if (t.includes("qwen")) return "Qwen";
  if (t.includes("mistral")) return "Mistral";
  if (t.includes("grok")) return "Grok";
  if (t.includes("deepseek")) return "DeepSeek";
  if (t.includes("claude code")) return "Claude Code";
  if (t.includes("anthropic")) return "Anthropic API";
  if (t.includes("langchain") || t.includes("langgraph")) return "LangChain / LangGraph";
  if (t.includes("crew")) return "CrewAI";
  if (t.includes("zapier") || t.includes("make.com") || t.includes("n8n")) return "Automation (Zapier / Make / n8n)";
  return null;
}

// ---------- Column lookup ----------

const COL = {
  ts: "Timestamp",
  teamId: "Team ID",
  venture: "Venture / Team Name",
  primaryContactName: "Primary Contact Name",
  primaryEmail: "Primary Contact Email Address",
  institution: "University/College/Community College/Technical College your team is representing",
  studentEmail: "Email address from qualifying education institution",
  enrolledMay1: "Were you enrolled as a student at the institution listed above as of May 1, 2026?",
  studentLevel: "What was your student level as of May 1, 2026?",
  gradYear: "Expected or Actual Graduation Year",
  college: "College / School / Department",
  major: "Degree Program / Major",
  contactName: "Name of a faculty member, staff member, advisor, mentor, entrepreneurship center contact, professor, or administrator who can confirm your student status or connection to the institution",
  contactTitle: "Institutional Contact Title / Role",
  contactEmail: "Institutional Contact Email",
  contactRelation: "What is this person’s relationship to you or your team?",
  contactNotes: "Additional context about this contact (optional)",
  teamSize: "How many active team members are currently involved in this venture?",
  teamRoster: "Please list all active team members.",
  allEnrolledMay1: "Are all listed student team members enrolled at their institution as of May 1, 2026?",
  nonStudentRoles: "If your team includes non-student team members, advisors, mentors, or external contributors, please briefly describe their role.",
  ventureWhat: "In one or two sentences, what is your venture working on?",
  stage: "What best describes your current venture stage?",
  priorVenture: "Before this challenge, had you started a company, nonprofit, product, app, serious project, or other venture before?",
  selfIdEntrepreneur: "Before applying to this challenge, did you consider yourself an entrepreneur?",
  whyJoined: "Why did you join the AI Venture Velocity Challenge?",
  hopeToLearn: "What is the most important thing your team hopes to learn, test, prove, or build by the end of June (end of Stage 1)?",
  aiExperience: "How experienced is your team with AI tools today?",
  aiToolsUsed: "Which AI tools do you currently use or expect to use during the challenge?",
  aiHelpHow: "How do you expect AI to help your team during the challenge?",
  // Two consent columns that may have wrapped headers; pulled by partial match below
  anythingElse: "Is there anything else you would like us to know as we begin the next phase of the challenge?",
  hearAbout: "How did you hear about the AI Venture Velocity Challenge?",
};

// ---------- Main ----------

const csvText = fs.readFileSync(CSV_PATH, "utf8");
const rawRows = rowsToObjects(parseCSV(csvText));
console.error(`Read ${rawRows.length} raw form submissions`);

// Dedup by Team ID — latest Timestamp wins.
const latestByTeam = new Map();
for (const r of rawRows) {
  const id = r[COL.teamId];
  if (!id) continue;
  const ts = parseTimestamp(r[COL.ts]);
  const prev = latestByTeam.get(id);
  if (!prev || ts > prev.__ts) {
    latestByTeam.set(id, { ...r, __ts: ts });
  }
}
const teams = [...latestByTeam.values()];
teams.sort((a, b) => a.__ts - b.__ts);
console.error(`Deduped to ${teams.length} unique Team IDs`);

// Track dedup details for Section A.
const dedupRemoved = rawRows.length - teams.length;

// ---------- Section B (Institutional diversity) ----------

// B2. Within-institution colleges/schools/departments.
const collegeCounter = {};
for (const t of teams) {
  const k = bucketCollege(t[COL.college]);
  collegeCounter[k] = (collegeCounter[k] || 0) + 1;
}

// B3. State coverage — derive state from institution match against institutions.json.
const institutionsData = JSON.parse(fs.readFileSync(path.join(ROOT, "src/data/institutions.json"), "utf8"));
const instByName = new Map();
for (const i of institutionsData) {
  instByName.set(i.name.toLowerCase(), i);
}
function normalizeInstName(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}
const stateCounter = {};
const unmatchedInstitutions = [];
const matchedTeamsByState = {};
for (const t of teams) {
  const rawName = t[COL.institution];
  let inst = instByName.get((rawName || "").toLowerCase());
  if (!inst) {
    // fuzzy match: normalized startsWith
    const target = normalizeInstName(rawName);
    for (const i of institutionsData) {
      if (normalizeInstName(i.name) === target) { inst = i; break; }
    }
  }
  if (inst) {
    stateCounter[inst.state] = (stateCounter[inst.state] || 0) + 1;
    if (!matchedTeamsByState[inst.state]) matchedTeamsByState[inst.state] = [];
    matchedTeamsByState[inst.state].push(t[COL.teamId]);
  } else {
    unmatchedInstitutions.push(rawName);
  }
}
const ALL_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];
const zeroStates = ALL_STATES.filter((s) => !stateCounter[s]);
const thinStates = Object.entries(stateCounter).filter(([, n]) => n <= 2).map(([s, n]) => ({ state: s, count: n })).sort((a, b) => a.count - b.count || a.state.localeCompare(b.state));

// B4. Faculty-contact role mix.
const contactRoleCounter = {};
for (const t of teams) {
  // Use Title field when present, else relationship field.
  const src = t[COL.contactTitle] || t[COL.contactRelation] || "";
  const k = bucketContactRole(src);
  contactRoleCounter[k] = (contactRoleCounter[k] || 0) + 1;
}

// ---------- Section C (Who the teams are) ----------

const teamSizeCounter = {};
for (const t of teams) {
  const k = bucketTeamSize(t[COL.teamSize]);
  teamSizeCounter[k] = (teamSizeCounter[k] || 0) + 1;
}

const studentLevelCounter = {};
for (const t of teams) {
  const k = bucketStudentLevel(t[COL.studentLevel]);
  studentLevelCounter[k] = (studentLevelCounter[k] || 0) + 1;
}

const gradYearCounter = {};
for (const t of teams) {
  const y = parseGradYear(t[COL.gradYear]);
  const k = y === null ? "Unspecified" : String(y);
  gradYearCounter[k] = (gradYearCounter[k] || 0) + 1;
}
const gradYearOrder = Object.keys(gradYearCounter).filter((k) => k !== "Unspecified").sort();
if (gradYearCounter["Unspecified"]) gradYearOrder.push("Unspecified");

const majorCounter = {};
for (const t of teams) {
  const k = bucketMajor(t[COL.major]);
  majorCounter[k] = (majorCounter[k] || 0) + 1;
}

// Non-student contributors — count teams that filled out the role description field.
let teamsWithExternal = 0;
for (const t of teams) {
  const v = (t[COL.nonStudentRoles] || "").trim();
  if (v && v.length > 5 && !/^n\/?a$|^none$|^no$|^\-$/i.test(v)) teamsWithExternal++;
}

// ---------- Section D (Venture profile) ----------

const stageCounter = {};
for (const t of teams) {
  const k = bucketStage(t[COL.stage]);
  stageCounter[k] = (stageCounter[k] || 0) + 1;
}

const priorXStage = crosstab(
  teams,
  (t) => bucketPriorExp(t[COL.priorVenture]),
  (t) => bucketStage(t[COL.stage]),
  ["Yes", "No", "Other", "Unspecified"],
  STAGE_ORDER
);

const selfIdCounter = {};
for (const t of teams) {
  const k = bucketEntrepreneurSelfId(t[COL.selfIdEntrepreneur]);
  selfIdCounter[k] = (selfIdCounter[k] || 0) + 1;
}

const stageXTeamSize = crosstab(
  teams,
  (t) => bucketStage(t[COL.stage]),
  (t) => bucketTeamSize(t[COL.teamSize]),
  STAGE_ORDER,
  TEAM_SIZE_ORDER
);

// ---------- Section E (AI fluency) ----------

const aiExpCounter = {};
for (const t of teams) {
  const k = bucketAIExperience(t[COL.aiExperience]);
  aiExpCounter[k] = (aiExpCounter[k] || 0) + 1;
}

const aiToolCounter = {};
for (const t of teams) {
  const tools = splitMultiSelect(t[COL.aiToolsUsed]);
  const seen = new Set();
  for (const raw of tools) {
    const b = bucketAITool(raw);
    if (b && !seen.has(b)) {
      seen.add(b);
      aiToolCounter[b] = (aiToolCounter[b] || 0) + 1;
    }
  }
}

const aiExpXStage = crosstab(
  teams,
  (t) => bucketAIExperience(t[COL.aiExperience]),
  (t) => bucketStage(t[COL.stage]),
  AI_EXP_ORDER,
  STAGE_ORDER
);

const aiExpXLevel = crosstab(
  teams,
  (t) => bucketAIExperience(t[COL.aiExperience]),
  (t) => bucketStudentLevel(t[COL.studentLevel]),
  AI_EXP_ORDER,
  STUDENT_LEVEL_ORDER
);

// ---------- Section G (Marketing attribution) ----------

const channelCounter = {};
const teamChannel = new Map();
for (const t of teams) {
  const k = bucketChannel(t[COL.hearAbout]);
  channelCounter[k] = (channelCounter[k] || 0) + 1;
  teamChannel.set(t[COL.teamId], k);
}

const TAMU_INST_RE = /(texas a&m|texas a&m|tamu|mays)/i;
const tamuXChannel = { TAMU: {}, NonTAMU: {} };
for (const t of teams) {
  const bucket = TAMU_INST_RE.test(t[COL.institution] || "") ? "TAMU" : "NonTAMU";
  const ch = teamChannel.get(t[COL.teamId]);
  tamuXChannel[bucket][ch] = (tamuXChannel[bucket][ch] || 0) + 1;
}

const channelXStage = crosstab(
  teams,
  (t) => teamChannel.get(t[COL.teamId]),
  (t) => bucketStage(t[COL.stage]),
  null,
  STAGE_ORDER
);
// Re-sort channel rows by overall count.
channelXStage.rows.sort((a, b) => (channelCounter[b] || 0) - (channelCounter[a] || 0));
channelXStage.cells = channelXStage.rows.map((rk) => channelXStage.cols.map((ck) => {
  const r = teams.find((t) => teamChannel.get(t[COL.teamId]) === rk && bucketStage(t[COL.stage]) === ck);
  // recompute by counting (above .find was a no-op placeholder)
  let n = 0;
  for (const t of teams) {
    if (teamChannel.get(t[COL.teamId]) === rk && bucketStage(t[COL.stage]) === ck) n++;
  }
  return n;
}));

const channelXLevel = (() => {
  const ct = crosstab(
    teams,
    (t) => teamChannel.get(t[COL.teamId]),
    (t) => bucketStudentLevel(t[COL.studentLevel]),
    null,
    STUDENT_LEVEL_ORDER
  );
  ct.rows.sort((a, b) => (channelCounter[b] || 0) - (channelCounter[a] || 0));
  ct.cells = ct.rows.map((rk) => ct.cols.map((ck) => {
    let n = 0;
    for (const t of teams) {
      if (teamChannel.get(t[COL.teamId]) === rk && bucketStudentLevel(t[COL.studentLevel]) === ck) n++;
    }
    return n;
  }));
  return ct;
})();

// Channel x top institutions (limit to top 12 institutions by team count).
const instCount = {};
for (const t of teams) {
  const k = (t[COL.institution] || "Unspecified").trim();
  instCount[k] = (instCount[k] || 0) + 1;
}
const topInst = Object.entries(instCount).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k]) => k);
const channelXInst = (() => {
  const channels = Object.keys(channelCounter).sort((a, b) => channelCounter[b] - channelCounter[a]);
  const cells = channels.map((ch) => topInst.map((inst) => {
    let n = 0;
    for (const t of teams) {
      if (teamChannel.get(t[COL.teamId]) === ch && (t[COL.institution] || "").trim() === inst) n++;
    }
    return n;
  }));
  return { rows: channels, cols: topInst, cells };
})();

// ---------- Anonymized text dumps (for offline theme clustering) ----------

const textDump = {
  hopeToLearn: [],
  whyJoined: [],
  aiHelpHow: [],
  anythingElse: [],
};
for (const t of teams) {
  const tid = t[COL.teamId];
  const level = bucketStudentLevel(t[COL.studentLevel]);
  const stage = bucketStage(t[COL.stage]);
  textDump.hopeToLearn.push({ teamId: tid, level, stage, text: anonymizeQuote(t[COL.hopeToLearn]) });
  textDump.whyJoined.push({ teamId: tid, level, stage, text: anonymizeQuote(t[COL.whyJoined]) });
  textDump.aiHelpHow.push({ teamId: tid, level, stage, text: anonymizeQuote(t[COL.aiHelpHow]) });
  textDump.anythingElse.push({ teamId: tid, level, stage, text: anonymizeQuote(t[COL.anythingElse]) });
}

const dumpPath = path.join(__dirname, "_private_text_dump.json");
fs.writeFileSync(dumpPath, JSON.stringify(textDump, null, 2));
console.error(`Wrote text dump: ${dumpPath}`);

// ---------- Themes (loaded from themes_input.json if present) ----------

const themesInputPath = path.join(__dirname, "private_themes_input.json");
let themes = null;
if (fs.existsSync(themesInputPath)) {
  themes = JSON.parse(fs.readFileSync(themesInputPath, "utf8"));
  console.error(`Loaded themes from ${themesInputPath}`);
  for (const [q, def] of Object.entries(themes)) {
    if (!def.themes) continue;
    const total = def.themes.reduce((s, th) => s + (th.count || 0), 0);
    console.error(`  ${q}: ${def.themes.length} themes, ${total} total assignments (of ${teams.length})`);
  }

  // F2 / F3 crosstabs: hopeToLearn × student level, hopeToLearn × stage.
  // Built from the agent-provided assignments map so the matrix sums match the
  // theme counts above.
  if (themes.hopeToLearn?.assignments) {
    const teamMeta = new Map();
    for (const t of teams) {
      teamMeta.set(t[COL.teamId], {
        level: bucketStudentLevel(t[COL.studentLevel]),
        stage: bucketStage(t[COL.stage]),
      });
    }
    const themeOrder = themes.hopeToLearn.themes.map((th) => th.id);
    const buildMatrix = (colsOrder, metaKey) => {
      const matrix = themeOrder.map(() => colsOrder.map(() => 0));
      for (const [tid, themeId] of Object.entries(themes.hopeToLearn.assignments)) {
        const meta = teamMeta.get(tid);
        if (!meta) continue;
        const ri = themeOrder.indexOf(themeId);
        const ci = colsOrder.indexOf(meta[metaKey]);
        if (ri < 0 || ci < 0) continue;
        matrix[ri][ci]++;
      }
      return {
        rows: themeOrder.map((id) => {
          const th = themes.hopeToLearn.themes.find((x) => x.id === id);
          return { id, name: th?.name || id };
        }),
        cols: colsOrder,
        cells: matrix,
      };
    };
    themes.hopeToLearnByLevel = buildMatrix(STUDENT_LEVEL_ORDER, "level");
    themes.hopeToLearnByStage = buildMatrix(STAGE_ORDER, "stage");
    // Drop the assignments map to keep the shipped JSON small.
    delete themes.hopeToLearn.assignments;
  }
} else {
  console.error(`No themes_input.json found at ${themesInputPath} — emitting placeholder.`);
}

// ---------- Assemble dashboard JSON ----------

const dashboard = {
  generatedAt: new Date().toISOString(),
  totals: {
    raw: rawRows.length,
    deduped: teams.length,
    dedupRemoved,
    dedupRule: "Keep latest Timestamp per Team ID",
  },
  sectionA_pipeline: {
    rawRows: rawRows.length,
    uniqueTeams: teams.length,
    duplicatesRemoved: dedupRemoved,
    rule: "Latest submission per Team ID is retained.",
  },
  sectionB_diversity: {
    collegeMix: counterToList(collegeCounter),
    stateCoverage: {
      statesRepresented: Object.keys(stateCounter).length,
      statesZero: zeroStates,
      thinStates,
      perState: counterToList(stateCounter),
    },
    facultyContactRole: counterToListPreserveOrder(contactRoleCounter, CONTACT_ROLE_ORDER),
    diagnostics: {
      institutionsUnmatchedToIPEDS: [...new Set(unmatchedInstitutions)].sort(),
    },
  },
  sectionC_who: {
    teamSize: counterToListPreserveOrder(teamSizeCounter, TEAM_SIZE_ORDER),
    studentLevel: counterToListPreserveOrder(studentLevelCounter, STUDENT_LEVEL_ORDER),
    gradYear: counterToListPreserveOrder(gradYearCounter, gradYearOrder),
    majorMix: counterToList(majorCounter),
    nonStudentContributors: {
      teamsWith: teamsWithExternal,
      teamsWithout: teams.length - teamsWithExternal,
    },
  },
  sectionD_venture: {
    stage: counterToListPreserveOrder(stageCounter, STAGE_ORDER),
    priorVentureByStage: priorXStage,
    selfIdEntrepreneur: counterToList(selfIdCounter),
    stageByTeamSize: stageXTeamSize,
  },
  sectionE_ai: {
    selfRated: counterToListPreserveOrder(aiExpCounter, AI_EXP_ORDER),
    toolsUsed: counterToList(aiToolCounter),
    experienceByStage: aiExpXStage,
    experienceByStudentLevel: aiExpXLevel,
  },
  sectionF_qualitative: themes || {
    hopeToLearn: { placeholder: true },
    hopeToLearnByLevel: { placeholder: true },
    hopeToLearnByStage: { placeholder: true },
    whyJoined: { placeholder: true },
    aiHelpHow: { placeholder: true },
    anythingElse: { placeholder: true },
  },
  sectionG_marketing: {
    channelRollup: counterToList(channelCounter),
    channelByInstitution: channelXInst,
    channelByStage: channelXStage,
    channelByStudentLevel: channelXLevel,
    tamuVsNonTAMU: {
      TAMU: counterToList(tamuXChannel.TAMU),
      NonTAMU: counterToList(tamuXChannel.NonTAMU),
    },
  },
};

const outPath = path.join(ROOT, "src/data/private_dashboard.json");
fs.writeFileSync(outPath, JSON.stringify(dashboard, null, 2));
console.error(`Wrote dashboard JSON: ${outPath}`);
console.error("Done.");
