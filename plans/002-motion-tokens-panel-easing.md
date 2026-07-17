# 002 - Establish motion tokens and panel easing

- **Status**: DONE
- **Commit**: 2ea114c
- **Severity**: HIGH
- **Category**: Easing, duration, and cohesion
- **Estimated scope**: 1 file, about 15 lines

## Problem

The app has three hand-written transitions, all using the weak built-in `ease`, and no shared motion vocabulary.

```css
/* src/styles.css:115 - current */
transition: background 160ms ease, border-color 160ms ease, transform 160ms ease;

/* src/styles.css:245 - current */
transition: opacity 180ms ease, transform 180ms ease;

/* src/styles.css:372 - current */
transition: transform 160ms ease;
```

The basemap panel is an entering/exiting surface, so a strong ease-out should make it respond immediately and settle quietly.

## Target

```css
/* src/styles.css :root - target */
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
--duration-fast: 160ms;
--duration-popover: 180ms;
--duration-panel: 200ms;
--duration-layout: 240ms;
```

```css
/* target */
.command,
.icon-button,
.export-menu > .command {
  transition:
    background var(--duration-fast) ease,
    border-color var(--duration-fast) ease,
    transform var(--duration-fast) var(--ease-out);
}

.basemap-panel {
  transition:
    opacity var(--duration-panel) var(--ease-out),
    transform var(--duration-panel) var(--ease-out);
}

.switch-line input::after {
  transition: transform var(--duration-fast) var(--ease-in-out);
}
```

## Repo conventions to follow

- Visual tokens already live in the single `:root` block at `src/styles.css:1-20`.
- Existing transition declarations are colocated with their selectors rather than in utility classes.
- Preserve `ease` for background and border-color hover changes; use the custom curves for spatial motion.

## Steps

1. Add the six exact motion tokens to the existing `:root` block after `--shadow`; do not add unused speculative tokens.
2. Rewrite the top command transition as the three explicit longhand entries shown above.
3. Change the basemap panel to `200ms` strong ease-out for both transform and opacity.
4. Change the switch knob to `160ms` strong ease-in-out because it moves between two on-screen states.
5. Search `src/styles.css` for remaining hand-written motion durations or cubic-beziers; do not leave a parallel token vocabulary.

## Boundaries

- Do NOT change colors, shadows, spacing, markup, or geometry.
- Do NOT add bounce or springs.
- Do NOT add a dependency.
- Do NOT convert functional map camera movement to these UI tokens.
- If the root token block or cited selectors have drifted since commit `2ea114c`, STOP and report instead of improvising.

## Verification

- **Mechanical**: run `npm run build`; it must exit 0. Run `rg -n "transition:|cubic-bezier|--duration-|--ease-" src/styles.css` and confirm all spatial transitions use the shared tokens.
- **Feel check**: toggle the basemap panel repeatedly and confirm it starts immediately, settles without bounce, and can reverse mid-transition without jumping. In DevTools set animation playback to 10% and confirm opacity and transform share the same 200 ms curve.
- **Done when**: the exact tokens exist once, the three current transitions consume them correctly, and no visual layout changes.
