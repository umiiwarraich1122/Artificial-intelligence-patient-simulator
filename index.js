import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const getBackendBase = () => {
    if (window.location.port === "5500") {
        return "http://127.0.0.1:8000";
    }
    return window.location.origin;
};
const BASE_BACKEND = getBackendBase();

const API_URL = `${BASE_BACKEND}/chat`;
const SAVE_URL = `${BASE_BACKEND}/chat/save`;
const HISTORY_URL = `${BASE_BACKEND}/chat/history`;
const CONVERSATIONS_URL = `${BASE_BACKEND}/chat/conversations`;

const messagesContainer = document.getElementById('messagesContainer');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const resetBtn = document.getElementById('resetBtn');
const logoutBtn = document.getElementById('logoutBtn');
const newSimulationBtn = document.getElementById('newSimulationBtn');
const historyList = document.getElementById('historyList');
const welcomeDashboard = document.getElementById('welcomeDashboard');
const clinicalNotes = document.getElementById('clinicalNotes');
const notesSaveTime = document.getElementById('notesSaveTime');

// Supabase Initialization
const supabase = createClient(
    "https://lwpblqvieqvfkvrbvtwi.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3cGJscXZpZXF2Zmt2cmJ2dHdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2NTQwMDUsImV4cCI6MjA5OTIzMDAwNX0.gTgjavi7n_LuP7bFvDDMoOcwCiYNReAET9IOZMc_8jg"
);

let currentConversationId = null;
let accessToken = null;

// Theme switching management logic
window.toggleTheme = function() {
    document.body.classList.toggle("light-theme");
    const themeIcon = document.getElementById("themeIcon");
    const themeToggleBtn = document.getElementById("themeToggleBtn");
    const isLight = document.body.classList.contains("light-theme");
    
    if (isLight) {
        if (themeIcon) themeIcon.className = "fa-solid fa-moon";
        if (themeToggleBtn) themeToggleBtn.innerHTML = '<i class="fa-solid fa-moon" id="themeIcon"></i> Light';
        localStorage.setItem("theme", "light");
    } else {
        if (themeIcon) themeIcon.className = "fa-solid fa-sun";
        if (themeToggleBtn) themeToggleBtn.innerHTML = '<i class="fa-solid fa-sun" id="themeIcon"></i> Dark';
        localStorage.setItem("theme", "dark");
    }
};

function restoreTheme() {
    const savedTheme = localStorage.getItem("theme");
    const themeIcon = document.getElementById("themeIcon");
    const themeToggleBtn = document.getElementById("themeToggleBtn");
    if (savedTheme === "light") {
        document.body.classList.add("light-theme");
        if (themeIcon) themeIcon.className = "fa-solid fa-moon";
        if (themeToggleBtn) themeToggleBtn.innerHTML = '<i class="fa-solid fa-moon" id="themeIcon"></i> Light';
    } else {
        if (themeIcon) themeIcon.className = "fa-solid fa-sun";
        if (themeToggleBtn) themeToggleBtn.innerHTML = '<i class="fa-solid fa-sun" id="themeIcon"></i> Dark';
    }
}

