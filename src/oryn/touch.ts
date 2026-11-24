import { platform } from "./platform";
import type { Action, Vec2 } from "./input";

export interface TouchButton {
  action: Action;
  label: string;
  /** An image URL or element (e.g. `prompt(input, "jump")`) shown instead of the label, which stays as its name. */
  icon?: string | HTMLElement;
}

export interface TouchLayout {
  stick?: boolean;
  buttons?: TouchButton[];
}

const DEFAULT_LAYOUT: Required<TouchLayout> = {
  stick: true,
  buttons: [
    { action: "jump", label: "Jump" },
    { action: "action", label: "Use" },
  ],
};

const STICK_RADIUS = 56;

export class TouchOverlay {
  readonly held = new Set<Action>();
  stick: Vec2 = { x: 0, y: 0 };

  private root = element("div", "oryn-touch");
  private zone = element("div", "oryn-stick-zone");
  private base = element("div", "oryn-stick-base");
  private knob = element("div", "oryn-stick-knob");
  private pad = element("div", "oryn-buttons");
  private stickPointer: number | null = null;
  private origin: Vec2 = { x: 0, y: 0 };
  private visible = false;
  private enabled = false;

  constructor(ui: HTMLElement, private onTouch: () => void) {
    this.base.append(this.knob);
    this.zone.append(this.base);
    this.root.append(this.zone, this.pad);
    ui.append(this.root);
    this.listenStick();
    this.configure(DEFAULT_LAYOUT);
    this.setVisible(platform.device === "phone");
  }

  configure(layout: TouchLayout) {
    this.zone.hidden = layout.stick === false;
    this.pad.replaceChildren(...(layout.buttons ?? DEFAULT_LAYOUT.buttons).slice(0, 4).map((button) => this.button(button)));
  }

  /** Visible follows the device (touch); enabled is the game's switch for menus. Shown takes both. */
  get state() {
    return { visible: this.visible, enabled: this.enabled };
  }

  setVisible(visible: boolean) {
    this.visible = visible;
    this.render();
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) this.clear();
    this.render();
  }

  clear() {
    this.held.clear();
    this.releaseStick();
    this.pad.querySelectorAll(".is-down").forEach((node) => node.classList.remove("is-down"));
  }

  private render() {
    this.root.classList.toggle("is-shown", this.visible && this.enabled);
  }

  private button({ action, label, icon }: TouchButton) {
    const node = element("button", "oryn-touch-button");
    node.type = "button";
    if (icon) {
      node.setAttribute("aria-label", label);
      node.append(typeof icon === "string" ? Object.assign(element("img", "oryn-touch-icon"), { src: icon, alt: "", draggable: false }) : icon);
    } else node.textContent = label;
    node.dataset.action = action;
    const release = () => {
      this.held.delete(action);
      node.classList.remove("is-down");
    };
    node.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      node.setPointerCapture(event.pointerId);
      this.held.add(action);
      node.classList.add("is-down");
      this.onTouch();
    });
    node.addEventListener("pointerup", release);
    node.addEventListener("pointercancel", release);
    return node;
  }

  private listenStick() {
    this.zone.addEventListener("pointerdown", (event) => {
      if (this.stickPointer !== null) return;
      event.preventDefault();
      this.zone.setPointerCapture(event.pointerId);
      this.stickPointer = event.pointerId;
      const zone = this.zone.getBoundingClientRect();
      this.origin = { x: event.clientX, y: event.clientY };
      this.base.style.left = `${event.clientX - zone.left}px`;
      this.base.style.top = `${event.clientY - zone.top}px`;
      this.base.classList.add("is-active");
      this.onTouch();
    });
    this.zone.addEventListener("pointermove", (event) => {
      if (event.pointerId !== this.stickPointer) return;
      const dx = event.clientX - this.origin.x;
      const dy = event.clientY - this.origin.y;
      const length = Math.hypot(dx, dy);
      const scale = length > STICK_RADIUS ? STICK_RADIUS / length : 1;
      this.knob.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
      this.stick = { x: (dx * scale) / STICK_RADIUS, y: (-dy * scale) / STICK_RADIUS };
    });
    const release = (event: PointerEvent) => {
      if (event.pointerId === this.stickPointer) this.releaseStick();
    };
    this.zone.addEventListener("pointerup", release);
    this.zone.addEventListener("pointercancel", release);
  }

  private releaseStick() {
    this.stickPointer = null;
    this.stick = { x: 0, y: 0 };
    this.knob.style.transform = "";
    this.base.style.left = "";
    this.base.style.top = "";
    this.base.classList.remove("is-active");
  }
}

export function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
