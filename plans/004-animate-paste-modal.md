# 004 - Give the paste modal symmetric presence

- **Status**: DONE
- **Commit**: 2ea114c
- **Severity**: MEDIUM
- **Category**: Physicality, interruptibility, and missed opportunities
- **Estimated scope**: 2 files, about 45 lines

## Problem

The paste modal conditionally mounts and unmounts with no visual bridge, so both the dimming layer and modal teleport.

```jsx
// src/App.jsx:513-527 - current
{pasteOpen && (
  <div className="modal-backdrop" role="dialog" aria-modal="true">
    <div className="paste-modal">
      {/* content */}
    </div>
  </div>
)}
```

```css
/* src/styles.css:691-707 - current */
.modal-backdrop {
  position: absolute;
  z-index: 40;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(15, 25, 21, 0.22);
}

.paste-modal {
  width: min(620px, calc(100vw - 32px));
  /* no presence transition */
}
```

## Target

Keep the modal subtree mounted so CSS transitions can reverse from their live presentation values. Hidden content must be inert and absent from the accessibility tree.

```jsx
<div
  className={`modal-backdrop ${pasteOpen ? 'is-open' : ''}`}
  role="dialog"
  aria-modal={pasteOpen ? 'true' : undefined}
  aria-hidden={!pasteOpen}
  inert={!pasteOpen}
>
```

```css
.modal-backdrop {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition:
    opacity 220ms var(--ease-out),
    visibility 0s linear 220ms;
}

.modal-backdrop.is-open {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transition:
    opacity 220ms var(--ease-out),
    visibility 0s;
}

.paste-modal {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
  transition: opacity 220ms var(--ease-out), transform 220ms var(--ease-out);
}

.modal-backdrop.is-open .paste-modal {
  opacity: 1;
  transform: translateY(0) scale(1);
}
```

Reduced motion uses `transform: none` and `opacity var(--duration-fast) var(--ease-out)` only.

## Repo conventions to follow

- The modal is centered, so center transform origin is correct; do not anchor it to the paste-text trigger.
- Use the motion tokens from plan 002 and extend the single reduced-motion section from plan 003.
- React 19 supports the boolean `inert` attribute used to prevent focus entering hidden mounted content.

## Steps

1. Replace the conditional wrapper in `src/App.jsx` with an always-mounted modal subtree using the exact class, `aria-modal`, `aria-hidden`, and `inert` state above. Keep all existing buttons, textarea state, and import behavior unchanged.
2. Add hidden-state opacity, visibility, pointer-event, and 220 ms transition declarations to `.modal-backdrop`.
3. Add the `.modal-backdrop.is-open` state with immediate visibility and symmetric opacity timing.
4. Give `.paste-modal` the exact 8 px / 0.98 starting transform, opacity, and 220 ms strong ease-out transition; add the settled child selector.
5. Extend the reduced-motion block: remove modal transform in both states, use `160ms` opacity only, and preserve the visibility delay so hidden content cannot receive input.
6. Rapidly inspect the cascade to ensure the modal is not visible or focusable on initial load.

## Boundaries

- Do NOT change modal content, copy, dimensions, focus outlines, or import logic.
- Do NOT use `@keyframes`; rapid reopen must retarget the current transition.
- Do NOT use `scale(0)` or add bounce.
- Do NOT add a dependency or a generic presence component for this single modal.
- If plans 002 and 003 are not applied, STOP and execute them first.

## Verification

- **Mechanical**: run `npm test` and `npm run build`; both must exit 0.
- **Feel check**: open, close, and rapidly reverse the modal. Confirm it never flashes, restarts from zero, or allows clicks during exit. At 10% playback confirm entry and exit use the same path. Tab while closed and confirm focus never enters the hidden textarea.
- Toggle reduced motion and confirm the modal uses a short cross-fade with no scale or vertical travel.
- **Done when**: both directions are symmetric and interruptible, the subtree is inert while hidden, and no existing modal behavior changes.
