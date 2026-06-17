import { useEffect, useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowDownToLine, ArrowUpFromLine, TrendingUp, Scale } from 'lucide-react'
import { adminService } from '@/services/admin.service'
import { StatCard } from '@/components/StatCard'
import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { FinanceTx, TxStatus, TxType } from '@/types/admin.types'

const statusVariant: Record<TxStatus, 'success' | 'warning' | 'destructive' | 'outline'> = {
  COMPLETED: 'success',
  PENDING: 'warning',
  FAILED: 'destructive',
  CANCELLED: 'outline',
}

type Summary = Awaited<ReturnType<typeof adminService.financeSummary>>

export default function Finance() {
  const [txns, setTxns] = useState<FinanceTx[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [tab, setTab] = useState<'ALL' | TxType>('ALL')

  useEffect(() => {
    adminService.listTransactions().then(setTxns)
    adminService.financeSummary().then(setSummary)
  }, [])

  const filtered = useMemo(() => (tab === 'ALL' ? txns : txns.filter((t) => t.type === tab)), [txns, tab])

  const columns = useMemo<ColumnDef<FinanceTx>[]>(
    () => [
      { accessorKey: 'id', header: 'Tx ID', cell: ({ row }) => <span className="font-mono text-xs">{row.original.id}</span> },
      { accessorKey: 'username', header: 'User' },
      { accessorKey: 'type', header: 'Type', cell: ({ row }) => <Badge variant="outline">{row.original.type}</Badge> },
      {
        accessorKey: 'amountMinor',
        header: 'Amount',
        cell: ({ row }) => {
          const credit = ['DEPOSIT', 'PAYOUT', 'BONUS'].includes(row.original.type)
          return <span className={credit ? 'font-mono text-success' : 'font-mono'}>{formatCurrency(row.original.amountMinor)}</span>
        },
      },
      { accessorKey: 'method', header: 'Method', cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.method ?? '—'}</span> },
      { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant={statusVariant[row.original.status]}>{row.original.status}</Badge> },
      { accessorKey: 'createdAt', header: 'Date', cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDate(row.original.createdAt)}</span> },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Finance &amp; Reports</h1>
        <p className="text-sm text-muted-foreground">Deposit / withdrawal flow &amp; profit / loss</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Deposits" value={summary ? formatCurrency(summary.depositsMinor) : '—'} icon={ArrowDownToLine} />
        <StatCard label="Withdrawals" value={summary ? formatCurrency(summary.withdrawalsMinor) : '—'} icon={ArrowUpFromLine} />
        <StatCard label="GGR" value={summary ? formatCurrency(summary.ggrMinor) : '—'} icon={TrendingUp} hint="bets − payouts" />
        <StatCard label="Net Profit" value={summary ? formatCurrency(summary.netProfitMinor) : '—'} icon={Scale} />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          {(['ALL', 'DEPOSIT', 'WITHDRAW', 'BET', 'PAYOUT', 'BONUS'] as const).map((t) => (
            <TabsTrigger key={t} value={t}>
              {t}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab}>
          <DataTable columns={columns} data={filtered} searchPlaceholder="Search by user, tx id…" pageSize={12} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
