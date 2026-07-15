import { useRef, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../lib/api';

function WelcomeDashboard() {
  return (
    <div className="welcome-dashboard" id="welcomeDashboard">
      <div className="welcome-icon"><i className="fa-solid fa-stethoscope" /></div>
      <h3>Start Clinical Simulation</h3>
      <p>Select an ongoing case file from the sidebar history or launch a new random patient simulation to practice clinical history taking, diagnosis, and patient communication.</p>
      <div className="clinical-objectives-list">
        <div className="objective-item">
          <i className="fa-solid fa-chevron-right" />
          <span>Introduce yourself to the patient to begin the interview.</span>
        </div>
        <div className="objective-item">
          <i className="fa-solid fa-chevron-right" />
          <span>Investigate chief complaints, symptoms, timeline, and history.</span>
        </div>
        <div className="objective-item">
          <i className="fa-solid fa-chevron-right" />
          <span>Offer a final diagnosis &amp; treatment plan to enter the evaluation phase.</span>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  const label = isUser ? '👤 You' : '🤕 Patient';
  const timeLabel = msg.timestamp
    ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Just now';
  const metaText = isUser ? `👤 You • ${timeLabel}` : (msg.streaming ? '🤕 Patient is thinking...' : `🤕 Patient • ${timeLabel}`);

  return (
    <div className={`transcript-row ${isUser ? 'clinician' : 'patient'}`}>
      <div className="speaker-tag">{label}</div>
      <div className="transcript-bubble">
        {msg.content.includes('<a ') ? (
          <span dangerouslySetInnerHTML={{ __html: msg.content }} />
        ) : (
          <span>{msg.content}</span>
        )}
        <span className="bubble-meta">{metaText}</span>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="transcript-row patient">
      <div className="speaker-tag">🤕 Patient</div>
      <div className="typing-loader">
        <span>Patient is thinking</span>
        <div className="typing-dots">
          <span /><span /><span />
        </div>
      </div>
    </div>
  );
}

export default function ConsultationRoom() {
  const {
    activePatientName, activePatientId, messages, isLoading,
    inputEnabled, sendMessage, accessToken, showToast,
  } = useApp();

  const [input, setInput] = useState('');
  const messagesRef = useRef(null);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = () => {
    if (!input.trim() || !inputEnabled) return;
    sendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDownloadReport = async () => {
    if (!activePatientId || !accessToken) return;
    showToast('Generating PDF report...');
    try {
      const data = await api.generateReport(accessToken, activePatientId);
      if (data.download_url) {
        window.open(data.download_url, '_blank');
      } else {
        showToast('Report generation failed.', true);
      }
    } catch {
      showToast('Report generation failed.', true);
    }
  };

  const headerName = activePatientName ? `Patient Case File: ${activePatientName}` : 'Select Case File';
  const headerStatus = activePatientId
    ? '<i class="fa-solid fa-heartbeat" style="color:var(--primary)"></i> Interview In Progress'
    : '<i class="fa-solid fa-info-circle"></i> Waiting for simulator initialization';

  return (
    <main className="consultation-room">
      <header className="consultation-header">
        <div className="header-case-info">
          <h2 id="patientHeaderName">{headerName}</h2>
          <p id="patientHeaderStatus" dangerouslySetInnerHTML={{ __html: headerStatus }} />
        </div>
        <div className="header-right-meta" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span className="case-badge"><i className="fa-solid fa-robot" /> AI OSCE Simulator</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', opacity: 0.85, fontWeight: 500 }}>
            Developer: Muhammad Umair Ashraf
          </span>
        </div>
      </header>

      <div className="transcript-container" id="messagesContainer" ref={messagesRef}>
        {messages.length === 0 && !isLoading ? (
          <WelcomeDashboard />
        ) : (
          <>
            {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
            {isLoading && <TypingIndicator />}
          </>
        )}
      </div>

      <footer className="consultation-footer">
        <div className="clinical-input-container">
          <input
            type="text"
            className="clinical-input"
            id="chatInput"
            placeholder="Interview the patient..."
            disabled={!inputEnabled}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {activePatientId && (
            <button
              id="downloadReportBtn"
              className="btn-send-inquiry"
              title="Download PDF Report"
              style={{ background: 'linear-gradient(135deg, #a855f7, #e91eae)', marginRight: 8 }}
              onClick={handleDownloadReport}
            >
              <i className="fa-solid fa-file-pdf" />
            </button>
          )}
          <button
            className="btn-send-inquiry"
            id="sendBtn"
            title="Send Inquiry"
            disabled={!inputEnabled || !input.trim()}
            onClick={handleSend}
          >
            <i className="fa-solid fa-paper-plane" />
          </button>
        </div>
      </footer>
    </main>
  );
}
