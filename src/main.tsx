import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase } from './lib/supabase';
import App from './App';
import AuthScreen from './AuthScreen';

function Root() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load current session on mount
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // Listen for login / logout
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
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
    <App
      churchId={churchId}
      churchName={meta.church_name || ''}
      adminFirst={isStaff ? (meta.admin_first || '') : (meta.admin_first || '')}
      adminLast={isStaff ? (meta.admin_last || '') : (meta.admin_last || '')}
      onSignOut={() => supabase.auth.signOut()}
    />
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
