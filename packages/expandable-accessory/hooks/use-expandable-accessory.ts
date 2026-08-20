import type { ExpandableAccessoryContextValue } from '../types';
import { useContext } from 'react';

import { ExpandableAccessoryContext } from '../context';

/** Read controlled activity, route expansion, and navigation actions. */
export const useExpandableAccessory = (): ExpandableAccessoryContextValue => {
  const value = useContext(ExpandableAccessoryContext);

  if (value == null) {
    throw new Error(
      'useExpandableAccessory must be used within ExpandableAccessory.Provider.'
    );
  }

  return value;
};
