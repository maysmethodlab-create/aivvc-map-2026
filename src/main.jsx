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
import PrivateDashboard from "./components/PrivateDashboard.jsx";

// Obscure slug for the AIVVC core-team dashboard. Render's SPA rewrite
// (render.yaml) serves index.html for any path, so this works on deep links.
const path = typeof window !== "undefined" ? window.location.pathname : "/";
const isPrivate = /^\/levi-hari-private\/?$/i.test(path);

createRoot(document.getElementById("root")).render(isPrivate ? <PrivateDashboard /> : <Map />);
