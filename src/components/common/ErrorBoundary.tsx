/**
 * ErrorBoundary — catches render errors in any child component tree.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomePage />
 *   </ErrorBoundary>
 */
import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Class component (React.lazy + Suspense require class-based error boundaries)
// ─────────────────────────────────────────────────────────────────────────────
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Caught render error:', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: '300px',
          gap: '12px',
          color: 'var(--color-text-muted, #888)',
          fontFamily: 'inherit',
        }}
      >
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p style={{ margin: 0, fontSize: '14px' }}>Something went wrong. Please refresh the page.</p>
        {this.state.errorMessage && (
          <details style={{ fontSize: '12px', maxWidth: '400px', textAlign: 'center' }}>
            <summary style={{ cursor: 'pointer' }}>Error details</summary>
            <pre style={{ marginTop: '8px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {this.state.errorMessage}
            </pre>
          </details>
        )}
      </div>
    );
  }
}
