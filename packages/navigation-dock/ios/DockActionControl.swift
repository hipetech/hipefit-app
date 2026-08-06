import UIKit

/**
 One cell of the expanded action grid: a circular icon well with a centered
 label beneath it, wrapping to two lines.

 Disabled is `isEnabled = false` rather than `isUserInteractionEnabled = false`:
 the contract says a disabled action swallows its touch, and a disabled
 `UIControl` is hit-tested but fires no action, whereas turning off user
 interaction would drop the touch through to the panel behind it. The dimming is
 semantic (`tertiaryLabel` over `quaternarySystemFill`) rather than a blanket
 alpha, so Increase Contrast still has something to work with.
 */
internal final class DockActionControl: UIControl {
  internal let action: DockAction

  private let well = UIView()
  private let glyphView: UIImageView
  private let titleLabel = UILabel()

  override var isHighlighted: Bool {
    didSet { alpha = isHighlighted ? DockLayout.pressedAlpha : 1 }
  }

  internal init(action: DockAction) {
    self.action = action
    self.glyphView = DockSymbol.imageView(action.systemImage, textStyle: .title3)
    super.init(frame: .zero)

    translatesAutoresizingMaskIntoConstraints = false

    well.translatesAutoresizingMaskIntoConstraints = false
    well.isUserInteractionEnabled = false

    titleLabel.translatesAutoresizingMaskIntoConstraints = false
    titleLabel.text = action.label
    // Semibold, and built from the *preferred* descriptor rather than
    // `systemFont(ofSize:weight:)`, which would pin the size and stop scaling.
    // Adding a weight to the resolved descriptor keeps the text style's Dynamic
    // Type size and lets `adjustsFontForContentSizeCategory` keep updating it.
    titleLabel.font = DockTypography.actionLabel()
    titleLabel.adjustsFontForContentSizeCategory = true
    titleLabel.textAlignment = .center
    titleLabel.numberOfLines = 2
    titleLabel.lineBreakMode = .byTruncatingTail

    addSubview(well)
    well.addSubview(glyphView)
    addSubview(titleLabel)

    NSLayoutConstraint.activate([
      well.topAnchor.constraint(equalTo: topAnchor),
      well.centerXAnchor.constraint(equalTo: centerXAnchor),
      well.widthAnchor.constraint(equalTo: well.heightAnchor),
      // Derived from the glyph so the whole cell scales with Dynamic Type.
      well.heightAnchor.constraint(
        equalTo: glyphView.heightAnchor,
        constant: DockLayout.actionWellPadding * 2
      ),
      well.leadingAnchor.constraint(greaterThanOrEqualTo: leadingAnchor),
      well.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor),

      glyphView.centerXAnchor.constraint(equalTo: well.centerXAnchor),
      glyphView.centerYAnchor.constraint(equalTo: well.centerYAnchor),

      titleLabel.topAnchor.constraint(
        equalTo: well.bottomAnchor,
        constant: DockLayout.actionLabelSpacing
      ),
      titleLabel.leadingAnchor.constraint(equalTo: leadingAnchor),
      titleLabel.trailingAnchor.constraint(equalTo: trailingAnchor),
      titleLabel.bottomAnchor.constraint(equalTo: bottomAnchor),

      widthAnchor.constraint(greaterThanOrEqualToConstant: DockLayout.minimumHitTarget),
      heightAnchor.constraint(greaterThanOrEqualToConstant: DockLayout.minimumHitTarget),
    ])

    isEnabled = action.enabled
    well.backgroundColor = action.enabled ? .secondarySystemFill : .quaternarySystemFill
    glyphView.tintColor = action.enabled ? .label : .tertiaryLabel
    titleLabel.textColor = action.enabled ? .label : .tertiaryLabel

    isAccessibilityElement = true
    accessibilityLabel = action.label
    accessibilityIdentifier = "navigation-dock-action-\(action.id)"
    accessibilityTraits = action.enabled ? [.button] : [.button, .notEnabled]
  }

  @available(*, unavailable)
  internal required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    well.layer.cornerRadius = well.bounds.height / 2
  }
}

