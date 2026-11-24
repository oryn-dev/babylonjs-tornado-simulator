import { platform } from "./platform";
import { TouchOverlay } from "./touch";

export const ACTIONS = [
  "moveUp",
  "moveDown",
  "moveLeft",
  "moveRight",
  "jump",
  "action",
  "secondary",
  "interact",
  "pause",
] as const;

export type Action = (typeof ACTIONS)[number];
export type Device = "keyboard" | "gamepad" | "touch";

export interface Vec2 {
  x: number;
  y: number;
}

const KEYS: Record<string, Action> = {
  KeyW: "moveUp",
  ArrowUp: "moveUp",
  KeyS: "moveDown",
  ArrowDown: "moveDown",
  KeyA: "moveLeft",
  ArrowLeft: "moveLeft",
  KeyD: "moveRight",
  ArrowRight: "moveRight",
  Space: "jump",
  KeyF: "action",
  Enter: "action",
  KeyQ: "secondary",
  KeyE: "interact",
  Escape: "pause",
  KeyP: "pause",
};

const MOUSE: Record<number, Action> = { 0: "action", 2: "secondary" };

const PAD: Partial<Record<number, Action>> = {
  0: "jump",
  1: "secondary",
  2: "action",
  3: "interact",
  9: "pause",
  12: "moveUp",
  13: "moveDown",
  14: "moveLeft",
  15: "moveRight",
};

const STICK_DEADZONE = 0.18;
const PAD_LOOK_SPEED = 14;
const TOUCH_LOOK_SCALE = 1.4;

export class Input {
  readonly touch: TouchOverlay;
  device: Device = platform.device === "phone" ? "touch" : "keyboard";

  private keys = new Set<Action>();
  private mouse = new Set<Action>();
  private pad = new Set<Action>();
  private now = new Set<Action>();
  private before = new Set<Action>();
  private padMove: Vec2 = { x: 0, y: 0 };
  private padLook: Vec2 = { x: 0, y: 0 };
  private lookSum: Vec2 = { x: 0, y: 0 };
  private lookFrame: Vec2 = { x: 0, y: 0 };
  private lookPointers = new Map<number, Vec2>();
  private deviceListeners = new Set<(device: Device) => void>();

  constructor(private canvas: HTMLCanvasElement, ui: HTMLElement) {
    this.touch = new TouchOverlay(ui, () => this.use("touch"));
    this.listen();
  }

  held(action: Action): boolean {
    return this.now.has(action);
  }

  pressed(action: Action): boolean {
    return this.now.has(action) && !this.before.has(action);
  }

  released(action: Action): boolean {
    return !this.now.has(action) && this.before.has(action);
  }

  axis(): Vec2 {
    const x = this.digital("moveRight") - this.digital("moveLeft") + this.padMove.x + this.touch.stick.x;
    const y = this.digital("moveUp") - this.digital("moveDown") + this.padMove.y + this.touch.stick.y;
    const length = Math.hypot(x, y);
    return length > 1 ? { x: x / length, y: y / length } : { x, y };
  }

  look(): Vec2 {
    return this.lookFrame;
  }

  onDevice(listener: (device: Device) => void) {
    this.deviceListeners.add(listener);
    return () => this.deviceListeners.delete(listener);
  }

  update(dt: number) {
    this.pollGamepad();
    this.before = this.now;
    this.now = new Set([...this.keys, ...this.mouse, ...this.pad, ...this.touch.held]);
    this.lookFrame = {
      x: this.lookSum.x + this.padLook.x * PAD_LOOK_SPEED * dt * 60,
      y: this.lookSum.y + this.padLook.y * PAD_LOOK_SPEED * dt * 60,
    };
    this.lookSum = { x: 0, y: 0 };
  }

  private digital(action: Action) {
    return this.now.has(action) ? 1 : 0;
  }

  private use(device: Device) {
    if (this.device === device) return;
    this.device = device;
    this.touch.setVisible(device === "touch");
    this.deviceListeners.forEach((listener) => listener(device));
  }

  private listen() {
    window.addEventListener("keydown", (event) => {
      const action = KEYS[event.code];
      if (!action) return;
      if (event.code.startsWith("Arrow") || event.code === "Space") event.preventDefault();
      this.keys.add(action);
      this.use("keyboard");
    });
    window.addEventListener("keyup", (event) => {
      const action = KEYS[event.code];
      if (action) this.keys.delete(action);
    });
    window.addEventListener("blur", () => this.clear());
    document.addEventListener("visibilitychange", () => this.clear());

    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    this.canvas.addEventListener("pointerdown", (event) => {
      this.canvas.setPointerCapture(event.pointerId);
      this.lookPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      /* In the phone preview a mouse stands in for a finger. */
      if (event.pointerType === "touch" || platform.device === "phone") return this.use("touch");
      const action = MOUSE[event.button];
      if (action) this.mouse.add(action);
      this.use("keyboard");
    });
    this.canvas.addEventListener("pointermove", (event) => {
      if (document.pointerLockElement === this.canvas) {
        this.lookSum.x += event.movementX;
        this.lookSum.y += event.movementY;
        return;
      }
      const last = this.lookPointers.get(event.pointerId);
      if (!last) return;
      const scale = event.pointerType === "touch" ? TOUCH_LOOK_SCALE : 1;
      this.lookSum.x += (event.clientX - last.x) * scale;
      this.lookSum.y += (event.clientY - last.y) * scale;
      last.x = event.clientX;
      last.y = event.clientY;
    });
    const release = (event: PointerEvent) => {
      this.lookPointers.delete(event.pointerId);
      const action = MOUSE[event.button];
      if (action) this.mouse.delete(action);
      if (event.type === "pointercancel") this.mouse.clear();
    };
    this.canvas.addEventListener("pointerup", release);
    this.canvas.addEventListener("pointercancel", release);
  }

  private clear() {
    this.keys.clear();
    this.mouse.clear();
    this.lookPointers.clear();
    this.touch.clear();
  }

  private pollGamepad() {
    this.pad.clear();
    this.padMove = { x: 0, y: 0 };
    this.padLook = { x: 0, y: 0 };
    const gamepad = navigator.getGamepads?.().find((pad) => pad?.connected);
    if (!gamepad) return;
    gamepad.buttons.forEach((button, index) => {
      const action = PAD[index];
      if (action && button.pressed) this.pad.add(action);
    });
    const [lx = 0, ly = 0, rx = 0, ry = 0] = gamepad.axes;
    this.padMove = deadzone(lx, -ly);
    this.padLook = deadzone(rx, ry);
    if (this.pad.size > 0 || this.padMove.x || this.padMove.y || this.padLook.x || this.padLook.y) this.use("gamepad");
  }
}

function deadzone(x: number, y: number): Vec2 {
  const length = Math.hypot(x, y);
  if (length < STICK_DEADZONE) return { x: 0, y: 0 };
  const scale = Math.min(1, (length - STICK_DEADZONE) / (1 - STICK_DEADZONE)) / length;
  return { x: x * scale, y: y * scale };
}
