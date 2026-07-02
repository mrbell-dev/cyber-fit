import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Self-hosted fonts so offline is pixel-identical (precached by the woff2 glob).
import "@fontsource/chakra-petch/400.css";
import "@fontsource/chakra-petch/700.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "./ui/theme/tokens.css";
import { App } from "./ui/App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
