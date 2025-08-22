import React, { useState, useMemo, useCallback } from 'react';
import { AutomergeUrl, useRepo, useDocument } from '@automerge/react';
import { GameDoc, removeCardFromHand, spendEnergy, addCardToGraveyard, addGameLogEntry, loadCardDoc } from '../docs/game';
import { CardDoc } from '../docs/card';
import { useGameNavigation } from '../hooks/useGameNavigation';
import { useCardTargeting } from '../hooks/useCardTargeting';
import Card, { CardData } from './Card';
import Contact from './Contact';
import GameLog from './GameLog';
import { SpellTargetSelector, SpellTarget, createSpellEffectAPI, executeSpellEffect, executeSpellOperations, executeSpellTriggeredAbilities } from '../utils/spellEffects';
import { Target, getTargetingSelectorForAttack } from '../utils/unifiedTargeting';

type NotPromise<T> = T extends Promise<any> ? never : T;

type TCGGameBoardProps = {
  gameDoc: GameDoc;
  selfId: AutomergeUrl;
  changeGameDoc: (callback: (doc: GameDoc) => NotPromise<void>) => void;
};

// Component for loading and displaying a hand card
const HandCard: React.FC<{
  cardUrl: AutomergeUrl;
  currentEnergy?: number;
  isCurrentPlayer: boolean;
  onPlay: (cardUrl: AutomergeUrl) => void;
  isTargeting: boolean;
}> = ({ cardUrl, currentEnergy = 0, isCurrentPlayer, onPlay, isTargeting }) => {
  const [cardDoc] = useDocument<CardDoc>(cardUrl, { suspense: false });

  if (!cardDoc) {
    return (
      <div style={{
        width: 120,
        height: 168,
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#666'
      }}>
        Loading...
      </div>
    );
  }

  const isPlayable = isCurrentPlayer && !isTargeting && cardDoc.cost <= currentEnergy;

  const cardData: CardData = {
    ...cardDoc,
    isPlayable
  };

  return (
    <div
      style={{
        cursor: (!isTargeting && isPlayable) ? 'pointer' : 'default',
        opacity: isTargeting ? 0.5 : (isPlayable ? 1 : 0.7)
      }}
    >
      <Card 
        card={cardData}
        onClick={!isTargeting && isPlayable ? () => onPlay(cardUrl) : undefined}
      />
    </div>
  );
};

// Component for loading and displaying a battlefield card
const BattlefieldCard: React.FC<{
  cardUrl: AutomergeUrl;
  instanceId: string;
  sapped: boolean;
  currentHealth: number;
  onAttack?: (instanceId: string) => void;
  canAttack?: boolean;
}> = ({ cardUrl, instanceId, sapped, currentHealth, onAttack, canAttack }) => {
  const [cardDoc] = useDocument<CardDoc>(cardUrl, { suspense: false });

  if (!cardDoc) {
    return (
      <div style={{
        width: 120,
        height: 168,
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#666'
      }}>
        Loading...
      </div>
    );
  }

  const cardData: CardData & { instanceId: string; sapped: boolean; currentHealth: number } = {
    ...cardDoc,
    instanceId,
    sapped,
    currentHealth,
    isPlayable: false
  };

  return (
    <div
      onClick={canAttack && onAttack ? () => onAttack(instanceId) : undefined}
      style={{
        cursor: canAttack ? 'pointer' : 'default',
        border: canAttack ? '2px solid #ff4444' : 'none',
        borderRadius: 8,
        boxShadow: canAttack ? '0 0 15px rgba(255,68,68,0.5)' : 'none'
      }}
    >
      <Card card={cardData} />
    </div>
  );
};

