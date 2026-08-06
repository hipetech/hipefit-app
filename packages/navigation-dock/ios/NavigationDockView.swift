import ExpoModulesCore
import UIKit

/**
 The Create action panel and the dimming scrim behind it.

 **What this view is not.** It draws no tabs and, as of the move to the
 reference layout, no button either. The four tabs *and* the Create circle are
 all real `UITabBar` items: Create is a `role="search"` trigger, which is what
 makes UIKit draw it as the detached circle beside the bar. See
 `app/(private)/_layout.tsx`. This view is a sibling overlay above all of that,
 and it neither renders nor knows anything about tab selection.

 **Why UIKit and not SwiftUI in a `UIHostingController`.** This view has to pass
 touches through everywhere it is not drawing, which means owning `hitTest` — a
 hosting view answers for its whole frame and offers no supported way to say
 "not here". The rest of the app is SwiftUI through `@expo/ui`; this view is the
 documented exception, and the reason is above rather than in a plan document.

 **Why the vertical offset arrives as a prop.** A sibling overlay cannot measure
 the system tab bar through public API — Expo lists it as a known `NativeTabs`
 limitation, and it is the whole reason
 `features/navigation-dock/navigation-dock-metrics.ts` exists. So `bottomInset`
 is supplied by React from those measured constants. This view does **not**
 search the hierarchy for a `UITabBar`, and must not start: binding to another
 library's private view tree would turn a patch upgrade of
 `react-native-screens` into a navigation outage.

 **What this view does not own.** React owns `expanded`, in
 `features/navigation-dock/store/use-navigation-dock-store.ts`. Nothing here
 mutates it: the view animates toward whatever prop arrives.
 */
public final class NavigationDockView: ExpoView {
  // MARK: - Events

  internal let onDismissRequest = EventDispatcher()
  internal let onActionPress = EventDispatcher()

  // MARK: - React-owned state

  private var actions: [DockAction] = []
  private var isExpanded = false
  private var reduceMotion = false
  private var bottomInset: CGFloat = 0

  private var needsActionRebuild = false
  private var needsExpansionUpdate = false
  /// The first prop application arrives with the view already at its final
  /// state, so animating it would play an expand the user never asked for.
  private var hasAppliedProps = false

  // MARK: - Views

  /// Invisible. It captures the dismiss tap and blocks the screen behind the
  /// panel, and draws nothing at all — `DockLayout` carries the argument for why
  /// there is no shade and no material here.
  private let backdrop = UIView()
  /**
   Every appearance change the panel makes goes through this rather than
   `UIView.animate`.

   `DockPanelAnimator` carries the measurement and the five builds behind that:
   a `CAAnimation` attached anywhere in this view's ancestry makes the panel's
   `UIGlassEffect` shadow composite twice for as long as it runs. A
   `UIGlassContainerEffect` wrapper was tried and changed nothing, including with
   the surface flattened into a real `UIVisualEffectView` so the container had a
   direct glass child — the wrapper is gone again rather than left in as cargo.
  */
  private let animator = DockPanelAnimator()
  private let panel = MaterialSurfaceView(cornerStyle: .rounded(DockLayout.panelCornerRadius))
  private let panelScrollView = UIScrollView()
  private let actionsStack = UIStackView()

  private var actionControls: [DockActionControl] = []
  /// Positions the *container*, which is what carries the panel's placement now.
  private var panelBottomConstraint: NSLayoutConstraint?

