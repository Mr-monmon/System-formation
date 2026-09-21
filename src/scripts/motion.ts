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
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

  if (!started) {
    started = true;
    await initSmoothScroll(ScrollTrigger);
  }

  ScrollTrigger.getAll().forEach((tr) => tr.kill());

  heroFormation(gsap);
  revealOnScroll(gsap, ScrollTrigger);
  structureGrid(gsap, ScrollTrigger);
  costMerge(gsap, ScrollTrigger);
  formationPath(gsap, ScrollTrigger);
  initSlideNav();
  initEstimator();
  initServiceTabs();
  ScrollTrigger.refresh();
}

/* ------------------------------------------------------------------ */
/* Smooth scroll                                                       */
/* ------------------------------------------------------------------ */
async function initSmoothScroll(ScrollTrigger: typeof import('gsap/ScrollTrigger').ScrollTrigger) {
  const { default: LenisCtor } = await import('lenis');
  lenis = new LenisCtor({ duration: 1.05, smoothWheel: true, touchMultiplier: 1.6 });
  lenis.on('scroll', ScrollTrigger.update);
  const raf = (time: number) => {
    lenis?.raf(time);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);

  // Keep in-page anchors working through Lenis, including the slide dots.
  document.addEventListener('click', (event) => {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
    if (!link) return;
    const id = link.getAttribute('href')!.slice(1);
    const target = id && document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    lenis?.scrollTo(target, { offset: -72 });
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });
}

/* ------------------------------------------------------------------ */
/* Hero: the two bands slide in from opposite sides and lock together  */
/* ------------------------------------------------------------------ */
function heroFormation(gsap: typeof import('gsap').gsap) {
  const hero = document.querySelector('[data-hero]');
  if (!hero) return;
  const blue = hero.querySelector('[data-band="blue"]');
  const navy = hero.querySelector('[data-band="navy"]');
  const words = hero.querySelectorAll('[data-hero-line]');
  const rest = hero.querySelectorAll('[data-hero-fade]');
  const d = flow();

  // Astro fires astro:page-load on first paint as well as after navigation,
  // so guard: a second timeline over the same targets would leave them stuck
  // at the first one's start values.
  if (hero.hasAttribute('data-hero-played')) return;
  hero.setAttribute('data-hero-played', '');

  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });

  if (blue && navy) {
    tl.from(blue, { xPercent: -140 * d, yPercent: -18, opacity: 0, duration: 1.1 }, 0)
      .from(navy, { xPercent: 140 * d, yPercent: 18, opacity: 0, duration: 1.1 }, 0.08)
      // the lock: a single settle once both bands are home
      .fromTo(
        hero.querySelector('[data-hero-mark]'),
        { scale: 0.94 },
        { scale: 1, duration: 0.7, ease: 'power3.out' },
        0.75,
      );
  }

  tl.from(
    words,
    { yPercent: 108, opacity: 0, duration: 0.85, stagger: 0.07, ease: 'power3.out' },
    0.55,
  ).from(rest, { y: 18, opacity: 0, duration: 0.7, stagger: 0.09 }, 0.95);
}

/* ------------------------------------------------------------------ */
/* Scroll reveals                                                      */
/* ------------------------------------------------------------------ */
function revealOnScroll(
  gsap: typeof import('gsap').gsap,
  ScrollTrigger: typeof import('gsap/ScrollTrigger').ScrollTrigger,
) {
  document.querySelectorAll<HTMLElement>('[data-animate]').forEach((el) => {
    if (el.closest('[data-hero]') || el.dataset.revealBound !== undefined) return;
    el.dataset.revealBound = '';

    const mode = el.dataset.animate || 'up';
    const from: gsap.TweenVars = { opacity: 0 };
    if (mode === 'up') from.y = 26;
    if (mode === 'start') from.x = 40 * flow();
    if (mode === 'scale') from.scale = 0.96;

    // fromTo, not from: the stylesheet already sets opacity 0 on these (so the
    // start state is correct before this module loads), which would make a
    // `.from()` tween animate 0 -> 0. The end state has to be stated.
    gsap.fromTo(
      el,
      from,
      {
        opacity: 1,
        y: 0,
        x: 0,
        scale: 1,
        duration: 0.7,
        ease: 'power3.out',
        delay: Number(el.dataset.animateDelay || 0),
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      },
    );
  });

  // Staggered children (fact lists, pillar blocks, value lists).
  document.querySelectorAll<HTMLElement>('[data-stagger]').forEach((group) => {
    if (group.dataset.revealBound !== undefined) return;
    group.dataset.revealBound = '';
    gsap.fromTo(
      group.querySelectorAll(':scope > *'),
      { opacity: 0, y: 22 },
      {
        opacity: 1,
        y: 0,
        duration: 0.62,
        ease: 'power3.out',
        stagger: 0.08,
        scrollTrigger: { trigger: group, start: 'top 85%', once: true },
      },
    );
  });

  ScrollTrigger.refresh();

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
  document.querySelectorAll<SVGSVGElement>('[data-structure]').forEach((svg) => {
    const cells = svg.querySelectorAll('[data-cell]');
    if (!cells.length) return;
    gsap.fromTo(
      cells,
      { opacity: 0, scale: 0.82, transformOrigin: '50% 50%' },
      {
        opacity: 1,
        scale: 1,
        duration: 0.7,
        ease: 'power2.out',
        // `amount` spreads the whole stagger over a fixed window, so a grid of
        // 400 cells still assembles in about a second rather than 15.
        stagger: { amount: 1.1, from: 'random' },
        scrollTrigger: { trigger: svg.closest('section') || svg, start: 'top 75%', once: true },
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
