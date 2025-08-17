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

export type PlayerBattlefield = {
  playerId: AutomergeUrl;
  cards: string[]; // Array of card IDs on battlefield
};

export type GameLogEntry = {
  id: string;
  playerId: AutomergeUrl;
  action: 'play_card' | 'end_turn' | 'draw_card' | 'game_start';
  cardId?: string;
  timestamp: number;
  description: string;
};

export type PlayerState = {
  playerId: AutomergeUrl;
  energy: number;
  maxEnergy: number;
};

export type GameDoc = {
  createdAt: number;
  players: AutomergeUrl[];
  status: 'waiting' | 'playing' | 'finished';
  
  // Game state
  deck: string[]; // Array of card IDs in deck
  playerHands: PlayerHand[];
  playerBattlefields: PlayerBattlefield[];
  playerStates: PlayerState[];
  graveyard: string[]; // Array of card IDs in graveyard
  currentPlayerIndex: number;
  turn: number;
  gameLog: GameLogEntry[];
  
  // Card definitions (shared by all players)
  cardLibrary: { [cardId: string]: GameCard };
};

// Helper functions for game state mutations
export const removeCardFromHand = (doc: GameDoc, playerId: AutomergeUrl, cardId: string): boolean => {
  const playerHandIndex = doc.playerHands.findIndex(hand => hand.playerId === playerId);
  if (playerHandIndex === -1) {
    console.error(`removeCardFromHand: Player hand not found for playerId: ${playerId}`);
    return false;
  }
  
  const cardIndex = doc.playerHands[playerHandIndex].cards.indexOf(cardId);
  if (cardIndex === -1) {
    console.error(`removeCardFromHand: Card ${cardId} not found in player ${playerId}'s hand`);
    return false;
  }
  
  doc.playerHands[playerHandIndex].cards.splice(cardIndex, 1);
  return true;
};

export const addCardToBattlefield = (doc: GameDoc, playerId: AutomergeUrl, cardId: string): boolean => {
  const battlefieldIndex = doc.playerBattlefields.findIndex(battlefield => battlefield.playerId === playerId);
  if (battlefieldIndex === -1) {
    console.error(`addCardToBattlefield: Battlefield not found for playerId: ${playerId}`);
    return false;
  }
  
  doc.playerBattlefields[battlefieldIndex].cards.push(cardId);
  return true;
};

export const addCardToGraveyard = (doc: GameDoc, cardId: string): void => {
  doc.graveyard.push(cardId);
};

export const spendEnergy = (doc: GameDoc, playerId: AutomergeUrl, amount: number): boolean => {
  const playerStateIndex = doc.playerStates.findIndex(state => state.playerId === playerId);
  if (playerStateIndex === -1) {
    console.error(`spendEnergy: Player state not found for playerId: ${playerId}`);
    return false;
  }
  
  const playerState = doc.playerStates[playerStateIndex];
  if (playerState.energy < amount) {
    console.error(`spendEnergy: Insufficient energy for player ${playerId}. Required: ${amount}, Available: ${playerState.energy}`);
    return false;
  }
  
  playerState.energy -= amount;
  return true;
};

export const restoreEnergy = (doc: GameDoc, playerId: AutomergeUrl): boolean => {
  const playerStateIndex = doc.playerStates.findIndex(state => state.playerId === playerId);
  if (playerStateIndex === -1) {
    console.error(`restoreEnergy: Player state not found for playerId: ${playerId}`);
    return false;
  }
  
  doc.playerStates[playerStateIndex].energy = doc.playerStates[playerStateIndex].maxEnergy;
  return true;
};

export const increaseMaxEnergy = (doc: GameDoc, playerId: AutomergeUrl, maxEnergyCap: number = 10): boolean => {
  const playerStateIndex = doc.playerStates.findIndex(state => state.playerId === playerId);
  if (playerStateIndex === -1) {
    console.error(`increaseMaxEnergy: Player state not found for playerId: ${playerId}`);
    return false;
  }
  
  const playerState = doc.playerStates[playerStateIndex];
  if (playerState.maxEnergy < maxEnergyCap) {
    playerState.maxEnergy += 1;
  }
  return true;
};

export const advanceToNextPlayer = (doc: GameDoc): number => {
  const nextPlayerIndex = (doc.currentPlayerIndex + 1) % doc.players.length;
  doc.currentPlayerIndex = nextPlayerIndex;
  return nextPlayerIndex;
};

export const incrementTurn = (doc: GameDoc): void => {
  doc.turn += 1;
};

