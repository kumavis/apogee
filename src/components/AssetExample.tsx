import React, { useState } from 'react';
import { getAssetPath } from '../utils/assetUtils';

/**
 * Example component demonstrating proper asset loading for GitHub Pages
 */
export const AssetExample: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);

  const handlePlayAudio = async () => {
    try {
      if (currentAudio && isPlaying) {
        // Stop current audio
        currentAudio.pause();
        currentAudio.currentTime = 0;
        setCurrentAudio(null);
        setIsPlaying(false);
      } else {
        // Create and play new audio (no DOM element needed!)
        const audio = new Audio(getAssetPath('assets/example-audio.mp3'));
        await audio.play();
        setCurrentAudio(audio);
        setIsPlaying(true);
        
        // Handle when audio ends
        audio.addEventListener('ended', () => {
          setIsPlaying(false);
          setCurrentAudio(null);
        });
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsPlaying(false);
      setCurrentAudio(null);
    }
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

      {/* Example of playing audio with pure JavaScript (no DOM element!) */}
      <div style={{ margin: '20px 0' }}>
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
