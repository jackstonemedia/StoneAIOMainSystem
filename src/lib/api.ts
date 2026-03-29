export const API_BASE = '/api/business';

// Campaigns
export async function getCampaigns() {
  const res = await fetch(`${API_BASE}/campaigns`);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}
export async function createCampaign(data: any) {
  const res = await fetch(`${API_BASE}/campaigns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create');
  return res.json();
}
export async function updateCampaign(id: string, data: any) {
  const res = await fetch(`${API_BASE}/campaigns/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update');
  return res.json();
}
export async function deleteCampaign(id: string) {
  const res = await fetch(`${API_BASE}/campaigns/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete');
  return res.json();
}

// Forms
export async function getForms() {
  const res = await fetch(`${API_BASE}/forms`);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}
export async function createForm(data: any) {
  const res = await fetch(`${API_BASE}/forms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create');
  return res.json();
}

// Reviews
export async function getReviews() {
  const res = await fetch(`${API_BASE}/reviews`);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}
export async function createReview(data: any) {
  const res = await fetch(`${API_BASE}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create');
  return res.json();
}

// Appointments
export async function getAppointments() {
  const res = await fetch(`${API_BASE}/appointments`);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}
export async function createAppointment(data: any) {
  const res = await fetch(`${API_BASE}/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create');
  return res.json();
}
export async function updateAppointment(id: string, data: any) {
  const res = await fetch(`${API_BASE}/appointments/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update');
  return res.json();
}
export async function deleteAppointment(id: string) {
  const res = await fetch(`${API_BASE}/appointments/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete');
  return res.json();
}

// Conversations
export async function getConversations() {
  const res = await fetch(`${API_BASE}/conversations`);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}
export async function createConversation(data: any) {
  const res = await fetch(`${API_BASE}/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create');
  return res.json();
}
export async function getConversationMessages(id: string) {
  const res = await fetch(`${API_BASE}/conversations/${id}/messages`);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}
export async function sendMessage(id: string, data: any) {
  const res = await fetch(`${API_BASE}/conversations/${id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create');
  return res.json();
}

// CRM
export async function getCrmDashboard() {
  const res = await fetch('/api/crm/dashboard');
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}
export async function getContacts() {
  const res = await fetch('/api/crm/contacts');
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}
export async function createContact(data: any) {
  const res = await fetch('/api/crm/contacts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create');
  return res.json();
}

export async function getCompanies() {
  const res = await fetch('/api/crm/companies');
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}
export async function createCompany(data: any) {
  const res = await fetch('/api/crm/companies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create');
  return res.json();
}

export async function getDeals() {
  const res = await fetch('/api/crm/deals');
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}
export async function createDeal(data: any) {
  const res = await fetch('/api/crm/deals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create');
  return res.json();
}
export async function updateDeal(id: string, data: any) {
  const res = await fetch(`/api/crm/deals/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update');
  return res.json();
}
export async function getActivities() {
  const res = await fetch('/api/crm/activities');
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}
