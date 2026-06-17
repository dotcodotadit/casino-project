import { useEffect, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { DollarSign, Users, TrendingUp, Percent, Clock, ShieldAlert, LifeBuoy } from 'lucide-react'
import { adminService } from '@/services/admin.service'
import { StatCard } from '@/components/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatCompact, formatPercent } from '@/lib/utils'
import type { DashboardKpis, TimeseriesPoint, GamePerformance } from '@/types/admin.types'

export default function Dashboard() {
  const [kpis, setKpis] = useState<DashboardKpis | null>(null)
  const [series, setSeries] = useState<TimeseriesPoint[]>([])
  const [games, setGames] = useState<GamePerformance[]>([])
  const [rtp, setRtp] = useState(0.968)

  useEffect(() => {
    let active = true
    adminService.getDashboard().then((d) => {
      if (!active) return
      setKpis(d.kpis)
      setSeries(d.timeseries)
      setGames(d.games)
      setRtp(d.kpis.rtpRealtime)
    })
    // Simulated real-time RTP ticker.
    const t = setInterval(() => setRtp((r) => Math.min(1.02, Math.max(0.93, r + (Math.random() - 0.5) * 0.004))), 2000)
    return () => {
      active = false
      clearInterval(t)
    }
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Platform overview · last 30 days</p>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue (GGR)" value={kpis ? formatCurrency(kpis.revenueMinor) : '—'} icon={DollarSign} deltaPct={kpis?.revenueDeltaPct} hint="vs prev period" />
        <StatCard label="Active Users" value={kpis ? formatCompact(kpis.activeUsers) : '—'} icon={Users} deltaPct={kpis?.activeUsersDeltaPct} hint="24h" />
        <StatCard label="GGR" value={kpis ? formatCurrency(kpis.ggrMinor) : '—'} icon={TrendingUp} deltaPct={kpis?.ggrDeltaPct} />
        <StatCard label="RTP (real-time)" value={formatPercent(rtp)} icon={Percent} hint="live" />
      </div>

      {/* Alerts row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="flex items-center justify-between p-4">
          <span className="flex items-center gap-2 text-sm text-muted-foreground"><Clock className="h-4 w-4" /> Pending withdrawals</span>
          <Badge variant="warning">{kpis?.pendingWithdrawals ?? 0}</Badge>
        </Card>
        <Card className="flex items-center justify-between p-4">
          <span className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldAlert className="h-4 w-4" /> Pending KYC</span>
          <Badge variant="royal">{kpis?.pendingKyc ?? 0}</Badge>
        </Card>
        <Card className="flex items-center justify-between p-4">
          <span className="flex items-center gap-2 text-sm text-muted-foreground"><LifeBuoy className="h-4 w-4" /> Open tickets</span>
          <Badge variant="destructive">{kpis?.openTickets ?? 0}</Badge>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={series} margin={{ left: -16, right: 8 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FFD700" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#FFD700" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8a8aa0' }} interval={4} />
                <YAxis tick={{ fontSize: 11, fill: '#8a8aa0' }} />
                <Tooltip contentStyle={{ background: '#14141c', border: '1px solid #2a2a38', borderRadius: 8 }} />
                <Area type="monotone" dataKey="revenue" stroke="#FFD700" fill="url(#rev)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Deposits vs Withdrawals</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={series} margin={{ left: -16, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8a8aa0' }} interval={4} />
                <YAxis tick={{ fontSize: 11, fill: '#8a8aa0' }} />
                <Tooltip contentStyle={{ background: '#14141c', border: '1px solid #2a2a38', borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="deposits" stroke="#34d399" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="withdrawals" stroke="#f87171" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>GGR by game</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={games.map((g) => ({ name: g.game, GGR: g.ggrMinor / 100, RTP: g.rtp * 100 }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#8a8aa0' }} />
              <YAxis tick={{ fontSize: 11, fill: '#8a8aa0' }} />
              <Tooltip contentStyle={{ background: '#14141c', border: '1px solid #2a2a38', borderRadius: 8 }} />
              <Bar dataKey="GGR" fill="#7C3AED" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
