import React from "react";
import { createRoot } from "react-dom/client";
import gsap from "gsap";
import App from "./App";
import "./styles.css";

// Returning to a background tab must finish timed entrances, not replay stalled frames.
gsap.ticker.lagSmoothing(0);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
