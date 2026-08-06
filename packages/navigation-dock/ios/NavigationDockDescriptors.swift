import ExpoModulesCore
import UIKit

/**
 The bridge-facing shape of an action descriptor.

 The record and the value type below are deliberately separate. A `Record`'s
 `@Field` wrappers are not `Equatable`, and the view needs equality to answer
 "did this prop actually change?" without rebuilding the grid on every React
 render. So props are decoded into records, then immediately mapped to the plain
 struct the view stores and compares.
 */
internal struct NavigationDockActionRecord: Record {
  @Field var id: String = ""
  @Field var label: String = ""
  @Field var systemImage: String = ""
  @Field var enabled: Bool = false
}

/**
 `colorScheme: 'light' | 'dark' | null`. The optional prop carries "follow the
 device", so there is no `system` case to keep in sync with the TypeScript union.
 */
internal enum NavigationDockColorScheme: String, Enumerable {
  case light
  case dark

  var userInterfaceStyle: UIUserInterfaceStyle {
    switch self {
    case .light: return .light
    case .dark: return .dark
    }
  }
}

internal struct DockAction: Equatable {
  let id: String
  let label: String
  let systemImage: String
  let enabled: Bool

  init(record: NavigationDockActionRecord) {
    id = record.id
    label = record.label
    systemImage = record.systemImage
    enabled = record.enabled
  }
}

