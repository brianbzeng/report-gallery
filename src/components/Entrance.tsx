import { useCallback, useLayoutEffect, useRef, type RefObject } from "react";
import gsap from "gsap";

export default function Entrance({
  world,
  onEntered,
  returning = false,
  onReturnComplete,
}: {
  world: RefObject<HTMLDivElement | null>;
  onEntered: () => void;
  returning?: boolean;
  onReturnComplete?: () => void;
}) {
  const overlay = useRef<HTMLDivElement>(null);
  const entering = useRef(false);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const ready = useRef(false);
  const pendingEntry = useRef(false);
  const reduced = useRef(
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const returnOnMount = useRef(returning).current;
  const enter = useCallback(() => {
    if (!world.current || entering.current) return;
    if (!ready.current) {
      pendingEntry.current = true;
      return;
    }
    pendingEntry.current = false;
    entering.current = true;
    timeline.current?.kill();
    timeline.current = gsap
      .timeline({
        onComplete: () => {
          // Keep the final visible frame until React removes is-greeting.
          // Clearing opacity here exposes its opacity: 0 rule before that commit.
          // The layout-effect cleanup below releases these styles before paint.
          window.scrollTo(0, 0);
          onEntered();
        },
      })
      .to(
        ".entrance-chrome",
        { opacity: 0, duration: reduced.current ? 0.01 : 0.35 },
        0,
      )
      .to(
        world.current,
        {
          scale: 1,
          y: 0,
          opacity: 1,
          duration: reduced.current ? 0.01 : 1.6,
          ease: "power4.inOut",
        },
        0,
      );
  }, [world, onEntered]);

  useLayoutEffect(() => {
    const page = world.current;
    if (!page) return;
    entering.current = false;
    ready.current = false;
    pendingEntry.current = false;
    const paper = page.querySelector<HTMLElement>(".greeting-paper");
    const mask = page.querySelector<HTMLElement>(".home-reveal-mask");
    const composition = page.querySelector<HTMLElement>(".home-composition");
    const chrome = overlay.current?.querySelectorAll(".entrance-chrome");
    const finishingDetails = page.querySelectorAll(
      ".site-header, .home-credit",
    );
    let poster: gsap.core.Timeline | undefined;
    let posterHeight = page.offsetHeight;
    let posterScale = 1;
    let posterY = 0;
    const revealProgress = { value: reduced.current ? 1 : 0 };
    const paintPoster = () => {
      const offset = posterHeight * (1 - revealProgress.value);
      gsap.set([paper, mask], { y: offset });
      gsap.set(composition, { y: -offset });
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.scrollTo(0, 0);
    let alive = true;
    const position = () => {
      if (entering.current) return;
      posterHeight = page.offsetHeight;
      if (!returnOnMount && !ready.current && !reduced.current) paintPoster();
      const ratio = window.innerWidth <= 960 ? 0.67 : 0.82;
      posterScale = Math.min(
        (window.innerHeight * ratio) / page.offsetHeight,
        window.innerWidth <= 600 ? 0.72 : 0.4,
      );
      posterY = (window.innerHeight - page.offsetHeight * posterScale) / 2;
      if (!returnOnMount)
        gsap.set(page, {
          transformOrigin: "50% 0%",
          scale: posterScale,
          y: posterY,
          opacity: 1,
          willChange: "transform",
        });
    };
    position();
    if (returnOnMount) {
      gsap.set([paper, mask, composition], { clearProps: "transform,willChange" });
      gsap.set(finishingDetails, { clearProps: "opacity" });
      gsap.set(page, {
        transformOrigin: "50% 0%",
        scale: 1,
        y: 0,
        opacity: 1,
        willChange: "transform",
      });
      if (chrome) gsap.set(chrome, { opacity: 0 });
    } else if (!reduced.current) {
      // Keep the lettering visible while the paper and image mask rise together.
      // Counter-moving the image grid reveals it without dragging its contents.
      gsap.set([paper, mask], { y: page.offsetHeight, willChange: "transform" });
      gsap.set(composition, { y: -page.offsetHeight, willChange: "transform" });
      gsap.set(finishingDetails, { opacity: 0 });
      if (chrome) gsap.set(chrome, { opacity: 0 });
    }
    const observer = new ResizeObserver(position);
    observer.observe(page);
    window.addEventListener("resize", position);
    const reveal = () => {
      if (!alive) return;
      position();
      const finish = () => {
        if (!alive) return;
        ready.current = true;
        if (returnOnMount) onReturnComplete?.();
        if (pendingEntry.current) enter();
      };
      if (reduced.current) {
        gsap.set([paper, mask, composition], { clearProps: "transform,willChange" });
        gsap.set(finishingDetails, { clearProps: "opacity" });
        if (chrome) gsap.set(chrome, { clearProps: "opacity" });
        if (returnOnMount) {
          gsap.set(page, {
            scale: posterScale,
            y: posterY,
            opacity: 1,
            transformOrigin: "50% 0%",
            willChange: "transform",
          });
          if (chrome) gsap.set(chrome, { opacity: 1 });
        }
        finish();
        return;
      }
      if (returnOnMount) {
        poster = gsap.timeline({ onComplete: finish });
        poster.to(page, {
          scale: posterScale,
          y: posterY,
          duration: 1.6,
          ease: "power4.inOut",
        });
        if (chrome)
          poster.to(chrome, { opacity: 1, duration: 0.5 }, 1.05);
        return;
      }
      poster = gsap.timeline({ onComplete: finish });
      poster.to(
        revealProgress,
        {
          value: 1,
          duration: 1.2,
          ease: "power3.inOut",
          onUpdate: paintPoster,
          onComplete: () => gsap.set([paper, mask, composition], { clearProps: "transform,willChange" }),
        },
        0,
      );
      poster.to(finishingDetails, { opacity: 1, duration: 0.5, ease: "power4.out", clearProps: "opacity" }, 1.2);
      if (chrome) poster.to(chrome, { opacity: 1, duration: 0.7 }, 0.35);
    };
    void document.fonts.ready.then(reveal);
    let touchY = 0;
    let accumulated = 0;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      event.preventDefault();
      accumulated += Math.abs(event.deltaY);
      if (accumulated > 18) enter();
    };
    const touchStart = (event: TouchEvent) => {
      touchY = event.touches[0].clientY;
    };
    const touchMove = (event: TouchEvent) => {
      const delta = touchY - event.touches[0].clientY;
      if (Math.abs(delta) > 12) {
        event.preventDefault();
        enter();
      }
    };
    const key = (event: KeyboardEvent) => {
      if (["ArrowDown", "PageDown", " ", "Enter"].includes(event.key)) {
        event.preventDefault();
        enter();
      }
    };
    window.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("touchstart", touchStart, { passive: true });
    window.addEventListener("touchmove", touchMove, { passive: false });
    window.addEventListener("keydown", key);
    return () => {
      alive = false;
      pendingEntry.current = false;
      timeline.current?.kill();
      poster?.kill();
      if (chrome) {
        gsap.killTweensOf(chrome);
        gsap.set(chrome, { clearProps: "opacity" });
      }
      gsap.set(page, { clearProps: "transform,transformOrigin,opacity,willChange" });
      gsap.set([paper, mask, composition], { clearProps: "transform,willChange" });
      gsap.set(finishingDetails, { clearProps: "opacity" });
      observer.disconnect();
      window.removeEventListener("resize", position);
      window.removeEventListener("wheel", wheel);
      window.removeEventListener("touchstart", touchStart);
      window.removeEventListener("touchmove", touchMove);
      window.removeEventListener("keydown", key);
      document.body.style.overflow = previousOverflow;
    };
  }, [world, enter]);

  return (
    <div ref={overlay} className="entrance" aria-label="Research Work greeting">
      <button
        className="entrance-chrome entrance-prompt"
        onClick={enter}
        disabled={returnOnMount && !ready.current}
        aria-label="Enter website — or scroll up or down"
      >
        <span>Scroll to enter</span>
      </button>
    </div>
  );
}
