import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';

const AudioTest: React.FC = () => {
  const [volume, setVolume] = useState(0.5);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  const handleTimeUpdate = () => {
    // This will be called as the audio plays to update the progress
  };

  const handleLoadedMetadata = () => {
    console.log('Audio metadata loaded');
  };

  const handleError = (error: any) => {
    console.error('Audio error:', error);
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#f5f5f5'
    }}>
      {/* Header */}
      <div style={{
        padding: '20px',
        backgroundColor: '#fff',
        borderBottom: '1px solid #ddd',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '16px'
        }}>
          <Link 
            to="/tests"
            style={{
              padding: '8px 16px',
              backgroundColor: '#6c757d',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          >
            ← Back to Tests
          </Link>
          <h1 style={{ margin: 0, color: '#333' }}>🔊 Audio Test Bench</h1>
        </div>
        <p style={{ margin: 0, color: '#666' }}>
          Test audio playback, volume controls, and sound effects. Verify that audio assets load and play correctly.
        </p>
      </div>

      {/* Main Content */}
      <div style={{
        flex: 1,
        padding: '32px',
        maxWidth: '800px',
        margin: '0 auto',
        width: '100%'
      }}>
        {/* Audio Player */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '32px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          marginBottom: '32px'
        }}>
          <h2 style={{ margin: '0 0 24px 0', color: '#333' }}>Audio Player</h2>
          
          {/* Audio Element */}
          <audio
            ref={audioRef}
            src="/assets/example-audio.mp3"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onError={handleError}
            style={{ display: 'none' }}
          />
          
          {/* Controls */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            alignItems: 'center'
          }}>
            {/* Play/Pause Button */}
            <button
              onClick={handlePlayPause}
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: isPlaying ? '#dc3545' : '#28a745',
                color: 'white',
                fontSize: '24px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              {isPlaying ? '⏸️' : '▶️'}
            </button>

            {/* Volume Control */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              minWidth: '200px'
            }}>
              <label style={{ fontSize: '14px', color: '#666' }}>
                Volume: {Math.round(volume * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                style={{
                  width: '100%',
                  height: '8px',
                  borderRadius: '4px',
                  background: '#ddd',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              />
            </div>
          </div>
        </div>

        {/* Audio Information */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          marginBottom: '32px'
        }}>
          <h3 style={{ margin: '0 0 16px 0', color: '#333' }}>Audio Information</h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px'
          }}>
            <div>
              <strong>Source:</strong> /assets/example-audio.mp3
            </div>
            <div>
              <strong>Status:</strong> {isPlaying ? 'Playing' : 'Paused'}
            </div>
            <div>
              <strong>Volume:</strong> {Math.round(volume * 100)}%
            </div>
            <div>
              <strong>Format:</strong> MP3
            </div>
          </div>
        </div>

        {/* Testing Instructions */}
        <div style={{
          backgroundColor: '#e7f3ff',
          borderRadius: '12px',
          padding: '24px',
          border: '1px solid #b3d9ff'
        }}>
          <h3 style={{ margin: '0 0 16px 0', color: '#0056b3' }}>🧪 Testing Instructions</h3>
          <ul style={{
            margin: '0',
            paddingLeft: '20px',
            color: '#0056b3',
            lineHeight: '1.6'
          }}>
            <li>Click the play button to start audio playback</li>
            <li>Adjust the volume slider to test volume control</li>
            <li>Check browser console for any audio loading errors</li>
            <li>Test on different browsers to ensure compatibility</li>
            <li>Verify audio plays correctly with different volume levels</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AudioTest;
