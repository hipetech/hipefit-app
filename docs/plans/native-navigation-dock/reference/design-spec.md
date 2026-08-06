---
type: reference
status: frozen
area: navigation
created: 2026-08-05
revised: 2026-08-05
---

# Native dock visual specification

Frozen deliverable. Every worker builds to this; changes require the integration owner.

The user-supplied reference is [`dock-expanded-reference.png`](dock-expanded-reference.png) (the
Bevel app). **Read the image before implementing** — the prose describes intent, the image resolves
ambiguity. Where this document and the image disagree, one of two things is true: either the
divergence is listed under [What deliberately differs from the reference](#what-deliberately-differs-from-the-reference),
or the document is wrong.

> **Revision history, three passes.** (1) The spec originally described four custom-drawn tab controls
> in a capsule and an assistant pill. The user directed that the four tabs be the **real system tab
> bar** and that the **assistant pill be dropped entirely** — not shipped unavailable, not built.
> (2) A refinement pass tuned the surviving surfaces against the reference image. (3) The user
> rejected the Create button floating _above_ the bar; it became a `role="search"` tab bar item, which
> puts it **beside** the bar as the reference shows. Pass 2 had recorded that placement as
> unreachable — that was wrong, and the correction is the current text. All revisions are folded into
> the body rather than appended.

## Requirements this satisfies

1. **The four tabs are the system tab bar.** `NativeTabs` stays visible and UIKit owns selection,
   per-tab history, repeated selection, deep links and state restoration. Nothing custom draws a tab.
2. **The Create affordance matches the reference:** a detached circle that toggles `plus`/`xmark`,
   opening a rounded card holding a grid of circular icon actions with labels beneath.
3. **No assistant.** No pill, no placeholder, no reserved space.

## Anatomy, bottom to top

```text
┌─────────────────────────────────────────────┐
│  action card  (expanded only)               │  rounded card, ≤3 per row
│   ◯ ◯ ◯   circular icon well + label        │  card sizes to its content
├─────────────────────────────────────────────┤
│ ╭───────────────────────────────╮   ╭─────╮ │  one UITabBar: the capsule of
│ │ ⌂     ▤       ☑       ⚙       │   │  +  │ │  four tabs, and the detached
│ │Home Workouts Exercises Settings│   ╰─────╯ │  search-role Create circle
│ ╰───────────────────────────────╯           │  beside it
└─────────────────────────────────────────────┘
```

Two surfaces. Only the card is ours — everything on the bottom row is the system tab bar.

## Tab bar

Not drawn by this initiative, and specified here only so nobody re-adds it. On iOS 26 `UITabBar`
already renders as the floating glass capsule with a filled pill behind the selected item that the
reference shows — the thing the original spec proposed drawing by hand arrives for free, with HIG
behaviour attached. `minimizeBehavior="never"` is required: the overlay cannot observe the bar, so a
bar that shrank on scroll would leave the action card anchored where the bar no longer is.

## Create button

- A **detached circle beside the tab bar capsule**, vertically centred on it — the reference
  placement. Delivered by a fifth `NativeTabs.Trigger` with `role="search"`, which is how UIKit
  renders a search-role item on iOS 26; the capsule shrinks to make room. UIKit sizes and places it,
  so the app specifies no diameter and no offset for it.
- Glyph is `plus` collapsed, `xmark` expanded. It **swaps** rather than cross-fades: a tab bar item
  cannot animate between two images. This is the one piece of motion given up for the placement.
- It is a **button, never a tab**: `disabled` so it never selects, explicit icon and label so it
  never reads as Search, and reported outside the group holding the four tabs. Expanded state lives
  in the label — "Create" / "Close" — not in a selected trait.
- **Pre-iOS 26 it is an ordinary fifth item inside the bar**, still labelled Create and still opening
  the panel. Unverified — no pre-26 runtime is installed.

## Action card

- Rounded card above the Create circle, sharing its horizontal margins with the safe area.
- Up to nine actions, three per row, in descriptor order. Fewer than nine fill the rows they need and
  the card sizes to its content; a tenth is dropped rather than laid into an unspecified fourth row.
- Each action: a circular icon well with the glyph centered, and a **semibold caption** beneath,
  centered, wrapping to two lines.
- Padding is asymmetric — generous vertically, tight horizontally — so each column gets close to a
  third of the card's full width, as in the reference. Symmetric padding costs roughly 12pt per
  column, which is what wraps a two-word label at the default text size.
- The three shipped actions are **disabled**: the item dims through semantic colors rather than a
  blanket alpha, and swallows its touch instead of passing it to the card behind.

## Backdrop

An **invisible barrier**. It covers the whole screen whenever the card is up, takes the background
out of the accessibility tree and **blocks every touch behind it** — and draws nothing: no shade, no
blur. The screen behind the panel is untouched, as in the reference, and the card's own material is
what separates it from the content.

Expanded is fully modal. A tap outside the card dismisses and does nothing else — a tab tap does not
navigate, and a tap on the Create circle dismisses through the barrier rather than through the
button.

Three revisions got here, and each is worth not repeating. A full-screen blur obscured the screen and
starved the glass card, which renders by refracting what is behind it. A black dimming scrim fixed
the glass but still shaded the whole app. Stopping either the dimming or the touches at the tab bar
produced, in turn, a bright band across the bottom and a tab bar that silently still navigated.

## Material and color

- **iOS 26+:** the public glass material behind an availability check, on the action card. The Create
  circle is UIKit's own, so its material is the tab bar's.
- **iOS 16.4–25:** `UIVisualEffectView` with `.systemChromeMaterial` — same geometry, different
  material. Unverified: no pre-26 runtime exists on the development machine.
- All foreground colors are semantic UIKit colors, so light, dark and Increase Contrast follow the
  system. No hardcoded hex and no brand accent — the app deliberately has no seed color. The backdrop
  is not an exception to this: it draws nothing at all, so it has no color to be wrong.

## Motion

One spring drives the card. The backdrop is not animated — it is invisible in both states — but it is
bracketed by the same block so it blocks touches for the whole presentation. The Create glyph is not
part of it either: a tab bar item swaps its image rather than animating, which is the motion cost of
the placement. Reduce Motion collapses the rest to a plain opacity fade with no spring and no rise.

The card **rises and fades; it does not scale.** Scaling is unavailable rather than unwanted: the
system draws the glass shadow, a scale transform does not take that shadow with it, and the mismatch
renders as a halo darker and wider than the card until the scale resolves.

## Geometry rules

- Every size in the card derives from Dynamic Type. Nothing is pinned to a measured constant; the one
  that was — the Create circle's diameter — went away with the button, which UIKit now sizes.
- The card's vertical offset is the exception, and it is not derived but _supplied_: no public API
  reports the system tab bar's geometry, so React sends the measured value from
  `features/navigation-dock/navigation-dock-metrics.ts`.
- Every interactive control clears 44×44pt at every text size.
- iPhone portrait only, matching the app's supported experience.

## What deliberately differs from the reference

- **Before iOS 26, the circle is not detached.** The reference placement is reachable on 26 through
  the search role and nowhere below it; on 16.4–25 Create is a fifth item inside the bar.
- **The scrim dims rather than blurs**, argued above.
- **No assistant pill**, by direction.
- **One row, not three.** The reference shows nine actions because that app has nine; this one ships
  the three that exist. Inventing six to fill a screenshot is an explicit non-goal.
