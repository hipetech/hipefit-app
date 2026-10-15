import { ExpandableAccessory } from '@hipefit/expandable-accessory';

/**
 * The workout template editor route, presented as a page sheet (`modal`) from the
 * root layout. It renders only the package's outlet, which shows the editor
 * registered by `WorkoutTemplateExpandable`. The editor declares its own
 * title and toolbar because Cancel and Save depend on its state.
 */
export default function WorkoutTemplateRoute() {
  return <ExpandableAccessory.ExpandedOutlet />;
}
