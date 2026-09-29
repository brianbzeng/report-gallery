import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Link } from "../navigation";
import { allProjectImages } from "../data/imageBank";

export function Header({
  path,
  onMenu,
  onHome,
}: {
  path: string;
  onMenu: () => void;
  onHome: () => void;
}) {
  const [scrollingDown, setScrollingDown] = useState(false);
  useEffect(() => {
    let previousY = window.scrollY;
    const update = () => {
      const currentY = Math.max(0, window.scrollY);
      const difference = currentY - previousY;
      if (currentY < 24) setScrollingDown(false);
      else if (difference > 3) setScrollingDown(true);
      previousY = currentY;
    };
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return (
    <header
      className={`site-header ${scrollingDown ? "site-header--scrolling-down" : ""}`}
    >
      <>
          <Link href="/" className="header-brand" onClick={(event) => {
            event.preventDefault();
            onHome();
          }}>
            Home
          </Link>
          <nav aria-label="Main navigation" className="header-nav">
            <Link
              className={path === "/featured" ? "active" : ""}
              href="/featured"
            >
              Featured
            </Link>
            <Link
              className={path === "/index" ? "active" : ""}
              href="/index"
            >
              Index
            </Link>
            <Link className={path === "/about" ? "active" : ""} href="/about">
              About
            </Link>
          </nav>
      </>
      <button className="contact-button" aria-label="Contact" onClick={onMenu}>
        Contact
      </button>
    </header>
  );
}

export function Menu({
  onClose,
}: {
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const animating = useRef(false);
  const [showCredits, setShowCredits] = useState(false);
  const close = () => {
    if (animating.current) return;
    animating.current = true;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    gsap
      .timeline({
        onComplete: () => {
          onClose();
        },
      })
      .to(".menu-curtain", {
        clipPath: "circle(150% at calc(100% - 38px) 38px)",
        duration: reduced ? 0 : 0.65,
        ease: "power3.inOut",
      });
  };
  useLayoutEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const context = gsap.context(() => {
      gsap.fromTo(
        ".menu-field",
        { clipPath: "circle(0% at calc(100% - 38px) 38px)" },
        {
          clipPath: "circle(150% at calc(100% - 38px) 38px)",
          duration: reduced ? 0 : 0.6,
          ease: "power3.inOut",
        },
      );
      gsap.fromTo(
        ".menu-link-inner",
        { yPercent: 115 },
        {
          yPercent: 0,
          duration: reduced ? 0 : 0.6,
          stagger: 0.05,
          delay: reduced ? 0 : 0.55,
          ease: "power3.out",
        },
      );
    }, element);
    return () => {
      context.revert();
      gsap.killTweensOf(".menu-curtain");
      element.close();
      document.body.style.overflow = overflow;
      previous?.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="menu-dialog"
      aria-label="Site menu"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div className="menu-field" aria-hidden="true" />
      <button
        className="menu-close"
        aria-label={showCredits ? "Back to contact information" : "Close contact information"}
        onClick={showCredits ? () => setShowCredits(false) : close}
      >
        <span aria-hidden="true">←</span>
      </button>
      {showCredits ? (
        <section className="credits-page" aria-labelledby="credits-title">
          <h1 id="credits-title">Image Credits</h1>
          <ol>
            {[...allProjectImages].sort((a, b) => a.filename.localeCompare(b.filename)).map((image) => (
              <li key={image.src}>
                <a href={image.src} target="_blank" rel="noreferrer">{image.filename}</a>
                <span>{image.creator || "Photographer unlisted"}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <>
          <nav className="menu-links" aria-label="Contact information">
            <h1 className="menu-contact-heading menu-link-inner">Contact Information</h1>
            <a className="menu-link menu-link--email" href="mailto:bzeng0000@gmail.com">
              <span className="menu-link-inner">bzeng0000@gmail.com</span>
            </a>
            <a className="menu-link menu-link--website" href="https://brianbzeng.com" target="_blank" rel="noreferrer">
              <span className="menu-link-inner">Website</span>
            </a>
            <a className="menu-link menu-link--github" href="https://github.com/brianbzeng/" target="_blank" rel="noreferrer">
              <span className="menu-link-inner">Github</span>
            </a>
            <a className="menu-link menu-link--linkedin" href="https://www.linkedin.com/in/brianbzeng/" target="_blank" rel="noreferrer">
              <span className="menu-link-inner">Linkedin</span>
            </a>
          </nav>
          <button className="menu-credits-link" onClick={() => setShowCredits(true)}>
            Credits
          </button>
        </>
      )}
      <div className="menu-curtain" />
    </dialog>
  );
}
