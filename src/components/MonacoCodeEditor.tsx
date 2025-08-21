import React, { useState } from 'react';
import Editor from '@monaco-editor/react';

type MonacoCodeEditorProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  language?: string;
  resizable?: boolean;
  defaultHeight?: string;
  collapsible?: boolean;
  title?: string;
};

const MonacoCodeEditor: React.FC<MonacoCodeEditorProps> = ({ 
  value, 
  onChange, 
  disabled = false, 
  language = 'javascript', 
  resizable = true, 
  defaultHeight = '200px', 
  collapsible = false, 
  title = 'Code Editor' 
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [currentHeight, setCurrentHeight] = useState(defaultHeight);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleEditorChange = (value: string | undefined) => {
    onChange(value || '');
  };

  const handleEditorDidMount = () => {
    setIsLoading(false);
  };

  const handleEditorWillMount = (monaco: any) => {
    // Register custom theme
    monaco.editor.defineTheme('apogee-dark', {
      base: 'vs-dark' as const,
      inherit: true,
      rules: [
        { token: 'keyword', foreground: '#ff6b6b', fontStyle: 'bold' },
        { token: 'string', foreground: '#51cf66' },
        { token: 'number', foreground: '#74c0fc' },
        { token: 'comment', foreground: '#868e96', fontStyle: 'italic' },
        { token: 'function', foreground: '#fcc419' },
        { token: 'property', foreground: '#ae8fff' },
        { token: 'operator', foreground: '#ffd43b' },
        { token: 'type', foreground: '#20c997' }
      ],
      colors: {
        'editor.background': '#1a1a1a',
        'editor.foreground': '#ffffff',
        'editor.lineHighlightBackground': '#2a2a2a',
        'editor.selectionBackground': '#3a3a3a',
        'editor.inactiveSelectionBackground': '#2a2a2a',
        'editorCursor.foreground': '#bb88ff',
        'editorWhitespace.foreground': '#404040',
        'editorIndentGuide.background': '#404040',
        'editorIndentGuide.activeBackground': '#606060'
      }
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!resizable || disabled) return;
    
    const startY = e.clientY;
    const startHeight = parseInt(currentHeight);
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - startY;
      const newHeight = Math.max(100, startHeight + deltaY); // Minimum height of 100px
      setCurrentHeight(`${newHeight}px`);
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  if (isCollapsed) {
    return (
      <div style={{
        border: '1px solid rgba(128,0,128,0.3)',
        borderRadius: 6,
        background: 'rgba(128,0,128,0.1)',
        padding: '8px 12px',
        cursor: 'pointer'
      }} onClick={toggleCollapse}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#bb88ff',
          fontSize: 12
        }}>
          <span>📝 {title} (Click to expand)</span>
          <span>▶️</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      border: '1px solid rgba(128,0,128,0.3)',
      borderRadius: 6,
      overflow: 'hidden',
      opacity: disabled ? 0.6 : 1,
      position: 'relative'
    }}>
      {/* Header with collapse button */}
      {collapsible && (
        <div style={{
          background: 'rgba(128,0,128,0.2)',
          padding: '4px 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(128,0,128,0.3)'
        }}>
          <span style={{
            color: '#bb88ff',
            fontSize: 11,
            fontWeight: 600
          }}>
            📝 {title}
          </span>
          <button
            onClick={toggleCollapse}
            style={{
              background: 'none',
              border: 'none',
              color: '#bb88ff',
              cursor: 'pointer',
              fontSize: 12,
              padding: '2px 6px',
              borderRadius: 3
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(128,0,128,0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
            }}
          >
            🔽
          </button>
        </div>
      )}

      {isLoading && (
        <div style={{
          position: 'absolute',
          top: collapsible ? 32 : 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#bb88ff',
          fontSize: 12,
          zIndex: 10
        }}>
          Loading code editor...
        </div>
      )}
      <Editor
        height={currentHeight}
        language={language}
        value={value}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        beforeMount={handleEditorWillMount}
        options={{
          readOnly: disabled,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 12,
          fontFamily: 'Monaco, Consolas, "Courier New", monospace',
          lineNumbers: 'on',
          roundedSelection: false,
          scrollbar: {
            vertical: 'visible',
            horizontal: 'visible'
          },
          automaticLayout: true,
          wordWrap: 'on',
          suggestOnTriggerCharacters: true,
          quickSuggestions: true,
          parameterHints: {
            enabled: true
          },
          hover: {
            enabled: true
          },
          folding: true,
          foldingStrategy: 'indentation',
          showFoldingControls: 'always',
          renderLineHighlight: 'all',
          selectOnLineNumbers: true,
          contextmenu: true,
          mouseWheelZoom: true,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on'
        }}
        theme="apogee-dark"
      />
      
      {/* Resize handle */}
      {resizable && !disabled && (
        <div
          onMouseDown={handleMouseDown}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '6px',
            background: 'rgba(128,0,128,0.3)',
            cursor: 'ns-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 5,
            transition: 'background-color 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(128,0,128,0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(128,0,128,0.3)';
          }}
        >
          <div style={{
            width: '30px',
            height: '2px',
            background: 'rgba(128,0,128,0.6)',
            borderRadius: '1px'
          }} />
        </div>
      )}
    </div>
  );
};

export default MonacoCodeEditor;
