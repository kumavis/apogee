import { AutomergeUrl, DocHandle, Repo } from "@automerge/react";

export type GameDoc = {
  createdAt: number;
  players: AutomergeUrl[];
};

export const create = (repo: Repo, initialState?: Partial<GameDoc>): DocHandle<GameDoc> => {
  const gameData = {
    createdAt: Date.now(),
    players: [],
    ...initialState
  };
  const handle = repo.create<GameDoc>(gameData);
  return handle;
};
