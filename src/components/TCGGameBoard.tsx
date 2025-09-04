import React, { useState, useMemo, useCallback } from 'react';
import { AutomergeUrl, useDocuments, DocHandle } from '@automerge/react';
import { GameDoc } from '../docs/game';
import { GameEngine } from '../utils/GameEngine';
import { CardDoc } from '../docs/card';
import { useGameNavigation } from '../hooks/useGameNavigation';
import { useCardTargeting } from '../hooks/useCardTargeting';
import { useGameBoardClicks } from '../hooks/useGameBoardClicks';
import Contact from './Contact';
import GameLog from './GameLog';
import { SpellTargetSelector, SpellTarget } from '../utils/spellEffects';
import { Target, getTargetingSelectorForAttack } from '../utils/unifiedTargeting';
import { FloatingCard, LazyFloatingCard } from './cards/FloatingCard';


type TCGGameBoardProps = {
  gameEngine: GameEngine;
  gameDoc: GameDoc;
  selfId: AutomergeUrl;
  gameDocHandle: DocHandle<GameDoc>;
};

const TCGGameBoard: React.FC<TCGGameBoardProps> = ({
  gameEngine,
  gameDoc,
  selfId,
  gameDocHandle,
}) => {
  const { navigateToHome } = useGameNavigation();

  const [currentOpponentIndex, setCurrentOpponentIndex] = useState(0);
  const playerList = gameDoc.players;

  // Check if it's the current player's turn
  const isCurrentPlayer = gameDoc.currentPlayerIndex === playerList.indexOf(selfId);

  // Game board clicks and emoji animations
  const [handleIdleBoardClick, emojiAnimations] = useGameBoardClicks(gameDocHandle, selfId);

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

  // Get current player state
  const currentPlayerState = useMemo(() => {
    return gameDoc.playerStates?.find(state => state.playerId === selfId);
  }, [gameDoc.playerStates, selfId]);

  // Get player's hand card instance IDs
  const playerHandInstanceIds = useMemo(() => {
    if (!gameDoc.playerHands) return [];
    const playerHandData = gameDoc.playerHands.find(hand => hand.playerId === selfId);
    return playerHandData ? playerHandData.cards : [];
  }, [gameDoc.playerHands, selfId]);

  const playerHandUrls = useMemo(() => {
    return playerHandInstanceIds.map(instanceId => gameDoc.instanceToCardUrl[instanceId]);
  }, [playerHandInstanceIds, gameDoc.instanceToCardUrl]);
  const [ownHandCardDocsMap] = useDocuments<CardDoc>(playerHandUrls, { suspense: false });

  const getOwnBattlefieldData = useCallback(() => {
    if (!gameDoc.playerBattlefields) return [];
    const playerBattlefieldData = gameDoc.playerBattlefields.find(battlefield => battlefield.playerId === selfId);
    return playerBattlefieldData ? playerBattlefieldData.cards : [];
  }, [gameDoc, selfId]);

  // Get player's battlefield data
  const ownBattlefieldData = useMemo(() => {
    return getOwnBattlefieldData();
  }, [getOwnBattlefieldData]);

  // Load all battlefield card documents for attack logic
  const ownBattlefieldCardUrls = useMemo(() => {
    return ownBattlefieldData.map(card => gameDoc.instanceToCardUrl[card.instanceId]);
  }, [ownBattlefieldData, gameDoc.instanceToCardUrl]);

  const [ownBattlefieldCardDocsMap] = useDocuments<CardDoc>(ownBattlefieldCardUrls, { suspense: false });

  const getOpponentBattlefieldData = useCallback(() => {
    if (!gameDoc.playerBattlefields) return [];
    const playerBattlefieldData = gameDoc.playerBattlefields.find(battlefield => battlefield.playerId !== selfId);
    return playerBattlefieldData ? playerBattlefieldData.cards : [];
  }, [gameDoc, selfId]);
  const opponentBattlefieldData = useMemo(() => {
    return getOpponentBattlefieldData();
  }, [getOpponentBattlefieldData]);
  const opponentBattlefieldCardUrls = useMemo(() => {
    return opponentBattlefieldData.map(card => gameDoc.instanceToCardUrl[card.instanceId]);
  }, [opponentBattlefieldData, gameDoc.instanceToCardUrl]);
  const [opponentBattlefieldCardDocsMap] = useDocuments<CardDoc>(opponentBattlefieldCardUrls, { suspense: false });

  // Spell target selection function (defined early to avoid circular dependencies)
  const selectTargets = useCallback(async (selector: SpellTargetSelector): Promise<SpellTarget[]> => {
    try {
      const targets = await startTargeting(selector, { type: 'spell' });
      return targets;
    } catch (error) {
      console.error('Spell targeting failed:', error);
      return [];
    }
  }, [startTargeting]);

  // Execute attack with selected target (defined before handleStartAttackTargeting to avoid circular dependency)
  const handleExecuteAttack = useCallback(async (attackerInstanceId: string, target: Target) => {
    console.log('handleExecuteAttack called with:', {
      attackerInstanceId,
      target,
      targetType: target.type,
      targetPlayerId: target.playerId,
      targetInstanceId: target.instanceId
    });

    // Find attacker battlefield card
    const battlefieldData = getOwnBattlefieldData();
    const attackerBattlefieldCard = battlefieldData.find((c: any) => c.instanceId === attackerInstanceId);
    if (!attackerBattlefieldCard) {
      console.error('handleExecuteAttack: Attacker not found on battlefield');
      return;
    }

    // Load the attacker card to get attack value
    const attackerCard = await gameEngine.loadCardDoc(gameDoc.instanceToCardUrl[attackerBattlefieldCard.instanceId]);
    if (!attackerCard) {
      console.error('handleExecuteAttack: Could not load attacker card');
      return;
    }

    // Load target card data first for synchronous changes
    if (target.type === 'player') {
      // Use GameEngine method for player attacks
      try {
        console.log('Executing player attack...');
        const damage = attackerCard.attack || 0;

        const success = await gameEngine.attackPlayerWithCreature(
          selfId,
          attackerInstanceId,
          target.playerId,
          damage,
          gameDoc
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
        console.log('Executing creature combat...');

        const success = await gameEngine.attackCreatureWithCreature(
          selfId,
          attackerInstanceId,
          target.playerId,
          target.instanceId,
          gameDoc,
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
  }, [getOwnBattlefieldData, gameEngine, selfId, selectTargets]);

  // Start attack targeting for a creature
  const handleStartAttackTargeting = useCallback(async (instanceId: string) => {
    if (!isCurrentPlayer) {
      console.warn('handleStartAttackTargeting: Cannot attack - not current player');
      return;
    }

    // Find the battlefield card by instanceId
    const battlefieldData = getOwnBattlefieldData();
    const battlefieldCard = battlefieldData.find(c => c.instanceId === instanceId);
    if (!battlefieldCard) {
      console.error(`handleStartAttackTargeting: Invalid creature instance: ${instanceId}`);
      return;
    }

    // Load the creature card for targeting restrictions
    const creatureCard = await gameEngine.loadCardDoc(gameDoc.instanceToCardUrl[battlefieldCard.instanceId]);
    if (!creatureCard || !creatureCard.attack) {
      console.error(`handleStartAttackTargeting: Creature card not found or has no attack: ${gameDoc.instanceToCardUrl[battlefieldCard.instanceId]}`);
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
  }, [isCurrentPlayer, getOwnBattlefieldData, gameEngine, selfId, startTargeting, handleExecuteAttack]);

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
      console.log('Ending turn...');
      await gameEngine.endPlayerTurn(selfId);
      console.log('Turn ended successfully');
    } catch (error) {
      console.error('Error ending turn:', error);
    }
  };

  // Implementation of target selection for spells

  // Handle card playing (updated for async spells)
  const handlePlayCard = useCallback(async (instanceId: string) => {
    console.log('🔧 handlePlayCard called with instanceId:', instanceId);

    // Get fresh current player state to avoid stale closure
    const freshCurrentPlayerState = gameDoc.playerStates?.find(state => state.playerId === selfId);
    if (!freshCurrentPlayerState) {
      console.error('handlePlayCard: Cannot play card - missing currentPlayerState');
      return;
    }

    // Prevent playing cards while targeting
    if (targetingState.isTargeting) {
      console.warn('handlePlayCard: Cannot play card while targeting');
      return;
    }

    // Get the card URL from the instance ID
    const cardUrl = gameDoc.instanceToCardUrl[instanceId];
    if (!cardUrl) {
      console.error(`handlePlayCard: Card URL not found for instance: ${instanceId}`);
      return;
    }

    // Load the card
    const card = await gameEngine.loadCardDoc(cardUrl);
    if (!card) {
      console.error(`handlePlayCard: Card not found: ${cardUrl}`);
      return;
    }
    if (card.cost > freshCurrentPlayerState.energy) {
      console.warn(`handlePlayCard: Cannot afford card ${instanceId} (cost: ${card.cost}, available energy: ${freshCurrentPlayerState.energy})`);
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
        console.log('Casting spell...');
        const success = await gameEngine.playCard(selfId, instanceId, selectTargets);

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
        console.log(`Playing card... ${instanceId}`);
        const success = await gameEngine.playCard(selfId, instanceId);

        if (success) {
          console.log('Card played successfully');
        } else {
          console.error('Card playing failed');
        }
      } catch (error) {
        console.error('Error playing card:', error);
      }
    }
  }, [targetingState.isTargeting, gameEngine, isCurrentPlayer, selfId, selectTargets]);

  const getOpponents = useCallback(() => {
    return playerList.filter(player => player !== selfId);
  }, [selfId, playerList]);

  // Get opponents (all players except self) - defined early to avoid circular dependencies
  const opponents = getOpponents();
  const currentOpponent = opponents[currentOpponentIndex];

  const nextOpponent = () => {
    setCurrentOpponentIndex((prev) => (prev + 1) % opponents.length);
  };

  const prevOpponent = () => {
    setCurrentOpponentIndex((prev) => (prev - 1 + opponents.length) % opponents.length);
  };

  return (
    <>
       <div
         onClick={(event) => {
           if (!isCurrentPlayer) {
             handleIdleBoardClick(event);
           }
         }}
         style={{
           width: '100%',
           height: '100%',
           background: 'linear-gradient(135deg, #0f0c29 0%, #24243e 50%, #2b1b17 100%)',
           display: 'flex',
           flexDirection: 'column',
           overflow: 'hidden',
           position: 'relative',
           cursor: !isCurrentPlayer ? 'pointer' : 'default'
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
               if (!opponentHand) {
                 return null;
               }
               return opponentHand.cards.map((instanceId) => {
                 const cardUrl = gameDoc.instanceToCardUrl[instanceId];
                 return (
                   <LazyFloatingCard
                     key={instanceId}
                     instanceId={instanceId}
                     debugKey={`face-down-${instanceId}`}
                     size="small"
                     faceDown={true}
                     url={cardUrl}
                   />
                 );
               });
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
               return opponentCards.length > 0 ? opponentCards.map((battlefieldCard) => {
                 const instanceId = battlefieldCard.instanceId;
                 const cardDoc = opponentBattlefieldCardDocsMap.get(gameDoc.instanceToCardUrl[instanceId]);
                 if (!cardDoc) return null;
                 const canBeTargeted = targetingState.isTargeting && canTargetCreature(currentOpponent, instanceId);
                 let onClick;
                 if (canBeTargeted) {
                   onClick = () => handleTargetClick({
                     type: cardDoc.type as 'creature' | 'artifact',
                     playerId: currentOpponent,
                     instanceId,
                   });
                 }
                 return (
                   <FloatingCard
                     key={`opponent-${instanceId}`}
                     instanceId={instanceId}
                     debugKey={`opponent-${instanceId}`}
                     size="medium"
                     onClick={onClick}
                     card={cardDoc}
                     cardState={battlefieldCard}
                   />
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
             {ownBattlefieldData.map((battlefieldCard) => {
               const instanceId = battlefieldCard.instanceId;
               const canBeTargeted = targetingState.isTargeting && canTargetCreature(selfId, battlefieldCard.instanceId);
               // Get the card document from the loaded map
               const cardDoc = ownBattlefieldCardDocsMap.get(gameDoc.instanceToCardUrl[battlefieldCard.instanceId]);
               if (!cardDoc) return null;
               const canAttack = !targetingState.isTargeting &&
                 isCurrentPlayer &&
                 !battlefieldCard.sapped &&
                 cardDoc?.type === 'creature'; // Only creatures can attack
              let onClick;
               if (canBeTargeted) {
                 onClick = () => handleTargetClick({
                   type: 'creature',
                   playerId: selfId,
                   instanceId
                 });
               } else if (canAttack) {
                 onClick = () => handleStartAttackTargeting(instanceId);
               }
              return (
                 <FloatingCard
                   key={`battlefield-${battlefieldCard.instanceId}`}
                   instanceId={instanceId}
                   debugKey={`battlefield-${instanceId}`}
                   size="medium"
                   onClick={onClick}
                   card={cardDoc}
                   cardState={battlefieldCard}
                 />
               );
             })}
             {ownBattlefieldData.length === 0 && (
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
               {playerHandInstanceIds.map((instanceId) => {
                 const cardUrl = gameDoc.instanceToCardUrl[instanceId];
                 if (!cardUrl) return null;
                 const currentEnergy = currentPlayerState?.energy || 0;
                 const cardDoc = ownHandCardDocsMap.get(cardUrl);
                 if (!cardDoc) return null;
                 const isTargeting = targetingState.isTargeting;
                 let onClick;
                 if (cardDoc && isCurrentPlayer && !isTargeting && cardDoc.cost <= currentEnergy) {
                   onClick = () => handlePlayCard(instanceId);
                 }
                 return (
                   <FloatingCard
                     key={`hand-${instanceId}`}
                     instanceId={instanceId}
                     debugKey={`hand-${instanceId}`}
                     size="medium"
                     card={cardDoc}
                     onClick={onClick}
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
        {/* Emoji Animation Overlay */}
         {emojiAnimations.map((animation) => (
           <div
             key={animation.id}
             style={{
               position: 'absolute',
               left: `${animation.x}%`,
               top: `${animation.y}%`,
               transform: 'translate(-50%, -50%)',
               fontSize: '2rem',
               pointerEvents: 'none',
               zIndex: 9999,
               animation: 'emojiPop 2s ease-out forwards'
             }}
           >
             {animation.emoji}
           </div>
         ))}
        {/* CSS Animation for emoji pop */}
         <style>{`
         @keyframes emojiPop {
           0% {
             opacity: 1;
             transform: translate(-50%, -50%) scale(0.5);
           }
           20% {
             opacity: 1;
             transform: translate(-50%, -50%) scale(1.2);
           }
           40% {
             opacity: 1;
             transform: translate(-50%, -50%) scale(1);
           }
           100% {
             opacity: 0;
             transform: translate(-50%, -50%) scale(0.8) translateY(-20px);
           }
         }
       `}</style>
       </div>

    </>
  );
};

export default TCGGameBoard;
