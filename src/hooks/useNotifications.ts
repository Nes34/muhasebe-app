import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { parseDateTR, todayISO } from '../lib/utils';

export interface Notification {
  id: string;
  type: 'overdue_check' | 'low_stock' | 'budget_overrun' | 'low_balance';
  title: string;
  message: string;
  severity: 'warning' | 'danger' | 'info';
  link?: string;
  created_at: string;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    const today = todayISO();
    const items: Notification[] = [];

    // 1. Vadesi geçen çekler
    const { data: checks } = await supabase
      .from('checks')
      .select('id, check_number, check_type, amount, due_date, bank_name')
      .eq('status', 'pending');

    (checks || []).forEach(check => {
      const dueDate = parseDateTR(check.due_date);
      if (dueDate) {
        const dueISO = dueDate.toISOString().split('T')[0];
        if (dueISO < today) {
          const daysOverdue = Math.ceil((dueDate.getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
          items.push({
            id: `check-${check.id}`,
            type: 'overdue_check',
            title: 'Vadesi Geçen Çek',
            message: `${check.check_number} nolu ${check.check_type === 'received' ? 'alınan' : 'verilen'} çekin vadesi ${Math.abs(daysOverdue)} gün geçti`,
            severity: 'danger',
            link: '/cekler',
            created_at: new Date().toISOString(),
          });
        }
      }
    });

    // 2. Düşük stok seviyesi
    const { data: products } = await supabase
      .from('products')
      .select('id, name, code, stock_quantity, min_stock_level, unit')
      .eq('is_active', true);

    (products || []).forEach(product => {
      if (product.min_stock_level && product.stock_quantity <= product.min_stock_level) {
        items.push({
          id: `stock-${product.id}`,
          type: 'low_stock',
          title: 'Düşük Stok',
          message: `${product.name} ürününün stok seviyesi ${product.stock_quantity} ${product.unit} (min: ${product.min_stock_level})`,
          severity: 'warning',
          link: '/stok',
          created_at: new Date().toISOString(),
        });
      }
    });

    // 3. Bütçe aşımı projeler
    const { data: projects } = await supabase
      .from('projects')
      .select('id, name, budget, status')
      .eq('status', 'active');

    for (const project of projects || []) {
      if (project.budget > 0) {
        const { data: txData } = await supabase
          .from('transactions')
          .select('amount, transaction_type')
          .eq('project_id', project.id)
          .eq('is_exception', false);

        const expense = (txData || [])
          .filter(t => t.transaction_type !== 'income' && t.transaction_type !== 'invoice')
          .reduce((sum, t) => sum + t.amount, 0);

        if (expense > project.budget) {
          items.push({
            id: `budget-${project.id}`,
            type: 'budget_overrun',
            title: 'Bütçe Aşımı',
            message: `${project.name} projesinin gideri bütçeyi aştı: ${expense.toLocaleString('tr-TR')} ₺ / ${project.budget.toLocaleString('tr-TR')} ₺`,
            severity: 'danger',
            link: '/projeler',
            created_at: new Date().toISOString(),
          });
        }
      }
    }

    // 4. Düşük kasa/banka bakiyesi
    const { data: cashRegisters } = await supabase
      .from('cash_registers')
      .select('id, name, current_balance')
      .eq('is_active', true);

    (cashRegisters || []).forEach(reg => {
      if (reg.current_balance < 10000) {
        items.push({
          id: `cash-${reg.id}`,
          type: 'low_balance',
          title: 'Düşük Bakiye',
          message: `${reg.name} bakiyesi düşük: ${reg.current_balance.toLocaleString('tr-TR')} ₺`,
          severity: 'warning',
          link: '/kasalar',
          created_at: new Date().toISOString(),
        });
      }
    });

    const { data: bankAccounts } = await supabase
      .from('bank_accounts')
      .select('id, bank_name, branch, current_balance')
      .eq('is_active', true);

    (bankAccounts || []).forEach(acc => {
      if (acc.current_balance < 50000) {
        items.push({
          id: `bank-${acc.id}`,
          type: 'low_balance',
          title: 'Düşük Bakiye',
          message: `${acc.bank_name} ${acc.branch || ''} bakiyesi düşük: ${acc.current_balance.toLocaleString('tr-TR')} ₺`,
          severity: 'warning',
          link: '/bankalar',
          created_at: new Date().toISOString(),
        });
      }
    });

    setNotifications(items);
    setLoading(false);
  };

  useEffect(() => { fetchNotifications(); }, []);

  return { notifications, loading, refresh: fetchNotifications };
}
