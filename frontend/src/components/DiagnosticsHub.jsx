import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';

export default function DiagnosticsHub() {
  const { vitals, activePatientId, activePatientProfile } = useApp();
  const [notes, setNotes] = useState('');
  const [saveTime, setSaveTime] = useState('Draft');

  // Load notes from localStorage per patient project
  useEffect(() => {
    if (activePatientId) {
      const saved = localStorage.getItem(`notes_${activePatientId}`) || '';
      setNotes(saved);
      setSaveTime('Draft');
    }
  }, [activePatientId]);

  // Auto-save notes
  useEffect(() => {
    if (!activePatientId) return;
    const timer = setTimeout(() => {
      localStorage.setItem(`notes_${activePatientId}`, notes);
      setSaveTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 800);
    return () => clearTimeout(timer);
  }, [notes, activePatientId]);

  const profile = activePatientProfile;

  const vHeart = vitals ? `${vitals.heart_rate} BPM` : '-- BPM';
  const vBP = vitals ? `${vitals.blood_pressure} mmHg` : '-- mmHg';
  const vTemp = vitals ? `${vitals.temperature} °F` : '-- °F';
  const vResp = vitals ? `${vitals.resp_rate} / min` : '-- / min';

  return (
    <aside className="diagnostics-hub">
      {/* Patient File */}
      <div className="ehr-section">
        <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <span><i className="fa-solid fa-address-card" /> Patient File</span>
        </div>
        <div className="ehr-card" style={{ marginTop: 8 }}>
          <div className="patient-card">
            <div className="patient-avatar-frame">
              <img src="/Ionstine.jpg" alt="Patient Portrait" className="patient-avatar" id="avatarImage" />
              <div className="active-dot" />
            </div>
            <div className="patient-demographics">
              <h4 id="patientDetailsName">{profile?.name || 'Albert_Einstein'}</h4>
              <div id="patientDetailsId" style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>
                {profile ? (
                  <>
                    <strong>ID:</strong> {activePatientId?.substring(0, 8)}...<br />
                    <strong>Age/Gender:</strong> {profile.age} / {profile.gender}<br />
                    <strong>Occupation:</strong> {profile.occupation || 'N/A'}
                  </>
                ) : 'Case File: #AIP-4092'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Vitals Monitor */}
      <div className="ehr-section">
        <div className="section-title">
          <i className="fa-solid fa-heart-pulse" /> Patient Vitals Monitor
        </div>
        <div className="ehr-card" style={{ marginTop: 8 }}>
          <div className="vitals-monitor">
            <div className="vital-widget heart-rate">
              <div className="vital-icon-container"><i className="fa-solid fa-heart pulse-animated" /></div>
              <div className="vital-data">
                <span className="vital-label">Heart Rate</span>
                <span className="vital-value" id="vitalHeart">{vHeart}</span>
              </div>
            </div>
            <div className="vital-widget bp">
              <div className="vital-icon-container"><i className="fa-solid fa-gauge-high" /></div>
              <div className="vital-data">
                <span className="vital-label">Blood Pressure</span>
                <span className="vital-value" id="vitalBP">{vBP}</span>
              </div>
            </div>
            <div className="vital-widget temp">
              <div className="vital-icon-container"><i className="fa-solid fa-temperature-half" /></div>
              <div className="vital-data">
                <span className="vital-label">Temperature</span>
                <span className="vital-value" id="vitalTemp">{vTemp}</span>
              </div>
            </div>
            <div className="vital-widget resp">
              <div className="vital-icon-container"><i className="fa-solid fa-lungs" /></div>
              <div className="vital-data">
                <span className="vital-label">Resp. Rate</span>
                <span className="vital-value" id="vitalResp">{vResp}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Analysis */}
      <div className="ehr-section">
        <div className="section-title">
          <i className="fa-solid fa-wand-magic-sparkles" /> AI Analysis
        </div>
        <div className="ehr-card" style={{ marginTop: 8 }}>
          <div className="card-status-badge"><i className="fa-solid fa-robot" /> Core Engine Active</div>
          <div className="ai-metrics">
            <div className="ai-metric-item">
              <span className="metric-label">AI Confidence</span>
              <div className="metric-progress-bar">
                <div className="metric-progress-fill" style={{ width: '88%' }} />
              </div>
              <span className="metric-value">88%</span>
            </div>
            <div className="ai-metric-item" style={{ marginTop: 12 }}>
              <span className="metric-label">Diagnosis Probability</span>
              <div className="metric-progress-bar">
                <div className="metric-progress-fill" style={{ width: '74%', background: 'linear-gradient(90deg, #A855F7, #E91EAE)' }} />
              </div>
              <span className="metric-value">74%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Suggested Tests */}
      <div className="ehr-section">
        <div className="section-title">
          <i className="fa-solid fa-vial" /> Suggested Tests
        </div>
        <div className="ehr-card" style={{ marginTop: 8 }}>
          <ul className="tests-suggested-list">
            <li><i className="fa-solid fa-circle-check" /> Complete Blood Count (CBC)</li>
            <li><i className="fa-solid fa-circle-check" /> 12-Lead Electrocardiogram (ECG)</li>
            <li><i className="fa-solid fa-circle-check" /> Basic Metabolic Panel (BMP)</li>
          </ul>
        </div>
      </div>

      {/* Clinical Notes */}
      <div className="ehr-section">
        <div className="section-title">
          <i className="fa-solid fa-notes-medical" /> Clinical Notes
        </div>
        <div className="ehr-card" style={{ marginTop: 8 }}>
          <div className="notes-editor">
            <textarea
              className="notes-textarea"
              id="clinicalNotes"
              placeholder="Write clinical notes, diagnostic impressions, patient quotes, or treatment hypotheses here..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
            <div className="notes-meta">
              <span>Saves automatically</span>
              <span id="notesSaveTime">{saveTime}</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
