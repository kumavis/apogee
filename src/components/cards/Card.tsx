import React from 'react';
import { CardDoc } from '../../docs/card';
import { RendererDesc, ImageRendererDesc } from '../../docs/card';
import { BattlefieldCardState } from '../../docs/game';

const { freeze } = Object;

export const sizeMap = freeze({
  small: freeze({ width: 80, height: 112 }),
  medium: freeze({ width: 120, height: 168 }),
  large: freeze({ width: 160, height: 224 }),
});

export type BaseCardProps = {
  size?: 'small' | 'medium' | 'large';
  faceDown?: boolean;
};

export type CardProps = BaseCardProps & {
  card: CardDoc;
  cardState?: BattlefieldCardState;
  debugKey?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
  // Optional glossy overlay controls
  showGloss?: boolean;
  glossAngleDeg?: number; // direction of the highlight sweep
  glossOpacity?: number;  // 0..1 strength of the highlight
};

const Card: React.FC<CardProps> = ({ 
  card,
  cardState,
  size = 'medium', 
  faceDown = false,
  onClick,
  style = {},
  showGloss = false,
  glossAngleDeg = 0,
  glossOpacity = 0.35,
}) => {
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

    const style: React.CSSProperties = {
      overflow: 'hidden',
      border: `2px solid ${onClick ? getTypeColor(card.type) : '#404040'}`,
      boxShadow: onClick 
        ? `0 4px 8px ${getTypeColor(card.type)}40`
        : '0 4px 8px rgba(0,0,0,0.2)',
      color: onClick ? '#ffffff' : '#888888',
    }
    
    if (isImageRenderer(card.renderer)) {
      return style;
    } else {
      style.background = onClick 
        ? 'linear-gradient(135deg, #001122 0%, #002244 100%)'
        : 'linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%)';
      return style;
    }
    
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

    // Regular card hover effects
    return {
      onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = `0 6px 12px ${getTypeColor(card.type)}60`;
        }
      },
      onMouseLeave: (e: React.MouseEvent<HTMLDivElement>) => {
        if (onClick) {
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
        <>
          {/* Background Image */}
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
          
          {/* Sapped Overlay */}
          {cardState?.sapped && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'rgba(0,0,0,0.6)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#999',
              fontSize: size === 'small' ? 12 : size === 'medium' ? 16 : 20,
              fontWeight: 'bold',
              textShadow: '0 0 4px rgba(0,0,0,0.8)',
              zIndex: 1
            }}>
              😴 SAPPED
            </div>
          )}
          
          {/* Cost (top-left) */}
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
            fontWeight: 'bold',
            zIndex: 2,
            boxShadow: '0 0 4px rgba(0,0,0,0.5)'
          }}>
            {card.cost}
          </div>

          {/* Card Name (top-right) */}
          <div style={{
            position: 'absolute',
            top: 4,
            right: 4,
            left: size === 'small' ? 24 : 28,
            fontSize: size === 'small' ? 8 : size === 'medium' ? 10 : 12,
            fontWeight: 600,
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            color: 'white',
            textShadow: '0 0 4px rgba(0,0,0,0.8)',
            zIndex: 2
          }}>
            {card.name}
          </div>

          {/* Stats (bottom) - for creatures and artifacts */}
          {(card.type === 'creature' || card.type === 'artifact') && (
            <div style={{
              position: 'absolute',
              bottom: 4,
              left: 4,
              right: 4,
              display: 'flex',
              justifyContent: card.type === 'artifact' ? 'center' : 'space-between',
              fontSize: size === 'small' ? 8 : 10,
              fontWeight: 'bold',
              zIndex: 2
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
                background: cardState?.currentHealth !== undefined && cardState?.currentHealth < (card.health || 0) ? '#ff8800' : '#00ff41',
                color: 'black',
                padding: '1px 4px',
                borderRadius: 3,
                minWidth: size === 'small' ? 12 : 16,
                textAlign: 'center',
                boxShadow: `0 0 4px ${cardState?.currentHealth !== undefined && cardState?.currentHealth < (card.health || 0) ? '#ff8800' : '#00ff41'}`
              }}>
                🛡{cardState?.currentHealth !== undefined ? `${cardState?.currentHealth}/${card.health}` : card.health}
              </div>
            </div>
          )}
        </>
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
          background: onClick 
            ? 'linear-gradient(135deg, #003366 0%, #0066aa 100%)'
            : 'linear-gradient(135deg, #2a2a2a 0%, #404040 100%)',
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size === 'small' ? 16 : size === 'medium' ? 24 : 32,
          border: `1px solid ${onClick ? getTypeColor(card.type) : '#404040'}`,
          boxShadow: onClick ? `0 0 8px ${getTypeColor(card.type)}40` : 'none'
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
              background: cardState?.currentHealth !== undefined && cardState?.currentHealth < (card.health || 0) ? '#ff8800' : '#00ff41',
              color: 'black',
              padding: '1px 4px',
              borderRadius: 3,
              minWidth: size === 'small' ? 12 : 16,
              textAlign: 'center',
              boxShadow: `0 0 4px ${cardState?.currentHealth !== undefined && cardState?.currentHealth < (card.health || 0) ? '#ff8800' : '#00ff41'}`
            }}>
              🛡{cardState?.currentHealth !== undefined ? `${cardState?.currentHealth}/${card.health}` : card.health}
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
