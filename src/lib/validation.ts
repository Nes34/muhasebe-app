import { supabase } from './supabase';

export async function checkDuplicateInvoice(
  firmId: string,
  transactionType: string,
  invoiceNumber: string,
  excludeId?: string
): Promise<{ isDuplicate: boolean; existing?: Record<string, unknown> | null }> {
  let query = supabase
    .from('transactions')
    .select('id, transaction_date, amount')
    .eq('firm_id', firmId)
    .eq('transaction_type', transactionType)
    .eq('invoice_number', invoiceNumber);
  
  if (excludeId) {
    query = query.neq('id', excludeId);
  }
  
  const { data } = await query.single();
  return { isDuplicate: !!data, existing: data };
}

export async function checkDuplicateCheck(
  checkNumber: string,
  bankName: string,
  excludeId?: string
): Promise<{ isDuplicate: boolean; existing?: Record<string, unknown> | null }> {
  let query = supabase
    .from('checks')
    .select('id, amount, firm_id')
    .eq('check_number', checkNumber)
    .eq('bank_name', bankName);
  
  if (excludeId) {
    query = query.neq('id', excludeId);
  }
  
  const { data } = await query.single();
  return { isDuplicate: !!data, existing: data };
}