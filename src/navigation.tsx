import { createContext, useContext, type AnchorHTMLAttributes } from "react";

export const NavigationContext = createContext<(path: string) => void>(
  () => {},
);
export function Link({
  href = "/",
  onClick,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const navigate = useContext(NavigationContext);
  return (
    <a
      {...props}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (
          !event.defaultPrevented &&
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey &&
          !props.target &&
          href.startsWith("/") &&
          !href.startsWith("//")
        ) {
          event.preventDefault();
          navigate(href);
        }
      }}
    />
  );
}
export function itemPath(slug: string) {
  return "/" + encodeURIComponent(slug);
}
export function decodedPath(path: string) {
  try {
    return decodeURIComponent(path).replace(/\/$/, "") || "/";
  } catch {
    return "/invalid-address";
  }
}
