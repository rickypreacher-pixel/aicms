import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase } from './lib/supabase';
import App from './App';
import AuthScreen from './AuthScreen';

function Root() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    // Load current session on mount
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // Listen for login / logout
    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // Show welcome modal on a staff member's very first login
      if (event === 'SIGNED_IN' && s?.user) {
        const meta = s.user.user_metadata || {};
        const isStaff = !!(meta.church_id && meta.church_id !== s.user.id);
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

  if (!session) {
    return (
      <AuthScreen
        onAuth={(userId, meta) => {
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
    <Root />
  </StrictMode>,
);
