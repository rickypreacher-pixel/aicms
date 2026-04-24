import { useState } from 'react';
import { supabase } from './lib/supabase';

const N = "#1a2e5a";
const G = "#c9a84c";
const GL = "#f5e9c8";
const W = "#fff";
const BR = "#e2e5ec";
const MU = "#6b7280";
const TX = "#1f2937";
const RE = "#dc2626";
const GR = "#16a34a";
const BG = "#f4f6fb";

type AuthMode = 'login' | 'register' | 'forgot';

interface AuthScreenProps {
  onAuth: (userId: string, meta: Record<string, any>) => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: MU, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function Input({ type = 'text', value, onChange, placeholder, autoComplete }: any) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      style={{
        width: '100%',
        padding: '10px 12px',
        border: `1px solid ${BR}`,
        borderRadius: 8,
        fontSize: 13,
        outline: 'none',
        boxSizing: 'border-box',
        fontFamily: 'inherit',
        color: TX,
        background: W,
      }}
    />
  );
}

export default function AuthScreen({ onAuth }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('login');

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register fields
  const [churchName, setChurchName] = useState('');
  const [adminFirst, setAdminFirst] = useState('');
  const [adminLast, setAdminLast] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPassword2, setRegPassword2] = useState('');

  // Forgot fields
  const [forgotEmail, setForgotEmail] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) { setError('Please enter your email and password.'); return; }
    setLoading(true); setError(''); setSuccess('');
    const { data, error: err } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPassword,
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    if (data.user) onAuth(data.user.id, data.user.user_metadata || {});
  };

  const handleRegister = async () => {
    if (!churchName.trim()) { setError('Church name is required.'); return; }
    if (!adminFirst.trim() || !adminLast.trim()) { setError('Admin name is required.'); return; }
    if (!regEmail.trim()) { setError('Email is required.'); return; }
    if (regPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (regPassword !== regPassword2) { setError('Passwords do not match.'); return; }
    setLoading(true); setError(''); setSuccess('');
    const { data, error: err } = await supabase.auth.signUp({
      email: regEmail.trim(),
      password: regPassword,
      options: {
        data: {
          church_name: churchName.trim(),
          admin_first: adminFirst.trim(),
          admin_last: adminLast.trim(),
        },
      },
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    if (data.user && !data.session) {
      // Email confirmation required
      setSuccess('Account created! Check your email to confirm before logging in.');
      setMode('login');
    } else if (data.user) {
      onAuth(data.user.id, data.user.user_metadata || {});
    }
  };

  const handleForgot = async () => {
    if (!forgotEmail.trim()) { setError('Enter your email address.'); return; }
    setLoading(true); setError(''); setSuccess('');
    const { error: err } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
      redirectTo: window.location.origin,
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setSuccess('Password reset email sent! Check your inbox.');
  };

  const Btn = ({ onClick, children, variant = 'primary', disabled = false }: any) => {
    const styles: Record<string, React.CSSProperties> = {
      primary: { background: N, color: W, border: 'none' },
      gold: { background: G, color: N, border: 'none' },
      ghost: { background: 'transparent', color: N, border: `1px solid ${BR}` },
    };
    return (
      <button
        onClick={onClick}
        disabled={disabled || loading}
        style={{
          width: '100%',
          padding: '11px 16px',
          borderRadius: 9,
          fontSize: 14,
          fontWeight: 600,
          cursor: disabled || loading ? 'not-allowed' : 'pointer',
          opacity: disabled || loading ? 0.7 : 1,
          fontFamily: 'inherit',
          transition: 'opacity 0.15s',
          ...styles[variant],
        }}
      >
        {loading ? '...' : children}
      </button>
    );
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(145deg, ${N} 0%, #112347 60%, #0e1d3a 100%)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo / Brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: `linear-gradient(135deg, ${G} 0%, #a87d32 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 30, margin: '0 auto 14px', boxShadow: '0 8px 24px rgba(201,168,76,0.3)',
          }}>⛪</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: W, marginBottom: 4 }}>ChurchOS</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>Church Management Platform</div>
        </div>

        {/* Card */}
        <div style={{
          background: W, borderRadius: 16, padding: '28px 28px 24px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
        }}>

          {/* Tab switcher — only for login/register */}
          {mode !== 'forgot' && (
            <div style={{
              display: 'flex', marginBottom: 24,
              background: BG, borderRadius: 10, padding: 3,
            }}>
              {(['login', 'register'] as AuthMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(''); setSuccess(''); }}
                  style={{
                    flex: 1, padding: '8px 12px', border: 'none', borderRadius: 8,
                    fontSize: 13, fontWeight: mode === m ? 600 : 400,
                    color: mode === m ? N : MU,
                    background: mode === m ? W : 'transparent',
                    cursor: 'pointer',
                    boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                    fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}
                >
                  {m === 'login' ? 'Sign In' : 'New Church'}
                </button>
              ))}
            </div>
          )}

          {/* Error / Success banner */}
          {error && (
            <div style={{ background: '#fee2e2', border: `1px solid #fca5a5`, borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: RE }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ background: '#dcfce7', border: `1px solid #86efac`, borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: GR }}>
              {success}
            </div>
          )}

          {/* LOGIN */}
          {mode === 'login' && (
            <div>
              <Field label="Email">
                <Input type="email" value={loginEmail} onChange={setLoginEmail} placeholder="pastor@church.org" autoComplete="email" />
              </Field>
              <Field label="Password">
                <Input type="password" value={loginPassword} onChange={setLoginPassword} placeholder="••••••••" autoComplete="current-password" />
              </Field>
              <div style={{ marginBottom: 18 }}>
                <button
                  onClick={() => { setMode('forgot'); setError(''); setSuccess(''); }}
                  style={{ background: 'none', border: 'none', color: N, fontSize: 12, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                >
                  Forgot password?
                </button>
              </div>
              <Btn onClick={handleLogin}>Sign In to Your Church</Btn>
            </div>
          )}

          {/* REGISTER */}
          {mode === 'register' && (
            <div>
              <Field label="Church Name">
                <Input value={churchName} onChange={setChurchName} placeholder="New Testament Church" />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="First Name">
                  <Input value={adminFirst} onChange={setAdminFirst} placeholder="John" autoComplete="given-name" />
                </Field>
                <Field label="Last Name">
                  <Input value={adminLast} onChange={setAdminLast} placeholder="Smith" autoComplete="family-name" />
                </Field>
              </div>
              <Field label="Email">
                <Input type="email" value={regEmail} onChange={setRegEmail} placeholder="pastor@church.org" autoComplete="email" />
              </Field>
              <Field label="Password">
                <Input type="password" value={regPassword} onChange={setRegPassword} placeholder="Min. 8 characters" autoComplete="new-password" />
              </Field>
              <Field label="Confirm Password">
                <Input type="password" value={regPassword2} onChange={setRegPassword2} placeholder="Repeat password" autoComplete="new-password" />
              </Field>
              <Btn onClick={handleRegister} variant="gold">Create Church Account</Btn>
              <div style={{ fontSize: 11, color: MU, textAlign: 'center', marginTop: 12, lineHeight: 1.5 }}>
                By registering you agree to our Terms of Service and Privacy Policy.
              </div>
            </div>
          )}

          {/* FORGOT PASSWORD */}
          {mode === 'forgot' && (
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: N, marginBottom: 6 }}>Reset Password</div>
              <div style={{ fontSize: 13, color: MU, marginBottom: 18 }}>
                Enter your email and we'll send you a reset link.
              </div>
              <Field label="Email">
                <Input type="email" value={forgotEmail} onChange={setForgotEmail} placeholder="pastor@church.org" autoComplete="email" />
              </Field>
              <Btn onClick={handleForgot}>Send Reset Link</Btn>
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <button
                  onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                  style={{ background: 'none', border: 'none', color: N, fontSize: 12, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}
                >
                  Back to Sign In
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
          © {new Date().getFullYear()} ChurchOS · Secure · Multi-Church
        </div>
      </div>
    </div>
  );
}
