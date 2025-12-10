import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Ledger } from './pages/Ledger';
import { Reconciliation } from './pages/Reconciliation';
import { ApAr } from './pages/ApAr';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { FinanceProvider } from './context/FinanceContext';

const App: React.FC = () => {
  return (
    <FinanceProvider>
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/ledger" element={<Ledger />} />
              <Route path="/reconciliation" element={<Reconciliation />} />
              <Route path="/ap-ar" element={<ApAr />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Layout>
        </Router>
    </FinanceProvider>
  );
};

export default App;