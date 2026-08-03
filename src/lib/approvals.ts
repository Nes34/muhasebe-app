export interface ApprovalRequest {
  id: string;
  type: 'transfer_cari' | 'transfer_stok' | 'transfer_kasa' | 'transfer_banka' | 'firm_merge';
  requested_by: string;
  requested_by_name?: string;
  status: 'pending' | 'approved' | 'rejected';
  data: Record<string, any>;
  created_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  reject_reason?: string;
}

const STORAGE_KEY = 'muhasebe_approval_requests';

export function getRequests(): ApprovalRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getPendingRequests(): ApprovalRequest[] {
  return getRequests().filter(r => r.status === 'pending');
}

export function addRequest(request: Omit<ApprovalRequest, 'id' | 'created_at' | 'status'>): ApprovalRequest {
  const requests = getRequests();
  const newRequest: ApprovalRequest = {
    ...request,
    id: crypto.randomUUID(),
    status: 'pending',
    created_at: new Date().toISOString(),
  };
  requests.push(newRequest);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
  return newRequest;
}

export function approveRequest(id: string, reviewedBy: string): boolean {
  const requests = getRequests();
  const idx = requests.findIndex(r => r.id === id);
  if (idx === -1) return false;
  requests[idx].status = 'approved';
  requests[idx].reviewed_at = new Date().toISOString();
  requests[idx].reviewed_by = reviewedBy;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
  return true;
}

export function rejectRequest(id: string, reviewedBy: string, reason: string): boolean {
  const requests = getRequests();
  const idx = requests.findIndex(r => r.id === id);
  if (idx === -1) return false;
  requests[idx].status = 'rejected';
  requests[idx].reviewed_at = new Date().toISOString();
  requests[idx].reviewed_by = reviewedBy;
  requests[idx].reject_reason = reason;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
  return true;
}

export function deleteRequest(id: string): boolean {
  const requests = getRequests().filter(r => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
  return true;
}

export function getRequestLabel(type: ApprovalRequest['type']): string {
  const labels: Record<string, string> = {
    transfer_cari: 'Cari Aktarım',
    transfer_stok: 'Stok Aktarım',
    transfer_kasa: 'Kasa Aktarım',
    transfer_banka: 'Banka Aktarım',
    firm_merge: 'Firma Birleştirme',
  };
  return labels[type] || type;
}

export function getRequestColor(type: ApprovalRequest['type']): string {
  const colors: Record<string, string> = {
    transfer_cari: 'blue',
    transfer_stok: 'green',
    transfer_kasa: 'yellow',
    transfer_banka: 'purple',
    firm_merge: 'red',
  };
  return colors[type] || 'slate';
}
