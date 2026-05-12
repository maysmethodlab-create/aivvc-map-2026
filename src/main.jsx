import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/oswald/400.css";
import "@fontsource/oswald/500.css";
import "@fontsource/oswald/600.css";
import "@fontsource/oswald/700.css";
import "@fontsource/work-sans/400.css";
import "@fontsource/work-sans/500.css";
import "@fontsource/work-sans/600.css";
import "@fontsource/work-sans/700.css";
import "@fontsource/work-sans/400-italic.css";
import Map from "./components/Map.jsx";

// PRIVACY: the internal /levi-hari-private dashboard is intentionally NOT
// imported here. Even though that route was password-gated, Render serves
// the underlying JavaScript chunk as a public static asset, which meant
// anyone could fetch the verbatim student responses by reading the chunk
// path out of the public bundle. To eliminate that risk entirely, the
// private dashboard is excluded from the production build. The source
// files (src/components/PrivateDashboard.jsx and src/data/private_dashboard.json)
// remain in the repo for internal viewing via `npm run dev` on a trusted
// machine; they simply do not ship to Render or to any handoff zip.
//
// The /levi-hari-private URL on the live site will now render the public
// Map (Render's SPA rewrite serves index.html for any path), which is the
// safest possible fallback.

createRoot(document.getElementById("root")).render(<Map />);
