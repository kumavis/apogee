import React from 'react';
import { AutomergeUrl, useDocument } from '@automerge/react';
import { ContactDoc } from '../docs/contact';

type ContactProps = {
  contactUrl: AutomergeUrl;
  style?: React.CSSProperties;
};

const Contact: React.FC<ContactProps> = ({ contactUrl, style = {} }) => {
  const [contactDoc] = useDocument<ContactDoc>(contactUrl, {
    suspense: false,
  });

  if (!contactDoc) {
    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        background: 'rgba(255,255,255,0.1)',
        borderRadius: 6,
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'rgba(255,255,255,0.2)',
        color: '#999',
        fontSize: 12,
        ...style
      }}>
        👤 Loading...
      </div>
    );
  }

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 12px',
      background: 'rgba(103, 126, 234, 0.2)',
      borderRadius: 6,
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: 'rgba(103, 126, 234, 0.3)',
      color: '#fff',
      fontSize: 12,
      fontWeight: 500,
      ...style
    }}>
      👤 {contactDoc.name || 'Anonymous'}
    </div>
  );
};

export default Contact;
