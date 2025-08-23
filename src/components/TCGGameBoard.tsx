import React, { useState, useMemo, useCallback } from 'react';
import { AutomergeUrl, useDocument, useDocuments } from '@automerge/react';
import { GameDoc } from '../docs/game';
import { GameEngine } from '../utils/GameEngine';
import { CardDoc } from '../docs/card';
import { useGameNavigation } from '../hooks/useGameNavigation';
import { useCardTargeting } from '../hooks/useCardTargeting';
import Card, { CardData } from './Card';
import Contact from './Contact';
import GameLog from './GameLog';
import { SpellTargetSelector, SpellTarget } from '../utils/spellEffects';
import { Target, getTargetingSelectorForAttack } from '../utils/unifiedTargeting';

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
  onSelect?: (instanceId: string) => void;
  canBeSelected?: boolean;
}> = ({ cardUrl, instanceId, sapped, currentHealth, onSelect, canBeSelected }) => {
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
      onClick={canBeSelected && onSelect ? () => onSelect(instanceId) : undefined}
      style={{
        cursor: canBeSelected ? 'pointer' : 'default',
        border: canBeSelected ? '2px solid #ff4444' : 'none',
        borderRadius: 8,
        boxShadow: canBeSelected ? '0 0 15px rgba(255,68,68,0.5)' : 'none'
      }}
    >
      <Card card={cardData} />
    </div>
  );
};

type TCGGameBoardProps = {
  gameEngine: GameEngine;
  gameDoc: GameDoc;
  selfId: AutomergeUrl;
};

const TCGGameBoard: React.FC<TCGGameBoardProps> = ({
  gameEngine,
  gameDoc,
  selfId,
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

  // Load all battlefield card documents for attack logic
  const battlefieldCardUrls = useMemo(() => {
    return playerBattlefieldData.map(card => card.cardUrl);
  }, [playerBattlefieldData]);

  const [battlefieldCardDocsMap] = useDocuments<CardDoc>(battlefieldCardUrls, { suspense: false });

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
    const creatureCard = await gameEngine.loadCardDoc(battlefieldCard.cardUrl);
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
    const attackerCard = battlefieldCardDocsMap.get(attackerBattlefieldCard.cardUrl) || await gameEngine.loadCardDoc(attackerBattlefieldCard.cardUrl);
    if (!attackerCard) {
      console.error('handleExecuteAttack: Could not load attacker card');
      return;
    }

    // Load target card data first for synchronous changes
    if (target.type === 'player') {
      // Use GameEngine method for player attacks
      try {
        console.log('Executing player attack via GameEngine...');
        const damage = attackerCard.attack || 0;
        
        const success = await gameEngine.attackPlayerWithCreature(
          selfId,
          attackerInstanceId,
          target.playerId,
          damage
        );
        
        if (success) {
          console.log('Player attack completed successfully');
        } else {
          console.error('Player attack failed');
        }
        
      } catch (error) {
        console.error('Error executing player attack:', error);
      }
    } else if ((target.type === 'creature' || target.type === 'artifact') && target.instanceId) {
      // Use GameEngine method for creature vs creature combat
      try {
        console.log('Executing creature combat via GameEngine...');
        
        const success = await gameEngine.attackCreatureWithCreature(
          selfId,
          attackerInstanceId,
          target.playerId,
          target.instanceId,
          selectTargets
        );
        
        if (success) {
          console.log('Creature combat completed successfully');
        } else {
          console.error('Creature combat failed');
        }
        
      } catch (error) {
        console.error('Error executing creature combat:', error);
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
      console.log('Ending turn via GameEngine...');
      await gameEngine.endPlayerTurn(selfId);
      console.log('Turn ended successfully');
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
    const card = await gameEngine.loadCardDoc(cardUrl);
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
      // Use GameEngine method for spell casting
      try {
        console.log('Casting spell via GameEngine...');
        const success = await gameEngine.playCard(selfId, cardUrl, selectTargets);
        
        if (success) {
          console.log('Spell cast successfully');
        } else {
          console.error('Spell casting failed');
        }
      } catch (error) {
        console.error('Error casting spell:', error);
      }
    } else {
      // Use GameEngine method for non-spell cards
      try {
        console.log('Playing card via GameEngine...');
        const success = await gameEngine.playCard(selfId, cardUrl);
        
        if (success) {
          console.log('Card played successfully');
        } else {
          console.error('Card playing failed');
        }
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
                onSelect={canTargetCreature(currentOpponent, battlefieldCard.instanceId) ?
                  async (instanceId) => {
                    // Load the card to determine its actual type
                    const cardDoc = await gameEngine.loadCardDoc(battlefieldCard.cardUrl);
                    const cardType = cardDoc?.type || 'creature';
                    handleTargetClick({
                      type: cardType as 'creature' | 'artifact',
                      playerId: currentOpponent,
                      instanceId
                    });
                  } : undefined}
                canBeSelected={canTargetCreature(currentOpponent, battlefieldCard.instanceId)}
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
            // Get the card document from the loaded map
            const cardDoc = battlefieldCardDocsMap.get(battlefieldCard.cardUrl);
            const canAttack = !targetingState.isTargeting && 
                              isCurrentPlayer && 
                              !battlefieldCard.sapped && 
                              cardDoc?.type === 'creature'; // Only creatures can attack

            const handleClick = canBeTargeted
              ? async () => {
                // Use the already loaded card doc or load it if needed
                const loadedCardDoc = battlefieldCardDocsMap.get(battlefieldCard.cardUrl) || await gameEngine.loadCardDoc(battlefieldCard.cardUrl);
                const cardType = loadedCardDoc?.type || 'creature';
                handleTargetClick({
                  type: cardType as 'creature' | 'artifact',
                  playerId: selfId,
                  instanceId: battlefieldCard.instanceId
                });
              }
              : (canAttack ? () => handleStartAttackTargeting(battlefieldCard.instanceId) : undefined);

            return (
              <BattlefieldCard
                key={`battlefield-${battlefieldCard.instanceId}`}
                cardUrl={battlefieldCard.cardUrl}
                instanceId={battlefieldCard.instanceId}
                sapped={battlefieldCard.sapped}
                currentHealth={battlefieldCard.currentHealth}
                onSelect={handleClick}
                canBeSelected={canBeTargeted || canAttack}
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