// Initialize Authentication (with Google OAuth delay race condition fix)
async function initializeAuth() {
    // ⚠️ Google OAuth Fix: If hash tokens are in the URL, await 500ms for Supabase client to parse them
    if (window.location.hash && window.location.hash.includes("access_token")) {
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    const { data, error } = await supabase.auth.getSession();
    if (error || !data || !data.session) {
        if (window.location.port === "5500" || window.location.pathname.includes("index.html")) {
            window.location.replace("signup.html");
        } else {
            window.location.replace("/");
        }
        return;
    }
    accessToken = data.session.access_token;
    
    // Show body after authentication succeeds
    document.body.style.display = "flex";
    
    // Load saved notes if any
    loadLocalNotes();
}

// Add transcript bubble
function addMessage(role, content, timestampText = '') {
    // Remove welcome screen if present
    const welcome = document.getElementById('welcomeDashboard');
    if (welcome) welcome.remove();

    const row = document.createElement('div');
    row.className = `transcript-row ${role === 'user' ? 'clinician' : 'patient'}`;

    const speaker = document.createElement('div');
    speaker.className = 'speaker-tag';
    speaker.textContent = role === 'user' ? '👤 You' : '🤕 Patient';

    const bubble = document.createElement('div');
    bubble.className = 'transcript-bubble';
    bubble.innerHTML = `${content} <span class="bubble-meta">${timestampText}</span>`;

    row.appendChild(speaker);
    row.appendChild(bubble);
    messagesContainer.appendChild(row);

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Set input fields loading state (Analyzing symptoms...)
function setLoading(isLoading) {
    chatInput.disabled = isLoading;
    sendBtn.disabled = isLoading;
    sendBtn.style.opacity = isLoading ? '0.7' : '1';

    if (isLoading) {
        const loadingRow = document.createElement('div');
        loadingRow.className = 'transcript-row patient';
        loadingRow.id = 'typingRow';
        loadingRow.innerHTML = `
            <div class="speaker-tag">🤕 Patient</div>
            <div class="typing-loader" id="typingIndicator">
                <span>Patient is thinking</span>
                <div class="typing-dots">
                    <span></span><span></span><span></span>
                </div>
            </div>`;
        messagesContainer.appendChild(loadingRow);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } else {
        const typingRow = document.getElementById('typingRow');
        if (typingRow) typingRow.remove();
    }
}

// Initialize vitals values dynamically based on patient simulation
function randomizeVitals() {
    // Set slight variations to make them look alive
    const hrVal = Math.floor(Math.random() * 25) + 70;
    const bpSys = Math.floor(Math.random() * 30) + 110;
    const bpDia = Math.floor(Math.random() * 15) + 75;
    const tempVal = (Math.random() * 2 + 97.8).toFixed(1);
    const respVal = Math.floor(Math.random() * 6) + 12;

    document.getElementById('vitalHeart').textContent = `${hrVal} BPM`;
    document.getElementById('vitalBP').textContent = `${bpSys}/${bpDia} mmHg`;
    document.getElementById('vitalTemp').textContent = `${tempVal} °F`;
    document.getElementById('vitalResp').textContent = `${respVal} / min`;
}

function clearVitals() {
    document.getElementById('vitalHeart').textContent = `-- BPM`;
    document.getElementById('vitalBP').textContent = `-- mmHg`;
    document.getElementById('vitalTemp').textContent = `-- °F`;
    document.getElementById('vitalResp').textContent = `-- / min`;
}

function createConversationId() {
    return crypto.randomUUID();
}

// Save session exchange and trigger sidebar refresh
async function saveConversation(message, reply) {
    if (!accessToken) return;
    if (!currentConversationId) {
        currentConversationId = createConversationId();
    }

    try {
        const payload = {
            conversation_id: currentConversationId,
            user_message: message,
            ai_message: reply
        };

        const response = await fetch(SAVE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            console.error('Save failed:', response.status, errBody.detail || errBody);
        }
    } catch (error) {
        console.error('Could not save conversation:', error);
    }
}

// Retrieve and load transcript for a historic conversation session
async function loadConversationHistory(conversationId, summaryTitle = 'Active Case File') {
    if (!accessToken) return;
    
    // Auto close mobile drawers if open
    if (typeof closeAllDrawers === 'function') {
        closeAllDrawers();
    }

    currentConversationId = conversationId;
    messagesContainer.innerHTML = '';
    
    // Set header info
    document.getElementById('patientHeaderName').textContent = summaryTitle;
    document.getElementById('patientHeaderStatus').innerHTML = '<i class="fa-solid fa-stethoscope"></i> Loaded from Case Logs';
    
    // Enable inputs
    chatInput.disabled = false;
    sendBtn.disabled = false;
    chatInput.placeholder = "Interview the patient...";
    
    randomizeVitals();

    // Set active class in sidebar
    document.querySelectorAll('.history-card').forEach(card => {
        card.classList.remove('active');
        if (card.dataset.id === conversationId) {
            card.classList.add('active');
        }
    });

    try {
        setLoading(true);
        const response = await fetch(`${HISTORY_URL}/${conversationId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const data = await response.json();
        setLoading(false);
        
        if (response.ok && data.messages) {
            const filteredMessages = data.messages.filter(msg => !msg.content.startsWith("__SUMMARY_JSON__"));
            
            if (filteredMessages.length === 0) {
                addMessage('assistant', 'Consultation transcript is empty.', 'System • info');
            }
            
            filteredMessages.forEach(msg => {
                const sender = msg.sender === 'user' ? 'user' : 'assistant';
                const nameLabel = msg.sender === 'user' ? 'You' : 'Patient';
                addMessage(sender, msg.content, `${msg.sender === 'user' ? '👤' : '🤕'} ${nameLabel} • ${new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
            });
        } else {
            showToast("Could not load simulation logs.", true);
        }
    } catch (error) {
        setLoading(false);
        console.error('History load error:', error);
        showToast("Connection to server failed.", true);
    }
}

let allConversations = [];

// Load side history bar listing all previous sessions with case summaries
async function loadConversations() {
    if (!accessToken) return;
    try {
        const response = await fetch(CONVERSATIONS_URL, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const data = await response.json();
        
        if (response.ok && data.conversations) {
            allConversations = data.conversations;
        } else {
            allConversations = [];
        }
        filterAndRenderHistory();
    } catch (error) {
        console.error('Could not load conversations:', error);
        document.getElementById('historyEmpty').textContent = 'Error connecting to medical database.';
        document.getElementById('historyEmpty').style.display = 'block';
    }
}

// Filters, sorts, and renders the case history list dynamically
function filterAndRenderHistory() {
    const historyList = document.getElementById('historyList');
    const historyEmpty = document.getElementById('historyEmpty');
    historyList.innerHTML = '';

    const searchQuery = document.getElementById('sidebarSearch').value.toLowerCase().trim();
    const sortBy = document.getElementById('sidebarSort').value;

    // First parse the summaries as JSON or fallback
    allConversations.forEach(conv => {
        let metadata = {
            title: "New Consultation",
            summary: "Initial intake discussion.",
            pinned: false,
            custom_title: null,
            status: "In Progress"
        };
        
        if (conv.summary && conv.summary.startsWith("{")) {
            try {
                metadata = JSON.parse(conv.summary);
            } catch (e) {}
        } else if (conv.summary) {
            metadata.title = conv.summary;
        }
        conv.parsed = metadata;
    });

    // Filter by search query (checks Title and Summary)
    let filtered = allConversations.filter(conv => {
        const metadata = conv.parsed;
        const title = (metadata.custom_title || metadata.title || "").toLowerCase();
        const summary = (metadata.summary || "").toLowerCase();
        return title.includes(searchQuery) || summary.includes(searchQuery);
    });

    // If there's an active unsaved simulation session, prepend it to the filtered list
    if (currentConversationId && !allConversations.some(c => c.id === currentConversationId)) {
        const activeTemp = {
            id: currentConversationId,
            created_at: new Date().toISOString(),
            last_updated: new Date().toISOString(),
            message_count: 0,
            duration_mins: 0,
            summary: "New Consultation",
            parsed: {
                title: "New Consultation",
                summary: "Initial intake discussion.",
                pinned: false,
                custom_title: null,
                status: "Active"
            }
        };
        
        const title = activeTemp.parsed.title.toLowerCase();
        const summary = activeTemp.parsed.summary.toLowerCase();
        if (title.includes(searchQuery) || summary.includes(searchQuery)) {
            filtered.unshift(activeTemp);
        }
    }

    // Sort (pinned items float to top, followed by sort choice)
    filtered.sort((a, b) => {
        const metaA = a.parsed;
        const metaB = b.parsed;

        if (metaA.pinned && !metaB.pinned) return -1;
        if (!metaA.pinned && metaB.pinned) return 1;

        if (sortBy === "recent") {
            const dateA = new Date(a.last_updated || a.created_at);
            const dateB = new Date(b.last_updated || b.created_at);
            return dateB - dateA;
        } else {
            const dateA = new Date(a.created_at);
            const dateB = new Date(b.created_at);
            return dateB - dateA;
        }
    });

    if (filtered.length === 0) {
        historyEmpty.style.display = 'block';
        return;
    }

    historyEmpty.style.display = 'none';

    filtered.forEach(conv => {
        const metadata = conv.parsed;
        const displayTitle = metadata.custom_title || metadata.title || "New Consultation";
        const displaySummary = metadata.summary || "Initial intake discussion.";
        
        const dateObj = new Date(conv.created_at);
        const formattedDate = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const card = document.createElement('div');
        card.className = `history-card ${currentConversationId === conv.id ? 'active' : ''}`;
        card.dataset.id = conv.id;

        // Setup hovering statistics popup
        const lastUpdatedText = formatRelativeTime(conv.last_updated || conv.created_at);
        const durationText = conv.duration_mins > 0 ? `${conv.duration_mins} min` : "1 min";
        
        const hoverStats = document.createElement('div');
        hoverStats.className = 'history-card-hover-stats';
        hoverStats.innerHTML = `
            <div class="hover-stat-item">
                <span class="label">Message Count</span>
                <span class="value">${conv.message_count || 0} messages</span>
            </div>
            <div class="hover-stat-item">
                <span class="label">Last Updated</span>
                <span class="value">${lastUpdatedText}</span>
            </div>
            <div class="hover-stat-item">
                <span class="label">Duration</span>
                <span class="value">${durationText}</span>
            </div>
        `;
        card.appendChild(hoverStats);

        // Card Info
        const info = document.createElement('div');
        info.className = 'history-info';
        
        // Title Row
        const titleRow = document.createElement('div');
        titleRow.className = 'history-title-row';
        
        const titleSpan = document.createElement('span');
        titleSpan.className = 'history-title';
        titleSpan.id = `title-${conv.id}`;
        titleSpan.innerHTML = `<i class="fa-solid fa-stethoscope"></i> ${displayTitle}`;
        
        // Actions (Pin, Rename, Delete)
        const actionsRow = document.createElement('div');
        actionsRow.className = 'history-actions-row';

        const pinBtn = document.createElement('button');
        pinBtn.className = `pin-btn ${metadata.pinned ? 'pinned' : ''}`;
        pinBtn.innerHTML = '<i class="fa-solid fa-thumbtack"></i>';
        pinBtn.title = metadata.pinned ? 'Unpin Session' : 'Pin Session';
        pinBtn.addEventListener('click', (e) => togglePin(e, conv.id, metadata.pinned));
        actionsRow.appendChild(pinBtn);

        const editBtn = document.createElement('button');
        editBtn.className = 'edit-title-btn';
        editBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>';
        editBtn.title = 'Rename Session';
        editBtn.addEventListener('click', (e) => startRename(e, conv.id, displayTitle));
        actionsRow.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-session-btn';
        deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
        deleteBtn.title = 'Delete Session';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            if (card.dataset.confirming === "true") return;
            card.dataset.confirming = "true";
            
            // Show inline confirmation content inside the card info area
            info.innerHTML = `
                <div class="delete-confirm-container" style="display:flex; flex-direction:column; gap:8px; width:100%; animation:fadeIn 0.2s ease;">
                    <span style="font-size:0.8rem; font-weight:600; color:#ef4444; display:flex; align-items:center; gap:6px;">
                        <i class="fa-solid fa-triangle-exclamation"></i> Permanently delete?
                    </span>
                    <div style="display:flex; gap:10px; justify-content:flex-end;">
                        <button class="confirm-yes-btn" style="background:#ef4444; border:none; color:white; font-size:0.75rem; font-weight:700; padding:4px 12px; border-radius:6px; cursor:pointer; transition: all 0.2s ease;">Delete</button>
                        <button class="confirm-no-btn" style="background:rgba(255,255,255,0.08); border:1px solid var(--glass-border); color:var(--text-main); font-size:0.75rem; font-weight:700; padding:4px 12px; border-radius:6px; cursor:pointer; transition: all 0.2s ease;">Cancel</button>
                    </div>
                </div>
            `;
            
            info.querySelector('.confirm-yes-btn').addEventListener('click', async (evt) => {
                evt.stopPropagation();
                try {
                    const response = await fetch(`${BASE_BACKEND}/chat/conversation/${conv.id}`, {
                        method: "DELETE",
                        headers: {
                            "Authorization": `Bearer ${accessToken}`
                        }
                    });

                    if (response.ok) {
                        showToast("Session file deleted.");
                        if (currentConversationId === conv.id) {
                            resetChat();
                        }
                        loadConversations();
                    } else {
                        showToast("Failed to delete session.", true);
                    }
                } catch (err) {
                    console.error(err);
                    showToast("Error deleting session file.", true);
                }
            });
            
            info.querySelector('.confirm-no-btn').addEventListener('click', (evt) => {
                evt.stopPropagation();
                // Re-render the list to cancel the state
                filterAndRenderHistory();
            });
        });
        actionsRow.appendChild(deleteBtn);

        titleRow.appendChild(titleSpan);
        titleRow.appendChild(actionsRow);

        // Summary string
        const summarySpan = document.createElement('div');
        summarySpan.className = 'history-summary';
        summarySpan.textContent = displaySummary;

        // Meta Row with badges
        const metaRow = document.createElement('div');
        metaRow.className = 'history-meta-row';
        
        const timeGroup = document.createElement('div');
        timeGroup.className = 'history-time-group';
        timeGroup.innerHTML = `<span>${formattedDate}</span><span>•</span><span>${formattedTime}</span>`;
        
        const statusBadge = document.createElement('div');
        let badgeClass = 'status-in_progress';
        let displayStatus = 'In Progress';
        let statusVal = metadata.status || 'In Progress';
        
        if (currentConversationId === conv.id) {
            badgeClass = 'status-active';
            displayStatus = 'Active';
        } else if (statusVal === 'Completed') {
            badgeClass = 'status-completed';
            displayStatus = 'Completed';
        }
        
        statusBadge.className = `history-status-badge ${badgeClass}`;
        statusBadge.innerHTML = displayStatus === 'Active' 
            ? `<i class="fa-solid fa-circle-play"></i> Active` 
            : (displayStatus === 'Completed' ? `<i class="fa-solid fa-circle-check"></i> Completed` : `<i class="fa-solid fa-circle-half-stroke"></i> In Progress`);
        
        statusBadge.title = "Click to toggle Status";
        statusBadge.addEventListener('click', (e) => {
            if (displayStatus === 'Active') return;
            toggleStatus(e, conv.id, statusVal);
        });

        metaRow.appendChild(timeGroup);
        metaRow.appendChild(statusBadge);

        info.appendChild(titleRow);
        info.appendChild(summarySpan);
        info.appendChild(metaRow);

        card.appendChild(info);
        
        card.addEventListener('click', () => {
            loadConversationHistory(conv.id, displayTitle);
            if (window.innerWidth <= 1024) closeAllDrawers();
        });

        historyList.appendChild(card);
    });
}

