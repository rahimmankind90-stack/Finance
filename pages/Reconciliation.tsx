import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { TransactionStatus, BankTransaction, Transaction, TransactionType } from '../types';
import { parseBankStatementLines } from '../services/geminiService';

export const Reconciliation: React.FC = () => {
  const { transactions, updateTransaction, addTransaction } = useFinance();
  const [bankLines, setBankLines] = useState<BankTransaction[]>([]);
  const [isParsing, setIsParsing] = useState(false);

  // Filter only unreconciled items from ledger
  const unreconciledLedger = transactions.filter(t => t.status !== TransactionStatus.RECONCILED);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(amount);
  };

  const handleMatch = (ledgerId: string, bankId: string) => {
    const tx = transactions.find(t => t.id === ledgerId);
    if (tx) {
        updateTransaction({ ...tx, status: TransactionStatus.RECONCILED });
        setBankLines(prev => prev.filter(b => b.id !== bankId));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'BANK' | 'LEDGER') => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
          const text = evt.target?.result as string;
          if (!text) return;

          if (type === 'BANK') {
            setIsParsing(true);
            try {
                // Try smart parsing first
                const parsed = await parseBankStatementLines(text);
                if (parsed && parsed.length > 0) {
                     setBankLines(parsed.map((p, i) => ({ ...p, id: `bank-imp-${i}-${Date.now()}` })));
                } else {
                    // Fallback to simple CSV parse if AI fails or key is missing
                    const lines = text.split('\n').filter(l => l.trim().length > 0);
                    const manualParsed: BankTransaction[] = lines.slice(1).map((line, idx) => {
                        const parts = line.split(',');
                        // Assume standard simple csv: Date,Desc,Amount
                        return {
                            id: `bank-man-${idx}`,
                            date: parts[0] || '',
                            description: parts[1] || '',
                            amount: parseFloat(parts[2] || '0')
                        };
                    });
                     setBankLines(manualParsed);
                }
            } catch (err) {
                console.error("Parse error", err);
            } finally {
                setIsParsing(false);
            }
          } else if (type === 'LEDGER') {
             // Basic Import Logic for Ledger CSV
             const lines = text.split('\n').filter(l => l.trim().length > 0);
             // Assume header row
             let count = 0;
             lines.slice(1).forEach(line => {
                 const cols = line.split(',');
                 if (cols.length >= 4) {
                     // Very basic mapping assumption: Date, Voucher, Desc, Amount
                     // Ideally we would map columns dynamically, but for this demo we assume a structure
                     // Date, Voucher, Activity, Clause, Desc, Amount
                     const amount = parseFloat(cols[5]) || 0;
                     const newTx: Transaction = {
                         id: crypto.randomUUID(),
                         date: cols[0] || new Date().toISOString().split('T')[0],
                         voucherNumber: cols[1] || 'IMP',
                         activity: cols[2] || '',
                         accountCode: cols[3] || 'NB',
                         description: cols[4] || 'Imported Transaction',
                         amount: Math.abs(amount),
                         type: amount >= 0 ? TransactionType.INCOME : TransactionType.EXPENSE,
                         status: TransactionStatus.PENDING,
                         payeeOrPayer: 'Imported'
                     };
                     addTransaction(newTx);
                     count++;
                 }
             });
             alert(`Imported ${count} transactions from ledger file.`);
          }
      };
      reader.readAsText(file);
  };

  return (
    <div className="space-y-6 h-[calc(100vh-140px)] flex flex-col">
      <div className="flex justify-between items-start">
        <div>
            <h2 className="text-xl font-bold text-gray-800">Bank Reconciliation</h2>
            <p className="text-sm text-gray-500">Match your internal ledger against your bank statement.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <h3 className="font-semibold text-gray-700 mb-2">1. Upload Bank Statement</h3>
              <p className="text-xs text-gray-500 mb-3">Upload CSV of your bank statement.</p>
              <input 
                type="file" 
                accept=".csv,.txt"
                onChange={(e) => handleFileUpload(e, 'BANK')}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
          </div>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <h3 className="font-semibold text-gray-700 mb-2">2. Import Ledger (Optional)</h3>
              <p className="text-xs text-gray-500 mb-3">If you have an external ledger CSV, import it here.</p>
              <input 
                type="file" 
                accept=".csv,.txt"
                onChange={(e) => handleFileUpload(e, 'LEDGER')}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
              />
          </div>
      </div>

      {isParsing && (
          <div className="text-center py-4 text-blue-600 animate-pulse">
              Parsing bank statement with AI...
          </div>
      )}

      {bankLines.length > 0 && (
          <div className="flex-1 grid grid-cols-2 gap-6 min-h-0">
              {/* Left: Ledger */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col min-h-0">
                  <div className="p-4 border-b border-gray-100 bg-gray-50 rounded-t-xl">
                      <h3 className="font-semibold text-gray-700">Internal Ledger (Unreconciled)</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                      {unreconciledLedger.map(tx => (
                          <div key={tx.id} className="p-3 border border-gray-100 rounded hover:border-blue-300 cursor-pointer bg-white group">
                              <div className="flex justify-between">
                                  <span className="font-medium text-gray-800">{formatCurrency(tx.amount)}</span>
                                  <span className="text-xs text-gray-400">{tx.date}</span>
                              </div>
                              <p className="text-sm text-gray-600 truncate">{tx.description}</p>
                              <div className="mt-2 hidden group-hover:flex justify-end">
                                  <span className="text-xs text-blue-500 font-medium">Drag to match</span>
                              </div>
                          </div>
                      ))}
                      {unreconciledLedger.length === 0 && <p className="text-center text-gray-400 py-4">All caught up!</p>}
                  </div>
              </div>

              {/* Right: Bank Statement */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col min-h-0">
                  <div className="p-4 border-b border-gray-100 bg-gray-50 rounded-t-xl flex justify-between">
                      <h3 className="font-semibold text-gray-700">Bank Statement Lines</h3>
                      <button onClick={() => setBankLines([])} className="text-xs text-red-500 hover:text-red-700">Clear</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                      {bankLines.map(line => (
                          <div key={line.id} className="p-3 border border-gray-100 rounded bg-white hover:shadow-md transition-shadow">
                              <div className="flex justify-between items-center">
                                  <div>
                                      <div className="flex gap-2 items-baseline">
                                        <span className={`font-bold ${line.amount > 0 ? 'text-green-600' : 'text-gray-800'}`}>
                                            {formatCurrency(line.amount)}
                                        </span>
                                        <span className="text-xs text-gray-400">{line.date}</span>
                                      </div>
                                      <p className="text-sm text-gray-600">{line.description}</p>
                                  </div>
                                  <div className="flex gap-1">
                                      {/* Simplified matching logic */}
                                      {unreconciledLedger.filter(t => Math.abs(t.amount - Math.abs(line.amount)) < 0.01).map(match => (
                                          <button 
                                            key={match.id}
                                            onClick={() => handleMatch(match.id, line.id)}
                                            className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded border border-green-200 hover:bg-green-200"
                                          >
                                              Match
                                          </button>
                                      ))}
                                  </div>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};