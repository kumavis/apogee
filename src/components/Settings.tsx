import React, { useState } from 'react';
import { AutomergeUrl, useDocument } from '@automerge/react';
import { deleteRootDoc, setRootDocUrl } from '../docs/rootDoc';
import { ContactDoc } from '../docs/contact';
import { useGameNavigation } from '../hooks/useGameNavigation';
import AssetExample from './AssetExample';

type SettingsProps = {
  rootDocUrl: AutomergeUrl;
  selfId: AutomergeUrl;
};

const Settings: React.FC<SettingsProps> = ({ rootDocUrl, selfId }) => {
  const { navigateToHome, navigateToDebug } = useGameNavigation();
  const [newRootDocUrl, setNewRootDocUrl] = useState('');
  const [validationError, setValidationError] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  
  // Name editing state
  const [newName, setNewName] = useState('');
  const [nameError, setNameError] = useState('');
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  
  // Get the user's contact document
  const [contactDoc, changeContactDoc] = useDocument<ContactDoc>(selfId, {
    suspense: false,
  });

  const validateAutomergeUrl = (url: string): { isValid: boolean; error: string } => {
    // Clear any previous validation state
    const trimmedUrl = url.trim();
    
    // Check if empty
    if (!trimmedUrl) {
      return { isValid: false, error: 'URL cannot be empty' };
    }
    
    // Check basic format (should start with 'automerge:')
    if (!trimmedUrl.startsWith('automerge:')) {
      return { isValid: false, error: 'URL must start with "automerge:"' };
    }
    
    // Check if it has the expected length (automerge: + ~27 character base58 string)
    if (trimmedUrl.length < 35 || trimmedUrl.length > 45) {
      return { isValid: false, error: 'URL appears to have incorrect length. Expected format: automerge:7K9mxPqR2vN8BwLc3sYtZjGh4Xf' };
    }
    
    // Extract the ID part after 'automerge:'
    const idPart = trimmedUrl.substring(10);
    
    // Check for valid base58 characters (no 0, O, I, l)
    const base58Regex = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;
    if (!base58Regex.test(idPart)) {
      return { isValid: false, error: 'URL contains invalid characters. Must use base58 encoding (no 0, O, I, l)' };
    }
    
    // Additional validation: check that it doesn't contain invalid sequences
    if (idPart.includes('//') || idPart.includes('..')) {
      return { isValid: false, error: 'URL contains invalid character sequences' };
    }
    
    // Check minimum length for the ID part (should be around 27+ characters)
    if (idPart.length < 20) {
      return { isValid: false, error: 'Document ID appears too short. Expected ~27 characters after "automerge:"' };
    }
    
    return { isValid: true, error: '' };
  };

  const handleUrlInputChange = (value: string) => {
    setNewRootDocUrl(value);
    
    // Clear validation error when user starts typing
    if (validationError) {
      setValidationError('');
    }
    
    // Real-time validation for better UX
    if (value.trim()) {
      const validation = validateAutomergeUrl(value);
      if (!validation.isValid) {
        setValidationError(validation.error);
      }
    }
  };

  const validateName = (name: string): { isValid: boolean; error: string } => {
    const trimmedName = name.trim();
    
    if (!trimmedName) {
      return { isValid: false, error: 'Name cannot be empty' };
    }
    
    if (trimmedName.length < 2) {
      return { isValid: false, error: 'Name must be at least 2 characters long' };
    }
    
    if (trimmedName.length > 50) {
      return { isValid: false, error: 'Name must be 50 characters or less' };
    }
    
    // Check for only allowed characters (letters, numbers, spaces, some punctuation)
    const nameRegex = /^[a-zA-Z0-9\s\-_'.]+$/;
    if (!nameRegex.test(trimmedName)) {
      return { isValid: false, error: 'Name can only contain letters, numbers, spaces, hyphens, underscores, apostrophes, and periods' };
    }
    
    return { isValid: true, error: '' };
  };

  const handleStartEditingName = () => {
    setNewName(contactDoc?.name || '');
    setIsEditingName(true);
    setNameError('');
  };

  const handleCancelEditingName = () => {
    setNewName('');
    setIsEditingName(false);
    setNameError('');
  };

  const handleNameInputChange = (value: string) => {
    setNewName(value);
    
    // Clear name error when user starts typing
    if (nameError) {
      setNameError('');
    }
    
    // Real-time validation for better UX
    if (value.trim()) {
      const validation = validateName(value);
      if (!validation.isValid) {
        setNameError(validation.error);
      }
    }
  };

  const handleUpdateName = async () => {
    setIsUpdatingName(true);
    setNameError('');
    
    try {
      const validation = validateName(newName);
      
      if (!validation.isValid) {
        setNameError(validation.error);
        setIsUpdatingName(false);
        return;
      }
      
      const trimmedName = newName.trim();
      
      // Check if it's the same as current name
      if (trimmedName === contactDoc?.name) {
        setNameError('This is already your current name');
        setIsUpdatingName(false);
        return;
      }
      
      // Update the contact document
      changeContactDoc((doc) => {
        doc.name = trimmedName;
      });
      
      setNewName('');
      setIsEditingName(false);
      setNameError('');
      
    } catch (error) {
      console.error('Failed to update name:', error);
      setNameError('Failed to update name: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleDeleteAllData = () => {
    if (window.confirm('Are you sure you want to delete all data? This action cannot be undone.')) {
      deleteRootDoc();
      window.location.reload();
    }
  };

  const handleSetRootDocUrl = async () => {
    setIsValidating(true);
    setValidationError('');
    
    try {
      const validation = validateAutomergeUrl(newRootDocUrl);
      
      if (!validation.isValid) {
        setValidationError(validation.error);
        setIsValidating(false);
        return;
      }
      
      const url = newRootDocUrl.trim() as AutomergeUrl;
      
      // Check if it's the same as current URL
      if (url === rootDocUrl) {
        setValidationError('This is already your current root document URL');
        setIsValidating(false);
        return;
      }
      
      setRootDocUrl(url);
      setNewRootDocUrl('');
      setValidationError('');
      
      // Show success message
      alert('Root document URL updated successfully. The page will reload to connect to the new document.');
      window.location.reload();
      
    } catch (error) {
      console.error('Failed to set root doc URL:', error);
      setValidationError('Failed to update root document URL: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div style={{
      maxWidth: 800,
      margin: '40px auto',
      background: 'rgba(0,0,0,0.35)',
      border: '1px solid rgba(255,255,255,0.2)',
      borderRadius: 12,
      padding: 24,
      color: '#fff',
      boxShadow: '0 8px 30px rgba(0,0,0,0.25)'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        marginBottom: 24 
      }}>
        <h1 style={{ 
          fontSize: 24, 
          margin: 0, 
          fontWeight: 600,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          ⚙️ Settings
        </h1>
        <button
          onClick={navigateToHome}
          style={{
            background: 'rgba(102, 126, 234, 0.8)',
            color: '#fff',
            border: 'none',
            padding: '8px 16px',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(102, 126, 234, 1)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(102, 126, 234, 0.8)';
            e.currentTarget.style.transform = 'translateY(0px)';
          }}
        >
          ← Back to Menu
        </button>
      </div>

      <div style={{ marginBottom: 32 }}>
        <h2 style={{ 
          fontSize: 18, 
          marginBottom: 16, 
          color: '#00ff00',
          fontWeight: 600 
        }}>
          👤 Your Profile
        </h2>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, marginBottom: 8, opacity: 0.8 }}>
            Display Name
          </div>
          {!isEditingName ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                flex: 1,
                padding: '12px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.05)',
                fontSize: 16,
                fontWeight: 600,
                color: '#fff'
              }}>
                {contactDoc?.name || 'Loading...'}
              </div>
              <button
                onClick={handleStartEditingName}
                disabled={!contactDoc}
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: '#fff',
                  border: 'none',
                  padding: '12px 16px',
                  borderRadius: 8,
                  cursor: !contactDoc ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                  boxShadow: '0 2px 6px rgba(102,126,234,0.3)',
                  transition: 'all 0.2s ease',
                  opacity: !contactDoc ? 0.6 : 1
                }}
                onMouseEnter={(e) => {
                  if (contactDoc) {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(102,126,234,0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (contactDoc) {
                    e.currentTarget.style.transform = 'translateY(0px)';
                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(102,126,234,0.3)';
                  }
                }}
              >
                ✏️ Edit
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => handleNameInputChange(e.target.value)}
                  placeholder="Enter your display name..."
                  disabled={isUpdatingName}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 8,
                    border: `1px solid ${nameError ? '#ff4444' : 'rgba(255,255,255,0.2)'}`,
                    background: isUpdatingName ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)',
                    color: nameError ? '#ff4444' : '#fff',
                    fontSize: 14,
                    opacity: isUpdatingName ? 0.6 : 1,
                    transition: 'all 0.2s ease'
                  }}
                />
                {nameError && (
                  <div style={{
                    fontSize: 12,
                    color: '#ff4444',
                    marginTop: 6,
                    padding: '4px 8px',
                    background: 'rgba(255, 68, 68, 0.1)',
                    borderRadius: 4,
                    border: '1px solid rgba(255, 68, 68, 0.2)'
                  }}>
                    ⚠️ {nameError}
                  </div>
                )}
                {newName && !nameError && !isUpdatingName && (
                  <div style={{
                    fontSize: 12,
                    color: '#00ff00',
                    marginTop: 6,
                    padding: '4px 8px',
                    background: 'rgba(0, 255, 0, 0.1)',
                    borderRadius: 4,
                    border: '1px solid rgba(0, 255, 0, 0.2)'
                  }}>
                    ✅ Valid name
                  </div>
                )}
              </div>
              <button
                onClick={handleUpdateName}
                disabled={isUpdatingName || !!nameError || !newName.trim()}
                style={{
                  background: (isUpdatingName || !!nameError || !newName.trim()) 
                    ? 'rgba(128,128,128,0.5)' 
                    : 'linear-gradient(135deg, #00ff00 0%, #00cc00 100%)',
                  color: (isUpdatingName || !!nameError || !newName.trim()) ? '#999' : '#000',
                  border: 'none',
                  padding: '12px 16px',
                  borderRadius: 8,
                  cursor: (isUpdatingName || !!nameError || !newName.trim()) ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                  boxShadow: (isUpdatingName || !!nameError || !newName.trim()) 
                    ? 'none' 
                    : '0 2px 6px rgba(0,255,0,0.3)',
                  transition: 'all 0.2s ease',
                  opacity: (isUpdatingName || !!nameError || !newName.trim()) ? 0.6 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isUpdatingName && !nameError && newName.trim()) {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,255,0,0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isUpdatingName && !nameError && newName.trim()) {
                    e.currentTarget.style.transform = 'translateY(0px)';
                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,255,0,0.3)';
                  }
                }}
              >
                {isUpdatingName ? '⏳ Saving...' : '💾 Save'}
              </button>
              <button
                onClick={handleCancelEditingName}
                disabled={isUpdatingName}
                style={{
                  background: 'rgba(255, 77, 79, 0.8)',
                  color: '#fff',
                  border: 'none',
                  padding: '12px 16px',
                  borderRadius: 8,
                  cursor: isUpdatingName ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                  transition: 'all 0.2s ease',
                  opacity: isUpdatingName ? 0.6 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isUpdatingName) {
                    e.currentTarget.style.background = 'rgba(255, 77, 79, 1)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isUpdatingName) {
                    e.currentTarget.style.background = 'rgba(255, 77, 79, 0.8)';
                    e.currentTarget.style.transform = 'translateY(0px)';
                  }
                }}
              >
                ❌ Cancel
              </button>
            </div>
          )}
        </div>
        <div style={{ fontSize: 12, opacity: 0.6 }}>
          This name will be visible to other players in games.
        </div>
        
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 14, marginBottom: 8, opacity: 0.8 }}>
            Contact ID
          </div>
          <div style={{
            padding: '12px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.05)',
            fontSize: 12,
            fontFamily: 'monospace',
            color: '#00ffff',
            wordBreak: 'break-all',
            lineHeight: 1.4
          }}>
            {selfId}
          </div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 6 }}>
            This is your unique contact identifier. Share this with other players to connect.
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 32 }}>
        <h2 style={{ 
          fontSize: 18, 
          marginBottom: 16, 
          color: '#00ffff',
          fontWeight: 600 
        }}>
          📡 Root Document URL
        </h2>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, marginBottom: 8, opacity: 0.8 }}>
            Current URL: <code style={{ 
              background: 'rgba(255,255,255,0.1)', 
              padding: '2px 6px', 
              borderRadius: 4,
              fontSize: 12,
              wordBreak: 'break-all'
            }}>{rootDocUrl}</code>
          </div>
          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 12 }}>
            Change this to connect to a different root document for syncing with other devices or users.
            <br />
            Expected format: <code style={{ 
              background: 'rgba(0,255,255,0.1)', 
              padding: '1px 4px', 
              borderRadius: 3,
              fontSize: 11
            }}>automerge:7K9mxPqR2vN8BwLc3sYtZjGh4Xf</code>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <input
              type="text"
              value={newRootDocUrl}
              onChange={(e) => handleUrlInputChange(e.target.value)}
              placeholder="automerge:7K9mxPqR2vN8BwLc3sYtZjGh4Xf"
              disabled={isValidating}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 8,
                border: `1px solid ${validationError ? '#ff4444' : 'rgba(255,255,255,0.2)'}`,
                background: isValidating ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)',
                color: validationError ? '#ff4444' : '#fff',
                fontSize: 14,
                fontFamily: 'monospace',
                opacity: isValidating ? 0.6 : 1,
                transition: 'all 0.2s ease'
              }}
            />
            {validationError && (
              <div style={{
                fontSize: 12,
                color: '#ff4444',
                marginTop: 6,
                padding: '4px 8px',
                background: 'rgba(255, 68, 68, 0.1)',
                borderRadius: 4,
                border: '1px solid rgba(255, 68, 68, 0.2)'
              }}>
                ⚠️ {validationError}
              </div>
            )}
            {newRootDocUrl && !validationError && !isValidating && (
              <div style={{
                fontSize: 12,
                color: '#00ff00',
                marginTop: 6,
                padding: '4px 8px',
                background: 'rgba(0, 255, 0, 0.1)',
                borderRadius: 4,
                border: '1px solid rgba(0, 255, 0, 0.2)'
              }}>
                ✅ Valid Automerge URL format
              </div>
            )}
          </div>
          <button
            onClick={handleSetRootDocUrl}
            disabled={isValidating || !!validationError || !newRootDocUrl.trim()}
            style={{
              background: (isValidating || !!validationError || !newRootDocUrl.trim()) 
                ? 'rgba(128,128,128,0.5)' 
                : 'linear-gradient(135deg, #00ff00 0%, #00cc00 100%)',
              color: (isValidating || !!validationError || !newRootDocUrl.trim()) ? '#999' : '#000',
              border: 'none',
              padding: '12px 20px',
              borderRadius: 8,
              cursor: (isValidating || !!validationError || !newRootDocUrl.trim()) ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 600,
              boxShadow: (isValidating || !!validationError || !newRootDocUrl.trim()) 
                ? 'none' 
                : '0 2px 6px rgba(0,255,0,0.3)',
              transition: 'all 0.2s ease',
              opacity: (isValidating || !!validationError || !newRootDocUrl.trim()) ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (!isValidating && !validationError && newRootDocUrl.trim()) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,255,0,0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isValidating && !validationError && newRootDocUrl.trim()) {
                e.currentTarget.style.transform = 'translateY(0px)';
                e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,255,0,0.3)';
              }
            }}
          >
            {isValidating ? '⏳ Validating...' : 'Set URL'}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 32 }}>
        <h2 style={{ 
          fontSize: 18, 
          marginBottom: 16, 
          color: '#ffaa00',
          fontWeight: 600 
        }}>
          🔧 Developer Tools
        </h2>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, marginBottom: 8, opacity: 0.8 }}>
            Advanced debugging tools for inspecting automerge documents.
          </div>
          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 12 }}>
            View JSON data, document sizes, and automerge history for all documents in your repository.
          </div>
        </div>
        <button
          onClick={navigateToDebug}
          style={{
            background: 'linear-gradient(135deg, #ffaa00 0%, #ff8800 100%)',
            color: '#000',
            border: 'none',
            padding: '12px 20px',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
            boxShadow: '0 2px 6px rgba(255,170,0,0.3)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(255,170,0,0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0px)';
            e.currentTarget.style.boxShadow = '0 2px 6px rgba(255,170,0,0.3)';
          }}
        >
          🔍 Debug Documents
        </button>
      </div>

      <div style={{ marginBottom: 32 }}>
        <h2 style={{ 
          fontSize: 18, 
          marginBottom: 16, 
          color: '#00ff00',
          fontWeight: 600 
        }}>
          🖼️ Static Assets Demo
        </h2>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, marginBottom: 8, opacity: 0.8 }}>
            Example of how static assets are loaded from the public/assets directory.
          </div>
          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 12 }}>
            This demonstrates proper asset path handling for GitHub Pages deployment.
          </div>
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8,
          padding: 16
        }}>
          <AssetExample />
        </div>
      </div>

      <div style={{ marginBottom: 32 }}>
        <h2 style={{ 
          fontSize: 18, 
          marginBottom: 16, 
          color: '#ff4444',
          fontWeight: 600 
        }}>
          💔 Danger Zone
        </h2>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, marginBottom: 8, opacity: 0.8 }}>
            Delete all local game data and reset to a fresh state.
          </div>
          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 12 }}>
            ⚠️ This action cannot be undone. All your games and settings will be permanently lost.
          </div>
        </div>
        <button
          onClick={handleDeleteAllData}
          style={{
            background: 'rgba(255, 77, 79, 0.8)',
            color: '#fff',
            border: 'none',
            padding: '12px 20px',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 77, 79, 1)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 77, 79, 0.8)';
            e.currentTarget.style.transform = 'translateY(0px)';
          }}
        >
          🗑️ Reset All Data
        </button>
      </div>

      <div style={{
        textAlign: 'center',
        fontSize: 12,
        opacity: 0.5,
        fontStyle: 'italic'
      }}>
        Changes to the root document URL will require a page reload to take effect.
      </div>
    </div>
  );
};

export default Settings;
