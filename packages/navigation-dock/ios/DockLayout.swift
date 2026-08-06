import UIKit

/**
 Spacing and motion values for the action panel.

 **Nothing here is a device measurement**, and the one thing that was is gone:
 `createDiameter` went with the Create button itself, which is now a
 `role="search"` tab bar item that UIKit sizes and places. Every control's size
 comes from the intrinsic size of a text-style SF Symbol or a Dynamic Type
 label; everything below is padding.

 The single value this module cannot work out for itself is the **vertical
 offset**, and it is not here: a sibling overlay cannot measure the system tab
 bar through public API, so React supplies it through the `bottomInset` prop from
 `features/navigation-dock/navigation-dock-metrics.ts`.

 The consequence worth knowing: nothing here needs recomputing when the content
 size category changes. Labels carry `adjustsFontForContentSizeCategory` and
 glyphs carry text-style symbol configurations, so a Dynamic Type change
 invalidates their intrinsic content size and re-solves the layout on its own.
 That is why this module installs no trait observer and never overrides the
 (iOS 17-deprecated) `traitCollectionDidChange`.
 */
internal enum DockLayout {
  /// Leading/trailing margin of the panel, inside the safe area.
  static let horizontalMargin: CGFloat = 16
  /// Minimum gap above the bottom safe-area edge, used as a floor under
  /// `bottomInset` rather than added to it — see
  /// `NavigationDockView.updateBottomConstraints`.
  static let bottomGap: CGFloat = 8
  /// Vertical gap between the action panel and the top of the tab bar.
  static let surfaceGap: CGFloat = 10

  /**
   Panel padding is **asymmetric**, which is deliberate rather than an
   oversight.

   The reference card gives each of its three columns very nearly a third of the
   card's full width — the labels run edge to edge and the inner gutters are
   hairlines. Padding the card's sides as generously as its top and bottom would
   take roughly 12pt off every column, which is what turns "Custom Exercise"
   into a two-line label at the default text size. Vertical padding has no such
   cost, so it stays generous.
   */
  static let panelVerticalPadding: CGFloat = 18
  static let panelHorizontalPadding: CGFloat = 10
  static let panelCornerRadius: CGFloat = 28
  static let actionColumnSpacing: CGFloat = 4
  static let actionRowSpacing: CGFloat = 24
  static let actionLabelSpacing: CGFloat = 8
  /// Ring of space around an action glyph; its well is glyph + 2 × this.
  static let actionWellPadding: CGFloat = 18

  /*
   There is deliberately **no backdrop opacity constant** — the backdrop draws
   nothing at all.

   It has been three things. A full-screen `.systemUltraThinMaterial`, which
   obscured the screen rather than de-emphasising it, and starved the card:
   `UIGlassEffect` renders by refracting what is behind it, so glass over an
   already-blurred screen has nothing left to sample and stops reading as a
   surface. Then a black dimming scrim, which fixed the glass but still shaded
   the whole app. Now nothing: the reference leaves the screen behind the card
   untouched, and the card's own material is what separates it from the content.

   The view survives with a clear background because **its job was never the
   shade**. It captures the dismiss tap, blocks every touch behind it, and
   carries `accessibilityViewIsModal` — see `NavigationDockView.hitTest`. An
   invisible modal barrier is still a modal barrier.
   */

  /// Apple's minimum touch target. Enforced with `>=` constraints so a control
  /// can still grow past it under Dynamic Type.
  static let minimumHitTarget: CGFloat = 44

  static let actionsPerRow = 3
  /// The grid is specified to take at most nine descriptors; extras are dropped
  /// rather than pushed into an unspecified fourth row.
  static let maximumActions = 9

  static let pressedAlpha: CGFloat = 0.55

  /**
   Expand/collapse spring, as **physical constants rather than a UIKit duration**.

   `DockPanelAnimator` integrates this by hand off a `CADisplayLink` instead of
   handing it to `UIView.animate`, because a `CAAnimation` attached to the glass
   surface doubles its shadow — that file carries the measurement and the five
   builds that narrowed it down. So there is no `usingSpringWithDamping` to pass
   a normalised damping ratio to, and these are the real thing: stiffness k and
   damping coefficient c, for unit mass.

   They are the same spring as before, restated. ζ = c / 2√k = 20 / 2√150 = 0.82,
   just short of critically damped, so the panel settles with a hint of overshoot
   and no visible bounce. ω = √k = 12.2 rad/s puts the settling time at roughly
   4/ζω ≈ 0.4s, which is the duration this used to ask UIKit for.

   `docs/app/ui.md` caps animation at 300ms, and that rule is about numeric text
   transitions inside a `List` — a value changing in place, where anything
   longer reads as lag. This is a modal presentation, where the same 300ms reads
   as a snap; UIKit's own sheet presentation is longer still. Deliberate
   divergence, recorded here so it is not "corrected" back.

   Tune ζ through `expansionDamping`; changing stiffness alone changes both the
   speed and the bounce.
   */
  static let expansionStiffness: CGFloat = 150
  static let expansionDamping: CGFloat = 20
  /// Reduce Motion path: a plain cross-fade, with no spring and no movement.
  static let reducedMotionDuration: TimeInterval = 0.2

