import React, { useState, useMemo } from 'react';
import { AutomergeUrl } from '@automerge/react';
import { GameDoc, playCard, playInfrastructureCard, endPlayerTurn, attackPlayerWithCreature, canPlaceInfrastructureOnPlanet } from '../docs/game';
import { useGameNavigation } from '../hooks/useGameNavigation';
import Card, { CardData } from './Card';
import Contact from './Contact';
import GameLog from './GameLog';

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
  const [infrastructureTargeting, setInfrastructureTargeting] = useState<{
    cardId: string;
    isTargeting: boolean;
  } | null>(null);
  const playerList = gameDoc.players;

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
        card.cost <= currentPlayerState.energy && isCurrentPlayer : 
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
  }, [gameDoc.playerHands, gameDoc.cardLibrary, selfId, currentPlayerState, isCurrentPlayer]);

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
        isPlayable: false, // Battlefield cards aren't "playable" in the same sense
        infrastructurePlacements: battlefieldCard.infrastructurePlacements
      };
    }).filter(card => card !== null) as (CardData & { instanceId: string; sapped: boolean; infrastructurePlacements?: any[] })[];
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

    changeGameDoc((doc) => {
      endPlayerTurn(doc, selfId);
    });
  };

  // Handle card playing
  const handlePlayCard = (cardId: string) => {
    if (!changeGameDoc) {
      console.error('handlePlayCard: Cannot play card - missing changeGameDoc');
      return;
    }
    if (!currentPlayerState) {
      console.error('handlePlayCard: Cannot play card - missing currentPlayerState');
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

    // Handle infrastructure cards differently - they need targeting
    if (card.type === 'infrastructure') {
      setInfrastructureTargeting({ cardId, isTargeting: true });
      return;
    }

    changeGameDoc((doc) => {
      playCard(doc, selfId, cardId);
    });
  };

  // Handle infrastructure targeting
  const handleInfrastructureTarget = (planetInstanceId: string) => {
    if (!infrastructureTargeting || !changeGameDoc) return;
    
    const card = gameDoc.cardLibrary[infrastructureTargeting.cardId];
    if (!card || card.type !== 'infrastructure' || !card.infrastructureType) return;
    
    // Check if the target is valid
    if (!canPlaceInfrastructureOnPlanet(gameDoc, planetInstanceId, card.infrastructureType)) {
      console.warn('Cannot place infrastructure on this planet - capacity exceeded');
      setInfrastructureTargeting(null);
      return;
    }
    
    changeGameDoc((doc) => {
      playInfrastructureCard(doc, selfId, infrastructureTargeting.cardId, planetInstanceId);
    });
    
    setInfrastructureTargeting(null);
  };

  // Cancel infrastructure targeting
  const handleCancelTargeting = () => {
    setInfrastructureTargeting(null);
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
          {infrastructureTargeting?.isTargeting ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ 
                fontSize: 12, 
                color: '#aa00ff',
                fontWeight: 600
              }}>
                🏗️ Select Planet Target
              </div>
              <button
                onClick={handleCancelTargeting}
                style={{
                  background: 'rgba(255, 100, 100, 0.2)',
                  border: '1px solid rgba(255, 100, 100, 0.5)',
                  color: '#ff6464',
                  padding: '4px 8px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 10,
                  fontWeight: 600
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div style={{ 
              fontSize: 12, 
              color: isCurrentPlayer ? '#00ff00' : '#ffaa00',
              fontWeight: 600
            }}>
              {isCurrentPlayer ? '🎯 Your Turn' : '⏳ Waiting...'}
            </div>
          )}
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
              <Contact 
                contactUrl={currentOpponent}
                style={{ background: 'rgba(100, 0, 150, 0.6)', borderColor: 'rgba(0, 255, 255, 0.5)' }}
              />
            )}
            {opponents.length > 1 && (
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                Opponent {currentOpponentIndex + 1} of {opponents.length}
              </div>
            )}
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
                  isPlayable: false,
                  infrastructurePlacements: battlefieldCard.infrastructurePlacements
                };
              }).filter(card => card !== null) as (CardData & { instanceId: string; sapped: boolean; infrastructurePlacements?: any[] })[] : [];
            
            return opponentCards.length > 0 ? opponentCards.map((card) => {
              const instanceId = card.instanceId;
              const isPlanet = card.type === 'planet';
              const isTargetablePlanet = infrastructureTargeting?.isTargeting && isPlanet;
              const canTarget = isTargetablePlanet && infrastructureTargeting && gameDoc.cardLibrary[infrastructureTargeting.cardId]?.infrastructureType ?
                canPlaceInfrastructureOnPlanet(gameDoc, instanceId, gameDoc.cardLibrary[infrastructureTargeting.cardId].infrastructureType!) : false;
              
              return (
                <div
                  key={`opponent-${card.instanceId}`}
                  onClick={(isTargetablePlanet && canTarget) ? () => handleInfrastructureTarget(instanceId) : undefined}
                  style={{
                    position: 'relative',
                    opacity: card.sapped ? 0.6 : 1,
                    cursor: (isTargetablePlanet && canTarget) ? 'pointer' : 'default',
                    border: (isTargetablePlanet && canTarget) ? '3px solid #aa00ff' :
                           isTargetablePlanet ? '2px solid #666666' : '2px solid transparent',
                    borderRadius: 8,
                    boxShadow: (isTargetablePlanet && canTarget) ? '0 0 12px rgba(170, 0, 255, 0.6)' : 'none',
                    transition: 'all 0.2s ease'
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
            }) : (
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
            const instanceId = card.instanceId;
            const isPlanet = card.type === 'planet';
            const isTargetablePlanet = infrastructureTargeting?.isTargeting && isPlanet;
            const canTarget = isTargetablePlanet && infrastructureTargeting && gameDoc.cardLibrary[infrastructureTargeting.cardId]?.infrastructureType ?
              canPlaceInfrastructureOnPlanet(gameDoc, instanceId, gameDoc.cardLibrary[infrastructureTargeting.cardId].infrastructureType!) : false;
            
            const handleClick = () => {
              if (isTargetablePlanet && canTarget) {
                handleInfrastructureTarget(instanceId);
              } else if (canAttack) {
                handleCreatureAttack(instanceId);
              }
            };
            
            return (
              <div
                key={`battlefield-${card.instanceId}`}
                onClick={(canAttack || (isTargetablePlanet && canTarget)) ? handleClick : undefined}
                style={{
                  cursor: (canAttack || (isTargetablePlanet && canTarget)) ? 'pointer' : 'default',
                  border: canAttack ? '2px solid #ff4444' : 
                         (isTargetablePlanet && canTarget) ? '3px solid #aa00ff' :
                         isTargetablePlanet ? '2px solid #666666' :
                         card.sapped ? '2px solid #666666' : '2px solid transparent',
                  borderRadius: 8,
                  boxShadow: canAttack ? '0 0 8px rgba(255, 68, 68, 0.4)' : 
                            (isTargetablePlanet && canTarget) ? '0 0 12px rgba(170, 0, 255, 0.6)' : 'none',
                  opacity: card.sapped ? 0.6 : 1,
                  transition: 'all 0.2s ease',
                  position: 'relative'
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
            <Contact 
              contactUrl={selfId}
              style={{ background: 'rgba(0, 100, 150, 0.6)', borderColor: 'rgba(0, 255, 255, 0.5)' }}
            />
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
            style={{
              background: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
              color: '#fff',
              border: 'none',
              padding: '12px 20px',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(82, 196, 26, 0.4)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(82, 196, 26, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(82, 196, 26, 0.4)';
            }}
          >
            ⏭️ End Turn
          </button>
        )}
      </div>
    </div>
  );
};

export default TCGGameBoard;
