import UIKit

/**
 Every blurred surface in the overlay — the Create circle, the action card and
 the backdrop — is one of these.

 This is the single source that has to render on both sides of the iOS 26 line.
 The OS split is an availability check, never a preprocessor branch, so the same
 code path is compiled and shipped for 16.4 and 26. The one `#if` here is a
 *compiler* check, not an OS check: `UIGlassEffect` does not exist in SDKs older
 than Xcode 26, so `@available` alone would not compile there. Copied from
 `node_modules/expo-glass-effect/ios/GlassView.swift`, which solves the same
 problem the same way.
 */
internal final class MaterialSurfaceView: UIVisualEffectView {
  internal enum CornerStyle {
    case capsule
    case circle
    case rounded(CGFloat)
  }

  /*
   This **is** the effect view rather than a `UIView` wrapping one, and the
   difference is load-bearing rather than tidying.

   `UIGlassContainerEffect` governs the glass views inside its content view. A
   plain `UIView` in between hides them from it: with the surface wrapped, a
   container around it changed nothing at all — same shadow, same curve, same
   frame of correction. Flattening is what puts a glass view where the container
   can actually see one.

   What the wrapper used to buy was clipping isolation, so a caller could put an
   unclipped subview beside the material. Nothing ever did, and `contentView` —
   still the place to add subviews — now comes from `UIVisualEffectView` itself.
  */
  private let cornerStyle: CornerStyle
  private let fallbackStyle: UIBlurEffect.Style
  private var hasAppliedEffect = false
  /// Driven only by `setMaterialVisible`. Held separately from
  /// `hasAppliedEffect` because the two answer different questions: this one is
  /// what the caller asked for, that one is whether a real size has arrived yet
  /// to honour it with.
  private var isMaterialVisible = false

  /**
   Whether the public glass API is usable right now.

   Two gates, both load-bearing. The availability check answers "is this iOS
   26?"; the `NSClassFromString` probe answers "does this build of iOS 26
   actually vend a working `UIGlassEffect`?" — early iOS 26 betas shipped one
   whose initializer failed (expo/expo#40911), which is why expo-glass-effect
   probes at runtime rather than trusting the version alone. Resolved once and
   cached: the answer cannot change while the process lives.
   */
  internal static let supportsGlass: Bool = {
    #if compiler(>=6.2)  // Xcode 26
    if #available(iOS 26.0, *) {
      guard let glassClass = NSClassFromString("UIGlassEffect") as? NSObject.Type else {
        return false
      }
      // `NSSelectorFromString`, not `#selector`: the point is to ask about a
      // selector this code cannot reference, on a class it cannot name.
      return glassClass.responds(to: NSSelectorFromString("effectWithStyle:"))
    }
    #endif
    return false
  }()

  /**
   - Parameter fallbackStyle: the pre-iOS-26 material. `systemChromeMaterial` is
     what UIKit puts behind its own bars, so the dock reads as system chrome on
     the systems that have no glass; a plain `systemMaterial` reads as a sheet.
   */
  internal init(cornerStyle: CornerStyle, fallbackStyle: UIBlurEffect.Style = .systemChromeMaterial) {
    self.cornerStyle = cornerStyle
    self.fallbackStyle = fallbackStyle
    // `nil`, not a material: the surface starts torn down and `setMaterialVisible`
    // is what brings it up, once there is a real size to render into.
    super.init(effect: nil)

    translatesAutoresizingMaskIntoConstraints = false
    clipsToBounds = true
    layer.cornerCurve = .continuous
  }

  @available(*, unavailable)
  internal required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func layoutSubviews() {
    super.layoutSubviews()

    switch cornerStyle {
    case .capsule:
      layer.cornerRadius = bounds.height / 2
    case .circle:
      layer.cornerRadius = min(bounds.width, bounds.height) / 2
    case .rounded(let radius):
      layer.cornerRadius = radius
    }

    // `UIGlassEffect` renders nothing when it is assigned before the view has
    // been laid out (expo/expo#41024), so first assignment waits for a real
    // size. Subsequent layout passes must not re-assign: re-setting a glass
    // effect without tearing the old one down first leaves the surface blank
    // (expo/expo#43732).
    if isMaterialVisible, !hasAppliedEffect, bounds.width > 0, bounds.height > 0 {
      hasAppliedEffect = true
      effect = makeEffect()
    }
  }

  /**
   Shows or hides the material — **and this, not `alpha`, is how a caller makes
   one of these appear.**

   `UIVisualEffectView` documents that setting `alpha` below 1 on an effect view
   or any of its superviews renders the effect incorrectly, and on iOS 26 the
   specific damage is measurable: `UIGlassEffect` draws its own shadow, and for
   as long as an opacity animation is attached that shadow composites twice.
   Measured on an iPhone 17 Pro / iOS 26.5 at 60fps, in the gutter just outside
   the panel edge over a 239 background — the settled shadow transmits 0.9387 of
   the background in linear light, mid-animation 0.8797, and 0.9387² = 0.8812, a
   0.17% match. It corrects in a single frame the moment the animation is
   removed, which is what makes it read as a halo that snaps rather than fades.

   Two dead ends, recorded so they are not retried. `layer.allowsGroupOpacity =
   false` changes nothing, so this is not a CoreAnimation group-opacity flatten.
   Shortening the fade only moves the artifact — the shadow is still doubled for
   every frame the opacity animation exists, however few.

   Animating `effect` is the supported alternative and the only one that removes
   it: the view keeps `alpha == 1` throughout, so the shadow is never composited
   twice, and UIKit cross-fades the material when this is called inside a
   `UIView.animate` block.

   Hiding tears the effect **down** rather than leaving it installed, which is
   also what keeps the re-show legal: expo/expo#43732 is about re-assigning a
   glass effect over a live one, and every assignment here follows a teardown.
   */
  internal func setMaterialVisible(_ visible: Bool) {
    isMaterialVisible = visible

    guard visible else {
      hasAppliedEffect = false
      effect = nil
      return
    }

    // Deliberately not an early `return` on a zero size: `isMaterialVisible` is
    // already set, so the pending `layoutSubviews` applies the effect as soon as
    // there is a real size to apply it to.
    if !hasAppliedEffect, bounds.width > 0, bounds.height > 0 {
      hasAppliedEffect = true
      effect = makeEffect()
    }
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()

    if window == nil {
      // Re-entering the hierarchy has to rebuild the effect, and layout may not
      // fire again on its own if the geometry is unchanged. `isMaterialVisible`
      // is left alone: leaving the window is not the caller changing its mind,
      // and it is what tells the next layout pass to restore the effect.
      hasAppliedEffect = false
      effect = nil
    } else {
      setNeedsLayout()
    }
  }

  private func makeEffect() -> UIVisualEffect {
    #if compiler(>=6.2)  // Xcode 26
    if #available(iOS 26.0, *), MaterialSurfaceView.supportsGlass {
      return UIGlassEffect(style: .regular)
    }
    #endif
    return UIBlurEffect(style: fallbackStyle)
  }
}

