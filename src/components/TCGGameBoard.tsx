import React, { useState, useMemo, useCallback } from 'react';
import { AutomergeUrl } from '@automerge/react';
import { GameDoc, playCard, endPlayerTurn, attackPlayerWithCreature, attackCreatureWithCreature, removeCardFromHand, spendEnergy, addCardToGraveyard, addGameLogEntry } from '../docs/game';
import { useGameNavigation } from '../hooks/useGameNavigation';
import { useCardTargeting } from '../hooks/useCardTargeting';
import Card, { CardData } from './Card';
import Contact from './Contact';
import GameLog from './GameLog';
import { SpellTargetSelector, SpellTarget, createSpellEffectAPI, executeSpellEffect, executeSpellOperations } from '../utils/spellEffects';
import { Target, getTargetingSelectorForAttack } from '../utils/unifiedTargeting';

type TCGGameBoardProps = {
  gameDoc: GameDoc;
  selfId: AutomergeUrl;
  changeGameDoc: ((callback: (doc: GameDoc) => void) => void) | null;
};


const TCGGameBoard: React.FC<TCGGameBoardProps> = ({
  gameDoc,
  selfId,
  changeGameDoc
}) => {
  const { navigateToHome } = useGameNavigation();
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

  // Convert card IDs to CardData using the game's card library
  const convertCardsToData = (cardIds: string[], isHand = false): CardData[] => {
    if (!gameDoc.cardLibrary) return [];
    return cardIds.map(cardId => {
      const card = gameDoc.cardLibrary![cardId];
      if (!card) {
        console.error(`Card not found in library: ${cardId}`);
        return null;
      }
      const isPlayable = isHand && currentPlayerState ? 
        card.cost <= currentPlayerState.energy && isCurrentPlayer && !targetingState.isTargeting : 
        false;
      return {
        ...card,
        isPlayable
      } as CardData;
    }).filter((card): card is CardData => card !== null); // Filter out null cards with type guard
  };

  // Get player's hand
  const playerHand = useMemo(() => {
    if (!gameDoc.playerHands) return [];
    const playerHandData = gameDoc.playerHands.find(hand => hand.playerId === selfId);
    return playerHandData ? convertCardsToData(playerHandData.cards, true) : [];
  }, [gameDoc.playerHands, gameDoc.cardLibrary, selfId, currentPlayerState, isCurrentPlayer, targetingState.isTargeting]);

  // Get player's battlefield
  const playerBattlefield = useMemo(() => {
    if (!gameDoc.playerBattlefields) return [];
    const playerBattlefieldData = gameDoc.playerBattlefields.find(battlefield => battlefield.playerId === selfId);
    if (!playerBattlefieldData) return [];
    
    return playerBattlefieldData.cards.map(battlefieldCard => {
      const card = gameDoc.cardLibrary[battlefieldCard.cardId];
      if (!card) return null;
      
      return {
        ...card,
        instanceId: battlefieldCard.instanceId, // Add instance ID for unique identification
        sapped: battlefieldCard.sapped,
        currentHealth: battlefieldCard.currentHealth, // Add current health
        isPlayable: false // Battlefield cards aren't "playable" in the same sense
      };
    }).filter(card => card !== null) as (CardData & { instanceId: string; sapped: boolean; currentHealth: number })[];
  }, [gameDoc.playerBattlefields, gameDoc.cardLibrary, selfId]);



  // Start attack targeting for a creature
  const handleStartAttackTargeting = async (instanceId: string) => {
    if (!changeGameDoc) {
      console.error('handleStartAttackTargeting: Cannot attack - missing changeGameDoc');
      return;
    }
    if (!isCurrentPlayer) {
      console.warn('handleStartAttackTargeting: Cannot attack - not current player');
      return;
    }

    // Find the card by instanceId
    const battlefieldCard = playerBattlefield.find(c => c.instanceId === instanceId);
    if (!battlefieldCard || !battlefieldCard.attack) {
      console.error(`handleStartAttackTargeting: Invalid creature instance: ${instanceId}`);
      return;
    }

    // Get the creature card for targeting restrictions
    const creatureCard = gameDoc.cardLibrary[battlefieldCard.id];
    if (!creatureCard) {
      console.error(`handleStartAttackTargeting: Creature card not found: ${battlefieldCard.id}`);
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
  const handleExecuteAttack = (attackerInstanceId: string, target: Target) => {
    if (!changeGameDoc) {
      console.error('handleExecuteAttack: Cannot attack - missing changeGameDoc');
      return;
    }

    // Find attacker battlefield card to get attack value
    const attackerBattlefieldCard = playerBattlefield.find(c => c.instanceId === attackerInstanceId);
    if (!attackerBattlefieldCard) {
      console.error('handleExecuteAttack: Attacker not found on battlefield');
      return;
    }

    changeGameDoc((doc) => {
      if (target.type === 'player') {
        attackPlayerWithCreature(doc, selfId, attackerInstanceId, target.playerId, attackerBattlefieldCard.attack || 0);
      } else if ((target.type === 'creature' || target.type === 'artifact') && target.instanceId) {
        attackCreatureWithCreature(doc, selfId, attackerInstanceId, target.playerId, target.instanceId);
      }
    });
  };



  // Handle ending turn
  const handleEndTurn = () => {
    if (!changeGameDoc) {
      console.error('handleEndTurn: Cannot end turn - missing changeGameDoc');
      return;
    }
    if (!isCurrentPlayer) {
      console.warn('handleEndTurn: Cannot end turn - not current player');
      return;
    }
    
    // Prevent ending turn while targeting
    if (targetingState.isTargeting) {
      console.warn('handleEndTurn: Cannot end turn while targeting');
      return;
    }

    changeGameDoc((doc) => {
      endPlayerTurn(doc, selfId);
    });
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
  const handlePlayCard = async (cardId: string) => {
    if (!changeGameDoc) {
      console.error('handlePlayCard: Cannot play card - missing changeGameDoc');
      return;
    }
    if (!currentPlayerState) {
      console.error('handlePlayCard: Cannot play card - missing currentPlayerState');
      return;
    }
    
    // Prevent playing cards while targeting
    if (targetingState.isTargeting) {
      console.warn('handlePlayCard: Cannot play card while targeting');
      return;
    }
    
    const card = gameDoc.cardLibrary[cardId];
    if (!card) {
      console.error(`handlePlayCard: Card not found in library: ${cardId}`);
      return;
    }
    if (card.cost > currentPlayerState.energy) {
      console.warn(`handlePlayCard: Cannot afford card ${cardId} (cost: ${card.cost}, available energy: ${currentPlayerState.energy})`);
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
          
          // Now update the game state in one synchronous operation
          changeGameDoc((doc) => {
            const currentCard = doc.cardLibrary[cardId];
            if (!currentCard) return;
            
            // Check if we can afford the card and remove it from hand
            if (removeCardFromHand(doc, selfId, cardId) && spendEnergy(doc, selfId, currentCard.cost)) {
              // Add to graveyard
              addCardToGraveyard(doc, cardId);
              
              // Add cast log entry FIRST
              addGameLogEntry(doc, {
                playerId: selfId,
                action: 'play_card',
                cardId,
                description: `Cast ${card.name}`
              });
              
              // Then execute the collected spell operations
              if (success && api.operations.length > 0) {
                executeSpellOperations(doc, api.operations);
              }
            } else {
              console.error('Failed to cast spell - insufficient resources');
            }
          });
        } catch (error) {
          console.error('Error casting spell:', error);
          changeGameDoc((doc) => {
            addGameLogEntry(doc, {
              playerId: selfId,
              action: 'play_card',
              cardId,
              description: `Failed to cast ${card.name}`
            });
          });
        }
      })();
    } else {
      // Use sync version for creatures and simple spells
      changeGameDoc((doc) => {
        playCard(doc, selfId, cardId);
      });
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
      width: '100vw',
      height: '100vh',
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
                  boxShadow: isTargetSelected({type: 'player', playerId: currentOpponent}) ? '0 0 15px #00ff00' : 'none'
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
            const opponentCards = opponentBattlefield ? 
              opponentBattlefield.cards.map(battlefieldCard => {
                const card = gameDoc.cardLibrary[battlefieldCard.cardId];
                if (!card) return null;
                return {
                  ...card,
                  instanceId: battlefieldCard.instanceId,
                  sapped: battlefieldCard.sapped,
                  currentHealth: battlefieldCard.currentHealth,
                  isPlayable: false
                };
              }).filter(card => card !== null) as (CardData & { instanceId: string; sapped: boolean; currentHealth: number })[] : [];
            
            return opponentCards.length > 0 ? opponentCards.map((card) => (
              <div
                key={`opponent-${card.instanceId}`}
                onClick={() => {
                  if (canTargetCreature(currentOpponent, card.instanceId)) {
                    handleTargetClick({
                      type: 'creature',
                      playerId: currentOpponent,
                      instanceId: card.instanceId
                    });
                  }
                }}
                style={{
                  position: 'relative',
                  opacity: card.sapped ? 0.6 : 1,
                  cursor: canTargetCreature(currentOpponent, card.instanceId) ? 'pointer' : 'default',
                  border: canTargetCreature(currentOpponent, card.instanceId) ? '3px solid #00ff00' : 'none',
                  borderRadius: 8,
                  padding: canTargetCreature(currentOpponent, card.instanceId) ? 2 : 0,
                  boxShadow: isTargetSelected({type: 'creature', playerId: currentOpponent, instanceId: card.instanceId}) ? '0 0 15px #00ff00' : 'none'
                }}
              >
                <Card
                  card={card}
                  size="medium"
                  style={{
                    opacity: canTargetCreature(currentOpponent, card.instanceId) ? 1 : (targetingState.isTargeting ? 0.5 : 1)
                  }}
                />
                {card.sapped && (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: 'rgba(0, 0, 0, 0.8)',
                    color: '#ffaa00',
                    padding: '4px 8px',
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 600,
                    pointerEvents: 'none'
                  }}>
                    💤 SAPPED
                  </div>
                )}
              </div>
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
          {playerBattlefield.map((card) => {
            const canAttack = isCurrentPlayer && card.type === 'creature' && card.attack && card.attack > 0 && !card.sapped;

            const instanceId = card.instanceId;
            

            
            const canBeTargeted = targetingState.isTargeting && canTargetCreature(selfId, card.instanceId);
            const canBeAttacked = !targetingState.isTargeting && canAttack;
            const isClickable = canBeTargeted || canBeAttacked;
            
            const handleClick = canBeTargeted
              ? () => handleTargetClick({
                  type: card.type as 'creature' | 'artifact',
                  playerId: selfId,
                  instanceId: card.instanceId
                })
              : (canBeAttacked ? () => handleStartAttackTargeting(instanceId) : undefined);
            
            return (
              <div
                key={`battlefield-${card.instanceId}`}
                onClick={handleClick}
                style={{
                  cursor: isClickable ? 'pointer' : 'default',
                  border: canBeTargeted
                    ? '3px solid #00ff00' 
                    : canBeAttacked 
                      ? '2px solid #ff4444' 
                      : card.sapped 
                        ? '2px solid #666666' 
                        : '2px solid transparent',
                  borderRadius: 8,
                  boxShadow: canBeTargeted
                    ? (isTargetSelected({type: card.type as 'creature' | 'artifact', playerId: selfId, instanceId: card.instanceId}) ? '0 0 15px #00ff00' : '0 0 8px rgba(0, 255, 0, 0.4)')
                    : canBeAttacked 
                      ? '0 0 8px rgba(255, 68, 68, 0.4)' 
                      : 'none',
                  opacity: card.sapped ? 0.6 : (canBeTargeted ? 1 : (targetingState.isTargeting ? 0.5 : 1)),
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  padding: canBeTargeted ? 2 : 0
                }}
              >
                <Card
                  card={card}
                  size="medium"
                />
                {card.sapped && (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: 'rgba(0, 0, 0, 0.8)',
                    color: '#ffaa00',
                    padding: '4px 8px',
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 600,
                    pointerEvents: 'none'
                  }}>
                    💤 SAPPED
                  </div>
                )}
              </div>
            );
          })}
          {playerBattlefield.length === 0 && (
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
                boxShadow: isTargetSelected({type: 'player', playerId: selfId}) ? '0 0 15px #00ff00' : 'none'
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
                      {playerHand.map((card, index) => (
            <Card
              key={`hand-${card.id}-${index}`}
              card={card}
              size="medium"
              onClick={card.isPlayable ? () => handlePlayCard(card.id) : undefined}
            />
          ))}
          </div>
        </div>
      </div>

      {/* Game Log */}
      <GameLog 
        gameLog={gameDoc.gameLog}
        cardLibrary={gameDoc.cardLibrary}
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
