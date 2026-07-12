import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase } from './lib/supabase';
import App from './App';
import AuthScreen from './AuthScreen';
import ErrorBoundary from './ErrorBoundary';

// ── Set-a-new-password screen, shown when a "Forgot password?" recovery link is opened.
//    The recovery session is already active (Supabase established it from the link), so
//    updateUser() sets the new password on the current account.
function ResetPasswordScreen({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (pw.length < 8) { setErr('Password must be at least 8 characters.'); return; }
    if (pw !== pw2) { setErr('Passwords do not match.'); return; }
    setBusy(true); setErr('');
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      setErr(error.message || 'Could not update your password. The reset link may have expired — request a new one.');
      return;
    }
    setDone(true);
    try { history.replaceState(null, '', window.location.pathname); } catch { /* ignore */ }
  };

  const N = '#1a2e5a', G = '#c9a84c', W = '#fff', BR = '#e2e5ec', MU = '#6b7280', TX = '#1f2937', RE = '#dc2626';
  const input: React.CSSProperties = { width: '100%', padding: '10px 12px', border: `1px solid ${BR}`, borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', color: TX, background: W };

  return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(145deg, ${N} 0%, #112347 60%, #0e1d3a 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: `linear-gradient(135deg, ${G} 0%, #a87d32 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, margin: '0 auto 14px', boxShadow: '0 8px 24px rgba(201,168,76,0.3)' }}>⛪</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: W, marginBottom: 4 }}>ChurchOS</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>Church Management Platform</div>
        </div>
        <div style={{ background: W, borderRadius: 16, padding: '28px 28px 24px', boxShadow: '0 24px 60px rgba(0,0,0,0.35)' }}>
          {done ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 10 }}>✅</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: N, marginBottom: 6 }}>Password updated</div>
              <div style={{ fontSize: 13, color: MU, marginBottom: 20, lineHeight: 1.5 }}>Your new password is set. You're all signed in — continue to your church.</div>
              <button onClick={onDone} style={{ width: '100%', padding: '11px 16px', borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: G, color: N, border: 'none' }}>Continue →</button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: N, marginBottom: 6 }}>Set a new password</div>
              <div style={{ fontSize: 13, color: MU, marginBottom: 18, lineHeight: 1.5 }}>Choose a new password for your account. Minimum 8 characters.</div>
              {err && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: RE }}>{err}</div>}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: MU, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>New Password</div>
                <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Min. 8 characters" autoComplete="new-password" style={input} />
              </div>
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: MU, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>Confirm New Password</div>
                <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Repeat password" autoComplete="new-password" onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} style={input} />
              </div>
              <button onClick={submit} disabled={busy} style={{ width: '100%', padding: '11px 16px', borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1, fontFamily: 'inherit', background: N, color: W, border: 'none' }}>{busy ? '...' : 'Update Password'}</button>
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <button onClick={() => { supabase.auth.signOut(); onDone(); }} style={{ background: 'none', border: 'none', color: N, fontSize: 12, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>Cancel and sign in normally</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Root() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  // Password-recovery deep link ("Forgot password?" email): intercept it and show a
  // set-new-password screen, else the app routes past it and nothing lets the user reset.
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    // A recovery link lands with `type=recovery` in the URL hash — catch it right away.
    try { if ((window.location.hash || '').includes('type=recovery')) setRecovery(true); } catch { /* ignore */ }

    // Load current session on mount
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // Listen for login / logout
    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // Password reset: the recovery link fires this event. Show the set-new-password screen.
      if (event === 'PASSWORD_RECOVERY') { setRecovery(true); setLoading(false); }
      // Show welcome modal on a staff member's very first login
      if (event === 'SIGNED_IN' && s?.user) {
        const meta = s.user.user_metadata || {};
        const isStaff = !!(meta.church_id && meta.church_id !== s.user.id);
        // Login Activity tracker: record each sign-in once per browser session (non-blocking).
        try {
          const _sessKey = `ntcc_login_logged_${s.user.id}`;
          if (!sessionStorage.getItem(_sessKey)) {
            sessionStorage.setItem(_sessKey, '1');
            const _name = meta.full_name || meta.name || meta.display_name
              || [meta.admin_first, meta.admin_last].filter(Boolean).join(' ').trim()
              || (s.user.email || '').split('@')[0];
            supabase.from('login_events').insert({
              church_id: meta.church_id || s.user.id,
              user_id: s.user.id,
              name: _name,
              email: s.user.email || null,
            }).then(() => {}, () => {});
          }
        } catch { /* tracking must never block login */ }
        const firstKey = `ntcc_first_login_${s.user.id}`;
        if (isStaff && !localStorage.getItem(firstKey)) {
          localStorage.setItem(firstKey, '1');
          setShowWelcome(true);
        }
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#1a2e5a', color: '#fff', fontSize: 16, fontFamily: 'sans-serif',
      }}>
        Loading ChurchOS...
      </div>
    );
  }

  // Password-recovery link opened → let the user set a new password before anything else.
  if (recovery) {
    return <ResetPasswordScreen onDone={() => setRecovery(false)} />;
  }

  if (!session) {
    return (
      <AuthScreen
        onAuth={() => {
          // Session will update automatically via onAuthStateChange
        }}
      />
    );
  }

  const churchId = session.user.user_metadata?.church_id || session.user.id;
  const meta = session.user.user_metadata || {};
  const isStaff = !!(meta.church_id && meta.church_id !== session.user.id);

  return (
    <>
      <App
        churchId={churchId}
        churchName={meta.church_name || ''}
        adminFirst={isStaff ? (meta.admin_first || '') : (meta.admin_first || '')}
        adminLast={isStaff ? (meta.admin_last || '') : (meta.admin_last || '')}
        loggedInEmail={session.user.email || ''}
        displayName={meta.full_name || meta.name || meta.display_name || ''}
        isStaff={isStaff}
        onSignOut={() => supabase.auth.signOut()}
      />
      {showWelcome && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:20, fontFamily:"'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" } as any}>
          <div style={{ background:'#fff', borderRadius:16, padding:'36px 28px 28px', maxWidth:400, width:'100%', textAlign:'center', boxShadow:'0 24px 60px rgba(0,0,0,0.4)' }}>
            <div style={{ fontSize:52, marginBottom:12 }}>🎉</div>
            <div style={{ fontSize:22, fontWeight:700, color:'#1a2e5a', marginBottom:8 }}>
              Welcome, {meta.admin_first || 'Staff Member'}!
            </div>
            <div style={{ fontSize:14, color:'#6b7280', marginBottom:16, lineHeight:1.6 }}>
              You’re now signed in to <strong>ChurchOS</strong>. You have access to all the tools your administrator has set up for your church.
            </div>
            {meta.phone && (
              <div style={{ fontSize:13, color:'#166534', background:'#f0fdf4', border:'1px solid #86efac', borderRadius:8, padding:'10px 14px', marginBottom:16, lineHeight:1.5 }}>
                📱 A welcome SMS was sent to <strong>{meta.phone}</strong>.
              </div>
            )}
            <button
              onClick={() => setShowWelcome(false)}
              style={{ background:'#1a2e5a', color:'#fff', border:'none', borderRadius:9, padding:'12px 24px', fontSize:15, fontWeight:600, cursor:'pointer', width:'100%', fontFamily:'inherit' }}
            >
              Get Started →
            </button>
          </div>
        </div>
      )}
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </StrictMode>,
);
