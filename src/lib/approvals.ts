import { supabase } from './supabase';

export interface ApprovalRequest {
  id: string;
  type: 'firm_merge';
  requested_by: string;
  requested_by_name?: string;
  status: 'pending' | 'approved' | 'rejected';
  data: Record<string, any>;
  created_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  reject_reason?: string;
}

export async function getPendingRequests(): Promise<ApprovalRequest[]> {
  const { data } = await supabase
    .from('approval_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  return (data as ApprovalRequest[]) || [];
}

export async function getAllRequests(): Promise<ApprovalRequest[]> {
  const { data } = await supabase
    .from('approval_requests')
    .select('*')
    .order('created_at', { ascending: false });
  return (data as ApprovalRequest[]) || [];
}

export async function addRequest(request: Omit<ApprovalRequest, 'id' | 'created_at' | 'status'>): Promise<ApprovalRequest | null> {
  const { data, error } = await supabase
    .from('approval_requests')
    .insert({
      type: request.type,
      requested_by: request.requested_by,
      requested_by_name: request.requested_by_name,
      data: request.data,
    })
    .select()
    .single();
  if (error) { console.error('Approval insert error:', error); return null; }
  return data as ApprovalRequest;
}

export async function approveRequest(id: string, reviewedBy: string): Promise<boolean> {
  const { error } = await supabase
    .from('approval_requests')
    .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: reviewedBy })
    .eq('id', id);
  return !error;
}

export async function rejectRequest(id: string, reviewedBy: string, reason: string): Promise<boolean> {
  const { error } = await supabase
    .from('approval_requests')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: reviewedBy, reject_reason: reason })
    .eq('id', id);
  return !error;
}

export async function deleteRequest(id: string): Promise<boolean> {
  const { error } = await supabase.from('approval_requests').delete().eq('id', id);
  return !error;
}

export function getRequestLabel(type: ApprovalRequest['type']): string {
  const labels: Record<string, string> = {
    firm_merge: 'Firma Birleştirme',
  };
  return labels[type] || type;
}

export function getRequestColor(type: ApprovalRequest['type']): string {
  const colors: Record<string, string> = {
    firm_merge: 'red',
  };
  return colors[type] || 'slate';
}
