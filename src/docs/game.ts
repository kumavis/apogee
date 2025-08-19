import { AutomergeUrl, DocHandle, Repo } from "@automerge/react";
import { CARD_LIBRARY } from "../utils/cardLibrary";
import { executeSpellEffect, createSpellEffectAPI, SpellTargetSelector, SpellTarget } from "../utils/spellEffects";

export type CardType = 'creature' | 'spell' | 'artifact';

export type GameCard = {
  id: string;
  name: string;
  cost: number;
  attack?: number;
  health?: number;
  type: CardType;
  description: string;
  spellEffect?: string; // Code string for spell effects
  attackTargeting?: {
    canTargetPlayers?: boolean;
    canTargetCreatures?: boolean;
    canTargetArtifacts?: boolean;
    restrictedTypes?: ('creature' | 'artifact')[];
    description?: string;
  };
};

export type PlayerHand = {
  playerId: AutomergeUrl;
  cards: string[]; // Array of card IDs
};

export type BattlefieldCard = {
  instanceId: string; // Unique ID for this specific card instance
  cardId: string; // Reference to card definition in library
  sapped: boolean; // True if creature has attacked this turn
  currentHealth: number; // Current health of the creature/artifact
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
  
  const card = doc.cardLibrary[cardId];
  if (!card) {
    console.error(`addCardToBattlefield: Card ${cardId} not found in library`);
    return false;
  }
  
  // Generate unique instance ID for this card copy
  const instanceId = `instance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  doc.playerBattlefields[battlefieldIndex].cards.push({
    instanceId,
    cardId,
    sapped: true, // New creatures start sapped (summoning sickness)
    currentHealth: card.health || 1 // Set initial health from card definition, default to 1
  });
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

// Helper function to remove creature from battlefield and add to graveyard
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
  doc.graveyard.push(battlefieldCard.cardId);
  
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

export const castSpell = async (
  doc: GameDoc, 
  playerId: AutomergeUrl, 
  cardId: string,
  selectTargetsImpl: (selector: SpellTargetSelector) => Promise<SpellTarget[]>
): Promise<boolean> => {
  const card = doc.cardLibrary[cardId];
  if (!card) {
    console.error(`castSpell: Card not found in library: ${cardId}`);
    return false;
  }

  if (card.type !== 'spell') {
    console.error(`castSpell: Card ${cardId} is not a spell`);
    return false;
  }

  if (!card.spellEffect) {
    console.error(`castSpell: Spell card ${cardId} has no effect code`);
    return false;
  }

  try {
    // Create the spell effect API
    const api = createSpellEffectAPI(doc, playerId, selectTargetsImpl);
    
    // Execute the spell effect
    const success = await executeSpellEffect(card.spellEffect, api);
    
    if (success) {
      // Add to game log
      addGameLogEntry(doc, {
        playerId,
        action: 'play_card',
        cardId,
        description: `Cast ${card.name}`
      });
    }
    
    return success;
  } catch (error) {
    console.error(`castSpell: Error casting spell ${cardId}:`, error);
    addGameLogEntry(doc, {
      playerId,
      action: 'play_card',
      cardId,
      description: `Failed to cast ${card.name}`
    });
    return false;
  }
};

// Async version of playCard that handles spells with targeting
export const playCardAsync = async (
  doc: GameDoc, 
  playerId: AutomergeUrl, 
  cardId: string,
  selectTargetsImpl?: (selector: SpellTargetSelector) => Promise<SpellTarget[]>
): Promise<boolean> => {
  const card = doc.cardLibrary[cardId];
  if (!card) {
    console.error(`playCardAsync: Card not found in library: ${cardId}`);
    return false;
  }

  // Remove card from hand
  if (!removeCardFromHand(doc, playerId, cardId)) {
    console.error(`playCardAsync: Failed to remove card ${cardId} from player ${playerId}'s hand`);
    return false;
  }

  // Spend energy
  if (!spendEnergy(doc, playerId, card.cost)) {
    console.error(`playCardAsync: Failed to spend energy for card ${cardId} (cost: ${card.cost}) for player ${playerId}`);
    // Try to add the card back to hand since we couldn't spend energy
    const playerHandIndex = doc.playerHands.findIndex(hand => hand.playerId === playerId);
    if (playerHandIndex !== -1) {
      doc.playerHands[playerHandIndex].cards.push(cardId);
      console.warn(`playCardAsync: Restored card ${cardId} to player ${playerId}'s hand after energy failure`);
    }
    return false;
  }

  // Handle card based on type
  if (card.type === 'creature' || card.type === 'artifact') {
    if (!addCardToBattlefield(doc, playerId, cardId)) {
      console.error(`playCardAsync: Failed to add card ${cardId} to battlefield for player ${playerId}`);
      return false;
    }
    
    // Add to game log
    addGameLogEntry(doc, {
      playerId,
      action: 'play_card',
      cardId,
      description: `Played ${card.name}`
    });
  } else if (card.type === 'spell') {
    // Add to graveyard first
    addCardToGraveyard(doc, cardId);
    
    // Execute spell effect if it has one
    if (card.spellEffect && selectTargetsImpl) {
      const api = createSpellEffectAPI(doc, playerId, selectTargetsImpl);
      const success = await executeSpellEffect(card.spellEffect, api);
      
      if (!success) {
        console.error(`playCardAsync: Spell effect failed for card ${cardId}`);
        return false;
      }
    } else {
      // Add basic log entry for spells without effects
      addGameLogEntry(doc, {
        playerId,
        action: 'play_card',
        cardId,
        description: `Played ${card.name}`
      });
    }
  } else {
    // Other card types go to graveyard
    addCardToGraveyard(doc, cardId);
    
    addGameLogEntry(doc, {
      playerId,
      action: 'play_card',
      cardId,
      description: `Played ${card.name}`
    });
  }

  return true;
};

