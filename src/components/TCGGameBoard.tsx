import React, { useState, useMemo } from 'react';
import { AutomergeUrl } from '@automerge/react';
import { GameDoc, playCard, endPlayerTurn } from '../docs/game';
import { RootDocument } from '../docs/rootDoc';
import { useGameNavigation } from '../hooks/useGameNavigation';
import Card, { CardData } from './Card';
import Contact from './Contact';
import GameLog from './GameLog';

type TCGGameBoardProps = {
  gameDoc: GameDoc;
  gameDocUrl: string;
  rootDoc: RootDocument;
  playerList: AutomergeUrl[];
  changeGameDoc: ((callback: (doc: GameDoc) => void) => void) | null;
};


const TCGGameBoard: React.FC<TCGGameBoardProps> = ({ 
  gameDoc,
  gameDocUrl, 
  rootDoc, 
  playerList,
  changeGameDoc
}) => {
  const { navigateToHome } = useGameNavigation();
  const [currentOpponentIndex, setCurrentOpponentIndex] = useState(0);

  // Check if it's the current player's turn
  const isCurrentPlayer = gameDoc.currentPlayerIndex === playerList.indexOf(rootDoc.selfId);

  // Get current player state
  const currentPlayerState = useMemo(() => {
    return gameDoc.playerStates?.find(state => state.playerId === rootDoc.selfId);
  }, [gameDoc.playerStates, rootDoc.selfId]);

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
    const playerHandData = gameDoc.playerHands.find(hand => hand.playerId === rootDoc.selfId);
    return playerHandData ? convertCardsToData(playerHandData.cards, true) : [];
  }, [gameDoc.playerHands, gameDoc.cardLibrary, rootDoc.selfId, currentPlayerState, isCurrentPlayer]);

  // Get player's battlefield
  const playerBattlefield = useMemo(() => {
    if (!gameDoc.playerBattlefields) return [];
    const playerBattlefieldData = gameDoc.playerBattlefields.find(battlefield => battlefield.playerId === rootDoc.selfId);
    return playerBattlefieldData ? convertCardsToData(playerBattlefieldData.cards) : [];
  }, [gameDoc.playerBattlefields, gameDoc.cardLibrary, rootDoc.selfId]);

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
      endPlayerTurn(doc, rootDoc.selfId);
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

    changeGameDoc((doc) => {
      playCard(doc, rootDoc.selfId, cardId);
    });
  };

  // Get opponents (all players except self)
  const opponents = playerList.filter(player => player !== rootDoc.selfId);
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#00ffff' }}>
            ⚡ Cyber Arena
          </div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Session #{gameDocUrl?.slice(-8)}
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Turn {gameDoc.turn || 1}</div>
          <div style={{ 
            fontSize: 12, 
            color: isCurrentPlayer ? '#00ff00' : '#ffaa00',
            fontWeight: 600
          }}>
            {isCurrentPlayer ? '🎯 Your Turn' : '⏳ Waiting...'}
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, color: '#00ffff' }}>
            Energy: {currentPlayerState?.energy || 0}/{currentPlayerState?.maxEnergy || 0}
          </div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Deck: {gameDoc.deck?.length || 0}</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Graveyard: {gameDoc.graveyard?.length || 0}</div>
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
            const opponentCards = opponentBattlefield ? convertCardsToData(opponentBattlefield.cards) : [];
            
            return opponentCards.length > 0 ? opponentCards.map((card, index) => (
              <Card
                key={`opponent-${card.id}-${index}`}
                card={card}
                size="medium"
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
          {playerBattlefield.map((card, index) => (
            <Card
              key={`battlefield-${card.id}-${index}`}
              card={card}
              size="medium"
            />
          ))}
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
              contactUrl={rootDoc.selfId}
              style={{ background: 'rgba(0, 100, 150, 0.6)', borderColor: 'rgba(0, 255, 255, 0.5)' }}
            />
            <div style={{ display: 'flex', gap: 20, fontSize: 14 }}>
              <div>Health: 20</div>
              <div>Hand: {playerHand.length}</div>
              <div>Deck: {gameDoc.deck?.length || 0}</div>
              <div>Graveyard: 0</div>
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
            End Turn
          </button>
        )}
        <button style={{
          background: 'rgba(255,255,255,0.1)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.2)',
          padding: '8px 16px',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 12,
          transition: 'all 0.2s ease'
        }}>
          Settings
        </button>
      </div>
    </div>
  );
};

export default TCGGameBoard;
