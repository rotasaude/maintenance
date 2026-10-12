// Tabelas largas rolam para o lado dentro deste contêiner (spec §4.1). A dica
// "⇆ role para o lado" é CSS (::after) e só aparece com transbordo real.
import { useEffect, useRef, type ReactNode } from "react";

export function TableScroll({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const check = () => el.classList.toggle("is-overflowing", el.scrollWidth > el.clientWidth + 1);
    const ro = new ResizeObserver(check);
    ro.observe(el);
    check();
    return () => ro.disconnect();
  }, []);
  return <div ref={ref} className="table-scroll">{children}</div>;
}
