import { AutomergeUrl, DocHandle, Repo } from "@automerge/react";

export type PlayerHand = {
  playerId: AutomergeUrl;
  cards: AutomergeUrl[]; // Array of card document URLs
};

export type BattlefieldCard = {
  instanceId: string; // Unique ID for this specific card instance
  cardUrl: AutomergeUrl; // Reference to card document URL
  sapped: boolean; // True if creature has attacked this turn
  currentHealth: number; // Current health of the creature/artifact
};

// Separate game state tracking for cards that doesn't duplicate card definition data
export type CardGameState = {
  cardUrl: AutomergeUrl;
  // Add any other game-specific state that needs to be tracked
  // e.g., temporary modifications, counters, etc.
};

export type PlayerBattlefield = {
  playerId: AutomergeUrl;
  cards: BattlefieldCard[]; // Array of battlefield cards with status
};

export type GameLogEntry = {
  id: string;
  playerId: AutomergeUrl;
  action: 'play_card' | 'end_turn' | 'draw_card' | 'game_start' | 'attack' | 'take_damage' | 'game_end';
  cardUrl?: AutomergeUrl; // Card document URL
  targetId?: AutomergeUrl; // For attacks/targeting
  amount?: number; // For damage/healing
  timestamp: number;
  description: string;
};

export type PlayerState = {
  playerId: AutomergeUrl;
  energy: number;
  maxEnergy: number;
  health: number;
  maxHealth: number;
};

export type GameDoc = {
  createdAt: number;
  players: AutomergeUrl[];
  status: 'waiting' | 'playing' | 'finished';
  
  // Deck selection - required before game can start, but can be null during lobby phase
  selectedDeckUrl: AutomergeUrl | null; // URL of the selected deck
  
  // Game state
  deck: AutomergeUrl[]; // Array of card document URLs in deck
  playerHands: PlayerHand[];
  playerBattlefields: PlayerBattlefield[];
  playerStates: PlayerState[];
  graveyard: AutomergeUrl[]; // Array of card document URLs in graveyard
  currentPlayerIndex: number;
  turn: number;
  gameLog: GameLogEntry[];
  
  // Rematch system
  rematchGameId?: AutomergeUrl; // Reference to rematch game if one exists
};

export const joinGame = (doc: GameDoc, playerId: AutomergeUrl): void => {
  if (doc.status !== 'waiting') {
    throw new Error('joinGame: Game is not in waiting state');
  }

  if (!doc.players.includes(playerId)) {
    doc.players.push(playerId);
  }
};

// Game state mutations
export const removeCardFromHand = (doc: GameDoc, playerId: AutomergeUrl, cardUrl: AutomergeUrl): boolean => {
  const playerHandIndex = doc.playerHands.findIndex(hand => hand.playerId === playerId);
  if (playerHandIndex === -1) {
    console.error(`removeCardFromHand: Player hand not found for playerId: ${playerId}`);
    return false;
  }
  
  const cardIndex = doc.playerHands[playerHandIndex].cards.indexOf(cardUrl);
  if (cardIndex === -1) {
    console.error(`removeCardFromHand: Card ${cardUrl} not found in player ${playerId}'s hand`);
    return false;
  }
  
  doc.playerHands[playerHandIndex].cards.splice(cardIndex, 1);
  return true;
};

// addCardToBattlefield moved to utils/engine.ts

