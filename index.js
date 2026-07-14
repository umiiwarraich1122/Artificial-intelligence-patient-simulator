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
const downloadReportBtn = document.getElementById('downloadReportBtn');
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
    
    // Display user profile card details
    const user = data.session.user;
    if (user) {
        const metadata = user.user_metadata || {};
        const fullName = metadata.full_name || user.email || "Clinician";
        const role = metadata.role || "Medical Student";
        
        const userNameText = document.getElementById("userNameText");
        const userRoleText = document.getElementById("userRoleText");
        const userProfileBadge = document.getElementById("userProfileBadge");
        
        if (userNameText) userNameText.textContent = fullName.startsWith("Dr.") ? fullName : `Dr. ${fullName}`;
        if (userRoleText) userRoleText.textContent = role;
        if (userProfileBadge) {
            userProfileBadge.style.display = "flex";
        }
    }
    
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

async function loadVitals(conversationId) {
    if (!conversationId) return;
    try {
        const response = await fetch(`${BASE_BACKEND}/chat/vitals/${conversationId}`);
        if (response.ok) {
            const vitals = await response.json();
            document.getElementById('vitalHeart').textContent = `${vitals.heart_rate} BPM`;
            document.getElementById('vitalBP').textContent = `${vitals.blood_pressure} mmHg`;
            document.getElementById('vitalTemp').textContent = `${vitals.temperature} °F`;
            document.getElementById('vitalResp').textContent = `${vitals.resp_rate} / min`;
        } else {
            randomizeVitals();
        }
    } catch (err) {
        console.error("Vitals load error:", err);
        randomizeVitals();
    }
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
    let activeConv = null;
    for (const p of allPatients) {
        if (p.chats) {
            const found = p.chats.find(c => c.id === conversationId);
            if (found) {
                activeConv = found;
                break;
            }
        }
    }
    if (activeConv) {
        activePatientId = activeConv.patient_id || null;
        if (activePatientId) {
            localStorage.setItem(`patient_collapsed_${activePatientId}`, 'false');
            const patientObj = allPatients.find(p => p.patient_id === activePatientId);
            if (patientObj) {
                activePatientName = patientObj.profile.name;
                const detailsNameEl = document.getElementById('patientDetailsName');
                const detailsIdEl = document.getElementById('patientDetailsId');
                if (detailsNameEl) detailsNameEl.textContent = patientObj.profile.name;
                if (detailsIdEl) {
                    detailsIdEl.innerHTML = `
                        <strong>ID:</strong> ${activePatientId.substring(0, 8)}...<br>
                        <strong>Age/Gender:</strong> ${patientObj.profile.age} / ${patientObj.profile.gender}<br>
                        <strong>Occupation:</strong> ${patientObj.profile.occupation || 'N/A'}
                    `;
                }
            }
        }
    }
    messagesContainer.innerHTML = '';
    
    // Set header info
    document.getElementById('patientHeaderName').textContent = summaryTitle;
    document.getElementById('patientHeaderStatus').innerHTML = '<i class="fa-solid fa-stethoscope"></i> Loaded from Case Logs';
    
    // Enable inputs
    chatInput.disabled = false;
    sendBtn.disabled = false;
    chatInput.placeholder = "Interview the patient...";
    if (downloadReportBtn) downloadReportBtn.style.display = 'flex';
    
    loadVitals(conversationId);

    // Set active class in sidebar
    document.querySelectorAll('.nested-chat-card, .history-card').forEach(card => {
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

let allPatients = [];
let activePatientId = null;
let activePatientName = null;

// Load side history bar listing all previous sessions with case summaries
async function loadConversations() {
    if (!accessToken) return;
    try {
        const response = await fetch(`${BASE_BACKEND}/patients`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const data = await response.json();
        
        if (response.ok && data.patients) {
            allPatients = data.patients;
            for (const p of allPatients) {
                try {
                    const cRes = await fetch(`${BASE_BACKEND}/patients/${p.patient_id}/conversations`, {
                        headers: { 'Authorization': `Bearer ${accessToken}` }
                    });
                    const cData = await cRes.json();
                    if (cRes.ok && cData.conversations) {
                        p.chats = cData.conversations;
                    } else {
                        p.chats = [];
                    }
                } catch (err) {
                    console.error("Error fetching conversations for patient", p.patient_id, err);
                    p.chats = [];
                }
            }
        } else {
            allPatients = [];
        }
        filterAndRenderHistory();
    } catch (error) {
        console.error('Could not load conversations:', error);
        const he = document.getElementById('historyEmpty');
        if (he) { he.textContent = 'Error connecting to medical database.'; he.style.display = 'block'; }
    }
}

// Filters, sorts, and renders the patient-chat history dynamically
function filterAndRenderHistory() {
    const historyList = document.getElementById('historyList');
    const historyEmpty = document.getElementById('historyEmpty');
    historyList.innerHTML = '';

    const searchQuery = document.getElementById('sidebarSearch').value.toLowerCase().trim();
    const sortBy = document.getElementById('sidebarSort').value;

    const patientGroups = allPatients.map(p => {
        const chats = p.chats || [];
        return {
            id: p.patient_id,
            name: p.profile.name,
            age: p.profile.age,
            gender: p.profile.gender,
            profile: p.profile,
            chats: chats,
            created_at: p.profile.created_at || new Date().toISOString(),
            last_updated: chats.length > 0 ? maxDate(chats.map(c => c.last_updated || c.created_at)) : (p.profile.created_at || new Date().toISOString()),
            pinned: false
        };
    });

    patientGroups.forEach(p => {
        p.chats.forEach(c => {
            let metadata = {
                title: "New Consultation",
                summary: "Initial intake discussion.",
                pinned: false,
                custom_title: null,
                status: "In Progress",
                patient_id: p.id
            };
            if (c.summary && c.summary.startsWith("{")) {
                try {
                    metadata = JSON.parse(c.summary);
                } catch (e) {}
            } else if (c.summary) {
                metadata.title = c.summary;
            }
            c.parsed = metadata;
            if (metadata.pinned) {
                p.pinned = true;
            }
        });
    });

    if (currentConversationId && activePatientId) {
        const targetGroup = patientGroups.find(p => p.id === activePatientId);
        if (targetGroup && !targetGroup.chats.some(c => c.id === currentConversationId)) {
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
                    status: "Active",
                    patient_id: activePatientId
                }
            };
            targetGroup.chats.unshift(activeTemp);
        }
    }

    let filteredGroups = patientGroups.filter(p => {
        const patientNameMatch = p.name.toLowerCase().includes(searchQuery);
        const chatMatch = p.chats.some(c => {
            const title = (c.parsed.custom_title || c.parsed.title || "").toLowerCase();
            const summary = (c.parsed.summary || "").toLowerCase();
            return title.includes(searchQuery) || summary.includes(searchQuery);
        });
        return patientNameMatch || chatMatch;
    });

    filteredGroups.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;

        if (sortBy === "recent") {
            return new Date(b.last_updated) - new Date(a.last_updated);
        } else {
            return new Date(a.created_at) - new Date(b.created_at);
        }
    });

    if (filteredGroups.length === 0) {
        historyEmpty.style.display = 'block';
        return;
    }
    historyEmpty.style.display = 'none';

    filteredGroups.forEach(patient => {
        const isCollapsed = localStorage.getItem(`patient_collapsed_${patient.id}`) === 'true';

        const groupDiv = document.createElement('div');
        groupDiv.className = 'patient-group';
        groupDiv.dataset.patientId = patient.id;

        const header = document.createElement('div');
        header.className = 'patient-header';
        
        const headerLeft = document.createElement('div');
        headerLeft.className = 'patient-header-left';
        headerLeft.innerHTML = `
            <i class="fa-solid ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-down'}" style="font-size: 0.75rem; color: var(--text-muted);"></i>
            <i class="fa-solid fa-folder-open" style="color: var(--primary);"></i>
            <span>${patient.name}</span>
        `;
        
        const headerActions = document.createElement('div');
        headerActions.className = 'patient-header-actions';

        const addChatBtn = document.createElement('button');
        addChatBtn.className = 'add-chat-btn';
        addChatBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
        addChatBtn.title = 'New Consultation';
        addChatBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            startNewPatientChat(patient.id, patient.name);
            if (window.innerWidth <= 1024) closeAllDrawers();
        });

        const deletePatientBtn = document.createElement('button');
        deletePatientBtn.className = 'delete-patient-btn';
        deletePatientBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
        deletePatientBtn.title = 'Delete Patient';
        deletePatientBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to permanently delete patient "${patient.name}" and all associated consultations?`)) {
                deletePatientCascade(patient.id);
            }
        });

        headerActions.appendChild(addChatBtn);
        headerActions.appendChild(deletePatientBtn);
        
        header.appendChild(headerLeft);
        header.appendChild(headerActions);

        header.addEventListener('click', async (evt) => {
            const clickedChevron = evt.target.classList.contains('fa-chevron-down') || evt.target.classList.contains('fa-chevron-right');
            if (clickedChevron) {
                const collapsed = localStorage.getItem(`patient_collapsed_${patient.id}`) === 'true';
                localStorage.setItem(`patient_collapsed_${patient.id}`, !collapsed ? 'true' : 'false');
            } else {
                localStorage.setItem(`patient_collapsed_${patient.id}`, 'false');
                allPatients.forEach(p => {
                    if (p.patient_id !== patient.id) {
                        localStorage.setItem(`patient_collapsed_${p.patient_id}`, 'true');
                    }
                });
                activePatientId = patient.id;
                activePatientName = patient.name;
                
                try {
                    const pProfileRes = await fetch(`${BASE_BACKEND}/patients/${patient.id}`, {
                        headers: { 'Authorization': `Bearer ${accessToken}` }
                    });
                    const pProfileData = await pProfileRes.json();
                    
                    const pChatsRes = await fetch(`${BASE_BACKEND}/patients/${patient.id}/conversations`, {
                        headers: { 'Authorization': `Bearer ${accessToken}` }
                    });
                    const pChatsData = await pChatsRes.json();
                    
                    if (pChatsData.conversations) {
                        patient.chats = pChatsData.conversations;
                        const targetP = allPatients.find(p => p.patient_id === patient.id);
                        if (targetP) {
                            targetP.chats = pChatsData.conversations;
                        }
                    }
                    
                    if (patient.chats && patient.chats.length > 0) {
                        const sorted = [...patient.chats].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                        loadConversationHistory(sorted[0].id, `${patient.name}`);
                    } else {
                        startNewPatientChat(patient.id, patient.name);
                    }
                } catch (e) {
                    console.error("Error loading patient on click", e);
                }
            }
            filterAndRenderHistory();
        });

        groupDiv.appendChild(header);

        const chatsContainer = document.createElement('div');
        chatsContainer.className = `patient-chats ${isCollapsed ? 'collapsed' : ''}`;

        const sortedChats = [...patient.chats].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        sortedChats.forEach(conv => {
            const chatCard = renderChatCard(conv);
            chatsContainer.appendChild(chatCard);
        });

        if (sortedChats.length === 0) {
            const emptyText = document.createElement('div');
            emptyText.style.cssText = 'padding: 8px 14px; font-size: 0.8rem; color: var(--text-muted); font-style: italic;';
            emptyText.textContent = 'No consultation sessions yet.';
            chatsContainer.appendChild(emptyText);
        }

        groupDiv.appendChild(chatsContainer);
        historyList.appendChild(groupDiv);
    });
}

function maxDate(dates) {
    if (!dates || dates.length === 0) return new Date().toISOString();
    return new Date(Math.max(...dates.map(d => new Date(d)))).toISOString();
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
            conversation_id: currentConversationId,
            patient_id: activePatientId
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

        // Fast sidebar update: only refresh the active card's title — no full reload
        // The full reload happens lazily when the user next clicks on a patient
        try {
            const targetP = allPatients.find(p => p.patient_id === activePatientId);
            const targetChat = targetP?.chats?.find(c => c.id === currentConversationId);
            if (targetChat?.summary) {
                const parsed = targetChat.summary.startsWith('{') ? JSON.parse(targetChat.summary) : {};
                refreshActiveChatCard(parsed.title, parsed.summary);
            }
        } catch (_) {}
        // Background-refresh the sidebar asynchronously (don't await — keep UI fast)
        loadConversations();
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
    if (downloadReportBtn) downloadReportBtn.style.display = 'none';
    
    clearVitals();
    
    document.querySelectorAll('.nested-chat-card, .history-card').forEach(card => card.classList.remove('active'));
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
    startNewPatient();
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

if (downloadReportBtn) {
    downloadReportBtn.addEventListener('click', async () => {
        if (!currentConversationId) return;
        try {
            showToast("Compiling clinical simulation report...");
            const response = await fetch(`${BASE_BACKEND}/generate-report`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ conversation_id: currentConversationId })
            });
            const data = await response.json();
            if (response.ok && data.success) {
                showToast("PDF report generated successfully!");
                const link = document.createElement('a');
                link.href = `${BASE_BACKEND}${data.download_url}`;
                link.download = data.filename || 'OSCE_Report.pdf';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                showToast("Failed to compile report PDF: " + (data.detail || "Server error"), true);
            }
        } catch (error) {
            console.error("Error generating report:", error);
            showToast("Network error generating PDF report.", true);
        }
    });
}

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

async function startNewPatient() {
    resetChat();
    try {
        showToast("Generating new patient profile...");
        const response = await fetch(`${BASE_BACKEND}/patient/create`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            }
        });
        const data = await response.json();
        
        if (response.ok && data.success) {
            activePatientId = data.patient_id;
            activePatientName = data.patient_name;
            currentConversationId = data.conversation_id;
            
            localStorage.setItem(`patient_collapsed_${data.patient_id}`, 'false');
            allPatients.forEach(p => {
                if (p.patient_id !== data.patient_id) {
                    localStorage.setItem(`patient_collapsed_${p.patient_id}`, 'true');
                }
            });
            
            document.getElementById('patientHeaderName').textContent = `Patient Case File: ${data.patient_name}`;
            document.getElementById('patientHeaderStatus').innerHTML = '<i class="fa-solid fa-heartbeat" style="color:var(--primary)"></i> Interview In Progress';
            
            const detailsNameEl = document.getElementById('patientDetailsName');
            const detailsIdEl = document.getElementById('patientDetailsId');
            if (detailsNameEl) detailsNameEl.textContent = data.patient_name;
            if (detailsIdEl) {
                detailsIdEl.innerHTML = `
                    <strong>ID:</strong> ${data.patient_id.substring(0, 8)}...<br>
                    <strong>Age/Gender:</strong> Loading...
                `;
            }
            
            chatInput.disabled = false;
            sendBtn.disabled = false;
            chatInput.placeholder = "Interview the patient...";
            chatInput.focus();
            if (downloadReportBtn) downloadReportBtn.style.display = 'flex';
            
            loadVitals(currentConversationId);
            
            const welcome = document.getElementById('welcomeDashboard');
            if (welcome) welcome.remove();
            
            // Send introductory message
            addMessage('assistant', `Hi doctor, I am ${data.patient_name}. I am here today because of some issues.`, 'Patient • Ready');
            
            await fetch(`${BASE_BACKEND}/chat/save`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    conversation_id: currentConversationId,
                    user_message: "Hello, please tell me what brings you in today.",
                    ai_message: `Hi doctor, I am ${data.patient_name}. I am here today because of some issues.`
                })
            });
            
            showToast("Patient case generated successfully!");
            await loadConversations();
        } else {
            showToast("Failed to generate patient.", true);
        }
    } catch (error) {
        console.error("Error starting new patient simulation:", error);
        showToast("Error generating patient case.", true);
    }
}

async function startNewPatientChat(patientId, patientName) {
    resetChat();
    try {
        showToast("Starting new consultation session...");
        const response = await fetch(`${BASE_BACKEND}/patient/${patientId}/chat`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            }
        });
        const data = await response.json();
        
        if (response.ok && data.success) {
            activePatientId = patientId;
            activePatientName = patientName;
            currentConversationId = data.conversation_id;
            
            localStorage.setItem(`patient_collapsed_${patientId}`, 'false');
            allPatients.forEach(p => {
                if (p.patient_id !== patientId) {
                    localStorage.setItem(`patient_collapsed_${p.patient_id}`, 'true');
                }
            });
            
            document.getElementById('patientHeaderName').textContent = `Patient Case File: ${patientName}`;
            document.getElementById('patientHeaderStatus').innerHTML = '<i class="fa-solid fa-heartbeat" style="color:var(--primary)"></i> Interview In Progress';
            
            const detailsNameEl = document.getElementById('patientDetailsName');
            const detailsIdEl = document.getElementById('patientDetailsId');
            if (detailsNameEl) detailsNameEl.textContent = patientName;
            if (detailsIdEl) {
                const patientObj = allPatients.find(p => p.patient_id === patientId);
                if (patientObj) {
                    detailsIdEl.innerHTML = `
                        <strong>ID:</strong> ${patientId.substring(0, 8)}...<br>
                        <strong>Age/Gender:</strong> ${patientObj.profile.age} / ${patientObj.profile.gender}<br>
                        <strong>Occupation:</strong> ${patientObj.profile.occupation || 'N/A'}
                    `;
                } else {
                    detailsIdEl.innerHTML = `
                        <strong>ID:</strong> ${patientId.substring(0, 8)}...
                    `;
                }
            }
            
            chatInput.disabled = false;
            sendBtn.disabled = false;
            chatInput.placeholder = "Interview the patient...";
            chatInput.focus();
            if (downloadReportBtn) downloadReportBtn.style.display = 'flex';
            
            loadVitals(currentConversationId);
            
            const welcome = document.getElementById('welcomeDashboard');
            if (welcome) welcome.remove();
            
            addMessage('assistant', `Hi doctor, this is a new consultation session. How can I help you today?`, 'Patient • Ready');
            
            // Instantly inject new tab into sidebar without waiting for a server reload
            injectNewChatTabIntoSidebar(patientId, data.conversation_id);
            
            // Background-refresh sidebar fully (don't await — keep UI instant)
            loadConversations();
        } else {
            showToast("Failed to start new chat.", true);
        }
    } catch (error) {
        console.error(error);
        showToast("Error starting chat.", true);
    }
}

async function deletePatientCascade(patientId) {
    if (!accessToken) return;
    try {
        const response = await fetch(`${BASE_BACKEND}/patient/${patientId}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${accessToken}`
            }
        });
        
        if (response.ok) {
            showToast("Patient and all consultations permanently deleted.");
            if (activePatientId === patientId) {
                resetChat();
            }
            loadConversations();
        } else {
            showToast("Failed to delete patient.", true);
        }
    } catch (err) {
        console.error(err);
        showToast("Error deleting patient.", true);
    }
}

// Instantly inject a new consultation tab into the correct patient folder in the sidebar
// Called right after startNewPatientChat succeeds, before background loadConversations fires
function injectNewChatTabIntoSidebar(patientId, conversationId) {
    // Find the patient's chats container in the DOM
    const groupDiv = document.querySelector(`.patient-group[data-patient-id="${patientId}"]`);
    if (!groupDiv) return; // sidebar not rendered yet — background reload will handle it

    const chatsContainer = groupDiv.querySelector('.patient-chats');
    if (!chatsContainer) return;

    // Remove "collapsed" state so the folder is open
    chatsContainer.classList.remove('collapsed');
    localStorage.setItem(`patient_collapsed_${patientId}`, 'false');

    // Remove any "No consultation sessions yet." placeholder
    const placeholder = chatsContainer.querySelector('div[style]');
    if (placeholder && placeholder.textContent.includes('No consultation')) placeholder.remove();

    // Remove any existing temp card for this conversation (avoid duplicates)
    const existing = chatsContainer.querySelector(`.nested-chat-card[data-id="${conversationId}"]`);
    if (existing) existing.remove();

    // Create a skeleton new card using the same structure as renderChatCard
    const conv = {
        id: conversationId,
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString(),
        message_count: 0,
        duration_mins: 0,
        summary: '{}',
        parsed: {
            title: 'New Consultation',
            summary: 'Session just started.',
            pinned: false,
            custom_title: null,
            status: 'Active',
            patient_id: patientId
        }
    };
    const card = renderChatCard(conv);
    card.classList.add('active');

    // Deactivate any other active card
    document.querySelectorAll('.nested-chat-card.active').forEach(c => c.classList.remove('active'));
    card.classList.add('active');

    // Prepend (newest first inside folder)
    chatsContainer.prepend(card);

    // Also update allPatients in memory so filterAndRenderHistory doesn't lose it
    const targetP = allPatients.find(p => p.patient_id === patientId);
    if (targetP) {
        if (!targetP.chats) targetP.chats = [];
        if (!targetP.chats.some(c => c.id === conversationId)) {
            targetP.chats.unshift(conv);
        }
    }
}

function renderChatCard(conv) {
    const metadata = conv.parsed;
    const displayTitle = metadata.custom_title || metadata.title || "New Consultation";
    const displaySummary = metadata.summary || "Initial intake discussion.";
    
    const dateObj = new Date(conv.created_at);
    const formattedDate = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const card = document.createElement('div');
    card.className = `nested-chat-card ${currentConversationId === conv.id ? 'active' : ''}`;
    card.dataset.id = conv.id;

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

    const info = document.createElement('div');
    info.className = 'history-info';
    
    const titleRow = document.createElement('div');
    titleRow.className = 'history-title-row';
    
    const titleSpan = document.createElement('span');
    titleSpan.className = 'history-title';
    titleSpan.id = `title-${conv.id}`;
    titleSpan.innerHTML = `<i class="fa-solid fa-stethoscope"></i> ${displayTitle}`;
    
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
        
        info.innerHTML = `
            <div class="delete-confirm-container" style="display:flex; flex-direction:column; gap:8px; width:100%; animation:fadeIn 0.2s ease;">
                <span style="font-size:0.8rem; font-weight:600; color:#ef4444; display:flex; align-items:center; gap:6px;">
                    <i class="fa-solid fa-triangle-exclamation"></i> Delete chat?
                </span>
                <div style="display:flex; gap:10px; justify-content:flex-end;">
                    <button class="confirm-yes-btn" style="background:#ef4444; border:none; color:white; font-size:0.75rem; font-weight:700; padding:4px 12px; border-radius:6px; cursor:pointer;">Delete</button>
                    <button class="confirm-no-btn" style="background:rgba(255,255,255,0.08); border:1px solid var(--glass-border); color:var(--text-main); font-size:0.75rem; font-weight:700; padding:4px 12px; border-radius:6px; cursor:pointer;">Cancel</button>
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
                    showToast("Consultation deleted.");
                    if (currentConversationId === conv.id) {
                        resetChat();
                    }
                    loadConversations();
                } else {
                    showToast("Failed to delete session.", true);
                }
            } catch (err) {
                console.error(err);
                showToast("Error deleting session.", true);
            }
        });
        
        info.querySelector('.confirm-no-btn').addEventListener('click', (evt) => {
            evt.stopPropagation();
            filterAndRenderHistory();
        });
    });
    actionsRow.appendChild(deleteBtn);

    titleRow.appendChild(titleSpan);
    titleRow.appendChild(actionsRow);

    const summarySpan = document.createElement('div');
    summarySpan.className = 'history-summary';
    summarySpan.textContent = displaySummary;

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

    return card;
}

// Bootstrap App
restoreTheme();
await initializeAuth();
await loadConversations();

if (!currentConversationId) {
    startNewPatient();
}
