import { AutomergeUrl, DocHandle, Repo } from "@automerge/react";
import { CARD_LIBRARY } from "../utils/cardLibrary";

export type CardType = 'creature' | 'spell' | 'artifact' | 'planet' | 'infrastructure';

export type InfrastructureType = 'tech' | 'mechanical' | 'bio' | 'cultural';

export type PlanetCapacity = {
  tech: number;
  mechanical: number;
  bio: number;
  cultural: number;
};

export type GameCard = {
  id: string;
  name: string;
  cost: number;
  attack?: number;
  health?: number;
  type: CardType;
  description: string;
  // Planet-specific properties
  planetCapacity?: PlanetCapacity;
  // Infrastructure-specific properties
  infrastructureType?: InfrastructureType;
  infrastructureEffects?: string; // Description of what this infrastructure does
};

export type PlayerHand = {
  playerId: AutomergeUrl;
  cards: string[]; // Array of card IDs
};

export type InfrastructurePlacement = {
  infrastructureInstanceId: string; // Instance ID of the infrastructure card
  infrastructureCardId: string; // Card ID of the infrastructure
  infrastructureType: InfrastructureType;
};

export type BattlefieldCard = {
  instanceId: string; // Unique ID for this specific card instance
  cardId: string; // Reference to card definition in library
  sapped: boolean; // True if creature has attacked this turn
  // Planet-specific data
  infrastructurePlacements?: InfrastructurePlacement[]; // Infrastructure placed on this planet
};

export type PlayerBattlefield = {
  playerId: AutomergeUrl;
  cards: BattlefieldCard[]; // Array of battlefield cards with status
};