// Format relative time helper
function formatRelativeTime(dateTimeStr) {
    if (!dateTimeStr) return "N/A";
    const date = new Date(dateTimeStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

// Inline renaming editor
function startRename(e, conversationId, currentText) {
    e.stopPropagation();
    const titleEl = document.getElementById(`title-${conversationId}`);
    if (!titleEl) return;
    
    const input = document.createElement("input");
    input.type = "text";
    input.className = "rename-input";
    input.value = currentText;
    
    let finished = false;
    const saveRename = async () => {
        if (finished) return;
        finished = true;
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== currentText) {
            await updateConversationMetadata(conversationId, { custom_title: newTitle });
        }
        loadConversations();
    };
    
    input.addEventListener("keydown", (evt) => {
        if (evt.key === "Enter") {
            evt.preventDefault();
            saveRename();
        } else if (evt.key === "Escape") {
            finished = true;
            loadConversations();
        }
    });
    
    input.addEventListener("blur", saveRename);
    
    titleEl.innerHTML = "";
    titleEl.appendChild(input);
    input.focus();
    input.select();
}

// Toggle Pinned status
async function togglePin(e, conversationId, currentPinned) {
    e.stopPropagation();
    await updateConversationMetadata(conversationId, { pinned: !currentPinned });
    loadConversations();
}

// Toggle Status Completed / In Progress
async function toggleStatus(e, conversationId, currentStatus) {
    e.stopPropagation();
    const nextStatus = currentStatus === "Completed" ? "In Progress" : "Completed";
    await updateConversationMetadata(conversationId, { status: nextStatus });
    loadConversations();
}

// Helper to update metadata in the backend
async function updateConversationMetadata(conversationId, fields) {
    if (!accessToken) return;
    try {
        const response = await fetch(`${BASE_BACKEND}/chat/summary/update`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                conversation_id: conversationId,
                ...fields
            })
        });
        
        if (!response.ok) {
            showToast("Failed to update case file.", true);
        }
    } catch (err) {
        console.error(err);
        showToast("Connection to server failed.", true);
    }
}

