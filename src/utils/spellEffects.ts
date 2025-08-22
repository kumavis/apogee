import { AutomergeUrl } from '@automerge/react';
import { GameDoc, dealDamage, addGameLogEntry, removeCreatureFromBattlefield, dealDamageToCreature, drawCard, executeTriggeredAbilitiesForCreature } from '../docs/game';
import { Target, TargetSelector } from './unifiedTargeting';

// Legacy types for backwards compatibility
export type SpellTarget = Target;
export type SpellTargetSelector = TargetSelector;

// Artifact ability trigger types
export type ArtifactTrigger = 'start_turn' | 'end_turn' | 'play_card' | 'take_damage' | 'deal_damage';

// Artifact ability definition
export type ArtifactAbility = {
  trigger: ArtifactTrigger;
  effectCode: string; // Same code format as spells
  description?: string;
};



// Operations that spells can perform
export type SpellOperation = {
  type: 'damage_player' | 'damage_creature' | 'heal_player' | 'heal_creature' | 'destroy_creature' | 'log';
  playerId: AutomergeUrl;
  instanceId?: string;
  amount?: number;
  description?: string;
};

// API object that gets passed to spell effect functions
export type SpellEffectAPI = {
  // Document manipulation (read-only)
  doc: GameDoc;
  casterId: AutomergeUrl;
  
  // Targeting functions (async) - unified targeting
  selectTargets: (selector: SpellTargetSelector) => Promise<SpellTarget[]>;
  
  // Operation collection (instead of immediate execution)
  operations: SpellOperation[];
  
  // Damage and healing (queues operations)
  dealDamageToPlayer: (playerId: AutomergeUrl, damage: number) => void;
  dealDamageToCreature: (playerId: AutomergeUrl, instanceId: string, damage: number) => void;
  healPlayer: (playerId: AutomergeUrl, amount: number) => void;
  healCreature: (playerId: AutomergeUrl, instanceId: string, amount: number) => void;
  
  // Creature manipulation (queues operations)
  destroyCreature: (playerId: AutomergeUrl, instanceId: string) => void;
  
  // Utility functions
  log: (description: string) => void;
  getAllPlayers: () => AutomergeUrl[];
  getCreaturesForPlayer: (playerId: AutomergeUrl) => Array<{instanceId: string, cardUrl: AutomergeUrl}>;
};

// Utility function to convert a function to a string for storage
export const functionToString = <T extends (...args: any[]) => any>(fn: T): string => {
  return fn.toString();
};

// Function to execute spell effect code with API
export const executeSpellEffect = async (
  effectCode: string,
  api: SpellEffectAPI
): Promise<boolean> => {
  try {
    // Create the function from the string
    const effectFunction = new Function('api', `return (${effectCode})(api);`);
    
    // Execute the effect function with the API
    const result = await effectFunction(api);
    return result !== false; // Consider undefined/null as success
  } catch (error) {
    console.error('Error executing spell effect:', error);
    api.log(`Spell effect failed: ${error}`);
    return false;
  }
};

// API object that gets passed to artifact ability functions
export type ArtifactEffectAPI = {
  // Document manipulation (read-only)
  doc: GameDoc;
  ownerId: AutomergeUrl; // The player who owns this artifact
  instanceId: string; // The specific artifact instance
  
  // Targeting functions (async) - unified targeting
  selectTargets: (selector: SpellTargetSelector) => Promise<SpellTarget[]>;
  
  // Operation collection (instead of immediate execution)
  operations: SpellOperation[];
  
  // Damage and healing (queues operations)
  dealDamageToPlayer: (playerId: AutomergeUrl, damage: number) => void;
  dealDamageToCreature: (playerId: AutomergeUrl, instanceId: string, damage: number) => void;
  healPlayer: (playerId: AutomergeUrl, amount: number) => void;
  healCreature: (playerId: AutomergeUrl, instanceId: string, amount: number) => void;
  
  // Creature manipulation (queues operations)
  destroyCreature: (playerId: AutomergeUrl, instanceId: string) => void;
  
  // Utility functions
  log: (description: string) => void;
  getAllPlayers: () => AutomergeUrl[];
  getCreaturesForPlayer: (playerId: AutomergeUrl) => Array<{instanceId: string, cardUrl: AutomergeUrl}>;
  
  // Artifact-specific functions
  getOwnCreatures: () => Array<{instanceId: string, cardUrl: AutomergeUrl}>;
  drawCard: () => void;
  gainEnergy: (amount: number) => void;
  
  // Trigger-specific context
  triggerContext?: {
    damageTarget?: {
      playerId: AutomergeUrl;
      instanceId?: string; // undefined if targeting player
    };
    damageAmount?: number;
  };
};

// Function to execute artifact ability code with API
export const executeArtifactAbility = async (
  effectCode: string,
  api: ArtifactEffectAPI,
  context?: any
): Promise<boolean> => {
  try {
    // Create the function from the string
    const effectFunction = new Function('api', 'context', `return (${effectCode})(api, context);`);
    
    // Execute the effect function with the API and context
    const result = await effectFunction(api, context);
    return result !== false; // Consider undefined/null as success
  } catch (error) {
    console.error('Error executing artifact ability:', error);
    api.log(`Artifact ability failed: ${error}`);
    return false;
  }
};



