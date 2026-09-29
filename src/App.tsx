import { useCallback, useEffect, useRef, useState } from "react";
import { NavigationContext, decodedPath } from "./navigation";
import Entrance from "./components/Entrance";
import { Header, Menu } from "./components/Shell";
import { HomePage, FeaturedPage, CataloguePage, StudioPage } from "./components/Pages";

const scrollPositions = new Map<string, number>();

export default function App() {
  const [rawPath, setRawPath] = useState(() => window.location.pathname);
  const path = decodedPath(rawPath);
  const [greeting, setGreeting] = useState(path === "/");
  const [returning, setReturning] = useState(false);
  const [menu, setMenu] = useState(false);
  const world = useRef<HTMLDivElement>(null);
  const currentPath = useRef(rawPath);
  const returnScroll = useRef<number | undefined>(undefined);

  const onEntered = useCallback(() => {
    setGreeting(false);
    requestAnimationFrame(() => document.getElementById("main")?.focus({ preventScroll: true }));
  }, []);
  const onReturnComplete = useCallback(() => setReturning(false), []);

  const navigate = useCallback((next: string) => {
    const destination = decodedPath(next);
    if (destination === currentPath.current) return;
    scrollPositions.set(currentPath.current, window.scrollY);
    returnScroll.current = scrollPositions.get(destination) ?? 0;
    window.history.pushState({}, "", destination);
    currentPath.current = destination;
    setRawPath(destination);
    setGreeting(false);
  }, []);

  const returnToGreeting = useCallback(() => {
    setMenu(false);
    returnScroll.current = 0;
    if (currentPath.current !== "/") navigate("/");
    setReturning(true);
    setGreeting(true);
  }, [navigate]);

  useEffect(() => {
    const previousRestoration = history.scrollRestoration;
    history.scrollRestoration = "manual";
    const back = () => {
      scrollPositions.set(currentPath.current, window.scrollY);
      currentPath.current = decodedPath(window.location.pathname);
      returnScroll.current = scrollPositions.get(currentPath.current) || 0;
      setRawPath(currentPath.current);
      setGreeting(false);
      setMenu(false);
    };
    window.addEventListener("popstate", back);
    return () => {
      window.removeEventListener("popstate", back);
      history.scrollRestoration = previousRestoration;
    };
  }, []);

  useEffect(() => {
    document.title = `${path === "/" ? "Research Work" : path === "/about" ? "About" : path === "/index" ? "Index" : path === "/featured" ? "Featured Report" : "Page not found"} — Brian Zeng`;
    const frame = requestAnimationFrame(() => {
      window.scrollTo(0, returnScroll.current || 0);
      if (!greeting) document.getElementById("main")?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [path, greeting]);

  let content;
  if (path === "/") content = <HomePage />;
  else if (path === "/about") content = <StudioPage />;
  else if (path === "/index") content = <CataloguePage />;
  else if (path === "/featured") content = <FeaturedPage />;
  else content = <main id="main" className="status-page" tabIndex={-1}><h1>Page not found.</h1></main>;

  return (
    <NavigationContext.Provider value={navigate}>
      <div className={`experience ${greeting ? "is-greeting" : ""}`}>
        <div ref={world} className="world" inert={greeting} aria-hidden={greeting || undefined}>
          {greeting && <div className="greeting-paper" aria-hidden="true" />}
          <a className="skip-link" href="#main">Skip to content</a>
          <Header path={path} onMenu={() => setMenu(true)} onHome={returnToGreeting} />
          {content}
        </div>
        {greeting && <Entrance world={world} onEntered={onEntered} returning={returning} onReturnComplete={onReturnComplete} />}
      </div>
      {menu && <Menu onClose={() => setMenu(false)} />}
    </NavigationContext.Provider>
  );
}
