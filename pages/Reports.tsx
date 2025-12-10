import React, { useState, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext';
import { TransactionType, BudgetLine, TransactionStatus } from '../types';
import { analyzeVariance } from '../services/geminiService';

enum ReportType {
    VARIANCE = 'VARIANCE', 
    INCOME_STATEMENT = 'INCOME_STATEMENT',
    TRIAL_BALANCE = 'TRIAL_BALANCE',
    BANK_RECONCILIATION = 'BANK_RECONCILIATION'
}

export const Reports: React.FC = () => {
    const { transactions, budget, updateBudget, chartOfAccounts } = useFinance();
    const [activeTab, setActiveTab] = useState<ReportType>(ReportType.VARIANCE);
    const [aiAnalysis, setAiAnalysis] = useState<string>("");
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    
    // Budget Management State
    const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
    const [tempBudget, setTempBudget] = useState<BudgetLine[]>([]);

    // Bank Rec State
    const [bankStatementBalance, setBankStatementBalance] = useState<number>(0);

    // Filter State
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const [dateRange, setDateRange] = useState({
        start: firstDay.toISOString().split('T')[0],
        end: today.toISOString().split('T')[0]
    });

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(amount);
    };

    // Calculate number of months involved in date range for budget pro-rating
    const monthDiff = useMemo(() => {
        const d1 = new Date(dateRange.start);
        const d2 = new Date(dateRange.end);
        let months = (d2.getFullYear() - d1.getFullYear()) * 12;
        months -= d1.getMonth();
        months += d2.getMonth();
        return Math.max(months + 1, 1); // At least 1 month
    }, [dateRange]);

    // Helpers
    const isIncomeType = (type: TransactionType) => type === TransactionType.INCOME || type === TransactionType.CONT;
    const isOpeningType = (type: TransactionType) => type === TransactionType.OPENING;
    // Strict definition per user request: ADV, WHT, NB, etc are NOT expenses in reports
    const isExpenseType = (type: TransactionType) => type === TransactionType.EXPENSE;
    const isLiabilityType = (type: TransactionType) => 
        type === TransactionType.ITAX || type === TransactionType.WHT || type === TransactionType.SSEC || type === TransactionType.NB;

    // -- Data Aggregation Logic --
    
    // Budget vs Actuals Data
    // Exclude OPENING, ADV, WHT etc from Actuals
    const budgetVsActualsData = useMemo(() => {
        return chartOfAccounts.filter(c => !c.isHeader).map(cat => {
            // Filter actuals by date range
            // Treat ONLY TransactionType.EXPENSE as "Actual Spend"
            const actual = transactions
                .filter(t => {
                    return t.accountCode === cat.code && 
                           isExpenseType(t.type) &&
                           t.date >= dateRange.start && 
                           t.date <= dateRange.end;
                })
                .reduce((sum, t) => sum + t.amount, 0);
            
            const budgetItem = budget.find(b => b.code === cat.code);
            const monthlyBudget = budgetItem ? budgetItem.monthlyBudget : 0;
            const totalBudget = monthlyBudget * monthDiff;
            
            return {
                code: cat.code,
                category: cat.category,
                actual,
                budget: totalBudget,
                monthlyBudget, // For reference
                variance: totalBudget - actual,
                variancePercent: totalBudget > 0 ? ((totalBudget - actual) / totalBudget) * 100 : 0
            };
        }).sort((a,b) => (Math.abs(a.variance) > Math.abs(b.variance) ? -1 : 1));
    }, [transactions, budget, dateRange, monthDiff, chartOfAccounts]);

    // Trial Balance Data
    // Include all flows
    const trialBalanceData = useMemo(() => {
        const items = chartOfAccounts.map(account => {
            if (account.isHeader) {
                return { ...account, debit: 0, credit: 0, isHeader: true };
            }

            const txs = transactions.filter(t => t.accountCode === account.code);
            
            // Expenses & Other Outflows (Assets/Liabilities paid) are Debits
            const totalDebits = txs.filter(t => 
                t.type === TransactionType.EXPENSE || 
                t.type === TransactionType.ADV || 
                t.type === TransactionType.PCA ||
                t.type === TransactionType.NB ||
                t.type === TransactionType.TRF ||
                t.type === TransactionType.ITAX || // Assuming payment of tax
                t.type === TransactionType.WHT ||
                t.type === TransactionType.SSEC
            ).reduce((sum, t) => sum + t.amount, 0);
            
            // Income and Opening are Credits
            const totalCredits = txs.filter(t => isIncomeType(t.type) || isOpeningType(t.type)).reduce((sum, t) => sum + t.amount, 0);
            
            let debit = 0;
            let credit = 0;
            
            if (totalDebits > totalCredits) {
                debit = totalDebits - totalCredits;
            } else {
                credit = totalCredits - totalDebits;
            }

            return {
                ...account,
                debit,
                credit,
                isHeader: false
            };
        });

        const totalDebits = items.reduce((sum, item) => sum + item.debit, 0);
        const totalCredits = items.reduce((sum, item) => sum + item.credit, 0);

        return { items, totalDebits, totalCredits };
    }, [transactions, chartOfAccounts]);

    // Bank Reconciliation Data
    // Ledger Balance must include ALL transactions that affect cash
    const bankRecData = useMemo(() => {
        const endDate = dateRange.end;

        // 1. Transactions up to the report date
        const relevantTransactions = transactions.filter(t => t.date <= endDate);

        // 2. Ledger Balance Calculation (Includes everything affecting cash)
        const ledgerBalance = relevantTransactions.reduce((acc, t) => {
            if (isIncomeType(t.type) || isOpeningType(t.type)) return acc + t.amount;
            return acc - t.amount;
        }, 0);

        // 3. Unreconciled Items (Status != RECONCILED)
        const unreconciled = relevantTransactions.filter(t => t.status !== TransactionStatus.RECONCILED);
        const reconciled = relevantTransactions.filter(t => t.status === TransactionStatus.RECONCILED);

        // Unpresented Cheques (All outflows)
        const unpresentedCheques = unreconciled.filter(t => !isIncomeType(t.type) && !isOpeningType(t.type));
        // Outstanding Deposits (All inflows)
        const outstandingDeposits = unreconciled.filter(t => isIncomeType(t.type) || isOpeningType(t.type));

        const totalUnpresented = unpresentedCheques.reduce((sum, t) => sum + t.amount, 0);
        const totalOutstanding = outstandingDeposits.reduce((sum, t) => sum + t.amount, 0);

        // 4. Projected Bank Balance
        const projectedBankBalance = ledgerBalance + totalUnpresented - totalOutstanding;

        return {
            ledgerBalance,
            unreconciled,
            reconciled,
            unpresentedCheques,
            outstandingDeposits,
            totalUnpresented,
            totalOutstanding,
            projectedBankBalance,
            difference: projectedBankBalance - bankStatementBalance
        };
    }, [transactions, dateRange.end, bankStatementBalance]);


    const handleAnalysis = async () => {
        setIsAnalyzing(true);
        // Send top 10 items to save tokens
        const summary = budgetVsActualsData.slice(0, 10);
        const result = await analyzeVariance(summary);
        setAiAnalysis(result);
        setIsAnalyzing(false);
    };

    const downloadCSV = () => {
        let headers: string[] = [];
        let rows: any[] = [];
        let fileName = `report_${activeTab.toLowerCase()}.csv`;

        if (activeTab === ReportType.VARIANCE) {
            headers = ['Code', 'Category', 'Actual', 'Pro-rated Budget', 'Variance', 'Variance %'];
            rows = budgetVsActualsData.map(v => [v.code, v.category, v.actual, v.budget, v.variance, v.variancePercent.toFixed(2)]);
        } else if (activeTab === ReportType.INCOME_STATEMENT) {
             const income = transactions.filter(t => isIncomeType(t.type)).reduce((s,t) => s+t.amount, 0);
             const expense = transactions.filter(t => isExpenseType(t.type)).reduce((s,t) => s+t.amount, 0);
             headers = ['Item', 'Amount'];
             rows = [['Total Income', income], ['Total Expense', expense], ['Net Result', income-expense]];
        } else if (activeTab === ReportType.TRIAL_BALANCE) {
             headers = ['Code', 'Description', 'Debit', 'Credit'];
             rows = trialBalanceData.items.map(i => [i.code, i.category, i.debit, i.credit]);
             rows.push(['TOTAL', '', trialBalanceData.totalDebits, trialBalanceData.totalCredits]);
        } else if (activeTab === ReportType.BANK_RECONCILIATION) {
             fileName = `bank_reconciliation_${dateRange.end}.csv`;
             headers = ['Item', 'Amount'];
             rows = [
                 ['Balance as per Ledger', bankRecData.ledgerBalance],
                 ['ADD: Unpresented Cheques', bankRecData.totalUnpresented],
                 ['LESS: Outstanding Deposits', bankRecData.totalOutstanding],
                 ['Projected Bank Balance', bankRecData.projectedBankBalance],
                 ['Actual Statement Balance', bankStatementBalance],
                 ['Difference', bankRecData.difference],
                 [],
                 ['--- Unreconciled Transactions ---'],
                 ...bankRecData.unreconciled.map(t => [`${t.date} - ${t.description} (${t.voucherNumber})`, t.amount])
             ];
        }
        
        const csvContent = "data:text/csv;charset=utf-8," 
            + headers.join(",") + "\n" 
            + rows.map(e => e.join(",")).join("\n");
            
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
    };

    const handlePrint = () => {
        window.print();
    };

    // Budget Management
    const openBudgetModal = () => {
        setTempBudget([...budget]);
        setIsBudgetModalOpen(true);
    }

    const handleBudgetChange = (code: string, val: string) => {
        const amount = parseFloat(val) || 0;
        setTempBudget(prev => {
            const exists = prev.find(b => b.code === code);
            if (exists) {
                return prev.map(b => b.code === code ? { ...b, monthlyBudget: amount } : b);
            } else {
                return [...prev, { code, monthlyBudget: amount }];
            }
        });
    }

    const saveBudgetChanges = () => {
        updateBudget(tempBudget);
        setIsBudgetModalOpen(false);
    }

    const handleBudgetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
             const text = evt.target?.result as string;
             if (!text) return;
             const lines = text.split('\n');
             // Assume CSV: Code, MonthlyAmount
             const newBudgetLines: BudgetLine[] = [];
             lines.forEach(line => {
                 const [code, amt] = line.split(',');
                 if (code && amt) {
                     newBudgetLines.push({ code: code.trim(), monthlyBudget: parseFloat(amt) });
                 }
             });
             // Merge with existing
             updateBudget(newBudgetLines);
             alert(`Uploaded ${newBudgetLines.length} budget lines.`);
        };
        reader.readAsText(file);
    }

    return (
        <div className="space-y-6 print:space-y-4">
            <div className="flex justify-between items-center print:hidden">
                <h2 className="text-xl font-bold text-gray-800">Financial Reports</h2>
                <div className="flex gap-2">
                    <button onClick={downloadCSV} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                        Export CSV
                    </button>
                    <button onClick={handlePrint} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm hover:bg-slate-900 flex items-center gap-2">
                        <svg className="w-4 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        Print / Save PDF
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 print:hidden overflow-x-auto">
                <button
                    onClick={() => setActiveTab(ReportType.VARIANCE)}
                    className={`px-6 py-3 text-sm font-medium whitespace-nowrap ${activeTab === ReportType.VARIANCE ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Budget vs. Actuals
                </button>
                <button
                     onClick={() => setActiveTab(ReportType.INCOME_STATEMENT)}
                     className={`px-6 py-3 text-sm font-medium whitespace-nowrap ${activeTab === ReportType.INCOME_STATEMENT ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Income Statement
                </button>
                 <button
                     onClick={() => setActiveTab(ReportType.TRIAL_BALANCE)}
                     className={`px-6 py-3 text-sm font-medium whitespace-nowrap ${activeTab === ReportType.TRIAL_BALANCE ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Trial Balance
                </button>
                <button
                     onClick={() => setActiveTab(ReportType.BANK_RECONCILIATION)}
                     className={`px-6 py-3 text-sm font-medium whitespace-nowrap ${activeTab === ReportType.BANK_RECONCILIATION ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Bank Reconciliation
                </button>
            </div>

            {/* AI Analysis Box */}
            {aiAnalysis && (
                <div className="bg-purple-50 p-6 rounded-xl border border-purple-100 animate-fade-in print:border-gray-300">
                    <h4 className="font-bold text-purple-800 mb-2 flex items-center gap-2 print:text-black">
                        AI Insight
                    </h4>
                    <p className="text-sm text-purple-900 whitespace-pre-line print:text-black">{aiAnalysis}</p>
                </div>
            )}

            {/* Content */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden print:shadow-none print:border-none">
                
                {/* BUDGET VS ACTUALS TAB */}
                {activeTab === ReportType.VARIANCE && (
                    <div className="print:p-4">
                        <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-wrap gap-4 items-end justify-between print:hidden">
                            <div className="flex gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
                                    <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="p-2 border border-gray-300 rounded text-sm"/>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
                                    <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="p-2 border border-gray-300 rounded text-sm"/>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={openBudgetModal} className="px-3 py-2 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50 text-gray-700">
                                    Manage Budget
                                </button>
                                <button 
                                    onClick={handleAnalysis} 
                                    disabled={isAnalyzing}
                                    className="px-3 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isAnalyzing ? 'Analyzing...' : 'AI Analyze'}
                                </button>
                            </div>
                        </div>

                        <h1 className="hidden print:block text-2xl font-bold mb-4 text-center">Budget vs. Actuals Report</h1>
                        <p className="hidden print:block text-center text-sm mb-6 text-gray-500">Period: {dateRange.start} to {dateRange.end}</p>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-600 font-medium print:bg-gray-100">
                                    <tr>
                                        <th className="px-6 py-4">Code</th>
                                        <th className="px-6 py-4">Category</th>
                                        <th className="px-6 py-4 text-right">Actual Expenses</th>
                                        <th className="px-6 py-4 text-right">Budget ({monthDiff} mo)</th>
                                        <th className="px-6 py-4 text-right">Variance</th>
                                        <th className="px-6 py-4 text-right">%</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {budgetVsActualsData.filter(v => v.actual > 0 || v.budget > 0).map(row => (
                                        <tr key={row.code} className="hover:bg-gray-50 print:hover:bg-white">
                                            <td className="px-6 py-3 font-mono text-gray-500 text-xs">{row.code}</td>
                                            <td className="px-6 py-3 text-gray-700">{row.category}</td>
                                            <td className="px-6 py-3 text-right font-medium">{formatCurrency(row.actual)}</td>
                                            <td className="px-6 py-3 text-right text-gray-500">{formatCurrency(row.budget)}</td>
                                            <td className={`px-6 py-3 text-right font-bold ${row.variance < 0 ? 'text-red-500' : 'text-green-500'} print:text-black`}>
                                                {formatCurrency(row.variance)}
                                            </td>
                                            <td className="px-6 py-3 text-right text-xs text-gray-500">
                                                {row.variancePercent.toFixed(1)}%
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* INCOME STATEMENT TAB */}
                {activeTab === ReportType.INCOME_STATEMENT && (
                     <div className="p-8 max-w-3xl mx-auto print:max-w-none">
                        <h3 className="text-center text-2xl font-bold mb-8 uppercase tracking-wide">Statement of Income & Expenditure</h3>
                        
                        <div className="space-y-4">
                            <div className="flex justify-between font-bold text-lg border-b border-gray-300 pb-2">
                                <span>INCOME</span>
                                <span>Amount (GHS)</span>
                            </div>
                            {transactions.filter(t => isIncomeType(t.type)).map(t => (
                                <div key={t.id} className="flex justify-between text-gray-600 pl-4 print:text-black">
                                    <span>{t.accountCode} - {t.description}</span>
                                    <span>{formatCurrency(t.amount)}</span>
                                </div>
                            ))}
                            <div className="flex justify-between font-bold text-lg pt-4">
                                <span>Total Income</span>
                                <span className="text-blue-600 print:text-black">{formatCurrency(transactions.filter(t => isIncomeType(t.type)).reduce((s, t) => s + t.amount, 0))}</span>
                            </div>

                            <div className="flex justify-between font-bold text-lg border-b border-gray-300 pb-2 mt-8">
                                <span>EXPENDITURE</span>
                                <span></span>
                            </div>
                             {budgetVsActualsData.filter(v => v.actual > 0).map(row => (
                                <div key={row.code} className="flex justify-between text-gray-600 pl-4 print:text-black">
                                    <span>{row.code} - {row.category}</span>
                                    <span>{formatCurrency(row.actual)}</span>
                                </div>
                            ))}
                             <div className="flex justify-between font-bold text-lg pt-4">
                                <span>Total Expenditure</span>
                                <span className="text-orange-600 print:text-black">{formatCurrency(transactions.filter(t => isExpenseType(t.type)).reduce((s, t) => s + t.amount, 0))}</span>
                            </div>

                             <div className="flex justify-between font-bold text-xl pt-8 border-t-2 border-gray-800 mt-8">
                                <span>Net Surplus / (Deficit)</span>
                                <span className={
                                    (transactions.reduce((acc, t) => {
                                        if (isIncomeType(t.type)) return acc + t.amount;
                                        if (isExpenseType(t.type)) return acc - t.amount;
                                        return acc;
                                    }, 0)) >= 0 ? 'text-green-600 print:text-black' : 'text-red-600 print:text-black'
                                }>
                                    {formatCurrency(transactions.reduce((acc, t) => {
                                        if (isIncomeType(t.type)) return acc + t.amount;
                                        if (isExpenseType(t.type)) return acc - t.amount;
                                        return acc;
                                    }, 0))}
                                </span>
                            </div>
                        </div>
                     </div>
                )}
                 
                 {/* TRIAL BALANCE TAB */}
                 {activeTab === ReportType.TRIAL_BALANCE && (
                    <div className="print:p-8">
                        <div className="p-8 max-w-4xl mx-auto print:max-w-none">
                            <h3 className="text-center text-2xl font-bold mb-8 uppercase tracking-wide">Trial Balance</h3>
                            <p className="text-center text-sm text-gray-500 mb-6">As of {new Date().toLocaleDateString()}</p>

                            <div className="overflow-hidden border border-gray-200 rounded-lg">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-100 text-gray-700 font-bold border-b border-gray-300">
                                        <tr>
                                            <th className="px-6 py-3 w-32">Code</th>
                                            <th className="px-6 py-3">Description</th>
                                            <th className="px-6 py-3 text-right w-40">Debit</th>
                                            <th className="px-6 py-3 text-right w-40">Credit</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {trialBalanceData.items.map((item, idx) => (
                                            item.isHeader ? (
                                                <tr key={idx} className="bg-gray-50 font-bold text-gray-800">
                                                    <td className="px-6 py-3" colSpan={4}>{item.code} {item.category}</td>
                                                </tr>
                                            ) : (item.debit > 0 || item.credit > 0) ? (
                                                <tr key={idx} className="hover:bg-blue-50">
                                                    <td className="px-6 py-2 text-gray-500 font-mono text-xs">{item.code}</td>
                                                    <td className="px-6 py-2 text-gray-700">{item.category}</td>
                                                    <td className="px-6 py-2 text-right font-mono">{item.debit > 0 ? formatCurrency(item.debit) : '-'}</td>
                                                    <td className="px-6 py-2 text-right font-mono">{item.credit > 0 ? formatCurrency(item.credit) : '-'}</td>
                                                </tr>
                                            ) : null
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-100 font-bold text-gray-900 border-t border-gray-300">
                                        <tr>
                                            <td className="px-6 py-4" colSpan={2}>TOTAL</td>
                                            <td className="px-6 py-4 text-right font-mono">{formatCurrency(trialBalanceData.totalDebits)}</td>
                                            <td className="px-6 py-4 text-right font-mono">{formatCurrency(trialBalanceData.totalCredits)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    </div>
                 )}

                 {/* BANK RECONCILIATION TAB */}
                 {activeTab === ReportType.BANK_RECONCILIATION && (
                     <div className="print:p-8">
                         <div className="p-6 bg-gray-50 border-b border-gray-200 print:hidden">
                            <div className="flex flex-col md:flex-row gap-6 items-end">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Reconciliation Date</label>
                                    <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="p-2 border border-gray-300 rounded w-full"/>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Statement Ending Balance</label>
                                    <input type="number" step="0.01" value={bankStatementBalance} onChange={e => setBankStatementBalance(parseFloat(e.target.value))} className="p-2 border border-gray-300 rounded w-full" placeholder="Enter balance from bank..."/>
                                </div>
                            </div>
                         </div>

                         <div className="p-6 max-w-4xl mx-auto">
                             <div className="text-center mb-8">
                                <h2 className="text-2xl font-bold text-gray-800 uppercase">Bank Reconciliation Statement</h2>
                                <p className="text-gray-500">As of {dateRange.end}</p>
                             </div>

                             <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-8 print:shadow-none print:border-gray-800">
                                 <div className="flex justify-between py-2 border-b border-gray-100">
                                     <span className="font-semibold text-gray-700">Balance as per General Ledger</span>
                                     <span className="font-mono font-bold">{formatCurrency(bankRecData.ledgerBalance)}</span>
                                 </div>
                                 <div className="py-2 pl-4 text-gray-600">
                                     <div className="flex justify-between py-1">
                                         <span>ADD: Unpresented Cheques (Total)</span>
                                         <span className="font-mono">{formatCurrency(bankRecData.totalUnpresented)}</span>
                                     </div>
                                     <div className="flex justify-between py-1">
                                         <span>LESS: Outstanding Deposits (Total)</span>
                                         <span className="font-mono">({formatCurrency(bankRecData.totalOutstanding)})</span>
                                     </div>
                                 </div>
                                 <div className="flex justify-between py-3 border-t border-gray-200 mt-2 bg-gray-50 px-2 rounded print:bg-white print:border-t-2 print:border-black">
                                     <span className="font-bold text-gray-800">Projected Bank Balance</span>
                                     <span className="font-mono font-bold text-blue-800">{formatCurrency(bankRecData.projectedBankBalance)}</span>
                                 </div>
                                 <div className="flex justify-between py-3 border-t border-gray-100 px-2">
                                     <span className="text-gray-600">Actual Bank Statement Balance (Input)</span>
                                     <span className="font-mono">{formatCurrency(bankStatementBalance)}</span>
                                 </div>
                                 <div className="flex justify-between py-2 px-2">
                                     <span className="font-medium text-gray-500">Unreconciled Difference</span>
                                     <span className={`font-mono font-bold ${Math.abs(bankRecData.difference) < 0.01 ? 'text-green-500' : 'text-red-500'}`}>
                                         {formatCurrency(bankRecData.difference)}
                                     </span>
                                 </div>
                             </div>

                             {/* Breakdown Lists */}
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 print:grid-cols-2">
                                 <div>
                                     <h4 className="font-bold text-gray-700 mb-3 border-b border-gray-200 pb-2">Unreconciled Items</h4>
                                     <div className="space-y-2 text-sm">
                                         {bankRecData.unreconciled.length === 0 ? (
                                             <p className="text-gray-400 italic">No unreconciled items.</p>
                                         ) : (
                                             bankRecData.unreconciled.map(t => (
                                                 <div key={t.id} className="flex justify-between">
                                                     <span className="text-gray-600 truncate w-2/3" title={t.description}>{t.date} - {t.description}</span>
                                                     <span className="font-mono text-gray-800">{formatCurrency(t.amount)}</span>
                                                 </div>
                                             ))
                                         )}
                                     </div>
                                 </div>

                                 <div>
                                     <h4 className="font-bold text-gray-700 mb-3 border-b border-gray-200 pb-2">Matched (Reconciled) Items</h4>
                                     <div className="space-y-2 text-sm opacity-75">
                                         {bankRecData.reconciled.length === 0 ? (
                                             <p className="text-gray-400 italic">No matched items in this period.</p>
                                         ) : (
                                             bankRecData.reconciled.map(t => (
                                                 <div key={t.id} className="flex justify-between text-green-700">
                                                     <span className="truncate w-2/3" title={t.description}>{t.date} - {t.description}</span>
                                                     <span className="font-mono">{formatCurrency(t.amount)}</span>
                                                 </div>
                                             ))
                                         )}
                                     </div>
                                 </div>
                             </div>
                         </div>
                     </div>
                 )}
            </div>

            {/* Manage Budget Modal */}
            {isBudgetModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 print:hidden">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                         <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">Manage Monthly Budget</h3>
                                <p className="text-xs text-gray-500">Set the expected monthly spend for each category.</p>
                            </div>
                            <button onClick={() => setIsBudgetModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        
                        <div className="p-4 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                            <span className="text-sm text-blue-800 font-medium">Or upload a CSV file (Format: Code,MonthlyAmount)</span>
                            <input type="file" accept=".csv" onChange={handleBudgetUpload} className="text-xs file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"/>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                                {chartOfAccounts.filter(c => !c.isHeader).map(cat => {
                                    const val = tempBudget.find(b => b.code === cat.code)?.monthlyBudget || 0;
                                    return (
                                        <div key={cat.code} className="flex justify-between items-center border-b border-gray-100 pb-2">
                                            <div className="flex-1 pr-4">
                                                <span className="text-xs font-mono text-blue-500">{cat.code}</span>
                                                <p className="text-sm text-gray-700 truncate">{cat.category}</p>
                                            </div>
                                            <input 
                                                type="number" 
                                                value={val} 
                                                onChange={(e) => handleBudgetChange(cat.code, e.target.value)}
                                                className="w-24 p-1 border border-gray-300 rounded text-right text-sm focus:ring-1 focus:ring-blue-500"
                                            />
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
                            <button onClick={() => setIsBudgetModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                            <button onClick={saveBudgetChanges} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save Changes</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};