/**
 * Motion layer. Everything here is optional: with JS off, or with
 * prefers-reduced-motion set, the page renders in its final state and this
 * module never loads GSAP or Lenis at all.
 *
 * Direction: animations that enter "from the start" enter from the right in
 * Arabic and from the left in English, driven by the document's dir.
 */
type Lenis = import('lenis').default;

let lenis: Lenis | null = null;
let started = false;
let motionRun = 0;

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** +1 for LTR, -1 for RTL — multiply any x offset by this. */
const flow = () => (document.documentElement.dir === 'rtl' ? -1 : 1);

export async function initMotion(): Promise<void> {
  if (prefersReducedMotion()) {
    document.documentElement.classList.add('reduced-motion');
    revealEverything();
    initSlideNav();
    initEstimator();
    initServiceTabs();
    goToHashTarget();
    return;
  }

  let gsap: typeof import('gsap').gsap;
  let ScrollTrigger: typeof import('gsap/ScrollTrigger').ScrollTrigger;
  try {
    const modules = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
    gsap = modules[0].gsap;
    ScrollTrigger = modules[1].ScrollTrigger;
  } catch {
    // Offline, blocked, or a failed chunk: show the finished page.
    revealEverything();
    initSlideNav();
    initEstimator();
    initServiceTabs();
    goToHashTarget();
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

  if (!started) {
    started = true;
    await initSmoothScroll(ScrollTrigger);
  }

  ScrollTrigger.getAll().forEach((tr) => tr.kill());
  const run = ++motionRun;

  // The hero is in view, so it starts at once, and the page's controls are
  // wired straight after it. Everything else is scroll-driven and below the
  // fold: each step gets its own task, so the page never stops responding
  // for the length of the whole setup.
  heroFormation(gsap);
  initSlideNav();
  initEstimator();
  initServiceTabs();

  const steps = [
    () => revealOnScroll(gsap, ScrollTrigger),
    () => structureGrid(gsap, ScrollTrigger),
    () => costMerge(gsap, ScrollTrigger),
    () => formationPath(gsap, ScrollTrigger),
  ];
  for (const step of steps) {
    await yieldToMain();
    // A client-side navigation started a newer run; leave the page to it.
    if (run !== motionRun) return;
    step();
  }
  ScrollTrigger.refresh();
  goToHashTarget();
}

/** Ends the current task so input and rendering can run before the next step. */
function yieldToMain(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (scheduler?.yield) return scheduler.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/* ------------------------------------------------------------------ */
/* Smooth scroll                                                       */
/* ------------------------------------------------------------------ */
async function initSmoothScroll(ScrollTrigger: typeof import('gsap/ScrollTrigger').ScrollTrigger) {
  // Only on pointer-driven devices. On touch, smooth scroll costs about a
  // second of main-thread time and overrides scrolling the platform already
  // does better.
  const pointerDriven = window.matchMedia('(pointer: fine)').matches;

  if (pointerDriven) {
    const { default: LenisCtor } = await import('lenis');
    lenis = new LenisCtor({ duration: 1.05, smoothWheel: true, syncTouch: false });
    lenis.on('scroll', ScrollTrigger.update);
    const raf = (time: number) => {
      lenis?.raf(time);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }

  // Keep in-page anchors working through Lenis, including the slide dots.
  document.addEventListener('click', (event) => {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
    if (!link) return;
    const id = link.getAttribute('href')!.slice(1);
    const target = id && document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    if (lenis) {
      lenis.scrollTo(target, { offset: -72 });
    } else {
      const top = target.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top, behavior: 'smooth' });
    }
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });
}

/* ------------------------------------------------------------------ */
/* Hero: the mark forms — تشكيل — out of its seven parts               */
/* ------------------------------------------------------------------ */
/**
 * Brand rules allow none of: redraw, rotate, stretch, gradient, shadow, glow.
 * So this only translates and fades the official polygons, and every tween
 * ends at identity, i.e. on the exact official artwork.
 *
 * Directions are physical, not flow-relative: the logo is never mirrored in
 * Arabic, so its left wing is on the left in both languages.
 */
function heroFormation(gsap: typeof import('gsap').gsap) {
  const hero = document.querySelector<HTMLElement>('[data-hero]');
  if (!hero) return;

  // Astro fires astro:page-load on first paint as well as after navigation,
  // so guard: a second timeline over the same targets would leave them stuck
  // at the first one's start values.
  if (hero.hasAttribute('data-hero-played')) return;
  hero.setAttribute('data-hero-played', '');

  const bars = hero.querySelectorAll<SVGPolygonElement>('[data-mark-part="bar"]');
  const dots = hero.querySelectorAll<SVGPolygonElement>('[data-mark-part="dot"]');
  const words = hero.querySelectorAll('[data-hero-line]');
  const rest = hero.querySelectorAll('[data-hero-fade]');

  // Where each bar comes from, in the mark's own user units (viewBox 161x169):
  // the T's crossbar drops in, the stem rises, the two shield wings close in.
  const from = [
    { x: 0, y: -46 }, // crossbar
    { x: -46, y: 0 }, // left wing
    { x: 0, y: 46 }, //  central stem
    { x: 46, y: 0 }, //  right wing
  ];

  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });

  bars.forEach((bar, i) => {
    tl.from(bar, { ...from[i], opacity: 0, duration: 1.05 }, 0.08 * i);
  });

  // The three ش dots arrive once the shield has closed, bottom-left to top-right.
  tl.from(
    dots,
    { y: -10, opacity: 0, duration: 0.5, ease: 'power3.out', stagger: 0.11 },
    0.78,
  );

  tl.from(
    words,
    { yPercent: 108, opacity: 0, duration: 0.85, stagger: 0.07, ease: 'power3.out' },
    0.62,
  ).from(rest, { y: 18, opacity: 0, duration: 0.7, stagger: 0.09 }, 1.0);
}

