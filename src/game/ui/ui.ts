// All screens and the HUD, as DOM over the canvas. The game pushes values in; buttons call back out.
import "./ui.css";
import { countUp, gsap, pop, slam, stagger } from "../../oryn/juice";
import { ICON } from "./icons";

export interface UiActions {
  start(): void;
  sandbox(): void;
  resume(): void;
  restart(): void;
  menu(): void;
  pause(): void;
  toggleSound(): void;
  quality(next: "low" | "medium" | "high"): void;
  tune(change: { radius?: number; wind?: number; shape?: "rope" | "cone" | "wedge" }): void;
  rebuild(): void;
  tap(): void;
  star(): void;
}

export interface Result {
  dollars: number;
  stars: number;
  ef: number;
  lifted: string;
  destroyed: number;
  best: number;
  newBest: boolean;
}

export type Screen = "title" | "run" | "sandbox" | "end";

export const money = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
export const shortMoney = (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(v >= 1e7 ? 1 : 2)}M` : v >= 1000 ? `$${Math.round(v / 1000)}K` : `$${Math.round(v)}`);

const RATING = ["Breezy", "Fence rattler", "Barn breaker", "House wrecker", "Town flattener", "Finger of God"];
const UNLOCK = ["", "Cars and trees give way", "Barns and roofs give way", "Houses give way", "Warehouses and silos give way", "Nothing holds any more"];
const PANELS = { title: "ts-title", pause: "ts-pause", end: "ts-end" } as const;

export class Ui {
  private root = document.createElement("div");
  private q = <T extends HTMLElement = HTMLElement>(s: string) => this.root.querySelector<T>(s)!;
  private shownDollars = -1;
  private shownTime = "";
  private shownStars = -1;
  private feedEl!: HTMLElement;
  private popups: { el: HTMLElement; x: number; y: number; value: number; born: number }[] = [];
  private hintTween: gsap.core.Timeline | null = null;
  private shownGuide = "";
  private bannerTween: gsap.core.Timeline | null = null;

  constructor(parent: HTMLElement, private actions: UiActions) {
    this.root.className = "ts";
    this.root.innerHTML = template();
    parent.append(this.root);
    this.feedEl = this.q(".ts-feed");
    const click = (selector: string, run: (el: HTMLElement) => void) =>
      this.root.querySelectorAll<HTMLElement>(selector).forEach((el) =>
        el.addEventListener("click", () => {
          this.actions.tap();
          run(el);
          el.blur();
        }),
      );
    click("[data-do]", (el) => (this.actions[el.dataset.do as "start"] as () => void)());
    click("[data-quality]", (el) => this.actions.quality(el.dataset.quality as "low"));
    click("[data-shape]", (el) => {
      this.mark("[data-shape]", el);
      this.actions.tune({ shape: el.dataset.shape as "rope" });
    });
    click("[data-tune]", () => this.openTune(!this.q(".ts-tune").classList.contains("is-open")));
    for (const key of ["radius", "wind"] as const) {
      const input = this.q<HTMLInputElement>(`[name=${key}]`);
      input.addEventListener("input", () => {
        this.paintSlider(input);
        this.actions.tune({ [key]: Number(input.value) });
      });
      this.paintSlider(input);
    }
    for (let i = 0; i < 6; i++) {
      const el = document.createElement("div");
      el.className = "ts-popup";
      this.q(".ts-popups").append(el);
      this.popups.push({ el, x: 0, y: 0, value: 0, born: -1e9 });
    }
  }

  private paintSlider(input: HTMLInputElement) {
    const f = (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min));
    input.style.setProperty("--fill", `${f * 100}%`);
    const out = this.q(`[data-out=${input.name}]`);
    out.textContent = input.name === "radius" ? `${Math.round(Number(input.value) * 2 * 3.28)} ft` : `${Math.round(72 + 190 * Number(input.value))} mph`;
  }

  private openTune(open: boolean) {
    this.q(".ts-tune").classList.toggle("is-open", open);
    document.body.classList.toggle("ts-tuning", open);
    if (open && this.root.classList.contains("is-touch")) this.hideHint();
  }

  private mark(group: string, active: HTMLElement) {
    this.root.querySelectorAll(group).forEach((el) => el.classList.toggle("is-on", el === active));
  }

  setScreen(screen: Screen) {
    this.root.dataset.screen = screen;
    for (const [name, cls] of Object.entries(PANELS)) if (name !== "pause") this.q(`.${cls}`).classList.toggle("is-shown", name === screen);
    this.setPaused(false);
    if (screen === "title") stagger(this.root.querySelectorAll(".ts-title > *"), 0.15);
    if (screen === "run" || screen === "sandbox") {
      this.shownDollars = this.shownStars = -1;
      this.feedEl.replaceChildren();
      this.openTune(screen === "sandbox" && window.innerHeight > 520 && window.innerWidth > 700);
    }
  }

  setPaused(paused: boolean) {
    this.root.classList.toggle("is-paused", paused);
    this.q(".ts-pause").classList.toggle("is-shown", paused);
  }

  setSound(on: boolean) {
    this.root.querySelectorAll("[data-do=toggleSound]").forEach((el) => {
      const icon = el.querySelector("i");
      if (icon) icon.innerHTML = on ? ICON.sound : ICON.muted;
      const label = el.querySelector("span");
      if (label) label.textContent = on ? "Sound on" : "Sound off";
      el.setAttribute("aria-label", on ? "Turn sound off" : "Turn sound on");
    });
  }

  setQuality(q: string) {
    this.mark("[data-quality]", this.q(`[data-quality=${q}]`));
  }

  setBest(best: number, stars: number) {
    this.q(".ts-best").textContent = best > 0 ? `Best storm ${money(best)}` : "";
    this.q(".ts-best").dataset.stars = String(stars);
  }

  setDevice(touch: boolean) {
    this.root.classList.toggle("is-touch", touch);
    document.body.classList.toggle("ts-touch", touch);
  }

  hud(v: { dollars: number; seconds: number | null; growth: number; ef: number; mph: number; charge: number; surging: boolean; stars: number; nextStar: number }) {
    const dollars = Math.round(v.dollars);
    if (dollars !== this.shownDollars) {
      this.shownDollars = dollars;
      this.q(".ts-damage").textContent = money(dollars);
    }
    const time = v.seconds === null ? "" : `${Math.floor(Math.ceil(v.seconds) / 60)}:${String(Math.ceil(v.seconds) % 60).padStart(2, "0")}`;
    if (time !== this.shownTime) {
      this.shownTime = time;
      this.q(".ts-time").textContent = time;
      this.q(".ts-time").classList.toggle("is-late", v.seconds !== null && v.seconds <= 15);
    }
    this.q(".ts-ef").textContent = `EF${v.ef}`;
    this.q(".ts-mph").textContent = `${v.mph} mph`;
    this.root.style.setProperty("--grow", String(v.ef >= 5 ? 1 : (v.growth * 5) % 1));
    this.root.style.setProperty("--charge", String(v.surging ? 0 : v.charge));
    this.root.classList.toggle("is-ready", v.charge >= 1 && !v.surging);
    document.body.style.setProperty("--ts-charge", String(v.surging ? 0 : v.charge));
    document.body.classList.toggle("ts-ready", v.charge >= 1 && !v.surging);
    document.body.dataset.tsEf = String(v.ef);
    this.root.dataset.ef = String(v.ef);
    this.root.style.setProperty("--next", String(v.nextStar));
    if (v.stars !== this.shownStars) {
      const stars = this.root.querySelectorAll<HTMLElement>(".ts-stars > i");
      stars.forEach((el, i) => el.classList.toggle("is-on", i < v.stars));
      if (this.shownStars >= 0 && v.stars > this.shownStars) {
        pop(stars[v.stars - 1]);
        this.actions.star();
      }
      this.shownStars = v.stars;
    }
  }

  feed(text: string, value: number) {
    const el = document.createElement("div");
    el.innerHTML = `<span>${text}</span><b>${shortMoney(value)}</b>`;
    this.feedEl.prepend(el);
    while (this.feedEl.children.length > 4) this.feedEl.lastElementChild!.remove();
    gsap.fromTo(el, { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.3, ease: "power3.out" });
    gsap.to(el, { opacity: 0, delay: 2.6, duration: 0.5, onComplete: () => el.remove() });
  }

  /** A sum rising from a place on screen. Sums close together add up in one label; the rest keep clear of each other. */
  popup(x: number, y: number, value: number) {
    const now = performance.now();
    const alive = this.popups.filter((p) => now - p.born < 1100);
    const y0 = (p: { el: HTMLElement }) => Number(gsap.getProperty(p.el, "y"));
    const mate = alive.find((p) => now - p.born < 700 && Math.abs(p.x - x) < 150 && Math.abs(y0(p) - y) < 90);
    const p = mate ?? this.popups.reduce((a, b) => (a.born < b.born ? a : b));
    if (!mate) {
      const others = alive.filter((o) => o !== p);
      for (let i = 0; i < 4 && others.some((o) => Math.abs(o.x - x) < 130 && Math.abs(y0(o) - y) < 38); i++) y += 42;
      p.x = Math.max(70, Math.min(this.root.clientWidth - 70, x));
      p.value = 0;
    } else y = y0(p);
    p.value += value;
    p.born = now;
    const { el } = p;
    el.textContent = shortMoney(p.value);
    el.classList.toggle("is-big", p.value >= 200000);
    gsap.killTweensOf(el);
    gsap.set(el, { x: p.x, y, xPercent: -50 });
    gsap.fromTo(el, { scale: mate ? 1.25 : 0.5, opacity: mate ? 1 : 0 }, { scale: 1, opacity: 1, duration: 0.18, ease: "back.out(3)" });
    gsap.to(el, { y: y - 60, duration: 1.2, ease: "power1.out" });
    gsap.to(el, { opacity: 0, delay: 0.8, duration: 0.4 });
  }

  banner(ef: number) {
    this.say(`EF${ef}`, UNLOCK[ef]);
  }

  say(title: string, text: string) {
    const el = this.q(".ts-banner");
    el.querySelector("b")!.textContent = title;
    el.querySelector("span")!.textContent = text;
    this.bannerTween?.kill();
    this.bannerTween = gsap.timeline();
    this.bannerTween.set(el, { autoAlpha: 1 }).add(slam(el.querySelector("b")!)).fromTo(el.querySelector("span"), { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3 }, 0.2).to(el, { autoAlpha: 0, duration: 0.5 }, 2.4);
  }

  hint(text: string) {
    const el = this.q(".ts-hint");
    if (document.body.classList.contains("ts-tuning") && this.root.classList.contains("is-touch")) return;
    el.innerHTML = text;
    this.hintTween?.kill();
    this.hintTween = gsap.timeline().fromTo(el, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.4, delay: 0.6 }).to(el, { autoAlpha: 0, delay: 5.5, duration: 0.5 });
  }

  private hideHint() {
    this.hintTween?.kill();
    gsap.set(this.q(".ts-hint"), { autoAlpha: 0 });
  }

  /** Points at the nearest thing worth breaking: over it when it is in view, on a ring round the storm when not. */
  guide(target: { name: string; distance: number } | null, aim: { at: { x: number; y: number } | null; angle: number } | null) {
    const el = this.q(".ts-guide");
    el.classList.toggle("is-on", !!target);
    if (!target || !aim) return;
    const w = this.root.clientWidth;
    const h = this.root.clientHeight;
    const inView = aim.at && aim.at.x > w * 0.1 && aim.at.x < w * 0.9 && aim.at.y > h * 0.24 && aim.at.y < h * 0.72;
    const x = inView ? aim.at!.x : w / 2 + Math.sin(aim.angle) * w * 0.36;
    const y = inView ? aim.at!.y - 44 : h * 0.5 - Math.cos(aim.angle) * h * 0.24;
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    el.style.setProperty("--turn", `${inView ? 180 : (aim.angle * 180) / Math.PI}deg`);
    const text = `${target.name} ${(Math.max(1, Math.round((target.distance * 3.28) / 50)) * 50).toLocaleString("en-US")} ft`;
    if (text !== this.shownGuide) this.q(".ts-guide span").textContent = this.shownGuide = text;
  }

  hideMessages() {
    this.bannerTween?.kill();
    this.hideHint();
    gsap.set(this.q(".ts-banner"), { autoAlpha: 0 });
    this.guide(null, null);
  }

  result(r: Result) {
    this.hideMessages();
    this.q(".ts-end h2").textContent = r.stars === 0 ? "The storm fizzled out" : RATING[r.stars];
    const stars = this.root.querySelectorAll<HTMLElement>(".ts-end-stars > i");
    stars.forEach((el, i) => el.classList.toggle("is-on", i < r.stars));
    [...stars].slice(0, r.stars).forEach((el, i) => {
      slam(el, 0.5 + i * 0.28);
      gsap.delayedCall(0.72 + i * 0.28, () => this.actions.star());
    });
    countUp(this.q(".ts-end-damage"), r.dollars, { from: 0, duration: 1.6, format: money });
    this.q("[data-row=ef]").textContent = `EF${r.ef}`;
    this.q("[data-row=lifted]").textContent = r.lifted;
    this.q("[data-row=destroyed]").textContent = r.destroyed.toLocaleString("en-US");
    const best = this.q(".ts-end-best");
    best.textContent = r.newBest ? "New best storm" : `Best ${money(r.best)}`;
    best.classList.toggle("is-new", r.newBest);
    stagger(this.root.querySelectorAll(".ts-end-rows > div, .ts-end .ts-actions > *"), 0.3);
  }
}

function template() {
  const icon = (name: string, action: string, label: string, body: string) => `<button class="ts-icon ${name}" data-do="${action}" aria-label="${label}"><i>${body}</i></button>`;
  const stars = `<i>${ICON.star}</i>`.repeat(5);
  return `
