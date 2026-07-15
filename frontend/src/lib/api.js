const BASE = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000';

export const api = {
  base: BASE,

  headers(token) {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  },

  async getPatients(token) {
    const res = await fetch(`${BASE}/patients`, { headers: this.headers(token) });
    return res.json();
  },

  async createPatient(token) {
    const res = await fetch(`${BASE}/patients`, {
      method: 'POST',
      headers: this.headers(token),
    });
    return res.json();
  },

  async getPatientInfo(token, patientId) {
    const res = await fetch(`${BASE}/patients/${patientId}`, {
      headers: this.headers(token),
    });
    return res.json();
  },

  async getPatientHistory(token, patientId) {
    const res = await fetch(`${BASE}/patients/${patientId}/history`, {
      headers: this.headers(token),
    });
    return res.json();
  },

  async sendMessage(token, message, patientId) {
    const res = await fetch(`${BASE}/patients/${patientId}/chat`, {
      method: 'POST',
      headers: this.headers(token),
      body: JSON.stringify({ message }),
    });
    return res;
  },

  async getVitals(patientId) {
    const res = await fetch(`${BASE}/chat/vitals/${patientId}`);
    if (!res.ok) return null;
    return res.json();
  },

  async updateMetadata(token, patientId, fields) {
    const res = await fetch(`${BASE}/chat/summary/update`, {
      method: 'POST',
      headers: this.headers(token),
      body: JSON.stringify({ conversation_id: patientId, ...fields }),
    });
    return res.ok;
  },

  async deletePatient(token, patientId) {
    const res = await fetch(`${BASE}/patients/${patientId}`, {
      method: 'DELETE',
      headers: this.headers(token),
    });
    return res.ok;
  },

  async generateReport(token, patientId) {
    const res = await fetch(`${BASE}/generate-report`, {
      method: 'POST',
      headers: this.headers(token),
      body: JSON.stringify({ conversation_id: patientId }),
    });
    return res.json();
  },
};
