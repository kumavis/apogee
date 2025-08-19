import { AutomergeUrl } from '@automerge/react';
import { GameDoc, GameCard } from '../docs/game';

// Targeting types
export type Target = {
  type: 'player' | 'creature' | 'artifact';
  playerId: AutomergeUrl;
  instanceId?: string; // Required for creature/artifact targets
};

export type TargetSelector = {
  targetCount: number;
  targetType: 'player' | 'creature' | 'artifact' | 'any';
  
  // Self-targeting rule
  canTargetSelf?: boolean;
  
  // Attack-style rules (type-specific)
  canTargetPlayers?: boolean;
  canTargetCreatures?: boolean;
  canTargetArtifacts?: boolean;
  restrictedTypes?: ('creature' | 'artifact')[];
  
  description: string;
  autoTarget?: boolean; // Enable auto-targeting behavior
  
  // Context for targeting
  sourcerId?: AutomergeUrl; // Who is doing the targeting (for self-targeting validation)
};

export type TargetValidationResult = {
  isValid: boolean;
  reason?: string;
};

// Core validation function for unified targeting
export const validateTarget = (
  target: Target,
  selector: TargetSelector,
  doc: GameDoc,
  sourcerId?: AutomergeUrl
): TargetValidationResult => {
  const actualSourceId = sourcerId || selector.sourcerId;
  
  // Type-based validation first
  if (selector.targetType !== 'any' && target.type !== selector.targetType) {
    return { isValid: false, reason: `Cannot target ${target.type}, expected ${selector.targetType}` };
  }
  
  // Attack-style validation (type-specific rules)
  if (selector.canTargetPlayers !== undefined || 
      selector.canTargetCreatures !== undefined || 
      selector.canTargetArtifacts !== undefined ||
      selector.restrictedTypes) {
    
    switch (target.type) {
      case 'player':
        if (selector.canTargetPlayers === false) {
          return { isValid: false, reason: 'Cannot target players' };
        }
        break;
        
      case 'creature':
        if (selector.canTargetCreatures === false) {
          return { isValid: false, reason: 'Cannot target creatures' };
        }
        if (selector.restrictedTypes && !selector.restrictedTypes.includes('creature')) {
          return { isValid: false, reason: 'Creature type not in allowed targets' };
        }
        break;
        
      case 'artifact':
        if (selector.canTargetArtifacts === false) {
          return { isValid: false, reason: 'Cannot target artifacts' };
        }
        if (selector.restrictedTypes && !selector.restrictedTypes.includes('artifact')) {
          return { isValid: false, reason: 'Artifact type not in allowed targets' };
        }
        break;
    }
  }
  
  // Own/enemy targeting validation
  if (actualSourceId && selector.canTargetSelf !== undefined) {
    const isTargetingOwnSide = target.playerId === actualSourceId;
    
    if (isTargetingOwnSide && selector.canTargetSelf === false) {
      // For player targets, this means "cannot target yourself"
      // For creature/artifact targets, this means "cannot target your own units"
      const reason = target.type === 'player' ? 'Cannot target self' : 'Cannot target your own units';
      return { isValid: false, reason };
    }
  }
  
  // Validate that the target actually exists in the game state
  if (target.type === 'player') {
    if (!doc.players.includes(target.playerId)) {
      return { isValid: false, reason: 'Player not found in game' };
    }
  } else if (target.type === 'creature' || target.type === 'artifact') {
    if (!target.instanceId) {
      return { isValid: false, reason: 'Creature/artifact target missing instanceId' };
    }
    
    const battlefield = doc.playerBattlefields.find(b => b.playerId === target.playerId);
    const battlefieldCard = battlefield?.cards.find(c => c.instanceId === target.instanceId);
    
    if (!battlefieldCard) {
      return { isValid: false, reason: 'Creature/artifact not found on battlefield' };
    }
    
    const gameCard = doc.cardLibrary[battlefieldCard.cardId];
    if (!gameCard || gameCard.type !== target.type) {
      return { isValid: false, reason: `Card type mismatch: expected ${target.type}` };
    }
  }
  
  return { isValid: true };
};

// Get all valid targets for a selector
export const getValidTargets = (
  selector: TargetSelector,
  doc: GameDoc,
  sourcerId?: AutomergeUrl
): Target[] => {
  const validTargets: Target[] = [];
  const actualSourceId = sourcerId || selector.sourcerId;
  
  // Add player targets
  if (selector.targetType === 'player' || selector.targetType === 'any') {
    for (const playerId of doc.players) {
      const target: Target = { type: 'player', playerId };
      const validation = validateTarget(target, selector, doc, actualSourceId);
      if (validation.isValid) {
        validTargets.push(target);
      }
    }
  }
  
  // Add creature/artifact targets
  if (selector.targetType === 'creature' || selector.targetType === 'artifact' || selector.targetType === 'any') {
    for (const battlefield of doc.playerBattlefields) {
      for (const battlefieldCard of battlefield.cards) {
        const gameCard = doc.cardLibrary[battlefieldCard.cardId];
        if (!gameCard) continue;
        
        if ((selector.targetType === 'any' || selector.targetType === gameCard.type) &&
            (gameCard.type === 'creature' || gameCard.type === 'artifact')) {
          const target: Target = {
            type: gameCard.type,
            playerId: battlefield.playerId,
            instanceId: battlefieldCard.instanceId
          };
          
          const validation = validateTarget(target, selector, doc, actualSourceId);
          if (validation.isValid) {
            validTargets.push(target);
          }
        }
      }
    }
  }
  
  return validTargets;
};

// Auto-targeting logic
export const getAutoTargets = (
  selector: TargetSelector,
  doc: GameDoc,
  sourcerId?: AutomergeUrl
): Target[] => {
  if (!selector.autoTarget) {
    return [];
  }
  
  const validTargets = getValidTargets(selector, doc, sourcerId);

  // For single target selectors, auto-target if only one option
  if (selector.targetCount === 1 && validTargets.length === 1) {
    return validTargets;
  }
  
  return [];
};

// Convert creature attack targeting to unified selector
export const getTargetingSelectorForAttack = (
  creatureCard: GameCard,
  sourcerId: AutomergeUrl
): TargetSelector => {
  const attackTargeting = creatureCard.attackTargeting;
  
  if (!attackTargeting) {
    // Default: can attack enemy units only (not self/own units)
    return {
      targetCount: 1,
      targetType: 'any',
      canTargetSelf: false, // Creatures cannot attack their own side
      canTargetPlayers: true,
      canTargetCreatures: true,
      canTargetArtifacts: true,
      description: 'Choose any enemy target to attack',
      autoTarget: false, // Attacks require manual selection
      sourcerId
    };
  }
  
  return {
    targetCount: 1,
    targetType: 'any',
    canTargetSelf: false, // Creatures cannot attack their own side
    canTargetPlayers: attackTargeting.canTargetPlayers,
    canTargetCreatures: attackTargeting.canTargetCreatures,
    canTargetArtifacts: attackTargeting.canTargetArtifacts,
    restrictedTypes: attackTargeting.restrictedTypes,
    description: attackTargeting.description || 'Choose an enemy target to attack',
    autoTarget: false, // Attacks require manual selection
    sourcerId
  };
};
