import React, { createContext, useContext, useState, useEffect } from 'react';
import { Transaction, BudgetLine, TransactionType } from '../types';
import { MOCK_BUDGET } from '../constants';

interface FinanceContextType {
  transactions: Transaction[];
  addTransaction: (t: Transaction) => void;
  deleteTransaction: (id: string) => void;
  updateTransaction: (t: Transaction) => void;
  budget: BudgetLine[];
  updateBudget: (newBudget: BudgetLine[]) => void;
  getBalance: () => number;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budget, setBudget] = useState<BudgetLine[]>(MOCK_BUDGET);

  // Load from local storage on mount (simple persistence)
  useEffect(() => {
    const savedTx = localStorage.getItem('ngo_transactions');
    if (savedTx) {
      try {
        const parsed = JSON.parse(savedTx);
        // ROBUSTNESS FIX: Ensure all IDs are strings and remove duplicates
        const uniqueMap = new Map();
        parsed.forEach((tx: any) => {
            // Ensure ID exists and is a string
            const safeId = tx.id ? String(tx.id) : crypto.randomUUID();
            // Use Map to deduplicate based on ID
            uniqueMap.set(safeId, { ...tx, id: safeId });
        });
        setTransactions(Array.from(uniqueMap.values()));
      } catch (e) {
        console.error("Failed to parse transactions", e);
      }
    }

    const savedBudget = localStorage.getItem('ngo_budget');
    if (savedBudget) {
      try {
        setBudget(JSON.parse(savedBudget));
      } catch (e) {
        console.error("Failed to parse budget", e);
      }
    }
  }, []);

  // Save to local storage on change
  useEffect(() => {
    localStorage.setItem('ngo_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('ngo_budget', JSON.stringify(budget));
  }, [budget]);

  const addTransaction = (t: Transaction) => {
    // Ensure ID is string
    const newTx = { ...t, id: String(t.id) };
    setTransactions(prev => [newTx, ...prev]);
  };

  const deleteTransaction = (id: string) => {
    // String conversion ensures safe comparison even if IDs are stored as numbers in older data
    setTransactions(prev => prev.filter(t => String(t.id) !== String(id)));
  };

  const updateTransaction = (t: Transaction) => {
    // Ensure ID is string
    const updatedTx = { ...t, id: String(t.id) };
    setTransactions(prev => prev.map(tr => String(tr.id) === String(t.id) ? updatedTx : tr));
  };

  const updateBudget = (newBudget: BudgetLine[]) => {
    setBudget(newBudget);
  };

  const getBalance = () => {
    return transactions.reduce((acc, t) => {
      if (t.type === TransactionType.INCOME) return acc + t.amount;
      if (t.type === TransactionType.EXPENSE) return acc - t.amount;
      if (t.type === TransactionType.ADV) return acc - t.amount;
      if (t.type === TransactionType.TRF) return acc - t.amount;
      return acc;
    }, 0);
  };

  return (
    <FinanceContext.Provider value={{ transactions, addTransaction, deleteTransaction, updateTransaction, budget, updateBudget, getBalance }}>
      {children}
    </FinanceContext.Provider>
  );
};

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (!context) throw new Error("useFinance must be used within FinanceProvider");
  return context;
};