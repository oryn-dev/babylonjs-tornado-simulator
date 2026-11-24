import { gsap } from "gsap";

export { gsap };

type Target = gsap.TweenTarget;
const shown = new WeakMap<Element, { value: number }>();

interface CountUp {
  /** Where to start; by default the value the element shows now. */
  from?: number;
  duration?: number;
  format?: (value: number) => string;
}

/** Counts the element's number up (or down) to `to`. */
export function countUp(element: Element, to: number, { from, duration = 0.6, format = (value: number) => Math.round(value).toLocaleString() }: CountUp = {}) {
  const state = shown.get(element) ?? { value: Number(element.textContent?.replace(/[^\d.-]/g, "")) || 0 };
  if (from !== undefined) state.value = from;
  shown.set(element, state);
  gsap.killTweensOf(state);
  return gsap.to(state, { value: to, duration, ease: "power2.out", onUpdate: () => void (element.textContent = format(state.value)) });
}

/** Pops in with an overshoot: pickups, new HUD items, a medal appearing. */
export function pop(target: Target, delay = 0) {
  return gsap.fromTo(target, { scale: 0.3, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.45, delay, ease: "back.out(2.6)" });
}

/** Slams in from large and lands with a jolt: titles, "LEVEL UP", a final score. */
export function slam(target: Target, delay = 0) {
  return gsap.timeline({ delay })
    .fromTo(target, { scale: 2.6, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.28, ease: "power4.in" })
    .to(target, { scale: 1.06, duration: 0.07, yoyo: true, repeat: 1, ease: "power1.out" });
}

/** Shakes the target, e.g. a hit on the health bar or the whole HUD on a big impact. */
export function shake(target: Target = "#oryn-ui", strength = 10, duration = 0.35) {
  return gsap.to(target, {
    keyframes: Array.from({ length: 8 }, (_, step) => {
      const falloff = strength * (1 - step / 8);
      return { x: gsap.utils.random(-falloff, falloff), y: gsap.utils.random(-falloff, falloff), duration: duration / 9 };
    }).concat({ x: 0, y: 0, duration: duration / 9 }),
  });
}

/** Brings a list in one after another: menu items, rewards, a results breakdown. */
export function stagger(targets: Target, delay = 0) {
  return gsap.from(targets, { y: 28, opacity: 0, duration: 0.42, delay, stagger: 0.07, ease: "back.out(1.7)", clearProps: "transform,opacity" });
}

/** Punches and brightens a value that just changed: score, ammo, coins. */
export function flash(target: Target) {
  return gsap.fromTo(target, { scale: 1.35, filter: "brightness(2)" }, { scale: 1, filter: "brightness(1)", duration: 0.4, ease: "power3.out", clearProps: "filter" });
}