export const addGameLogEntry = (doc: GameDoc, entry: Omit<GameLogEntry, 'id' | 'timestamp'>): void => {
  const logEntry: GameLogEntry = {
    id: `log_${Date.now()}_${Math.random()}`,
    timestamp: Date.now(),
    ...entry
  };
  doc.gameLog.push(logEntry);
};

export const playCard = (doc: GameDoc, playerId: AutomergeUrl, cardId: string): boolean => {
  const card = doc.cardLibrary[cardId];
  if (!card) {
    console.error(`playCard: Card not found in library: ${cardId}`);
    return false;
  }

  // Remove card from hand
  if (!removeCardFromHand(doc, playerId, cardId)) {
    console.error(`playCard: Failed to remove card ${cardId} from player ${playerId}'s hand`);
    return false;
  }

  // Spend energy
  if (!spendEnergy(doc, playerId, card.cost)) {
    console.error(`playCard: Failed to spend energy for card ${cardId} (cost: ${card.cost}) for player ${playerId}`);
    // Try to add the card back to hand since we couldn't spend energy
    const playerHandIndex = doc.playerHands.findIndex(hand => hand.playerId === playerId);
    if (playerHandIndex !== -1) {
      doc.playerHands[playerHandIndex].cards.push(cardId);
      console.warn(`playCard: Restored card ${cardId} to player ${playerId}'s hand after energy failure`);
    }
    return false;
  }

  // Handle card based on type
  if (card.type === 'creature' || card.type === 'artifact') {
    if (!addCardToBattlefield(doc, playerId, cardId)) {
      console.error(`playCard: Failed to add card ${cardId} to battlefield for player ${playerId}`);
      return false;
    }
  } else {
    addCardToGraveyard(doc, cardId);
  }

  // Add to game log
  addGameLogEntry(doc, {
    playerId,
    action: 'play_card',
    cardId,
    description: `Played ${card.name}`
  });

  return true;
};

export const endPlayerTurn = (doc: GameDoc, playerId: AutomergeUrl): void => {
  const nextPlayerIndex = advanceToNextPlayer(doc);
  
  // If we've gone through all players, increment turn and increase max energy
  if (nextPlayerIndex === 0) {
    incrementTurn(doc);
    
    // Increase max energy for all players and restore their energy
    doc.playerStates.forEach(playerState => {
      increaseMaxEnergy(doc, playerState.playerId);
      restoreEnergy(doc, playerState.playerId);
    });
  } else {
    // Restore energy for the next player only
    const nextPlayerId = doc.players[nextPlayerIndex];
    restoreEnergy(doc, nextPlayerId);
  }
  
  // Add to game log
  addGameLogEntry(doc, {
    playerId,
    action: 'end_turn',
    description: 'Ended turn'
  });
};

export const initializeGame = (doc: GameDoc, shuffledDeck: string[]): void => {
  const playerHands: PlayerHand[] = [];
  const playerBattlefields: PlayerBattlefield[] = [];
  const playerStates: PlayerState[] = [];
  let currentDeck = [...shuffledDeck];
  
  // Deal 5 cards to each player and initialize their state
  doc.players.forEach((playerId) => {
    // Draw 5 cards for this player (simple implementation here)
    const drawnCards = currentDeck.splice(0, 5);
    
    playerHands.push({
      playerId,
      cards: drawnCards
    });
    playerBattlefields.push({
      playerId,
      cards: []
    });
    playerStates.push({
      playerId,
      energy: 2, // Starting energy
      maxEnergy: 2 // Starting max energy
    });
  });
  
  // Update the game document
  doc.status = 'playing';
  doc.deck = currentDeck;
  doc.playerHands = playerHands;
  doc.playerBattlefields = playerBattlefields;
  doc.playerStates = playerStates;
  doc.graveyard = [];
  doc.currentPlayerIndex = 0;
  doc.turn = 1;
  
  // Add initial game log entry
  addGameLogEntry(doc, {
    playerId: doc.players[0], // Use first player as game starter
    action: 'game_start',
    description: 'Game started'
  });
};

export const create = (repo: Repo, initialState?: Partial<GameDoc>): DocHandle<GameDoc> => {
  const gameData = {
    createdAt: Date.now(),
    players: [],
    status: 'waiting' as const,
    deck: [],
    playerHands: [],
    playerBattlefields: [],
    playerStates: [],
    graveyard: [],
    currentPlayerIndex: 0,
    turn: 0,
    gameLog: [],
    cardLibrary: CARD_LIBRARY,
    ...initialState
  };
  const handle = repo.create<GameDoc>(gameData);
  return handle;
};
