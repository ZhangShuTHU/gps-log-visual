# 001 - Make track playback display-synced

- **Status**: DONE
- **Commit**: 2ea114c
- **Severity**: HIGH
- **Category**: Performance and physicality
- **Estimated scope**: 3 files, about 90 lines including tests

## Problem

Playback advances in visible 260 ms steps, and the active point is selected by flooring into the point array. Sparse tracks therefore hold the cursor still and then teleport it.

```js
// src/App.jsx:92 - current
const currentPoint = activeTrack?.points[Math.min(activeTrack.points.length - 1, Math.floor((scrub / 100) * activeTrack.points.length))];

// src/App.jsx:231-237 - current
useEffect(() => {
  if (!isPlaying) return;
  const timer = window.setInterval(() => {
    setScrub((value) => (value >= 100 ? 0 : value + 1));
  }, 260);
  return () => window.clearInterval(timer);
}, [isPlaying]);
```

The map cursor is rebuilt from this discrete point through `addRouteToMap()`, so the step is visible both on the map and in the chart reference line.

## Target

- Preserve the existing playback speed: one percentage point per `260ms`, or a full cycle in `26_000ms`.
- Use `requestAnimationFrame` as the display-synchronized clock and linear time progression.
- Interpolate latitude, longitude, elevation, distance, speed, and slope between adjacent track points.
- Update the MapLibre cursor source and range input imperatively on every animation frame.
- Set the range input to `step="0.01"` so fractional frame values are not quantized to integer percentages.
- Commit React state at most every `100ms` while playing so Recharts and the full app do not rerender at display frequency.
- Cancel the frame immediately on pause, track change, and unmount. Commit the final ref value during cleanup.
- Manual scrub and skip buttons must update both the React state and the playback ref immediately, including while playback is active.

```js
// src/lib/track.js - target API
export function interpolateTrackPoint(points, progress) {
  // Clamp progress to 0..100, map it to 0..points.length - 1,
  // and linearly interpolate finite numeric fields.
}
```

```js
// src/App.jsx - target constants
const PLAYBACK_STEP_MS = 260;
const PLAYBACK_STATE_INTERVAL_MS = 100;
```

Do not introduce a spring: playback is constant functional motion and therefore uses linear time.

## Repo conventions to follow

- Track-domain calculations already live as named exports in `src/lib/track.js`.
- Tests use Vitest in `src/lib/track.test.js` and import named utilities from `./track.js`.
- Map data is updated through the existing GeoJSON source ids `route-source` and `cursor-source` in `src/App.jsx`.
- Keep `isAnimationActive={false}` on the three Recharts lines; those data lines should remain static and readable.

## Steps

1. In `src/lib/track.js`, add `interpolateTrackPoint(points, progress)`. Return `null` for an empty list and the sole point for a one-point list. Clamp progress, calculate lower and upper indices using `points.length - 1`, and interpolate only finite numeric values for `lat`, `lon`, `ele`, `distanceKm`, `speedKmh`, and `slope`; for unavailable values use the nearest non-null endpoint.
2. In `src/lib/track.test.js`, import the helper and add regressions for empty data, exact endpoints, clamping, and the 50% midpoint of two points.
3. In `src/App.jsx`, import the helper and replace the floored `currentPoint` expression with `interpolateTrackPoint(activeTrack?.points ?? [], scrub)`.
4. Add refs for the live scrub value, the range input, and the active animation frame. Add one setter helper that clamps a requested value, writes the ref synchronously, and updates React state.
5. Replace every direct interactive `setScrub` call in the skip buttons and range input with the synchronized setter helper, and set the range input to `step="0.01"`.
6. Factor the cursor FeatureCollection creation into a small local helper so both `addRouteToMap()` and the frame loop use the same shape.
7. Replace the interval effect with a `requestAnimationFrame` loop. Advance by `elapsedMs / PLAYBACK_STEP_MS`, wrap at 100, update the input DOM value and cursor GeoJSON every frame, and call React `setScrub` only when at least `PLAYBACK_STATE_INTERVAL_MS` has elapsed.
8. On cleanup, cancel the exact stored frame id and commit `scrubRef.current`. Do not leave timers, duplicated cursor-source writers, or unused refs.

## Boundaries

- Do NOT animate the Recharts data lines.
- Do NOT add a motion library or any dependency.
- Do NOT change the 26-second playback-cycle behavior.
- Do NOT run the full React render path at 60 fps.
- Do NOT modify parsing or export behavior beyond adding the interpolation helper.
- If the source ids or playback controls have drifted since commit `2ea114c`, STOP and report instead of improvising.

## Verification

- **Mechanical**: run `npm test` and `npm run build`; both must exit 0.
- **Feel check**: play the bundled sparse demo track and confirm the map cursor moves continuously rather than pausing at each raw point. Drag the range input while playback is active and confirm motion resumes from the dragged value without snapping back. Toggle play/pause rapidly and confirm only one frame loop exists.
- In browser performance tools, record five seconds of playback and confirm React/Recharts commits occur at roughly 10 fps or less while the map cursor remains display-synchronized.
- Confirm the three chart lines remain non-animated and readable.
- **Done when**: interpolation tests pass, no interval remains, the frame is cancelled on every exit path, and sparse-track playback has no visible point-to-point teleport.