  // MARK: - Lifecycle

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)

    backgroundColor = .clear
    clipsToBounds = false

    setUpBackdrop()
    setUpPanel()
    setUpConstraints()

    animator.onUpdate = { [weak self] slide, fade in
      self?.applyAnimationFrame(slide: slide, fade: fade)
    }
    animator.onFinish = { [weak self] in
      self?.finishExpansion()
    }

    applyExpansion(animated: false)
  }

  // MARK: - Hit testing

  /**
   Collapsed, the overlay is a hole in the touch layer; expanded, it captures the
   whole screen.

   **Expanded is fully modal, tab bar included.** An earlier revision left a live
   strip along the bottom so a tab tap could still navigate and the Create circle
   could still act as a button. That was the wrong call: with the panel up, the
   only thing a tap outside it should do is dismiss it, and a tab bar that
   silently still navigates from under a dimmed scrim is a way to leave the panel
   by accident. Everything outside the card now goes to the scrim, and the scrim
   only ever dismisses — including a tap on the `xmark`, which produces the
   result the user was reaching for anyway.

   `hit === self` is the pass-through rule for the collapsed case. `super.hitTest`
   already returns the deepest view that claims the point, and while collapsed
   both children are hidden, so a hit landing on `self` means nothing in the
   overlay wanted it.
   */
  public override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    guard let hit = super.hitTest(point, with: event) else {
      return nil
    }
    if isExpanded {
      return hit
    }
    return hit === self ? nil : hit
  }

  /**
   Distance from the bottom edge that the panel has to clear to sit above the
   tab bar.

   The safe area is a floor rather than an addend, for the reason spelled out on
   `updateBottomConstraints`.
   */
  private var tabBarClearance: CGFloat {
    max(bottomInset, safeAreaInsets.bottom + DockLayout.bottomGap)
  }

  // MARK: - Accessibility

  public override func accessibilityPerformEscape() -> Bool {
    guard isExpanded else {
      return false
    }
    onDismissRequest(["reason": "escape"])
    return true
  }

  // MARK: - Layout

  public override func safeAreaInsetsDidChange() {
    super.safeAreaInsetsDidChange()
    updateBottomConstraints()
  }

  /**
   Positions the panel above the tab bar.

   `bottomInset` is measured from the bottom of the *screen*, not from the safe
   area, and is anchored to this view's own bottom edge for that reason — the
   view is mounted edge to edge, so the two coincide. Adding
   `safeAreaInsets.bottom` on top would double-count the home indicator, which is
   exactly the trap `navigation-dock-metrics.ts` documents: on iOS 26 the
   floating tab bar is already inset within the safe area, so the measured
   constant React sends already contains it.

   The safe area is still consulted, as a **floor** rather than an addend, so a
   small inset cannot push the panel down over the home indicator.
   */
  private func updateBottomConstraints() {
    panelBottomConstraint?.constant = -(tabBarClearance + DockLayout.surfaceGap)
  }

  // MARK: - Props

  internal func setActions(_ next: [DockAction]) {
    // The grid contract is "at most nine, three per row". Extras are dropped
    // instead of silently laid out into a row the visual spec does not define.
    let clamped = Array(next.prefix(DockLayout.maximumActions))
    guard clamped != actions else {
      return
    }
    actions = clamped
    needsActionRebuild = true
  }

  internal func setExpanded(_ next: Bool) {
    guard next != isExpanded else {
      return
    }
    isExpanded = next
    needsExpansionUpdate = true
  }

  internal func setReduceMotion(_ next: Bool) {
    reduceMotion = next
  }

  internal func setBottomInset(_ next: CGFloat) {
    guard next != bottomInset else {
      return
    }
    bottomInset = next
    updateBottomConstraints()
  }

  internal func setColorScheme(_ next: NavigationDockColorScheme?) {
    overrideUserInterfaceStyle = next?.userInterfaceStyle ?? .unspecified
  }

  /**
   Applies everything the prop setters marked dirty, once per React commit.

   The setters only record intent, so a commit that changes both the action list
   and the expanded state rebuilds the grid before animating it in rather than
   animating a panel that is still showing the previous actions.
   */
  internal func didUpdateProps() {
    if needsActionRebuild {
      needsActionRebuild = false
      rebuildActions()
    }
    if needsExpansionUpdate {
      needsExpansionUpdate = false
      applyExpansion(animated: hasAppliedProps)
    }
    hasAppliedProps = true
  }

  // MARK: - View construction

  private func setUpBackdrop() {
    backdrop.translatesAutoresizingMaskIntoConstraints = false
    // Explicit rather than relying on the default: this view is deliberately
    // invisible, and a reader finding no `backgroundColor` would reasonably
    // assume someone forgot to set one.
    backdrop.backgroundColor = .clear
    backdrop.isHidden = true
    backdrop.addGestureRecognizer(
      UITapGestureRecognizer(target: self, action: #selector(handleBackdropTap))
    )
    // Left out of the accessibility tree on purpose. A VoiceOver user dismisses
    // with the escape gesture or the Create item, which announces as "Close"; a
    // full-screen "Dismiss" element would sit in front of the panel and be the
    // first thing swiped to.
    backdrop.accessibilityElementsHidden = true
    addSubview(backdrop)
  }

  private func setUpPanel() {
    /*
     No starting `alpha` here: `applyExpansion(animated: false)` runs at the end
     of `init` and sets it, along with the transform and the material, through
     the same frame path every later change uses. One place decides what
     collapsed looks like.

     `isHidden` brackets the presentation on top of that, so a collapsed panel is
     out of the touch and accessibility trees rather than merely transparent.
    */
    panel.isHidden = true
    addSubview(panel)

    panelScrollView.translatesAutoresizingMaskIntoConstraints = false
    panelScrollView.contentInsetAdjustmentBehavior = .never
    panelScrollView.alwaysBounceVertical = false
    panel.contentView.addSubview(panelScrollView)

    actionsStack.translatesAutoresizingMaskIntoConstraints = false
    actionsStack.axis = .vertical
    actionsStack.spacing = DockLayout.actionRowSpacing
    actionsStack.alignment = .fill
    panelScrollView.addSubview(actionsStack)
  }

  private func setUpConstraints() {
    let panelBottom = panel.bottomAnchor.constraint(equalTo: bottomAnchor)
    panelBottomConstraint = panelBottom

    let panelHug = panelScrollView.heightAnchor.constraint(equalTo: actionsStack.heightAnchor)
    // The card sizes to its content until the content no longer fits between
    // the tab bar and the top safe area; then the required top inequality wins
    // and the grid scrolls instead of being clipped. Nine actions at an
    // accessibility text size is exactly that case.
    panelHug.priority = .defaultHigh

    NSLayoutConstraint.activate([
      backdrop.topAnchor.constraint(equalTo: topAnchor),
      backdrop.bottomAnchor.constraint(equalTo: bottomAnchor),
      backdrop.leadingAnchor.constraint(equalTo: leadingAnchor),
      backdrop.trailingAnchor.constraint(equalTo: trailingAnchor),

      panel.leadingAnchor.constraint(
        equalTo: safeAreaLayoutGuide.leadingAnchor,
        constant: DockLayout.horizontalMargin
      ),
      panel.trailingAnchor.constraint(
        equalTo: safeAreaLayoutGuide.trailingAnchor,
        constant: -DockLayout.horizontalMargin
      ),
      panelBottom,
      panel.topAnchor.constraint(
        greaterThanOrEqualTo: safeAreaLayoutGuide.topAnchor,
        constant: DockLayout.surfaceGap
      ),

      panelScrollView.topAnchor.constraint(
        equalTo: panel.contentView.topAnchor,
        constant: DockLayout.panelVerticalPadding
      ),
      panelScrollView.bottomAnchor.constraint(
        equalTo: panel.contentView.bottomAnchor,
        constant: -DockLayout.panelVerticalPadding
      ),
      panelScrollView.leadingAnchor.constraint(
        equalTo: panel.contentView.leadingAnchor,
        constant: DockLayout.panelHorizontalPadding
      ),
      panelScrollView.trailingAnchor.constraint(
        equalTo: panel.contentView.trailingAnchor,
        constant: -DockLayout.panelHorizontalPadding
      ),
      panelHug,

      actionsStack.topAnchor.constraint(equalTo: panelScrollView.contentLayoutGuide.topAnchor),
      actionsStack.bottomAnchor.constraint(equalTo: panelScrollView.contentLayoutGuide.bottomAnchor),
      actionsStack.leadingAnchor.constraint(
        equalTo: panelScrollView.contentLayoutGuide.leadingAnchor
      ),
      actionsStack.trailingAnchor.constraint(
        equalTo: panelScrollView.contentLayoutGuide.trailingAnchor
      ),
      actionsStack.widthAnchor.constraint(equalTo: panelScrollView.frameLayoutGuide.widthAnchor),
    ])

    updateBottomConstraints()
  }

  // MARK: - Rebuilding from descriptors

  private func rebuildActions() {
    for row in actionsStack.arrangedSubviews {
      actionsStack.removeArrangedSubview(row)
      row.removeFromSuperview()
    }

    actionControls = actions.map { action in
      let control = DockActionControl(action: action)
      control.addTarget(self, action: #selector(handleActionTap(_:)), for: .touchUpInside)
      return control
    }

    for start in stride(from: 0, to: actionControls.count, by: DockLayout.actionsPerRow) {
      let end = min(start + DockLayout.actionsPerRow, actionControls.count)
      let row = UIStackView(arrangedSubviews: Array(actionControls[start..<end]))
      row.axis = .horizontal
      row.distribution = .fillEqually
      // Top alignment keeps the icon wells on one line when one label wraps to
      // two lines and its neighbours do not.
      row.alignment = .top
      row.spacing = DockLayout.actionColumnSpacing

      // A short final row still has to keep its columns under the rows above,
      // so it is padded with empty views rather than left to spread.
      for _ in (end - start)..<DockLayout.actionsPerRow {
        row.addArrangedSubview(UIView())
      }
      actionsStack.addArrangedSubview(row)
    }
  }

  // MARK: - Applying state

  /**
   Animates the panel, and brackets it with the backdrop's hidden state so the
   screen behind is blocked for the entire presentation rather than only once the
   panel has landed.
   */
  private func applyExpansion(animated: Bool) {
    let expanded = isExpanded

    // `accessibilityViewIsModal` is what takes the content behind out of
    // VoiceOver, and it now matches the touch behaviour exactly: expanded, the
    // whole background is unreachable both ways. It follows the state
    // immediately rather than the animation, because the background must stop
    // being reachable the moment the panel is requested, not when it finishes
    // arriving. A VoiceOver user dismisses with the escape gesture, which
    // `accessibilityPerformEscape` handles.
    accessibilityViewIsModal = expanded

    if expanded {
      panel.isHidden = false
      backdrop.isHidden = false
      // Material up before the fade rather than after it, so the glass has
      // something to fade in. Collapse tears it down in `finishExpansion`
      // instead, once the panel is off screen.
      panel.setMaterialVisible(true)
    }

    guard animated else {
      animator.set(expanded: expanded)
      return
    }

    animator.animate(expanded: expanded, reduceMotion: reduceMotion)
  }

  /**
   Applies one animation frame.

   Both assignments are **direct**, outside any animation block, which is the
   entire point — `DockPanelAnimator` explains why a `CAAnimation` here doubles
   the panel's glass shadow. UIView-backed layers raise no implicit animation for
   a direct set, so each frame is a discrete model change.
   */
  private func applyAnimationFrame(slide: CGFloat, fade: CGFloat) {
    // Translation, never scale: `DockLayout.panelCollapsedOffset` carries the
    // argument for why a glass surface cannot be scaled without its shadow
    // detaching from it. `slide` overshoots past 1 on the settle, which is what
    // carries the offset a little past its resting position and back.
    panel.transform = CGAffineTransform(
      translationX: 0,
      y: (1 - slide) * DockLayout.panelCollapsedOffset
    )
    panel.alpha = fade
  }

  /**
   The teardown that must not happen early.

   Runs when the spring has settled and the fade has landed — not on a retarget,
   so a panel reversed mid-flight by a second tap does not tear its own material
   down underneath itself.
   */
  private func finishExpansion() {
    guard !isExpanded else {
      // The first action, not the card: a container argument makes VoiceOver
      // pick its own starting element, which lands on the scroll view.
      UIAccessibility.post(
        notification: .layoutChanged,
        argument: actionControls.first ?? panel
      )
      return
    }

    panel.isHidden = true
    backdrop.isHidden = true
    panel.setMaterialVisible(false)
    // Focus goes back to the screen rather than to a specific control: the
    // Create button belongs to the tab bar now, and this view has no reference
    // to it to hand VoiceOver. A `nil` argument asks UIKit to re-read the
    // screen, which lands on the tab bar. Skipped during construction, where
    // nothing was dismissed and stealing focus would interrupt the user.
    if hasAppliedProps {
      UIAccessibility.post(notification: .layoutChanged, argument: nil)
    }
  }

  // MARK: - Interaction

  @objc
  private func handleBackdropTap() {
    onDismissRequest(["reason": "backdrop"])
  }

  @objc
  private func handleActionTap(_ sender: DockActionControl) {
    guard sender.action.enabled else {
      return
    }
    onActionPress(["id": sender.action.id])
  }
}
