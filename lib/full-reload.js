// Full page load (not Next's client-side navigation) - used after log in / log out / sign up,
// so nothing from the previous user (forms, AI results, banners) stays on screen.
export function fullReload(path) {
  window.location.assign(new URL(path, window.location.origin).href);
}
