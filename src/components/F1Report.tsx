import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./F1Report.css";

interface Chapter {
  id: string;
  title: string;
}

export default function F1Report() {
  const frame = useRef<HTMLIFrameElement>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [visible, setVisible] = useState(false);
  const [indexPassed, setIndexPassed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const expanded = hovered || pinned;
  useEffect(() => () => observer.current?.disconnect(), []);

  useEffect(() => {
    const updateIndexPosition = () => {
      const element = frame.current;
      const index = element?.contentDocument?.querySelector<HTMLOListElement>(".toc");
      if (!element || !index) {
        setIndexPassed(false);
        return;
      }
      const indexBottom = window.scrollY + element.getBoundingClientRect().top + index.getBoundingClientRect().bottom;
      setIndexPassed(indexBottom <= window.scrollY + 88);
    };
    window.addEventListener("scroll", updateIndexPosition, { passive: true });
    window.addEventListener("resize", updateIndexPosition);
    updateIndexPosition();
    return () => {
      window.removeEventListener("scroll", updateIndexPosition);
      window.removeEventListener("resize", updateIndexPosition);
    };
  }, []);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const intersection = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    intersection.observe(element);
    return () => intersection.disconnect();
  }, []);

  const fitDocument = () => {
    const element = frame.current;
    const report = element?.contentDocument;
    if (!element || !report?.body) return;

    observer.current?.disconnect();
    const resize = () => {
      element.style.height = `${Math.ceil(Math.max(
        report.documentElement.scrollHeight,
        report.body.scrollHeight,
      ))}px`;
    };
    observer.current = new ResizeObserver(resize);
    observer.current.observe(report.documentElement);
    observer.current.observe(report.body);
    report.fonts?.ready.then(resize);
    report.querySelectorAll("img").forEach((image) => {
      if (!image.complete) {
        image.addEventListener("load", resize, { once: true });
        image.addEventListener("error", resize, { once: true });
      }
    });
    const index = report.querySelector(".toc");
    const items = [...(index?.querySelectorAll<HTMLAnchorElement>('a[href^="#"]') ?? [])]
      .map((link) => {
        const id = decodeURIComponent(link.hash.slice(1));
        const heading = report.getElementById(id);
        return heading ? { id, title: link.textContent?.trim() || heading.textContent?.trim() || "Chapter" } : null;
      })
      .filter((chapter): chapter is Chapter => chapter !== null);
    setChapters(items);
    requestAnimationFrame(() => {
      const indexBottom = window.scrollY + element.getBoundingClientRect().top + (index?.getBoundingClientRect().bottom ?? 0);
      setIndexPassed(indexBottom <= window.scrollY + 88);
    });
    resize();
  };

  const skipToChapter = (chapter: Chapter) => {
    const element = frame.current;
    const heading = element?.contentDocument?.getElementById(chapter.id);
    if (!element || !heading) return;
    const top = window.scrollY + element.getBoundingClientRect().top + heading.getBoundingClientRect().top - 88;
    window.scrollTo({
      top,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
    setPinned(false);
  };

  return (
    <>
      <section className="f1-report" aria-label="Formula 1 stewarding analysis report">
      <iframe
        ref={frame}
        className="f1-report__document"
        src="/reports/f1-stewarding-analysis.html"
        title="How Consistent Is Formula 1 Stewarding? Full report"
        loading="lazy"
        onLoad={fitDocument}
      />
      </section>
      {visible && chapters.length > 0 && createPortal(
        <>
          <nav
            className={`f1-chapter-nav${indexPassed ? " is-available" : ""}${expanded ? " is-expanded" : ""}`}
            aria-label="Report chapters"
            aria-hidden={!indexPassed}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onFocus={() => setHovered(true)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHovered(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setPinned(false);
                setHovered(false);
                (event.currentTarget.querySelector("button") as HTMLButtonElement | null)?.focus();
              }
            }}
          >
            <div className="f1-chapter-nav__panel">
              <button
                type="button"
                className="f1-chapter-nav__handle"
                aria-expanded={expanded && indexPassed}
                tabIndex={indexPassed ? 0 : -1}
                onClick={() => setPinned((open) => !open)}
              >
                <span>Index</span>
              </button>
              <ol className="f1-chapter-nav__chapters">
                {chapters.map((chapter, index) => (
                  <li key={chapter.id}>
                    <a
                      href={`#${encodeURIComponent(chapter.id)}`}
                      tabIndex={indexPassed ? 0 : -1}
                      onClick={(event) => {
                        event.preventDefault();
                        skipToChapter(chapter);
                      }}
                    >
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <span>{chapter.title}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </nav>
          <button
            type="button"
            className={`f1-back-top${indexPassed ? " is-available" : ""}`}
            aria-hidden={!indexPassed}
            tabIndex={indexPassed ? 0 : -1}
            onClick={() => {
              const element = frame.current;
              if (!element) return;
              const top = window.scrollY + element.getBoundingClientRect().top - 88;
              window.scrollTo({
                top,
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
              });
            }}
          >
            Back to top <span aria-hidden="true">↑</span>
          </button>
        </>,
        document.body,
      )}
    </>
  );
}
