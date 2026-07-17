# 007 - Bridge the log-tray layout change

- **Status**: DONE
- **Commit**: 2ea114c
- **Severity**: LOW
- **Category**: Preventing a jarring layout change
- **Estimated scope**: 2 files, about 55 lines

## Problem

Toggling the log tray removes it with `display: none` while the analytics panel jumps from `left: 248px` to `left: 8px` in the same frame.

```jsx
// src/App.jsx:317-320 - current
onClick={() => setLogTrayOpen((value) => !value)}
```

```css
/* src/styles.css:448-460 and 554-566 - current */
.log-tray {
  left: 8px;
  width: 232px;
}

.log-tray.is-hidden {
  display: none;
}

.analytics {
  left: 248px;
}

.analytics.full-width {
  left: 8px;
}
```

Animating `left` or `width` directly would force layout every frame and is forbidden.

## Target

Use the native View Transition API as progressive enhancement for the analytics layout morph. Unsupported browsers retain the correct final layout. The tray itself gets an ordinary interruptible transform/opacity transition.

```js
// src/App.jsx - target handler
function toggleLogTray() {
  const update = () => setLogTrayOpen((value) => !value);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!reduceMotion && document.startViewTransition) {
    document.startViewTransition(update);
    return;
  }

  update();
}
```

```css
:root {
  /* Keep the map/root out of the snapshot; only named panels participate. */
  view-transition-name: none;
}

.log-tray {
  view-transition-name: log-tray;
  opacity: 1;
  transform: translateX(0);
  transition:
    opacity var(--duration-panel) var(--ease-out),
    transform var(--duration-panel) var(--ease-out),
    visibility 0s;
}

.log-tray.is-hidden {
  display: flex;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translateX(-8px);
  transition:
    opacity var(--duration-panel) var(--ease-out),
    transform var(--duration-panel) var(--ease-out),
    visibility 0s linear var(--duration-panel);
}

.analytics {
  view-transition-name: analytics-panel;
}

::view-transition-group(analytics-panel) {
  animation-duration: var(--duration-layout);
  animation-timing-function: var(--ease-in-out);
}

::view-transition-group(log-tray) {
  animation-duration: var(--duration-panel);
  animation-timing-function: var(--ease-out);
}
```

The existing `.analytics.full-width` final geometry remains unchanged. Under reduced motion, do not call `startViewTransition`; the tray uses a 160 ms opacity-only transition and analytics snaps to its final layout.

## Repo conventions to follow

- Use plan 002 motion tokens and extend the single reduced-motion section from plan 003.
- Use feature detection; Vite targets evergreen browsers but the app must remain functional without View Transitions.
- Keep the existing absolute panel geometry and responsive rules.

## Steps

1. Add `toggleLogTray()` inside `App` with exact View Transition feature detection and reduced-motion bypass shown above.
2. Replace only the topbar log-tray toggle handler with `toggleLogTray`.
3. Replace `.log-tray.is-hidden { display: none; }` with the exact opacity, visibility, pointer-event, and `translateX(-8px)` hidden state. Keep `display: flex` so transitions can reverse.
4. Add the matching visible-state transition and `view-transition-name: log-tray` to `.log-tray`, plus the exact `200ms` strong ease-out pseudo-element group rule.
5. Set `view-transition-name: none` on `:root` so the map canvas is not captured, then add `view-transition-name: analytics-panel` to `.analytics` and the exact `240ms` strong ease-in-out pseudo-element group rule. Do not transition `left`, `right`, or `width`.
6. Extend reduced motion: remove tray transform, keep `160ms` opacity, preserve delayed visibility, and rely on the handler bypass to prevent snapshot motion.
7. Verify the mobile media rule at `max-width: 680px`, where `.log-tray { display: none; }` is deliberate. Ensure the new desktop hidden-state rule does not make it visible on mobile.

## Boundaries

- Do NOT animate `left`, `right`, `width`, grid columns, or other layout properties.
- Do NOT snapshot or animate the map canvas or entire page root.
- Do NOT add a View Transition polyfill or dependency.
- Do NOT alter panel sizes, bottom offsets, or responsive breakpoints.
- Do NOT force motion when `prefers-reduced-motion: reduce` is active.
- If plans 002 and 003 are not applied, STOP and execute them first.

## Verification

- **Mechanical**: run `npm test` and `npm run build`; both must exit 0.
- **Feel check**: toggle the file tray repeatedly on a supporting browser. The tray should move only 8 px and fade; analytics should expand through a composited snapshot over 240 ms without map movement. Rapid toggles must end in the correct state.
- Disable `document.startViewTransition` in DevTools and confirm the layout still functions with only the tray fade. Toggle reduced motion and confirm no analytics movement occurs.
- Test desktop, 980 px, and 680 px widths; the mobile-hidden tray must remain hidden.
- **Done when**: no layout property is transitioned, feature detection is safe, reduced motion is respected, and the final layouts are pixel-identical to the pre-change states.
