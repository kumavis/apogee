import { AutomergeUrl, DocHandle, Repo } from "@automerge/react";
import { GameDoc, createGame, BattlefieldCard, PlayerBattlefield } from "../docs/game";
import { DeckDoc } from "../docs/deck";
import { CardDoc } from "../docs/card";
import { 
  executeSpellEffect, 
  createSpellEffectAPI, 
  SpellTargetSelector, 
  SpellTarget, 
  executeArtifactAbility as executeTriggeredAbility,
  createArtifactEffectAPI as createTriggeredAbilityApi,
  executeSpellOperations,
  TriggerAbilityEvent,
  SpellOperation
} from "./spellEffects";
import {
  removeCardFromHand,
  addCardToGraveyard,
  spendEnergy,
  addGameLogEntry,
  dealDamage,
  dealDamageToCreature,
  sapCreature,
  refreshCreatures,
  drawCard,
  restoreEnergy,
  increaseMaxEnergy,
  advanceToNextPlayer,
  incrementTurn,
  initializeGame
} from "../docs/game";

// Type for mapping card URLs to their DocHandles
export type DocHandleMap<T> = Map<AutomergeUrl, DocHandle<T> | undefined>;

/**
 * GameEngine class that encapsulates all game logic and state management.
 * Operates on an internal gameDocHandle and maintains a cardDocHandleMap for efficient card loading.
 */
export class GameEngine {
  private gameDocHandle: DocHandle<GameDoc>;
  private cardDefs: DocHandleMap<CardDoc>;
  private repo: Repo;

  constructor(gameDocHandle: DocHandle<GameDoc>, repo: Repo) {
    this.gameDocHandle = gameDocHandle;
    this.cardDefs = new Map();
    this.repo = repo;
  }

  /**
   * Get the current game document
   */
  getGameDoc(): GameDoc {
    return this.gameDocHandle.doc();
  }

  /**
   * Get the game document handle
   */
  getGameDocHandle(): DocHandle<GameDoc> {
    return this.gameDocHandle;
  }

  /**
   * Get the card definitions map
   */
  getCardDefs(): DocHandleMap<CardDoc> {
    return this.cardDefs;
  }

  /**
   * Helper function to get card from DocHandleMap, loading if necessary
   */
  private async getCardFromMap(cardUrl: AutomergeUrl): Promise<CardDoc | null> {
    try {
      // Try to get card from cache first
      const cachedHandle = this.cardDefs.get(cardUrl);
      if (cachedHandle) {
        return cachedHandle.doc();
      }
      
      // If not in cache, load it and cache the handle
      const cardHandle = await this.repo.find<CardDoc>(cardUrl);
      const cardDoc = cardHandle.doc();
      this.cardDefs.set(cardUrl, cardHandle);
      return cardDoc;
    } catch (error) {
      console.error(`GameEngine.getCardFromMap: Failed to load card ${cardUrl}:`, error);
      return null;
    }
  }

  /**
   * Load a single card document
   */
  async loadCardDoc(cardUrl: AutomergeUrl): Promise<CardDoc | null> {
    return await this.getCardFromMap(cardUrl);
  }

  /**
   * Load multiple card documents efficiently
   */
  async loadCardDocs(cardUrls: AutomergeUrl[]): Promise<Map<AutomergeUrl, CardDoc>> {
    const cardMap = new Map<AutomergeUrl, CardDoc>();
    
    await Promise.all(cardUrls.map(async (cardUrl) => {
      const cardDoc = await this.getCardFromMap(cardUrl);
      if (cardDoc) {
        cardMap.set(cardUrl, cardDoc);
      }
    }));
    
    return cardMap;
  }