// Submit clinician inquiry to backend LLM and process stream response
async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    if (!accessToken) {
        showToast("Please sign in to proceed.", true);
        return;
    }

    const welcome = document.getElementById('welcomeDashboard');
    if (welcome) welcome.remove();

    addMessage("user", message, "👤 You • Just now");
    chatInput.value = "";
    setLoading(true);

    try {
        const payload = {
            message: message,
            conversation_id: currentConversationId
        };

        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${accessToken}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error("API Failure");
        }

        setLoading(false);

        // Build transcript bubble row for AI Assistant
        const row = document.createElement("div");
        row.className = "transcript-row patient";

        const speaker = document.createElement("div");
        speaker.className = "speaker-tag";
        speaker.textContent = "🤕 Patient";

        const bubble = document.createElement("div");
        bubble.className = "transcript-bubble";

        const textSpan = document.createElement("span");
        const meta = document.createElement("span");
        meta.className = "bubble-meta";
        meta.textContent = "Patient is thinking...";

        bubble.appendChild(textSpan);
        bubble.appendChild(meta);
        row.appendChild(speaker);
        row.appendChild(bubble);
        messagesContainer.appendChild(row);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let reply = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            reply += chunk;
            textSpan.textContent = reply;

            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        meta.textContent = "🤕 Patient • Completed";

        // Save message exchange to Supabase database
        await saveConversation(message, reply);

        // Refresh sidebar with new list & summaries
        await loadConversations();
    }
    catch (error) {
        setLoading(false);
        addMessage(
            "assistant",
            "Medical simulator telemetry error. Unable to establish connection with patient model.",
            "System • Error"
        );
        console.error(error);
        showToast("Simulator communication error.", true);
    }
}

