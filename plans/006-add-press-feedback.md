# 006 - Add restrained press feedback

- **Status**: DONE
- **Commit**: 2ea114c
- **Severity**: MEDIUM
- **Category**: Feedback and physicality
- **Estimated scope**: 1 file, about 30 lines

## Problem

Compact controls respond visually on hover or only after state changes, but they have no pointer-down feedback. The interface therefore feels less direct than the map interactions around it.

```css
/* src/styles.css:41-45 - current */
button {
  border: 0;
  color: inherit;
  cursor: pointer;
}

/* src/styles.css:100-115 - current */
.command,
.icon-button,
.export-menu > .command {
  /* hover transition only; no :active state */
}
```

Full-width track rows and basemap rows are information surfaces and must not scale.

## Target

```css
:where(
  .command,
  .icon-button,
  .tool-rail button,
  .floating-basemap,
  .panel-title button,
  .zoom-stack button,
  .playback button,
  .drop-zone button:not(.text-button),
  .modal-actions button
) {
  transition: transform var(--duration-fast) var(--ease-out);
}

:where(
  .command,
  .icon-button,
  .tool-rail button,
  .floating-basemap,
  .panel-title button,
  .zoom-stack button,
  .playback button,
  .drop-zone button:not(.text-button),
  .modal-actions button
):active {
  transform: scale(0.97);
}
```

Do not replace existing background/border transitions on `.command`; merge the transform timing without losing them. Under reduced motion, compact controls keep their color feedback and use `transform: none`.

## Repo conventions to follow

- Consume `--duration-fast` and `--ease-out` from plan 002.
- Keep selectors colocated in `src/styles.css`; no React handlers are needed because CSS `:active` responds on pointer-down.
- Existing active-mode styles such as `.tool-rail button.active` remain authoritative after release.

## Steps

1. Add a compact-control base selector with `transform var(--duration-fast) var(--ease-out)` while preserving all existing property transitions. If a selector already declares `transition`, merge rather than override it.
2. Add the exact `scale(0.97)` active selector.
3. Explicitly exclude `.track-list button`, `.basemap-list button`, `.clear-button`, `.text-button`, range inputs, and the map canvas from scaling.
4. Extend the reduced-motion block with the same compact selector and `transform: none`; do not remove background or border-color feedback.
5. Check hover plus active specificity so pressing a hovered topbar command moves visually inward rather than staying lifted.

## Boundaries

- Do NOT apply scaling to every `button` globally.
- Do NOT use values below `0.95`, add bounce, or add sound/haptics.
- Do NOT animate full-width list rows, chart content, coordinate readouts, or map controls owned by MapLibre.
- Do NOT change markup or add JavaScript.
- If plans 002 and 003 are not applied, STOP and execute them first.

## Verification

- **Mechanical**: run `npm run build`; it must exit 0. Inspect the selector list and confirm excluded information surfaces are absent.
- **Feel check**: press each included control with mouse and touch emulation. Feedback must start on pointer-down, remain subtle, and settle without bounce. Rapid presses must retarget without restarting a keyframe.
- Toggle reduced motion and confirm state/background feedback remains while scale is removed.
- **Done when**: all compact controls feel immediate, no full-row/list layout visibly shrinks, and hover/active states compose cleanly.
