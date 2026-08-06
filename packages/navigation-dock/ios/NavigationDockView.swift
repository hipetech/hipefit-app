import ExpoModulesCore
import SwiftUI
import UIKit

/**
 The Create action panel and the invisible scrim behind it.

 It draws no tabs and no button — all five bottom items are real `UITabBar`
 items, Create being a `role="search"` trigger (`app/(private)/_layout.tsx`).
 This is a sibling overlay above all of that and knows nothing about tab
 selection.

 **UIKit rather than a `UIHostingController`** because it must pass touches
 through everywhere it is not drawing, which means owning `hitTest`; a hosting
 view answers for its whole frame. The glass alone is SwiftUI — see
 `DockGlassSurface`.

 **`bottomInset` arrives as a prop** because a sibling overlay cannot measure the
 system tab bar through public API. Do not search the hierarchy for a `UITabBar`
 instead: binding to another library's private view tree turns a patch upgrade of
 `react-native-screens` into a navigation outage.

 React owns `expanded`; nothing here mutates it.
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
  /// Deliberately unclipped: the glass shadow behind it is drawn outside the
  /// card's bounds, and `clipsToBounds` would cut it off. The grid does not need
  /// the clip either — it is inset by the card's padding.
  private let panel = UIView()
  private let glassModel = DockGlassModel()
  /// `lazy` only because it reads `glassModel`; it is built once, in `init`.
  private lazy var glassHost = UIHostingController(
    rootView: DockGlassSurface(model: glassModel)
  )
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

    applyExpansion(animated: false)
  }

  // MARK: - Hit testing

  /**
   Collapsed, the overlay is a hole in the touch layer; expanded, it captures the
   whole screen — tab bar included, so a tap outside the card can only dismiss.

   `hit === self` is the pass-through rule: `super.hitTest` returns the deepest
   view that claims the point, and while collapsed both children are hidden, so a
   hit landing on `self` means nothing in the overlay wanted it.
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

  /// Adopts the hosting controller once there is a parent to adopt it into. The
  /// glass renders regardless, but without containment SwiftUI never receives
  /// trait updates — which is what carries `colorScheme` and Dynamic Type.
  public override func didMoveToWindow() {
    super.didMoveToWindow()

    guard window != nil, glassHost.parent == nil else {
      return
    }

    var responder: UIResponder? = next
    while let current = responder {
      if let controller = current as? UIViewController {
        controller.addChild(glassHost)
        glassHost.didMove(toParent: controller)
        return
      }
      responder = current.next
    }
  }

  public override func safeAreaInsetsDidChange() {
    super.safeAreaInsetsDidChange()
    updateBottomConstraints()
  }

  /**
   Positions the panel above the tab bar.

   `bottomInset` is measured from the bottom of the *screen* and anchored to this
   view's own bottom edge — the view is mounted edge to edge, so the two
   coincide. **Do not add `safeAreaInsets.bottom`**: on iOS 26 the floating tab
   bar is already inset within the safe area, so the measured constant contains
   it. The safe area is consulted as a floor rather than an addend.
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

  /// Applies everything the prop setters marked dirty, once per React commit, so
  /// a commit changing both the actions and the expanded state rebuilds the grid
  /// before animating it in rather than animating stale actions.
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
    // No starting alpha: `applyExpansion(animated: false)` at the end of `init`
    // sets both halves through the same path every later change uses. `isHidden`
    // brackets that, so a collapsed panel is out of the touch and accessibility
    // trees rather than merely transparent.
    panel.isHidden = true
    panel.translatesAutoresizingMaskIntoConstraints = false
    panel.backgroundColor = .clear
    panel.clipsToBounds = false
    addSubview(panel)

    // The glass is a sibling *behind* the grid, not a parent around it: the
    // doubled-shadow measurement implicates an animation on the glass layer or
    // any ancestor, so the grid may only keep fading while it is neither.
    glassHost.view.translatesAutoresizingMaskIntoConstraints = false
    glassHost.view.backgroundColor = .clear
    glassHost.view.isUserInteractionEnabled = false
    panel.addSubview(glassHost.view)

    panelScrollView.translatesAutoresizingMaskIntoConstraints = false
    panelScrollView.contentInsetAdjustmentBehavior = .never
    panelScrollView.alwaysBounceVertical = false
    panel.addSubview(panelScrollView)

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

      glassHost.view.topAnchor.constraint(equalTo: panel.topAnchor),
      glassHost.view.bottomAnchor.constraint(equalTo: panel.bottomAnchor),
      glassHost.view.leadingAnchor.constraint(equalTo: panel.leadingAnchor),
      glassHost.view.trailingAnchor.constraint(equalTo: panel.trailingAnchor),

      panelScrollView.topAnchor.constraint(
        equalTo: panel.topAnchor,
        constant: DockLayout.panelVerticalPadding
      ),
      panelScrollView.bottomAnchor.constraint(
        equalTo: panel.bottomAnchor,
        constant: -DockLayout.panelVerticalPadding
      ),
      panelScrollView.leadingAnchor.constraint(
        equalTo: panel.leadingAnchor,
        constant: DockLayout.panelHorizontalPadding
      ),
      panelScrollView.trailingAnchor.constraint(
        equalTo: panel.trailingAnchor,
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

    // Follows the state, not the animation: the background must stop being
    // reachable the moment the panel is requested, not when it lands.
    accessibilityViewIsModal = expanded

    if expanded {
      panel.isHidden = false
      backdrop.isHidden = false
    }

    // The glass fades itself, in SwiftUI — the one route that attaches no
    // `CAAnimation` to it. See `DockGlassSurface`.
    glassModel.reduceMotion = reduceMotion
    glassModel.isVisible = expanded

    guard animated else {
      panelScrollView.alpha = expanded ? 1 : 0
      finishExpansion()
      return
    }

    /*
     Only the grid, never the card: fading `panel` would put the animation on an
     ancestor of the glass and bring the doubled shadow back.

     `.beginFromCurrentState` retargets a mid-flight reversal from the opacity on
     screen. `.allowUserInteraction` keeps the card's controls live during the
     fade, so the first tap after it appears is not dropped.
    */
    UIView.animate(
      withDuration: reduceMotion
        ? DockLayout.reducedMotionDuration
        : DockLayout.expansionDuration,
      delay: 0,
      options: [.curveEaseInOut, .beginFromCurrentState, .allowUserInteraction],
      animations: { [weak self] in
        self?.panelScrollView.alpha = expanded ? 1 : 0
      },
      completion: { [weak self] finished in
        // `finished == false` means another `applyExpansion` interrupted this
        // one and owns the teardown now.
        guard finished else {
          return
        }
        self?.finishExpansion()
      }
    )
  }

  /// Runs only once the fade has landed, never from an interrupted animation, so
  /// a panel reversed mid-flight does not tear itself down under its replacement.
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
