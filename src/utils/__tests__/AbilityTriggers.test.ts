import { describe, it, expect, beforeEach } from 'vitest';
import { AutomergeUrl } from '@automerge/react';
import { GameEngine } from '../GameEngine';
import {
  createTestGameSetup,
  createTestCreature,
  createTestArtifact,
  createTestSpell,
  mockSelectTargets,
  TestSetup
} from './testUtils';

describe('Ability Triggers', () => {
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

  describe('Start Turn Triggers', () => {
    it('should trigger start_turn abilities when turn begins', async () => {
      const { url: artifactUrl } = createTestArtifact(testSetup.repo, {
        name: 'Energy Generator',
        cost: 3,
        health: 2,
        description: 'Generates energy at start of turn',
        triggeredAbilities: [{
          trigger: 'start_turn',
          effectCode: 'async (api) => { api.gainEnergy(1); api.log("Generated 1 energy"); return true; }',
          description: 'Gain 1 energy at start of turn'
        }]
      });
      
      gameEngine.getGameDocHandle().change((doc) => {
        doc.playerBattlefields[0].cards.push({
          instanceId: 'generator-1',
          cardUrl: artifactUrl,
          sapped: false,
          currentHealth: 2
        });
      });
      
      await gameEngine.executeTriggeredAbilities('start_turn', player1Id);
      
      const gameDoc = gameEngine.getGameDoc();
      
      // Should have gained energy (through the special log operation)
      expect(gameDoc.gameLog.some(entry => 
        entry.description.includes('Generated 1 energy')
      )).toBe(true);
      
      // Should have ability execution log
      expect(gameDoc.gameLog.some(entry => 
        entry.description.includes('Energy Generator: Gain 1 energy at start of turn')
      )).toBe(true);
    });

    it('should trigger multiple start_turn abilities', async () => {
      const { url: artifact1Url } = createTestArtifact(testSetup.repo, {
        name: 'Card Draw Engine',
        cost: 4,
        health: 3,
        description: 'Draws cards at start of turn',
        triggeredAbilities: [{
          trigger: 'start_turn',
          effectCode: 'async (api) => { api.drawCard(); api.log("Drew a card"); return true; }',
          description: 'Draw a card at start of turn'
        }]
      });
      
      const { url: artifact2Url } = createTestArtifact(testSetup.repo, {
        name: 'Health Fountain',
        cost: 2,
        health: 1,
        description: 'Heals at start of turn',
        triggeredAbilities: [{
          trigger: 'start_turn',
          effectCode: 'async (api) => { api.healPlayer(api.ownerId, 2); api.log("Healed 2 health"); return true; }',
          description: 'Heal 2 health at start of turn'
        }]
      });
      
      gameEngine.getGameDocHandle().change((doc) => {
        doc.playerBattlefields[0].cards.push(
          {
            instanceId: 'drawer-1',
            cardUrl: artifact1Url,
            sapped: false,
            currentHealth: 3
          },
          {
            instanceId: 'healer-1',
            cardUrl: artifact2Url,
            sapped: false,
            currentHealth: 1
          }
        );
      });
      
      await gameEngine.executeTriggeredAbilities('start_turn', player1Id);
      
      const gameDoc = gameEngine.getGameDoc();
      
      // Both abilities should have triggered
      expect(gameDoc.gameLog.some(entry => 
        entry.description.includes('Card Draw Engine')
      )).toBe(true);
      
      expect(gameDoc.gameLog.some(entry => 
        entry.description.includes('Health Fountain')
      )).toBe(true);
    });
  });

  describe('End Turn Triggers', () => {
    it('should trigger end_turn abilities when turn ends', async () => {
      const { url: creatureUrl } = createTestCreature(testSetup.repo, {
        name: 'Night Stalker',
        cost: 4,
        attack: 3,
        health: 3,
        description: 'Gains power at end of turn',
        triggeredAbilities: [{
          trigger: 'end_turn',
          effectCode: 'async (api) => { api.log("Night Stalker grows stronger in darkness"); return true; }',
          description: 'Grows stronger at end of turn'
        }]
      });
      
      gameEngine.getGameDocHandle().change((doc) => {
        doc.playerBattlefields[0].cards.push({
          instanceId: 'stalker-1',
          cardUrl: creatureUrl,
          sapped: false,
          currentHealth: 3
        });
      });
      
      await gameEngine.executeTriggeredAbilities('end_turn', player1Id);
      
      const gameDoc = gameEngine.getGameDoc();
      
      expect(gameDoc.gameLog.some(entry => 
        entry.description.includes('Night Stalker grows stronger in darkness')
      )).toBe(true);
    });
  });

  describe('Play Card Triggers', () => {
    it('should trigger play_card abilities when cards are played', async () => {
      const { url: artifactUrl } = createTestArtifact(testSetup.repo, {
        name: 'Energy Collector',
        cost: 2,
        health: 1,
        description: 'Gains energy when opponents play cards',
        triggeredAbilities: [{
          trigger: 'play_card',
          effectCode: 'async (api) => { api.gainEnergy(1); api.log("Collected energy from opponent\'s spell"); return true; }',
          description: 'Gain energy when opponents play cards'
        }]
      });
      
      // Add artifact to player2's battlefield
      gameEngine.getGameDocHandle().change((doc) => {
        doc.playerBattlefields[1].cards.push({
          instanceId: 'collector-1',
          cardUrl: artifactUrl,
          sapped: false,
          currentHealth: 1
        });
      });
      
      // Create a card for player1 to play
      const testCard = createTestSpell(testSetup.repo, {
        name: 'Test Spell',
        cost: 1,
        description: 'A simple test spell',
        spellEffect: 'async (api) => { api.log("Test spell!"); return true; }'
      });
      
      gameEngine.getGameDocHandle().change((doc) => {
        doc.playerHands[0].cards.push(testCard.url);
      });
      
      // Player1 plays a card, should trigger player2's artifact
      await gameEngine.playCard(player1Id, testCard.url, mockSelectTargets);
      
      const gameDoc = gameEngine.getGameDoc();
      
      // Should have triggered the energy collector
      expect(gameDoc.gameLog.some(entry => 
        entry.description.includes('Energy Collector')
      )).toBe(true);
    });
  });

  describe('Deal Damage Triggers', () => {
    it('should trigger deal_damage abilities when creature deals damage', async () => {
      const { url: vampireUrl } = createTestCreature(testSetup.repo, {
        name: 'Vampire Lord',
        cost: 4,
        attack: 3,
        health: 3,
        description: 'Heals when dealing damage',
        triggeredAbilities: [{
          trigger: 'deal_damage',
          effectCode: 'async (api) => { api.healCreature(api.ownerId, api.instanceId, 1); api.log("Vampire feeds and heals"); return true; }',
          description: 'Heal 1 when dealing damage'
        }]
      });
      
      gameEngine.getGameDocHandle().change((doc) => {
        doc.playerBattlefields[0].cards.push({
          instanceId: 'vampire-1',
          cardUrl: vampireUrl,
          sapped: false,
          currentHealth: 2 // Damaged vampire
        });
      });
      
      // Trigger deal_damage ability
      await gameEngine.executeTriggeredAbilitiesForCreature(
        'deal_damage',
        player1Id,
        'vampire-1',
        mockSelectTargets,
        { 
          damageTarget: { playerId: player2Id }, 
          damageAmount: 3 
        }
      );
      
      const gameDoc = gameEngine.getGameDoc();
      
      // Should have triggered the vampire's healing ability
      expect(gameDoc.gameLog.some(entry => 
        entry.description.includes('Vampire feeds and heals')
      )).toBe(true);
      
      // Vampire should be healed
      const vampireCard = gameDoc.playerBattlefields[0].cards[0];
      expect(vampireCard.currentHealth).toBe(3); // 2 + 1 = 3
    });

    it('should trigger deal_damage abilities during combat', async () => {
      const { url: lifestealUrl } = createTestCreature(testSetup.repo, {
        name: 'Lifesteal Creature',
        cost: 3,
        attack: 2,
        health: 2,
        description: 'Heals owner when dealing damage',
        triggeredAbilities: [{
          trigger: 'deal_damage',
          effectCode: 'async (api) => { api.healPlayer(api.ownerId, api.triggerContext?.damageAmount || 0); api.log("Lifesteal heals owner"); return true; }',
          description: 'Heal owner for damage dealt'
        }]
      });
      
      const { url: targetUrl } = createTestCreature(testSetup.repo, {
        name: 'Target Dummy',
        cost: 2,
        attack: 0,
        health: 5,
        description: 'A practice target'
      });
      
      gameEngine.getGameDocHandle().change((doc) => {
        doc.playerBattlefields[0].cards.push({
          instanceId: 'lifesteal-1',
          cardUrl: lifestealUrl,
          sapped: false,
          currentHealth: 2
        });
        doc.playerBattlefields[1].cards.push({
          instanceId: 'dummy-1',
          cardUrl: targetUrl,
          sapped: false,
          currentHealth: 5
        });
        // Damage player1 to test healing
        doc.playerStates[0].health = 20;
      });
      
      const initialHealth = gameEngine.getGameDoc().playerStates[0].health;
      
      await gameEngine.attackCreatureWithCreature(
        player1Id, 'lifesteal-1',
        player2Id, 'dummy-1'
      );
      
      const gameDoc = gameEngine.getGameDoc();
      
      // Should have triggered lifesteal
      expect(gameDoc.gameLog.some(entry => 
        entry.description.includes('Lifesteal heals owner')
      )).toBe(true);
      
      // Player should be healed
      expect(gameDoc.playerStates[0].health).toBe(initialHealth + 2); // Healed for damage dealt
    });
  });

  describe('Take Damage Triggers', () => {
    it('should trigger take_damage abilities when creature takes damage', async () => {
      const { url: berserkerUrl } = createTestCreature(testSetup.repo, {
        name: 'Berserker',
        cost: 3,
        attack: 2,
        health: 4,
        description: 'Gets angry when hurt',
        triggeredAbilities: [{
          trigger: 'take_damage',
          effectCode: 'async (api) => { api.log("Berserker enters rage mode!"); return true; }',
          description: 'Enters rage when damaged'
        }]
      });
      
      gameEngine.getGameDocHandle().change((doc) => {
        doc.playerBattlefields[0].cards.push({
          instanceId: 'berserker-1',
          cardUrl: berserkerUrl,
          sapped: false,
          currentHealth: 4
        });
      });
      
      // Trigger take_damage ability
      await gameEngine.executeTriggeredAbilitiesForCreature(
        'take_damage',
        player1Id,
        'berserker-1',
        mockSelectTargets,
        { 
          damageAmount: 2 
        }
      );
      
      const gameDoc = gameEngine.getGameDoc();
      
      // Should have triggered the berserker's rage
      expect(gameDoc.gameLog.some(entry => 
        entry.description.includes('Berserker enters rage mode!')
      )).toBe(true);
    });

    it('should trigger artifact take_damage abilities when damaged by spells', async () => {
      // Create an artifact that draws a card when damaged
      const resilientArtifact = createTestArtifact(testSetup.repo, {
        name: 'Resilient Artifact',
        cost: 4,
        health: 3,
        description: 'Draws a card when damaged',
        triggeredAbilities: [{
          trigger: 'take_damage',
          effectCode: 'async (api) => { api.drawCard(); api.log("Resilient Artifact draws from pain"); return true; }',
          description: 'Draw a card when taking damage'
        }]
      });

      // Create a spell that damages all creatures and artifacts
      const damageAllSpell = createTestSpell(testSetup.repo, {
        name: 'Shockwave',
        cost: 3,
        type: 'spell',
        description: 'Deal 1 damage to all creatures and artifacts',
        spellEffect: `async (api) => {
          const allPlayers = api.getAllPlayers();
          for (const playerId of allPlayers) {
            const creatures = api.getCreaturesForPlayer(playerId);
            for (const creature of creatures) {
              api.dealDamageToCreature(playerId, creature.instanceId, 1);
            }
          }
          api.log("Shockwave damages all!");
          return true;
        }`
      });

      // Add artifact to battlefield and spell to hand
      gameEngine.getGameDocHandle().change((doc) => {
        doc.playerBattlefields[0].cards.push({
          instanceId: 'artifact-1',
          cardUrl: resilientArtifact.url,
          sapped: false,
          currentHealth: 3
        });
        doc.playerHands[0].cards.push(damageAllSpell.url);
        // Add a card to deck so the artifact can draw
        doc.deck.push(resilientArtifact.url); // Just reuse the artifact URL as a dummy card
      });

      const initialHandSize = gameEngine.getGameDoc().playerHands[0].cards.length;
      const initialArtifactHealth = gameEngine.getGameDoc().playerBattlefields[0].cards[0].currentHealth;

      // Cast the damage spell
      await gameEngine.playCard(player1Id, damageAllSpell.url, mockSelectTargets);

      const gameDoc = gameEngine.getGameDoc();

      // Artifact should have taken damage
      expect(gameDoc.playerBattlefields[0].cards[0].currentHealth).toBe(initialArtifactHealth - 1);

      // Should have spell cast log
      expect(gameDoc.gameLog.some(entry => 
        entry.description.includes('Shockwave damages all!')
      )).toBe(true);

      // The artifact's take_damage ability should have been automatically triggered by the spell
      expect(gameDoc.gameLog.some(entry => 
        entry.description.includes('Resilient Artifact draws from pain')
      )).toBe(true);

      // Player should have drawn a card (hand size increased)
      expect(gameDoc.playerHands[0].cards.length).toBe(initialHandSize); // -1 for spell cast, +1 for draw = same
    });
  });

  describe('Complex Ability Interactions', () => {
    it('should handle multiple abilities on the same creature', async () => {
      const { url: complexCreatureUrl } = createTestCreature(testSetup.repo, {
        name: 'Elder Dragon',
        cost: 8,
        attack: 5,
        health: 5,
        description: 'A creature with multiple abilities',
        triggeredAbilities: [
          {
            trigger: 'start_turn',
            effectCode: 'async (api) => { api.drawCard(); api.log("Dragon draws ancient knowledge"); return true; }',
            description: 'Draw card at start of turn'
          },
          {
            trigger: 'deal_damage',
            effectCode: 'async (api) => { api.gainEnergy(1); api.log("Dragon channels power from destruction"); return true; }',
            description: 'Gain energy when dealing damage'
          },
          {
            trigger: 'take_damage',
            effectCode: 'async (api) => { api.log("Dragon\'s scales harden"); return true; }',
            description: 'Harden when taking damage'
          }
        ]
      });
      
      gameEngine.getGameDocHandle().change((doc) => {
        doc.playerBattlefields[0].cards.push({
          instanceId: 'dragon-1',
          cardUrl: complexCreatureUrl,
          sapped: false,
          currentHealth: 5
        });
      });
      
      // Test start_turn trigger
      await gameEngine.executeTriggeredAbilities('start_turn', player1Id);
      
      // Test deal_damage trigger
      await gameEngine.executeTriggeredAbilitiesForCreature(
        'deal_damage',
        player1Id,
        'dragon-1',
        mockSelectTargets,
        { damageTarget: { playerId: player2Id }, damageAmount: 5 }
      );
      
      // Test take_damage trigger
      await gameEngine.executeTriggeredAbilitiesForCreature(
        'take_damage',
        player1Id,
        'dragon-1',
        mockSelectTargets,
        { damageAmount: 3 }
      );
      
      const gameDoc = gameEngine.getGameDoc();
      
      // All three abilities should have triggered
      expect(gameDoc.gameLog.some(entry => 
        entry.description.includes('Dragon draws ancient knowledge')
      )).toBe(true);
      
      expect(gameDoc.gameLog.some(entry => 
        entry.description.includes('Dragon channels power from destruction')
      )).toBe(true);
      
      expect(gameDoc.gameLog.some(entry => 
        entry.description.includes('Dragon\'s scales harden')
      )).toBe(true);
    });

    it('should handle ability chains (abilities triggering other abilities)', async () => {
      const { url: chainStarterUrl } = createTestSpell(testSetup.repo, {
        name: 'Chain Lightning',
        cost: 3,
        description: 'Damages and triggers chain reactions',
        spellEffect: 'async (api) => { api.dealDamageToPlayer(api.getAllPlayers()[1], 2); api.dealDamageToCreature(api.getAllPlayers()[1], "rod-1", 1); api.log("Lightning strikes!"); return true; }'
      });
      
      const { url: chainReactorUrl } = createTestArtifact(testSetup.repo, {
        name: 'Lightning Rod',
        cost: 2,
        health: 2,
        description: 'Reacts to damage',
        triggeredAbilities: [{
          trigger: 'take_damage',
          effectCode: 'async (api) => { api.dealDamageToPlayer(api.getAllPlayers()[0], 1); api.log("Lightning Rod redirects energy"); return true; }',
          description: 'Redirect damage when hurt'
        }]
      });
      
      // Add chain reactor to player2's battlefield
      gameEngine.getGameDocHandle().change((doc) => {
        doc.playerBattlefields[1].cards.push({
          instanceId: 'rod-1',
          cardUrl: chainReactorUrl,
          sapped: false,
          currentHealth: 2
        });
        // Add chain lightning to player1's hand
        doc.playerHands[0].cards.push(chainStarterUrl);
      });
      
      const initialP1Health = gameEngine.getGameDoc().playerStates[0].health;
      const initialP2Health = gameEngine.getGameDoc().playerStates[1].health;
      
      // Cast the chain lightning spell
      await gameEngine.playCard(player1Id, chainStarterUrl, mockSelectTargets);
      
      const gameDoc = gameEngine.getGameDoc();
      
      // Player2 should have taken damage from the spell
      expect(gameDoc.playerStates[1].health).toBe(initialP2Health - 2);
      // Player1 should have taken damage from the rod
      expect(gameDoc.playerStates[0].health).toBe(initialP1Health - 1);
      
      // Should have spell cast log
      expect(gameDoc.gameLog.some(entry => 
        entry.description.includes('Lightning strikes!')
      )).toBe(true);
    });
  });

  describe('Ability Error Handling', () => {
    it('should handle abilities with invalid code gracefully', async () => {
      const { url: brokenArtifactUrl } = createTestArtifact(testSetup.repo, {
        name: 'Broken Artifact',
        cost: 1,
        health: 1,
        description: 'An artifact with broken code',
        triggeredAbilities: [{
          trigger: 'start_turn',
          effectCode: 'async (api) => { throw new Error("Broken ability!"); }',
          description: 'Broken ability'
        }]
      });
      
      gameEngine.getGameDocHandle().change((doc) => {
        doc.playerBattlefields[0].cards.push({
          instanceId: 'broken-1',
          cardUrl: brokenArtifactUrl,
          sapped: false,
          currentHealth: 1
        });
      });
      
      // Should not throw error, should handle gracefully
      await expect(gameEngine.executeTriggeredAbilities('start_turn', player1Id)).resolves.not.toThrow();
      
      // Game should continue normally
      const gameDoc = gameEngine.getGameDoc();
      expect(gameDoc.status).toBe('playing');
    });

    it('should continue executing other abilities even if one fails', async () => {
      const { url: brokenArtifactUrl } = createTestArtifact(testSetup.repo, {
        name: 'Broken Artifact',
        cost: 1,
        health: 1,
        description: 'An artifact with broken code',
        triggeredAbilities: [{
          trigger: 'start_turn',
          effectCode: 'async (api) => { throw new Error("Broken!"); }',
          description: 'Broken ability'
        }]
      });
      
      const { url: workingArtifactUrl } = createTestArtifact(testSetup.repo, {
        name: 'Working Artifact',
        cost: 1,
        health: 1,
        description: 'An artifact that works',
        triggeredAbilities: [{
          trigger: 'start_turn',
          effectCode: 'async (api) => { api.log("Working perfectly!"); return true; }',
          description: 'Working ability'
        }]
      });
      
      gameEngine.getGameDocHandle().change((doc) => {
        doc.playerBattlefields[0].cards.push(
          {
            instanceId: 'broken-1',
            cardUrl: brokenArtifactUrl,
            sapped: false,
            currentHealth: 1
          },
          {
            instanceId: 'working-1',
            cardUrl: workingArtifactUrl,
            sapped: false,
            currentHealth: 1
          }
        );
      });
      
      await gameEngine.executeTriggeredAbilities('start_turn', player1Id);
      
      const gameDoc = gameEngine.getGameDoc();
      
      // Working artifact should still have executed
      expect(gameDoc.gameLog.some(entry => 
        entry.description.includes('Working perfectly!')
      )).toBe(true);
    });
  });
});
