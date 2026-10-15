import type { ExpandedPresentation } from '@hipefit/expandable-accessory';
import type React from 'react';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { ExpandableAccessory } from '@hipefit/expandable-accessory';

import { useAuthStore } from '@/stores/use-auth-store';
import { useWorkoutTemplateDraftStore } from '@/stores/use-workout-template-draft-store';

import { WorkoutTemplateAccessory } from './workout-template-accessory';
import { WorkoutTemplateEditor } from './workout-template-editor';

/**
 * How the template editor is presented. The root layout registers the
 * `workout-template` route with the same value. `fullScreen` pushes it, zooming
 * out of the pill and swiping down to zoom back; a page sheet swipes down to
 * minimize from either entry point.
 */
export const WORKOUT_TEMPLATE_PRESENTATION: ExpandedPresentation = 'pageSheet';

export interface WorkoutTemplateExpandableProps {
  /** The navigation tree: the root `Stack`, which holds the tabs and the editor route. */
  children: ReactNode;
}

/**
 * Registers the template draft with `@hipefit/expandable-accessory`: the pill
 * for the tab bar's bottom accessory and the editor for the
 * `/workout-template` route. The root layout wraps its `Stack` in this,
 * because the provider must sit above both the tab navigator and the expanded
 * route, and the two slots must be its direct children.
 *
 * The provider is active while the user is signed in and a draft exists.
 * When it turns inactive with the editor focused, after Save, Cancel, or a
 * sign-out, the provider pops the route, so none of them navigates. The
 * `/` fallback covers an editor opened with no history to go back to.
 *
 * Signing out discards the draft. The guard alone would hide the pill, but
 * the draft would survive in memory and reappear for the next user to sign in.
 */
export const WorkoutTemplateExpandable: React.FC<
  WorkoutTemplateExpandableProps
> = ({ children }) => {
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const hasDraft = useWorkoutTemplateDraftStore(
    (state) => state.draft !== null
  );
  const discard = useWorkoutTemplateDraftStore((state) => state.discard);

  // A subscription rather than an effect on `isLoggedIn`, as in
  // `navigation-dock.tsx`: the session ending is an event, and the root layout
  // unmounts this component while auth is loading, so an effect could miss it.
  useEffect(
    () =>
      useAuthStore.subscribe((state, previousState) => {
        if (previousState.isLoggedIn && !state.isLoggedIn) {
          discard();
        }
      }),
    [discard]
  );

  return (
    <ExpandableAccessory.Provider
      active={isLoggedIn && hasDraft}
      href="/workout-template"
      presentation={WORKOUT_TEMPLATE_PRESENTATION}
      expandedPath="/workout-template"
      fallbackHref="/"
    >
      <ExpandableAccessory.AccessoryContent>
        <WorkoutTemplateAccessory />
      </ExpandableAccessory.AccessoryContent>
      <ExpandableAccessory.ExpandedContent>
        <WorkoutTemplateEditor />
      </ExpandableAccessory.ExpandedContent>
      {children}
    </ExpandableAccessory.Provider>
  );
};
