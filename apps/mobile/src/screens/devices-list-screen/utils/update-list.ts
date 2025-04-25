export function updateList<T extends { id: string }>(list: T[], item: T): T[] {
  const index = list.findIndex((i) => i.id === item.id);

  if (index !== -1) {
    const updatedList = [...list];
    updatedList[index] = item;
    return updatedList;
  }

  return [...list, item];
}
