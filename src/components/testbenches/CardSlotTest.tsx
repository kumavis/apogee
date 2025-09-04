import React, { useState, useCallback, useEffect, useRef } from 'react';
import { CardDoc } from '../../docs/card';
import { AutomergeUrl } from '@automerge/react';
import { FloatingCard } from '../cards/FloatingCard';
import { FollowerProvider } from '../../utils/FollowerSystem';

const sampleCard: CardDoc = {
  createdAt: '0',
  createdBy: 'fake' as AutomergeUrl,
  name: 'Test Card',
  cost: 3,
  type: 'creature',
  attack: 2,
  health: 3,
  description: 'A test card for slot animation'
};

type Quadrant = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

const useAlternateTarget = () => {
  const [alternateTarget, setCurrentAlternateTarget] = useState<{ x: number, y: number } | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const setAlternateTarget = useCallback((event: React.MouseEvent) => {
    const x = event.clientX;
    const y = event.clientY;
    setCurrentAlternateTarget({ x, y });
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    timeoutRef.current = setTimeout(() => {
      setCurrentAlternateTarget(null);
      timeoutRef.current = null;
    }, 2000);
  }, []);

  return { alternateTarget, setAlternateTarget };
};

const CardSlotTestInner: React.FC = () => {
  const [cards, setCards] = useState<Map<string, { quadrant: Quadrant; cardData: CardDoc; faceDown: boolean; size: 'small' | 'medium' | 'large' }>>(() => {
    // Start with one card
    const initialCards = new Map();
    initialCards.set('card-1', { 
      quadrant: 'topLeft', 
      cardData: { ...sampleCard, name: 'Test Card 1' },
      faceDown: false,
      size: 'medium'
    });
    return initialCards;
  });
  const [nextCardId, setNextCardId] = useState(2); // Start from 2 since we already have card-1
  const [autoAnimation, setAutoAnimation] = useState(false);
  const { alternateTarget, setAlternateTarget } = useAlternateTarget();
  const animationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto animation effect
  useEffect(() => {
    if (autoAnimation && cards.size > 0) {
      const startAnimation = () => {
        const moveRandomCard = () => {
          if (cards.size === 0) return;

          const cardEntries = Array.from(cards.entries());
          const randomCardEntry = cardEntries[Math.floor(Math.random() * cardEntries.length)];
          const [cardId, card] = randomCardEntry;

          const quadrants: Quadrant[] = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];
          const availableQuadrants = quadrants.filter(q => q !== card.quadrant);
          const newQuadrant = availableQuadrants[Math.floor(Math.random() * availableQuadrants.length)];

          moveCard(cardId, newQuadrant);
        };

        const flipRandomCard = () => {
          const cardEntries = Array.from(cards.entries());
          const randomCardEntry = cardEntries[Math.floor(Math.random() * cardEntries.length)];
          const [cardId, card] = randomCardEntry;
          setCards(prev => {
            const newCards = new Map(prev);
            newCards.set(cardId, { ...card, faceDown: !card.faceDown });
            return newCards;
          });
        };

        // Move a random card every 1-3 seconds
        const scheduleNextMove = () => {
          const delay = Math.random() * 2000 + 1000; // 1-3 seconds
          animationIntervalRef.current = setTimeout(() => {
            moveRandomCard();
            flipRandomCard();
            if (autoAnimation) {
              scheduleNextMove();
            }
          }, delay);
        };

        scheduleNextMove();
      };

      startAnimation();
    } else {
      if (animationIntervalRef.current) {
        clearTimeout(animationIntervalRef.current);
        animationIntervalRef.current = null;
      }
    }

    return () => {
      if (animationIntervalRef.current) {
        clearTimeout(animationIntervalRef.current);
      }
    };
  }, [autoAnimation, cards.size]);

  const addCard = useCallback(() => {
    const cardId = `card-${nextCardId}`;

    setCards(prev => {
      const newCards = new Map(prev);
      newCards.set(cardId, {
        quadrant: 'topLeft',
        cardData: { ...sampleCard, name: `Test Card ${nextCardId}` },
        faceDown: false,
        size: 'medium'
      });
      return newCards;
    });

    setNextCardId(prev => prev + 1);
  }, [nextCardId]);

  const moveCard = useCallback((cardId: string, newQuadrant: Quadrant) => {
    setCards(prev => {
      const newCards = new Map(prev);
      const card = newCards.get(cardId);
      if (card) {
        newCards.set(cardId, { ...card, quadrant: newQuadrant });
      }
      return newCards;
    });
  }, []);

  const removeCard = useCallback((cardId: string) => {
    setCards(prev => {
      const newCards = new Map(prev);
      newCards.delete(cardId);
      return newCards;
    });
  }, []);

  const getCardsInQuadrant = (quadrant: Quadrant) => {
    return Array.from(cards.entries())
      .filter(([, card]) => card.quadrant === quadrant)
      .map(([cardId]) => cardId);
  };



  const handleQuadrantsClick = useCallback((event: React.MouseEvent) => {
    if (cards.size === 0) return;
    
    // Get the first card (card-1)
    const firstCardId = 'card-1';
    if (!cards.has(firstCardId)) return;

    setAlternateTarget(event);
  }, [cards.size]);

  const renderQuadrant = (quadrant: Quadrant, title: string) => (
    <div 
      style={{
        flex: 1,
        border: '2px solid #333',
        margin: 8,
        padding: 16,
        borderRadius: 8,
        backgroundColor: '#f5f5f5'
      }}
    >
      <h3 style={{ margin: '0 0 16px 0', textAlign: 'center' }}>{title}</h3>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        minHeight: 200,
        alignItems: 'center',
        justifyContent: 'center',
        alignContent: 'center'
      }}>
        {getCardsInQuadrant(quadrant).map(cardId => {
          const card = cards.get(cardId);
          if (!card) return null;
          
          return (
            <FloatingCard
              key={cardId}
              instanceId={cardId}
              debugKey={`${quadrant}-${cardId}`}
              card={card.cardData}
              faceDown={card.faceDown}
              size={card.size}
            />
          );
        })}
      </div>
    </div>
  );

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        padding: 16,
        borderBottom: '1px solid #ccc',
        backgroundColor: '#fff'
      }}>
        <h1 style={{ margin: 0, marginBottom: 16 }}>CardSlot Animation Test</h1>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={addCard}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            Add Card
          </button>
          <span>Cards: {cards.size}</span>

          <button
            onClick={() => {
              if (cards.size === 0) return;
              const cardEntries = Array.from(cards.entries());
              const randomCardEntry = cardEntries[Math.floor(Math.random() * cardEntries.length)];
              const [cardId, card] = randomCardEntry;
              setCards(prev => {
                const newCards = new Map(prev);
                newCards.set(cardId, { ...card, faceDown: !card.faceDown });
                return newCards;
              });
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ff6b35',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            🃏 Random Flip
          </button>

          <button
            onClick={() => setAutoAnimation(!autoAnimation)}
            style={{
              padding: '8px 16px',
              backgroundColor: autoAnimation ? '#28a745' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: autoAnimation ? 'bold' : 'normal'
            }}
          >
            {autoAnimation ? '🔄 Auto Animation ON' : '▶️ Auto Animation OFF'}
          </button>
        </div>
      </div>

      {/* Debug Info */}
      {alternateTarget && (
        <div style={{
          position: 'fixed',
          top: 20,
          right: 20,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '12px 16px',
          borderRadius: 8,
          zIndex: 1000,
          fontFamily: 'monospace',
          fontSize: '14px'
        }}>
          <div>🎯 Alternate Target Active</div>
          <div>x: {Math.round(alternateTarget.x)}</div>
          <div>y: {Math.round(alternateTarget.y)}</div>
        </div>
      )}

      {/* Quadrants */}
      <div 
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
          cursor: 'crosshair',
          position: 'relative'
        }}
        onClick={handleQuadrantsClick}
        title="Click anywhere to set alternate target for card 1"
      >
        {/* Top Row */}
        <div style={{ flex: 1, display: 'flex' }}>
          {renderQuadrant('topLeft', 'Top Left')}
          {renderQuadrant('topRight', 'Top Right')}
        </div>
        
        {/* Bottom Row */}
        <div style={{ flex: 1, display: 'flex' }}>
          {renderQuadrant('bottomLeft', 'Bottom Left')}
          {renderQuadrant('bottomRight', 'Bottom Right')}
        </div>
        
        {/* Visual indicator for alternate target */}
        {alternateTarget && (
          <div style={{
            position: 'fixed',
            left: alternateTarget.x - 10,
            top: alternateTarget.y - 10,
            width: 20,
            height: 20,
            backgroundColor: '#ff4444',
            borderRadius: '50%',
            border: '3px solid #fff',
            boxShadow: '0 0 10px rgba(255, 68, 68, 0.8)',
            zIndex: 1000,
            pointerEvents: 'none',
            animation: 'pulse 1s infinite'
          }} />
        )}
      </div>

      {/* Card Controls */}
      {cards.size > 0 && (
        <div style={{
          padding: 16,
          borderTop: '1px solid #ccc',
          backgroundColor: '#f8f9fa',
          maxHeight: '200px',
          overflow: 'auto'
        }}>
          <h4 style={{ margin: '0 0 12px 0' }}>Card Controls</h4>
          {Array.from(cards.entries()).map(([cardId, card]) => (
            <div key={cardId} style={{
              margin: '8px 0',
              padding: 8,
              border: '1px solid #ddd',
              borderRadius: 4,
              backgroundColor: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <span style={{ fontWeight: 'bold', minWidth: 80 }}>{card.cardData.name}</span>
              <span style={{ minWidth: 80 }}>({card.quadrant})</span>
              <span style={{ minWidth: 60 }}>Size: {card.size}</span>
              <span style={{ minWidth: 60 }}>{card.faceDown ? '🃏' : '🃏'}</span>

              <div style={{ display: 'flex', gap: 4 }}>
                {(['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as Quadrant[]).map(quadrant => (
                  <button
                    key={quadrant}
                    onClick={() => moveCard(cardId, quadrant)}
                    disabled={card.quadrant === quadrant}
                    style={{
                      padding: '4px 8px',
                      fontSize: '12px',
                      border: '1px solid #ccc',
                      borderRadius: 3,
                      backgroundColor: card.quadrant === quadrant ? '#e9ecef' : 'white',
                      cursor: card.quadrant === quadrant ? 'default' : 'pointer'
                    }}
                  >
                    {quadrant.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </button>
                ))}
              </div>

              <button
                onClick={() => {
                  setCards(prev => {
                    const newCards = new Map(prev);
                    const card = newCards.get(cardId);
                    if (card) {
                      newCards.set(cardId, { ...card, faceDown: !card.faceDown });
                    }
                    return newCards;
                  });
                }}
                style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  backgroundColor: '#ffc107',
                  color: 'black',
                  border: 'none',
                  borderRadius: 3,
                  cursor: 'pointer'
                }}
              >
                {card.faceDown ? 'Show' : 'Hide'}
              </button>

              <button
                onClick={() => {
                  setCards(prev => {
                    const newCards = new Map(prev);
                    const card = newCards.get(cardId);
                    if (card) {
                      const sizes: ('small' | 'medium' | 'large')[] = ['small', 'medium', 'large'];
                      const currentIndex = sizes.indexOf(card.size);
                      const nextSize = sizes[(currentIndex + 1) % sizes.length];
                      newCards.set(cardId, { ...card, size: nextSize });
                    }
                    return newCards;
                  });
                }}
                style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  backgroundColor: '#17a2b8',
                  color: 'white',
                  border: 'none',
                  borderRadius: 3,
                  cursor: 'pointer'
                }}
              >
                Size: {card.size}
              </button>

              <button
                onClick={() => removeCard(cardId)}
                style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: 3,
                  cursor: 'pointer',
                  marginLeft: 'auto'
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const CardSlotTest: React.FC = () => {
  return (
    <FollowerProvider>
      <style>
        {`
          @keyframes pulse {
            0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
            50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.7; }
            100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          }
        `}
      </style>
      <CardSlotTestInner />
    </FollowerProvider>
  );
};

export default CardSlotTest;