<div class="ts-hud">
  <div class="ts-score"><div class="ts-damage">$0</div><div class="ts-stars">${stars}</div></div>
  <div class="ts-mid"><div class="ts-time"></div></div>
  <div class="ts-power"><div class="ts-ef">EF0</div><div class="ts-meter"><div class="ts-mph">72 mph</div><div class="ts-bar"><i></i></div></div></div>
  <div class="ts-feed"></div>
  <div class="ts-popups"></div>
  <div class="ts-guide"><i>${ICON.arrow}</i><span></span></div>
  <div class="ts-surge"><kbd>Space</kbd><span>Surge</span><div class="ts-bar"><i></i></div></div>
  <div class="ts-banner"><b></b><span></span></div>
  <div class="ts-hint"></div>
  <div class="ts-tune">
    <label><span>Funnel width</span><em data-out="radius"></em><input type="range" name="radius" min="2" max="60" step="0.5" value="14"></label>
    <label><span>Wind speed</span><em data-out="wind"></em><input type="range" name="wind" min="0" max="1" step="0.01" value="0.55"></label>
    <div class="ts-seg"><button data-shape="rope">Rope</button><button data-shape="cone" class="is-on">Cone</button><button data-shape="wedge">Wedge</button></div>
    <button class="ts-btn is-quiet" data-do="rebuild">Rebuild the county</button>
  </div>
