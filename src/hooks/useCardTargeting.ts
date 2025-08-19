import { useState, useCallback } from 'react';
import { AutomergeUrl } from '@automerge/react';
import { GameDoc, GameCard } from '../docs/game';
import { 
  Target, 
  TargetSelector, 
  getAutoTargets,
  validateTarget
} from '../utils/unifiedTargeting';

export type TargetingContext = {
  type: 'spell' | 'attack';
  cardId?: string;
  attackerInstanceId?: string;
  attackerCard?: GameCard;
};

export type CardTargetingState = {
  isTargeting: boolean;
  selector: TargetSelector | null;
  selectedTargets: Target[];
  context: TargetingContext | null;
  resolve: ((targets: Target[]) => void) | null;
};

export const useCardTargeting = (gameDoc: GameDoc, selfId: AutomergeUrl) => {
  const [state, setState] = useState<CardTargetingState>({
    isTargeting: false,
    selector: null,
    selectedTargets: [],
    context: null,
    resolve: null
  });

  // Generic targeting function - agnostic to use case
  const startTargeting = useCallback(async (
    selector: TargetSelector,
    context: TargetingContext
  ): Promise<Target[]> => {
    const enhancedSelector = { ...selector, sourcerId: selfId };
    
    // Check for auto-targeting first
    if (selector.autoTarget) {
      const autoTargets = getAutoTargets(enhancedSelector, gameDoc, selfId);
      if (autoTargets.length > 0) {
        return autoTargets;
      }
    }

    // Need manual targeting
    return new Promise((resolve) => {
      setState({
        isTargeting: true,
        selector: enhancedSelector,
        selectedTargets: [],
        context,
        resolve
      });
    });
  }, [gameDoc, selfId]);



  // Select/deselect a target
  const selectTarget = useCallback((target: Target) => {
    if (!state.isTargeting || !state.selector) return;

    const { selector, selectedTargets } = state;
    const newSelectedTargets = [...selectedTargets];

    // Check if target is already selected
    const targetIndex = newSelectedTargets.findIndex(t => 
      t.playerId === target.playerId && 
      t.instanceId === target.instanceId &&
      t.type === target.type
    );

    if (targetIndex >= 0) {
      // Remove if already selected
      newSelectedTargets.splice(targetIndex, 1);
    } else if (newSelectedTargets.length < selector.targetCount) {
      // Add if under target limit
      newSelectedTargets.push(target);
    } else if (selector.targetCount === 1) {
      // For single target, replace selection
      newSelectedTargets[0] = target;
    }

    setState(prev => ({
      ...prev,
      selectedTargets: newSelectedTargets
    }));

    // Auto-confirm for single-target when target is selected
    if (newSelectedTargets.length === selector.targetCount && selector.targetCount === 1) {
      setTimeout(() => confirmSelection(newSelectedTargets), 0);
    }
  }, [state]);

  // Confirm current selection
  const confirmSelection = useCallback((targets?: Target[]) => {
    const finalTargets = targets || state.selectedTargets;
    
    if (state.resolve) {
      state.resolve(finalTargets);
    }
    
    setState({
      isTargeting: false,
      selector: null,
      selectedTargets: [],
      context: null,
      resolve: null
    });
  }, [state]);

  // Cancel targeting
  const cancelTargeting = useCallback(() => {
    if (state.resolve) {
      state.resolve([]);
    }
    
    setState({
      isTargeting: false,
      selector: null,
      selectedTargets: [],
      context: null,
      resolve: null
    });
  }, [state]);

  // Check if a target can be targeted
  const canTarget = useCallback((target: Target): boolean => {
    if (!state.isTargeting || !state.selector) return false;
    
    const validation = validateTarget(target, state.selector, gameDoc, selfId);
    return validation.isValid;
  }, [state, gameDoc, selfId]);

  // Check if a target is selected
  const isTargetSelected = useCallback((target: Target): boolean => {
    return state.selectedTargets.some(t => 
      t.playerId === target.playerId && 
      t.instanceId === target.instanceId &&
      t.type === target.type
    );
  }, [state.selectedTargets]);

  // Helper to check if can target a specific player
  const canTargetPlayer = useCallback((playerId: AutomergeUrl): boolean => {
    const target: Target = { type: 'player', playerId };
    return canTarget(target);
  }, [canTarget]);

  // Helper to check if can target a specific creature/artifact
  const canTargetCreature = useCallback((playerId: AutomergeUrl, instanceId: string): boolean => {
    // Get the target's type from the game state
    const targetBattlefield = gameDoc.playerBattlefields.find(b => b.playerId === playerId);
    const targetCard = targetBattlefield?.cards.find(c => c.instanceId === instanceId);
    const targetGameCard = targetCard ? gameDoc.cardLibrary[targetCard.cardId] : null;
    
    if (!targetGameCard || targetGameCard.type === 'spell') return false;
    
    const target: Target = { 
      type: targetGameCard.type as 'creature' | 'artifact', 
      playerId, 
      instanceId 
    };
    return canTarget(target);
  }, [canTarget, gameDoc]);

  // Handle target click (always uses normal selection logic)
  const handleTargetClick = useCallback((target: Target) => {
    if (!state.isTargeting) return;
    selectTarget(target);
  }, [state, selectTarget]);

  return {
    // State
    targetingState: state,
    
    // Core targeting function
    startTargeting,
    
    // Actions
    selectTarget,
    confirmSelection,
    cancelTargeting,
    
    // Helpers
    canTarget,
    isTargetSelected,
    canTargetPlayer,
    canTargetCreature,
    handleTargetClick
  };
};