  /**
   * Add a card to the battlefield using existing instance ID
   */
  async addCardToBattlefield(playerId: AutomergeUrl, instanceId: string): Promise<boolean> {
    try {
      // Get the card URL from the instance ID
      const currentDoc = this.gameDocHandle.doc();
      const cardUrl = currentDoc.instanceToCardUrl[instanceId];
      if (!cardUrl) {
        console.error(`GameEngine.addCardToBattlefield: Card URL not found for instance: ${instanceId}`);
        return false;
      }

      const cardDoc = await this.getCardFromMap(cardUrl);
      if (!cardDoc) {
        console.error(`GameEngine.addCardToBattlefield: Card ${cardUrl} not found`);
        return false;
      }

      this.gameDocHandle.change((doc) => {
        const battlefieldIndex = doc.playerBattlefields.findIndex(battlefield => battlefield.playerId === playerId);
        if (battlefieldIndex === -1) {
          console.error(`GameEngine.addCardToBattlefield: Battlefield not found for playerId: ${playerId}`);
          return;
        }
        
        doc.playerBattlefields[battlefieldIndex].cards.push({
          instanceId,
          cardUrl,
          sapped: cardDoc!.type === 'creature', // Only creatures start sapped (summoning sickness), artifacts do not
          currentHealth: cardDoc!.health || 1 // Set initial health from card definition, default to 1
        });
      });
      
      return true;
    } catch (error) {
      console.error(`GameEngine.addCardToBattlefield: Error adding card ${instanceId}:`, error);
      return false;
    }
  }

  /**
   * Cast a spell
   */
  async castSpell(
    playerId: AutomergeUrl, 
    instanceId: string,
    selectTargetsImpl: (selector: SpellTargetSelector) => Promise<SpellTarget[]>
  ): Promise<boolean> {
    try {
      // Get the card URL from the instance ID
      const currentDoc = this.gameDocHandle.doc();
      const cardUrl = currentDoc.instanceToCardUrl[instanceId];
      if (!cardUrl) {
        console.error(`GameEngine.castSpell: Card URL not found for instance: ${instanceId}`);
        return false;
      }

      const cardDoc = await this.getCardFromMap(cardUrl);
      if (!cardDoc) {
        console.error(`GameEngine.castSpell: Card not found: ${cardUrl}`);
        return false;
      }

      if (cardDoc.type !== 'spell') {
        console.error(`GameEngine.castSpell: Card ${instanceId} is not a spell`);
        return false;
      }

      if (!cardDoc.spellEffect) {
        console.error(`GameEngine.castSpell: Spell card ${instanceId} has no effect code`);
        return false;
      }

      // Create the spell effect API with current game state
      const api = createSpellEffectAPI(currentDoc, playerId, selectTargetsImpl);
      
      // Execute the spell effect
      const success = await executeSpellEffect(cardDoc.spellEffect, api);
      
      if (success) {
        // Apply operations to the game document
        this.gameDocHandle.change((doc) => {
          executeSpellOperations(doc, api.operations);
          
          // Add to game log
          addGameLogEntry(doc, {
            playerId,
            action: 'play_card',
            instanceId,
            description: `Cast ${cardDoc!.name}`
          });
        });
      }
      
      return success;
    } catch (error) {
      console.error(`GameEngine.castSpell: Error casting spell ${instanceId}:`, error);
      this.gameDocHandle.change((doc) => {
        addGameLogEntry(doc, {
          playerId,
          action: 'play_card',
          instanceId,
          description: `Failed to cast spell`
        });
      });
      return false;
    }
  }

