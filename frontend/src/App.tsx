import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import LobbyPage from '@/pages/LobbyPage'
import WalletPage from '@/pages/WalletPage'
import KycPage from '@/pages/KycPage'
import Casino from '@/pages/Casino'
import AggregatorGames from '@/pages/AggregatorGames'
import Promotions from '@/pages/Promotions'
import VipPage from '@/pages/VipPage'
import MissionsPage from '@/pages/MissionsPage'
import SlotMachine from '@/components/games/SlotMachine'
import Roulette from '@/components/games/Roulette'
import Blackjack from '@/components/games/Blackjack'
import NotFoundPage from '@/pages/NotFoundPage'

export default function App() {
  const bootstrap = useAuthStore((s) => s.bootstrap)

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<LobbyPage />} />
        <Route path="casino" element={<Casino />} />
        <Route path="games" element={<AggregatorGames />} />
        <Route path="promotions" element={<Promotions />} />
        <Route path="vip" element={<VipPage />} />
        <Route path="missions" element={<MissionsPage />} />
        <Route path="wallet" element={<WalletPage />} />
        <Route path="kyc" element={<KycPage />} />
        <Route path="games/slots" element={<SlotMachine />} />
        <Route path="games/roulette" element={<Roulette />} />
        <Route path="games/blackjack" element={<Blackjack />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
