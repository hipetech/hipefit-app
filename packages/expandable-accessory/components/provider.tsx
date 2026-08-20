import type {
  AccessoryContentProps,
  ExpandableAccessoryContextValue,
  ExpandableAccessoryProviderProps,
  ExpandedContentProps,
} from '../types';
import type { ReactNode } from 'react';
import { Children, isValidElement, useEffect } from 'react';
import { router, usePathname } from 'expo-router';

import { ExpandableAccessoryContext } from '../context';
import { normalizePath } from '../helpers/normalize-path';
import { AccessoryContent } from './accessory-content';
import { ExpandedContent } from './expanded-content';

/**
 * Registers compact and expanded slots above the navigation tree, then exposes
 * them to outlets mounted on opposite sides of an Expo Router Stack boundary.
 */
export const ExpandableAccessoryProvider: React.FC<
  ExpandableAccessoryProviderProps
> = ({ active, href, expandedPath, fallbackHref, children }) => {
  const pathname = usePathname();
  const routeIsExpanded =
    normalizePath(pathname) === normalizePath(expandedPath);
  const navigationChildren: ReactNode[] = [];
  let accessoryContent: ReactNode = null;
  let expandedContent: ReactNode = null;

  Children.forEach(children, (child) => {
    if (
      isValidElement<AccessoryContentProps>(child) &&
      child.type === AccessoryContent
    ) {
      accessoryContent = child.props.children;
      return;
    }

    if (
      isValidElement<ExpandedContentProps>(child) &&
      child.type === ExpandedContent
    ) {
      expandedContent = child.props.children;
      return;
    }

    navigationChildren.push(child);
  });

  useEffect(() => {
    if (!active && routeIsExpanded) {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace(fallbackHref);
      }
    }
  }, [active, fallbackHref, routeIsExpanded]);

  const value: ExpandableAccessoryContextValue = {
    isActive: active,
    isExpanded: active && routeIsExpanded,
    href,
    accessoryContent,
    expandedContent,
    open: () => {
      if (active) {
        router.push(href);
      }
    },
    close: () => {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace(fallbackHref);
      }
    },
  };

  return (
    <ExpandableAccessoryContext.Provider value={value}>
      {navigationChildren}
    </ExpandableAccessoryContext.Provider>
  );
};
