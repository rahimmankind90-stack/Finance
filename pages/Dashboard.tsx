import React, { useMemo, useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { TransactionType, TransactionStatus } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#d0ed57'];

export const Dashboard: React.FC = () => {
  const { transactions, getBalance, budget } = useFinance();
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'WHT_ADV'>('OVERVIEW');

  const balance = getBalance();
  
  // Income: STRICTLY Income types (excluding Opening Balance)
  const totalIncome = transactions
    .filter(t => t.type === TransactionType.INCOME || t.type === TransactionType.CONT)
    .reduce((sum, t) => sum + t.amount, 0);
  
  // Expenses: STRICTLY EXPENSE type only. 
  // Excludes ADV, NB, TRF, ITAX, SSEC, WHT, PCA per user request.
  const totalExpenses = transactions
    .filter(t => t.type === TransactionType.EXPENSE)
    .reduce((sum, t) => sum + t.amount, 0);

  // WHT & ADV Data
  const advTransactions = transactions.filter(t => t.type === TransactionType.ADV);
  const whtTransactions = transactions.filter(t => t.type === TransactionType.WHT);

  const outstandingAdv = advTransactions.filter(t => t.status === TransactionStatus.PENDING).reduce((sum, t) => sum + t.amount, 0);
  const totalAdv = advTransactions.reduce((sum, t) => sum + t.amount, 0);
  
  const outstandingWht = whtTransactions.filter(t => t.status === TransactionStatus.PENDING).reduce((sum, t) => sum + t.amount, 0);
  const totalWht = whtTransactions.reduce((sum, t) => sum + t.amount, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(amount);
  };

  // Prepare data for expense by category
  const expenseByCategory = useMemo(() => {
    const data: Record<string, number> = {};
    transactions
      .filter(t => t.type === TransactionType.EXPENSE)
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
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200">
           <button
               className={`px-6 py-3 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'OVERVIEW' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
               onClick={() => setActiveTab('OVERVIEW')}
           >
               Overview
           </button>
           <button
               className={`px-6 py-3 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === 'WHT_ADV' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
               onClick={() => setActiveTab('WHT_ADV')}
           >
               WHT & ADV
           </button>
       </div>

      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6 animate-fade-in">
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
                <p className="text-sm font-medium text-gray-500">Total Project Expenses (YTD)</p>
                <p className="text-3xl font-bold mt-2 text-orange-600">{formatCurrency(totalExpenses)}</p>
                <p className="text-xs text-gray-400 mt-1">*Excludes Advances, Taxes, Non-billables</p>
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
      )}

      {activeTab === 'WHT_ADV' && (
          <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                      <p className="text-sm font-medium text-gray-500">Outstanding Advances</p>
                      <p className="text-2xl font-bold mt-2 text-blue-600">{formatCurrency(outstandingAdv)}</p>
                      <p className="text-xs text-gray-400 mt-1">Pending Clearance</p>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                      <p className="text-sm font-medium text-gray-500">Total Advances (YTD)</p>
                      <p className="text-2xl font-bold mt-2 text-gray-700">{formatCurrency(totalAdv)}</p>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                      <p className="text-sm font-medium text-gray-500">Unpaid WHT</p>
                      <p className="text-2xl font-bold mt-2 text-red-600">{formatCurrency(outstandingWht)}</p>
                      <p className="text-xs text-gray-400 mt-1">Due to Authority</p>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                      <p className="text-sm font-medium text-gray-500">Total WHT (YTD)</p>
                      <p className="text-2xl font-bold mt-2 text-gray-700">{formatCurrency(totalWht)}</p>
                  </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Advances List */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                      <div className="p-4 border-b border-gray-100 bg-gray-50">
                          <h3 className="font-semibold text-gray-700">Recent Advances</h3>
                      </div>
                      <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left">
                              <thead className="bg-gray-50 text-gray-600 font-medium">
                                  <tr>
                                      <th className="px-4 py-3">Date</th>
                                      <th className="px-4 py-3">Payee</th>
                                      <th className="px-4 py-3 text-right">Amount</th>
                                      <th className="px-4 py-3">Status</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                  {advTransactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10).map(t => (
                                      <tr key={t.id} className="hover:bg-gray-50">
                                          <td className="px-4 py-3">{t.date}</td>
                                          <td className="px-4 py-3">{t.payeeOrPayer}</td>
                                          <td className="px-4 py-3 text-right font-medium">{formatCurrency(t.amount)}</td>
                                          <td className="px-4 py-3">
                                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${t.status === TransactionStatus.PENDING ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                                                  {t.status}
                                              </span>
                                          </td>
                                      </tr>
                                  ))}
                                  {advTransactions.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No advances found.</td></tr>}
                              </tbody>
                          </table>
                      </div>
                  </div>

                  {/* WHT List */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                      <div className="p-4 border-b border-gray-100 bg-gray-50">
                          <h3 className="font-semibold text-gray-700">Recent WHT Deductions</h3>
                      </div>
                      <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left">
                              <thead className="bg-gray-50 text-gray-600 font-medium">
                                  <tr>
                                      <th className="px-4 py-3">Date</th>
                                      <th className="px-4 py-3">Authority/Payee</th>
                                      <th className="px-4 py-3 text-right">Amount</th>
                                      <th className="px-4 py-3">Status</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                  {whtTransactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10).map(t => (
                                      <tr key={t.id} className="hover:bg-gray-50">
                                          <td className="px-4 py-3">{t.date}</td>
                                          <td className="px-4 py-3">{t.payeeOrPayer}</td>
                                          <td className="px-4 py-3 text-right font-medium">{formatCurrency(t.amount)}</td>
                                          <td className="px-4 py-3">
                                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${t.status === TransactionStatus.PENDING ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                                  {t.status === TransactionStatus.PENDING ? 'Unpaid' : 'Paid'}
                                              </span>
                                          </td>
                                      </tr>
                                  ))}
                                  {whtTransactions.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No WHT records found.</td></tr>}
                              </tbody>
                          </table>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};