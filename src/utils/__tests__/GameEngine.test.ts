import { describe, it, expect, beforeEach } from 'vitest';
import { AutomergeUrl } from '@automerge/automerge-repo';
import { GameEngine } from '../GameEngine';
import { create as createGame } from '../../docs/game';
import { CardDoc } from '../../docs/card';
import { Deck } from '../../docs/deck';
import {
  createTestGameSetup,
  createTestCreature,
  createTestSpell,
  createTestArtifact,
  createCompleteCardDoc,
  createCompleteDeck,
  addCardToHand,
  addCardsToDeck,
  setPlayerEnergy,
  captureGameState,
  assertStateChange,
  assertLogEntry,
  assertCreatureOnBattlefield,
  assertCardInGraveyard,
  assertCardInHand,
  assertCardNotInHand,
  mockSelectTargets,
  TestSetup
} from './testUtils';

describe('GameEngine', () => {
  let testSetup: TestSetup;
  let gameEngine: GameEngine;
  let player1Id: AutomergeUrl;
  let player2Id: AutomergeUrl;
  let testCard: { card: CardDoc; url: AutomergeUrl };

  beforeEach(() => {
    testSetup = createTestGameSetup({
      player1Energy: 5,
      player2Energy: 5
    });
    
    gameEngine = testSetup.gameEngine;
    player1Id = testSetup.player1Id;
    player2Id = testSetup.player2Id;
    
    // Create a test card
    testCard = createTestCreature(testSetup.repo, {
      name: 'Fire Bolt',
      cost: 2,
      attack: 3,
      health: 2,
      description: 'A fiery creature'
    });
    
    // Add card to player1's hand and deck
    addCardToHand(gameEngine, player1Id, testCard.url);
    addCardsToDeck(gameEngine, [testCard.url]);
  });

  describe('Basic Engine Operations', () => {
    it('should create a GameEngine instance', () => {
      expect(gameEngine).toBeInstanceOf(GameEngine);
      expect(gameEngine.getGameDoc()).toBeDefined();
      expect(gameEngine.getGameDocHandle()).toBeDefined();
      expect(gameEngine.getCardDefs()).toBeInstanceOf(Map);
    });

    it('should get current game state', () => {
      const gameDoc = gameEngine.getGameDoc();
      expect(gameDoc.players).toEqual([player1Id, player2Id]);
      expect(gameDoc.status).toBe('playing');
      expect(gameDoc.turn).toBe(1);
    });
  });

  describe('Card Playing', () => {
    it('should play a creature card successfully', async () => {
      const beforeState = captureGameState(gameEngine, player1Id, player2Id);
      
      const success = await gameEngine.playCard(player1Id, testCard.url);
      
      expect(success).toBe(true);
      
      const afterState = captureGameState(gameEngine, player1Id, player2Id);
      
      // Validate all expected state changes
      assertStateChange(beforeState, afterState, {
        player1HandSize: beforeState.player1HandSize - 1,
        player1BattlefieldSize: beforeState.player1BattlefieldSize + 1,
        player1Energy: beforeState.player1Energy - testCard.card.cost,
        gameLogSize: beforeState.gameLogSize + 1
      });
      
      // Validate specific game state
      assertCardNotInHand(gameEngine, player1Id, testCard.url);
      assertCreatureOnBattlefield(gameEngine, player1Id, { 
        cardUrl: testCard.url,
        currentHealth: testCard.card.health,
        sapped: true // Creatures start sapped
      });
      assertLogEntry(gameEngine, 'Played Fire Bolt', 'play_card');
    });

    it('should fail to play card with insufficient energy', async () => {
      // Set player energy to less than card cost
      setPlayerEnergy(gameEngine, player1Id, 1); // Less than card cost of 2
      
      const beforeState = captureGameState(gameEngine, player1Id, player2Id);
      
      const success = await gameEngine.playCard(player1Id, testCard.url);
      
      expect(success).toBe(false);
      
      const afterState = captureGameState(gameEngine, player1Id, player2Id);
      
      // Game state should be completely unchanged
      assertStateChange(beforeState, afterState, {
        player1HandSize: beforeState.player1HandSize,
        player1BattlefieldSize: beforeState.player1BattlefieldSize,
        player1Energy: beforeState.player1Energy,
        gameLogSize: beforeState.gameLogSize
      });
      
      // Card should still be in hand
      assertCardInHand(gameEngine, player1Id, testCard.url);
    });

    it('should play a spell card and add it to graveyard', async () => {
      // Create a simple spell
      const spell = createTestSpell(testSetup.repo, {
        name: 'Lightning Bolt',
        cost: 1,
        description: 'Deal 3 damage',
        spellEffect: 'async (api) => { api.log("Lightning strikes!"); return true; }'
      });
      
      // Add spell to player's hand
      addCardToHand(gameEngine, player1Id, spell.url);
      
      const beforeState = captureGameState(gameEngine, player1Id, player2Id);
      
      const success = await gameEngine.playCard(player1Id, spell.url, mockSelectTargets);
      
      expect(success).toBe(true);
      
      const afterState = captureGameState(gameEngine, player1Id, player2Id);
      
      // Validate state changes
      assertStateChange(beforeState, afterState, {
        player1HandSize: beforeState.player1HandSize - 1,
        player1Energy: beforeState.player1Energy - spell.card.cost,
        graveyardSize: beforeState.graveyardSize + 1,
        gameLogSize: beforeState.gameLogSize + 1 // Only cast log (spell effect adds its own)
      });
      
      // Spell should be in graveyard
      assertCardInGraveyard(gameEngine, spell.url);
      assertLogEntry(gameEngine, 'Lightning strikes!');
      // Check that a play_card log entry exists (exact text may vary)
      const gameDoc = gameEngine.getGameDoc();
      const playCardEntry = gameDoc.gameLog.find(entry => entry.action === 'play_card');
      expect(playCardEntry).toBeDefined();
    });
  });

  describe('Combat System', () => {
    let creatureInstanceId: string;
    
    beforeEach(async () => {
      // Add a creature to player1's battlefield for combat tests
      await gameEngine.playCard(player1Id, testCard.url);
      const gameDoc = gameEngine.getGameDoc();
      creatureInstanceId = gameDoc.playerBattlefields[0].cards[0].instanceId;
    });

    it('should attack player with creature', async () => {
      const beforeState = captureGameState(gameEngine, player1Id, player2Id);
      
      const success = await gameEngine.attackPlayerWithCreature(
        player1Id, 
        creatureInstanceId, 
        player2Id, 
        testCard.card.attack!
      );
      
      expect(success).toBe(true);
      
      const afterState = captureGameState(gameEngine, player1Id, player2Id);
      
      // Validate state changes
      assertStateChange(beforeState, afterState, {
        player2Health: beforeState.player2Health - testCard.card.attack!,
        gameLogSize: beforeState.gameLogSize + 2 // attack log + take_damage log
      });
      
      // Attacking creature should be sapped
      assertCreatureOnBattlefield(gameEngine, player1Id, { 
        instanceId: creatureInstanceId,
        sapped: true 
      });
      
      // Game log should record the attack
      assertLogEntry(gameEngine, 'attacked player', 'attack');
    });

    it('should handle creature vs creature combat', async () => {
      // Add a creature to player2's battlefield
      const defender = testSetup.repo.create<CardDoc>(createCompleteCardDoc({
        name: 'Defender',
        cost: 2,
        type: 'creature',
        attack: 2,
        health: 3,
        description: 'A defensive creature'
      }));
      const defenderUrl = defender.url;
      
      gameEngine.getGameDocHandle().change((doc) => {
        doc.playerHands[1].cards.push(defenderUrl);
      });
      
      await gameEngine.playCard(player2Id, defenderUrl);
      
      const gameDoc = gameEngine.getGameDoc();
      const attackerInstanceId = gameDoc.playerBattlefields[0].cards[0].instanceId;
      const defenderInstanceId = gameDoc.playerBattlefields[1].cards[0].instanceId;
      
      const success = await gameEngine.attackCreatureWithCreature(
        player1Id,
        attackerInstanceId,
        player2Id,
        defenderInstanceId
      );
      
      expect(success).toBe(true);
      
      const updatedGameDoc = gameEngine.getGameDoc();
      
      // Check if creatures are still alive or destroyed
      const attackerStillAlive = updatedGameDoc.playerBattlefields[0].cards.length > 0;
      const defenderStillAlive = updatedGameDoc.playerBattlefields[1].cards.length > 0;
      
      if (attackerStillAlive) {
        const attackerCard = updatedGameDoc.playerBattlefields[0].cards[0];
        expect(attackerCard.currentHealth).toBe(testCard.card.health! - defender.doc().attack!);
      } else {
        // Attacker was destroyed, should be in graveyard
        expect(updatedGameDoc.graveyard).toContain(testCard.url);
      }
      
      if (defenderStillAlive) {
        const defenderCard = updatedGameDoc.playerBattlefields[1].cards[0];
        expect(defenderCard.currentHealth).toBe(defender.doc().health! - testCard.card.attack!);
      } else {
        // Defender was destroyed, should be in graveyard
        expect(updatedGameDoc.graveyard).toContain(defenderUrl);
      }
      
      // Attacker should be sapped (if still alive)
      if (attackerStillAlive) {
        const attackerCard = updatedGameDoc.playerBattlefields[0].cards[0];
        expect(attackerCard.sapped).toBe(true);
      }
    });

    it('should destroy creatures when health reaches 0', async () => {
      // Create a weak creature that will die in one hit
      const weakCreature = testSetup.repo.create<CardDoc>(createCompleteCardDoc({
        name: 'Weak Creature',
        cost: 1,
        type: 'creature',
        attack: 1,
        health: 1,
        description: 'A weak creature'
      }));
      const weakUrl = weakCreature.url;
      
      gameEngine.getGameDocHandle().change((doc) => {
        doc.playerHands[1].cards.push(weakUrl);
      });
      
      await gameEngine.playCard(player2Id, weakUrl);
      
      const gameDoc = gameEngine.getGameDoc();
      const attackerInstanceId = gameDoc.playerBattlefields[0].cards[0].instanceId;
      const weakInstanceId = gameDoc.playerBattlefields[1].cards[0].instanceId;
      
      const initialGraveyardSize = gameDoc.graveyard.length;
      
      await gameEngine.attackCreatureWithCreature(
        player1Id,
        attackerInstanceId,
        player2Id,
        weakInstanceId
      );
      
      const updatedGameDoc = gameEngine.getGameDoc();
      // Weak creature should be destroyed and removed from battlefield
      expect(updatedGameDoc.playerBattlefields[1].cards.length).toBe(0);
      // Weak creature should be in graveyard
      expect(updatedGameDoc.graveyard.length).toBe(initialGraveyardSize + 1);
      expect(updatedGameDoc.graveyard).toContain(weakUrl);
    });
  });

  describe('Turn Management', () => {
    it('should end turn and advance to next player', async () => {
      // const initialTurn = gameEngine.getGameDoc().turn;
      const initialPlayerIndex = gameEngine.getGameDoc().currentPlayerIndex;
      
      await gameEngine.endPlayerTurn(player1Id);
      
      const gameDoc = gameEngine.getGameDoc();
      // Should advance to next player
      expect(gameDoc.currentPlayerIndex).toBe((initialPlayerIndex + 1) % gameDoc.players.length);
      // Game log should record turn end
      expect(gameDoc.gameLog.some(entry => entry.action === 'end_turn')).toBe(true);
    });

    it('should restore energy and draw card for next player', async () => {
      // Set next player's energy to less than max
      gameEngine.getGameDocHandle().change((doc) => {
        doc.playerStates[1].energy = 2; // Less than max of 5
      });
      
      const initialHandSize = gameEngine.getGameDoc().playerHands[1].cards.length;
      
      await gameEngine.endPlayerTurn(player1Id);
      
      const gameDoc = gameEngine.getGameDoc();
      // Next player should have full energy
      expect(gameDoc.playerStates[1].energy).toBe(gameDoc.playerStates[1].maxEnergy);
      // Next player should have drawn a card
      expect(gameDoc.playerHands[1].cards.length).toBe(initialHandSize + 1);
    });

    it('should heal creatures at end of turn', async () => {
      // Add a damaged creature
      await gameEngine.playCard(player1Id, testCard.url);
      
      gameEngine.getGameDocHandle().change((doc) => {
        doc.playerBattlefields[0].cards[0].currentHealth = 1; // Damage the creature
      });
      
      // Directly test the healCreatures function for player1
      await gameEngine.healCreatures(player1Id);
      
      const gameDoc = gameEngine.getGameDoc();
      // Creature should be healed by 1
      expect(gameDoc.playerBattlefields[0].cards[0].currentHealth).toBe(2); // Was 1, now 2 (max is 2)
    });
  });

  describe('Triggered Abilities', () => {
    it('should execute start_turn triggered abilities', async () => {
      // Create an artifact with start_turn ability
      const artifact = createTestArtifact(testSetup.repo, {
        name: 'Test Artifact',
        cost: 1,
        type: 'artifact',
        health: 1,
        description: 'A test artifact',
        triggeredAbilities: [{
          trigger: 'start_turn',
          effectCode: 'async (api) => { api.log("Start of turn effect!"); return true; }',
          description: 'Triggers at start of turn'
        }]
      });
      const artifactUrl = artifact.url;
      
      // Add artifact to battlefield
      gameEngine.getGameDocHandle().change((doc) => {
        doc.playerBattlefields[0].cards.push({
          instanceId: 'test-artifact-1',
          cardUrl: artifactUrl,
          sapped: false,
          currentHealth: 1
        });
      });
      
      // Mock the card loading for the artifact
      const artifactHandle = testSetup.repo.create<CardDoc>(artifact.card);
      gameEngine.getCardDefs().set(artifactUrl, artifactHandle);
      
      await gameEngine.executeTriggeredAbilities('start_turn', player1Id);
      
      const gameDoc = gameEngine.getGameDoc();
      // Should have a log entry from the triggered ability
      expect(gameDoc.gameLog.some(entry => 
        entry.description.includes('Start of turn effect!')
      )).toBe(true);
    });

    it('should execute deal_damage triggered abilities', async () => {
      // Create a creature with deal_damage ability
      const creature = testSetup.repo.create<CardDoc>(createCompleteCardDoc({
        name: 'Vampire',
        cost: 3,
        type: 'creature',
        attack: 2,
        health: 2,
        description: 'Heals when dealing damage',
        triggeredAbilities: [{
          trigger: 'deal_damage',
          effectCode: 'async (api) => { api.log("Vampire heals!"); return true; }',
          description: 'Heal when dealing damage'
        }]
      }));
      const creatureUrl = creature.url;
      
      // Add creature to battlefield
      gameEngine.getGameDocHandle().change((doc) => {
        doc.playerBattlefields[0].cards.push({
          instanceId: 'vampire-1',
          cardUrl: creatureUrl,
          sapped: false,
          currentHealth: 2
        });
      });
      
      await gameEngine.executeTriggeredAbilitiesForCreature(
        'deal_damage',
        player1Id,
        'vampire-1',
        undefined,
        { damageTarget: { playerId: player2Id }, damageAmount: 2 }
      );
      
      const gameDoc = gameEngine.getGameDoc();
      // Should have a log entry from the triggered ability
      expect(gameDoc.gameLog.some(entry => 
        entry.description.includes('Vampire heals!')
      )).toBe(true);
    });
  });

  describe('Game Creation Utilities', () => {
    it('should create game deck from deck document', async () => {
      // Create multiple test cards
      const card1 = testSetup.repo.create<CardDoc>(createCompleteCardDoc({ name: 'Card 1', cost: 1, type: 'creature', attack: 1, health: 1, description: 'Test card 1' }));
      const card2 = testSetup.repo.create<CardDoc>(createCompleteCardDoc({ name: 'Card 2', cost: 2, type: 'spell', description: 'Test card 2' }));
      
      // Create a deck with multiple copies
      const deckHandle = testSetup.repo.create<Deck>(createCompleteDeck({
        name: 'Test Deck',
        cards: [
          { cardUrl: card1.url, quantity: 3 },
          { cardUrl: card2.url, quantity: 2 }
        ]
      }));
      
      const gameDeck = await gameEngine.createGameDeckFromDeck(deckHandle.url);
      
      expect(gameDeck.length).toBe(5); // 3 + 2
      expect(gameDeck.filter(url => url === card1.url).length).toBe(3);
      expect(gameDeck.filter(url => url === card2.url).length).toBe(2);
    });

    it('should create rematch game', () => {
      const rematchHandle = gameEngine.createRematchGame();
      const rematchId = rematchHandle.url;
      
      expect(rematchId).toBeDefined();
      expect(typeof rematchId).toBe('string');
      
      const gameDoc = gameEngine.getGameDoc();
      expect(gameDoc.rematchGameId).toBe(rematchId);
    });

    it('should start game with deck', async () => {
      // Create a game with waiting status manually
      const waitingGameHandle = createGame(testSetup.repo, {
        createdAt: Date.now(),
        players: [player1Id, player2Id],
        status: 'waiting' as const,
        selectedDeckUrl: null,
        deck: [],
        playerHands: [],
        playerBattlefields: [],
        playerStates: [],
        graveyard: [],
        currentPlayerIndex: 0,
        turn: 0,
        gameLog: []
      });
      const waitingGameEngine = GameEngine.create(waitingGameHandle, testSetup.repo);
      
      // Create a test spell
      const testSpell = createTestSpell(testSetup.repo, {
        name: 'Test Spell',
        cost: 1,
        description: 'Test spell effect',
        spellEffect: 'async (api) => { api.log("Test spell!"); return true; }'
      });
      
      // Create a test deck with enough cards for dealing (5 cards per player = 10 total)
      const deckHandle = testSetup.repo.create({
        name: 'Test Deck',
        cards: [
          { cardUrl: testCard.url, quantity: 8 },
          { cardUrl: testSpell.url, quantity: 4 }
        ]
      });
      
      // Check initial state
      const beforeDoc = waitingGameEngine.getGameDoc();
      expect(beforeDoc.status).toBe('waiting');
      expect(beforeDoc.deck.length).toBe(0);
      
      const success = await waitingGameEngine.startGameWithDeck(deckHandle.url);
      
      expect(success).toBe(true);
      
      // Check final state
      const afterDoc = waitingGameEngine.getGameDoc();
      expect(afterDoc.status).toBe('playing');
      expect(afterDoc.deck.length).toBe(1); // 12 total - 10 dealt - 1 extra draw = 1 remaining
      expect(afterDoc.playerHands.length).toBe(2);
      expect(afterDoc.playerStates.length).toBe(2);
      // First player should have 6 cards (5 + 1 extra), second player should have 5
      expect(afterDoc.playerHands[0].cards.length).toBe(6);
      expect(afterDoc.playerHands[1].cards.length).toBe(5);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid card URLs gracefully', async () => {
      const success = await gameEngine.playCard(player1Id, 'invalid-card-url' as AutomergeUrl);
      expect(success).toBe(false);
    });

    it('should handle attacking with non-existent creature', async () => {
      const success = await gameEngine.attackPlayerWithCreature(
        player1Id,
        'non-existent-instance',
        player2Id,
        3
      );
      expect(success).toBe(false);
    });

    it('should handle spell casting errors gracefully', async () => {
      // Create a spell with invalid effect code
      const badSpell = testSetup.repo.create<CardDoc>(createCompleteCardDoc({
        name: 'Bad Spell',
        cost: 1,
        type: 'spell',
        description: 'A broken spell',
        spellEffect: 'async (api) => { throw new Error("Spell failed!"); }'
      }));
      
      gameEngine.getGameDocHandle().change((doc) => {
        doc.playerHands[0].cards.push(badSpell.url);
      });
      
      const success = await gameEngine.playCard(player1Id, badSpell.url, mockSelectTargets);
      expect(success).toBe(false);
    });
  });
});
