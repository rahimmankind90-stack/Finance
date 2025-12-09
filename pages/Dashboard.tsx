import React, { useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { TransactionType } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export const Dashboard: React.FC = () => {
  const { transactions, getBalance, budget } = useFinance();

  const balance = getBalance();
  const totalIncome = transactions.filter(t => t.type === TransactionType.INCOME).reduce((sum, t) => sum + t.amount, 0);
  
  // Expenses now include regular Expenses, Advances (ADV), and Transfers (TRF) out
  const totalExpenses = transactions
    .filter(t => t.type === TransactionType.EXPENSE || t.type === TransactionType.ADV || t.type === TransactionType.TRF)
    .reduce((sum, t) => sum + t.amount, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(amount);
  };

  // Prepare data for expense by category
  const expenseByCategory = useMemo(() => {
    const data: Record<string, number> = {};
    transactions
      .filter(t => t.type === TransactionType.EXPENSE || t.type === TransactionType.ADV || t.type === TransactionType.TRF)
      .forEach(t => {
        // Group by main category (first 3-5 chars for brevity)
        const key = t.accountCode.split(' ')[0] || 'Misc';
        data[key] = (data[key] || 0) + t.amount;
      });
    return Object.entries(data).map(([name, value]) => ({ name, value }));
  }, [transactions]);

  // Last 6 months trend (simulated grouping)
  const monthlyTrend = useMemo(() => {
    // In a real app, group by actual month. Here we just take last 5 items for demo visual
    return [
      { name: 'Jan', income: 4000, expense: 2400 },
      { name: 'Feb', income: 3000, expense: 1398 },
      { name: 'Mar', income: 2000, expense: 9800 },
      { name: 'Apr', income: 2780, expense: 3908 },
      { name: 'May', income: 1890, expense: 4800 },
      { name: 'Jun', income: 2390, expense: 3800 },
    ];
  }, []);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <p className="text-sm font-medium text-gray-500">Current Balance</p>
          <p className={`text-3xl font-bold mt-2 ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(balance)}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <p className="text-sm font-medium text-gray-500">Total Income (YTD)</p>
          <p className="text-3xl font-bold mt-2 text-blue-600">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <p className="text-sm font-medium text-gray-500">Total Expenses (YTD)</p>
          <p className="text-3xl font-bold mt-2 text-orange-600">{formatCurrency(totalExpenses)}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Income vs Expense Trend</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip cursor={{fill: '#f3f4f6'}} />
              <Legend />
              <Bar dataKey="income" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-96">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Expenses by Category Code</h3>
          {expenseByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseByCategory}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                >
                  {expenseByCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              No expense data yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
};