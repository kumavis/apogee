import { expect } from 'vitest';
import { Repo, AutomergeUrl } from '@automerge/automerge-repo';
import { GameEngine } from '../GameEngine';
import { create as createGameDoc } from '../../docs/game';
import { CardDoc } from '../../docs/card';
import { Deck } from '../../docs/deck';
import { create as createContactDoc, ContactDoc } from '../../docs/contact';

// Test configuration types
export interface TestGameConfig {
  player1Name?: string;
  player2Name?: string;
  player1Energy?: number;
  player2Energy?: number;
  player1Health?: number;
  player2Health?: number;
  deckCards?: AutomergeUrl[];
  turn?: number;
}

export interface TestSetup {
  repo: Repo;
  gameEngine: GameEngine;
  player1Id: AutomergeUrl;
  player2Id: AutomergeUrl;
  player1Contact: ContactDoc;
  player2Contact: ContactDoc;
}

// Mock target selector for testing
export const mockSelectTargets = async () => [];

/**
 * Create a complete CardDoc with all required fields for testing
 */
export function createCompleteCardDoc(overrides: Partial<CardDoc> = {}): CardDoc {
  return {
    name: 'Test Card',
    cost: 1,
    type: 'creature',
    attack: 1,
    health: 1,
    description: 'A test card',
    createdAt: new Date().toISOString(),
    createdBy: 'test' as AutomergeUrl,
    ...overrides
  };
}

/**
 * Create a complete Deck with all required fields for testing
 */
export function createCompleteDeck(overrides: Partial<Deck> = {}): Deck {
  return {
    id: `test-deck-${Date.now()}`,
    name: 'Test Deck',
    description: 'A test deck',
    cards: [],
    createdAt: new Date().toISOString(),
    createdBy: 'test' as AutomergeUrl,
    updatedAt: new Date().toISOString(),
    ...overrides
  };
}

/**
 * Create a test repo with no network or storage
 */
export function createTestRepo(): Repo {
  return new Repo({
    network: [],
    storage: undefined
  });
}

/**
 * Create a complete test setup with game engine and players
 */
export function createTestGameSetup(config: TestGameConfig = {}): TestSetup {
  const repo = createTestRepo();
  
  // Create ContactDoc documents for players
  const player1ContactHandle = createContactDoc(repo, { 
    name: config.player1Name || 'Test Player 1' 
  });
  const player2ContactHandle = createContactDoc(repo, { 
    name: config.player2Name || 'Test Player 2' 
  });
  
  const player1Id = player1ContactHandle.url;
  const player2Id = player2ContactHandle.url;
  const player1Contact = player1ContactHandle.doc();
  const player2Contact = player2ContactHandle.doc();
  
  const gameHandle = createGameDoc(repo, {
    players: [player1Id, player2Id],
    status: 'playing',
    selectedDeckUrl: null,
    deck: config.deckCards || [],
    playerHands: [
      { playerId: player1Id, cards: [] },
      { playerId: player2Id, cards: [] }
    ],
    playerBattlefields: [
      { playerId: player1Id, cards: [] },
      { playerId: player2Id, cards: [] }
    ],
    playerStates: [
      { 
        playerId: player1Id, 
        energy: config.player1Energy ?? 10, 
        maxEnergy: config.player1Energy ?? 10, 
        health: config.player1Health ?? 25, 
        maxHealth: config.player1Health ?? 25 
      },
      { 
        playerId: player2Id, 
        energy: config.player2Energy ?? 10, 
        maxEnergy: config.player2Energy ?? 10, 
        health: config.player2Health ?? 25, 
        maxHealth: config.player2Health ?? 25 
      }
    ],
    graveyard: [],
    currentPlayerIndex: 0,
    turn: config.turn ?? 1,
    gameLog: []
  });
  
  const gameEngine = new GameEngine(gameHandle, repo);
  
  return {
    repo,
    gameEngine,
    player1Id,
    player2Id,
    player1Contact,
    player2Contact
  };
}