// Reset workspace to initial state
function resetChat() {
    currentConversationId = null;
    messagesContainer.innerHTML = '';
    
    // Re-render Welcome Dashboard
    const welcome = document.createElement('div');
    welcome.className = 'welcome-dashboard';
    welcome.id = 'welcomeDashboard';
    welcome.innerHTML = `
        <div class="welcome-icon">
            <i class="fa-solid fa-stethoscope"></i>
        </div>
        <h3>Start Clinical Simulation</h3>
        <p>Select an ongoing case file from the sidebar history or launch a new random patient simulation to practice clinical history taking, diagnosis, and patient communication.</p>
        <div class="clinical-objectives-list">
            <div class="objective-item">
                <i class="fa-solid fa-chevron-right"></i>
                <span>Introduce yourself to the patient to begin the interview.</span>
            </div>
            <div class="objective-item">
                <i class="fa-solid fa-chevron-right"></i>
                <span>Investigate chief complaints, symptoms, timeline, and history.</span>
            </div>
            <div class="objective-item">
                <i class="fa-solid fa-chevron-right"></i>
                <span>Offer a final diagnosis & treatment plan to enter the evaluation phase.</span>
            </div>
        </div>
    `;
    messagesContainer.appendChild(welcome);

    document.getElementById('patientHeaderName').textContent = "Select Case File";
    document.getElementById('patientHeaderStatus').innerHTML = '<i class="fa-solid fa-info-circle"></i> Waiting for simulator initialization';
    
    chatInput.disabled = true;
    sendBtn.disabled = true;
    chatInput.placeholder = "Launch a simulation session first...";
    chatInput.value = '';
    
    clearVitals();
    
    document.querySelectorAll('.history-card').forEach(card => card.classList.remove('active'));
}