// Synchronous version kept for backwards compatibility
export const playCard = (doc: GameDoc, playerId: AutomergeUrl, cardId: string): boolean => {
  const card = doc.cardLibrary[cardId];
  if (!card) {
    console.error(`playCard: Card not found in library: ${cardId}`);
    return false;
  }

  // For spells with effects, we should use playCardAsync instead
  if (card.type === 'spell' && card.spellEffect) {
    console.warn(`playCard: Spell ${cardId} has effects but was called synchronously. Use playCardAsync instead.`);
    // Fall through to basic behavior for backwards compatibility
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
  // Find the creature to get its name
  const battlefield = doc.playerBattlefields.find(b => b.playerId === attackerId);
  const battlefieldCard = battlefield?.cards.find(c => c.instanceId === instanceId);
  const creatureCard = battlefieldCard ? doc.cardLibrary[battlefieldCard.cardId] : null;
  const creatureName = creatureCard ? creatureCard.name : 'Unknown Creature';

  // Mark creature as sapped first
  if (!sapCreature(doc, attackerId, instanceId)) {
    console.error(`attackPlayerWithCreature: Failed to sap creature ${instanceId} for player ${attackerId}`);
    return false;
  }

  // Add attack log BEFORE dealing damage (so it appears before any "Player defeated" message)
  addGameLogEntry(doc, {
    playerId: attackerId,
    action: 'attack',
    targetId: targetPlayerId,
    amount: damage,
    description: `${creatureName} attacked player for ${damage} damage`
  });

  const success = dealDamage(doc, targetPlayerId, damage);
  return success;
};

// New function for creature vs creature/artifact combat with mutual damage
export const attackCreatureWithCreature = (
  doc: GameDoc, 
  attackerId: AutomergeUrl, 
  attackerInstanceId: string, 
  targetPlayerId: AutomergeUrl, 
  targetInstanceId: string
): boolean => {
  // Find the attacker
  const attackerBattlefield = doc.playerBattlefields.find(b => b.playerId === attackerId);
  const attackerCard = attackerBattlefield?.cards.find(c => c.instanceId === attackerInstanceId);
  const attackerGameCard = attackerCard ? doc.cardLibrary[attackerCard.cardId] : null;
  
  if (!attackerCard || !attackerGameCard || !attackerGameCard.attack) {
    console.error(`attackCreatureWithCreature: Invalid attacker ${attackerInstanceId}`);
    return false;
  }

  // Find the target
  const targetBattlefield = doc.playerBattlefields.find(b => b.playerId === targetPlayerId);
  const targetCard = targetBattlefield?.cards.find(c => c.instanceId === targetInstanceId);
  const targetGameCard = targetCard ? doc.cardLibrary[targetCard.cardId] : null;
  
  if (!targetCard || !targetGameCard) {
    console.error(`attackCreatureWithCreature: Invalid target ${targetInstanceId}`);
    return false;
  }

  // Mark attacker as sapped
  if (!sapCreature(doc, attackerId, attackerInstanceId)) {
    console.error(`attackCreatureWithCreature: Failed to sap attacker ${attackerInstanceId}`);
    return false;
  }

  const attackerName = attackerGameCard.name;
  const targetName = targetGameCard.name;
  const attackerDamage = attackerGameCard.attack;
  const targetDamage = targetGameCard.attack || 0; // Artifacts have 0 attack

  // Add combat log
  if (targetGameCard.type === 'creature' && targetDamage > 0) {
    // Mutual combat
    addGameLogEntry(doc, {
      playerId: attackerId,
      action: 'attack',
      targetId: targetPlayerId,
      amount: attackerDamage,
      description: `${attackerName} and ${targetName} fight! ${attackerName} deals ${attackerDamage}, ${targetName} deals ${targetDamage} damage`
    });
  } else {
    // One-sided attack (against artifact or 0-attack creature)
    addGameLogEntry(doc, {
      playerId: attackerId,
      action: 'attack',
      targetId: targetPlayerId,
      amount: attackerDamage,
      description: `${attackerName} attacked ${targetName} for ${attackerDamage} damage`
    });
  }

  // Deal damage to target first
  dealDamageToCreature(doc, targetPlayerId, targetInstanceId, attackerDamage);

  // If target is a creature with attack power, deal damage back to attacker
  if (targetGameCard.type === 'creature' && targetDamage > 0) {
    // Check if attacker still exists (might have been destroyed by other effects)
    const stillExistsAttacker = doc.playerBattlefields
      .find(b => b.playerId === attackerId)?.cards
      .find(c => c.instanceId === attackerInstanceId);
    
    if (stillExistsAttacker) {
      dealDamageToCreature(doc, attackerId, attackerInstanceId, targetDamage);
    }
  }

  return true;
};

// Check if a creature can target a specific type
export const canCreatureTarget = (
  creatureCard: GameCard, 
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

// Heal creatures at end of turn (not artifacts)
export const healCreatures = (doc: GameDoc, playerId: AutomergeUrl): boolean => {
  const battlefieldIndex = doc.playerBattlefields.findIndex(battlefield => battlefield.playerId === playerId);
  if (battlefieldIndex === -1) {
    console.error(`healCreatures: Battlefield not found for playerId: ${playerId}`);
    return false;
  }
  
  let healedCount = 0;
  
  // Heal all creatures by 1 health (not artifacts)
  doc.playerBattlefields[battlefieldIndex].cards.forEach(battlefieldCard => {
    const card = doc.cardLibrary[battlefieldCard.cardId];
    if (card && card.type === 'creature') {
      const maxHealth = card.health || 1;
      if (battlefieldCard.currentHealth < maxHealth) {
        battlefieldCard.currentHealth = Math.min(maxHealth, battlefieldCard.currentHealth + 1);
        healedCount++;
      }
    }
  });
  
  if (healedCount > 0) {
    addGameLogEntry(doc, {
      playerId,
      action: 'play_card', // Reusing this action type
      description: `${healedCount} creature(s) healed 1 health`
    });
  }
  
  return true;
};

export const endPlayerTurn = (doc: GameDoc, playerId: AutomergeUrl): void => {
  // Add to game log FIRST, before any next player actions
  addGameLogEntry(doc, {
    playerId,
    action: 'end_turn',
    description: 'Ended turn'
  });

  const nextPlayerIndex = advanceToNextPlayer(doc);
  const nextPlayerId = doc.players[nextPlayerIndex];
  
  // Draw a card for the next player (start of their turn)
  drawCard(doc, nextPlayerId);
  
  // Refresh creatures for the next player (unsap them)
  refreshCreatures(doc, nextPlayerId);
  
  // Heal creatures for the next player (only creatures, not artifacts)
  healCreatures(doc, nextPlayerId);
  
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
