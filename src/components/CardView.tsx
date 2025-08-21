import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useDocument } from '@automerge/react';
import { AutomergeUrl } from '@automerge/react';
import { CardDefinition } from '../docs/cardDefinition';
import { useGameNavigation } from '../hooks/useGameNavigation';
import Card from './Card';

type CardViewProps = {
  rootDoc: any; // RootDocument type
  addCardToLibrary?: (cardUrl: AutomergeUrl) => void;
};

const CardView: React.FC<CardViewProps> = ({ rootDoc, addCardToLibrary }) => {
  const { cardId } = useParams<{ cardId: AutomergeUrl }>();
  const navigate = useNavigate();
  const location = useLocation();
  if (!cardId) {
    throw new Error('Card ID is required');
  }
  const [cardDoc] = useDocument<CardDefinition>(cardId, { suspense: false });
  const { navigateToCardLibrary, navigateToCardEdit } = useGameNavigation();
  
  const cardRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [glossAngleDeg, setGlossAngleDeg] = useState<number>(0);
  const [glossOpacity, setGlossOpacity] = useState<number>(0.25);
  
  // Find the custom card in the library
  const isInLibrary = useMemo(() => {
    // Check if it's a custom card in the library
    return rootDoc.cardLibrary.includes(cardId);
  }, [cardId, rootDoc.cardLibrary]);

  // Smart back button handler
  const handleBack = () => {
    if (location.key !== 'default') {
      navigate(-1);
    } else {
      navigateToCardLibrary();
    }
  };

  // 3D tilt effect setup with performance optimizations
  useEffect(() => {
    // Throttle variables
    let inProgress = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    function tilt(x: number, y: number) {
      // Only apply 3D effect if refs are populated
      if (!cardRef.current) return;
      
      const card = cardRef.current;
      const force = 15; // Much gentler tilt for subtle effect
      // Use card dimensions for more natural tilt calculation
      const cardRect = card.getBoundingClientRect();
      const rx = (x / cardRect.width) * force;
      const ry = (y / cardRect.height) * -force;

      // Apply 3D transform to the card container with gentle, shallow angles
      card.style.transform = `rotateY(${rx}deg) rotateX(${ry}deg)`;
    }

    function light(x: number, y: number) {
      if (!cardRef.current) return;
      const card = cardRef.current;
      const cardRect = card.getBoundingClientRect();
      const angle = (Math.atan2(y, x) * 180) / Math.PI - 90;
      const normalizedY = (y + cardRect.height / 2) / cardRect.height; // 0..1
      const opacity = Math.max(0, Math.min(0.6, normalizedY * 0.6));
      setGlossAngleDeg(angle);
      setGlossOpacity(opacity);
    }

    function updateCard() {
      if (!inProgress) return;
      
      tilt(lastMouseX, lastMouseY);
      light(lastMouseX, lastMouseY);
      inProgress = false;
    }

    function handleMouseMove(event: MouseEvent) {
      // Only calculate mouse position if refs are populated
      if (!cardRef.current) return;
      
      const card = cardRef.current;
      // Get the card's position and dimensions
      const cardRect = card.getBoundingClientRect();
      const cardCenterX = cardRect.left + cardRect.width / 2;
      const cardCenterY = cardRect.top + cardRect.height / 2;
      
      // Calculate mouse position relative to card center
      lastMouseX = event.clientX - cardCenterX;
      lastMouseY = event.clientY - cardCenterY;
      
      if (!inProgress) {
        inProgress = true;
        requestAnimationFrame(updateCard);
      }
    }

    // Set up mouse listener immediately
    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, []); // Empty dependency array - effect should only run once after mount

  if (!cardDoc) {
    return (
      <div style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
        color: '#fff'
      }}>
        <div>Loading card...</div>
      </div>
    );
  }



  return (
    <div style={{
      width: '100%',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transformStyle: 'preserve-3d',
      perspective: '800px'
    }}>
      {/* Back button */}
      <button
        onClick={handleBack}
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          background: 'rgba(255,255,255,0.1)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.2)',
          padding: '12px 20px',
          borderRadius: 8,
          cursor: 'pointer',
          fontSize: 16,
          fontWeight: 600,
          transition: 'all 0.2s ease',
          zIndex: 1000,
          maxWidth: 'calc(100vw - 40px)', // Prevent button from going off-screen
          whiteSpace: 'nowrap' // Keep button text on one line
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
        }}
      >
        ← Back
      </button>

      {/* 3D Card Container */}
      <div
        ref={cardRef}
        style={{
          transformStyle: 'preserve-3d',
          transition: 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)', // Smoother, more elegant transition
          position: 'relative',
          // Create a much larger 3D space to prevent occlusion
          width: 'min(800px, calc(100vw - 80px))', // Responsive width with padding
          height: 'min(800px, calc(100vh - 80px))', // Responsive height with padding
          // Ensure the container has proper 3D rendering
          background: 'transparent',
          zIndex: 1
        }}
      >
        {/* Actual Card Component */}
        <div
          ref={contentRef}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) translateZ(75px)'
          }}
        >
          <Card 
            card={cardDoc}
            size="large"
            showGloss={true}
            glossAngleDeg={glossAngleDeg}
            glossOpacity={glossOpacity}
            style={{
              transform: 'scale(2.5)',
              filter: 'drop-shadow(0 0 20px rgba(0,0,0,0.5))'
            }}
          />
        </div>
      </div>

      {/* Library Status */}
      <div style={{
        marginTop: '40px',
        textAlign: 'center',
        color: '#fff',
        opacity: 0.8,
        padding: '0 20px', // Add horizontal padding to prevent edge collision
        maxWidth: '100%', // Ensure content doesn't overflow
        boxSizing: 'border-box' // Include padding in width calculation
      }}>
        {isInLibrary && <div style={{
          padding: '16px 24px',
          background: 'rgba(0,255,255,0.1)',
          border: '1px solid rgba(0,255,255,0.3)',
          borderRadius: 12,
          display: 'inline-block',
          maxWidth: '100%', // Prevent overflow
          wordWrap: 'break-word' // Handle long text gracefully
        }}>
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            gap: 12
          }}>
            <span style={{ color: '#00ffff', fontSize: '1.1rem' }}>
              ✅ This card is already in your library
            </span>
            <button
              onClick={() => navigateToCardEdit(cardId)}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#fff',
                border: 'none',
                padding: '10px 20px',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: '0.95rem',
                fontWeight: 600,
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(102,126,234,0.3)',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(102,126,234,0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(102,126,234,0.3)';
              }}
            >
              ✏️ Edit Card
            </button>
          </div>
        </div>}
      
        {!isInLibrary && addCardToLibrary && <button
            onClick={() => addCardToLibrary(cardId)}
            style={{
              background: 'linear-gradient(135deg, #00ff00 0%, #00aa00 100%)',
              color: '#000',
              border: 'none',
              padding: '12px 24px',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 600,
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 12px rgba(0,255,0,0.3)',
              maxWidth: '100%', // Prevent button from overflowing
              whiteSpace: 'nowrap' // Keep button text on one line
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,255,0,0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,255,0,0.3)';
            }}
          >
            ➕ Add to Library
          </button>
        }
      </div>
    </div>
  );
};

export default CardView;
