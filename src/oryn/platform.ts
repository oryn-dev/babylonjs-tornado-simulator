export type Device = "phone" | "pc";

/** "phone" plays by touch. */
export const platform = {
  get device(): Device {
    return matchMedia("(pointer: coarse)").matches ? "phone" : "pc";
  },
};
