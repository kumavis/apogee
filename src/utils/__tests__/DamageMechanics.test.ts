import { describe, it, expect, beforeEach } from 'vitest';
import { AutomergeUrl } from '@automerge/automerge-repo';
import { GameEngine } from '../GameEngine';
import {
  createTestGameSetup,
  createTestCreature,
  createTestArtifact,
  addCardToBattlefield,
  captureGameState,
  assertStateChange,
  assertLogEntry,
  assertCreatureOnBattlefield,
  TestSetup
} from './testUtils';

describe('Damage Mechanics', () => {
  let testSetup: TestSetup;
  let gameEngine: GameEngine;
  let player1Id: AutomergeUrl;
  let player2Id: AutomergeUrl;

  beforeEach(() => {
    testSetup = createTestGameSetup();
    gameEngine = testSetup.gameEngine;
    player1Id = testSetup.player1Id;
    player2Id = testSetup.player2Id;
  });

  describe('Player Damage', () => {
    it('should deal damage to player and reduce health', async () => {
      const attacker = createTestCreature(testSetup.repo, {
        name: 'Fire Elemental',
        cost: 3,
        attack: 4,
        health: 3,
        description: 'A fiery attacker'
      });
      
      const instanceId = addCardToBattlefield(gameEngine, player1Id, attacker.url, undefined, {
        currentHealth: 3,
        sapped: false
      });
      
      const beforeState = captureGameState(gameEngine, player1Id, player2Id);
      
      const success = await gameEngine.attackPlayerWithCreature(player1Id, instanceId, player2Id, 4);
      
      expect(success).toBe(true);
      
      const afterState = captureGameState(gameEngine, player1Id, player2Id);
      
      // Validate state changes
      assertStateChange(beforeState, afterState, {
        player2Health: beforeState.player2Health - 4,
        gameLogSize: beforeState.gameLogSize + 2 // attack log + take_damage log
      });
      
      // Validate specific health value
      expect(afterState.player2Health).toBe(21); // 25 - 4
      
      // Attacker should be sapped
      assertCreatureOnBattlefield(gameEngine, player1Id, {
        instanceId,
        sapped: true
      });
      
      // Should have attack log entry
      assertLogEntry(gameEngine, 'Fire Elemental attacked player', 'attack');
    });

    it('should end game when player health reaches 0', async () => {
      // Set player2 health to low value
      gameEngine.getGameDocHandle().change((doc) => {
        doc.playerStates[1].health = 3;
      });
      
      const attacker = createTestCreature(testSetup.repo, {
        name: 'Finisher',
        cost: 5,
        attack: 5,
        health: 5,
        description: 'Game ending creature'
      });
      
      addCardToBattlefield(gameEngine, player1Id, attacker.url, 'finisher-1', { currentHealth: 5 });
      
      await gameEngine.attackPlayerWithCreature(player1Id, 'finisher-1', player2Id, 5);
      
      const gameDoc = gameEngine.getGameDoc();
      expect(gameDoc.playerStates[1].health).toBe(0);
      expect(gameDoc.status).toBe('finished');
      
      // Should have game end log entry
      expect(gameDoc.gameLog.some(entry => 
        entry.action === 'game_end' && entry.description === 'Player defeated'
      )).toBe(true);
    });

    it('should not reduce health below 0', async () => {
      // Set player2 health to 2
      gameEngine.getGameDocHandle().change((doc) => {
        doc.playerStates[1].health = 2;
      });
      
      const attacker = createTestCreature(testSetup.repo, {
        name: 'Overkill',
        cost: 4,
        attack: 10,
        health: 4,
        description: 'Massive damage'
      });
      
      addCardToBattlefield(gameEngine, player1Id, attacker.url, 'overkill-1', { currentHealth: 4 });
      
      await gameEngine.attackPlayerWithCreature(player1Id, 'overkill-1', player2Id, 10);
      
      const gameDoc = gameEngine.getGameDoc();
      expect(gameDoc.playerStates[1].health).toBe(0); // Should be 0, not negative
    });
  });

  describe('Creature Damage', () => {
    it('should deal damage to creature and reduce current health', async () => {
      const attacker = createTestCreature(testSetup.repo, {
        name: 'Attacker',
        cost: 2,
        type: 'creature',
        attack: 3,
        health: 2,
        description: 'Attacking creature'
      });
      
      const defender = createTestCreature(testSetup.repo, {
        name: 'Defender',
        cost: 3,
        type: 'creature',
        attack: 1,
        health: 5,
        description: 'Defending creature'
      });
      
      addCardToBattlefield(gameEngine, player1Id, attacker.url, 'attacker-1', { currentHealth: 2 });
      addCardToBattlefield(gameEngine, player2Id, defender.url, 'defender-1', { currentHealth: 5 });
      
      await gameEngine.attackCreatureWithCreature(
        player1Id, 'attacker-1', 
        player2Id, 'defender-1'
      );
      
      const gameDoc = gameEngine.getGameDoc();
      const defenderCard = gameDoc.playerBattlefields[1].cards[0];
      const attackerCard = gameDoc.playerBattlefields[0].cards[0];
      
      expect(defenderCard.currentHealth).toBe(2); // 5 - 3 = 2
      expect(attackerCard.currentHealth).toBe(1); // 2 - 1 = 1
    });

    it('should destroy creature when health reaches 0', async () => {
      const attacker = createTestCreature(testSetup.repo, {
        name: 'Strong Attacker',
        cost: 4,
        type: 'creature',
        attack: 5,
        health: 4,
        description: 'Very strong creature'
      });
      
      const weakDefender = createTestCreature(testSetup.repo, {
        name: 'Weak Defender',
        cost: 1,
        type: 'creature',
        attack: 1,
        health: 2,
        description: 'Weak creature'
      });
      
      addCardToBattlefield(gameEngine, player1Id, attacker.url, 'strong-1', { currentHealth: 4 });
      addCardToBattlefield(gameEngine, player2Id, weakDefender.url, 'weak-1', { currentHealth: 2 });
      
      const initialGraveyardSize = gameEngine.getGameDoc().graveyard.length;
      
      await gameEngine.attackCreatureWithCreature(
        player1Id, 'strong-1',
        player2Id, 'weak-1'
      );
      
      const gameDoc = gameEngine.getGameDoc();
      
      // Weak defender should be destroyed and removed from battlefield
      expect(gameDoc.playerBattlefields[1].cards.length).toBe(0);
      
      // Weak defender should be in graveyard
      expect(gameDoc.graveyard.length).toBe(initialGraveyardSize + 1);
      // Check if the weak defender is in graveyard by checking instance mapping
      const hasWeakDefenderInGraveyard = gameDoc.graveyard.some(instanceId => 
        gameDoc.instanceToCardUrl[instanceId] === weakDefender.url
      );
      expect(hasWeakDefenderInGraveyard).toBe(true);
      
      // Strong attacker should still be alive but damaged
      expect(gameDoc.playerBattlefields[0].cards.length).toBe(1);
      expect(gameDoc.playerBattlefields[0].cards[0].currentHealth).toBe(3); // 4 - 1 = 3
    });

    it('should handle mutual destruction in combat', async () => {
      const creature1 = createTestCreature(testSetup.repo, {
        name: 'Creature 1',
        cost: 3,
        type: 'creature',
        attack: 3,
        health: 2,
        description: 'First creature'
      });
      
      const creature2 = createTestCreature(testSetup.repo, {
        name: 'Creature 2',
        cost: 3,
        type: 'creature',
        attack: 2,
        health: 3,
        description: 'Second creature'
      });
      
      addCardToBattlefield(gameEngine, player1Id, creature1.url, 'creature1-1', { currentHealth: 2 });
      addCardToBattlefield(gameEngine, player2Id, creature2.url, 'creature2-1', { currentHealth: 3 });
      
      const initialGraveyardSize = gameEngine.getGameDoc().graveyard.length;
      
      await gameEngine.attackCreatureWithCreature(
        player1Id, 'creature1-1',
        player2Id, 'creature2-1'
      );
      
      const gameDoc = gameEngine.getGameDoc();
      
      // Both creatures should be destroyed
      expect(gameDoc.playerBattlefields[0].cards.length).toBe(0);
      expect(gameDoc.playerBattlefields[1].cards.length).toBe(0);
      
      // Both should be in graveyard
      expect(gameDoc.graveyard.length).toBe(initialGraveyardSize + 2);
      // Check if both creatures are in graveyard by checking instance mapping
      const hasCreature1InGraveyard = gameDoc.graveyard.some(instanceId => 
        gameDoc.instanceToCardUrl[instanceId] === creature1.url
      );
      const hasCreature2InGraveyard = gameDoc.graveyard.some(instanceId => 
        gameDoc.instanceToCardUrl[instanceId] === creature2.url
      );
      expect(hasCreature1InGraveyard).toBe(true);
      expect(hasCreature2InGraveyard).toBe(true);
    });

    it('should handle artifact combat (artifacts don\'t fight back)', async () => {
      const attacker = createTestCreature(testSetup.repo, {
        name: 'Creature Attacker',
        cost: 3,
        type: 'creature',
        attack: 4,
        health: 3,
        description: 'Attacking creature'
      });
      
      const artifact = createTestArtifact(testSetup.repo, {
        name: 'Defensive Artifact',
        cost: 4,
        type: 'artifact',
        health: 3,
        description: 'Artifact with no attack'
      });
      
      gameEngine.getGameDocHandle().change((doc) => {
        doc.playerBattlefields[0].cards.push({
          instanceId: 'attacker-1',
          cardUrl: attacker.url,
          sapped: false,
          currentHealth: 3
        });
        doc.playerBattlefields[1].cards.push({
          instanceId: 'artifact-1',
          cardUrl: artifact.url,
          sapped: false,
          currentHealth: 3
        });
        // Add to instance mapping
        doc.instanceToCardUrl['attacker-1'] = attacker.url;
        doc.instanceToCardUrl['artifact-1'] = artifact.url;
      });
      
      await gameEngine.attackCreatureWithCreature(
        player1Id, 'attacker-1',
        player2Id, 'artifact-1'
      );
      
      const gameDoc = gameEngine.getGameDoc();
      
      // Artifact should be destroyed (3 health - 4 attack = destroyed)
      expect(gameDoc.playerBattlefields[1].cards.length).toBe(0);
      // Check if the artifact is in graveyard by checking instance mapping
      const hasArtifactInGraveyard = gameDoc.graveyard.some(instanceId => 
        gameDoc.instanceToCardUrl[instanceId] === artifact.url
      );
      expect(hasArtifactInGraveyard).toBe(true);
      
      // Attacker should be unharmed (artifacts don't fight back)
      expect(gameDoc.playerBattlefields[0].cards.length).toBe(1);
      expect(gameDoc.playerBattlefields[0].cards[0].currentHealth).toBe(3); // Unchanged
    });
  });

  describe('Healing Mechanics', () => {
    it('should heal creatures at end of turn', async () => {
      const creature = createTestCreature(testSetup.repo, {
        name: 'Healing Creature',
        cost: 3,
        type: 'creature',
        attack: 2,
        health: 4,
        description: 'A creature that can heal'
      });
      
      addCardToBattlefield(gameEngine, player1Id, creature.url, undefined, { currentHealth: 2 });
      
      await gameEngine.healCreatures(player1Id);
      
      const gameDoc = gameEngine.getGameDoc();
      const healedCreature = gameDoc.playerBattlefields[0].cards[0];
      
      expect(healedCreature.currentHealth).toBe(3); // 2 + 1 = 3
    });

    it('should not heal creatures above max health', async () => {
      const creature = createTestCreature(testSetup.repo, {
        name: 'Full Health Creature',
        cost: 2,
        type: 'creature',
        attack: 2,
        health: 3,
        description: 'A creature at full health'
      });
      
      addCardToBattlefield(gameEngine, player1Id, creature.url, undefined, { currentHealth: 3 });
      
      await gameEngine.healCreatures(player1Id);
      
      const gameDoc = gameEngine.getGameDoc();
      const creature1 = gameDoc.playerBattlefields[0].cards[0];
      
      expect(creature1.currentHealth).toBe(3); // Should remain at max
    });

    it('should not heal artifacts', async () => {
      const artifact = createTestArtifact(testSetup.repo, {
        name: 'Damaged Artifact',
        cost: 3,
        type: 'artifact',
        health: 4,
        description: 'An artifact that doesn\'t heal'
      });
      
      addCardToBattlefield(gameEngine, player1Id, artifact.url, undefined, { currentHealth: 2 });
      
      await gameEngine.healCreatures(player1Id);
      
      const gameDoc = gameEngine.getGameDoc();
      const artifactCard = gameDoc.playerBattlefields[0].cards[0];
      
      expect(artifactCard.currentHealth).toBe(2); // Should remain damaged
    });
  });

  describe('Edge Cases', () => {
    it('should handle 0 attack creatures', async () => {
      const zeroAttacker = createTestCreature(testSetup.repo, {
        name: 'Pacifist',
        cost: 2,
        type: 'creature',
        attack: 0,
        health: 3,
        description: 'A creature with no attack'
      });
      
      const defender = createTestCreature(testSetup.repo, {
        name: 'Defender',
        cost: 2,
        type: 'creature',
        attack: 2,
        health: 2,
        description: 'Normal defender'
      });
      
      addCardToBattlefield(gameEngine, player1Id, zeroAttacker.url, 'pacifist-1', { currentHealth: 3 });
      addCardToBattlefield(gameEngine, player2Id, defender.url, 'defender-1', { currentHealth: 2 });
      
      await gameEngine.attackCreatureWithCreature(
        player1Id, 'pacifist-1',
        player2Id, 'defender-1'
      );
      
      const gameDoc = gameEngine.getGameDoc();
      
      // Defender should be unharmed (0 damage)
      expect(gameDoc.playerBattlefields[1].cards[0].currentHealth).toBe(2);
      
      // Pacifist should take damage from defender
      expect(gameDoc.playerBattlefields[0].cards[0].currentHealth).toBe(1); // 3 - 2 = 1
    });

    it('should handle very high damage values', async () => {
      const megaAttacker = createTestCreature(testSetup.repo, {
        name: 'Mega Attacker',
        cost: 10,
        type: 'creature',
        attack: 1000,
        health: 1,
        description: 'Extremely powerful creature'
      });
      
      addCardToBattlefield(gameEngine, player1Id, megaAttacker.url, 'mega-1', { currentHealth: 1 });
      
      await gameEngine.attackPlayerWithCreature(player1Id, 'mega-1', player2Id, 1000);
      
      const gameDoc = gameEngine.getGameDoc();
      expect(gameDoc.playerStates[1].health).toBe(0); // Should be 0, not negative
      expect(gameDoc.status).toBe('finished');
    });
  });
});