/* ------------------------------------------------------------------ */
/* Scroll reveals                                                      */
/* ------------------------------------------------------------------ */
function revealOnScroll(
  gsap: typeof import('gsap').gsap,
  ScrollTrigger: typeof import('gsap/ScrollTrigger').ScrollTrigger,
) {
  // One ScrollTrigger per element is the bulk of the setup cost on a page with
  // this many reveals; batch() shares a single observer across them.
  const pending = [...document.querySelectorAll<HTMLElement>('[data-animate]')].filter(
    (el) => !el.closest('[data-hero]') && el.dataset.revealBound === undefined,
  );
  pending.forEach((el) => {
    el.dataset.revealBound = '';
  });

  if (pending.length) {
    ScrollTrigger.batch(pending, {
      start: 'top 88%',
      once: true,
      onEnter: (batch) =>
        batch.forEach((el) => {
          const node = el as HTMLElement;
          const mode = node.dataset.animate || 'up';
          // fromTo, not from: the stylesheet already sets opacity 0 on these
          // (so the start state is right before this module loads), which
          // would make a `.from()` tween animate 0 -> 0.
          const from: gsap.TweenVars = { opacity: 0 };
          if (mode === 'up') from.y = 26;
          if (mode === 'start') from.x = 40 * flow();
          if (mode === 'scale') from.scale = 0.96;
          gsap.fromTo(node, from, {
            opacity: 1,
            y: 0,
            x: 0,
            scale: 1,
            duration: 0.7,
            ease: 'power3.out',
            delay: Number(node.dataset.animateDelay || 0),
          });
        }),
    });
  }

  // Staggered children (fact lists, pillar blocks, value lists).
  const groups = [...document.querySelectorAll<HTMLElement>('[data-stagger]')].filter(
    (group) => group.dataset.revealBound === undefined,
  );
  groups.forEach((group) => {
    group.dataset.revealBound = '';
  });

  if (groups.length) {
    ScrollTrigger.batch(groups, {
      start: 'top 85%',
      once: true,
      onEnter: (batch) =>
        batch.forEach((group) =>
          gsap.fromTo(
            group.querySelectorAll(':scope > *'),
            { opacity: 0, y: 22 },
            { opacity: 1, y: 0, duration: 0.62, ease: 'power3.out', stagger: 0.08 },
          ),
        ),
    });
  }

  // No refresh here: initMotion refreshes once, after every trigger exists.

  // Safety net: copy must never stay invisible because a trigger did not fire.
  window.setTimeout(() => {
    document.querySelectorAll<HTMLElement>('[data-animate]').forEach((el) => {
      const rect = el.getBoundingClientRect();
      const onScreen = rect.top < window.innerHeight && rect.bottom > 0;
      if ((onScreen || rect.bottom < 0) && Number(getComputedStyle(el).opacity) === 0) {
        gsap.set(el, { opacity: 1, y: 0, x: 0, scale: 1 });
      }
    });
  }, 3000);
}

