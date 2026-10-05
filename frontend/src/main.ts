/**
 * FIXBOT.AI — Página inicial
 * Comportamentos de interface da landing page (sem integração com a IA).
 *
 * Módulos:
 *  - initHeader:     sombra/borda do cabeçalho ao rolar
 *  - initMobileNav:  menu responsivo (abre/fecha, ESC, clique em link)
 *  - initScrollSpy:  destaca o link da seção visível
 *  - initReveal:     animação de entrada dos blocos
 *  - initCounters:   contagem animada dos indicadores
 *  - initTerminal:   simulação de uma sessão de diagnóstico
 */

const prefersReducedMotion: boolean = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function $<T extends Element>(selector: string, scope: ParentNode = document): T | null {
  return scope.querySelector<T>(selector);
}

function $$<T extends Element>(selector: string, scope: ParentNode = document): T[] {
  return Array.from(scope.querySelectorAll<T>(selector));
}

/* ---------------- Cabeçalho ---------------- */
function initHeader(): void {
  const header = $<HTMLElement>(".header");
  if (!header) return;
  const update = (): void => {
    header.classList.toggle("is-scrolled", window.scrollY > 8);
  };
  update();
  window.addEventListener("scroll", update, { passive: true });
}

/* ---------------- Menu mobile ---------------- */
function initMobileNav(): void {
  const toggle = $<HTMLButtonElement>(".nav-toggle");
  const nav = $<HTMLElement>("#menu");
  if (!toggle || !nav) return;

  const setOpen = (open: boolean): void => {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    nav.classList.toggle("is-open", open);
  };

  toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));

  $$<HTMLAnchorElement>("a", nav).forEach((link) => link.addEventListener("click", () => setOpen(false)));

  document.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Escape" && nav.classList.contains("is-open")) {
      setOpen(false);
      toggle.focus();
    }
  });

  // Fecha o menu ao voltar para a largura de desktop
  window.matchMedia("(min-width: 901px)").addEventListener("change", (e) => {
    if (e.matches) setOpen(false);
  });
}

/* ---------------- Scroll spy ---------------- */
function initScrollSpy(): void {
  const links = $$<HTMLAnchorElement>(".nav__link");
  const sections = links
    .map((link) => document.querySelector<HTMLElement>(link.hash))
    .filter((el): el is HTMLElement => el !== null);

  if (!("IntersectionObserver" in window) || sections.length === 0) return;

  const hero = document.querySelector<HTMLElement>(".hero");

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        // No topo da página (hero), nenhum link fica ativo
        links.forEach((link) => {
          const active = link.hash === `#${entry.target.id}`;
          link.classList.toggle("is-active", active);
          if (active) link.setAttribute("aria-current", "true");
          else link.removeAttribute("aria-current");
        });
      });
    },
    { rootMargin: "-45% 0px -50% 0px" }
  );
  sections.forEach((section) => observer.observe(section));
  if (hero) observer.observe(hero);
}

/* ---------------- Revelação ao rolar ---------------- */
function initReveal(): void {
  const items = $$<HTMLElement>(".reveal");
  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
  items.forEach((el) => observer.observe(el));
}

/* ---------------- Contadores ---------------- */
function animateCount(el: HTMLElement, target: number, duration = 1200): void {
  const start = performance.now();
  const step = (now: number): void => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = String(Math.round(target * eased));
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function initCounters(): void {
  const counters = $$<HTMLElement>("[data-count]");
  if (prefersReducedMotion || !("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target as HTMLElement;
        animateCount(el, Number(el.dataset.count ?? "0"));
        obs.unobserve(el);
      });
    },
    { threshold: 0.6 }
  );
  counters.forEach((el) => {
    el.textContent = "0";
    observer.observe(el);
  });
}

/* ---------------- Terminal de demonstração ---------------- */
type LineStyle = "dim" | "acc" | "warn" | "plain";
interface TerminalLine {
  text: string;
  style: LineStyle;
  delay: number; // pausa (ms) antes da linha
}

const DEMO_SCRIPT: TerminalLine[] = [
  { text: "$ fixbot diagnostico --os 0142", style: "plain", delay: 200 },
  { text: "> equipamento: Moto G52 · sintoma: \"aparelho não carrega\"", style: "dim", delay: 400 },
  { text: "> consultando base de conhecimento... 3 procedimentos · 2 casos semelhantes", style: "dim", delay: 600 },
  { text: "[causas_provaveis]", style: "acc", delay: 500 },
  { text: "  1. Conector de carga oxidado ........ alta", style: "plain", delay: 250 },
  { text: "  2. Cabo/carregador defeituoso ....... média", style: "plain", delay: 200 },
  { text: "  3. CI de carga (PMIC) ................ baixa", style: "plain", delay: 200 },
  { text: "[proxima_etapa] Medir VBUS no conector com o carregador ligado", style: "acc", delay: 500 },
  { text: "  valor esperado: ≈ 5 V", style: "plain", delay: 200 },
  { text: "  ⚠ alerta: não force o conector; desligue antes de limpar", style: "warn", delay: 300 },
  { text: "> técnico informou: 5,02 V · consumo 0,00 A", style: "dim", delay: 900 },
  { text: "> reinterpretando... tensão chega, mas não há consumo", style: "dim", delay: 500 },
  { text: "[sugestao] Oxidação nos pinos de dados/CC do conector — confirmar?", style: "acc", delay: 500 },
  { text: "  fontes: procedimento #12 · OS #0098", style: "dim", delay: 250 },
];

function initTerminal(): void {
  const code = $<HTMLElement>("#terminal code");
  const replay = $<HTMLButtonElement>(".terminal__replay");
  if (!code) return;

  let runId = 0;
  const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

  const renderLine = (line: TerminalLine): HTMLSpanElement => {
    const span = document.createElement("span");
    if (line.style !== "plain") span.className = `t-${line.style}`;
    code.appendChild(span);
    code.appendChild(document.createTextNode("\n"));
    return span;
  };

  const run = async (): Promise<void> => {
    const id = ++runId;
    code.textContent = "";

    if (prefersReducedMotion) {
      DEMO_SCRIPT.forEach((line) => (renderLine(line).textContent = line.text));
      return;
    }

    const cursor = document.createElement("span");
    cursor.className = "cursor";

    for (const line of DEMO_SCRIPT) {
      await wait(line.delay);
      if (id !== runId) return; // uma nova execução foi iniciada
      const span = renderLine(line);
      span.after(cursor);
      for (let i = 1; i <= line.text.length; i += 2) {
        if (id !== runId) return;
        span.textContent = line.text.slice(0, i);
        await wait(12);
      }
      span.textContent = line.text;
    }
  };

  // Inicia quando o terminal fica visível
  const terminal = $<HTMLElement>(".terminal");
  if (terminal && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries, obs) => {
        if (entries.some((e) => e.isIntersecting)) {
          void run();
          obs.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(terminal);
  } else {
    void run();
  }

  replay?.addEventListener("click", () => void run());
}

/* ---------------- Rodapé ---------------- */
function initYear(): void {
  const year = $<HTMLElement>("#ano");
  if (year) year.textContent = String(new Date().getFullYear());
}

/* ---------------- Inicialização ---------------- */
document.addEventListener("DOMContentLoaded", () => {
  initHeader();
  initMobileNav();
  initScrollSpy();
  initReveal();
  initCounters();
  initTerminal();
  initYear();
});
