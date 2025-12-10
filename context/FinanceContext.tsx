import React, { createContext, useContext, useState, useEffect } from 'react';
import { Transaction, BudgetLine, TransactionType, ChartOfAccountItem } from '../types';
import { MOCK_BUDGET, DEFAULT_CHART_OF_ACCOUNTS } from '../constants';

interface FinanceContextType {
  transactions: Transaction[];
  addTransaction: (t: Transaction) => void;
  deleteTransaction: (id: string) => void;
  updateTransaction: (t: Transaction) => void;
  overwriteTransactions: (txs: Transaction[]) => void;
  
  chartOfAccounts: ChartOfAccountItem[];
  addAccount: (account: ChartOfAccountItem) => void;
  updateAccount: (account: ChartOfAccountItem) => void;
  deleteAccount: (code: string) => void;

  budget: BudgetLine[];
  updateBudget: (newBudget: BudgetLine[]) => void;
  getBalance: () => number;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [chartOfAccounts, setChartOfAccounts] = useState<ChartOfAccountItem[]>(DEFAULT_CHART_OF_ACCOUNTS);
  const [budget, setBudget] = useState<BudgetLine[]>(MOCK_BUDGET);

  // Load from local storage on mount
  useEffect(() => {
    // Transactions
    const savedTx = localStorage.getItem('ngo_transactions');
    if (savedTx) {
      try {
        const parsed = JSON.parse(savedTx);
        const uniqueMap = new Map();
        parsed.forEach((tx: any) => {
            const safeId = tx.id ? String(tx.id) : crypto.randomUUID();
            uniqueMap.set(safeId, { ...tx, id: safeId });
        });
        setTransactions(Array.from(uniqueMap.values()));
      } catch (e) {
        console.error("Failed to parse transactions", e);
      }
    }

    // Chart of Accounts
    const savedCoA = localStorage.getItem('ngo_coa');
    if (savedCoA) {
      try {
        setChartOfAccounts(JSON.parse(savedCoA));
      } catch (e) {
        console.error("Failed to parse CoA", e);
      }
    }

    // Budget
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
    localStorage.setItem('ngo_coa', JSON.stringify(chartOfAccounts));
  }, [chartOfAccounts]);

  useEffect(() => {
    localStorage.setItem('ngo_budget', JSON.stringify(budget));
  }, [budget]);

  // Transaction Methods
  const addTransaction = (t: Transaction) => {
    const newTx = { ...t, id: String(t.id) };
    setTransactions(prev => [newTx, ...prev]);
  };

  const deleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => String(t.id) !== String(id)));
  };

  const updateTransaction = (t: Transaction) => {
    const updatedTx = { ...t, id: String(t.id) };
    setTransactions(prev => prev.map(tr => String(tr.id) === String(t.id) ? updatedTx : tr));
  };

  const overwriteTransactions = (txs: Transaction[]) => {
      setTransactions(txs);
  };

  // CoA Methods
  const addAccount = (account: ChartOfAccountItem) => {
      setChartOfAccounts(prev => [...prev, account]);
  };

  const updateAccount = (account: ChartOfAccountItem) => {
      setChartOfAccounts(prev => prev.map(a => a.code === account.code ? account : a));
  };

  const deleteAccount = (code: string) => {
      setChartOfAccounts(prev => prev.filter(a => a.code !== code));
  };

  // Budget Methods
  const updateBudget = (newBudget: BudgetLine[]) => {
    setBudget(newBudget);
  };

  const getBalance = () => {
    return transactions.reduce((acc, t) => {
      if (t.type === TransactionType.INCOME || t.type === TransactionType.CONT || t.type === TransactionType.OPENING) {
          return acc + t.amount;
      }
      return acc - t.amount;
    }, 0);
  };

  return (
    <FinanceContext.Provider value={{ 
        transactions, addTransaction, deleteTransaction, updateTransaction, overwriteTransactions,
        chartOfAccounts, addAccount, updateAccount, deleteAccount,
        budget, updateBudget, getBalance 
    }}>
      {children}
    </FinanceContext.Provider>
  );
};

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (!context) throw new Error("useFinance must be used within FinanceProvider");
  return context;
};