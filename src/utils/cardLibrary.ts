import { GameCard } from '../docs/game';
import { functionToString } from './spellEffects';

// Sci-fi themed card library
export const CARD_LIBRARY: { [cardId: string]: GameCard } = {
  'card_001': {
    id: 'card_001',
    name: 'Cyber Drone',
    cost: 2,
    attack: 2,
    health: 1,
    type: 'creature',
    description: 'A fast reconnaissance unit.'
  },
  'card_002': {
    id: 'card_002',
    name: 'Plasma Burst',
    cost: 3,
    type: 'spell',
    description: 'Deal 3 damage to any target.',
    spellEffect: functionToString(async (api) => {
      // Select any target (player or creature)
      const targets = await api.selectTargets({
        targetCount: 1,
        targetType: 'any',
        canTargetSelf: false,
        autoTarget: false, // Multi-type targeting needs manual selection
        description: 'Choose a target to deal 3 damage'
      });
      
      if (targets.length === 0) {
        api.log('No target selected for Plasma Burst');
        return false;
      }
      
      const target = targets[0];
      if (target.type === 'player') {
        api.dealDamageToPlayer(target.playerId, 3);
        api.log(`Plasma Burst deals 3 damage to player`);
      } else if (target.type === 'creature' && target.instanceId) {
        api.dealDamageToCreature(target.playerId, target.instanceId, 3);
        api.log(`Plasma Burst destroys target creature`);
      }
      
      return true;
    })
  },
  'card_003': {
    id: 'card_003',
    name: 'Steel Sentinel',
    cost: 4,
    attack: 2,
    health: 6,
    type: 'creature',
    description: 'An automated defense unit.'
  },

  'card_005': {
    id: 'card_005',
    name: 'Quantum Destroyer',
    cost: 5,
    attack: 4,
    health: 3,
    type: 'creature',
    description: 'A cybernetic war machine from the future.'
  },
  'card_006': {
    id: 'card_006',
    name: 'Data Spike',
    cost: 1,
    type: 'spell',
    description: 'Hack enemy systems for 1 damage.',
    spellEffect: functionToString(async (api) => {
      const targets = await api.selectTargets({
        targetCount: 1,
        targetType: 'player',
        canTargetSelf: false,
        autoTarget: true,
        description: 'Choose an opponent to hack for 1 damage'
      });
      
      if (targets.length === 0) {
        api.log('No target selected for Data Spike');
        return false;
      }
      
      api.dealDamageToPlayer(targets[0].playerId, 1);
      api.log(`Data Spike hacks opponent for 1 damage`);
      return true;
    })
  },
  'card_007': {
    id: 'card_007',
    name: 'Bio-Mech Guardian',
    cost: 6,
    attack: 5,
    health: 5,
    type: 'creature',
    description: 'At end of turn: Heal all your creatures for 1.',
    triggeredAbilities: [{
      trigger: 'end_turn',
      effectCode: functionToString(async (api) => {
        const creatures = api.getOwnCreatures();
        let healedCount = 0;
        
        creatures.forEach((creature: {instanceId: string, cardId: string}) => {
          api.healCreature(api.ownerId, creature.instanceId, 1);
          healedCount++;
        });
        
        if (healedCount > 0) {
          api.log(`Bio-Mech Guardian protected ${healedCount} creature(s)`);
        }
        return true;
      }),
      description: 'Heal all your creatures for 1'
    }]
  },
  'card_008': {
    id: 'card_008',
    name: 'Energy Shield',
    cost: 3,
    attack: 1,
    health: 4,
    type: 'creature',
    description: 'When damaged: Heal 1 health at end of turn.',
    triggeredAbilities: [{
      trigger: 'end_turn',
      effectCode: functionToString(async (api) => {
        // Check if this creature is damaged and heal it
        const battlefield = api.doc.playerBattlefields.find((b: any) => b.playerId === api.ownerId);
        const battlefieldCard = battlefield?.cards.find((c: any) => c.instanceId === api.instanceId);
        const creatureCard = api.doc.cardLibrary[battlefieldCard?.cardId || ''];
        
        if (battlefieldCard && creatureCard && battlefieldCard.currentHealth < (creatureCard.health || 1)) {
          api.healCreature(api.ownerId, api.instanceId, 1);
          api.log('Energy Shield regenerated 1 health');
        }
        
        return true;
      }),
      description: 'Regenerate 1 health if damaged'
    }]
  },
  'card_009': {
    id: 'card_009',
    name: 'Neural Interface',
    cost: 1,
    health: 2,
    type: 'artifact',
    description: 'Draw an additional card each turn.',
    triggeredAbilities: [{
      trigger: 'start_turn',
      effectCode: functionToString(async (api) => {
        api.drawCard();
        api.log('Neural Interface draws an additional card');
        return true;
      }),
      description: 'Draw an additional card'
    }]
  },
  'card_010': {
    id: 'card_010',
    name: 'Fusion Core',
    cost: 4,
    health: 5,
    type: 'artifact',
    description: 'Gain +1 energy per turn.',
    triggeredAbilities: [{
      trigger: 'start_turn',
      effectCode: functionToString(async (api) => {
        api.gainEnergy(1);
        api.log('Fusion Core grants +1 energy');
        return true;
      }),
      description: 'Gain +1 energy'
    }]
  },
  'card_011': {
    id: 'card_011',
    name: 'Assault Bot',
    cost: 3,
    attack: 3,
    health: 2,
    type: 'creature',
    description: 'Fast attack unit.'
  },
  'card_012': {
    id: 'card_012',
    name: 'System Crash',
    cost: 4,
    type: 'spell',
    description: 'Destroy target creature.',
    spellEffect: functionToString(async (api) => {
      // Get all creatures on all battlefields
      const allCreatures = [];
      for (const playerId of api.getAllPlayers()) {
        const creatures = api.getCreaturesForPlayer(playerId);
        for (const creature of creatures) {
          allCreatures.push({
            type: 'creature' as const,
            playerId,
            instanceId: creature.instanceId
          });
        }
      }
      
      if (allCreatures.length === 0) {
        api.log('No creatures to destroy');
        return false;
      }
      
      const targets = await api.selectTargets({
        targetCount: 1,
        targetType: 'creature',
        canTargetSelf: true,
        autoTarget: false, // Destruction spell needs manual selection
        description: 'Choose a creature to destroy'
      });
      
      if (targets.length === 0) {
        api.log('No target selected for System Crash');
        return false;
      }
      
      const target = targets[0];
      if (target.instanceId) {
        api.destroyCreature(target.playerId, target.instanceId);
        api.log(`System Crash destroys target creature`);
      }
      
      return true;
    })
  },
  'card_013': {
    id: 'card_013',
    name: 'Repair Drone',
    cost: 2,
    attack: 1,
    health: 3,
    type: 'creature',
    description: 'At start of turn: Heal a damaged creature for 2.',
    triggeredAbilities: [{
      trigger: 'start_turn',
      effectCode: functionToString(async (api) => {
        const creatures = api.getOwnCreatures();
        
        // Find damaged creatures (excluding itself)
        for (const creature of creatures) {
          if (creature.instanceId !== api.instanceId) {
            const creatureCard = api.doc.cardLibrary[creature.cardId];
            if (creatureCard && creatureCard.type === 'creature') {
              // Find the battlefield card to check current health
              const battlefield = api.doc.playerBattlefields.find((b: any) => b.playerId === api.ownerId);
              const battlefieldCard = battlefield?.cards.find((c: any) => c.instanceId === creature.instanceId);
              
              if (battlefieldCard && battlefieldCard.currentHealth < (creatureCard.health || 1)) {
                api.healCreature(api.ownerId, creature.instanceId, 2);
                api.log(`Repair Drone healed ${creatureCard.name} for 2`);
                return true;
              }
            }
          }
        }
        
        return true; // Return true even if no healing was done
      }),
      description: 'Heal a damaged creature for 2'
    }]
  },
  'card_014': {
    id: 'card_014',
    name: 'Photon Cannon',
    cost: 5,
    type: 'spell',
    description: 'Deal 5 damage to target.',
    spellEffect: functionToString(async (api) => {
      // Select any target (player or creature)
      const targets = await api.selectTargets({
        targetCount: 1,
        targetType: 'any',
        canTargetSelf: false,
        autoTarget: false, // Multi-type targeting needs manual selection
        description: 'Choose a target to deal 5 damage'
      });
      
      if (targets.length === 0) {
        api.log('No target selected for Photon Cannon');
        return false;
      }
      
      const target = targets[0];
      if (target.type === 'player') {
        api.dealDamageToPlayer(target.playerId, 5);
        api.log(`Photon Cannon blasts player for 5 damage`);
      } else if (target.type === 'creature' && target.instanceId) {
        api.dealDamageToCreature(target.playerId, target.instanceId, 5);
        api.log(`Photon Cannon destroys target creature`);
      }
      
      return true;
    })
  },
  'card_015': {
    id: 'card_015',
    name: 'Stealth Infiltrator',
    cost: 2,
    attack: 1,
    health: 1,
    type: 'creature',
    description: 'When this attacks a player: Deal 1 damage to a random enemy creature.',
    triggeredAbilities: [{
      trigger: 'end_turn', // Triggers after attacking (attacks happen during turn)
      effectCode: functionToString(async (api) => {
        // Check if this creature attacked this turn by checking if it's sapped
        const battlefield = api.doc.playerBattlefields.find((b: any) => b.playerId === api.ownerId);
        const battlefieldCard = battlefield?.cards.find((c: any) => c.instanceId === api.instanceId);
        
        if (battlefieldCard && battlefieldCard.sapped) {
          // Find all enemy creatures
          const allPlayers = api.getAllPlayers();
          const enemies = allPlayers.filter((p: any) => p !== api.ownerId);
          const enemyCreatures = [];
          
          for (const enemyId of enemies) {
            const creatures = api.getCreaturesForPlayer(enemyId);
            for (const creature of creatures) {
              enemyCreatures.push({ playerId: enemyId, instanceId: creature.instanceId });
            }
          }
          
          if (enemyCreatures.length > 0) {
            const randomTarget = enemyCreatures[Math.floor(Math.random() * enemyCreatures.length)];
            api.dealDamageToCreature(randomTarget.playerId, randomTarget.instanceId, 1);
            api.log('Stealth Infiltrator strikes from the shadows');
          }
        }
        
        return true;
      }),
      description: 'Strike a random enemy creature after attacking'
    }]
  },
  'card_016': {
    id: 'card_016',
    name: 'Chain Lightning',
    cost: 4,
    type: 'spell',
    description: 'Deal 2 damage to up to 3 targets.',
    spellEffect: functionToString(async (api) => {
      const targets = await api.selectTargets({
        targetCount: 3,
        targetType: 'any',
        canTargetSelf: false,
        autoTarget: false, // Multi-target spell needs manual selection
        description: 'Choose up to 3 targets for Chain Lightning (2 damage each)'
      });
      
      if (targets.length === 0) {
        api.log('No targets selected for Chain Lightning');
        return false;
      }
      
      targets.forEach((target: any) => {
        if (target.type === 'player') {
          api.dealDamageToPlayer(target.playerId, 2);
        } else if (target.type === 'creature' && target.instanceId) {
          api.dealDamageToCreature(target.playerId, target.instanceId, 2);
        }
      });
      
      api.log(`Chain Lightning strikes ${targets.length} target(s) for 2 damage each`);
      return true;
    })
  },
  'card_017': {
    id: 'card_017',
    name: 'Mass Heal',
    cost: 3,
    type: 'spell',
    description: 'Restore 3 health to yourself and all your creatures.',
    spellEffect: functionToString(async (api) => {
      let healed = 0;
      
      // Heal the caster
      api.healPlayer(api.casterId, 3);
      healed++;
      
      // Heal all own creatures
      const ownCreatures = api.getCreaturesForPlayer(api.casterId);
      ownCreatures.forEach((creature: any) => {
        const creatureCard = api.doc.cardLibrary[creature.cardId];
        if (creatureCard && creatureCard.type === 'creature') {
          api.healCreature(api.casterId, creature.instanceId, 3);
          healed++;
        }
      });
      
      api.log(`Mass Heal restores 3 health to ${healed} target(s)`);
      return true;
    })
  },
  'card_018': {
    id: 'card_018',
    name: 'Neural Disruption',
    cost: 3,
    type: 'spell',
    description: 'Deal 1 damage to target creature and 1 damage to its owner.',
    spellEffect: functionToString(async (api) => {
      const targets = await api.selectTargets({
        targetCount: 1,
        targetType: 'creature',
        canTargetSelf: true,
        autoTarget: false, // Mind control needs manual selection
        description: 'Choose a creature for neural disruption'
      });
      
      if (targets.length === 0) {
        api.log('No target selected for Neural Disruption');
        return false;
      }
      
      const target = targets[0];
      if (target.instanceId) {
        // Damage the creature
        api.dealDamageToCreature(target.playerId, target.instanceId, 1);
        // Damage the owner
        api.dealDamageToPlayer(target.playerId, 1);
        api.log(`Neural Disruption damages creature and its owner`);
      }
      
      return true;
    })
  },
  'card_019': {
    id: 'card_019',
    name: 'Electromagnetic Pulse',
    cost: 5,
    type: 'spell',
    description: 'Destroy all creatures on the battlefield.',
    spellEffect: functionToString(async (api) => {
      const allPlayers = api.getAllPlayers();
      let destroyedCount = 0;
      
      allPlayers.forEach((playerId: any) => {
        const creatures = api.getCreaturesForPlayer(playerId);
        creatures.forEach((creature: any) => {
          api.destroyCreature(playerId, creature.instanceId);
          destroyedCount++;
        });
      });
      
      if (destroyedCount > 0) {
        api.log(`Electromagnetic Pulse destroys ${destroyedCount} creature(s)`);
      } else {
        api.log('Electromagnetic Pulse finds no creatures to destroy');
      }
      
      return true;
    })
  },
  'card_020': {
    id: 'card_020',
    name: 'Targeted Strike',
    cost: 2,
    type: 'spell',
    description: 'Deal 2 damage to target creature and 1 damage to its owner.',
    spellEffect: functionToString(async (api) => {
      const targets = await api.selectTargets({
        targetCount: 1,
        targetType: 'creature',
        canTargetSelf: true,
        autoTarget: false, // Targeted spell needs manual selection
        description: 'Choose a creature for Targeted Strike'
      });
      
      if (targets.length === 0) {
        api.log('No target selected for Targeted Strike');
        return false;
      }
      
      const target = targets[0];
      if (target.instanceId) {
        api.dealDamageToCreature(target.playerId, target.instanceId, 2);
        api.dealDamageToPlayer(target.playerId, 1);
        api.log(`Targeted Strike hits creature for 2 and owner for 1 damage`);
      }
      
      return true;
    })
  },
  'card_021': {
    id: 'card_021',
    name: 'Cleansing Light',
    cost: 2,
    type: 'spell',
    description: 'Heal yourself for 4 health.',
    spellEffect: functionToString(async (api) => {
      api.healPlayer(api.casterId, 4);
      api.log('Cleansing Light restores 4 health');
      return true;
    })
  },
  'card_022': {
    id: 'card_022',
    name: 'Twin Missiles',
    cost: 3,
    type: 'spell',
    description: 'Deal 2 damage to two different targets.',
    spellEffect: functionToString(async (api) => {
      const targets = await api.selectTargets({
        targetCount: 2,
        targetType: 'any',
        canTargetSelf: false,
        autoTarget: false, // Multi-target spell needs manual selection
        description: 'Choose 2 targets for Twin Missiles (2 damage each)'
      });
      
      if (targets.length === 0) {
        api.log('No targets selected for Twin Missiles');
        return false;
      }
      
      targets.forEach((target: any) => {
        if (target.type === 'player') {
          api.dealDamageToPlayer(target.playerId, 2);
        } else if (target.type === 'creature' && target.instanceId) {
          api.dealDamageToCreature(target.playerId, target.instanceId, 2);
        }
      });
      
      api.log(`Twin Missiles hit ${targets.length} target(s) for 2 damage each`);
      return true;
    })
  },
  'card_023': {
    id: 'card_023',
    name: 'Overcharge',
    cost: 1,
    type: 'spell',
    description: 'Deal 1 damage to all enemies.',
    spellEffect: functionToString(async (api) => {
      const allPlayers = api.getAllPlayers();
      const enemies = allPlayers.filter((p: any) => p !== api.casterId);
      let damagedCount = 0;
      
      enemies.forEach((enemyId: any) => {
        api.dealDamageToPlayer(enemyId, 1);
        damagedCount++;
        
        // Also damage all enemy creatures
        const creatures = api.getCreaturesForPlayer(enemyId);
        creatures.forEach((creature: any) => {
          api.dealDamageToCreature(enemyId, creature.instanceId, 1);
          damagedCount++;
        });
      });
      
      api.log(`Overcharge damages ${damagedCount} target(s) for 1 damage each`);
      return true;
    })
  },
  'card_024': {
    id: 'card_024',
    name: 'Anti-Artifact Hunter',
    cost: 3,
    attack: 3,
    health: 2,
    type: 'creature',
    description: 'Can only attack artifacts.',
    attackTargeting: {
      canTargetPlayers: false,
      canTargetCreatures: false,
      canTargetArtifacts: true,
      description: 'Can only target artifacts'
    }
  },
  'card_025': {
    id: 'card_025',
    name: 'Defensive Turret',
    cost: 2,
    attack: 1,
    health: 4,
    type: 'creature',
    description: 'Can only attack creatures, not players.',
    attackTargeting: {
      canTargetPlayers: false,
      canTargetCreatures: true,
      canTargetArtifacts: true,
      description: 'Cannot target players directly'
    }
  },
  'card_026': {
    id: 'card_026',
    name: 'Assassin Drone',
    cost: 4,
    attack: 3,
    health: 2,
    type: 'creature',
    description: 'Fast unit that can attack anything.',
    attackTargeting: {
      canTargetPlayers: true,
      canTargetCreatures: true,
      canTargetArtifacts: true,
      description: 'Can target any valid target'
    }
  },
  'card_027': {
    id: 'card_027',
    name: 'Siege Breaker',
    cost: 5,
    attack: 4,
    health: 3,
    type: 'creature',
    description: 'Specialized in destroying defensive structures.',
    attackTargeting: {
      canTargetPlayers: true,
      canTargetCreatures: false,
      canTargetArtifacts: true,
      description: 'Can target players and artifacts only'
    }
  },
  'card_028': {
    id: 'card_028',
    name: 'Artifact Repair',
    cost: 2,
    type: 'spell',
    description: 'Restore all your artifacts to full health.',
    spellEffect: functionToString(async (api) => {
      let repaired = 0;
      
      // Repair all own artifacts
      const ownCreatures = api.getCreaturesForPlayer(api.casterId);
      ownCreatures.forEach((creature: any) => {
        const creatureCard = api.doc.cardLibrary[creature.cardId];
        if (creatureCard && creatureCard.type === 'artifact') {
          // Find the battlefield card to check current health
          const battlefield = api.doc.playerBattlefields.find((b: any) => b.playerId === api.casterId);
          const battlefieldCard = battlefield?.cards.find((c: any) => c.instanceId === creature.instanceId);
          
          if (battlefieldCard && battlefieldCard.currentHealth < (creatureCard.health || 1)) {
            const healAmount = (creatureCard.health || 1) - battlefieldCard.currentHealth;
            api.healCreature(api.casterId, creature.instanceId, healAmount);
            repaired++;
          }
        }
      });
      
      if (repaired > 0) {
        api.log(`Artifact Repair restored ${repaired} artifact(s) to full health`);
      } else {
        api.log('Artifact Repair found no damaged artifacts to repair');
      }
      return true;
    })
  },
  'card_029': {
    id: 'card_029',
    name: 'Energy Collector',
    cost: 3,
    health: 4,
    type: 'artifact',
    description: 'At start of turn: Draw a card.',
    triggeredAbilities: [{
      trigger: 'start_turn',
      effectCode: functionToString(async (api) => {
        api.drawCard();
        api.log('Energy Collector gathered data and drew a card');
        return true;
      }),
      description: 'Draw a card at start of turn'
    }]
  },
  'card_030': {
    id: 'card_030',
    name: 'Shield Generator',
    cost: 2,
    health: 3,
    type: 'artifact',
    description: 'At the end of your turn, heal all your creatures for 1.',
    triggeredAbilities: [{
      trigger: 'end_turn',
      effectCode: functionToString(async (api) => {
        const creatures = api.getOwnCreatures();
        let healedCount = 0;
        
        creatures.forEach((creature: {instanceId: string, cardId: string}) => {
          api.healCreature(api.ownerId, creature.instanceId, 1);
          healedCount++;
        });
        
        if (healedCount > 0) {
          api.log(`Shield Generator healed ${healedCount} creature(s)`);
        }
        return true;
      }),
      description: 'Heal all your creatures for 1'
    }]
  },
  'card_031': {
    id: 'card_031',
    name: 'Lightning Rod',
    cost: 4,
    health: 2,
    type: 'artifact',
    description: 'At the start of your turn, deal 1 damage to a random enemy.',
    triggeredAbilities: [{
      trigger: 'start_turn',
      effectCode: functionToString(async (api) => {
        const allPlayers = api.getAllPlayers();
        const enemies = allPlayers.filter((p: any) => p !== api.ownerId);
        
        if (enemies.length > 0) {
          // Pick a random enemy
          const randomEnemy = enemies[Math.floor(Math.random() * enemies.length)];
          api.dealDamageToPlayer(randomEnemy, 1);
          api.log('Lightning Rod strikes a random enemy');
        }
        return true;
      }),
      description: 'Deal 1 damage to random enemy'
    }]
  },
  'card_032': {
    id: 'card_032',
    name: 'Quantum Processor',
    cost: 5,
    health: 4,
    type: 'artifact',
    description: 'At start of turn: draw a card and gain 1 energy. At end of turn: heal all your creatures for 1.',
    triggeredAbilities: [
      {
        trigger: 'start_turn',
        effectCode: functionToString(async (api) => {
          api.drawCard();
          api.gainEnergy(1);
          api.log('Quantum Processor draws a card and grants energy');
          return true;
        }),
        description: 'Draw a card and gain 1 energy'
      },
      {
        trigger: 'end_turn',
        effectCode: functionToString(async (api) => {
          const creatures = api.getOwnCreatures();
          let healedCount = 0;
          
          creatures.forEach((creature: {instanceId: string, cardId: string}) => {
            api.healCreature(api.ownerId, creature.instanceId, 1);
            healedCount++;
          });
          
          if (healedCount > 0) {
            api.log(`Quantum Processor healed ${healedCount} creature(s)`);
          }
          return true;
        }),
        description: 'Heal all your creatures for 1'
      }
    ]
  },
  'card_033': {
    id: 'card_033',
    name: 'Cyber Medic',
    cost: 3,
    attack: 2,
    health: 3,
    type: 'creature',
    description: 'When another creature takes damage: Heal it for 1.',
    triggeredAbilities: [{
      trigger: 'take_damage', // This will trigger when any creature takes damage
      effectCode: functionToString(async (api) => {
        // For now, implement as start of turn healing for simplicity
        const creatures = api.getOwnCreatures();
        let healedCount = 0;
        
        creatures.forEach((creature: {instanceId: string, cardId: string}) => {
          if (creature.instanceId !== api.instanceId) {
            const creatureCard = api.doc.cardLibrary[creature.cardId];
            if (creatureCard && creatureCard.type === 'creature') {
              const battlefield = api.doc.playerBattlefields.find((b: any) => b.playerId === api.ownerId);
              const battlefieldCard = battlefield?.cards.find((c: any) => c.instanceId === creature.instanceId);
              
              if (battlefieldCard && battlefieldCard.currentHealth < (creatureCard.health || 1)) {
                api.healCreature(api.ownerId, creature.instanceId, 1);
                healedCount++;
              }
            }
          }
        });
        
        if (healedCount > 0) {
          api.log(`Cyber Medic healed ${healedCount} damaged creature(s)`);
        }
        return true;
      }),
      description: 'Heal damaged creatures'
    }]
  },
  'card_034': {
    id: 'card_034',
    name: 'Energy Vampire',
    cost: 3,
    attack: 2,
    health: 3,
    type: 'creature',
    description: 'When an opponent plays a card: Deal 1 damage to that player.',
    triggeredAbilities: [{
      trigger: 'play_card',
      effectCode: functionToString(async (api) => {
        // Deal damage to all opponents when any card is played
        const allPlayers = api.getAllPlayers();
        const enemies = allPlayers.filter((p: any) => p !== api.ownerId);
        
        enemies.forEach((enemyId: any) => {
          api.dealDamageToPlayer(enemyId, 1);
        });
        
        if (enemies.length > 0) {
          api.log('Energy Vampire drains life force from opponent activity');
        }
        return true;
      }),
      description: 'Deal 1 damage to opponents when they play cards'
    }]
  },
  'card_035': {
    id: 'card_035',
    name: 'Nano Swarm',
    cost: 2,
    attack: 1,
    health: 2,
    type: 'creature',
    description: 'At start of turn: Deal 1 damage to a random enemy.',
    triggeredAbilities: [{
      trigger: 'start_turn',
      effectCode: functionToString(async (api) => {
        const allPlayers = api.getAllPlayers();
        const enemies = allPlayers.filter((p: any) => p !== api.ownerId);
        
        if (enemies.length > 0) {
          // Pick a random enemy
          const randomEnemy = enemies[Math.floor(Math.random() * enemies.length)];
          api.dealDamageToPlayer(randomEnemy, 1);
          api.log('Nano Swarm stings a random enemy');
        }
        return true;
      }),
      description: 'Deal 1 damage to random enemy'
    }]
  },
  'card_036': {
    id: 'card_036',
    name: 'Shield Drone',
    cost: 2,
    attack: 0,
    health: 4,
    type: 'creature',
    description: 'At end of turn: Heal all your other creatures for 1.',
    triggeredAbilities: [{
      trigger: 'end_turn',
      effectCode: functionToString(async (api) => {
        const creatures = api.getOwnCreatures();
        let healedCount = 0;
        
        creatures.forEach((creature: {instanceId: string, cardId: string}) => {
          if (creature.instanceId !== api.instanceId) {
            api.healCreature(api.ownerId, creature.instanceId, 1);
            healedCount++;
          }
        });
        
        if (healedCount > 0) {
          api.log(`Shield Drone reinforced ${healedCount} creature(s)`);
        }
        return true;
      }),
      description: 'Heal other creatures for 1'
    }]
  },
  'card_037': {
    id: 'card_037',
    name: 'Data Miner',
    cost: 2,
    attack: 1,
    health: 2,
    type: 'creature',
    description: 'At start of turn: Draw a card.',
    triggeredAbilities: [{
      trigger: 'start_turn',
      effectCode: functionToString(async (api) => {
        api.drawCard();
        api.log('Data Miner excavated information (draw card)');
        return true;
      }),
      description: 'Draw a card'
    }]
  },
  'card_038': {
    id: 'card_038',
    name: 'Berserker Bot',
    cost: 4,
    attack: 5,
    health: 1,
    type: 'creature',
    description: 'High-risk, high-reward combat unit.'
  },
  'card_039': {
    id: 'card_039',
    name: 'Healing Station',
    cost: 3,
    health: 5,
    type: 'artifact',
    description: 'At start of turn: Restore 2 health to yourself.',
    triggeredAbilities: [{
      trigger: 'start_turn',
      effectCode: functionToString(async (api) => {
        api.healPlayer(api.ownerId, 2);
        api.log('Healing Station restored 2 health');
        return true;
      }),
      description: 'Heal owner for 2'
    }]
  },
  'card_040': {
    id: 'card_040',
    name: 'Recon Specialist',
    cost: 1,
    attack: 1,
    health: 1,
    type: 'creature',
    description: 'When any card is played: Draw a card.',
    triggeredAbilities: [{
      trigger: 'play_card',
      effectCode: functionToString(async (api) => {
        api.drawCard();
        api.log('Recon Specialist gathered intelligence');
        return true;
      }),
      description: 'Draw a card when any card is played'
    }]
  },
  'card_041': {
    id: 'card_041',
    name: 'Volatile Core',
    cost: 2,
    health: 3,
    type: 'artifact',
    description: 'When an opponent plays a card: Deal 1 damage to all enemies.',
    triggeredAbilities: [{
      trigger: 'play_card',
      effectCode: functionToString(async (api) => {
        const allPlayers = api.getAllPlayers();
        const enemies = allPlayers.filter((p: any) => p !== api.ownerId);
        let damagedCount = 0;
        
        enemies.forEach((enemyId: any) => {
          api.dealDamageToPlayer(enemyId, 1);
          damagedCount++;
          
          // Also damage all enemy creatures
          const creatures = api.getCreaturesForPlayer(enemyId);
          creatures.forEach((creature: any) => {
            api.dealDamageToCreature(enemyId, creature.instanceId, 1);
            damagedCount++;
          });
        });
        
        if (damagedCount > 0) {
          api.log(`Volatile Core exploded, damaging ${damagedCount} target(s)`);
        }
        return true;
      }),
      description: 'Damage all enemies when opponents play cards'
    }]
  },
  'card_042': {
    id: 'card_042',
    name: 'Resource Recycler',
    cost: 4,
    health: 4,
    type: 'artifact',
    description: 'At start and end of turn: Gain 1 energy.',
    triggeredAbilities: [
      {
        trigger: 'start_turn',
        effectCode: functionToString(async (api) => {
          api.gainEnergy(1);
          api.log('Resource Recycler generated energy');
          return true;
        }),
        description: 'Gain 1 energy at start of turn'
      },
      {
        trigger: 'end_turn',
        effectCode: functionToString(async (api) => {
          api.gainEnergy(1);
          api.log('Resource Recycler recycled energy');
          return true;
        }),
        description: 'Gain 1 energy at end of turn'
      }
    ]
  },
  'card_043': {
    id: 'card_043',
    name: 'Omega Destroyer',
    cost: 8,
    attack: 7,
    health: 7,
    type: 'creature',
    description: 'When played: Deal 3 damage to all enemies. At start of turn: Deal 2 damage to all enemies.',
    triggeredAbilities: [
      {
        trigger: 'play_card',
        effectCode: functionToString(async (api) => {
          // Deal damage to all enemies when this card is played
          const allPlayers = api.getAllPlayers();
          const enemies = allPlayers.filter((p: any) => p !== api.ownerId);
          let damagedCount = 0;
          
          enemies.forEach((enemyId: any) => {
            api.dealDamageToPlayer(enemyId, 3);
            damagedCount++;
            
            // Also damage all enemy creatures
            const creatures = api.getCreaturesForPlayer(enemyId);
            creatures.forEach((creature: any) => {
              api.dealDamageToCreature(enemyId, creature.instanceId, 3);
              damagedCount++;
            });
          });
          
          if (damagedCount > 0) {
            api.log(`Omega Destroyer's arrival devastates ${damagedCount} target(s)`);
          }
          return true;
        }),
        description: 'Deal 3 damage to all enemies when played'
      },
      {
        trigger: 'start_turn',
        effectCode: functionToString(async (api) => {
          const allPlayers = api.getAllPlayers();
          const enemies = allPlayers.filter((p: any) => p !== api.ownerId);
          let damagedCount = 0;
          
          enemies.forEach((enemyId: any) => {
            api.dealDamageToPlayer(enemyId, 2);
            damagedCount++;
            
            const creatures = api.getCreaturesForPlayer(enemyId);
            creatures.forEach((creature: any) => {
              api.dealDamageToCreature(enemyId, creature.instanceId, 2);
              damagedCount++;
            });
          });
          
          if (damagedCount > 0) {
            api.log(`Omega Destroyer continues its rampage against ${damagedCount} target(s)`);
          }
          return true;
        }),
        description: 'Deal 2 damage to all enemies each turn'
      }
    ]
  },
  'card_044': {
    id: 'card_044',
    name: 'Titan Forge',
    cost: 7,
    health: 8,
    type: 'artifact',
    description: 'At start of turn: Create a 3/3 Construct creature. At end of turn: Heal all your creatures to full health.',
    triggeredAbilities: [
      {
        trigger: 'start_turn',
        effectCode: functionToString(async (api) => {
          // We can't actually create new cards, so instead give massive bonuses
          api.drawCard();
          api.drawCard();
          api.gainEnergy(2);
          api.log('Titan Forge produces resources and constructs');
          return true;
        }),
        description: 'Generate massive resources'
      },
      {
        trigger: 'end_turn',
        effectCode: functionToString(async (api) => {
          const creatures = api.getOwnCreatures();
          let healedCount = 0;
          
          creatures.forEach((creature: {instanceId: string, cardId: string}) => {
            const creatureCard = api.doc.cardLibrary[creature.cardId];
            if (creatureCard && creatureCard.type === 'creature') {
              // Find the battlefield card to check current health
              const battlefield = api.doc.playerBattlefields.find((b: any) => b.playerId === api.ownerId);
              const battlefieldCard = battlefield?.cards.find((c: any) => c.instanceId === creature.instanceId);
              
              if (battlefieldCard && battlefieldCard.currentHealth < (creatureCard.health || 1)) {
                const healAmount = (creatureCard.health || 1) - battlefieldCard.currentHealth;
                api.healCreature(api.ownerId, creature.instanceId, healAmount);
                healedCount++;
              }
            }
          });
          
          if (healedCount > 0) {
            api.log(`Titan Forge restored ${healedCount} creature(s) to full health`);
          }
          return true;
        }),
        description: 'Heal all creatures to full health'
      }
    ]
  },
  'card_045': {
    id: 'card_045',
    name: 'Mind Dominator',
    cost: 9,
    attack: 4,
    health: 6,
    type: 'creature',
    description: 'When played: Deal 4 damage to all enemy creatures. At end of turn: Heal yourself for 3.',
    triggeredAbilities: [
      {
        trigger: 'play_card',
        effectCode: functionToString(async (api) => {
          const allPlayers = api.getAllPlayers();
          const enemies = allPlayers.filter((p: any) => p !== api.ownerId);
          let damagedCount = 0;
          
          enemies.forEach((enemyId: any) => {
            const creatures = api.getCreaturesForPlayer(enemyId);
            creatures.forEach((creature: any) => {
              api.dealDamageToCreature(enemyId, creature.instanceId, 4);
              damagedCount++;
            });
          });
          
          if (damagedCount > 0) {
            api.log(`Mind Dominator destroys ${damagedCount} enemy creature(s)`);
          }
          return true;
        }),
        description: 'Deal 4 damage to all enemy creatures when played'
      },
      {
        trigger: 'end_turn',
        effectCode: functionToString(async (api) => {
          api.healPlayer(api.ownerId, 3);
          api.log('Mind Dominator regenerates its master');
          return true;
        }),
        description: 'Heal owner for 3 each turn'
      }
    ]
  },
  'card_046': {
    id: 'card_046',
    name: 'Reality Shatter',
    cost: 10,
    type: 'spell',
    description: 'Destroy all enemy creatures and artifacts. Deal 5 damage to all enemies.',
    spellEffect: functionToString(async (api) => {
      const allPlayers = api.getAllPlayers();
      const enemies = allPlayers.filter((p: any) => p !== api.casterId);
      let totalDestroyed = 0;
      
      // Destroy all enemy creatures and artifacts
      enemies.forEach((enemyId: any) => {
        const creatures = api.getCreaturesForPlayer(enemyId);
        creatures.forEach((creature: any) => {
          api.destroyCreature(enemyId, creature.instanceId);
          totalDestroyed++;
        });
        
        // Deal 5 damage to enemy players
        api.dealDamageToPlayer(enemyId, 5);
      });
      
      api.log(`Reality Shatter destroys ${totalDestroyed} enemy unit(s) and deals 5 damage to all enemies`);
      return true;
    })
  },
  'card_047': {
    id: 'card_047',
    name: 'Apocalypse Engine',
    cost: 8,
    health: 10,
    type: 'artifact',
    description: 'At start and end of turn: Deal 2 damage to all enemies and heal yourself for 2.',
    triggeredAbilities: [
      {
        trigger: 'start_turn',
        effectCode: functionToString(async (api) => {
          const allPlayers = api.getAllPlayers();
          const enemies = allPlayers.filter((p: any) => p !== api.ownerId);
          let damagedCount = 0;
          
          enemies.forEach((enemyId: any) => {
            api.dealDamageToPlayer(enemyId, 2);
            damagedCount++;
            
            const creatures = api.getCreaturesForPlayer(enemyId);
            creatures.forEach((creature: any) => {
              api.dealDamageToCreature(enemyId, creature.instanceId, 2);
              damagedCount++;
            });
          });
          
          api.healPlayer(api.ownerId, 2);
          api.log(`Apocalypse Engine's dawn phase damages ${damagedCount} enemies and heals owner`);
          return true;
        }),
        description: 'Deal 2 damage to all enemies and heal owner'
      },
      {
        trigger: 'end_turn',
        effectCode: functionToString(async (api) => {
          const allPlayers = api.getAllPlayers();
          const enemies = allPlayers.filter((p: any) => p !== api.ownerId);
          let damagedCount = 0;
          
          enemies.forEach((enemyId: any) => {
            api.dealDamageToPlayer(enemyId, 2);
            damagedCount++;
            
            const creatures = api.getCreaturesForPlayer(enemyId);
            creatures.forEach((creature: any) => {
              api.dealDamageToCreature(enemyId, creature.instanceId, 2);
              damagedCount++;
            });
          });
          
          api.healPlayer(api.ownerId, 2);
          api.log(`Apocalypse Engine's dusk phase damages ${damagedCount} enemies and heals owner`);
          return true;
        }),
        description: 'Deal 2 damage to all enemies and heal owner'
      }
    ]
  },
  
  'card_048': {
    id: 'card_048',
    name: 'Void Assassin',
    cost: 4,
    attack: 1,
    health: 3,
    type: 'creature',
    description: 'When this creature deals damage, destroy the target.',
    triggeredAbilities: [{
      trigger: 'deal_damage',
      effectCode: functionToString(async (api, context) => {
        // Use the context to get information about the damage target
        if (context?.damageTarget) {
          const { playerId, instanceId } = context.damageTarget;
          
          if (instanceId) {
            // If targeting a creature, destroy it directly
            api.destroyCreature(playerId, instanceId);
            api.log(`Void Assassin's ability destroys the targeted creature`);
            return true;
          }
        }
        
        api.log('Void Assassin ability triggered but no valid target found');
        return false;
      }),
      description: 'Destroy target creature when dealing damage'
    }]
  }
};

