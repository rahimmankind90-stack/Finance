import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { ChartOfAccountItem } from '../types';

export const Settings: React.FC = () => {
    const { chartOfAccounts, addAccount, updateAccount, deleteAccount } = useFinance();
    const [isEditing, setIsEditing] = useState(false);
    const [editCode, setEditCode] = useState<string | null>(null);
    
    // Form State
    const [formData, setFormData] = useState<ChartOfAccountItem>({
        code: '',
        category: '',
        isHeader: false
    });

    const resetForm = () => {
        setFormData({ code: '', category: '', isHeader: false });
        setIsEditing(false);
        setEditCode(null);
    };

    const handleEdit = (item: ChartOfAccountItem) => {
        setFormData(item);
        setIsEditing(true);
        setEditCode(item.code);
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = (code: string) => {
        if (window.confirm(`Are you sure you want to delete account ${code}? This may affect historical reports if transactions exist.`)) {
            deleteAccount(code);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isEditing && editCode) {
            // If code changed during edit, delete old and add new (or just update if logic supported renaming keys, but updateAccount matches by code)
            // Here updateAccount matches by 'code' in the object passed.
            // If the user changed the code, we actually need to delete the old one and add the new one, 
            // OR update the logic. For simplicity, we'll assume update modifies the entry with the MATCHING code.
            // But if user wants to CHANGE the code, we need to handle that.
            
            if (editCode !== formData.code) {
                 // Code changed: Delete old, Add new
                 deleteAccount(editCode);
                 addAccount(formData);
            } else {
                 updateAccount(formData);
            }
        } else {
            // Check if exists
            if (chartOfAccounts.some(c => c.code === formData.code)) {
                alert("Account code already exists!");
                return;
            }
            addAccount(formData);
        }
        resetForm();
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-gray-800">Settings</h2>
                <p className="text-sm text-gray-500">Manage your Chart of Accounts.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form Section */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit">
                    <h3 className="font-semibold text-gray-700 mb-4">{isEditing ? 'Edit Account' : 'Add New Account'}</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Clause</label>
                            <input 
                                type="text" 
                                required 
                                value={formData.code}
                                onChange={e => setFormData({...formData, code: e.target.value})}
                                className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                placeholder="e.g. 1.6.5"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Cost Category</label>
                            <input 
                                type="text" 
                                required 
                                value={formData.category}
                                onChange={e => setFormData({...formData, category: e.target.value})}
                                className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                placeholder="e.g. Office Supplies"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <input 
                                type="checkbox" 
                                id="isHeader"
                                checked={formData.isHeader || false}
                                onChange={e => setFormData({...formData, isHeader: e.target.checked})}
                                className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor="isHeader" className="text-sm text-gray-700">Is Header (Group Title)</label>
                        </div>
                        
                        <div className="flex gap-2 pt-2">
                            <button 
                                type="submit" 
                                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                            >
                                {isEditing ? 'Update' : 'Add Account'}
                            </button>
                            {isEditing && (
                                <button 
                                    type="button" 
                                    onClick={resetForm}
                                    className="px-4 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                {/* List Section */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50">
                         <h3 className="font-semibold text-gray-700">Chart of Accounts List</h3>
                    </div>
                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200 sticky top-0">
                                <tr>
                                    <th className="px-6 py-3">Clause</th>
                                    <th className="px-6 py-3">Cost Category</th>
                                    <th className="px-6 py-3 text-center">Type</th>
                                    <th className="px-6 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {chartOfAccounts.map((item) => (
                                    <tr key={item.code} className={`hover:bg-gray-50 group ${item.isHeader ? 'bg-gray-50/50' : ''}`}>
                                        <td className={`px-6 py-3 font-mono text-xs ${item.isHeader ? 'font-bold text-gray-800' : 'text-blue-600'}`}>
                                            {item.code}
                                        </td>
                                        <td className={`px-6 py-3 ${item.isHeader ? 'font-bold text-gray-800' : 'text-gray-700'}`}>
                                            {item.category}
                                        </td>
                                        <td className="px-6 py-3 text-center">
                                            {item.isHeader && (
                                                <span className="px-2 py-1 bg-gray-200 text-gray-700 text-[10px] rounded uppercase font-bold">Header</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => handleEdit(item)}
                                                    className="text-blue-600 hover:bg-blue-50 p-1 rounded"
                                                    title="Edit"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                    </svg>
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(item.code)}
                                                    className="text-red-500 hover:bg-red-50 p-1 rounded"
                                                    title="Delete"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};