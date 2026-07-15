import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';

export default function Login() {
  const { showToast } = useApp();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('Medical Student');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      showToast('Please fill in all credentials.', true);
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        if (!fullName.trim()) {
          showToast('Please enter your full name.', true);
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
          options: {
            data: {
              full_name: fullName.trim(),
              role: role,
            },
          },
        });
        if (error) throw error;
        showToast('Registration successful! Please check your email or log in.');
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });
        if (error) throw error;
        showToast('Successfully logged in.');
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Authentication failed.', true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'var(--bg-page)',
      color: 'var(--text-main)',
      padding: 20,
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background ambient blobs to match workspace */}
      <div className="bg-blur-circle bg-blur-1" />
      <div className="bg-blur-circle bg-blur-2" />
      <div className="bg-blur-circle bg-blur-3" />

      <div style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '40px 32px',
        width: '100%',
        maxWidth: 420,
        boxShadow: 'var(--shadow-lg)',
        zIndex: 10,
        animation: 'fadeIn 0.5s ease-out'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: 'var(--gradient-pink)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.6rem',
            color: 'white',
            marginBottom: 16,
            boxShadow: '0 8px 20px rgba(233, 30, 174, 0.3)'
          }}>
            <i className="fa-solid fa-brain" />
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
            AI Patient Clinic
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
            {isSignUp ? 'Create your OSCE simulator account' : 'Sign in to access your clinician workspace'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {isSignUp && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Full Name</label>
                <input
                  type="text"
                  placeholder="Dr. John Doe"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 16px',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                  onBlur={e => e.target.style.borderColor = 'var(--glass-border)'}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Clinical Role</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 16px',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="Medical Student" style={{ background: '#1e293b' }}>Medical Student</option>
                  <option value="Resident Physician" style={{ background: '#1e293b' }}>Resident Physician</option>
                  <option value="Attending Physician" style={{ background: '#1e293b' }}>Attending Physician</option>
                  <option value="Medical Educator" style={{ background: '#1e293b' }}>Medical Educator</option>
                </select>
              </div>
            </>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Email Address</label>
            <input
              type="email"
              placeholder="name@university.edu"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--glass-border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                color: 'var(--text-main)',
                fontSize: '0.9rem',
                outline: 'none'
              }}
              onFocus={e => e.target.style.borderColor = 'var(--primary)'}
              onBlur={e => e.target.style.borderColor = 'var(--glass-border)'}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--glass-border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                color: 'var(--text-main)',
                fontSize: '0.9rem',
                outline: 'none'
              }}
              onFocus={e => e.target.style.borderColor = 'var(--primary)'}
              onBlur={e => e.target.style.borderColor = 'var(--glass-border)'}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              background: 'var(--gradient-pink)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              padding: '14px',
              color: 'white',
              fontSize: '0.95rem',
              fontWeight: 700,
              cursor: 'pointer',
              marginTop: 10,
              transition: 'transform 0.2s, opacity 0.2s',
              boxShadow: '0 4px 15px rgba(233, 30, 174, 0.2)'
            }}
            onMouseOver={e => e.target.style.opacity = '0.95'}
            onMouseOut={e => e.target.style.opacity = '1'}
          >
            {loading ? (
              <i className="fa-solid fa-circle-notch fa-spin" />
            ) : (
              isSignUp ? 'Complete Registration' : 'Sign In to Workspace'
            )}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', margin: '8px 0', gap: 10 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--glass-border)' }} />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>OR</span>
            <div style={{ flex: 1, height: 1, background: 'var(--glass-border)' }} />
          </div>

          <button
            type="button"
            onClick={async () => {
              try {
                const { error } = await supabase.auth.signInWithOAuth({
                  provider: 'google',
                  options: {
                    redirectTo: window.location.origin
                  }
                });
                if (error) throw error;
              } catch (err) {
                showToast(err.message || 'Google Auth failed.', true);
              }
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--glass-border)',
              borderRadius: 'var(--radius-md)',
              padding: '12px',
              color: 'var(--text-main)',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              transition: 'background 0.2s'
            }}
            onMouseOver={e => e.target.style.background = 'rgba(255, 255, 255, 0.1)'}
            onMouseOut={e => e.target.style.background = 'rgba(255, 255, 255, 0.06)'}
          >
            <i className="fa-brands fa-google" style={{ color: '#ea4335' }} /> Continue with Google
          </button>

          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