// Create a standard deck with multiple copies of cards
export const createStandardDeck = (): string[] => {
  const deck: string[] = [];
  
  // Add multiple copies of each card (varying amounts for balance)
  const cardCopies: { [cardId: string]: number } = {
    'card_001': 3, // Cyber Drone
    'card_002': 2, // Plasma Burst
    'card_003': 2, // Steel Sentinel
    'card_005': 1, // Quantum Destroyer (rare)
    'card_006': 4, // Data Spike (common)
    'card_007': 1, // Bio-Mech Guardian (rare)
    'card_008': 3, // Energy Shield
    'card_009': 2, // Neural Interface
    'card_010': 2, // Fusion Core
    'card_011': 3, // Assault Bot
    'card_012': 2, // System Crash
    'card_013': 3, // Repair Drone
    'card_014': 1, // Photon Cannon (rare)
    'card_015': 3, // Stealth Infiltrator
    'card_016': 1, // Chain Lightning (rare)
    'card_017': 2, // Mass Heal
    'card_018': 2, // Neural Disruption
    'card_019': 1, // Electromagnetic Pulse (rare)
    'card_020': 2, // Targeted Strike
    'card_021': 3, // Cleansing Light
    'card_022': 2, // Twin Missiles
    'card_023': 3, // Overcharge (common)
    'card_024': 2, // Anti-Artifact Hunter
    'card_025': 3, // Defensive Turret
    'card_026': 2, // Assassin Drone
    'card_027': 1, // Siege Breaker (rare)
    'card_028': 2, // Artifact Repair (uncommon)
    'card_029': 2, // Energy Collector
    'card_030': 2, // Shield Generator
    'card_031': 1, // Lightning Rod (rare)
    'card_032': 1, // Quantum Processor (rare - powerful dual ability)
    'card_033': 2, // Cyber Medic
    'card_034': 2, // Energy Vampire
    'card_035': 3, // Nano Swarm (common)
    'card_036': 2, // Shield Drone
    'card_037': 2, // Data Miner
    'card_038': 2, // Berserker Bot
    'card_039': 2, // Healing Station
    'card_040': 3, // Recon Specialist (common)
    'card_041': 1, // Volatile Core (rare)
    'card_042': 1, // Resource Recycler (rare)
    'card_043': 1, // Omega Destroyer (legendary)
    'card_044': 1, // Titan Forge (legendary)
    'card_045': 1, // Mind Dominator (legendary)
    'card_046': 1, // Reality Shatter (legendary)
    'card_047': 1, // Apocalypse Engine (legendary)
    'card_048': 10, // Void Assassin (rare)
  };
  
  // Validate that all cards in cardCopies exist in CARD_LIBRARY
  const missingCards = Object.keys(cardCopies).filter(cardId => !CARD_LIBRARY[cardId]);
  if (missingCards.length > 0) {
    throw new Error(`createStandardDeck: Cards in deck but not in library: ${missingCards.join(', ')}`);
  }
  
  // Add cards to deck based on copy counts
  Object.entries(cardCopies).forEach(([cardId, count]) => {
    for (let i = 0; i < count; i++) {
      deck.push(cardId);
    }
  });
  
  return deck;
};

// Shuffle an array (Fisher-Yates algorithm)
export const shuffleDeck = (deck: string[]): string[] => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Draw cards from deck
export const drawCards = (deck: string[], count: number): { drawnCards: string[], remainingDeck: string[] } => {
  const drawnCards = deck.slice(0, count);
  const remainingDeck = deck.slice(count);
  return { drawnCards, remainingDeck };
};
