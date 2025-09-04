import React from 'react';
import { Link } from 'react-router-dom';

const TestBenchIndex: React.FC = () => {
  return (
    <div style={{
      padding: '24px',
      maxWidth: '800px',
      margin: '0 auto',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ 
        margin: '0 0 32px 0',
        color: '#333',
        borderBottom: '2px solid #007bff',
        paddingBottom: '16px'
      }}>
        🧪 Test Benches
      </h1>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '24px',
        marginTop: '32px'
      }}>
        {/* Card Slot Test */}
        <div style={{
          border: '1px solid #ddd',
          borderRadius: '12px',
          padding: '24px',
          backgroundColor: '#fff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          transition: 'transform 0.2s, box-shadow 0.2s',
          cursor: 'pointer'
        }}>
          <h3 style={{ 
            margin: '0 0 16px 0',
            color: '#007bff',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            🃏 Card Slot Test
          </h3>
          <p style={{ 
            color: '#666', 
            marginBottom: '20px',
            lineHeight: '1.5'
          }}>
            Test card slot animations, floating cards, and alternate target positioning. 
            Perfect for debugging card movement and positioning logic.
          </p>
          <Link 
            to="/tests/cardslot"
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              backgroundColor: '#007bff',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '6px',
              fontWeight: '500',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#0056b3';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#007bff';
            }}
          >
            Open Test Bench →
          </Link>
        </div>

        {/* Audio Test */}
        <div style={{
          border: '1px solid #ddd',
          borderRadius: '12px',
          padding: '24px',
          backgroundColor: '#fff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          transition: 'transform 0.2s, box-shadow 0.2s',
          cursor: 'pointer'
        }}>
          <h3 style={{ 
            margin: '0 0 16px 0',
            color: '#28a745',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            🔊 Audio Test
          </h3>
          <p style={{ 
            color: '#666', 
            marginBottom: '20px',
            lineHeight: '1.5'
          }}>
            Test audio playback, volume controls, and sound effects. 
            Verify that audio assets load and play correctly across different browsers.
          </p>
          <Link 
            to="/tests/audio"
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              backgroundColor: '#28a745',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '6px',
              fontWeight: '500',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#1e7e34';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#28a745';
            }}
          >
            Open Test Bench →
          </Link>
        </div>
      </div>

      <div style={{
        marginTop: '48px',
        padding: '20px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #e9ecef'
      }}>
        <h4 style={{ margin: '0 0 12px 0', color: '#495057' }}>ℹ️ About Test Benches</h4>
        <p style={{ 
          margin: '0', 
          color: '#6c757d', 
          fontSize: '14px',
          lineHeight: '1.5'
        }}>
          Test benches provide isolated environments for testing specific functionality. 
          They help identify issues early and ensure components work correctly before 
          integration. Each test bench focuses on a specific area of functionality.
        </p>
      </div>
    </div>
  );
};

export default TestBenchIndex;
