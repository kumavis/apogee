import React from 'react';
import DebugView from './DebugView';
import { AutomergeUrl } from '@automerge/react';

type DebugOverlayProps = {
  isOpen: boolean;
  onClose: () => void;
  rootDocUrl?: AutomergeUrl;
};

const DebugOverlay: React.FC<DebugOverlayProps> = ({ isOpen, onClose, rootDocUrl }) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(10, 10, 10, 0.9)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
      onClick={(e) => {
        // Close if clicking the overlay background (not the content)
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Header with close instructions */}
      <div
        style={{
          backgroundColor: '#1a1a1a',
          borderBottom: '2px solid #00ffff',
          padding: '12px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0
        }}
      >
        <div style={{ color: '#00ffff', fontFamily: 'monospace', fontSize: '16px', fontWeight: 'bold' }}>
          🔍 Debug Overlay
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ color: '#888888', fontFamily: 'monospace', fontSize: '14px' }}>
            Press <kbd style={{
              backgroundColor: '#333333',
              color: '#00ffff',
              padding: '2px 6px',
              borderRadius: '3px',
              border: '1px solid #555555',
              fontFamily: 'monospace',
              fontSize: '12px'
            }}>` (backtick)</kbd> to close
          </div>
          <button
            onClick={onClose}
            style={{
              backgroundColor: '#ff4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 12px',
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#ff6666';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ff4444';
            }}
          >
            ✕ Close
          </button>
        </div>
      </div>

      {/* Debug content */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          position: 'relative'
        }}
      >
        <DebugView rootDocUrl={rootDocUrl} />
      </div>
    </div>
  );
};

export default DebugOverlay;