export const addCardToGraveyard = (doc: GameDoc, cardUrl: AutomergeUrl): void => {
  doc.graveyard.push(cardUrl);
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

export const setGameDeckSelection = (doc: GameDoc, deckUrl: AutomergeUrl | null): void => {
  doc.selectedDeckUrl = deckUrl;
};

export const getGameDeckSelection = (doc: GameDoc): AutomergeUrl | null => {
  return doc.selectedDeckUrl;
};

// createGameDeckFromDeck moved to utils/engine.ts

// Remove creature from battlefield and add to graveyard
export const removeCreatureFromBattlefield = (
  doc: GameDoc, 
  playerId: AutomergeUrl, 
  instanceId: string
): boolean => {
  const battlefieldIndex = doc.playerBattlefields.findIndex(
    battlefield => battlefield.playerId === playerId
  );
  
  if (battlefieldIndex === -1) {
    console.error(`removeCreatureFromBattlefield: Battlefield not found for playerId: ${playerId}`);
    return false;
  }
  
  const cardIndex = doc.playerBattlefields[battlefieldIndex].cards.findIndex(
    card => card.instanceId === instanceId
  );
  
  if (cardIndex === -1) {
    console.error(`removeCreatureFromBattlefield: Creature ${instanceId} not found on battlefield`);
    return false;
  }
  
  // Get the card before removing it
  const battlefieldCard = doc.playerBattlefields[battlefieldIndex].cards[cardIndex];
  
  // Remove from battlefield
  doc.playerBattlefields[battlefieldIndex].cards.splice(cardIndex, 1);
  
  // Add to graveyard
  doc.graveyard.push(battlefieldCard.cardUrl);
  
  return true;
};

// Deal damage to a creature on the battlefield, reducing its health
export const dealDamageToCreature = (
  doc: GameDoc, 
  playerId: AutomergeUrl, 
  instanceId: string, 
  damage: number
): boolean => {
  const battlefieldIndex = doc.playerBattlefields.findIndex(
    battlefield => battlefield.playerId === playerId
  );
  
  if (battlefieldIndex === -1) {
    console.error(`dealDamageToCreature: Battlefield not found for playerId: ${playerId}`);
    return false;
  }
  
  const cardIndex = doc.playerBattlefields[battlefieldIndex].cards.findIndex(
    card => card.instanceId === instanceId
  );
  
  if (cardIndex === -1) {
    console.error(`dealDamageToCreature: Creature ${instanceId} not found on battlefield`);
    return false;
  }
  
  const battlefieldCard = doc.playerBattlefields[battlefieldIndex].cards[cardIndex];
  
  // Reduce health
  battlefieldCard.currentHealth -= damage;
  
  // If health is 0 or less, destroy the creature
  if (battlefieldCard.currentHealth <= 0) {
    return removeCreatureFromBattlefield(doc, playerId, instanceId);
  }
  
  return true;
};

// castSpell moved to utils/engine.ts

// playCard moved to utils/engine.ts



export const drawCard = (doc: GameDoc, playerId: AutomergeUrl): boolean => {
  // Check if deck is empty
  if (doc.deck.length === 0) {
    // Try to reshuffle graveyard into deck
    if (doc.graveyard.length === 0) {
      console.warn(`drawCard: No cards available to draw for player ${playerId}`);
      return false;
    }
    
    // Reshuffle graveyard into deck
    doc.deck = [...doc.graveyard];
    doc.graveyard = [];
    
    // Simple shuffle (Fisher-Yates)
    for (let i = doc.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [doc.deck[i], doc.deck[j]] = [doc.deck[j], doc.deck[i]];
    }
    
    addGameLogEntry(doc, {
      playerId,
      action: 'draw_card',
      description: 'Reshuffled graveyard into deck'
    });
  }
  
  // Draw the top card
  const cardUrl = doc.deck.pop();
  if (!cardUrl) {
    console.error(`drawCard: Failed to draw card for player ${playerId}`);
    return false;
  }
  
  // Add to player's hand
  const playerHandIndex = doc.playerHands.findIndex(hand => hand.playerId === playerId);
  if (playerHandIndex === -1) {
    console.error(`drawCard: Player hand not found for playerId: ${playerId}`);
    return false;
  }
  
  doc.playerHands[playerHandIndex].cards.push(cardUrl);
  
  // Add to game log
  addGameLogEntry(doc, {
    playerId,
    action: 'draw_card',
    cardUrl,
    description: 'Drew a card'
  });
  
  return true;
};

export const dealDamage = (doc: GameDoc, targetPlayerId: AutomergeUrl, damage: number): boolean => {
  const playerStateIndex = doc.playerStates.findIndex(state => state.playerId === targetPlayerId);
  if (playerStateIndex === -1) {
    console.error(`dealDamage: Player state not found for targetPlayerId: ${targetPlayerId}`);
    return false;
  }
  
  const playerState = doc.playerStates[playerStateIndex];
  playerState.health = Math.max(0, playerState.health - damage);
  
  // Add to game log - show damage from target's perspective
  addGameLogEntry(doc, {
    playerId: targetPlayerId, // Always log from target's perspective for damage
    action: 'take_damage',
    targetId: targetPlayerId,
    amount: damage,
    description: `Took ${damage} damage`
  });
  
  // Note: take_damage abilities would need repo parameter - currently disabled
  // TODO: executeTriggeredAbilities(doc, 'take_damage', targetPlayerId, repo);
  
  // Check for game end
  if (playerState.health <= 0) {
    doc.status = 'finished';
    addGameLogEntry(doc, {
      playerId: targetPlayerId,
      action: 'game_end',
      description: 'Player defeated'
    });
  }
  
  return true;
};

// attackPlayerWithCreature moved to utils/engine.ts

// attackCreatureWithCreature moved to utils/engine.ts

// canCreatureTarget - utility function for targeting validation
export const canCreatureTarget = (
  creatureCard: { attackTargeting?: { canTargetPlayers?: boolean; canTargetCreatures?: boolean; canTargetArtifacts?: boolean; restrictedTypes?: string[] } }, 
  targetType: 'player' | 'creature' | 'artifact',
  targetCardType?: 'creature' | 'artifact'
): boolean => {
  // If no targeting restrictions, can attack anything
  if (!creatureCard.attackTargeting) {
    return true;
  }

  const targeting = creatureCard.attackTargeting;

  switch (targetType) {
    case 'player':
      return targeting.canTargetPlayers !== false;
    
    case 'creature':
    case 'artifact':
      // Check if can target creatures/artifacts in general
      if (targetType === 'creature' && targeting.canTargetCreatures === false) {
        return false;
      }
      if (targetType === 'artifact' && targeting.canTargetArtifacts === false) {
        return false;
      }
      
      // Check specific type restrictions
      if (targeting.restrictedTypes && targetCardType) {
        return targeting.restrictedTypes.includes(targetCardType);
      }
      
      return true;
    
    default:
      return false;
  }
};

// Keep old function for backwards compatibility
export const attackPlayer = (doc: GameDoc, attackerId: AutomergeUrl, targetPlayerId: AutomergeUrl, damage: number): boolean => {
  // Add attack log BEFORE dealing damage (so it appears before any "Player defeated" message)
  addGameLogEntry(doc, {
    playerId: attackerId,
    action: 'attack',
    targetId: targetPlayerId,
    amount: damage,
    description: `Attacked for ${damage} damage`
  });

  const success = dealDamage(doc, targetPlayerId, damage);
  return success;
};

export const sapCreature = (doc: GameDoc, playerId: AutomergeUrl, instanceId: string): boolean => {
  const battlefieldIndex = doc.playerBattlefields.findIndex(battlefield => battlefield.playerId === playerId);
  if (battlefieldIndex === -1) {
    console.error(`sapCreature: Battlefield not found for playerId: ${playerId}`);
    return false;
  }
  
  const cardIndex = doc.playerBattlefields[battlefieldIndex].cards.findIndex(card => card.instanceId === instanceId);
  if (cardIndex === -1) {
    console.error(`sapCreature: Card instance ${instanceId} not found on battlefield for player ${playerId}`);
    return false;
  }
  
  doc.playerBattlefields[battlefieldIndex].cards[cardIndex].sapped = true;
  return true;
};

export const refreshCreatures = (doc: GameDoc, playerId: AutomergeUrl): boolean => {
  const battlefieldIndex = doc.playerBattlefields.findIndex(battlefield => battlefield.playerId === playerId);
  if (battlefieldIndex === -1) {
    console.error(`refreshCreatures: Battlefield not found for playerId: ${playerId}`);
    return false;
  }
  
  // Reset sapped status for all creatures
  doc.playerBattlefields[battlefieldIndex].cards.forEach(card => {
    card.sapped = false;
  });
  
  return true;
};

// healCreatures moved to utils/engine.ts

// executeTriggeredAbilities moved to utils/engine.ts

// executeTriggeredAbilitiesForCreature moved to utils/engine.ts



// endPlayerTurn moved to utils/engine.ts

export const initializeGame = (doc: GameDoc, shuffledDeck: AutomergeUrl[]): void => {
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
      maxEnergy: 2, // Starting max energy
      health: 25, // Starting health
      maxHealth: 25 // Max health
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
  
  // First player draws an additional card to start
  drawCard(doc, doc.players[0]);
};

// createRematchGame moved to utils/engine.ts

export const create = (repo: Repo, initialState?: Partial<GameDoc>): DocHandle<GameDoc> => {
  const gameData: GameDoc = {
    createdAt: Date.now(),
    players: [],
    status: 'waiting' as const,
    selectedDeckUrl: null, // No deck selected initially - must be selected in lobby
    deck: [],
    playerHands: [],
    playerBattlefields: [],
    playerStates: [],
    graveyard: [],
    currentPlayerIndex: 0,
    turn: 0,
    gameLog: [],
    ...initialState
  };
  const handle = repo.create<GameDoc>(gameData);
  return handle;
};
