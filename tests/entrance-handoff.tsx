import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import gsap from "gsap";
import App from "../src/App";
import "../src/styles.css";

const button = document.querySelector<HTMLButtonElement>("#start")!;
const result = document.querySelector<HTMLElement>("#result")!;
if (!import.meta.env.DEV) throw new Error("Use the Vite dev server for this harness.");
history.replaceState(null, "", "/"); // App must see the home route before mounting.
gsap.ticker.lagSmoothing(0); // Match src/main.tsx.
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
document.getElementById("diagnostics")!.addEventListener("keydown", e => e.stopPropagation());

let frame = 0, frames = 0, zeros = 0, blanks = 0, mutations = 0, tail = 0;
let running = false, completed = false, previousZero = false;
let minWidth = Infinity, maxWidth = 0;
let world: HTMLElement;
let observer: MutationObserver;
let timeout: ReturnType<typeof setTimeout>;
const startedAt = performance.now();
const greeting = () => !!document.querySelector(".is-greeting");
const complete = () => !greeting() && !document.querySelector(".entrance, .greeting-paper");
function show(status: string) {
  const style = world && getComputedStyle(world);
  const header = document.querySelector(".site-header")?.getBoundingClientRect();
  result.textContent = `${status}\nRAF frames: ${frames}; opacity-zero: ${zeros}; blank: ${blanks}\nMutation opacity-zero transitions: ${mutations} (not proof of a painted blank)\nOpacity: ${style?.opacity ?? "?"}; visibility: ${style?.visibility ?? "?"}\nGreeting: ${greeting()}; papers: ${document.querySelectorAll(".greeting-paper").length}\nHeader rect: ${header ? [header.x, header.y, header.width, header.height].map(v => v.toFixed(1)).join(", ") : "missing"}\nComplete: ${completed}; extra frames: ${tail}/20\nLayout width: ${Number.isFinite(minWidth) ? `${minWidth}–${maxWidth}px; stable: ${maxWidth - minWidth <= 1}` : "pending"}`;
}
function finish(reason?: string) {
  running = false;
  cancelAnimationFrame(frame);
  clearTimeout(timeout);
  observer?.disconnect();
  const menu = document.querySelector<HTMLButtonElement>(".contact-button");
  const rect = menu?.getBoundingClientRect();
  const nonInert = !!menu && !menu.closest("[inert]");
  const usable = !!menu && nonInert && !menu.disabled && !!rect && rect.width > 0 && rect.height > 0 && menu.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
  const pass = !reason && completed && tail === 20 && frames > 0 && !zeros && !blanks && !mutations && maxWidth - minWidth <= 1 && usable;
  show(`${pass ? "PASS" : "FAIL"}${reason ? `: ${reason}` : ""}`);
  result.textContent += `\nMenu non-inert: ${nonInert}; usable (DOM hit-test): ${usable}\nReopen /tests/entrance-handoff.html to rerun.`;
  result.dataset.result = pass ? "PASS" : "FAIL";
}
function sample() {
  if (!running) return;
  const style = getComputedStyle(world), rect = world.getBoundingClientRect();
  const zero = Number(style.opacity) <= 0.001;
  frames++;
  if (zero) zeros++;
  if (zero || style.visibility !== "visible" || style.display === "none" || !rect.width || !rect.height) blanks++;
  const width = world.offsetWidth; // Ignore the intentional entrance scale animation.
  minWidth = Math.min(minWidth, width); maxWidth = Math.max(maxWidth, width);
  if (completed) tail++; else completed = complete();
  if (tail >= 20) { finish(); return; }
  show("RUNNING");
  frame = requestAnimationFrame(sample);
}
button.onclick = () => {
  button.disabled = true;
  if (!greeting()) { finish("Entry already happened; reopen the harness."); return; }
  frames = zeros = blanks = mutations = tail = 0;
  minWidth = maxWidth = world.offsetWidth;
  completed = previousZero = false; running = true;
  // Background tabs can deliver RAF at ~1 Hz even after the entry has completed.
  timeout = setTimeout(() => finish(completed
    ? "Post-entry frames were throttled; rerun in a foreground tab."
    : "Entry did not finish within 45 seconds."), 45000);
  frame = requestAnimationFrame(sample);
  window.dispatchEvent(new WheelEvent("wheel", { deltaY: 120, bubbles: true, cancelable: true }));
};
function prepare() {
  world = document.querySelector<HTMLElement>(".world")!;
  const header = document.querySelector<HTMLElement>(".site-header");
  const mask = document.querySelector<HTMLElement>(".home-reveal-mask");
  if (world && header && mask && document.fonts.status === "loaded" && performance.now() - startedAt > 2500 && Number(getComputedStyle(header).opacity) >= 0.999 && getComputedStyle(mask).transform === "none") {
    clearTimeout(timeout);
    // Install after StrictMode setup and the initial reveal; observe only DOM styles.
    observer = new MutationObserver(() => {
      if (!running) return;
      const zero = Number(getComputedStyle(world).opacity) <= 0.001;
      if (zero && !previousZero) { mutations++; show("RUNNING — mutation observed opacity zero"); }
      previousZero = zero;
    });
    observer.observe(world, { attributes: true, attributeFilter: ["style"] });
    button.disabled = false;
    show("READY — click Start; initial reveal is excluded.");
    return;
  }
  frame = requestAnimationFrame(prepare);
}
timeout = setTimeout(() => finish("Initial reveal did not settle within 15 seconds."), 15000);
frame = requestAnimationFrame(prepare);
