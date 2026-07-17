# Animation improvement plans

All plans are stamped against commit `2ea114c` and implement the motion audit approved on 2026-07-17.

| Plan | Title | Severity | Status | Depends on |
| --- | --- | --- | --- | --- |
| 001 | Make track playback display-synced | HIGH | DONE | None |
| 002 | Establish motion tokens and panel easing | HIGH | DONE | None |
| 003 | Respect reduced motion and pointer capability | MEDIUM | DONE | 002 |
| 004 | Give the paste modal symmetric presence | MEDIUM | DONE | 002, 003 |
| 005 | Anchor the export popover to its trigger | MEDIUM | DONE | 002, 003 |
| 006 | Add restrained press feedback | MEDIUM | DONE | 002, 003 |
| 007 | Bridge the log-tray layout change | LOW | DONE | 002, 003 |

## Recommended execution order

1. `002-motion-tokens-panel-easing.md`
2. `003-reduced-motion-pointer-gating.md`
3. `006-add-press-feedback.md`
4. `004-animate-paste-modal.md`
5. `005-anchor-export-popover.md`
6. `001-smooth-track-playback.md`
7. `007-transition-log-tray-layout.md`

Plans 002 and 003 establish the shared vocabulary and accessibility behavior used by the remaining CSS work. Plan 001 is independent but carries the highest runtime impact. Plan 007 is last because it is progressive enhancement and must not disturb the stable panel layout.
