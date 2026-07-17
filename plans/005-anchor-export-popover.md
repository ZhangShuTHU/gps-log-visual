# 005 - Anchor the export popover to its trigger

- **Status**: DONE
- **Commit**: 2ea114c
- **Severity**: MEDIUM
- **Category**: Spatial consistency and interruptibility
- **Estimated scope**: 2 files, about 40 lines

## Problem

The export menu conditionally appears at full size with no spatial relationship to its trigger and cannot animate its exit.

```jsx
// src/App.jsx:341-355 - current
<div className="export-menu">
  <button className="command" onClick={() => setExportOpen((value) => !value)}>
    {/* label */}
  </button>
  {exportOpen && (
    <div className="menu-popover">
      {/* format buttons */}
    </div>
  )}
</div>
```

```css
/* src/styles.css:149-159 - current */
.menu-popover {
  position: absolute;
  top: 42px;
  right: 0;
  width: 128px;
  /* no origin or transition */
}
```

## Target

```jsx
<button
  className="command"
  aria-expanded={exportOpen}
  onClick={() => setExportOpen((value) => !value)}
>

<div
  className={`menu-popover ${exportOpen ? 'is-open' : ''}`}
  aria-hidden={!exportOpen}
  inert={!exportOpen}
>
```

```css
.menu-popover {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transform: translateY(-4px) scale(0.97);
  transform-origin: top right;
  transition:
    opacity var(--duration-popover) var(--ease-out),
    transform var(--duration-popover) var(--ease-out),
    visibility 0s linear var(--duration-popover);
}

.menu-popover.is-open {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transform: translateY(0) scale(1);
  transition:
    opacity var(--duration-popover) var(--ease-out),
    transform var(--duration-popover) var(--ease-out),
    visibility 0s;
}
```

Reduced motion removes transform and keeps a `160ms` opacity transition.

## Repo conventions to follow

- The popover is positioned by `right: 0` under its export trigger, so `transform-origin: top right` describes the real source.
- Use plan 002 tokens and extend plan 003's single reduced-motion block.
- Keep the existing format list and `downloadTrack()` close behavior.

## Steps

1. Keep the menu mounted in `src/App.jsx`, toggle `.is-open`, and use boolean `inert` plus `aria-hidden` while closed.
2. Add `aria-expanded={exportOpen}` to the trigger without changing its handler.
3. Add the exact hidden state, top-right origin, transform, opacity, visibility, and pointer-event rules to `.menu-popover`.
4. Add `.menu-popover.is-open` with the exact settled values and symmetric exit timing.
5. Extend the reduced-motion block so both states use `transform: none` and a `160ms` opacity-only transition while retaining visibility safety.
6. Confirm selecting every export format still closes the menu through the existing `setExportOpen(false)` calls.

## Boundaries

- Do NOT use `@keyframes`, `scale(0)`, bounce, or staggered menu items.
- Do NOT change export formats or download logic.
- Do NOT add click-outside or keyboard-navigation behavior in this motion-only plan.
- Do NOT add a dependency.
- If plans 002 and 003 are not applied, STOP and execute them first.

## Verification

- **Mechanical**: run `npm test` and `npm run build`; both must exit 0.
- **Feel check**: toggle the menu rapidly and confirm it reverses from the current visual state. At 10% playback confirm it grows from the trigger's lower-right relationship and exits along the same path. Confirm closed menu buttons cannot be tabbed or clicked.
- Toggle reduced motion and confirm a short fade remains without translate or scale.
- **Done when**: entry and exit are symmetric, trigger origin is legible, and export behavior is unchanged.