/* ------------------------------------------------------------------ */
/* Background structure grid: pieces snap into place as you scroll     */
/* ------------------------------------------------------------------ */
function structureGrid(
  gsap: typeof import('gsap').gsap,
  _ScrollTrigger: typeof import('gsap/ScrollTrigger').ScrollTrigger,
) {
  const cheapDevice = !window.matchMedia('(min-width: 900px) and (pointer: fine)').matches;

  document.querySelectorAll<SVGSVGElement>('[data-structure]').forEach((svg) => {
    const group = svg.querySelector('[data-cells]');
    const cells = svg.querySelectorAll('[data-cell]');
    if (!cells.length || !group) return;
    const trigger = { trigger: svg.closest('section') || svg, start: 'top 78%', once: true };

    if (cheapDevice) {
      // One tween, one element: the motif still arrives, at no measurable cost.
      gsap.from(group, { opacity: 0, duration: 0.9, ease: 'power2.out', scrollTrigger: trigger });
      return;
    }

    // Opacity only — transforming each polygon invalidates SVG layout and was
    // the single biggest main-thread cost on the page.
    gsap.fromTo(
      cells,
      { opacity: 0 },
      {
        opacity: 1,
        duration: 0.7,
        ease: 'power2.out',
        // `amount` spreads the whole stagger over a fixed window, so a large
        // grid assembles in about a second rather than fifteen.
        stagger: { amount: 1.1, from: 'random' },
        scrollTrigger: trigger,
      },
    );
  });
}

/* ------------------------------------------------------------------ */
/* Cost blocks merging into one shared structure                       */
/* ------------------------------------------------------------------ */
function costMerge(
  gsap: typeof import('gsap').gsap,
  _ScrollTrigger: typeof import('gsap/ScrollTrigger').ScrollTrigger,
) {
  const figure = document.querySelector<HTMLElement>('[data-costmerge]');
  if (!figure) return;
  const blocks = figure.querySelectorAll<HTMLElement>('[data-cost-block]');
  const shared = figure.querySelector<HTMLElement>('[data-cost-shared]');
  const saved = figure.querySelector<HTMLElement>('[data-cost-saved]');

  const tl = gsap.timeline({
    scrollTrigger: { trigger: figure, start: 'top 68%', once: true },
    defaults: { ease: 'expo.out' },
  });

  tl.from(blocks, { x: 38 * flow(), opacity: 0, duration: 0.6, stagger: 0.09 })
    .to(blocks, { '--merge': 1, duration: 0.85, stagger: 0.05 }, '+=0.25')
    .from(shared, { scaleY: 0.2, opacity: 0, duration: 0.8, transformOrigin: 'bottom' }, '-=0.5')
    .from(saved, { opacity: 0, y: 14, duration: 0.6 }, '-=0.3');
}

/* ------------------------------------------------------------------ */
/* Onboarding path that draws as you scroll                            */
/* ------------------------------------------------------------------ */
function formationPath(
  gsap: typeof import('gsap').gsap,
  _ScrollTrigger: typeof import('gsap/ScrollTrigger').ScrollTrigger,
) {
  const wrap = document.querySelector<HTMLElement>('[data-path]');
  if (!wrap) return;
  const line = wrap.querySelector<SVGPathElement | SVGLineElement>('[data-path-line]');
  const nodes = wrap.querySelectorAll<HTMLElement>('[data-path-node]');

  if (line) {
    gsap.fromTo(
      line,
      { drawProgress: 0, scaleX: 0, scaleY: 0 },
      {
        scaleX: 1,
        scaleY: 1,
        duration: 1,
        ease: 'none',
        scrollTrigger: { trigger: wrap, start: 'top 72%', end: 'bottom 62%', scrub: 0.6 },
      },
    );
  }
  nodes.forEach((node, i) => {
    gsap.from(node, {
      opacity: 0,
      y: 20,
      scale: 0.94,
      duration: 0.6,
      ease: 'back.out(1.6)',
      scrollTrigger: { trigger: node, start: 'top 84%', once: true },
      delay: i * 0.02,
    });
  });
}