/**
 * Create a test creature card
 */
export function createTestCreature(
  repo: Repo,
  overrides: Partial<CardDoc> = {}
): { card: CardDoc; url: AutomergeUrl } {
  const defaultCard: CardDoc = {
    name: 'Test Creature',
    cost: 2,
    type: 'creature',
    attack: 3,
    health: 2,
    description: 'A test creature',
    createdAt: new Date().toISOString(),
    createdBy: 'test' as AutomergeUrl,
    ...overrides
  };

  if (defaultCard.type !== 'creature') {
    throw new Error('createTestCreature: type must be creature');
  }
  
  const cardHandle = repo.create<CardDoc>(defaultCard);
  return {
    card: cardHandle.doc(),
    url: cardHandle.url
  };
}

/**
 * Create a test artifact with optional triggered abilities
 */
export function createTestArtifact(
  repo: Repo, 
  overrides: Partial<CardDoc> = {}
): { card: CardDoc; url: AutomergeUrl } {
  const defaultCard: CardDoc = {
    name: 'Test Artifact',
    cost: 3,
    type: 'artifact',
    health: 1,
    description: 'A test artifact',
    createdAt: new Date().toISOString(),
    createdBy: 'test' as AutomergeUrl,
    ...overrides
  };

  if (defaultCard.type !== 'artifact') {
    throw new Error('createTestArtifact: type must be artifact');
  }
  
  const cardHandle = repo.create<CardDoc>(defaultCard);
  return {
    card: cardHandle.doc(),
    url: cardHandle.url
  };
}

/**
 * Create a test spell card
 */
export function createTestSpell(
  repo: Repo, 
  overrides: Partial<CardDoc> = {}
): { card: CardDoc; url: AutomergeUrl } {
  const defaultCard: CardDoc = {
    name: 'Test Spell',
    cost: 1,
    type: 'spell',
    description: 'A test spell',
    createdAt: new Date().toISOString(),
    createdBy: 'test' as AutomergeUrl,
    ...overrides
  };

  if (defaultCard.type !== 'spell') {
    throw new Error('createTestSpell: type must be spell');
  }

  if (!overrides.spellEffect) {
    throw new Error('createTestSpell: spellEffect is required');
  }
  
  const cardHandle = repo.create<CardDoc>(defaultCard);
  return {
    card: cardHandle.doc(),
    url: cardHandle.url
  };
}

/**
 * Create a test deck
 */
export function createTestDeck(
  repo: Repo, 
  cardUrls: AutomergeUrl[]
): { deck: Deck; url: AutomergeUrl } {
  const deckData: Deck = {
    id: `test-deck-${Date.now()}`,
    name: 'Test Deck',
    description: 'A test deck',
    cards: cardUrls.map(url => ({ cardUrl: url, quantity: 1 })),
    createdAt: new Date().toISOString(),
    createdBy: 'test' as AutomergeUrl,
    updatedAt: new Date().toISOString()
  };
  
  const deckHandle = repo.create<Deck>(deckData);
  return {
    deck: deckHandle.doc(),
    url: deckHandle.url
  };
}

/**
 * Add a card to a player's hand
 */
export function addCardToHand(gameEngine: GameEngine, playerId: AutomergeUrl, cardUrl: AutomergeUrl): void {
  gameEngine.getGameDocHandle().change((doc) => {
    const playerHandIndex = doc.playerHands.findIndex(hand => hand.playerId === playerId);
    if (playerHandIndex !== -1) {
      doc.playerHands[playerHandIndex].cards.push(cardUrl);
    }
  });
}

/**
 * Add a card to a player's battlefield
 */