  /**
   * Play a card (main entry point for card playing)
   */
  async playCard(
    playerId: AutomergeUrl, 
    instanceId: string,
    selectTargetsImpl?: (selector: SpellTargetSelector) => Promise<SpellTarget[]>
  ): Promise<boolean> {
    try {
      // Get the card URL from the instance ID
      const currentDoc = this.gameDocHandle.doc();
      const cardUrl = currentDoc.instanceToCardUrl[instanceId];
      if (!cardUrl) {
        console.error(`GameEngine.playCard: Card URL not found for instance: ${instanceId}`);
        return false;
      }

      const cardDoc = await this.getCardFromMap(cardUrl);
      if (!cardDoc) {
        console.error(`GameEngine.playCard: Card not found: ${cardUrl}`);
        return false;
      }

      // Check if card is in hand
      const playerHandIndex = currentDoc.playerHands.findIndex(hand => hand.playerId === playerId);
      const cardInHand = playerHandIndex !== -1 ? currentDoc.playerHands[playerHandIndex].cards.includes(instanceId) : false;
      
      // Check if player can afford the card
      const playerStateIndex = currentDoc.playerStates.findIndex(state => state.playerId === playerId);
      const canAfford = playerStateIndex !== -1 ? currentDoc.playerStates[playerStateIndex].energy >= cardDoc!.cost : false;

      if (!cardInHand || !canAfford) {
        console.error(`GameEngine.playCard: Cannot play card ${instanceId} - cardInHand: ${cardInHand}, canAfford: ${canAfford}`);
        return false;
      }

      // Now spend the resources
      let resourcesSpent = false;
      this.gameDocHandle.change((doc) => {
        if (removeCardFromHand(doc, playerId, instanceId) && spendEnergy(doc, playerId, cardDoc!.cost)) {
          resourcesSpent = true;
        } else {
          console.error(`GameEngine.playCard: Failed to spend resources for card ${instanceId}`);
        }
      });

      if (!resourcesSpent) {
        return false;
      }

      // Handle card based on type
      if (cardDoc.type === 'creature' || cardDoc.type === 'artifact') {
        if (!(await this.addCardToBattlefield(playerId, instanceId))) {
          console.error(`GameEngine.playCard: Failed to add card ${instanceId} to battlefield for player ${playerId}`);
          return false;
        }
        
        // Execute play_card abilities for all players (artifacts and creatures)
        const currentDoc = this.gameDocHandle.doc();
        for (const p of currentDoc.players) {
          if (p !== playerId) { // Only trigger for opponents (for cards like Energy Collector)
            await this.executeTriggeredAbilities('play_card', p, selectTargetsImpl);
          }
        }
        
        // Add to game log
        this.gameDocHandle.change((doc) => {
          addGameLogEntry(doc, {
            playerId,
            action: 'play_card',
            instanceId,
            description: `Played ${cardDoc!.name}`
          });
        });
      } else if (cardDoc.type === 'spell') {
        // Add to graveyard first
        this.gameDocHandle.change((doc) => {
          addCardToGraveyard(doc, instanceId);
        });
        
        // Execute play_card abilities for all players (spells also trigger this)
        const currentDoc = this.gameDocHandle.doc();
        for (const p of currentDoc.players) {
          await this.executeTriggeredAbilities('play_card', p, selectTargetsImpl);
        }
        
        // Execute spell effect if it has one
        if (cardDoc.spellEffect && selectTargetsImpl) {
          const api = createSpellEffectAPI(currentDoc, playerId, selectTargetsImpl);
          const success = await executeSpellEffect(cardDoc.spellEffect, api);
          
          if (success) {
            // Execute triggered abilities for creatures/artifacts that took damage
            await this.executeSpellTriggeredAbilities(api.operations);

            // Apply spell operations
            this.gameDocHandle.change((doc) => {
              executeSpellOperations(doc, api.operations);
            });
          }
          
          if (!success) {
            console.error(`GameEngine.playCard: Spell effect failed for card ${instanceId}`);
            // Add failure log entry
            this.gameDocHandle.change((doc) => {
              addGameLogEntry(doc, {
                playerId,
                action: 'play_card',
                instanceId,
                description: `Failed to cast ${cardDoc!.name}`
              });
            });
            return false;
          }
        } else {
          // Add basic log entry for spells without effects
          this.gameDocHandle.change((doc) => {
            addGameLogEntry(doc, {
              playerId,
              action: 'play_card',
              instanceId,
              description: `Played ${cardDoc!.name}`
            });
          });
        }
      } else {
        // Other card types go to graveyard
        this.gameDocHandle.change((doc) => {
          addCardToGraveyard(doc, instanceId);
          
          addGameLogEntry(doc, {
            playerId,
            action: 'play_card',
            instanceId,
            description: `Played ${cardDoc!.name}`
          });
        });
      }

      return true;
    } catch (error) {
      console.error(`GameEngine.playCard: Error playing card ${instanceId}:`, error);
      
      // Try to get card name for error logging
      let cardName = 'Unknown Card';
      try {
        const currentDoc = this.gameDocHandle.doc();
        const cardUrl = currentDoc.instanceToCardUrl[instanceId];
        if (cardUrl) {
          const cardDoc = await this.getCardFromMap(cardUrl);
          if (cardDoc) {
            cardName = cardDoc.name;
          }
        }
      } catch (nameError) {
        // Ignore errors when trying to get card name
      }
      
      // Add error log entry
      this.gameDocHandle.change((doc) => {
        addGameLogEntry(doc, {
          playerId,
          action: 'play_card',
          instanceId,
          description: `Failed to play ${cardName}`
        });
      });
      
      return false;
    }
  }

