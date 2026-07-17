# 003 - Respect reduced motion and pointer capability

- **Status**: DONE
- **Commit**: 2ea114c
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 1 file, about 35 lines

## Problem

The basemap panel translates on every open/close and topbar controls lift on hover, but the stylesheet has no reduced-motion branch and touch devices can retain false hover states.

```css
/* src/styles.css:127-133 - current */
.command:hover,
.icon-button:hover,
.export-menu > .command:hover {
  background: #ffffff;
  border-color: var(--line-strong);
  transform: translateY(-1px);
}

/* src/styles.css:231-253 - current */
.basemap-panel {
  opacity: 0;
  pointer-events: none;
  transform: translateX(12px);
  transition: opacity 180ms ease, transform 180ms ease;
}
```

## Target

Hover-only translation is restricted to precise pointing devices. Reduced motion keeps useful opacity/color feedback but removes position change.

```css
@media (hover: hover) and (pointer: fine) {
  .command:hover,
  .icon-button:hover,
  .export-menu > .command:hover {
    background: #ffffff;
    border-color: var(--line-strong);
    transform: translateY(-1px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .basemap-panel,
  .basemap-panel.open {
    transform: none;
  }

  .basemap-panel {
    transition: opacity var(--duration-fast) var(--ease-out);
  }

  .command,
  .icon-button,
  .export-menu > .command {
    transition: background var(--duration-fast) ease, border-color var(--duration-fast) ease;
  }

  .command:hover,
  .icon-button:hover,
  .export-menu > .command:hover {
    transform: none;
  }
}
```

## Repo conventions to follow

- Responsive media queries are already grouped at the bottom of `src/styles.css`.
- Consume the tokens introduced by plan 002; do not repeat raw durations or curves.
- Reduced motion means gentler feedback, not removal of all state feedback.

## Steps

1. Wrap the existing topbar hover rule in `@media (hover: hover) and (pointer: fine)` without changing its colors or one-pixel offset.
2. Add the exact reduced-motion block after the responsive queries so it wins the cascade.
3. Remove translation from both hidden and open basemap-panel states under reduced motion; retain the `160ms` opacity transition.
4. Remove topbar hover transforms and transform transitions under reduced motion while retaining background and border-color transitions.
5. Leave a clearly labeled reduced-motion section that later plans can extend for modal, popover, press, and layout behavior.

## Boundaries

- Do NOT globally set `animation: none` or `transition: none`.
- Do NOT remove color, opacity, focus, or selection feedback.
- Do NOT change responsive breakpoints.
- Do NOT add JavaScript media-query listeners in this plan.
- If plan 002 has not been applied, STOP and execute it first.

## Verification

- **Mechanical**: run `npm run build`; it must exit 0. Search for `prefers-reduced-motion` and confirm there is one organized block rather than scattered overrides.
- **Feel check**: emulate touch and confirm tapping a topbar command does not leave it visually lifted. Toggle reduced motion in DevTools and confirm the basemap panel cross-fades without horizontal travel while state remains obvious.
- **Done when**: precise-pointer hover behaves unchanged, touch has no false hover translation, and reduced-motion users retain a short non-spatial transition.