// Implementation of API functions that will be used in spell effects
export const createSpellEffectAPI = (
  doc: GameDoc,
  casterId: AutomergeUrl,
  selectTargetsImpl: (selector: SpellTargetSelector) => Promise<SpellTarget[]>
): SpellEffectAPI => {
  const operations: SpellOperation[] = [];

  // Wrapper to ensure spell selectors have the correct sourcerId
  const wrappedSelectTargets = async (selector: SpellTargetSelector): Promise<SpellTarget[]> => {
    const enhancedSelector = { ...selector, sourcerId: casterId };
    return selectTargetsImpl(enhancedSelector);
  };

  return {
    doc,
    casterId,
    operations,
    
    selectTargets: wrappedSelectTargets,
    
    dealDamageToPlayer: (playerId: AutomergeUrl, damage: number): void => {
      operations.push({
        type: 'damage_player',
        playerId,
        amount: damage
      });
    },
    
    dealDamageToCreature: (playerId: AutomergeUrl, instanceId: string, damage: number): void => {
      operations.push({
        type: 'damage_creature',
        playerId,
        instanceId,
        amount: damage
      });
    },
    
    healPlayer: (playerId: AutomergeUrl, amount: number): void => {
      operations.push({
        type: 'heal_player',
        playerId,
        amount
      });
    },
    
    healCreature: (playerId: AutomergeUrl, instanceId: string, amount: number): void => {
      operations.push({
        type: 'heal_creature',
        playerId,
        instanceId,
        amount
      });
    },
    
    destroyCreature: (playerId: AutomergeUrl, instanceId: string): void => {
      operations.push({
        type: 'destroy_creature',
        playerId,
        instanceId
      });
    },
    
    log: (description: string): void => {
      operations.push({
        type: 'log',
        playerId: casterId,
        description
      });
    },
    
    getAllPlayers: (): AutomergeUrl[] => {
      return [...doc.players];
    },
    
    getCreaturesForPlayer: (playerId: AutomergeUrl): Array<{instanceId: string, cardUrl: AutomergeUrl}> => {
      const battlefield = doc.playerBattlefields.find(
        battlefield => battlefield.playerId === playerId
      );
      
      if (!battlefield) return [];
      
      return battlefield.cards.map(card => ({
        instanceId: card.instanceId,
        cardUrl: card.cardUrl
      }));
    }
  };
};

// Implementation of API functions that will be used in artifact abilities
export const createArtifactEffectAPI = (
  doc: GameDoc,
  ownerId: AutomergeUrl,
  instanceId: string,
  selectTargetsImpl: (selector: SpellTargetSelector) => Promise<SpellTarget[]>,
  triggerContext?: ArtifactEffectAPI['triggerContext']
): ArtifactEffectAPI => {
  const operations: SpellOperation[] = [];

  // Wrapper to ensure artifact selectors have the correct sourcerId
  const wrappedSelectTargets = async (selector: SpellTargetSelector): Promise<SpellTarget[]> => {
    const enhancedSelector = { ...selector, sourcerId: ownerId };
    return selectTargetsImpl(enhancedSelector);
  };

  return {
    doc,
    ownerId,
    instanceId,
    operations,
    triggerContext,
    
    selectTargets: wrappedSelectTargets,
    
    dealDamageToPlayer: (playerId: AutomergeUrl, damage: number): void => {
      operations.push({
        type: 'damage_player',
        playerId,
        amount: damage
      });
    },
    
    dealDamageToCreature: (playerId: AutomergeUrl, instanceId: string, damage: number): void => {
      operations.push({
        type: 'damage_creature',
        playerId,
        instanceId,
        amount: damage
      });
    },
    
    healPlayer: (playerId: AutomergeUrl, amount: number): void => {
      operations.push({
        type: 'heal_player',
        playerId,
        amount
      });
    },
    
    healCreature: (playerId: AutomergeUrl, instanceId: string, amount: number): void => {
      operations.push({
        type: 'heal_creature',
        playerId,
        instanceId,
        amount
      });
    },
    
    destroyCreature: (playerId: AutomergeUrl, instanceId: string): void => {
      operations.push({
        type: 'destroy_creature',
        playerId,
        instanceId
      });
    },
    
    log: (description: string): void => {
      operations.push({
        type: 'log',
        playerId: ownerId,
        description
      });
    },
    
    getAllPlayers: (): AutomergeUrl[] => {
      return [...doc.players];
    },
    
    getCreaturesForPlayer: (playerId: AutomergeUrl): Array<{instanceId: string, cardUrl: AutomergeUrl}> => {
      const battlefield = doc.playerBattlefields.find(
        battlefield => battlefield.playerId === playerId
      );
      
      if (!battlefield) return [];
      
      return battlefield.cards.map(card => ({
        instanceId: card.instanceId,
        cardUrl: card.cardUrl
      }));
    },
    
    getOwnCreatures: (): Array<{instanceId: string, cardUrl: AutomergeUrl}> => {
      const battlefield = doc.playerBattlefields.find(
        battlefield => battlefield.playerId === ownerId
      );
      
      if (!battlefield) return [];
      
      return battlefield.cards
        .filter(_card => {
          // Note: We can't load cards synchronously anymore, so we'll assume all battlefield cards are targetable
          // The actual type validation will happen during spell execution
          return true; // All battlefield cards are potentially targetable
        })
        .map(card => ({
          instanceId: card.instanceId,
          cardUrl: card.cardUrl
        }));
    },
    
    drawCard: (): void => {
      operations.push({
        type: 'log', // We'll handle draw card as a special operation
        playerId: ownerId,
        description: 'ARTIFACT_DRAW_CARD' // Special marker for draw card operation
      });
    },
    
    gainEnergy: (amount: number): void => {
      operations.push({
        type: 'log', // We'll handle energy gain as a special operation
        playerId: ownerId,
        amount,
        description: `ARTIFACT_GAIN_ENERGY:${amount}` // Special marker for energy gain
      });
    }
  };
};

