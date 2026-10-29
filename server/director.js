// Original implementation informed by Michael Booth's 2009 Valve presentation,
// slides 77-91. Pacing states are adapted to six-second shared-war ticks.
export function createDirector() {
  return {
    enabled: true,
    phase: "build",
    ticks: 0,
    intensity: 0,
    damage: 0,
    cue: "The convoy is preparing to leave.",
    cueId: 0,
    offered: false,
    choice: null,
    rescueTicks: 0,
    rescued: false,
  };
}
export function direct(d, o) {
  if (!d.enabled) return { spawn: 4, engaged: true, changed: false };
  const previous = d.phase;
  d.ticks++;
  // Observable combat load; never claims to measure boredom or human emotion.
  const load = Math.min(100, d.damage * 8 + o.pressure * 0.6);
  d.intensity = Math.max(
    load,
    Math.max(0, d.intensity - (o.pressure > 10 ? 0 : 18)),
  );
  if (d.phase === "build" && (d.intensity >= 65 || d.ticks >= 8)) {
    d.phase = "peak";
    d.ticks = 0;
    d.cue = "Incoming wave. Hold the crossing while the convoy pushes through.";
  } else if (d.phase === "peak" && d.ticks >= 1) {
    d.phase = "fade";
    d.ticks = 0;
    d.cue = "The wave is thinning. Clear the remaining attackers.";
  } else if (d.phase === "fade" && o.pressure <= 10 && d.intensity < 45) {
    d.phase = "relax";
    d.ticks = 0;
    d.cue = "A break in the fighting. The convoy has room to breathe.";
  } else if (d.phase === "relax" && d.ticks >= 6) {
    d.phase = "build";
    d.ticks = 0;
    d.cue = "Movement on the horizon. Prepare for the next approach.";
  }
  const changed = previous !== d.phase;
  if (changed) d.cueId++;
  return {
    spawn: d.phase === "fade" ? -6 : d.phase === "relax" ? -6 : 4,
    engaged: d.phase === "build" || d.phase === "peak",
    changed,
  };
}
