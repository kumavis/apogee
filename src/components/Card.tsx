import React from 'react';
import { ArtifactAbility } from '../utils/spellEffects';
import { RendererDesc, ImageRendererDesc } from '../docs/cardDefinition';

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
  renderer?: RendererDesc | null; // Optional custom renderer for the card
  isPlayable?: boolean;
  currentHealth?: number; // For battlefield cards
};

type CardProps = {
  card: CardData;
  size?: 'small' | 'medium' | 'large';
  faceDown?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
  // Optional glossy overlay controls
  showGloss?: boolean;
  glossAngleDeg?: number; // direction of the highlight sweep
  glossOpacity?: number;  // 0..1 strength of the highlight
};

const Card: React.FC<CardProps> = ({ 
  card, 
  size = 'medium', 
  faceDown = false, 
  onClick,
  style = {},
  showGloss = false,
  glossAngleDeg = 0,
  glossOpacity = 0.35
}) => {
  const sizeMap = {
    small: { width: 80, height: 112 },
    medium: { width: 120, height: 168 },
    large: { width: 160, height: 224 }
  };

  const cardSize = sizeMap[size];

  // Helper function to check if renderer is an ImageRendererDesc
  const isImageRenderer = (renderer: RendererDesc | null | undefined): renderer is ImageRendererDesc => {
    return renderer !== null && renderer !== undefined && renderer.type === 'image';
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'creature': return '#00ff41'; // Neon green
      case 'spell': return '#00bfff';    // Cyan blue
      case 'artifact': return '#ff0080'; // Neon pink
      default: return '#808080';
    }
  };

  // Determine card styling based on state and renderer
  const getCardStyle = () => {
    if (faceDown) {
      return {
        background: 'linear-gradient(135deg, #1a0033 0%, #000011 100%)',
        border: '2px solid #00ffff',
        boxShadow: '0 4px 8px rgba(0, 255, 255, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      };
    }
    
    if (isImageRenderer(card.renderer)) {
      return {
        overflow: 'hidden'
      };
    }
    
    // Regular card style
    return {
      background: card.isPlayable 
        ? 'linear-gradient(135deg, #001122 0%, #002244 100%)'
        : 'linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%)',
      border: `2px solid ${card.isPlayable ? getTypeColor(card.type) : '#404040'}`,
      boxShadow: card.isPlayable 
        ? `0 4px 8px ${getTypeColor(card.type)}40`
        : '0 4px 8px rgba(0,0,0,0.2)',
      color: card.isPlayable ? '#ffffff' : '#888888',
      overflow: 'hidden'
    };
  };

  const getHoverEffects = () => {
    if (faceDown) {
      return {
        onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => {
          if (onClick) {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.4)';
          }
        },
        onMouseLeave: (e: React.MouseEvent<HTMLDivElement>) => {
          if (onClick) {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
          }
        }
      };
    }
    
    if (isImageRenderer(card.renderer)) {
      return {
        onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => {
          if (onClick) {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.4)';
          }
        },
        onMouseLeave: (e: React.MouseEvent<HTMLDivElement>) => {
          if (onClick) {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
          }
        }
      };
    }
    
    // Regular card hover effects
    return {
      onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => {
        if (onClick && card.isPlayable) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = `0 6px 12px ${getTypeColor(card.type)}60`;
        }
      },
      onMouseLeave: (e: React.MouseEvent<HTMLDivElement>) => {
        if (onClick && card.isPlayable) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = `0 4px 8px ${getTypeColor(card.type)}40`;
        }
      }
    };
  };

  const renderCardContent = () => {
    if (faceDown) {
      return (
        <div style={{
          fontSize: size === 'small' ? 20 : size === 'medium' ? 30 : 40,
          color: '#00ffff',
          textAlign: 'center'
        }}>
          ⚡
        </div>
      );
    }

    if (isImageRenderer(card.renderer)) {
      const imageRenderer = card.renderer as ImageRendererDesc;
      return (
        <img
          src={imageRenderer.url}
          alt={card.name}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: 8
          }}
          onError={(e) => {
            // Fallback to default card frame if image fails to load
            console.error(`Failed to load image for card ${card.name}: ${imageRenderer.url}`);
            e.currentTarget.style.display = 'none';
          }}
        />
      );
    }

    // Regular card content
    return (
      <>
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
      </>
    );
  };

  return (
    <div
      onClick={onClick}
      style={{
        width: cardSize.width,
        height: cardSize.height,
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        borderRadius: 8,
        transition: 'all 0.2s ease',
        ...getCardStyle(),
        ...style
      }}
      {...getHoverEffects()}
    >
      {showGloss && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 2,
            pointerEvents: 'none',
            background: `linear-gradient(${glossAngleDeg}deg, rgba(255,255,255,${Math.max(0, Math.min(1, glossOpacity))}) 0%, rgba(255,255,255,0) 80%)`
          }}
        />
      )}
      {renderCardContent()}
    </div>
  );
};

export default Card;
