/**
 * The two-note chime that plays when a conversion lands.
 *
 * Synthesised rather than loaded from an audio file on purpose: it is about two hundred
 * bytes of code instead of an asset to ship, cache and keep in the repo, it cannot fail
 * to load on a slow connection, and the alert either plays instantly or not at all.
 *
 * Everything here is best-effort. A browser that blocks it, an unsupported API, a device
 * on silent — none of that is worth an error in front of someone who is being told good
 * news, so every failure is swallowed and the toast carries the message on its own.
 */

// One context reused for the life of the tab. Browsers cap how many can exist, and
// creating one per conversion would eventually stop producing sound at all.
let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (context) return context;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
    return context;
  } catch {
    return null;
  }
}

/** One note: a sine with a soft attack and an exponential tail, so it reads as a chime. */
function note(ctx: AudioContext, frequency: number, startAt: number, duration: number): void {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;

  // Ramped rather than switched on: a gain that jumps from 0 to full is a click before
  // it is a note. Peak is deliberately low — this fires during someone's working day.
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.12, startAt + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration);
}

export function playConversionSound(): void {
  const ctx = audioContext();
  if (!ctx) return;

  try {
    // Autoplay policy suspends a context created before the user has interacted with
    // the page. By the time a conversion arrives they have almost always clicked
    // something, so resuming here usually succeeds — and when it does not, the toast is
    // still shown.
    if (ctx.state === 'suspended') void ctx.resume();

    const now = ctx.currentTime;
    note(ctx, 880, now, 0.18); // A5
    note(ctx, 1318.51, now + 0.12, 0.26); // E6 — rising, so it reads as arriving, not alarming
  } catch {
    // Nothing to do: a missing sound is not worth interrupting anyone over.
  }
}
