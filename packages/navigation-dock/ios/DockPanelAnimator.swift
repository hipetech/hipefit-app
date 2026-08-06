import UIKit

/**
 Drives the panel's expand and collapse a frame at a time, **without
 CoreAnimation**.

 This exists for exactly one reason, and it is not a preference about animation
 style: a `UIGlassEffect` surface renders its shadow twice for as long as a
 `CAAnimation` is attached to it or to any of its ancestors. One copy tracks the
 animation, one stays at the model position, and they superimpose — measured on
 an iPhone 17 Pro / iOS 26.5 at 60fps as `T_animating == T_settled²` at every row
 of the vertical profile above the card, within 0.1–3%. The doubled shadow
 collapses back to one in a single frame the instant the animation is removed,
 which is what makes it read as a halo that snaps rather than fades.

 Five builds narrowed it down, and the negative results are worth as much as the
 positive one. `layer.allowsGroupOpacity = false` changes nothing, so it is not a
 CoreAnimation group-opacity flatten. Shortening the fade only moves the artifact
 into fewer frames. Moving the fade onto `contentView`, *inside* the effect view,
 reproduces it unchanged. Removing every opacity animation and animating only
 geometry reproduces it unchanged. Wrapping the surface in a
 `UIGlassContainerEffect` reproduces it unchanged — including after
 `MaterialSurfaceView` was flattened into a real `UIVisualEffectView` so the
 container had a direct glass child to govern, which is the shape Apple
 documents.

 What every one of those has in common is an attached `CAAnimation`, and what
 none of them changes is that the correction lands on the frame it is removed.
 So the property being animated was never the variable. Setting `transform` and
 `alpha` directly, once per display frame, is a sequence of discrete model
 changes with no animation attached at any point — UIView-backed layers do not
 raise implicit animations for direct sets — and the shadow is rendered once.

 The cost is this file. That is the trade against the alternative, which was
 dropping to `UIBlurEffect` and drawing the shadow by hand, and losing Liquid
 Glass on the panel to do it.
 */
internal final class DockPanelAnimator {
  /**
   Called every frame with the two values the panel needs.

   `slide` runs 0 → 1 under the spring and **overshoots past 1**, which is where
   the settle comes from; `fade` runs 0 → 1 linearly and is clamped, because an
   overshooting opacity is just a clipped one.
   */
  internal var onUpdate: ((_ slide: CGFloat, _ fade: CGFloat) -> Void)?

  /// Fires once the spring has settled and the fade has landed, never on a
  /// retarget. The caller uses it for the teardown that must not happen early —
  /// `isHidden`, the material, the VoiceOver focus move.
  internal var onFinish: (() -> Void)?

  private var displayLink: CADisplayLink?
  private var target: CGFloat = 0
  private var slide: CGFloat = 0
  private var velocity: CGFloat = 0
  private var fade: CGFloat = 0
  private var fadeDuration: TimeInterval = DockLayout.fadeDuration
  private var usesSpring = true

  deinit {
    // The proxy below is what lets this run at all: `CADisplayLink` retains its
    // target, so an animator that held the link directly could never deallocate.
    stop()
  }

  /// Jumps to the end state with no animation at all. The first prop application
  /// arrives with the view already where it belongs, so animating it would play
  /// an expand nobody asked for.
  internal func set(expanded: Bool) {
    stop()
    target = expanded ? 1 : 0
    slide = target
    fade = target
    velocity = 0
    onUpdate?(slide, fade)
    onFinish?()
  }

  /**
   Animates toward `expanded`, adopting whatever position and velocity are
   already on screen.

   Retargeting rather than restarting is what `UIView`'s `.beginFromCurrentState`
   bought before, and it matters more here: the panel can be reversed mid-flight
   by a second tap, and a spring that restarted from rest would visibly stall at
   the turn.
   */
  internal func animate(expanded: Bool, reduceMotion: Bool) {
    target = expanded ? 1 : 0
    usesSpring = !reduceMotion
    fadeDuration = reduceMotion ? DockLayout.reducedMotionDuration : DockLayout.fadeDuration

    if !usesSpring {
      // Reduce Motion means no movement, so the panel is already at its resting
      // offset and only the fade has anywhere to go.
      slide = target
      velocity = 0
    }

    start()
  }

  internal func stop() {
    displayLink?.invalidate()
    displayLink = nil
  }

  private func start() {
    guard displayLink == nil else {
      return
    }

    let link = CADisplayLink(
      target: DockPanelAnimatorProxy(animator: self),
      selector: #selector(DockPanelAnimatorProxy.step(_:))
    )
    link.add(to: .main, forMode: .common)
    displayLink = link
  }

  fileprivate func step(_ link: CADisplayLink) {
    // Clamped rather than taken raw. A stall — a slow React commit, the app
    // returning from the background — otherwise hands the integrator one huge
    // step, which a spring turns into a launch rather than a catch-up.
    let delta = min(link.targetTimestamp - link.timestamp, 1.0 / 30.0)

    advanceFade(by: delta)
    advanceSlide(by: delta)

    onUpdate?(slide, fade)

    guard hasSettled else {
      return
    }

    slide = target
    fade = target
    velocity = 0
    onUpdate?(slide, fade)
    stop()
    onFinish?()
  }

  private func advanceFade(by delta: TimeInterval) {
    let step = CGFloat(delta / fadeDuration)
    fade = target > fade ? min(target, fade + step) : max(target, fade - step)
  }

  /**
   One semi-implicit Euler step of a damped spring.

   Subdivided to a fixed maximum step rather than integrated in one go: explicit
   integration of a stiff spring goes unstable when the step grows, and a
   120Hz-or-60Hz-or-stalled frame budget is exactly the case where it would.
   */
  private func advanceSlide(by delta: TimeInterval) {
    guard usesSpring else {
      slide = target
      return
    }

    var remaining = delta
    while remaining > 0 {
      let step = CGFloat(min(remaining, 1.0 / 240.0))
      let acceleration =
        DockLayout.expansionStiffness * (target - slide)
        - DockLayout.expansionDamping * velocity
      velocity += acceleration * step
      slide += velocity * step
      remaining -= Double(step)
    }
  }

  /// Both halves have to be done, not just the spring: under Reduce Motion the
  /// spring is skipped entirely and the fade is the whole animation.
  private var hasSettled: Bool {
    let slideDone = abs(target - slide) < 0.001 && abs(velocity) < 0.01
    let fadeDone = abs(target - fade) < 0.001
    return slideDone && fadeDone
  }
}

/**
 Weak indirection between the display link and the animator.

 `CADisplayLink` retains its target for as long as it is scheduled, so an
 animator that were its own target would keep itself alive through any leak of an
 un-invalidated link. This class holds the only strong reference the runloop has,
 and holds nothing strongly itself.
 */
private final class DockPanelAnimatorProxy {
  private weak var animator: DockPanelAnimator?

  init(animator: DockPanelAnimator) {
    self.animator = animator
  }

  @objc
  func step(_ link: CADisplayLink) {
    animator?.step(link)
  }
}
