const svg = (body: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;

export const ICON = {
  pause: svg('<rect x="6" y="5" width="4.4" height="14" rx="1.4"/><rect x="13.6" y="5" width="4.4" height="14" rx="1.4"/>'),
  sound: svg('<path d="M4 9.2h3.6L12.4 5v14l-4.8-4.2H4z"/><path d="M15.2 8.6a4.6 4.6 0 0 1 0 6.8M17.8 6a8.2 8.2 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  muted: svg('<path d="M4 9.2h3.6L12.4 5v14l-4.8-4.2H4z"/><path d="m16 9.4 5 5.2m0-5.2-5 5.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  star: svg('<path d="m12 2.6 2.9 6 6.6.9-4.8 4.6 1.2 6.5-5.9-3.1-5.9 3.1 1.2-6.5L2.5 9.5l6.6-.9z"/>'),
  arrow: svg('<path d="M12 3.2 20.4 19a1 1 0 0 1-1.4 1.3L12 16.6l-7 3.7A1 1 0 0 1 3.6 19z"/>'),
  surge: svg('<path d="M13.6 2 5 13.4h5.6L9.2 22 19 9.8h-6z"/>'),
  tune: svg('<path d="M4 7h9m5 0h2M4 17h3m5 0h8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="15.5" cy="7" r="2.6"/><circle cx="9.5" cy="17" r="2.6"/>'),
};
