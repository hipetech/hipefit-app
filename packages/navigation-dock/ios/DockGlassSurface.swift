import SwiftUI

/**
 The panel's glass background, and the only SwiftUI in this module.

 SwiftUI because of animation, not taste: a `CAAnimation` attached to a
 `UIGlassEffect` surface or any ancestor makes its system-drawn shadow composite
 twice, and SwiftUI's engine never attaches one. Six UIKit routes were measured
 and falsified first — `docs/app/ui.md` carries the numbers.

 Only the background is SwiftUI. The grid is a UIKit sibling drawn on top, which
 is what lets it keep fading through `UIView.animate` without reaching the glass.
 */
internal final class DockGlassModel: ObservableObject {
  @Published internal var isVisible = false
  @Published internal var reduceMotion = false
}

internal struct DockGlassSurface: View {
  @ObservedObject internal var model: DockGlassModel

  internal var body: some View {
    surface
      .opacity(model.isVisible ? 1 : 0)
      // Bound to `value:` rather than a `withAnimation` at the call site: the
      // caller is UIKit and sets the model from several places.
      .animation(fade, value: model.isVisible)
      // Decoration only — every touch belongs to a UIKit control drawn above.
      .allowsHitTesting(false)
  }

  private var fade: Animation {
    .easeInOut(
      duration: model.reduceMotion
        ? DockLayout.reducedMotionDuration
        : DockLayout.expansionDuration
    )
  }

  /// The `#if` is a *compiler* check, not an OS check: `glassEffect` is absent
  /// from SDKs older than Xcode 26, so `@available` alone would not compile.
  @ViewBuilder private var surface: some View {
    #if compiler(>=6.2)  // Xcode 26
    if #available(iOS 26.0, *) {
      Color.clear.glassEffect(
        .regular,
        in: .rect(cornerRadius: DockLayout.panelCornerRadius)
      )
    } else {
      fallback
    }
    #else
    fallback
    #endif
  }

  private var fallback: some View {
    RoundedRectangle(
      cornerRadius: DockLayout.panelCornerRadius,
      style: .continuous
    )
    .fill(.regularMaterial)
  }
}
