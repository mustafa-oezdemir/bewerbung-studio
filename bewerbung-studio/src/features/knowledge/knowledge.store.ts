export const moveKnowledgeEntry = <T extends { id: string; sortOrder: number }>(
  entries: T[],
  sourceId: string,
  targetId: string,
) => {
  const source = entries.findIndex((entry) => entry.id === sourceId);
  const target = entries.findIndex((entry) => entry.id === targetId);
  if (source < 0 || target < 0 || source === target) return entries;
  const next = [...entries];
  const [moved] = next.splice(source, 1);
  next.splice(target, 0, moved);
  return next.map((entry, sortOrder) => ({ ...entry, sortOrder }));
};

export const normalizeKnowledgeOrder = <
  T extends { sortOrder: number },
>(
  entries: T[],
) =>
  [...entries]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((entry, sortOrder) => ({ ...entry, sortOrder }));

