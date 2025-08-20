import React from 'react';
import { ArtifactAbility } from '../utils/spellEffects';

export type CardData = {
  id: string;
  name: string;
  cost: number;
  attack?: number;
  health?: number;
  type: 'creature' | 'spell' | 'artifact';
  description: string;
  spellEffect?: string;
  triggeredAbilities?: ArtifactAbility[]; // Array of triggered abilities
  isPlayable?: boolean;
  currentHealth?: number; // For battlefield cards
};

type CardProps = {
  card: CardData;
  size?: 'small' | 'medium' | 'large';
  faceDown?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
};

const Card: React.FC<CardProps> = ({ 
  card, 
  size = 'medium', 
  faceDown = false, 
  onClick,
  style = {} 
}) => {
  const sizeMap = {
    small: { width: 80, height: 112 },
    medium: { width: 120, height: 168 },
    large: { width: 160, height: 224 }
  };

  const cardSize = sizeMap[size];

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'creature': return '#00ff41'; // Neon green
      case 'spell': return '#00bfff';    // Cyan blue
      case 'artifact': return '#ff0080'; // Neon pink
      default: return '#808080';
    }
  };

  if (faceDown) {
    return (
      <div
        onClick={onClick}
        style={{
          width: cardSize.width,
          height: cardSize.height,
          background: 'linear-gradient(135deg, #1a0033 0%, #000011 100%)',
          border: '2px solid #00ffff',
          borderRadius: 8,
          cursor: onClick ? 'pointer' : 'default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          boxShadow: '0 4px 8px rgba(0, 255, 255, 0.3)',
          transition: 'all 0.2s ease',
          ...style
        }}
        onMouseEnter={(e) => {
          if (onClick) {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.4)';
          }
        }}
        onMouseLeave={(e) => {
          if (onClick) {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
          }
        }}
      >
        <div style={{
          fontSize: size === 'small' ? 20 : size === 'medium' ? 30 : 40,
          color: '#00ffff',
          textAlign: 'center'
        }}>
          ⚡
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      style={{
        width: cardSize.width,
        height: cardSize.height,
        background: card.isPlayable 
          ? 'linear-gradient(135deg, #001122 0%, #002244 100%)'
          : 'linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%)',
        border: `2px solid ${card.isPlayable ? getTypeColor(card.type) : '#404040'}`,
        borderRadius: 8,
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        boxShadow: card.isPlayable 
          ? `0 4px 8px ${getTypeColor(card.type)}40`
          : '0 4px 8px rgba(0,0,0,0.2)',
        transition: 'all 0.2s ease',
        color: card.isPlayable ? '#ffffff' : '#888888',
        overflow: 'hidden',
        ...style
      }}
      onMouseEnter={(e) => {
        if (onClick && card.isPlayable) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = `0 6px 12px ${getTypeColor(card.type)}60`;
        }
      }}
      onMouseLeave={(e) => {
        if (onClick && card.isPlayable) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = `0 4px 8px ${getTypeColor(card.type)}40`;
        }
      }}
    >
      {/* Cost */}
      <div style={{
        position: 'absolute',
        top: 4,
        left: 4,
        width: size === 'small' ? 16 : 20,
        height: size === 'small' ? 16 : 20,
        borderRadius: '50%',
        background: getTypeColor(card.type),
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size === 'small' ? 8 : 10,
        fontWeight: 'bold'
      }}>
        {card.cost}
      </div>

      {/* Card Name */}
      <div style={{
        position: 'absolute',
        top: 4,
        right: 4,
        left: size === 'small' ? 24 : 28,
        fontSize: size === 'small' ? 8 : size === 'medium' ? 10 : 12,
        fontWeight: 600,
        textOverflow: 'ellipsis',
        overflow: 'hidden',
        whiteSpace: 'nowrap'
      }}>
        {card.name}
      </div>

      {/* Card Art Area */}
      <div style={{
        position: 'absolute',
        top: size === 'small' ? 24 : 28,
        left: 4,
        right: 4,
        height: size === 'small' ? 40 : size === 'medium' ? 60 : 80,
        background: card.isPlayable 
          ? 'linear-gradient(135deg, #003366 0%, #0066aa 100%)'
          : 'linear-gradient(135deg, #2a2a2a 0%, #404040 100%)',
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size === 'small' ? 16 : size === 'medium' ? 24 : 32,
        border: `1px solid ${card.isPlayable ? getTypeColor(card.type) : '#404040'}`,
        boxShadow: card.isPlayable ? `0 0 8px ${getTypeColor(card.type)}40` : 'none'
      }}>
        {card.type === 'creature' ? '🤖' : card.type === 'spell' ? '⚡' : '🔧'}
      </div>

      {/* Description */}
      <div style={{
        position: 'absolute',
        bottom: size === 'small' ? 20 : size === 'medium' ? 28 : 36,
        left: 4,
        right: 4,
        fontSize: size === 'small' ? 6 : size === 'medium' ? 8 : 10,
        lineHeight: 1.2,
        height: size === 'small' ? 16 : size === 'medium' ? 24 : 32,
        overflow: 'hidden',
        textAlign: 'center',
        padding: '0 2px'
      }}>
        {card.description}
      </div>

      {/* Stats (for creatures and artifacts) */}
      {(card.type === 'creature' || card.type === 'artifact') && (
        <div style={{
          position: 'absolute',
          bottom: 4,
          left: 4,
          right: 4,
          display: 'flex',
          justifyContent: card.type === 'artifact' ? 'center' : 'space-between',
          fontSize: size === 'small' ? 8 : 10,
          fontWeight: 'bold'
        }}>
          {/* Attack (only for creatures) */}
          {card.type === 'creature' && (
            <div style={{
              background: '#ff0080',
              color: 'white',
              padding: '1px 4px',
              borderRadius: 3,
              minWidth: size === 'small' ? 12 : 16,
              textAlign: 'center',
              boxShadow: '0 0 4px #ff0080'
            }}>
              🗡️{card.attack}
            </div>
          )}
          {/* Health (for both creatures and artifacts) */}
          <div style={{
            background: card.currentHealth !== undefined && card.currentHealth < (card.health || 0) ? '#ff8800' : '#00ff41',
            color: 'black',
            padding: '1px 4px',
            borderRadius: 3,
            minWidth: size === 'small' ? 12 : 16,
            textAlign: 'center',
            boxShadow: `0 0 4px ${card.currentHealth !== undefined && card.currentHealth < (card.health || 0) ? '#ff8800' : '#00ff41'}`
          }}>
            🛡{card.currentHealth !== undefined ? `${card.currentHealth}/${card.health}` : card.health}
          </div>
        </div>
      )}
    </div>
  );
};

export default Card;