// Start a brand new simulation case
function startNewSimulation() {
    resetChat();
    
    currentConversationId = createConversationId();
    
    // UI elements update
    document.getElementById('patientHeaderName').textContent = "Patient Case File: Active Case";
    document.getElementById('patientHeaderStatus').innerHTML = '<i class="fa-solid fa-heartbeat" style="color:var(--primary)"></i> Interview In Progress';
    
    chatInput.disabled = false;
    sendBtn.disabled = false;
    chatInput.placeholder = "Interview the patient...";
    chatInput.focus();
    
    randomizeVitals();
    
    const welcome = document.getElementById('welcomeDashboard');
    if (welcome) welcome.remove();

    // Notify clinician
    addMessage('assistant', 'System: Clinical simulator active. Ask the patient a question to begin.', 'System • Ready');
}

// Local Notes Management (local storage)
function loadLocalNotes() {
    const savedNotes = localStorage.getItem("clinician_notes");
    if (savedNotes) {
        clinicalNotes.value = savedNotes;
        notesSaveTime.textContent = "Saved";
    }
}

clinicalNotes.addEventListener('input', () => {
    localStorage.setItem("clinician_notes", clinicalNotes.value);
    notesSaveTime.textContent = "Saving...";
    setTimeout(() => {
        notesSaveTime.textContent = "Saved";
    }, 800);
});

