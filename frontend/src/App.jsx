import { useApp } from './context/AppContext';
import Sidebar from './components/Sidebar';
import ConsultationRoom from './components/ConsultationRoom';
import DiagnosticsHub from './components/DiagnosticsHub';
import Toast from './components/Toast';
import Login from './components/Login';

export default function App() {
  const { session, authChecked } = useApp();

  // Show loading state while auth is being determined initially
  if (!authChecked) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', flexDirection: 'column', gap: 16,
        background: 'var(--bg-page)', color: 'var(--text-main)'
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 12, background: 'var(--gradient-pink)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', color: 'white'
        }}>
          <i className="fa-solid fa-brain" />
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Initializing AI Patient Clinic...</p>
      </div>
    );
  }

  // Render Login page if not authenticated
  if (!session) {
    return (
      <>
        <Login />
        <Toast />
      </>
    );
  }

  // Render workspace if authenticated
  return (
    <>
      {/* Background ambient blobs */}
      <div className="bg-blur-circle bg-blur-1" />
      <div className="bg-blur-circle bg-blur-2" />
      <div className="bg-blur-circle bg-blur-3" />

      <div className="workspace-container">
        <Sidebar />
        <ConsultationRoom />
        <DiagnosticsHub />
        <div id="toast" style={{ display: 'none' }} />
      </div>

      <Toast />
    </>
  );
}
