import UIKit

/**
 Spacing and motion values for the action panel.

 **Nothing here is a device measurement.** Every control sizes itself from a
 text-style SF Symbol or a Dynamic Type label, so a content size change
 re-solves the layout on its own and this module installs no trait observer.

 The one value it cannot work out for itself is the vertical offset: a sibling
 overlay cannot measure the system tab bar through public API, so React supplies
 it via `bottomInset` from `features/navigation-dock/navigation-dock-metrics.ts`.
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

  /// Asymmetric on purpose. The reference gives each column nearly a third of
  /// the card's width, so side padding as generous as the vertical would take
  /// ~12pt off every column and wrap "Custom Exercise" onto two lines.
  static let panelVerticalPadding: CGFloat = 18
  static let panelHorizontalPadding: CGFloat = 10
  static let panelCornerRadius: CGFloat = 28
  static let actionColumnSpacing: CGFloat = 4
  static let actionRowSpacing: CGFloat = 24
  static let actionLabelSpacing: CGFloat = 8
  /// Ring of space around an action glyph; its well is glyph + 2 × this.
  static let actionWellPadding: CGFloat = 18

  /*
   No backdrop opacity constant: the backdrop draws nothing. A material there
   starved the card — `UIGlassEffect` refracts what is behind it, and glass over
   an already-blurred screen has nothing left to sample. Its job is the modal
   barrier, not the shade.
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
   Expand/collapse cross-fade.

   Two animations share this: SwiftUI fades the glass in `DockGlassSurface`,
   `UIView.animate` fades the grid in `NavigationDockView`. They read as one only
   while they share this duration and an ease-in-out curve — change them together.

   **No collapsed scale, ever.** A glass shadow is system-drawn and does not
   follow a transform, so a scaled start renders the body small with a
   full-size shadow. This animates no geometry at all.
   */
  static let expansionDuration: TimeInterval = 0.22
  /// Reduce Motion path: the same fade, shortened — the fade *is* the whole
  /// animation either way.
  static let reducedMotionDuration: TimeInterval = 0.16
}

/// The panel's one piece of type.
internal enum DockTypography {
  /// Caption, semibold. Built from the *resolved preferred descriptor* rather
  /// than `systemFont(ofSize:weight:)`, which would freeze the point size;
  /// `size: 0` keeps the descriptor's own. That is what lets
  /// `adjustsFontForContentSizeCategory` re-resolve it without a trait observer.
  static func actionLabel() -> UIFont {
    let descriptor = UIFontDescriptor
      .preferredFontDescriptor(withTextStyle: .caption1)
      .addingAttributes([
        .traits: [UIFontDescriptor.TraitKey.weight: UIFont.Weight.semibold]
      ])
    return UIFont(descriptor: descriptor, size: 0)
  }
}

/// Resolves an SF Symbol at a text style so it scales with Dynamic Type. An
/// unresolvable name falls back to a visible `questionmark` rather than `nil`,
/// which would collapse the control and read as a layout bug instead of a bad
/// descriptor from JS.
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