// Trigger signout logic
async function clinicianSignOut() {
    if (!confirm("Are you sure you want to sign out?")) return;
    try {
        await supabase.auth.signOut();
        if (window.location.port === "5500" || window.location.pathname.includes("index.html")) {
            window.location.replace("signup.html");
        } else {
            window.location.replace("/");
        }
    } catch (err) {
        console.error(err);
        showToast("Sign out failed.", true);
    }
}

// Show toast alerts
function showToast(message, isError = false) {
    const toast = document.getElementById("toast");
    const toastMessage = document.getElementById("toastMessage");
    toastMessage.textContent = message;

    toast.className = "toast-notification show";
    if (isError) {
        toast.classList.add("error");
    } else {
        toast.classList.add("success");
    }

    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

// Event Listeners
sendBtn.addEventListener('click', sendMessage);
resetBtn.addEventListener('click', resetChat);
newSimulationBtn.addEventListener('click', () => {
    startNewSimulation();
    if (window.innerWidth <= 1024) closeAllDrawers();
});
logoutBtn.addEventListener('click', clinicianSignOut);

document.getElementById('sidebarSearch').addEventListener('input', filterAndRenderHistory);
document.getElementById('sidebarSort').addEventListener('change', filterAndRenderHistory);

chatInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
});

// Mobile Navigation drawer handlers
const mobileSidebarToggle = document.getElementById('mobileSidebarToggle');
const mobileEhrToggle = document.getElementById('mobileEhrToggle');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');
const closeEhrBtn = document.getElementById('closeEhrBtn');
const drawerOverlay = document.getElementById('drawerOverlay');

const caseSidebar = document.querySelector('.case-sidebar');
const diagnosticsHub = document.querySelector('.diagnostics-hub');

function openSidebarDrawer() {
    caseSidebar.classList.add('drawer-open');
    diagnosticsHub.classList.remove('drawer-open');
    drawerOverlay.classList.add('active');
}

function openEhrDrawer() {
    diagnosticsHub.classList.add('drawer-open');
    caseSidebar.classList.remove('drawer-open');
    drawerOverlay.classList.add('active');
}

function closeAllDrawers() {
    caseSidebar.classList.remove('drawer-open');
    diagnosticsHub.classList.remove('drawer-open');
    drawerOverlay.classList.remove('active');
}

if (mobileSidebarToggle) mobileSidebarToggle.addEventListener('click', openSidebarDrawer);
if (mobileEhrToggle) mobileEhrToggle.addEventListener('click', openEhrDrawer);
if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeAllDrawers);
if (closeEhrBtn) closeEhrBtn.addEventListener('click', closeAllDrawers);
if (drawerOverlay) drawerOverlay.addEventListener('click', closeAllDrawers);

// Bootstrap App
restoreTheme();
await initializeAuth();
await loadConversations();

// Automatically start a new simulation if none is selected
if (!currentConversationId) {
    startNewSimulation();
}
