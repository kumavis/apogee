import React from 'react';

export type InfrastructurePlacement = {
  infrastructureInstanceId: string;
  infrastructureCardId: string;
  infrastructureType: 'tech' | 'mechanical' | 'bio' | 'cultural';
};

export type CardData = {
  id: string;
  name: string;
  cost: number;
  attack?: number;
  health?: number;
  type: 'creature' | 'spell' | 'artifact' | 'planet' | 'infrastructure';
  description: string;
  isPlayable?: boolean;
  // Planet-specific properties
  planetCapacity?: {
    tech: number;
    mechanical: number;
    bio: number;
    cultural: number;
  };
  infrastructurePlacements?: InfrastructurePlacement[];
  // Infrastructure-specific properties
  infrastructureType?: 'tech' | 'mechanical' | 'bio' | 'cultural';
  infrastructureEffects?: string;
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
      case 'creature': return '#00ff41';     // Neon green
      case 'spell': return '#00bfff';        // Cyan blue
      case 'artifact': return '#ff0080';     // Neon pink
      case 'planet': return '#ffaa00';       // Orange
      case 'infrastructure': return '#aa00ff'; // Purple
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
        {card.type === 'creature' ? '🤖' : 
         card.type === 'spell' ? '⚡' : 
         card.type === 'artifact' ? '🔧' :
         card.type === 'planet' ? '🌍' :
         card.type === 'infrastructure' ? 
           (card.infrastructureType === 'tech' ? '💻' :
            card.infrastructureType === 'mechanical' ? '⚙️' :
            card.infrastructureType === 'bio' ? '🧬' :
            card.infrastructureType === 'cultural' ? '🏛️' : '🏗️') : '❓'}
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

      {/* Stats (for creatures) */}
      {card.type === 'creature' && (
        <div style={{
          position: 'absolute',
          bottom: 4,
          left: 4,
          right: 4,
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: size === 'small' ? 8 : 10,
          fontWeight: 'bold'
        }}>
          <div style={{
            background: '#ff0080',
            color: 'white',
            padding: '1px 4px',
            borderRadius: 3,
            minWidth: size === 'small' ? 12 : 16,
            textAlign: 'center',
            boxShadow: '0 0 4px #ff0080'
          }}>
            ⚡{card.attack}
          </div>
          <div style={{
            background: '#00ff41',
            color: 'black',
            padding: '1px 4px',
            borderRadius: 3,
            minWidth: size === 'small' ? 12 : 16,
            textAlign: 'center',
            boxShadow: '0 0 4px #00ff41'
          }}>
            🛡{card.health}
          </div>
        </div>
      )}

      {/* Planet Infrastructure Display (for planets) */}
      {card.type === 'planet' && card.planetCapacity && (
        <div style={{
          position: 'absolute',
          bottom: 4,
          left: 4,
          right: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 1
        }}>
          {/* Infrastructure Placements */}
          {card.infrastructurePlacements && card.infrastructurePlacements.length > 0 && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 1,
              fontSize: size === 'small' ? 6 : 8,
              marginBottom: 1
            }}>
              {card.infrastructurePlacements.map((placement) => (
                <div
                  key={placement.infrastructureInstanceId}
                  style={{
                    background: placement.infrastructureType === 'tech' ? '#aa00ff' :
                               placement.infrastructureType === 'mechanical' ? '#ff6600' :
                               placement.infrastructureType === 'bio' ? '#00aa00' :
                               '#ffaa00',
                    color: placement.infrastructureType === 'cultural' ? 'black' : 'white',
                    padding: '1px 3px',
                    borderRadius: 2,
                    fontSize: size === 'small' ? 6 : 7,
                    fontWeight: 'bold'
                  }}
                >
                  {placement.infrastructureType === 'tech' ? '💻' :
                   placement.infrastructureType === 'mechanical' ? '⚙️' :
                   placement.infrastructureType === 'bio' ? '🧬' : '🏛️'}
                </div>
              ))}
            </div>
          )}
          
          {/* Capacity Display (Usage/Max) */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: size === 'small' ? 5 : 6,
            fontWeight: 'bold',
            gap: 1
          }}>
            {(() => {
              const placements = card.infrastructurePlacements || [];
              const techUsed = placements.filter(p => p.infrastructureType === 'tech').length;
              const mechUsed = placements.filter(p => p.infrastructureType === 'mechanical').length;
              const bioUsed = placements.filter(p => p.infrastructureType === 'bio').length;
              const cultUsed = placements.filter(p => p.infrastructureType === 'cultural').length;
              
              return (
                <>
                  <div style={{
                    background: techUsed >= card.planetCapacity.tech ? '#aa00ff' : 'rgba(170, 0, 255, 0.5)',
                    color: 'white',
                    padding: '1px 2px',
                    borderRadius: 2,
                    textAlign: 'center',
                    flex: 1,
                    border: techUsed >= card.planetCapacity.tech ? '1px solid #ffffff' : 'none'
                  }}>
                    💻{techUsed}/{card.planetCapacity.tech}
                  </div>
                  <div style={{
                    background: mechUsed >= card.planetCapacity.mechanical ? '#ff6600' : 'rgba(255, 102, 0, 0.5)',
                    color: 'white',
                    padding: '1px 2px',
                    borderRadius: 2,
                    textAlign: 'center',
                    flex: 1,
                    border: mechUsed >= card.planetCapacity.mechanical ? '1px solid #ffffff' : 'none'
                  }}>
                    ⚙️{mechUsed}/{card.planetCapacity.mechanical}
                  </div>
                  <div style={{
                    background: bioUsed >= card.planetCapacity.bio ? '#00aa00' : 'rgba(0, 170, 0, 0.5)',
                    color: 'white',
                    padding: '1px 2px',
                    borderRadius: 2,
                    textAlign: 'center',
                    flex: 1,
                    border: bioUsed >= card.planetCapacity.bio ? '1px solid #ffffff' : 'none'
                  }}>
                    🧬{bioUsed}/{card.planetCapacity.bio}
                  </div>
                  <div style={{
                    background: cultUsed >= card.planetCapacity.cultural ? '#ffaa00' : 'rgba(255, 170, 0, 0.5)',
                    color: cultUsed >= card.planetCapacity.cultural ? 'black' : 'white',
                    padding: '1px 2px',
                    borderRadius: 2,
                    textAlign: 'center',
                    flex: 1,
                    border: cultUsed >= card.planetCapacity.cultural ? '1px solid #000000' : 'none'
                  }}>
                    🏛️{cultUsed}/{card.planetCapacity.cultural}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Infrastructure Type (for infrastructure) */}
      {card.type === 'infrastructure' && card.infrastructureType && (
        <div style={{
          position: 'absolute',
          bottom: 4,
          left: 4,
          right: 4,
          display: 'flex',
          justifyContent: 'center',
          fontSize: size === 'small' ? 8 : 10,
          fontWeight: 'bold'
        }}>
          <div style={{
            background: card.infrastructureType === 'tech' ? '#aa00ff' :
                       card.infrastructureType === 'mechanical' ? '#ff6600' :
                       card.infrastructureType === 'bio' ? '#00aa00' :
                       '#ffaa00',
            color: card.infrastructureType === 'cultural' ? 'black' : 'white',
            padding: '1px 6px',
            borderRadius: 3,
            textAlign: 'center',
            textTransform: 'uppercase'
          }}>
            {card.infrastructureType}
          </div>
        </div>
      )}
    </div>
  );
};

export default Card;
