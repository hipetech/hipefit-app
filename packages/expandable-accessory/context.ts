import type { ExpandableAccessoryContextValue } from './types';
import { createContext } from 'react';

export const ExpandableAccessoryContext =
  createContext<ExpandableAccessoryContextValue | null>(null);