export function addCardToBattlefield(
  gameEngine: GameEngine, 
  playerId: AutomergeUrl, 
  cardUrl: AutomergeUrl, 
  overrides: { currentHealth?: number; sapped?: boolean } = {}
): string {
  const instanceId = `test-instance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  gameEngine.getGameDocHandle().change((doc) => {
    const battlefieldIndex = doc.playerBattlefields.findIndex(battlefield => battlefield.playerId === playerId);
    if (battlefieldIndex !== -1) {
      doc.playerBattlefields[battlefieldIndex].cards.push({
        instanceId,
        cardUrl,
        sapped: overrides.sapped ?? false,
        currentHealth: overrides.currentHealth ?? 1
      });
    }
  });
  
  return instanceId;
}

/**
 * Add cards to deck for drawing
 */
export function addCardsToDeck(gameEngine: GameEngine, cardUrls: AutomergeUrl[]): void {
  gameEngine.getGameDocHandle().change((doc) => {
    doc.deck.push(...cardUrls);
  });
}

/**
 * Set player energy
 */
export function setPlayerEnergy(gameEngine: GameEngine, playerId: AutomergeUrl, energy: number, maxEnergy?: number): void {
  gameEngine.getGameDocHandle().change((doc) => {
    const playerStateIndex = doc.playerStates.findIndex(state => state.playerId === playerId);
    if (playerStateIndex !== -1) {
      doc.playerStates[playerStateIndex].energy = energy;
      if (maxEnergy !== undefined) {
        doc.playerStates[playerStateIndex].maxEnergy = maxEnergy;
      }
    }
  });
}

/**
 * Set player health
 */
export function setPlayerHealth(gameEngine: GameEngine, playerId: AutomergeUrl, health: number, maxHealth?: number): void {
  gameEngine.getGameDocHandle().change((doc) => {
    const playerStateIndex = doc.playerStates.findIndex(state => state.playerId === playerId);
    if (playerStateIndex !== -1) {
      doc.playerStates[playerStateIndex].health = health;
      if (maxHealth !== undefined) {
        doc.playerStates[playerStateIndex].maxHealth = maxHealth;
      }
    }
  });
}

/**
 * Damage a creature on the battlefield
 */
export function damageCreature(gameEngine: GameEngine, playerId: AutomergeUrl, instanceId: string, damage: number): void {
  gameEngine.getGameDocHandle().change((doc) => {
    const battlefieldIndex = doc.playerBattlefields.findIndex(battlefield => battlefield.playerId === playerId);
    if (battlefieldIndex !== -1) {
      const cardIndex = doc.playerBattlefields[battlefieldIndex].cards.findIndex(card => card.instanceId === instanceId);
      if (cardIndex !== -1) {
        doc.playerBattlefields[battlefieldIndex].cards[cardIndex].currentHealth -= damage;
      }
    }
  });
}

// State validation helpers
export interface GameStateSnapshot {
  player1Health: number;
  player2Health: number;
  player1Energy: number;
  player2Energy: number;
  player1HandSize: number;
  player2HandSize: number;
  player1BattlefieldSize: number;
  player2BattlefieldSize: number;
  graveyardSize: number;
  deckSize: number;
  gameLogSize: number;
  gameStatus: string;
  turn: number;
}

/**
 * Capture current game state for comparison
 */
export function captureGameState(gameEngine: GameEngine, player1Id: AutomergeUrl, player2Id: AutomergeUrl): GameStateSnapshot {
  const doc = gameEngine.getGameDoc();
  const player1State = doc.playerStates.find(s => s.playerId === player1Id)!;
  const player2State = doc.playerStates.find(s => s.playerId === player2Id)!;
  const player1Hand = doc.playerHands.find(h => h.playerId === player1Id)!;
  const player2Hand = doc.playerHands.find(h => h.playerId === player2Id)!;
  const player1Battlefield = doc.playerBattlefields.find(b => b.playerId === player1Id)!;
  const player2Battlefield = doc.playerBattlefields.find(b => b.playerId === player2Id)!;
  
  return {
    player1Health: player1State.health,
    player2Health: player2State.health,
    player1Energy: player1State.energy,
    player2Energy: player2State.energy,
    player1HandSize: player1Hand.cards.length,
    player2HandSize: player2Hand.cards.length,
    player1BattlefieldSize: player1Battlefield.cards.length,
    player2BattlefieldSize: player2Battlefield.cards.length,
    graveyardSize: doc.graveyard.length,
    deckSize: doc.deck.length,
    gameLogSize: doc.gameLog.length,
    gameStatus: doc.status,
    turn: doc.turn
  };
}

/**
 * Assert that a specific state change occurred
 */
export function assertStateChange(
  _beforeState: GameStateSnapshot,
  afterState: GameStateSnapshot,
  expectedChanges: Partial<GameStateSnapshot>
): void {
  Object.entries(expectedChanges).forEach(([key, expectedValue]) => {
    const afterValue = afterState[key as keyof GameStateSnapshot];
    
    if (typeof expectedValue === 'number') {
      // For numeric changes, we can specify the expected final value
      expect(afterValue).toBe(expectedValue);
    } else {
      // For other types, just check equality
      expect(afterValue).toBe(expectedValue);
    }
  });
}

/**
 * Assert that a game log entry exists with specific content
 */
export function assertLogEntry(gameEngine: GameEngine, description: string, action?: string): void {
  const gameDoc = gameEngine.getGameDoc();
  const matchingEntry = gameDoc.gameLog.find(entry => 
    entry.description.includes(description) && 
    (action ? entry.action === action : true)
  );
  expect(matchingEntry).toBeDefined();
}

/**
 * Assert that a creature exists on battlefield with specific properties
 */
export function assertCreatureOnBattlefield(
  gameEngine: GameEngine, 
  playerId: AutomergeUrl, 
  expectedProperties: { 
    instanceId?: string; 
    currentHealth?: number; 
    sapped?: boolean; 
    cardUrl?: AutomergeUrl 
  }
): void {
  const gameDoc = gameEngine.getGameDoc();
  const battlefield = gameDoc.playerBattlefields.find(b => b.playerId === playerId);
  expect(battlefield).toBeDefined();
  
  const creature = battlefield!.cards.find(c => 
    (!expectedProperties.instanceId || c.instanceId === expectedProperties.instanceId) &&
    (!expectedProperties.cardUrl || c.cardUrl === expectedProperties.cardUrl)
  );
  
  expect(creature).toBeDefined();
  
  if (expectedProperties.currentHealth !== undefined) {
    expect(creature!.currentHealth).toBe(expectedProperties.currentHealth);
  }
  if (expectedProperties.sapped !== undefined) {
    expect(creature!.sapped).toBe(expectedProperties.sapped);
  }
}

/**
 * Assert that a card is in graveyard
 */
export function assertCardInGraveyard(gameEngine: GameEngine, cardUrl: AutomergeUrl): void {
  const gameDoc = gameEngine.getGameDoc();
  expect(gameDoc.graveyard).toContain(cardUrl);
}

/**
 * Assert that a card is in player's hand
 */
export function assertCardInHand(gameEngine: GameEngine, playerId: AutomergeUrl, cardUrl: AutomergeUrl): void {
  const gameDoc = gameEngine.getGameDoc();
  const playerHand = gameDoc.playerHands.find(h => h.playerId === playerId);
  expect(playerHand).toBeDefined();
  expect(playerHand!.cards).toContain(cardUrl);
}

/**
 * Assert that a card is NOT in player's hand
 */
export function assertCardNotInHand(gameEngine: GameEngine, playerId: AutomergeUrl, cardUrl: AutomergeUrl): void {
  const gameDoc = gameEngine.getGameDoc();
  const playerHand = gameDoc.playerHands.find(h => h.playerId === playerId);
  expect(playerHand).toBeDefined();
  expect(playerHand!.cards).not.toContain(cardUrl);
}