  /**
   The material cross-fade, which is **deliberately not the spring**.

   The panel appears by animating its `UIVisualEffectView`'s effect rather than
   its opacity — `MaterialSurfaceView.setMaterialVisible` carries the shadow
   measurement that forces that choice. An effect animation is a cross-fade
   between two rendered materials, and unlike a transform it has no meaningful
   behaviour past its endpoints: a spring drives the interpolation beyond 1 on
   the overshoot, where the glass has nothing to interpolate toward and visibly
   flickers. So this is a plain linear curve, and the spring stays on the
   geometry.

   0.22s rather than the spring's 0.4s because a material that is still resolving
   under a card which has already stopped moving reads as lag. Ending it early
   lands the material at the same moment the slide is most of the way home.
   */
  static let fadeDuration: TimeInterval = 0.22

  /**
   How far the collapsed panel sits below its resting position.

   **Translation only. There is deliberately no collapsed scale**, and removing
   the 0.94 that used to be here is what fixed the halo on open.

   The panel is a `UIGlassEffect` surface, so its shadow is drawn by the system
   as part of the material rather than by a `CALayer` this module owns. A scale
   transform does not carry that shadow with it: the body rendered at 0.94 while
   the shadow stayed sized for the full bounds, so the first frames showed a
   shadow wider and darker than the card it belonged to, tightening as the scale
   resolved. It read as a shadow that starts dark and gets lighter.

   Apple's guidance is to animate glass geometry by frame rather than by
   transform. Translation is the one transform that leaves the rendered size
   alone, which is why it is the one that survives here.
   */
  static let panelCollapsedOffset: CGFloat = 16
}

/**
 The panel's one piece of type.

 Kept out of `DockLayout` because it is a font, not a measurement, and kept out
 of the control that uses it so the "scales with Dynamic Type" argument sits
 next to the code that makes it true rather than in a call site.
 */
internal enum DockTypography {
  /**
   Caption, semibold.

   The weight is added to the **resolved preferred descriptor** rather than
   built with `systemFont(ofSize:weight:)`: the latter takes a fixed point size,
   which would freeze the label at whatever size was current when the control
   was constructed. Going through the descriptor keeps the `.caption1` metrics,
   so `adjustsFontForContentSizeCategory` still re-resolves it on a Dynamic Type
   change and no trait observer is needed.

   `size: 0` means "keep the descriptor's own size", which is the point.
   */
  static func actionLabel() -> UIFont {
    let descriptor = UIFontDescriptor
      .preferredFontDescriptor(withTextStyle: .caption1)
      .addingAttributes([
        .traits: [UIFontDescriptor.TraitKey.weight: UIFont.Weight.semibold]
      ])
    return UIFont(descriptor: descriptor, size: 0)
  }
}

/**
 Resolves an SF Symbol at a text style so it scales with Dynamic Type.

 A name that does not resolve falls back to a visible `questionmark` rather than
 `nil`. An empty image view would collapse the control it sits in and read as a
 layout bug; a question mark points at the actual cause — a bad descriptor from
 JS — during development.
 */
internal enum DockSymbol {
  static func image(_ name: String, textStyle: UIFont.TextStyle) -> UIImage? {
    let configuration = UIImage.SymbolConfiguration(textStyle: textStyle)
    return UIImage(systemName: name, withConfiguration: configuration)
      ?? UIImage(systemName: "questionmark", withConfiguration: configuration)
  }

  static func imageView(_ name: String, textStyle: UIFont.TextStyle) -> UIImageView {
    let view = UIImageView(image: image(name, textStyle: textStyle))
    view.translatesAutoresizingMaskIntoConstraints = false
    view.contentMode = .scaleAspectFit
    view.preferredSymbolConfiguration = UIImage.SymbolConfiguration(textStyle: textStyle)
    // Only affects the accessibility content size categories, where symbol
    // point sizes otherwise stop growing well before labels do.
    view.adjustsImageSizeForAccessibilityContentSizeCategory = true
    view.setContentCompressionResistancePriority(.required, for: .vertical)
    return view
  }
}

