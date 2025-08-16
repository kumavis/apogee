import { AutomergeUrl, DocHandle } from "@automerge/react";

export type GameDoc = {
  createdAt: number;
  players: AutomergeUrl[];
};

export const create = (handle: DocHandle<GameDoc>, initialState?: Partial<GameDoc>): void => {
  handle.update((doc) => {
    Object.assign(doc, initialState);
    return doc;
  });
};
