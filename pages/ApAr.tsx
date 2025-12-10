import React from 'react';
import { useFinance } from '../context/FinanceContext';
import { TransactionType, TransactionStatus } from '../types';

export const ApAr: React.FC = () => {
  const { transactions } = useFinance();

  // Receivables: Money owed TO the NGO (Assets)
  // Include: Income, Contributions (CONT), Advances (ADV), Petty Cash Advances (PCA)
  const receivables = transactions.filter(t => 
      (t.type === TransactionType.INCOME || 
       t.type === TransactionType.CONT || 
       t.type === TransactionType.ADV || 
       t.type === TransactionType.PCA) && 
      t.status === TransactionStatus.PENDING
  );
  
  // Payables: Money owed BY the NGO (Liabilities)
  // Include: Non-billable (NB), Withholding Tax (WHT), Income Tax (ITAX), Social Security (SSEC)
  // And regular Expenses that are pending.
  const payables = transactions.filter(t => 
      (t.type === TransactionType.EXPENSE || 
       t.type === TransactionType.NB || 
       t.type === TransactionType.WHT || 
       t.type === TransactionType.ITAX || 
       t.type === TransactionType.SSEC) && 
      t.status === TransactionStatus.PENDING
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(amount);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-4">Accounts Receivable (Money In / Advances)</h2>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                    <tr>
                        <th className="px-6 py-3">Date</th>
                        <th className="px-6 py-3">Type</th>
                        <th className="px-6 py-3">Payer / Staff</th>
                        <th className="px-6 py-3">Description</th>
                        <th className="px-6 py-3 text-right">Amount</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {receivables.map(t => (
                        <tr key={t.id}>
                            <td className="px-6 py-3">{t.date}</td>
                            <td className="px-6 py-3 text-xs font-semibold text-blue-600">{t.type}</td>
                            <td className="px-6 py-3 font-medium">{t.payeeOrPayer}</td>
                            <td className="px-6 py-3 text-gray-500">{t.description}</td>
                            <td className="px-6 py-3 text-right font-bold text-blue-600">{formatCurrency(t.amount)}</td>
                        </tr>
                    ))}
                    {receivables.length === 0 && <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-400">No outstanding receivables.</td></tr>}
                </tbody>
            </table>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-4">Accounts Payable (Bills / Taxes / Liabilities)</h2>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                    <tr>
                        <th className="px-6 py-3">Date</th>
                        <th className="px-6 py-3">Type</th>
                        <th className="px-6 py-3">Payee / Authority</th>
                        <th className="px-6 py-3">Description</th>
                        <th className="px-6 py-3 text-right">Amount</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {payables.map(t => (
                        <tr key={t.id}>
                            <td className="px-6 py-3">{t.date}</td>
                            <td className="px-6 py-3 text-xs font-semibold text-red-600">{t.type}</td>
                            <td className="px-6 py-3 font-medium">{t.payeeOrPayer}</td>
                            <td className="px-6 py-3 text-gray-500">{t.description}</td>
                            <td className="px-6 py-3 text-right font-bold text-red-600">{formatCurrency(t.amount)}</td>
                        </tr>
                    ))}
                    {payables.length === 0 && <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-400">No outstanding payables.</td></tr>}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};