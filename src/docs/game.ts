import { AutomergeUrl, DocHandle, Repo } from "@automerge/react";
import { CARD_LIBRARY } from "../utils/cardLibrary";

export type CardType = 'creature' | 'spell' | 'artifact';

export type GameCard = {
  id: string;
  name: string;
  cost: number;
  attack?: number;
  health?: number;
  type: CardType;
  description: string;
};

export type PlayerHand = {
  playerId: AutomergeUrl;
  cards: string[]; // Array of card IDs
};

export type GameDoc = {
  createdAt: number;
  players: AutomergeUrl[];
  status: 'waiting' | 'playing' | 'finished';
  
  // Game state
  deck: string[]; // Array of card IDs in deck
  playerHands: PlayerHand[];
  currentPlayerIndex: number;
  turn: number;
  
  // Card definitions (shared by all players)
  cardLibrary: { [cardId: string]: GameCard };
};

export const create = (repo: Repo, initialState?: Partial<GameDoc>): DocHandle<GameDoc> => {
  const gameData = {
    createdAt: Date.now(),
    players: [],
    status: 'waiting' as const,
    deck: [],
    playerHands: [],
    currentPlayerIndex: 0,
    turn: 0,
    cardLibrary: CARD_LIBRARY,
    ...initialState
  };
  const handle = repo.create<GameDoc>(gameData);
  return handle;
};
