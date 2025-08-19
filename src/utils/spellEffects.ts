import { AutomergeUrl } from '@automerge/react';
import { GameDoc, dealDamage, addGameLogEntry, removeCreatureFromBattlefield } from '../docs/game';

// Types for spell targeting and effects
export type SpellTarget = {
  type: 'player' | 'creature' | 'any';
  playerId: AutomergeUrl;
  instanceId?: string; // For creatures on battlefield
};

export type SpellTargetSelector = {
  targetCount: number;
  targetType: 'player' | 'creature' | 'any';
  canTargetSelf?: boolean;
  canTargetAllies?: boolean;
  description: string;
};

// Operations that spells can perform
export type SpellOperation = {
  type: 'damage_player' | 'damage_creature' | 'heal_player' | 'destroy_creature' | 'log';
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
  
  // Targeting functions (async)
  selectTargets: (selector: SpellTargetSelector) => Promise<SpellTarget[]>;
  
  // Operation collection (instead of immediate execution)
  operations: SpellOperation[];
  
  // Damage and healing (queues operations)
  dealDamageToPlayer: (playerId: AutomergeUrl, damage: number) => void;
  dealDamageToCreature: (playerId: AutomergeUrl, instanceId: string, damage: number) => void;
  healPlayer: (playerId: AutomergeUrl, amount: number) => void;
  
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

  return {
    doc,
    casterId,
    operations,
    
    selectTargets: selectTargetsImpl,
    
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
          // For now, any damage destroys the creature
          removeCreatureFromBattlefield(doc, op.playerId, op.instanceId);
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