/* ------------------------------------------------------------------ */
/* Non-motion behaviour that must also run under reduced motion        */
/* ------------------------------------------------------------------ */
function revealEverything() {
  document.querySelectorAll<HTMLElement>('[data-animate]').forEach((el) => {
    el.style.opacity = '1';
    el.style.transform = 'none';
  });
}

/**
 * A deep link like /services/#vciso lands on a page whose target may be inside
 * a tab panel that was hidden at parse time, and Lenis resets the scroll it
 * takes over. So once the panels are set, take the visitor there ourselves.
 */
function goToHashTarget(): void {
  const id = location.hash.slice(1);
  if (!id) return;
  const target = document.getElementById(id);
  if (!target) return;

  // Two frames: one for the panel to be shown, one for layout to settle.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const top = target.getBoundingClientRect().top + window.scrollY - 88;
      if (lenis) lenis.scrollTo(top, { immediate: true });
      else window.scrollTo({ top, behavior: 'auto' });
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }),
  );
}

/** Slide dots: highlight the section in view, and stay keyboard operable. */
function initSlideNav() {
  const nav = document.querySelector<HTMLElement>('[data-slidenav]');
  if (!nav) return;
  const dots = Array.from(nav.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'));
  const sections = dots
    .map((dot) => document.getElementById(dot.getAttribute('href')!.slice(1)))
    .filter(Boolean) as HTMLElement[];
  if (!sections.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const index = sections.indexOf(entry.target as HTMLElement);
        dots.forEach((dot, i) => {
          dot.setAttribute('aria-current', i === index ? 'true' : 'false');
        });
      });
    },
    { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
  );
  sections.forEach((section) => observer.observe(section));
}

/** Savings estimator — the formula lives in estimator.ts and is documented there. */
async function initEstimator() {
  if (!document.querySelector('[data-estimator]')) return;
  const { mountEstimator } = await import('./estimator');
  mountEstimator();
}

/** Services page: two audiences, one tablist. */
function initServiceTabs() {
  const tablist = document.querySelector<HTMLElement>('[data-tabs]');
  if (!tablist) return;
  const tabs = Array.from(tablist.querySelectorAll<HTMLButtonElement>('[role="tab"]'));

  const select = (tab: HTMLButtonElement, focus = true) => {
    tabs.forEach((t) => {
      const selected = t === tab;
      t.setAttribute('aria-selected', String(selected));
      t.tabIndex = selected ? 0 : -1;
      const panel = document.getElementById(t.getAttribute('aria-controls')!);
      if (panel) panel.hidden = !selected;
    });
    if (focus) tab.focus();
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => select(tab, false));
    tab.addEventListener('keydown', (event) => {
      const rtl = document.documentElement.dir === 'rtl';
      const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
      const back = rtl ? 'ArrowRight' : 'ArrowLeft';
      const index = tabs.indexOf(tab);
      if (event.key === forward) select(tabs[(index + 1) % tabs.length]);
      else if (event.key === back) select(tabs[(index - 1 + tabs.length) % tabs.length]);
      else if (event.key === 'Home') select(tabs[0]);
      else if (event.key === 'End') select(tabs[tabs.length - 1]);
      else return;
      event.preventDefault();
    });
  });

  // Deep links (/services/#talent) should open the panel that holds the anchor.
  const hash = location.hash.slice(1);
  if (hash) {
    const owner = document.getElementById(hash)?.closest<HTMLElement>('[role="tabpanel"]');
    const tab = owner && tabs.find((t) => t.getAttribute('aria-controls') === owner.id);
    if (tab) select(tab, false);
  }
}