  /**
   * Attack a player with a creature
   */
  async attackPlayerWithCreature(
    attackerId: AutomergeUrl, 
    instanceId: string, 
    targetPlayerId: AutomergeUrl, 
    damage: number
  ): Promise<boolean> {
    try {
      // Find the creature to get its name
      const currentDoc = this.gameDocHandle.doc();
      const battlefield = currentDoc.playerBattlefields.find(b => b.playerId === attackerId);
      const battlefieldCard = battlefield?.cards.find(c => c.instanceId === instanceId);
      
      let creatureName = 'Unknown Creature';
      if (battlefieldCard) {
        const creatureCard = await this.getCardFromMap(battlefieldCard.cardUrl);
        if (creatureCard) {
          creatureName = creatureCard.name;
        }
      }

      // Execute attack
      let attackSucceeded = false;
      this.gameDocHandle.change((doc) => {
        // Mark creature as sapped first
        if (!sapCreature(doc, attackerId, instanceId)) {
          console.error(`GameEngine.attackPlayerWithCreature: Failed to sap creature ${instanceId} for player ${attackerId}`);
          return;
        }

        attackSucceeded = true;
        dealDamage(doc, targetPlayerId, damage);

        // Add attack log AFTER dealing damage (so it's the last entry)
        addGameLogEntry(doc, {
          playerId: attackerId,
          action: 'attack',
          targetId: targetPlayerId,
          amount: damage,
          description: `${creatureName} attacked player for ${damage} damage`
        });
      });

      if (!attackSucceeded) {
        return false;
      }
      
      // Trigger deal_damage abilities for the attacking creature
      await this.executeTriggeredAbilitiesForCreature('deal_damage', attackerId, instanceId, undefined, {
        damageTarget: { playerId: targetPlayerId },
        damageAmount: damage
      });
      
      return true;
    } catch (error) {
      console.error(`GameEngine.attackPlayerWithCreature: Error during attack:`, error);
      return false;
    }
  }

