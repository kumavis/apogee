import React from 'react';
import { getAssetPath } from '../utils/assetUtils';

/**
 * Example component demonstrating proper asset loading for GitHub Pages
 */
export const AssetExample: React.FC = () => {
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
      
      <p style={{ fontSize: '12px', color: '#888' }}>
        Asset path: {getAssetPath('assets/example-image.svg')}
      </p>
    </div>
  );
};

export default AssetExample;
