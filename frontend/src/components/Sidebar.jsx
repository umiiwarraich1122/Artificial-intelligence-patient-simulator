import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../lib/api';

function PatientCard({ patient, isActive, onSelect }) {
  const { accessToken, loadConversations, showToast } = useApp();
  const [confirming, setConfirming] = useState(false);

  const handleDelete = async (e) => {
    e.stopPropagation();
    try {
      const ok = await api.deletePatient(accessToken, patient.id);
      if (ok) {
        showToast(`Patient "${patient.name}" deleted.`);
        loadConversations();
      } else {
        showToast('Failed to delete patient.', true);
      }
    } catch {
      showToast('Failed to delete patient.', true);
    }
  };

  const date = new Date(patient.created_at || new Date());
  const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className={`history-card${isActive ? ' active' : ''}`}
      onClick={() => !confirming && onSelect(patient.id)}
      style={{ cursor: 'pointer', position: 'relative' }}
    >
      <div className="history-info">
        {confirming ? (
          <div className="delete-confirm-container">
            <span className="delete-confirm-title">
              <i className="fa-solid fa-triangle-exclamation" /> Delete Patient?
            </span>
            <div className="delete-confirm-btns">
              <button
                className="confirm-yes-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(e);
                }}
              >
                Delete
              </button>
              <button
                className="confirm-no-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirming(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="history-title-row">
              <span className="history-title">
                <i className="fa-solid fa-folder-open" style={{ color: isActive ? 'white' : 'var(--primary)', marginRight: 6 }} />
                {patient.name}
              </span>
              <div className="history-actions-row">
                <button
                  className="delete-session-btn"
                  title="Delete Patient Project"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirming(true);
                  }}
                >
                  <i className="fa-solid fa-trash-can" />
                </button>
              </div>
            </div>
            <div className="history-summary">
              Patient Case Project initialized. Click to workspace.
            </div>
            <div className="history-meta-row">
              <div className="history-time-group">
                <span>{dateStr}</span>
                <span>•</span>
                <span>{timeStr}</span>
              </div>
              <div className={`history-status-badge ${isActive ? 'status-active' : 'status-in_progress'}`}>
                {isActive ? 'Active' : 'Project'}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Sidebar() {
  const {
    allPatients,
    sidebarLoading,
    createNewPatient,
    theme,
    toggleTheme,
    logout,
    resetChat,
    user,
    activePatientId,
    selectPatient,
  } = useApp();

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [mobileOpen, setMobileOpen] = useState(false);

  const fullName = user?.user_metadata?.full_name || user?.email || 'Clinician';
  const displayName = fullName.startsWith('Dr.') ? fullName : `Dr. ${fullName}`;

  // Filter & sort patients
  const filtered = allPatients
    .filter((p) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortBy === 'recent') {
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }
      return new Date(a.created_at || 0) - new Date(b.created_at || 0);
    });

  return (
    <>
      {/* Mobile header */}
      <div className="mobile-nav-header">
        <button className="mobile-toggle-btn" onClick={() => setMobileOpen(true)}>
          <i className="fa-solid fa-bars" />
        </button>
        <div className="mobile-header-title">AI Patient Workspace</div>
        <button className="mobile-toggle-btn" onClick={() => setMobileOpen(true)}>
          <i className="fa-solid fa-address-card" />
        </button>
      </div>

      {/* Overlay */}
      {mobileOpen && <div className="mobile-drawer-overlay active" onClick={() => setMobileOpen(false)} />}

      <aside className={`case-sidebar${mobileOpen ? ' mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-icon">
            <i className="fa-solid fa-brain" />
          </div>
          <div className="logo-text">
            <h1>AI Patient Clinic</h1>
            <span>OSCE Projects</span>
          </div>
          <button className="mobile-drawer-close" onClick={() => setMobileOpen(false)}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <button className="btn-new-simulation" onClick={createNewPatient}>
          <i className="fa-solid fa-plus" /> New Patient
        </button>

        <div className="section-title">
          <i className="fa-solid fa-folder-tree" /> Patient Projects
        </div>

        <div className="search-sort-container">
          <div className="sidebar-search-box">
            <i className="fa-solid fa-magnifying-glass" />
            <input
              type="text"
              placeholder="Search patients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="sidebar-sort-box">
            <select className="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="recent">Sort: Recent</option>
              <option value="newest">Sort: Newest</option>
            </select>
          </div>
        </div>

        <div className="history-container">
          <div className="history-list" id="historyList">
            {sidebarLoading && filtered.length === 0 ? (
              <div className="history-empty" style={{ display: 'block' }}>
                <i className="fa-solid fa-spinner fa-spin" /> Loading patients...
              </div>
            ) : filtered.length === 0 ? (
              <div className="history-empty" style={{ display: 'block' }}>
                No patient projects found. Create a new patient to begin.
              </div>
            ) : (
              filtered.map((p) => (
                <PatientCard
                  key={p.id}
                  patient={p}
                  isActive={activePatientId === p.id}
                  onSelect={(id) => {
                    selectPatient(id);
                    setMobileOpen(false);
                  }}
                />
              ))
            )}
          </div>
        </div>

        <div className="sidebar-footer">
          {user && (
            <div
              className="user-profile-badge"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: 10,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--glass-border)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'var(--gradient-pink)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 700,
                }}
              >
                <i className="fa-solid fa-user-md" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, width: '100%' }}>
                <span
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: 'var(--text-main)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {displayName}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {user?.user_metadata?.role || 'Medical Student'}
                </span>
              </div>
            </div>
          )}
          <button className="btn-action-outline" onClick={toggleTheme}>
            <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`} /> {theme === 'dark' ? 'Light' : 'Dark'} Mode
          </button>
          <button className="btn-action-outline" style={{ marginTop: 8 }} onClick={resetChat}>
            <i className="fa-solid fa-arrow-rotate-left" /> Reset consultation
          </button>
          <button
            className="btn-action-outline"
            style={{ marginTop: 8, color: '#ef4444', borderColor: 'rgba(239,68,68,0.15)' }}
            onClick={logout}
          >
            <i className="fa-solid fa-sign-out-alt" /> Clinician Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
