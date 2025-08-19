import { AutomergeUrl } from '@automerge/react';
import { GameDoc, dealDamage, addGameLogEntry, removeCreatureFromBattlefield, dealDamageToCreature } from '../docs/game';
import { Target, TargetSelector } from './unifiedTargeting';

// Legacy types for backwards compatibility
export type SpellTarget = Target;
export type SpellTargetSelector = TargetSelector;



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
  getCreaturesForPlayer: (playerId: AutomergeUrl) => Array<{instanceId: string, cardId: string}>;
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
    
    getCreaturesForPlayer: (playerId: AutomergeUrl): Array<{instanceId: string, cardId: string}> => {
      const battlefield = doc.playerBattlefields.find(
        battlefield => battlefield.playerId === playerId
      );
      
      if (!battlefield) return [];
      
      return battlefield.cards.map(card => ({
        instanceId: card.instanceId,
        cardId: card.cardId
      }));
    }
  };
};

// Execute collected spell operations on the game document
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
              const gameCard = doc.cardLibrary[battlefieldCard.cardId];
              
              if (gameCard && gameCard.health) {
                const maxHealth = gameCard.health;
                const newHealth = Math.min(maxHealth, battlefieldCard.currentHealth + op.amount);
                battlefieldCard.currentHealth = newHealth;
                
                addGameLogEntry(doc, {
                  playerId: op.playerId,
                  action: 'take_damage',
                  amount: -op.amount,
                  description: `${gameCard.name} healed for ${op.amount} health`
                });
              }
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
          addGameLogEntry(doc, {
            playerId: op.playerId,
            action: 'play_card',
            description: op.description
          });
        }
        break;
    }
  }
};