export type GameLogEntry = {
  id: string;
  playerId: AutomergeUrl;
  action: 'play_card' | 'end_turn' | 'draw_card' | 'game_start' | 'attack' | 'take_damage' | 'game_end';
  cardId?: string;
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
  
  // Rematch system
  rematchGameId?: AutomergeUrl; // Reference to rematch game if one exists
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
  
  // Generate unique instance ID for this card copy
  const instanceId = `instance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const card = doc.cardLibrary[cardId];
  const battlefieldCard: BattlefieldCard = {
    instanceId,
    cardId,
    sapped: card?.type === 'creature' // Only creatures start sapped (summoning sickness)
  };
  
  // Initialize infrastructure placements for planets
  if (card?.type === 'planet') {
    battlefieldCard.infrastructurePlacements = [];
  }
  
  doc.playerBattlefields[battlefieldIndex].cards.push(battlefieldCard);
  return true;
};

export const addCardToGraveyard = (doc: GameDoc, cardId: string): void => {
  doc.graveyard.push(cardId);
};

export const canPlaceInfrastructureOnPlanet = (doc: GameDoc, planetInstanceId: string, infrastructureType: InfrastructureType): boolean => {
  // Find the planet on any player's battlefield
  let planet: BattlefieldCard | undefined;
  
  for (const battlefield of doc.playerBattlefields) {
    planet = battlefield.cards.find(card => card.instanceId === planetInstanceId);
    if (planet) break;
  }
  
  if (!planet) {
    console.error(`canPlaceInfrastructureOnPlanet: Planet instance ${planetInstanceId} not found`);
    return false;
  }
  
  const planetCard = doc.cardLibrary[planet.cardId];
  if (!planetCard || planetCard.type !== 'planet' || !planetCard.planetCapacity) {
    console.error(`canPlaceInfrastructureOnPlanet: Invalid planet card ${planet.cardId}`);
    return false;
  }
  
  if (!planet.infrastructurePlacements) {
    planet.infrastructurePlacements = [];
  }
  
  // Count current infrastructure of this type
  const currentCount = planet.infrastructurePlacements.filter(
    placement => placement.infrastructureType === infrastructureType
  ).length;
  
  const maxCapacity = planetCard.planetCapacity[infrastructureType];
  
  return currentCount < maxCapacity;
};

export const placeInfrastructureOnPlanet = (
  doc: GameDoc, 
  playerId: AutomergeUrl, 
  infrastructureCardId: string, 
  planetInstanceId: string
): boolean => {
  const infrastructureCard = doc.cardLibrary[infrastructureCardId];
  if (!infrastructureCard || infrastructureCard.type !== 'infrastructure' || !infrastructureCard.infrastructureType) {
    console.error(`placeInfrastructureOnPlanet: Invalid infrastructure card ${infrastructureCardId}`);
    return false;
  }
  
  // Check if placement is valid
  if (!canPlaceInfrastructureOnPlanet(doc, planetInstanceId, infrastructureCard.infrastructureType)) {
    console.error(`placeInfrastructureOnPlanet: Cannot place ${infrastructureCard.infrastructureType} infrastructure on planet ${planetInstanceId}`);
    return false;
  }
  
  // Find the planet on any player's battlefield
  let planet: BattlefieldCard | undefined;
  let battlefieldIndex = -1;
  let cardIndex = -1;
  
  for (let i = 0; i < doc.playerBattlefields.length; i++) {
    cardIndex = doc.playerBattlefields[i].cards.findIndex(card => card.instanceId === planetInstanceId);
    if (cardIndex !== -1) {
      planet = doc.playerBattlefields[i].cards[cardIndex];
      battlefieldIndex = i;
      break;
    }
  }
  
  if (!planet || battlefieldIndex === -1 || cardIndex === -1) {
    console.error(`placeInfrastructureOnPlanet: Planet instance ${planetInstanceId} not found on battlefield`);
    return false;
  }
  
  // Generate unique instance ID for this infrastructure
  const infrastructureInstanceId = `infra_instance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Add infrastructure to planet
  if (!planet.infrastructurePlacements) {
    planet.infrastructurePlacements = [];
  }
  
  planet.infrastructurePlacements.push({
    infrastructureInstanceId,
    infrastructureCardId,
    infrastructureType: infrastructureCard.infrastructureType
  });
  
  // Add to game log
  const planetCard = doc.cardLibrary[planet.cardId];
  addGameLogEntry(doc, {
    playerId,
    action: 'play_card',
    cardId: infrastructureCardId,
    description: `Placed ${infrastructureCard.name} on ${planetCard?.name || 'Planet'}`
  });
  
  return true;
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
  if (card.type === 'creature' || card.type === 'artifact' || card.type === 'planet') {
    if (!addCardToBattlefield(doc, playerId, cardId)) {
      console.error(`playCard: Failed to add card ${cardId} to battlefield for player ${playerId}`);
      return false;
    }
  } else if (card.type === 'infrastructure') {
    // Infrastructure cards require targeting - this should be handled by a separate function
    console.error(`playCard: Infrastructure cards require targeting and should use playInfrastructureCard function`);
    return false;
  } else {
    // Spells go to graveyard
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

export const playInfrastructureCard = (doc: GameDoc, playerId: AutomergeUrl, infrastructureCardId: string, targetPlanetInstanceId: string): boolean => {
  const infrastructureCard = doc.cardLibrary[infrastructureCardId];
  if (!infrastructureCard) {
    console.error(`playInfrastructureCard: Card not found in library: ${infrastructureCardId}`);
    return false;
  }

  if (infrastructureCard.type !== 'infrastructure') {
    console.error(`playInfrastructureCard: Card ${infrastructureCardId} is not an infrastructure card`);
    return false;
  }

  // Remove card from hand
  if (!removeCardFromHand(doc, playerId, infrastructureCardId)) {
    console.error(`playInfrastructureCard: Failed to remove card ${infrastructureCardId} from player ${playerId}'s hand`);
    return false;
  }

  // Spend energy
  if (!spendEnergy(doc, playerId, infrastructureCard.cost)) {
    console.error(`playInfrastructureCard: Failed to spend energy for card ${infrastructureCardId} (cost: ${infrastructureCard.cost}) for player ${playerId}`);
    // Try to add the card back to hand since we couldn't spend energy
    const playerHandIndex = doc.playerHands.findIndex(hand => hand.playerId === playerId);
    if (playerHandIndex !== -1) {
      doc.playerHands[playerHandIndex].cards.push(infrastructureCardId);
      console.warn(`playInfrastructureCard: Restored card ${infrastructureCardId} to player ${playerId}'s hand after energy failure`);
    }
    return false;
  }

  // Place infrastructure on target planet
  if (!placeInfrastructureOnPlanet(doc, playerId, infrastructureCardId, targetPlanetInstanceId)) {
    console.error(`playInfrastructureCard: Failed to place infrastructure ${infrastructureCardId} on planet ${targetPlanetInstanceId}`);
    // Try to restore energy and card to hand
    const playerStateIndex = doc.playerStates.findIndex(state => state.playerId === playerId);
    if (playerStateIndex !== -1) {
      doc.playerStates[playerStateIndex].energy += infrastructureCard.cost;
    }
    const playerHandIndex = doc.playerHands.findIndex(hand => hand.playerId === playerId);
    if (playerHandIndex !== -1) {
      doc.playerHands[playerHandIndex].cards.push(infrastructureCardId);
    }
    return false;
  }

  return true;
};

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
  const cardId = doc.deck.pop();
  if (!cardId) {
    console.error(`drawCard: Failed to draw card for player ${playerId}`);
    return false;
  }
  
  // Add to player's hand
  const playerHandIndex = doc.playerHands.findIndex(hand => hand.playerId === playerId);
  if (playerHandIndex === -1) {
    console.error(`drawCard: Player hand not found for playerId: ${playerId}`);
    return false;
  }
  
  doc.playerHands[playerHandIndex].cards.push(cardId);
  
  // Add to game log
  addGameLogEntry(doc, {
    playerId,
    action: 'draw_card',
    cardId,
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

export const attackPlayerWithCreature = (doc: GameDoc, attackerId: AutomergeUrl, instanceId: string, targetPlayerId: AutomergeUrl, damage: number): boolean => {
  // Mark creature as sapped first
  if (!sapCreature(doc, attackerId, instanceId)) {
    console.error(`attackPlayerWithCreature: Failed to sap creature ${instanceId} for player ${attackerId}`);
    return false;
  }

  const success = dealDamage(doc, targetPlayerId, damage);
  
  if (success) {
    addGameLogEntry(doc, {
      playerId: attackerId,
      action: 'attack',
      targetId: targetPlayerId,
      amount: damage,
      description: `Attacked for ${damage} damage`
    });
  }
  
  return success;
};

// Keep old function for backwards compatibility
export const attackPlayer = (doc: GameDoc, attackerId: AutomergeUrl, targetPlayerId: AutomergeUrl, damage: number): boolean => {
  const success = dealDamage(doc, targetPlayerId, damage);
  
  if (success) {
    addGameLogEntry(doc, {
      playerId: attackerId,
      action: 'attack',
      targetId: targetPlayerId,
      amount: damage,
      description: `Attacked for ${damage} damage`
    });
  }
  
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

export const endPlayerTurn = (doc: GameDoc, playerId: AutomergeUrl): void => {
  const nextPlayerIndex = advanceToNextPlayer(doc);
  const nextPlayerId = doc.players[nextPlayerIndex];
  
  // Draw a card for the next player (start of their turn)
  drawCard(doc, nextPlayerId);
  
  // Refresh creatures for the next player (unsap them)
  refreshCreatures(doc, nextPlayerId);
  
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

export const createRematchGame = (doc: GameDoc, repo: Repo): AutomergeUrl | null => {
  try {
    // Create a new game with the same players
    const rematchHandle = create(repo, {
      players: [...doc.players] // Copy players from original game
    });
    
    const rematchId = rematchHandle.url;
    
    // Update the original game to reference the rematch
    doc.rematchGameId = rematchId;
    
    console.log(`Created rematch game: ${rematchId}`);
    return rematchId;
  } catch (error) {
    console.error('Failed to create rematch game:', error);
    return null;
  }
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
