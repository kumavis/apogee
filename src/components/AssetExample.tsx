import React, { useRef, useState } from 'react';
import { getAssetPath } from '../utils/assetUtils';

/**
 * Example component demonstrating proper asset loading for GitHub Pages
 */
export const AssetExample: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlayAudio = async () => {
    if (!audioRef.current) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
      } else {
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsPlaying(false);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h3>Asset Loading Example</h3>
      <p>This demonstrates how to properly load static assets for GitHub Pages deployment.</p>
      
      {/* Example of loading an image from the assets directory */}
      <div style={{ margin: '20px 0' }}>
        <img 
          src={getAssetPath('assets/example-image.svg')} 
          alt="Example asset"
          style={{ width: '100px', height: '100px' }}
        />
      </div>
      
      <p style={{ fontSize: '12px', color: '#888', marginBottom: '20px' }}>
        Image path: {getAssetPath('assets/example-image.svg')}
      </p>

      {/* Example of loading audio from the assets directory */}
      <div style={{ margin: '20px 0' }}>
        <audio 
          ref={audioRef}
          onEnded={handleAudioEnded}
          preload="metadata"
        >
          <source src={getAssetPath('assets/example-audio.mp3')} type="audio/mpeg" />
          Your browser does not support the audio element.
        </audio>
        
        <button
          onClick={handlePlayAudio}
          style={{
            background: isPlaying 
              ? 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)'
              : 'linear-gradient(135deg, #00ff00 0%, #00cc00 100%)',
            color: isPlaying ? '#fff' : '#000',
            border: 'none',
            padding: '12px 24px',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 16,
            fontWeight: 600,
            boxShadow: isPlaying 
              ? '0 2px 6px rgba(255,68,68,0.3)'
              : '0 2px 6px rgba(0,255,0,0.3)',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            margin: '0 auto'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = isPlaying 
              ? '0 4px 12px rgba(255,68,68,0.4)'
              : '0 4px 12px rgba(0,255,0,0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0px)';
            e.currentTarget.style.boxShadow = isPlaying 
              ? '0 2px 6px rgba(255,68,68,0.3)'
              : '0 2px 6px rgba(0,255,0,0.3)';
          }}
        >
          {isPlaying ? '⏹️ Stop Audio' : '🔊 Play Audio'}
        </button>
      </div>
      
      <p style={{ fontSize: '12px', color: '#888' }}>
        Audio path: {getAssetPath('assets/example-audio.mp3')}
      </p>
    </div>
  );
};

export default AssetExample;
