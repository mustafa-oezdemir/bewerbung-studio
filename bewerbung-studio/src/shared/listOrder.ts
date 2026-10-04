export const moveListItem = <T>(
  items: readonly T[],
  from: number,
  to: number,
): T[] => {
  const next = [...items];
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to < 0 ||
    from >= items.length ||
    to >= items.length ||
    from === to
  )
    return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};
