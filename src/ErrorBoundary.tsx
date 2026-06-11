import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean; message: string };

/**
 * Top-level safety net. If anything in the app throws during render, React would
 * normally unmount the whole tree and leave a blank white screen. This catches
 * that, shows a friendly recovery screen, and lets the user reload — so one
 * unexpected error can never make the whole app "go dead" for a staff member.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || 'Unexpected error' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep a record in the console so it can be diagnosed later.
    console.error('App crash caught by ErrorBoundary:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#1a2e5a', padding: 20,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}>
        <div style={{
          background: '#fff', borderRadius: 16, padding: '36px 28px 28px', maxWidth: 420,
          width: '100%', textAlign: 'center', boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
        }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1a2e5a', marginBottom: 8 }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 18, lineHeight: 1.6 }}>
            The app ran into an unexpected problem. Your data is safe — reloading
            usually fixes it. If it keeps happening, let your administrator know.
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#1a2e5a', color: '#fff', border: 'none', borderRadius: 9,
              padding: '12px 24px', fontSize: 15, fontWeight: 600, cursor: 'pointer',
              width: '100%', fontFamily: 'inherit',
            }}
          >
            Reload App
          </button>
          {this.state.message && (
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 14, wordBreak: 'break-word' }}>
              {this.state.message}
            </div>
          )}
        </div>
      </div>
    );
  }
}
