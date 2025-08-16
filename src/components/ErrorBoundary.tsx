import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div
          style={{
            padding: '15px',
            background: 'rgba(255, 0, 0, 0.1)',
            border: '1px solid rgba(255, 0, 0, 0.3)',
            borderRadius: '6px',
            color: '#ff9999',
            marginBottom: '15px',
          }}
        >
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>⚠️ Something went wrong</h4>
          <p style={{ margin: '0 0 8px 0', fontSize: '12px' }}>
            This section failed to render. You can try reloading the page.
          </p>
          <details style={{ fontSize: '11px' }}>
            <summary style={{ cursor: 'pointer' }}>Error details</summary>
            <pre
              style={{
                margin: '8px 0 0 0',
                fontSize: '10px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {this.state.error?.message}
            </pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
