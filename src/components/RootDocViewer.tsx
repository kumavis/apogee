import React from 'react';
import { RootDocument } from '../docs/rootDoc';

type Props = {
  rootDoc: RootDocument;
  onDelete: () => void;
};

const syntaxHighlightJson = (value: unknown): { __html: string } => {
  const json = JSON.stringify(value, null, 2) ?? '';

  const escapeHtml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const colorFor = (cls: string): string => {
    switch (cls) {
      case 'key':
        return '#9cdcfe';
      case 'string':
        return '#ce9178';
      case 'number':
        return '#b5cea8';
      case 'boolean':
      case 'null':
        return '#569cd6';
      default:
        return '#d4d4d4';
    }
  };

  const highlighted = escapeHtml(json).replace(
    /(\"(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\\"])*\"\s*:?)|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?/g,
    (match) => {
      let cls = 'number';
      if (/^\"/.test(match)) {
        cls = /:\s*$/.test(match) ? 'key' : 'string';
      } else if (/true|false/.test(match)) {
        cls = 'boolean';
      } else if (/null/.test(match)) {
        cls = 'null';
      }
      const color = colorFor(cls);
      return `<span style=\"color:${color}\">${match}</span>`;
    }
  );

  return { __html: highlighted };
};

const RootDocViewer: React.FC<Props> = ({ rootDoc, onDelete }) => {
  return (
    <div style={{
      maxWidth: 800,
      margin: '40px auto',
      background: 'rgba(0,0,0,0.35)',
      border: '1px solid rgba(255,255,255,0.2)',
      borderRadius: 12,
      padding: 16,
      color: '#fff',
      boxShadow: '0 8px 30px rgba(0,0,0,0.25)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, margin: 0, opacity: 0.9 }}>Root Document</h2>
        <button
          onClick={onDelete}
          style={{
            background: '#ff4d4f',
            color: '#fff',
            border: 'none',
            padding: '8px 12px',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
          }}
        >
          Delete Root Doc
        </button>
      </div>
      <pre style={{
        margin: 0,
        padding: 12,
        background: 'rgba(0,0,0,0.25)',
        borderRadius: 8,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        fontSize: 12,
        lineHeight: 1.6,
        color: '#d4d4d4',
        textAlign: 'left'
      }}>
        <code dangerouslySetInnerHTML={syntaxHighlightJson(rootDoc)} />
      </pre>
    </div>
  );
};

export default RootDocViewer;