</div>
<div class="ts-top">
  ${icon("is-tune", "tap", "Storm settings", ICON.tune).replace('data-do="tap"', "data-tune")}
  ${icon("is-sound", "toggleSound", "Turn sound off", ICON.sound)}
  ${icon("is-pause", "pause", "Pause", ICON.pause)}
</div>
<div class="ts-title">
  <h1>Storm County</h1>
  <p>A tornado simulator where you are the storm. Tear through the county for three minutes and grow from a thin rope into a wall of wind.</p>
  <div class="ts-actions"><button class="ts-btn" data-do="start">Start the storm</button><button class="ts-btn is-quiet" data-do="sandbox">Sandbox</button></div>
  <div class="ts-best"></div>
</div>
<div class="ts-pause ts-sheet">
  <h2>Paused</h2>
  <div class="ts-actions is-column">
    <button class="ts-btn" data-do="resume">Resume</button>
    <button class="ts-btn is-quiet" data-do="restart">Restart</button>
    <button class="ts-btn is-quiet" data-do="toggleSound"><span>Sound on</span></button>
    <div class="ts-seg"><button data-quality="low">Low</button><button data-quality="medium">Medium</button><button data-quality="high">High</button></div>
    <button class="ts-btn is-quiet" data-do="menu">Main menu</button>
  </div>
</div>
<div class="ts-end ts-sheet">
  <div class="ts-end-head"><div class="ts-end-stars">${stars}</div><h2></h2><div class="ts-end-damage">$0</div><div class="ts-end-best"></div></div>
  <div class="ts-end-rows">
    <div><span>Storm rating</span><b data-row="ef"></b></div>
    <div><span>Biggest lift</span><b data-row="lifted"></b></div>
    <div><span>Things destroyed</span><b data-row="destroyed"></b></div>
  </div>
  <div class="ts-actions"><button class="ts-btn" data-do="restart">Play again</button><button class="ts-btn is-quiet" data-do="sandbox">Sandbox</button><button class="ts-btn is-quiet" data-do="menu">Menu</button></div>
</div>`;
}
