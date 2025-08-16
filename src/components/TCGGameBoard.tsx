import React, { useState } from 'react';
import { AutomergeUrl } from '@automerge/react';
import { RootDocument } from '../docs/rootDoc';
import { useGameNavigation } from '../hooks/useGameNavigation';
import Card, { CardData } from './Card';
import Contact from './Contact';

type TCGGameBoardProps = {
  gameDocUrl: string;
  rootDoc: RootDocument;
  playerList: AutomergeUrl[];
};

// Sci-fi themed mock card data
const createMockCards = (): CardData[] => [
  {
    id: '1',
    name: 'Quantum Destroyer',
    cost: 5,
    attack: 4,
    health: 3,
    type: 'creature',
    description: 'A cybernetic war machine from the future.',
    isPlayable: true
  },
  {
    id: '2',
    name: 'Plasma Burst',
    cost: 3,
    type: 'spell',
    description: 'Deal 3 energy damage to any target.',
    isPlayable: true
  },
  {
    id: '3',
    name: 'Steel Sentinel',
    cost: 4,
    attack: 2,
    health: 6,
    type: 'creature',
    description: 'An automated defense unit.',
    isPlayable: false
  },
  {
    id: '4',
    name: 'Nano Enhancer',
    cost: 2,
    type: 'artifact',
    description: 'Equipped unit gains +2/+1.',
    isPlayable: true
  },
  {
    id: '5',
    name: 'Bio-Mech Guardian',
    cost: 6,
    attack: 5,
    health: 5,
    type: 'creature',
    description: 'Protects all allied units.',
    isPlayable: false
  },
  {
    id: '6',
    name: 'Data Spike',
    cost: 1,
    type: 'spell',
    description: 'Hack enemy systems.',
    isPlayable: true
  }
];

const createPlayAreaCards = (): CardData[] => [
  {
    id: 'p1',
    name: 'Cyber Drone',
    cost: 2,
    attack: 2,
    health: 1,
    type: 'creature',
    description: 'A fast reconnaissance unit.',
    isPlayable: false
  },
  {
    id: 'p2',
    name: 'Energy Shield',
    cost: 3,
    attack: 1,
    health: 4,
    type: 'creature',
    description: 'Deflects incoming attacks.',
    isPlayable: false
  }
];

const TCGGameBoard: React.FC<TCGGameBoardProps> = ({ 
  gameDocUrl, 
  rootDoc, 
  playerList 
}) => {
  const { navigateToHome } = useGameNavigation();
  const [currentOpponentIndex, setCurrentOpponentIndex] = useState(0);
  const [playerHand] = useState(createMockCards);
  const [playerBoard] = useState(createPlayAreaCards);
  const [opponentBoard] = useState(createPlayAreaCards);

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
          <div style={{ fontSize: 12, opacity: 0.7 }}>Turn 1</div>
          <div style={{ fontSize: 12, opacity: 0.7, color: '#00ffff' }}>Energy: 5/5</div>
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
          {Array.from({ length: 6 }, (_, i) => (
            <Card
              key={`opp-hand-${i}`}
              card={{} as CardData}
              size="small"
              faceDown={true}
            />
          ))}
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
          {opponentBoard.map((card) => (
            <Card
              key={card.id}
              card={card}
              size="medium"
              style={{ transform: 'rotate(180deg)' }}
            />
          ))}
          {opponentBoard.length === 0 && (
            <div style={{
              color: 'rgba(255,255,255,0.5)',
              fontSize: 16,
              fontStyle: 'italic'
            }}>
              No cards in play
            </div>
          )}
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
          {playerBoard.map((card) => (
            <Card
              key={card.id}
              card={card}
              size="medium"
              onClick={() => console.log('Clicked card:', card.name)}
            />
          ))}
          {playerBoard.length === 0 && (
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
              <div>Deck: 15</div>
              <div>Graveyard: 3</div>
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
            {playerHand.map((card) => (
              <Card
                key={card.id}
                card={card}
                size="medium"
                onClick={() => console.log('Play card:', card.name)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{
        position: 'absolute',
        bottom: 20,
        right: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      }}>
        <button style={{
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
        }}>
          End Turn
        </button>
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
