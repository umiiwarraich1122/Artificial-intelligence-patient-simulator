import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [session, setSession] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [user, setUser] = useState(null);

  // Sidebar state
  const [allPatients, setAllPatients] = useState([]);
  const [sidebarLoading, setSidebarLoading] = useState(false);

  // Active patient (project) state
  const [activePatientId, setActivePatientId] = useState(null);
  const [activePatientName, setActivePatientName] = useState(null);
  const [activePatientProfile, setActivePatientProfile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [vitals, setVitals] = useState(null);

  // Theme
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

  // Toast
  const [toast, setToast] = useState({ visible: false, message: '', isError: false });

  // Input state
  const [inputEnabled, setInputEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));

  const showToast = useCallback((message, isError = false) => {
    setToast({ visible: true, message, isError });
    setTimeout(() => setToast({ visible: false, message: '', isError: false }), 3000);
  }, []);

  const [authChecked, setAuthChecked] = useState(false);

  // Auth setup
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data?.session ?? null);
      setAccessToken(data?.session?.access_token ?? null);
      setUser(data?.session?.user ?? null);
      setAuthChecked(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setAccessToken(s?.access_token ?? null);
      setUser(s?.user ?? null);
      setAuthChecked(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setAccessToken(null);
    setUser(null);
    setAllPatients([]);
    setActivePatientId(null);
    setActivePatientName(null);
    setActivePatientProfile(null);
    setMessages([]);
    setVitals(null);
  };

  // Load patient list
  const loadConversations = useCallback(async (tokenToUse) => {
    const actToken = tokenToUse || accessToken;
    if (!actToken) return;
    setSidebarLoading(true);
    try {
      const data = await api.getPatients(actToken);
      if (data && data.patients) {
        setAllPatients(data.patients);
        return data.patients;
      }
      return [];
    } catch (e) {
      console.error('loadConversations error', e);
      return [];
    } finally {
      setSidebarLoading(false);
    }
  }, [accessToken]);

  // Load vitals
  const loadVitals = useCallback(async (patientId) => {
    if (!patientId) return;
    const v = await api.getVitals(patientId);
    if (v) {
      setVitals(v);
    } else {
      setVitals({
        heart_rate: Math.floor(Math.random() * 25) + 70,
        blood_pressure: `${Math.floor(Math.random() * 30) + 110}/${Math.floor(Math.random() * 15) + 75}`,
        temperature: (Math.random() * 2 + 97.8).toFixed(1),
        resp_rate: Math.floor(Math.random() * 6) + 12,
      });
    }
  }, []);

  // Switch/Load Patient Project
  const selectPatient = useCallback(async (patientId, tokenToUse) => {
    const actToken = tokenToUse || accessToken;
    if (!actToken || !patientId) return;

    setActivePatientId(patientId);
    setMessages([]);
    setInputEnabled(false);
    setIsLoading(true);

    try {
      // Get Info (Name, Profile)
      const info = await api.getPatientInfo(actToken, patientId);
      if (info) {
        setActivePatientName(info.name);
        setActivePatientProfile(info.profile);
      }

      // Get Conversation History
      const hist = await api.getPatientHistory(actToken, patientId);
      if (hist && hist.messages) {
        setMessages(
          hist.messages.map(m => ({
            id: m.id || Math.random(),
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.message,
            timestamp: m.timestamp,
          }))
        );
      }

      // Load Vitals
      await loadVitals(patientId);
      setInputEnabled(true);
    } catch (e) {
      console.error('selectPatient error', e);
      showToast('Could not load patient history', true);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, loadVitals, showToast]);

  // Start new patient
  const createNewPatient = useCallback(async () => {
    if (!accessToken) return;
    try {
      showToast('Generating new patient...');
      const data = await api.createPatient(accessToken);
      if (data && data.id) {
        // Refetch sidebar
        const list = await loadConversations();
        
        // Switch to new patient instantly
        setActivePatientId(data.id);
        setActivePatientName(data.name || 'New Patient');
        setActivePatientProfile(data.profile);
        setMessages([
          {
            id: Date.now(),
            role: 'assistant',
            content: 'Hello doctor, I\'m ready for my appointment.',
            timestamp: new Date().toISOString(),
          },
        ]);
        setInputEnabled(true);
        await loadVitals(data.id);
        showToast(`Patient "${data.name}" created`);
      }
    } catch (e) {
      console.error('createNewPatient error', e);
      showToast('Failed to create patient', true);
    }
  }, [accessToken, loadConversations, loadVitals, showToast]);

  // Send message to active patient
  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || !accessToken || !activePatientId) return;

    const userMsg = { id: Date.now(), role: 'user', content: text, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInputEnabled(false);
    setIsLoading(true);

    try {
      const res = await api.sendMessage(accessToken, text, activePatientId);
      if (!res.ok) throw new Error('API failure');

      setIsLoading(false);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let reply = '';
      const aiMsgId = Date.now() + 1;

      // Add streaming bubble
      setMessages(prev => [
        ...prev,
        { id: aiMsgId, role: 'assistant', content: '', timestamp: new Date().toISOString(), streaming: true },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value);
        setMessages(prev => prev.map(m => (m.id === aiMsgId ? { ...m, content: reply } : m)));
      }

      setMessages(prev => prev.map(m => (m.id === aiMsgId ? { ...m, streaming: false } : m)));
      setInputEnabled(true);
    } catch (e) {
      console.error('sendMessage error', e);
      setIsLoading(false);
      setInputEnabled(true);
      showToast('Failed to get response', true);
    }
  }, [accessToken, activePatientId, showToast]);

  // Initial load
  useEffect(() => {
    if (accessToken) {
      loadConversations(accessToken).then((list) => {
        if (list && list.length > 0) {
          // Select the most recent patient
          selectPatient(list[0].id, accessToken);
        } else {
          // Create the first patient automatically
          createNewPatient();
        }
      });
    }
  }, [accessToken, loadConversations, selectPatient, createNewPatient]);

  const resetChat = useCallback(() => {
    if (activePatientId) {
      selectPatient(activePatientId);
    }
  }, [activePatientId, selectPatient]);

  return (
    <AppContext.Provider
      value={{
        authChecked,
        session,
        accessToken,
        user,
        logout,
        theme,
        toggleTheme,
        toast,
        showToast,
        allPatients,
        sidebarLoading,
        loadConversations,
        activePatientId,
        activePatientName,
        activePatientProfile,
        messages,
        setMessages,
        vitals,
        loadVitals,
        inputEnabled,
        isLoading,
        selectPatient,
        createNewPatient,
        sendMessage,
        resetChat,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
