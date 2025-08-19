import React, { useState, useMemo } from 'react';
import { AutomergeUrl } from '@automerge/react';
import { GameDoc, playCard, endPlayerTurn, attackPlayerWithCreature, removeCardFromHand, spendEnergy, addCardToGraveyard, addGameLogEntry } from '../docs/game';
import { useGameNavigation } from '../hooks/useGameNavigation';
import Card, { CardData } from './Card';
import Contact from './Contact';
import GameLog from './GameLog';
import { SpellTargetSelector, SpellTarget, createSpellEffectAPI, executeSpellEffect, executeSpellOperations } from '../utils/spellEffects';

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

  // Spell targeting state
  const [targetingState, setTargetingState] = useState<{
    isTargeting: boolean;
    selector: SpellTargetSelector | null;
    selectedTargets: SpellTarget[];
    resolve: ((targets: SpellTarget[]) => void) | null;
    cardBeingPlayed: string | null;
  }>({
    isTargeting: false,
    selector: null,
    selectedTargets: [],
    resolve: null,
    cardBeingPlayed: null
  });

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
      const isPlayable = isHand && currentPlayerState ? 
        card.cost <= currentPlayerState.energy && isCurrentPlayer && !targetingState.isTargeting : 
        false;
      return {
        ...card,
        isPlayable
      };
    }).filter(card => card); // Filter out undefined cards
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
        isPlayable: false // Battlefield cards aren't "playable" in the same sense
      };
    }).filter(card => card !== null) as (CardData & { instanceId: string; sapped: boolean })[];
  }, [gameDoc.playerBattlefields, gameDoc.cardLibrary, selfId]);



  // Handle attacking opponent directly with a creature
  const handleCreatureAttack = (instanceId: string) => {
    if (!changeGameDoc) {
      console.error('handleCreatureAttack: Cannot attack - missing changeGameDoc');
      return;
    }
    if (!isCurrentPlayer) {
      console.warn('handleCreatureAttack: Cannot attack - not current player');
      return;
    }

    // Find the card by instanceId
    const battlefieldCard = playerBattlefield.find(c => c.instanceId === instanceId);
    if (!battlefieldCard || !battlefieldCard.attack) {
      console.error(`handleCreatureAttack: Invalid creature instance: ${instanceId}`);
      return;
    }

    // Attack the first opponent for simplicity
    const targetPlayerId = opponents[currentOpponentIndex];
    if (!targetPlayerId) {
      console.error('handleCreatureAttack: No opponent to attack');
      return;
    }

    const attackValue = battlefieldCard.attack;
    changeGameDoc((doc) => {
      attackPlayerWithCreature(doc, selfId, instanceId, targetPlayerId, attackValue);
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
      console.warn('handleEndTurn: Cannot end turn while selecting targets for a spell');
      return;
    }

    changeGameDoc((doc) => {
      endPlayerTurn(doc, selfId);
    });
  };

  // Implementation of target selection for spells
  const selectTargets = async (selector: SpellTargetSelector): Promise<SpellTarget[]> => {
    // Handle auto-targeting cases
    if (selector.targetType === 'player' && selector.targetCount === 1) {
      const allPlayers = gameDoc.players;
      let validTargets: AutomergeUrl[] = [];
      
      if (selector.canTargetSelf === false && selector.canTargetAllies === false) {
        // Only target opponents
        validTargets = allPlayers.filter(p => p !== selfId);
      } else if (selector.canTargetSelf === true && selector.canTargetAllies === false) {
        // Only target self
        validTargets = [selfId];
      } else {
        // Can target anyone (self and allies)
        validTargets = allPlayers;
      }
      
      // Auto-target if only one valid option
      if (validTargets.length === 1) {
        return [{
          type: 'player',
          playerId: validTargets[0]
        }];
      }
    }
    
    // Need manual selection
    return new Promise((resolve) => {
      setTargetingState({
        isTargeting: true,
        selector,
        selectedTargets: [],
        resolve,
        cardBeingPlayed: null
      });
    });
  };

  // Handle target selection during spell casting
  const handleTargetSelection = (target: SpellTarget) => {
    if (!targetingState.isTargeting || !targetingState.selector) return;

    const { selector, selectedTargets } = targetingState;
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
    }

    setTargetingState(prev => ({
      ...prev,
      selectedTargets: newSelectedTargets
    }));

    // Auto-confirm only for single-target spells
    if (newSelectedTargets.length === selector.targetCount && selector.targetCount === 1) {
      confirmTargetSelection(newSelectedTargets);
    }
  };

  // Confirm target selection
  const confirmTargetSelection = (targets?: SpellTarget[]) => {
    const finalTargets = targets || targetingState.selectedTargets;
    
    if (targetingState.resolve) {
      targetingState.resolve(finalTargets);
    }
    
    setTargetingState({
      isTargeting: false,
      selector: null,
      selectedTargets: [],
      resolve: null,
      cardBeingPlayed: null
    });
  };

  // Cancel target selection
  const cancelTargetSelection = () => {
    if (targetingState.resolve) {
      targetingState.resolve([]);
    }
    
    setTargetingState({
      isTargeting: false,
      selector: null,
      selectedTargets: [],
      resolve: null,
      cardBeingPlayed: null
    });
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
      console.warn('handlePlayCard: Cannot play card while selecting targets for another spell');
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

  // Helper functions for targeting
  const canTargetPlayer = (playerId: AutomergeUrl): boolean => {
    if (!targetingState.isTargeting || !targetingState.selector) return false;
    
    const { selector } = targetingState;
    if (selector.targetType === 'creature') return false;
    
    if (playerId === selfId) {
      return selector.canTargetSelf !== false;
    } else {
      return selector.canTargetAllies !== false;
    }
  };

  const canTargetCreature = (playerId: AutomergeUrl, _instanceId: string): boolean => {
    if (!targetingState.isTargeting || !targetingState.selector) return false;
    
    const { selector } = targetingState;
    if (selector.targetType === 'player') return false;
    
    if (playerId === selfId) {
      return selector.canTargetSelf !== false;
    } else {
      return selector.canTargetAllies !== false;
    }
  };

  const isTargetSelected = (target: SpellTarget): boolean => {
    return targetingState.selectedTargets.some(t => 
      t.playerId === target.playerId && 
      t.instanceId === target.instanceId &&
      t.type === target.type
    );
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
            fontWeight: 600
          }}>
            {isCurrentPlayer ? '🎯 Your Turn' : '⏳ Waiting...'}
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
                    handleTargetSelection({
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
                  isPlayable: false
                };
              }).filter(card => card !== null) as (CardData & { instanceId: string; sapped: boolean })[] : [];
            
            return opponentCards.length > 0 ? opponentCards.map((card) => (
              <div
                key={`opponent-${card.instanceId}`}
                onClick={() => {
                  if (canTargetCreature(currentOpponent, card.instanceId)) {
                    handleTargetSelection({
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
            const canAttack = isCurrentPlayer && card.attack && card.attack > 0 && !card.sapped;
            const canTargetThisCreature = canTargetCreature(selfId, card.instanceId);
            const instanceId = card.instanceId;
            
            // Prioritize targeting over attacking when targeting is active
            const shouldHandleTargeting = targetingState.isTargeting && canTargetThisCreature;
            const handleClick = shouldHandleTargeting 
              ? () => handleTargetSelection({
                  type: 'creature',
                  playerId: selfId,
                  instanceId: card.instanceId
                })
              : (canAttack ? () => handleCreatureAttack(instanceId) : undefined);
            
            return (
              <div
                key={`battlefield-${card.instanceId}`}
                onClick={handleClick}
                style={{
                  cursor: shouldHandleTargeting || canAttack ? 'pointer' : 'default',
                  border: shouldHandleTargeting 
                    ? '3px solid #00ff00' 
                    : canAttack 
                      ? '2px solid #ff4444' 
                      : card.sapped 
                        ? '2px solid #666666' 
                        : '2px solid transparent',
                  borderRadius: 8,
                  boxShadow: shouldHandleTargeting 
                    ? (isTargetSelected({type: 'creature', playerId: selfId, instanceId: card.instanceId}) ? '0 0 15px #00ff00' : '0 0 8px rgba(0, 255, 0, 0.4)')
                    : canAttack 
                      ? '0 0 8px rgba(255, 68, 68, 0.4)' 
                      : 'none',
                  opacity: card.sapped ? 0.6 : (shouldHandleTargeting ? 1 : (targetingState.isTargeting ? 0.5 : 1)),
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  padding: shouldHandleTargeting ? 2 : 0
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
                  handleTargetSelection({
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

      {/* Targeting Panel */}
      {targetingState.isTargeting && targetingState.selector && (
        <div style={{
          position: 'fixed',
          left: 20,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 320,
          background: 'linear-gradient(135deg, #001122 0%, #002244 100%)',
          border: '2px solid #00ffff',
          borderRadius: 12,
          padding: 24,
          textAlign: 'center',
          color: '#fff',
          zIndex: 1000,
          boxShadow: '0 8px 32px rgba(0, 255, 255, 0.3)'
        }}>
          <h3 style={{ 
            margin: '0 0 16px 0', 
            color: '#00ffff',
            fontSize: 18
          }}>
            🎯 Target Selection
          </h3>
          
          <p style={{ 
            margin: '0 0 16px 0', 
            fontSize: 14,
            lineHeight: 1.4
          }}>
            {targetingState.selector.description}
          </p>
          
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
          
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            {targetingState.selectedTargets.length > 0 && (
              <button 
                onClick={() => confirmTargetSelection()}
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
              onClick={cancelTargetSelection}
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
              ❌ Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TCGGameBoard;
