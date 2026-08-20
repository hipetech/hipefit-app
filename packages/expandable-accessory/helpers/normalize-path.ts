/** Normalize a concrete pathname for route-focus comparison. */
export const normalizePath = (path: string): string => {
  const withoutQuery = path.replace(/[?#].*$/, '');
  return withoutQuery.length > 1
    ? withoutQuery.replace(/\/+$/, '')
    : withoutQuery;
};
