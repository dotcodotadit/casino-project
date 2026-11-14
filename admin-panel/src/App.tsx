import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AdminLayout from '@/layouts/AdminLayout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Users from '@/pages/Users'
import Games from '@/pages/Games'
import Finance from '@/pages/Finance'
import Support from '@/pages/Support'
import Fairness from '@/pages/Fairness'
import Seeds from '@/pages/Seeds'
import Providers from '@/pages/aggregator/Providers'
import ProviderGames from '@/pages/aggregator/Games'
import Sessions from '@/pages/aggregator/Sessions'
import ProviderTransactions from '@/pages/aggregator/ProviderTransactions'
import Callbacks from '@/pages/aggregator/Callbacks'
import BonusManagement from '@/pages/bonus/BonusManagement'
import BonusReport from '@/pages/bonus/BonusReport'
import VipManagement from '@/pages/loyalty/VipManagement'
import MissionBuilder from '@/pages/loyalty/MissionBuilder'
import VipShopAdmin from '@/pages/loyalty/VipShopAdmin'

export default function App() {
  return (
    <BrowserRouter basename="/admin">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="users" element={<Users />} />
          <Route path="games" element={<Games />} />
          <Route path="finance" element={<Finance />} />
          <Route path="support" element={<Support />} />
          <Route path="fairness" element={<Fairness />} />
          <Route path="seeds" element={<Seeds />} />
          <Route path="providers" element={<Providers />} />
          <Route path="provider-games" element={<ProviderGames />} />
          <Route path="sessions" element={<Sessions />} />
          <Route path="provider-transactions" element={<ProviderTransactions />} />
          <Route path="callbacks" element={<Callbacks />} />
          <Route path="bonuses" element={<BonusManagement />} />
          <Route path="bonus-report" element={<BonusReport />} />
          <Route path="vip" element={<VipManagement />} />
          <Route path="missions" element={<MissionBuilder />} />
          <Route path="loyalty-shop" element={<VipShopAdmin />} />
        </Route>
        <Route path="*" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  )
}
