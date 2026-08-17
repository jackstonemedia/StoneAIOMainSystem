/**
 * ErrorBoundary — catches render errors in any child component tree.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomePage />
 *   </ErrorBoundary>
 *
 *   // With custom fallback:
 *   <ErrorBoundary fallback={<MyFallback />}>
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
  isDev: boolean;
}

// Vite replaces process.env.NODE_ENV at build time — safe to use without vite/client types
const IS_DEV = process.env.NODE_ENV !== 'production';

// ─────────────────────────────────────────────────────────────────────────────
// Class component (React.lazy + Suspense require class-based error boundaries)
// ─────────────────────────────────────────────────────────────────────────────
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
      isDev: IS_DEV,
    };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Caught render error:', error, info.componentStack);
  }

  reset() {
    if (this.state.errorMessage?.includes('dynamically imported module') || this.state.errorMessage?.includes('Failed to fetch')) {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, errorMessage: '' });
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    const { errorMessage, isDev } = this.state;

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: '300px',
          gap: '16px',
          padding: '24px',
          color: 'var(--text-muted)',
          fontFamily: 'inherit',
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        {/* Message */}
        <div style={{ textAlign: 'center', maxWidth: '360px' }}>
          <p
            style={{
              margin: '0 0 4px',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--text-main)',
            }}
          >
            Something went wrong
          </p>
          <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.5' }}>
            This section failed to load. Try again or refresh the page.
          </p>
        </div>

        {/* Reset button */}
        <button
          onClick={this.reset}
          style={{
            padding: '7px 16px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text-main)',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-hover, var(--border))';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface)';
          }}
        >
          Try again
        </button>

        {/* Dev-only error details */}
        {isDev && errorMessage && (
          <details
            style={{
              fontSize: '11px',
              maxWidth: '480px',
              width: '100%',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '10px 12px',
            }}
          >
            <summary style={{ cursor: 'pointer', userSelect: 'none', color: 'var(--text-muted)' }}>
              Error details (dev only)
            </summary>
            <pre
              style={{
                marginTop: '8px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                color: 'var(--text-muted)',
                lineHeight: '1.5',
              }}
            >
              {errorMessage}
            </pre>
          </details>
        )}
      </div>
    );
  }
}
