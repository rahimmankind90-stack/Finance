import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { CHART_OF_ACCOUNTS } from '../constants';
import { Transaction, TransactionType, TransactionStatus } from '../types';
import { categorizeTransaction } from '../services/geminiService';

export const Ledger: React.FC = () => {
  const { transactions, addTransaction, deleteTransaction, updateTransaction } = useFinance();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Undo State
  const [deletedTx, setDeletedTx] = useState<Transaction | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    voucher: '',
    activity: '',
    clause: '',
    category: ''
  });

  // Form State
  const initialFormState: Partial<Transaction> = {
    date: new Date().toISOString().split('T')[0],
    type: TransactionType.EXPENSE,
    status: TransactionStatus.PENDING,
    accountCode: '',
    description: '',
    activity: '',
    amount: 0,
    voucherNumber: '',
    payeeOrPayer: '',
    chequeNumber: ''
  };

  const [formData, setFormData] = useState<Partial<Transaction>>(initialFormState);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(amount);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleDelete = (id: string) => {
    // FIX: Use String() to ensure we find the transaction even if there's a type mismatch (string vs number)
    const txToDelete = transactions.find(t => String(t.id) === String(id));
    
    if (txToDelete) {
        // Deletion is immediate, user can Undo from the toast.
        deleteTransaction(id);
        setDeletedTx(txToDelete);
        setShowUndoToast(true);
        
        // Auto-hide toast after 5 seconds
        setTimeout(() => {
            setShowUndoToast(false);
        }, 5000);
    } else {
        console.error("Could not find transaction to delete:", id);
    }
  };

  const handleUndo = () => {
      if (deletedTx) {
          addTransaction(deletedTx);
          setDeletedTx(null);
          setShowUndoToast(false);
      }
  };

  const handleEdit = (tx: Transaction) => {
    setFormData({
      date: tx.date,
      type: tx.type,
      status: tx.status,
      accountCode: tx.accountCode,
      description: tx.description,
      activity: tx.activity || '',
      amount: tx.amount,
      voucherNumber: tx.voucherNumber,
      payeeOrPayer: tx.payeeOrPayer,
      chequeNumber: tx.chequeNumber || ''
    });
    setEditingId(tx.id);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData(initialFormState);
  };

  const handleRefresh = () => {
      window.location.reload();
  };

  const handleSmartCategorize = async () => {
    if (!formData.description) return;
    setIsSuggesting(true);
    const suggestedCode = await categorizeTransaction(formData.description);
    if (suggestedCode) {
      const code = suggestedCode.split(':')[0].trim();
      const exists = CHART_OF_ACCOUNTS.find(c => c.code === code);
      if (exists) {
        setFormData(prev => ({ ...prev, accountCode: code }));
      }
    }
    setIsSuggesting(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingId) {
        // Update existing transaction
        const updatedTx: Transaction = {
            id: editingId,
            date: formData.date!,
            voucherNumber: formData.voucherNumber || `V-${Date.now()}`,
            description: formData.description!,
            payeeOrPayer: formData.payeeOrPayer!,
            activity: formData.activity || '',
            amount: Number(formData.amount),
            type: formData.type as TransactionType,
            accountCode: formData.accountCode!,
            status: formData.status as TransactionStatus,
            chequeNumber: formData.chequeNumber
        };
        updateTransaction(updatedTx);
    } else {
        // Create new transaction
        const newTx: Transaction = {
            id: crypto.randomUUID(),
            date: formData.date!,
            voucherNumber: formData.voucherNumber || `V-${Date.now()}`,
            description: formData.description!,
            payeeOrPayer: formData.payeeOrPayer!,
            activity: formData.activity || '',
            amount: Number(formData.amount),
            type: formData.type as TransactionType,
            accountCode: formData.accountCode!,
            status: formData.status as TransactionStatus,
            chequeNumber: formData.chequeNumber // Optional
        };
        addTransaction(newTx);
    }
    
    closeModal();
  };

  const filteredAccounts = CHART_OF_ACCOUNTS.filter(c => !c.isHeader);

  // Calculate Running Balance and Apply Filters
  const transactionsWithBalance = useMemo(() => {
    // 1. Sort by date
    const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // 2. Calculate running balance on the full sorted list FIRST
    let balance = 0;
    const withBalance = sorted.map(t => {
      if (t.type === TransactionType.INCOME) {
        balance += t.amount;
      } else {
        // Expense, ADV, TRF all reduce balance
        balance -= t.amount;
      }
      return { ...t, runningBalance: balance };
    });

    // 3. Apply filters
    return withBalance.filter(tx => {
       const categoryName = CHART_OF_ACCOUNTS.find(c => c.code === tx.accountCode)?.category || '';
       
       // Specific Column Filters
       const matchesVoucher = tx.voucherNumber.toLowerCase().includes(filters.voucher.toLowerCase());
       const matchesActivity = (tx.activity || '').toLowerCase().includes(filters.activity.toLowerCase());
       const matchesClause = tx.accountCode.toLowerCase().includes(filters.clause.toLowerCase());
       const matchesCategory = categoryName.toLowerCase().includes(filters.category.toLowerCase());

       // Global Search
       const searchLower = searchQuery.toLowerCase();
       const matchesSearch = 
           tx.description.toLowerCase().includes(searchLower) ||
           tx.payeeOrPayer.toLowerCase().includes(searchLower) ||
           tx.amount.toString().includes(searchLower) || 
           (tx.chequeNumber || '').toLowerCase().includes(searchLower);

       return matchesVoucher && matchesActivity && matchesClause && matchesCategory && matchesSearch;
    });
  }, [transactions, filters, searchQuery]);

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
            <div>
                <h2 className="text-xl font-bold text-gray-800">General Ledger</h2>
                <p className="text-xs text-gray-500">Manage and view all financial transactions.</p>
            </div>
            <button 
                onClick={handleRefresh}
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                title="Refresh App"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
            </button>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
             <div className="relative w-full md:w-64">
                <input 
                    type="text" 
                    placeholder="Search transactions..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
             </div>
            <button
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-sm transition-colors text-sm font-medium flex items-center gap-2 whitespace-nowrap"
            >
            <span>+ New Transaction</span>
            </button>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
              {/* Header Row */}
              <tr>
                <th className="px-3 py-4 whitespace-nowrap">Date</th>
                <th className="px-3 py-4 whitespace-nowrap min-w-[100px]">Voucher #</th>
                <th className="px-3 py-4 whitespace-nowrap">Cheque #</th>
                <th className="px-3 py-4 whitespace-nowrap min-w-[120px]">Activity</th>
                <th className="px-3 py-4 whitespace-nowrap min-w-[80px]">Clause</th>
                <th className="px-3 py-4 min-w-[150px]">Cost Category</th>
                <th className="px-3 py-4 min-w-[200px]">Description</th>
                <th className="px-3 py-4 text-right whitespace-nowrap">Total Cost</th>
                <th className="px-3 py-4 text-right whitespace-nowrap">Deposit</th>
                <th className="px-3 py-4 text-right whitespace-nowrap">Balance</th>
                <th className="px-3 py-4 text-center">Action</th>
              </tr>
              {/* Filter Row */}
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-2 py-2"></th>
                <th className="px-2 py-2">
                  <input type="text" name="voucher" placeholder="Filter..." value={filters.voucher} onChange={handleFilterChange} className="w-full p-1 border border-gray-300 rounded text-xs focus:border-blue-500 focus:outline-none"/>
                </th>
                <th className="px-2 py-2"></th>
                <th className="px-2 py-2">
                   <input type="text" name="activity" placeholder="Filter..." value={filters.activity} onChange={handleFilterChange} className="w-full p-1 border border-gray-300 rounded text-xs focus:border-blue-500 focus:outline-none"/>
                </th>
                <th className="px-2 py-2">
                   <input type="text" name="clause" placeholder="Filter..." value={filters.clause} onChange={handleFilterChange} className="w-full p-1 border border-gray-300 rounded text-xs focus:border-blue-500 focus:outline-none"/>
                </th>
                <th className="px-2 py-2">
                   <input type="text" name="category" placeholder="Filter..." value={filters.category} onChange={handleFilterChange} className="w-full p-1 border border-gray-300 rounded text-xs focus:border-blue-500 focus:outline-none"/>
                </th>
                <th className="px-2 py-2" colSpan={5}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactionsWithBalance.length === 0 ? (
                 <tr><td colSpan={11} className="text-center py-8 text-gray-400">No matching transactions found.</td></tr>
              ) : (
                transactionsWithBalance.map((tx) => {
                    const categoryName = CHART_OF_ACCOUNTS.find(c => c.code === tx.accountCode)?.category || 'Unknown';
                    const isExpenseType = tx.type === TransactionType.EXPENSE || tx.type === TransactionType.ADV || tx.type === TransactionType.TRF;
                    return (
                      <tr key={tx.id} className="hover:bg-gray-50 group">
                        <td className="px-3 py-3 text-gray-700 whitespace-nowrap">{tx.date}</td>
                        <td className="px-3 py-3 text-gray-500 whitespace-nowrap">{tx.voucherNumber}</td>
                        <td className="px-3 py-3 text-gray-500 whitespace-nowrap">{tx.chequeNumber || '-'}</td>
                        <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{tx.activity || '-'}</td>
                        <td className="px-3 py-3 text-blue-600 font-mono whitespace-nowrap">{tx.accountCode}</td>
                        <td className="px-3 py-3 text-gray-600 text-xs">{categoryName}</td>
                        <td className="px-3 py-3 text-gray-700 font-medium">
                            {tx.description}
                            {(tx.type === TransactionType.ADV || tx.type === TransactionType.TRF) && (
                                <span className="ml-2 text-[10px] bg-gray-100 text-gray-600 px-1 rounded border border-gray-200">
                                    {tx.type}
                                </span>
                            )}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-gray-700">
                            {isExpenseType ? formatCurrency(tx.amount) : '-'}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-gray-700">
                            {tx.type === TransactionType.INCOME ? formatCurrency(tx.amount) : '-'}
                        </td>
                        <td className={`px-3 py-3 text-right font-mono font-bold whitespace-nowrap ${tx.runningBalance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            {formatCurrency(tx.runningBalance)}
                        </td>
                        <td className="px-3 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                                <button 
                                    onClick={() => handleEdit(tx)}
                                    className="text-gray-400 hover:text-blue-600 transition-colors p-1"
                                    title="Edit Transaction"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleDelete(tx.id); }}
                                    className="text-gray-400 hover:text-red-600 transition-colors p-1"
                                    title="Delete Transaction"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                        </td>
                      </tr>
                    );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Undo Toast */}
      {showUndoToast && (
          <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-4 z-50 animate-bounce-in">
              <span>Transaction deleted.</span>
              <button 
                onClick={handleUndo}
                className="text-yellow-400 font-bold hover:text-yellow-300 underline"
              >
                  Undo
              </button>
              <button onClick={() => setShowUndoToast(false)} className="text-gray-500 hover:text-gray-300 ml-2">✕</button>
          </div>
      )}

      {/* Add/Edit Transaction Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800">
                  {editingId ? 'Edit Transaction' : 'Record Transaction'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input type="date" name="date" required value={formData.date} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select name="type" value={formData.type} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none">
                    <option value={TransactionType.EXPENSE}>Expense (Total Cost)</option>
                    <option value={TransactionType.INCOME}>Income (Deposit)</option>
                    <option value={TransactionType.ADV}>ADV (Advance)</option>
                    <option value={TransactionType.TRF}>TRF (Transfer)</option>
                  </select>
                </div>
              </div>

               {/* Activity Field */}
              <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Activity</label>
                 <input type="text" name="activity" value={formData.activity} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="e.g., Workshop A" />
              </div>

              <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Payee / Payer</label>
                 <input type="text" name="payeeOrPayer" required value={formData.payeeOrPayer} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Who is this to/from?" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <div className="flex gap-2">
                    <input type="text" name="description" required value={formData.description} onChange={handleInputChange} className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Details of the transaction" />
                    <button type="button" onClick={handleSmartCategorize} disabled={isSuggesting || !formData.description} className="bg-purple-100 text-purple-700 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-purple-200 transition-colors disabled:opacity-50">
                        {isSuggesting ? 'Thinking...' : 'AI Categorize'}
                    </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category (Clause)</label>
                    <select name="accountCode" required value={formData.accountCode} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none">
                        <option value="">Select Category</option>
                        {filteredAccounts.map(acc => (
                            <option key={acc.code} value={acc.code}>
                                {acc.code} - {acc.category}
                            </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount (GHS)</label>
                    <input type="number" step="0.01" name="amount" required value={formData.amount} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Voucher No.</label>
                    <input type="text" name="voucherNumber" value={formData.voucherNumber} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cheque No. (Optional)</label>
                    <input type="text" name="chequeNumber" value={formData.chequeNumber || ''} onChange={handleInputChange} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Optional" />
                 </div>
              </div>

              <div className="flex justify-end pt-4 gap-3">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm">
                    {editingId ? 'Update Transaction' : 'Save Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};