// Execute triggered abilities from spell operations (async, call after executeSpellOperations)
export const executeSpellTriggeredAbilities = async (doc: GameDoc, operations: SpellOperation[], repo: any): Promise<void> => {
  for (const op of operations) {
    if (op.type === 'damage_creature' && op.instanceId && op.amount !== undefined) {
      // Trigger "take_damage" abilities for the damaged creature
      await executeTriggeredAbilitiesForCreature(doc, 'take_damage', op.playerId, op.instanceId, repo, undefined, {
        damageAmount: op.amount
      });
    }
  }
};

// Execute collected spell operations on the game document (synchronous mutations only)
export const executeSpellOperations = (doc: GameDoc, operations: SpellOperation[]): void => {
  for (const op of operations) {
    switch (op.type) {
      case 'damage_player':
        if (op.amount !== undefined) {
          dealDamage(doc, op.playerId, op.amount);
        }
        break;
        
      case 'damage_creature':
        if (op.instanceId && op.amount !== undefined) {
          // Use new health-based damage system
          dealDamageToCreature(doc, op.playerId, op.instanceId, op.amount);
          // Note: take_damage triggered abilities need to be handled outside this synchronous function
        }
        break;
        
      case 'heal_player':
        if (op.amount !== undefined) {
          const playerStateIndex = doc.playerStates.findIndex(
            state => state.playerId === op.playerId
          );
          
          if (playerStateIndex !== -1) {
            const playerState = doc.playerStates[playerStateIndex];
            playerState.health = Math.min(playerState.maxHealth, playerState.health + op.amount);
            
            addGameLogEntry(doc, {
              playerId: op.playerId,
              action: 'take_damage',
              amount: -op.amount,
              description: `Healed for ${op.amount} health`
            });
          }
        }
        break;
        
      case 'heal_creature':
        if (op.instanceId && op.amount !== undefined) {
          const battlefieldIndex = doc.playerBattlefields.findIndex(
            battlefield => battlefield.playerId === op.playerId
          );
          
          if (battlefieldIndex !== -1) {
            const cardIndex = doc.playerBattlefields[battlefieldIndex].cards.findIndex(
              card => card.instanceId === op.instanceId
            );
            
            if (cardIndex !== -1) {
              const battlefieldCard = doc.playerBattlefields[battlefieldIndex].cards[cardIndex];
              // Note: We can't load cards synchronously, so we'll just heal by the amount
              // without checking max health limits for now
              const newHealth = battlefieldCard.currentHealth + op.amount;
              battlefieldCard.currentHealth = newHealth;
              
              addGameLogEntry(doc, {
                playerId: op.playerId,
                action: 'take_damage',
                amount: -op.amount,
                description: `Creature healed for ${op.amount} health`
              });
            }
          }
        }
        break;
        
      case 'destroy_creature':
        if (op.instanceId) {
          removeCreatureFromBattlefield(doc, op.playerId, op.instanceId);
        }
        break;
        
      case 'log':
        if (op.description) {
          // Handle special artifact operations
          if (op.description === 'ARTIFACT_DRAW_CARD') {
            drawCard(doc, op.playerId);
          } else if (op.description.startsWith('ARTIFACT_GAIN_ENERGY:')) {
            const amount = parseInt(op.description.split(':')[1], 10);
            if (!isNaN(amount)) {
              const playerStateIndex = doc.playerStates.findIndex(
                state => state.playerId === op.playerId
              );
              
              if (playerStateIndex !== -1) {
                const playerState = doc.playerStates[playerStateIndex];
                playerState.energy = Math.min(playerState.maxEnergy, playerState.energy + amount);
                
                addGameLogEntry(doc, {
                  playerId: op.playerId,
                  action: 'play_card',
                  description: `Artifact granted ${amount} energy`
                });
              }
            }
          } else {
            // Regular log entry
            addGameLogEntry(doc, {
              playerId: op.playerId,
              action: 'play_card',
              description: op.description
            });
          }
        }
        break;
    }
  }
};
