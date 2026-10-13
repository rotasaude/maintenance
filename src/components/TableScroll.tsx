// Tabelas largas rolam para o lado dentro deste contêiner (spec §4.1). A dica
// "⇆ role para o lado" é CSS (::before e ::after) e só aparece com transbordo
// real. Com transbordo, o contêiner vira região focável: quem usa teclado rola
// com as setas mesmo numa tabela sem nada clicável (A-21). Observa também a
// tabela, porque ela pode alargar sem o contêiner mudar (A-26).
import { useEffect, useRef, useState, type ReactNode } from "react";

export function TableScroll({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ overflowing, setOverflowing ] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const check = () => setOverflowing(el.scrollWidth > el.clientWidth + 1);
    const ro = new ResizeObserver(check);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    check();
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className={overflowing ? "table-scroll is-overflowing" : "table-scroll"}
      {...(overflowing ? { tabIndex: 0, role: "region", "aria-label": "tabela com rolagem lateral" } : {})}>
      {children}
    </div>
  );
}