  /**
   * Attack a creature with another creature
   */
  async attackCreatureWithCreature(
    attackerId: AutomergeUrl, 
    attackerInstanceId: string, 
    targetPlayerId: AutomergeUrl, 
    targetInstanceId: string,
    selectTargetsImpl?: (selector: SpellTargetSelector) => Promise<SpellTarget[]>
  ): Promise<boolean> {
    try {
      const currentDoc = this.gameDocHandle.doc();
      
      // Find the attacker
      const attackerBattlefield = currentDoc.playerBattlefields.find(b => b.playerId === attackerId);
      const attackerCard = attackerBattlefield?.cards.find(c => c.instanceId === attackerInstanceId);
      
      let attackerGameCard: CardDoc | null = null;
      if (attackerCard) {
        attackerGameCard = await this.getCardFromMap(attackerCard.cardUrl);
      }
      
      if (!attackerCard || !attackerGameCard) {
        console.error(`GameEngine.attackCreatureWithCreature: Invalid attacker ${attackerInstanceId}`);
        return false;
      }

      // Find the target
      const targetBattlefield = currentDoc.playerBattlefields.find(b => b.playerId === targetPlayerId);
      const targetCard = targetBattlefield?.cards.find(c => c.instanceId === targetInstanceId);
      
      let targetGameCard: CardDoc | null = null;
      if (targetCard) {
        targetGameCard = await this.getCardFromMap(targetCard.cardUrl);
      }
      
      if (!targetCard || !targetGameCard) {
        console.error(`GameEngine.attackCreatureWithCreature: Invalid target ${targetInstanceId}`);
        return false;
      }

      const attackerName = attackerGameCard.name;
      const targetName = targetGameCard.name;
      const attackerDamage = attackerGameCard.attack || 0; // Allow 0 attack creatures
      const targetDamage = targetGameCard.attack || 0; // Artifacts have 0 attack

      const targetCanAttackBack = targetGameCard.type === 'creature' && targetDamage > 0;

      // Log combat
      this.gameDocHandle.change((doc) => {
        // Mark attacker as sapped
        if (!sapCreature(doc, attackerId, attackerInstanceId)) {
          console.error(`GameEngine.attackCreatureWithCreature: Failed to sap attacker ${attackerInstanceId}`);
          return;
        }

        // Add combat log
        if (targetCanAttackBack) {
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
      });

      // Trigger deal_damage abilities for the attacking creature
      await this.executeTriggeredAbilitiesForCreature('deal_damage', attackerId, attackerInstanceId, selectTargetsImpl, {
        damageTarget: { playerId: targetPlayerId, instanceId: targetInstanceId },
        damageAmount: attackerDamage
      });

      // Trigger deal_damage abilities for the target creature (if it fought back)
      if (targetCanAttackBack) {
        await this.executeTriggeredAbilitiesForCreature('deal_damage', targetPlayerId, targetInstanceId, selectTargetsImpl, {
          damageTarget: { playerId: attackerId, instanceId: attackerInstanceId },
          damageAmount: targetDamage
        });
      }

      // Trigger take_damage abilities for the target (artifact or creature)
      await this.executeTriggeredAbilitiesForCreature('take_damage', targetPlayerId, targetInstanceId, selectTargetsImpl, {
        damageTarget: { playerId: attackerId, instanceId: attackerInstanceId },
        damageAmount: attackerDamage
      });

      // Trigger take_damage abilities for the attacking creature
      if (targetCanAttackBack) {
        await this.executeTriggeredAbilitiesForCreature('take_damage', attackerId, attackerInstanceId, selectTargetsImpl, {
          damageTarget: { playerId: targetPlayerId, instanceId: targetInstanceId },
          damageAmount: targetDamage
        });
      }

      // Apply damage
      this.gameDocHandle.change((doc) => {
        // Deal damage to target first
        dealDamageToCreature(doc, targetPlayerId, targetInstanceId, attackerDamage);

        // If target is a creature with attack power, deal damage back to attacker
        if (targetCanAttackBack) {
          // Check if attacker still exists (might have been destroyed by other effects)
          const stillExistsAttacker = doc.playerBattlefields
            .find(b => b.playerId === attackerId)?.cards
            .find(c => c.instanceId === attackerInstanceId);
          
          if (stillExistsAttacker) {
            dealDamageToCreature(doc, attackerId, attackerInstanceId, targetDamage);
          }
        }
      });

      return true;
    } catch (error) {
      console.error(`GameEngine.attackCreatureWithCreature: Error during combat:`, error);
      return false;
    }
  }

  /**
   * Heal creatures at end of turn (not artifacts)
   */
  async healCreatures(playerId: AutomergeUrl): Promise<boolean> {
    try {
      const currentDoc = this.gameDocHandle.doc();
      const battlefieldIndex = currentDoc.playerBattlefields.findIndex(battlefield => battlefield.playerId === playerId);
      if (battlefieldIndex === -1) {
        console.error(`GameEngine.healCreatures: Battlefield not found for playerId: ${playerId}`);
        return false;
      }
      
      let healedCount = 0;
      
      // Heal all creatures by 1 health (not artifacts)
      for (const battlefieldCard of currentDoc.playerBattlefields[battlefieldIndex].cards) {
        const card = await this.getCardFromMap(battlefieldCard.cardUrl);
        
        if (card && card.type === 'creature') {
          const maxHealth = card.health || 1;
          if (battlefieldCard.currentHealth < maxHealth) {
            this.gameDocHandle.change((doc) => {
              const battlefield = doc.playerBattlefields[battlefieldIndex];
              const cardToHeal = battlefield.cards.find(c => c.instanceId === battlefieldCard.instanceId);
              if (cardToHeal) {
                cardToHeal.currentHealth = Math.min(maxHealth, cardToHeal.currentHealth + 1);
              }
            });
            healedCount++;
          }
        }
      }
      
      if (healedCount > 0) {
        this.gameDocHandle.change((doc) => {
          addGameLogEntry(doc, {
            playerId,
            action: 'play_card', // Reusing this action type
            description: `${healedCount} creature(s) healed 1 health`
          });
        });
      }
      
      return true;
    } catch (error) {
      console.error(`GameEngine.healCreatures: Error healing creatures:`, error);
      return false;
    }
  }

  /**
   * Execute abilities for a specific trigger and player (both artifacts and creatures)
   */
  async executeTriggeredAbilities(
    trigger: TriggerAbilityEvent,
    playerId: AutomergeUrl,
    selectTargetsImpl?: (selector: SpellTargetSelector) => Promise<SpellTarget[]>
  ): Promise<void> {
    try {
      const currentDoc = this.gameDocHandle.doc();
      const playerBattlefield = currentDoc.playerBattlefields.find(b => b.playerId === playerId);
      if (!playerBattlefield) return;

      for (const battlefieldCard of playerBattlefield.cards) {
        const card = await this.getCardFromMap(battlefieldCard.cardUrl);
        
        // Process both artifacts and creatures with abilities
        if (card?.triggeredAbilities) {
          const abilitiesToExecute = card.triggeredAbilities;
          
          // Execute each ability that matches the trigger
          for (const ability of abilitiesToExecute) {
            if (ability.trigger === trigger) {
              try {
                // Create a no-op target selector if none provided
                const targetSelector = selectTargetsImpl || (async () => []);
                
                // Create the effect API (same API works for both artifacts and creatures)
                const api = createTriggeredAbilityApi(currentDoc, playerId, battlefieldCard.instanceId, targetSelector);
                
                // Execute the ability with context
                const success = await executeTriggeredAbility(ability.effectCode, api);
                
                if (success) {
                  // Execute collected operations
                  this.gameDocHandle.change((doc) => {
                    executeSpellOperations(doc, api.operations);
                    
                    // Add to game log
                    addGameLogEntry(doc, {
                      playerId,
                      action: 'play_card',
                      description: `${card!.name}: ${ability.description || 'triggered ability'}`
                    });
                  });
                }
              } catch (error) {
                console.error(`GameEngine.executeTriggeredAbilities: Error executing ability for ${card.name}:`, error);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(`GameEngine.executeTriggeredAbilities: Error executing triggered abilities:`, error);
    }
  }

  /**
   * Helper function to find a card by instanceId from any battlefield
   * @param instanceId - The unique instance ID of the card to find
   * @returns Object containing the battlefield card, player battlefield, and playerId, or null if not found
   */
  findCardByInstanceId(instanceId: string): {
    battlefieldCard: BattlefieldCard;
    playerBattlefield: PlayerBattlefield;
    playerId: AutomergeUrl;
  } | null {
    const currentDoc = this.gameDocHandle.doc();
    
    for (const playerBattlefield of currentDoc.playerBattlefields) {
      const battlefieldCard = playerBattlefield.cards.find(card => card.instanceId === instanceId);
      if (battlefieldCard) {
        return {
          battlefieldCard,
          playerBattlefield,
          playerId: playerBattlefield.playerId
        };
      }
    }
    
    return null;
  }

  /**
   * Execute abilities for a specific trigger and specific creature instance
   */
  async executeTriggeredAbilitiesForCreature(
    trigger: TriggerAbilityEvent,
    playerId: AutomergeUrl,
    instanceId: string,
    selectTargetsImpl?: (selector: SpellTargetSelector) => Promise<SpellTarget[]>,
    triggerContext?: { damageTarget?: { playerId: AutomergeUrl; instanceId?: string }; damageAmount?: number }
  ): Promise<void> {
    try {
      const currentDoc = this.gameDocHandle.doc();
      const playerBattlefield = currentDoc.playerBattlefields.find(b => b.playerId === playerId);
      if (!playerBattlefield) {
        console.error(`GameEngine.executeTriggeredAbilitiesForCreature: Battlefield not found for playerId: ${playerId}`);
        return;
      }

      const battlefieldCard = playerBattlefield.cards.find(card => card.instanceId === instanceId);
      if (!battlefieldCard) {
        console.error(`GameEngine.executeTriggeredAbilitiesForCreature: Card not found for instanceId: ${instanceId}`);
        return;
      }

      const card = await this.getCardFromMap(battlefieldCard.cardUrl);
      if (!card?.triggeredAbilities) return;

      // Execute each ability that matches the trigger
      for (const ability of card.triggeredAbilities) {
        if (ability.trigger === trigger) {
          try {
            // Create a no-op target selector if none provided
            const targetSelector = selectTargetsImpl || (async () => []);
            
            // Execute the ability with context
            const api = createTriggeredAbilityApi(currentDoc, playerId, instanceId, targetSelector, triggerContext);
            const success = await executeTriggeredAbility(ability.effectCode, api, triggerContext);

            if (success) {
              // Execute collected operations
              this.gameDocHandle.change((doc) => {
                executeSpellOperations(doc, api.operations);
                
                // Add to game log
                addGameLogEntry(doc, {
                  playerId,
                  action: 'play_card',
                  description: `${card!.name}: ${ability.description || 'triggered ability'}`
                });
              });
            }
          } catch (error) {
            console.error(`GameEngine.executeTriggeredAbilitiesForCreature: Error executing ability for ${card.name}:`, error);
          }
        }
      }
    } catch (error) {
      console.error(`GameEngine.executeTriggeredAbilitiesForCreature: Error executing triggered abilities for creature:`, error);
    }
  }

  async executeSpellTriggeredAbilities(operations: SpellOperation[]): Promise<void> {
    for (const op of operations) {
      if (op.type === 'damage_creature' && op.instanceId && op.amount !== undefined) {
        await this.executeTriggeredAbilitiesForCreature('take_damage', op.playerId, op.instanceId, undefined, { damageAmount: op.amount });
      }
    }
  }

  /**
   * End the current player's turn
   */
  async endPlayerTurn(playerId: AutomergeUrl): Promise<void> {
    try {
      // Add to game log FIRST, before any next player actions
      this.gameDocHandle.change((doc) => {
        addGameLogEntry(doc, {
          playerId,
          action: 'end_turn',
          description: 'Ended turn'
        });
      });

      // Execute end-of-turn abilities for current player
      await this.executeTriggeredAbilities('end_turn', playerId);

      let nextPlayerId: AutomergeUrl;
      this.gameDocHandle.change((doc) => {
        const nextPlayerIndex = advanceToNextPlayer(doc);
        nextPlayerId = doc.players[nextPlayerIndex];
      });
      
      // Execute start-of-turn abilities for next player BEFORE drawing
      await this.executeTriggeredAbilities('start_turn', nextPlayerId!);
      
      // Draw a card for the next player (start of their turn)
      this.gameDocHandle.change((doc) => {
        drawCard(doc, nextPlayerId!);
        
        // Refresh creatures for the next player (unsap them)
        refreshCreatures(doc, nextPlayerId!);
      });
      
      // Heal creatures for the next player (only creatures, not artifacts)
      await this.healCreatures(nextPlayerId!);
      
      // If we've gone through all players, increment turn and increase max energy
      this.gameDocHandle.change((doc) => {
        const currentDoc = this.gameDocHandle.doc();
        const nextPlayerIndex = currentDoc.players.indexOf(nextPlayerId!);
        
        if (nextPlayerIndex === 0) {
          incrementTurn(doc);
          
          // Increase max energy for all players and restore their energy
          doc.playerStates.forEach(playerState => {
            increaseMaxEnergy(doc, playerState.playerId);
            restoreEnergy(doc, playerState.playerId);
          });
        } else {
          // Restore energy for the next player only
          restoreEnergy(doc, nextPlayerId!);
        }
      });
    } catch (error) {
      console.error(`GameEngine.endPlayerTurn: Error ending turn:`, error);
    }
  }

  /**
   * Create a game deck from a deck document with unique instance IDs
   */
  async createGameDeckFromDeck(deckUrl: AutomergeUrl): Promise<{ gameDeck: string[], instanceToCardUrl: Record<string, AutomergeUrl> }> {
    const deckHandle = await this.repo.find<DeckDoc>(deckUrl);
    if (!deckHandle) {
      throw new Error(`GameEngine.createGameDeckFromDeck: Deck not found for URL: ${deckUrl}`);
    }
    
    const deckDoc = deckHandle.doc();
    const gameDeck: string[] = [];
    const instanceToCardUrl: Record<string, AutomergeUrl> = {};
    
    // Expand each deck card according to its quantity, creating unique instance IDs
    for (const deckCard of deckDoc.cards) {
      for (let i = 0; i < deckCard.quantity; i++) {
        // Generate unique instance ID for this card copy
        const instanceId = `instance_${Math.random().toString(36).substr(2, 9)}`;
        gameDeck.push(instanceId);
        instanceToCardUrl[instanceId] = deckCard.cardUrl;
      }
    }
    
    return { gameDeck, instanceToCardUrl };
  }

  /**
   * Prepare deck and start the game
   */
  async startGameWithDeck(deckUrl: AutomergeUrl): Promise<boolean> {
    try {
      // Create game deck from the selected deck
      const { gameDeck, instanceToCardUrl } = await this.createGameDeckFromDeck(deckUrl);
      
      // Shuffle the deck (Fisher-Yates shuffle)
      const shuffledDeck = [...gameDeck];
      for (let i = shuffledDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledDeck[i], shuffledDeck[j]] = [shuffledDeck[j], shuffledDeck[i]];
      }
      
      // Initialize the game state with the shuffled deck
      this.gameDocHandle.change((doc) => {
        initializeGame(doc, shuffledDeck, instanceToCardUrl);
      });
      
      console.log(`GameEngine.startGameWithDeck: Started game with ${shuffledDeck.length} cards`);
      return true;
    } catch (error) {
      console.error('GameEngine.startGameWithDeck: Failed to start game:', error);
      return false;
    }
  }

  /**
   * Create a rematch game
   */
  createRematchGame(): DocHandle<GameDoc> {
    const currentDoc = this.gameDocHandle.doc();
    
    // Create a new game with the same players and deck
    const rematchHandle = createGame(this.repo, {
      createdAt: Date.now(),
      players: [...currentDoc.players], // Copy players from original game
      status: 'waiting' as const,
      selectedDeckUrl: currentDoc.selectedDeckUrl, // Use same deck
      deck: [],
      instanceToCardUrl: {},
      playerHands: [],
      playerBattlefields: [],
      playerStates: [],
      graveyard: [],
      currentPlayerIndex: 0,
      turn: 0,
      gameLog: []
    });
    
    const rematchId = rematchHandle.url;
    
    // Update the original game to reference the rematch
    this.gameDocHandle.change((doc) => {
      doc.rematchGameId = rematchId;
    });
    
    console.log(`GameEngine.createRematchGame: Created rematch game: ${rematchId}`);
    return rematchHandle;
  }

  /**
   * Static factory method to create a GameEngine instance
   */
  static create(gameDocHandle: DocHandle<GameDoc>, repo: Repo): GameEngine {
    return new GameEngine(gameDocHandle, repo);
  }
}
