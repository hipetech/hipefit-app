import ExpoModulesCore

/**
 Registers the Create overlay view.

 The names below are the frozen bridge contract
 (`docs/plans/native-navigation-dock/reference/bridge-contract.md`, as revised)
 and are mirrored one-for-one in `packages/navigation-dock/index.ts`.
 Renaming anything here without renaming it there **fails silently**: an unknown
 prop is dropped by `ExpoFabricView.updateProps` and an unknown event never
 reaches JS.

 No `Function`s or `AsyncFunction`s on purpose — no imperative surface means no
 second source of truth for expanded state.
 */
public final class HipefitNavigationDockModule: Module {
  public func definition() -> ModuleDefinition {
    Name("HipefitNavigationDock")

    View(NavigationDockView.self) {
      Events(
        "onDismissRequest",
        "onActionPress"
      )

      Prop("expanded") { (view: NavigationDockView, expanded: Bool) in
        view.setExpanded(expanded)
      }

      Prop("actions") { (view: NavigationDockView, actions: [NavigationDockActionRecord]) in
        view.setActions(actions.map(DockAction.init(record:)))
      }

      // Supplied by React; `NavigationDockView` carries the reasoning and the
      // double-counting trap.
      Prop("bottomInset") { (view: NavigationDockView, bottomInset: Double) in
        view.setBottomInset(CGFloat(bottomInset))
      }

      Prop("reduceMotion") { (view: NavigationDockView, reduceMotion: Bool) in
        view.setReduceMotion(reduceMotion)
      }

      Prop("colorScheme") { (view: NavigationDockView, colorScheme: NavigationDockColorScheme?) in
        view.setColorScheme(colorScheme)
      }

      // Every setter above only records what changed. This is where a commit is
      // applied as one unit, so the view never renders a half-updated frame
      // built from some new props and some old ones.
      OnViewDidUpdateProps { (view: NavigationDockView) in
        view.didUpdateProps()
      }
    }
  }
}