const TCGGameBoard: React.FC<TCGGameBoardProps> = ({
  gameDoc,
  selfId,
  changeGameDoc
}) => {
  const { navigateToHome } = useGameNavigation();
  const repo = useRepo();
  const [currentOpponentIndex, setCurrentOpponentIndex] = useState(0);
  const playerList = gameDoc.players;

  // Card targeting system
  const {
    targetingState,
    startTargeting,
    confirmSelection,
    cancelTargeting,
    canTargetPlayer,
    canTargetCreature,
    isTargetSelected,
    handleTargetClick: hookHandleTargetClick
  } = useCardTargeting(gameDoc, selfId);

  // Enhanced target click handler that auto-confirms single attack targets
  const handleTargetClick = useCallback((target: Target) => {
    // For attacks with single target requirement, directly confirm the target
    if (targetingState.context?.type === 'attack' &&
      targetingState.selector?.targetCount === 1) {
      // Check if target is already selected (to toggle it off) or if it's a new selection
      const isAlreadySelected = targetingState.selectedTargets.some(t =>
        t.playerId === target.playerId &&
        t.instanceId === target.instanceId &&
        t.type === target.type
      );

      if (isAlreadySelected) {
        // If already selected, deselect it
        hookHandleTargetClick(target);
      } else {
        // If not selected, select and immediately confirm
        confirmSelection([target]);
      }
    } else {
      // For spells and multi-target scenarios, use normal selection logic
      hookHandleTargetClick(target);
    }
  }, [hookHandleTargetClick, targetingState, confirmSelection]);

  // Check if it's the current player's turn
  const isCurrentPlayer = gameDoc.currentPlayerIndex === playerList.indexOf(selfId);

  // Get current player state
  const currentPlayerState = useMemo(() => {
    return gameDoc.playerStates?.find(state => state.playerId === selfId);
  }, [gameDoc.playerStates, selfId]);

  // Get player's hand card URLs
  const playerHandCardUrls = useMemo(() => {
    if (!gameDoc.playerHands) return [];
    const playerHandData = gameDoc.playerHands.find(hand => hand.playerId === selfId);
    return playerHandData ? playerHandData.cards : [];
  }, [gameDoc.playerHands, selfId]);

  // Get player's battlefield data
  const playerBattlefieldData = useMemo(() => {
    if (!gameDoc.playerBattlefields) return [];
    const playerBattlefieldData = gameDoc.playerBattlefields.find(battlefield => battlefield.playerId === selfId);
    return playerBattlefieldData ? playerBattlefieldData.cards : [];
  }, [gameDoc.playerBattlefields, selfId]);

  // Start attack targeting for a creature
  const handleStartAttackTargeting = async (instanceId: string) => {
    if (!isCurrentPlayer) {
      console.warn('handleStartAttackTargeting: Cannot attack - not current player');
      return;
    }

    // Find the battlefield card by instanceId
    const battlefieldCard = playerBattlefieldData.find(c => c.instanceId === instanceId);
    if (!battlefieldCard) {
      console.error(`handleStartAttackTargeting: Invalid creature instance: ${instanceId}`);
      return;
    }

    // Load the creature card for targeting restrictions
    const creatureCard = await loadCardDoc(battlefieldCard.cardUrl, repo);
    if (!creatureCard || !creatureCard.attack) {
      console.error(`handleStartAttackTargeting: Creature card not found or has no attack: ${battlefieldCard.cardUrl}`);
      return;
    }

    try {
      const selector = getTargetingSelectorForAttack(creatureCard, selfId);
      const targets = await startTargeting(selector, {
        type: 'attack',
        attackerInstanceId: instanceId,
        attackerCard: creatureCard
      });

      if (targets.length > 0) {
        handleExecuteAttack(instanceId, targets[0]);
      }
    } catch (error) {
      console.error('Attack targeting failed:', error);
    }
  };

  // Execute attack with selected target
  const handleExecuteAttack = async (attackerInstanceId: string, target: Target) => {
    console.log('handleExecuteAttack called with:', {
      attackerInstanceId,
      target,
      targetType: target.type,
      targetPlayerId: target.playerId,
      targetInstanceId: target.instanceId
    });

    // Find attacker battlefield card
    const attackerBattlefieldCard = playerBattlefieldData.find((c: any) => c.instanceId === attackerInstanceId);
    if (!attackerBattlefieldCard) {
      console.error('handleExecuteAttack: Attacker not found on battlefield');
      return;
    }

    // Load the attacker card to get attack value
    const attackerCard = await loadCardDoc(attackerBattlefieldCard.cardUrl, repo);
    if (!attackerCard) {
      console.error('handleExecuteAttack: Could not load attacker card');
      return;
    }

    // Load target card data first for synchronous changes
    if (target.type === 'player') {
      // For player attacks, make synchronous changes directly
      try {
        console.log('Making synchronous player attack...');
        const damage = attackerCard.attack || 0;
        
        changeGameDoc((doc) => {
          console.log('Inside synchronous changeGameDoc for player attack');
          
          // Mark attacker as sapped
          const attackerBattlefield = doc.playerBattlefields.find(b => b.playerId === selfId);
          const attackerBattlefieldCard = attackerBattlefield?.cards.find(c => c.instanceId === attackerInstanceId);
          
          if (attackerBattlefieldCard) {
            console.log('Sapping attacker...');
            attackerBattlefieldCard.sapped = true;
          }
          
          // Deal damage to target player
          const targetPlayerState = doc.playerStates.find(state => state.playerId === target.playerId);
          if (targetPlayerState && damage > 0) {
            console.log(`Dealing ${damage} damage to player with ${targetPlayerState.health} health`);
            targetPlayerState.health = Math.max(0, targetPlayerState.health - damage);
            console.log(`Player health after damage: ${targetPlayerState.health}`);
            
            // Check for game end
            if (targetPlayerState.health <= 0) {
              console.log('Player defeated, ending game');
              doc.status = 'finished';
            }
          }
          
          // Add game log entry
          addGameLogEntry(doc, {
            playerId: selfId,
            action: 'attack',
            targetId: target.playerId,
            amount: damage,
            description: `${attackerCard.name} attacked player for ${damage} damage`
          });
          
          console.log('Player attack changes applied synchronously');
        });
        
      } catch (error) {
        console.error('Error executing player attack:', error);
      }
    } else if ((target.type === 'creature' || target.type === 'artifact') && target.instanceId) {
      // For creature attacks, load all data first, then make synchronous changes
      try {
        console.log('Loading data for creature attack with triggered abilities...');
        
        // Find target battlefield card
        const targetBattlefield = gameDoc.playerBattlefields.find(bf => bf.playerId === target.playerId);
        const targetBattlefieldCard = targetBattlefield?.cards.find(c => c.instanceId === target.instanceId);
        
        if (!targetBattlefieldCard) {
          console.error('Target battlefield card not found');
          return;
        }
        
        // Load target card data
        const targetCard = await loadCardDoc(targetBattlefieldCard.cardUrl, repo);
        if (!targetCard) {
          console.error('Could not load target card');
          return;
        }
        
        console.log('Target card loaded:', targetCard.name, 'Type:', targetCard.type);
        console.log('Checking for triggered abilities...');
        
        // Check if target has "take_damage" triggered abilities
        const takeDamageAbilities = targetCard.triggeredAbilities?.filter(ability => ability.trigger === 'take_damage') || [];
        console.log('Found take_damage abilities:', takeDamageAbilities.length);
        
        // Now make all changes synchronously
        changeGameDoc((doc: GameDoc) => {
          console.log('Inside synchronous changeGameDoc for creature combat');
          
          // Mark attacker as sapped
          const attackerBattlefield = doc.playerBattlefields.find(b => b.playerId === selfId);
          const attackerBattlefieldCard = attackerBattlefield?.cards.find(c => c.instanceId === attackerInstanceId);

          if (!attackerBattlefieldCard) {
            console.error('Attacker battlefield card not found');
            return;
          }
          
          console.log('Sapping attacker...');
          attackerBattlefieldCard.sapped = true;
          
          // Deal damage to target
          const docTargetBattlefield = doc.playerBattlefields.find(b => b.playerId === target.playerId);
          const docTargetCard = docTargetBattlefield?.cards.find(c => c.instanceId === target.instanceId);
          
          if (docTargetCard && attackerCard.attack) {
            console.log(`Dealing ${attackerCard.attack} damage to target with ${docTargetCard.currentHealth} health`);
            docTargetCard.currentHealth -= attackerCard.attack;
            console.log(`Target health after damage: ${docTargetCard.currentHealth}`);
            
            // Execute take_damage triggered abilities synchronously
            for (const ability of takeDamageAbilities) {
              console.log('Executing take_damage ability:', ability.description);
              try {
                // Simple implementation for the draw card effect
                if (ability.effectCode.includes('api.drawCard()')) {
                  console.log('Triggering draw card effect');
                  // Draw a card for the target's owner
                  if (doc.deck.length === 0 && doc.graveyard.length > 0) {
                    // Reshuffle if needed
                    doc.deck = [...doc.graveyard];
                    doc.graveyard = [];
                    // Simple shuffle
                    for (let i = doc.deck.length - 1; i > 0; i--) {
                      const j = Math.floor(Math.random() * (i + 1));
                      [doc.deck[i], doc.deck[j]] = [doc.deck[j], doc.deck[i]];
                    }
                  }
                  
                  if (doc.deck.length > 0) {
                    const drawnCard = doc.deck.pop();
                    if (drawnCard) {
                      const targetPlayerHand = doc.playerHands.find(hand => hand.playerId === target.playerId);
                      if (targetPlayerHand) {
                        targetPlayerHand.cards.push(drawnCard);
                        addGameLogEntry(doc, {
                          playerId: target.playerId,
                          action: 'draw_card',
                          cardUrl: drawnCard,
                          description: `${targetCard.name}: Drew a card`
                        });
                      }
                    }
                  }
                }
              } catch (abilityError) {
                console.error('Error executing triggered ability:', abilityError);
              }
            }
            
            // If target is a creature and has attack power, deal damage back to attacker (mutual combat)
            if (targetCard.type === 'creature' && targetCard.attack && targetCard.attack > 0) {
              console.log(`Target creature ${targetCard.name} deals ${targetCard.attack} damage back to attacker`);
              
              // Find the attacker in the document
              const docAttackerBattlefield = doc.playerBattlefields.find(b => b.playerId === selfId);
              const docAttackerCard = docAttackerBattlefield?.cards.find(c => c.instanceId === attackerInstanceId);
              
              if (docAttackerCard) {
                console.log(`Attacker has ${docAttackerCard.currentHealth} health, taking ${targetCard.attack} damage`);
                docAttackerCard.currentHealth -= targetCard.attack;
                console.log(`Attacker health after counter-attack: ${docAttackerCard.currentHealth}`);
                
                // If attacker dies from counter-attack, remove it too
                if (docAttackerCard.currentHealth <= 0) {
                  console.log('Attacker destroyed by counter-attack, removing from battlefield');
                  const attackerCardIndex = docAttackerBattlefield!.cards.findIndex(c => c.instanceId === attackerInstanceId);
                  docAttackerBattlefield!.cards.splice(attackerCardIndex, 1);
                  doc.graveyard.push(attackerBattlefieldCard.cardUrl);
                }
              }
            }
            
            // If target dies, remove from battlefield and add to graveyard
            if (docTargetCard.currentHealth <= 0) {
              console.log('Target destroyed, removing from battlefield');
              const cardIndex = docTargetBattlefield!.cards.findIndex(c => c.instanceId === target.instanceId);
              docTargetBattlefield!.cards.splice(cardIndex, 1);
              doc.graveyard.push(targetBattlefieldCard.cardUrl);
            }
          }
          
          // Add game log entry
          const attackerDamage = attackerCard.attack || 0;
          const targetDamage = (targetCard.type === 'creature' && targetCard.attack) ? targetCard.attack : 0;
          
          let combatDescription;
          if (targetDamage > 0) {
            combatDescription = `${attackerCard.name} and ${targetCard.name} fight! ${attackerCard.name} deals ${attackerDamage}, ${targetCard.name} deals ${targetDamage} damage`;
          } else {
            combatDescription = `${attackerCard.name} attacked ${targetCard.name} for ${attackerDamage} damage`;
          }
          
          addGameLogEntry(doc, {
            playerId: selfId,
            action: 'attack',
            targetId: target.playerId,
            amount: attackerDamage,
            description: combatDescription
          });
          
          console.log('Creature combat changes applied synchronously');
        });
        
      } catch (error) {
        console.error('Error executing creature attack:', error);
      }
    }
  };

  // Handle ending turn
  const handleEndTurn = async () => {
    if (!isCurrentPlayer) {
      console.warn('handleEndTurn: Cannot end turn - not current player');
      return;
    }

    // Prevent ending turn while targeting
    if (targetingState.isTargeting) {
      console.warn('handleEndTurn: Cannot end turn while targeting');
      return;
    }

    try {
      // Pre-load card data for next player's battlefield to handle healing properly
      console.log('Ending turn with synchronous operations...');
      const nextPlayerIndex = (gameDoc.currentPlayerIndex + 1) % gameDoc.players.length;
      const nextPlayerId = gameDoc.players[nextPlayerIndex];
      
      // Load battlefield card data for proper healing
      const nextPlayerBattlefield = gameDoc.playerBattlefields.find(bf => bf.playerId === nextPlayerId);
      const battlefieldCardData: Array<{ instanceId: string; cardDoc: CardDoc | null; maxHealth: number }> = [];
      
      if (nextPlayerBattlefield) {
        for (const battlefieldCard of nextPlayerBattlefield.cards) {
          const cardDoc = await loadCardDoc(battlefieldCard.cardUrl, repo);
          battlefieldCardData.push({
            instanceId: battlefieldCard.instanceId,
            cardDoc,
            maxHealth: cardDoc?.health || 1
          });
        }
      }
      
      changeGameDoc((doc: GameDoc) => {
        // Add to game log FIRST, before any next player actions
        addGameLogEntry(doc, {
          playerId: selfId,
          action: 'end_turn',
          description: 'Ended turn'
        });

        const nextPlayerIndex = (doc.currentPlayerIndex + 1) % doc.players.length;
        doc.currentPlayerIndex = nextPlayerIndex;
        const nextPlayerId = doc.players[nextPlayerIndex];
        
        // Draw a card for the next player (start of their turn)
        if (doc.deck.length === 0) {
          // Try to reshuffle graveyard into deck
          if (doc.graveyard.length > 0) {
            doc.deck = [...doc.graveyard];
            doc.graveyard = [];
            
            // Simple shuffle (Fisher-Yates)
            for (let i = doc.deck.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [doc.deck[i], doc.deck[j]] = [doc.deck[j], doc.deck[i]];
            }
            
            addGameLogEntry(doc, {
              playerId: nextPlayerId,
              action: 'draw_card',
              description: 'Reshuffled graveyard into deck'
            });
          }
        }
        
        // Draw the top card
        if (doc.deck.length > 0) {
          const cardUrl = doc.deck.pop();
          if (cardUrl) {
            const playerHandIndex = doc.playerHands.findIndex(hand => hand.playerId === nextPlayerId);
            if (playerHandIndex !== -1) {
              doc.playerHands[playerHandIndex].cards.push(cardUrl);
              
              addGameLogEntry(doc, {
                playerId: nextPlayerId,
                action: 'draw_card',
                cardUrl,
                description: 'Drew a card'
              });
            }
          }
        }
        
        // Refresh creatures for the next player (unsap them)
        const battlefieldIndex = doc.playerBattlefields.findIndex(battlefield => battlefield.playerId === nextPlayerId);
        if (battlefieldIndex !== -1) {
          doc.playerBattlefields[battlefieldIndex].cards.forEach(card => {
            card.sapped = false;
          });
        }
        
        // Heal creatures for the next player (only creatures, not artifacts)
        if (battlefieldIndex !== -1) {
          for (const battlefieldCard of doc.playerBattlefields[battlefieldIndex].cards) {
            // Find the corresponding card data we pre-loaded
            const cardData = battlefieldCardData.find(cd => cd.instanceId === battlefieldCard.instanceId);
            
            if (cardData && cardData.cardDoc) {
              // Only heal creatures, not artifacts
              if (cardData.cardDoc.type === 'creature') {
                const maxHealth = cardData.maxHealth;
                if (battlefieldCard.currentHealth < maxHealth) {
                  battlefieldCard.currentHealth = Math.min(maxHealth, battlefieldCard.currentHealth + 1);
                }
              }
            }
          }
        }

        // If we've gone through all players, increment turn and increase max energy
        if (nextPlayerIndex === 0) {
          doc.turn += 1;
          
          // Increase max energy for all players and restore their energy
          doc.playerStates.forEach(playerState => {
            if (playerState.maxEnergy < 10) {
              playerState.maxEnergy += 1;
            }
            playerState.energy = playerState.maxEnergy;
          });
        } else {
          // Restore energy for the next player only
          const nextPlayerStateIndex = doc.playerStates.findIndex(state => state.playerId === nextPlayerId);
          if (nextPlayerStateIndex !== -1) {
            doc.playerStates[nextPlayerStateIndex].energy = doc.playerStates[nextPlayerStateIndex].maxEnergy;
          }
        }
        
        console.log('Turn ended synchronously');
      });
      
    } catch (error) {
      console.error('Error ending turn:', error);
    }
  };

  // Implementation of target selection for spells
  const selectTargets = async (selector: SpellTargetSelector): Promise<SpellTarget[]> => {
    try {
      const targets = await startTargeting(selector, { type: 'spell' });
      return targets;
    } catch (error) {
      console.error('Spell targeting failed:', error);
      return [];
    }
  };

  // Handle card playing (updated for async spells)
  const handlePlayCard = async (cardUrl: AutomergeUrl) => {
    if (!currentPlayerState) {
      console.error('handlePlayCard: Cannot play card - missing currentPlayerState');
      return;
    }

    // Prevent playing cards while targeting
    if (targetingState.isTargeting) {
      console.warn('handlePlayCard: Cannot play card while targeting');
      return;
    }

    // Load the card
    const card = await loadCardDoc(cardUrl, repo);
    if (!card) {
      console.error(`handlePlayCard: Card not found: ${cardUrl}`);
      return;
    }
    if (card.cost > currentPlayerState.energy) {
      console.warn(`handlePlayCard: Cannot afford card ${cardUrl} (cost: ${card.cost}, available energy: ${currentPlayerState.energy})`);
      return;
    }

    // Check if it's the player's turn
    if (!isCurrentPlayer) {
      console.warn('handlePlayCard: Cannot play card - not current player turn');
      return;
    }

    // If it's a spell with effects, handle targeting first then cast
    if (card.type === 'spell' && card.spellEffect) {
      // Handle spell casting asynchronously
      (async () => {
        try {
          // First execute the spell effect to collect operations
          const api = createSpellEffectAPI(gameDoc, selfId, selectTargets);
          const success = card.spellEffect ? await executeSpellEffect(card.spellEffect, api) : false;

          // Store operations for triggered abilities
          const operationsForTriggeredAbilities = success && api.operations.length > 0 ? [...api.operations] : [];

          // Now update the game state in one synchronous operation
          changeGameDoc((doc) => {
            // Check if we can afford the card and remove it from hand
            if (removeCardFromHand(doc, selfId, cardUrl) && spendEnergy(doc, selfId, card.cost)) {
              // Add to graveyard
              addCardToGraveyard(doc, cardUrl);

              // Add cast log entry FIRST
              addGameLogEntry(doc, {
                playerId: selfId,
                action: 'play_card',
                cardUrl,
                description: `Cast ${card.name}`
              });

              // Then execute the collected spell operations synchronously
              if (success && api.operations.length > 0) {
                executeSpellOperations(doc, api.operations);
              }
            } else {
              console.error('Failed to cast spell - insufficient resources');
            }
          });

          // Execute triggered abilities asynchronously after document changes
          if (operationsForTriggeredAbilities.length > 0) {
            await executeSpellTriggeredAbilities(gameDoc, operationsForTriggeredAbilities, repo);
          }
        } catch (error) {
          console.error('Error casting spell:', error);
          changeGameDoc((doc) => {
            addGameLogEntry(doc, {
              playerId: selfId,
              action: 'play_card',
              cardUrl,
              description: `Failed to cast ${card.name}`
            });
          });
        }
      })();
    } else {
      // Load card first, then make synchronous changes
      try {
        // Pre-load the card data
        const cardData = await loadCardDoc(cardUrl, repo);
        if (!cardData) {
          console.error('handlePlayCard: Could not load card data');
          return;
        }
        
        // Now make synchronous changes to the document
        changeGameDoc((doc) => {
          // Remove card from hand
          if (!removeCardFromHand(doc, selfId, cardUrl)) {
            console.error(`handlePlayCard: Failed to remove card ${cardUrl} from player ${selfId}'s hand`);
            return;
          }

          // Spend energy
          if (!spendEnergy(doc, selfId, cardData.cost)) {
            console.error(`handlePlayCard: Failed to spend energy for card ${cardUrl} (cost: ${cardData.cost}) for player ${selfId}`);
            // Try to add the card back to hand since we couldn't spend energy
            const playerHandIndex = doc.playerHands.findIndex(hand => hand.playerId === selfId);
            if (playerHandIndex !== -1) {
              doc.playerHands[playerHandIndex].cards.push(cardUrl);
            }
            return;
          }

          // Handle card based on type
          if (cardData.type === 'creature' || cardData.type === 'artifact') {
            // Add to battlefield
            const battlefieldIndex = doc.playerBattlefields.findIndex(battlefield => battlefield.playerId === selfId);
            if (battlefieldIndex !== -1) {
              // Generate unique instance ID for this card copy
              const instanceId = `instance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              
              const initialHealth = cardData.health || 1;
              console.log('Adding card to battlefield:', {
                cardName: cardData.name,
                cardType: cardData.type,
                cardHealth: cardData.health,
                initialHealth,
                cardData
              });
              
              doc.playerBattlefields[battlefieldIndex].cards.push({
                instanceId,
                cardUrl,
                sapped: true, // New creatures start sapped (summoning sickness)
                currentHealth: initialHealth
              });
            }
          } else {
            // Other card types go to graveyard
            addCardToGraveyard(doc, cardUrl);
          }

          // Add to game log
          addGameLogEntry(doc, {
            playerId: selfId,
            action: 'play_card',
            cardUrl,
            description: `Played ${cardData.name}`
          });
        });
      } catch (error) {
        console.error('Error playing card:', error);
      }
    }
  };

  // Get opponents (all players except self)
  const opponents = playerList.filter(player => player !== selfId);
  const currentOpponent = opponents[currentOpponentIndex];

  const nextOpponent = () => {
    setCurrentOpponentIndex((prev) => (prev + 1) % opponents.length);
  };

  const prevOpponent = () => {
    setCurrentOpponentIndex((prev) => (prev - 1 + opponents.length) % opponents.length);
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: 'linear-gradient(135deg, #0f0c29 0%, #24243e 50%, #2b1b17 100%)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Game Header */}
      <div style={{
        height: 60,
        background: 'rgba(0,0,0,0.8)',
        borderBottom: '2px solid rgba(0, 255, 255, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        color: '#fff'
      }}>
        <button
          onClick={navigateToHome}
          style={{
            background: 'rgba(255, 0, 100, 0.2)',
            border: '1px solid rgba(255, 0, 100, 0.5)',
            color: '#ff0064',
            padding: '8px 16px',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 0, 100, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 0, 100, 0.2)';
          }}
        >
          ✕ Exit Game
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Turn {gameDoc.turn || 1}</div>
          <div style={{
            fontSize: 12,
            color: isCurrentPlayer ? '#00ff00' : '#ffaa00',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            {isCurrentPlayer ? (
              <>🎯 Your Turn</>
            ) : (
              <>
                ⏳
                <Contact
                  contactUrl={gameDoc.players[gameDoc.currentPlayerIndex]}
                  style={{
                    background: 'rgba(255, 170, 0, 0.2)',
                    borderColor: 'rgba(255, 170, 0, 0.4)',
                    fontSize: 11,
                    padding: '2px 6px'
                  }}
                />
                's turn
              </>
            )}
          </div>
        </div>
      </div>

      {/* Opponent Area (Top Half) */}
      <div style={{
        flex: 1,
        background: 'linear-gradient(180deg, rgba(100, 0, 150, 0.3) 0%, rgba(50, 0, 100, 0.3) 100%)',
        borderBottom: '3px solid #6400ff',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Opponent Header with Carousel */}
        <div style={{
          height: 60,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: opponents.length > 1 ? 'space-between' : 'center',
          padding: '0 20px',
          color: '#fff'
        }}>
          {opponents.length > 1 && (
            <button
              onClick={prevOpponent}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff',
                padding: '8px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              ← Prev
            </button>
          )}

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            transform: opponents.length > 1 ? `translateX(${currentOpponentIndex * -100}px)` : 'none',
            transition: 'transform 0.3s ease'
          }}>
            {currentOpponent && (
              <div
                onClick={() => {
                  if (canTargetPlayer(currentOpponent)) {
                    handleTargetClick({
                      type: 'player',
                      playerId: currentOpponent
                    });
                  }
                }}
                style={{
                  cursor: canTargetPlayer(currentOpponent) ? 'pointer' : 'default',
                  border: canTargetPlayer(currentOpponent) ? '3px solid #00ff00' : 'none',
                  borderRadius: 8,
                  padding: canTargetPlayer(currentOpponent) ? 2 : 0,
                  boxShadow: isTargetSelected({ type: 'player', playerId: currentOpponent }) ? '0 0 15px #00ff00' : 'none'
                }}
              >
                <Contact
                  contactUrl={currentOpponent}
                  style={{
                    background: 'rgba(100, 0, 150, 0.6)',
                    borderColor: 'rgba(0, 255, 255, 0.5)',
                    opacity: canTargetPlayer(currentOpponent) ? 1 : (targetingState.isTargeting ? 0.5 : 1)
                  }}
                />
              </div>
            )}
            {/* Opponent Info */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4
            }}>
              {opponents.length > 1 && (
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  Opponent {currentOpponentIndex + 1} of {opponents.length}
                </div>
              )}

              {/* Opponent Health Display */}
              {(() => {
                const currentOpponent = opponents[currentOpponentIndex];
                const opponentState = gameDoc.playerStates?.find(state => state.playerId === currentOpponent);

                return currentOpponent && opponentState ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 12px',
                    background: 'rgba(100, 0, 150, 0.3)',
                    border: '1px solid rgba(255, 68, 68, 0.5)',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#fff'
                  }}>
                    <span style={{ color: '#ff4444' }}>❤️</span>
                    <span>{opponentState.health}/{opponentState.maxHealth}</span>
                    <span style={{ color: '#00ffff', marginLeft: 6 }}>⚡</span>
                    <span>{opponentState.energy}/{opponentState.maxEnergy}</span>
                  </div>
                ) : null;
              })()}
            </div>
          </div>

          {opponents.length > 1 && (
            <button
              onClick={nextOpponent}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff',
                padding: '8px 12px',
                borderRadius: 6,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Next →
            </button>
          )}
        </div>

        {/* Opponent's Hand (Face Down) */}
        <div style={{
          height: 120,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '10px 20px',
          overflow: 'visible'
        }}>
          {(() => {
            // Get current opponent's hand size
            const currentOpponent = opponents[currentOpponentIndex];
            const opponentHand = gameDoc.playerHands?.find(hand => hand.playerId === currentOpponent);
            const handSize = opponentHand?.cards.length || 0;

            return Array.from({ length: handSize }, (_, i) => (
              <Card
                key={`opp-hand-${currentOpponent}-${i}`}
                card={{} as CardData}
                size="small"
                faceDown={true}
              />
            ));
          })()}
        </div>

        {/* Opponent's Board */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: '20px',
          flexWrap: 'wrap'
        }}>
          {(() => {
            // Get current opponent's battlefield
            const currentOpponent = opponents[currentOpponentIndex];
            const opponentBattlefield = gameDoc.playerBattlefields?.find(battlefield => battlefield.playerId === currentOpponent);
            const opponentCards = opponentBattlefield ? opponentBattlefield.cards : [];

            return opponentCards.length > 0 ? opponentCards.map((battlefieldCard) => (
              <BattlefieldCard
                key={`opponent-${battlefieldCard.instanceId}`}
                cardUrl={battlefieldCard.cardUrl}
                instanceId={battlefieldCard.instanceId}
                sapped={battlefieldCard.sapped}
                currentHealth={battlefieldCard.currentHealth}
                onAttack={canTargetCreature(currentOpponent, battlefieldCard.instanceId) ?
                  async (instanceId) => {
                    // Load the card to determine its actual type
                    const cardDoc = await loadCardDoc(battlefieldCard.cardUrl, repo);
                    const cardType = cardDoc?.type || 'creature';
                    handleTargetClick({
                      type: cardType as 'creature' | 'artifact',
                      playerId: currentOpponent,
                      instanceId
                    });
                  } : undefined}
                canAttack={canTargetCreature(currentOpponent, battlefieldCard.instanceId)}
              />
            )) : (
              <div style={{
                color: 'rgba(255,255,255,0.5)',
                fontSize: 16,
                fontStyle: 'italic'
              }}>
                No cards in play
              </div>
            );
          })()}
        </div>
      </div>

      {/* Player Area (Bottom Half) */}
      <div style={{
        flex: 1,
        background: 'linear-gradient(0deg, rgba(0, 100, 150, 0.3) 0%, rgba(0, 50, 100, 0.3) 100%)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Player's Board */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: '20px',
          flexWrap: 'wrap'
        }}>
          {playerBattlefieldData.map((battlefieldCard) => {
            const canBeTargeted = targetingState.isTargeting && canTargetCreature(selfId, battlefieldCard.instanceId);
            const canBeAttacked = !targetingState.isTargeting && isCurrentPlayer && !battlefieldCard.sapped;

            const handleClick = canBeTargeted
              ? async () => {
                // Load the card to determine its actual type
                const cardDoc = await loadCardDoc(battlefieldCard.cardUrl, repo);
                const cardType = cardDoc?.type || 'creature';
                handleTargetClick({
                  type: cardType as 'creature' | 'artifact',
                  playerId: selfId,
                  instanceId: battlefieldCard.instanceId
                });
              }
              : (canBeAttacked ? () => handleStartAttackTargeting(battlefieldCard.instanceId) : undefined);

            return (
              <BattlefieldCard
                key={`battlefield-${battlefieldCard.instanceId}`}
                cardUrl={battlefieldCard.cardUrl}
                instanceId={battlefieldCard.instanceId}
                sapped={battlefieldCard.sapped}
                currentHealth={battlefieldCard.currentHealth}
                onAttack={handleClick}
                canAttack={canBeTargeted || canBeAttacked}
              />
            );
          })}
          {playerBattlefieldData.length === 0 && (
            <div style={{
              color: 'rgba(255,255,255,0.5)',
              fontSize: 16,
              fontStyle: 'italic'
            }}>
              No cards in play
            </div>
          )}
        </div>

        {/* Player Info and Hand */}
        <div style={{
          height: 220,
          background: 'rgba(0,0,0,0.5)',
          borderTop: '2px solid rgba(0, 255, 255, 0.3)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Player Info */}
          <div style={{
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            color: '#fff'
          }}>
            <div
              onClick={() => {
                if (canTargetPlayer(selfId)) {
                  handleTargetClick({
                    type: 'player',
                    playerId: selfId
                  });
                }
              }}
              style={{
                cursor: canTargetPlayer(selfId) ? 'pointer' : 'default',
                border: canTargetPlayer(selfId) ? '3px solid #00ff00' : 'none',
                borderRadius: 8,
                padding: canTargetPlayer(selfId) ? 2 : 0,
                boxShadow: isTargetSelected({ type: 'player', playerId: selfId }) ? '0 0 15px #00ff00' : 'none'
              }}
            >
              <Contact
                contactUrl={selfId}
                style={{
                  background: 'rgba(0, 100, 150, 0.6)',
                  borderColor: 'rgba(0, 255, 255, 0.5)',
                  opacity: canTargetPlayer(selfId) ? 1 : (targetingState.isTargeting ? 0.5 : 1)
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 20, fontSize: 14 }}>
              <div style={{ fontSize: 12, opacity: 0.7, color: '#ff4444' }}>
                ❤️ Health: {currentPlayerState?.health || 0}/{currentPlayerState?.maxHealth || 0}
              </div>
              <div style={{ fontSize: 12, opacity: 0.7, color: '#00ffff' }}>
                ⚡ Energy: {currentPlayerState?.energy || 0}/{currentPlayerState?.maxEnergy || 0}
              </div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>📚 Deck: {gameDoc.deck?.length || 0}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>🪦 Graveyard: {gameDoc.graveyard?.length || 0}</div>
            </div>
          </div>

          {/* Player's Hand */}
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '0 20px',
            overflowX: 'auto'
          }}>
            {playerHandCardUrls.map((cardUrl, index) => {
              return (
                <HandCard
                  key={`hand-${cardUrl}-${index}`}
                  cardUrl={cardUrl}
                  currentEnergy={currentPlayerState?.energy || 0}
                  isCurrentPlayer={isCurrentPlayer}
                  onPlay={handlePlayCard}
                  isTargeting={targetingState.isTargeting}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Game Log */}
      <GameLog
        gameLog={gameDoc.gameLog}
      />

      {/* Action Buttons */}
      <div style={{
        position: 'absolute',
        bottom: 20,
        right: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      }}>
        {isCurrentPlayer && (
          <button
            onClick={handleEndTurn}
            disabled={targetingState.isTargeting}
            style={{
              background: targetingState.isTargeting
                ? 'linear-gradient(135deg, #666666 0%, #444444 100%)'
                : 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
              color: targetingState.isTargeting ? '#999999' : '#fff',
              border: 'none',
              padding: '12px 20px',
              borderRadius: 8,
              cursor: targetingState.isTargeting ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 600,
              boxShadow: targetingState.isTargeting
                ? '0 4px 12px rgba(102, 102, 102, 0.2)'
                : '0 4px 12px rgba(82, 196, 26, 0.4)',
              transition: 'all 0.2s ease',
              opacity: targetingState.isTargeting ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (!targetingState.isTargeting) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(82, 196, 26, 0.5)';
              }
            }}
            onMouseLeave={(e) => {
              if (!targetingState.isTargeting) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(82, 196, 26, 0.4)';
              }
            }}
          >
            ⏭️ End Turn
          </button>
        )}
      </div>

      {/* Unified Targeting Panel */}
      {targetingState.isTargeting && targetingState.selector && (
        <div style={{
          position: 'fixed',
          left: 20,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 320,
          background: targetingState.context?.type === 'attack'
            ? 'linear-gradient(135deg, #220011 0%, #440022 100%)'
            : 'linear-gradient(135deg, #001122 0%, #002244 100%)',
          border: targetingState.context?.type === 'attack'
            ? '2px solid #ff4444'
            : '2px solid #00ffff',
          borderRadius: 12,
          padding: 24,
          textAlign: 'center',
          color: '#fff',
          zIndex: 1000,
          boxShadow: targetingState.context?.type === 'attack'
            ? '0 8px 32px rgba(255, 68, 68, 0.3)'
            : '0 8px 32px rgba(0, 255, 255, 0.3)'
        }}>
          <h3 style={{
            margin: '0 0 16px 0',
            color: targetingState.context?.type === 'attack' ? '#ff4444' : '#00ffff',
            fontSize: 18
          }}>
            {targetingState.context?.type === 'attack' ? '⚔️ Attack Enemy Target' : '🎯 Target Selection'}
          </h3>

          <p style={{
            margin: '0 0 16px 0',
            fontSize: 14,
            lineHeight: 1.4
          }}>
            {targetingState.context?.type === 'attack' && targetingState.context.attackerCard
              ? `Choose a target for ${targetingState.context.attackerCard.name}`
              : targetingState.selector.description
            }
          </p>

          {targetingState.context?.type === 'attack' && targetingState.context.attackerCard?.attackTargeting?.description && (
            <p style={{
              margin: '0 0 16px 0',
              fontSize: 12,
              color: '#ffaa00',
              fontStyle: 'italic'
            }}>
              {targetingState.context.attackerCard.attackTargeting.description}
            </p>
          )}

          {targetingState.context?.type === 'spell' && (
            <div style={{
              margin: '0 0 20px 0',
              fontSize: 12,
              color: '#00ff00'
            }}>
              Selected: {targetingState.selectedTargets.length} / {targetingState.selector.targetCount}
              {targetingState.selector.targetCount > 1 && targetingState.selectedTargets.length > 0 && (
                <div style={{ fontSize: 10, color: '#ffff00', marginTop: 4 }}>
                  Click Confirm to cast with {targetingState.selectedTargets.length} target(s)
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            {targetingState.context?.type === 'spell' && targetingState.selectedTargets.length > 0 && (
              <button
                onClick={() => confirmSelection()}
                style={{
                  background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600
                }}
              >
                ✅ Confirm ({targetingState.selectedTargets.length})
              </button>
            )}

            <button
              onClick={cancelTargeting}
              style={{
                background: 'linear-gradient(135deg, #ff4d4f 0%, #d32f2f 100%)',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600
              }}
            >
              ❌ {targetingState.context?.type === 'attack' ? 'Cancel Attack' : 'Cancel'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TCGGameBoard;
