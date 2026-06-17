import { useEffect, useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { aggregatorAdminService } from '@/services/aggregator.admin.service'
import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { AdminProviderTx, ProviderTxType } from '@/types/aggregator.types'

const typeVariant: Record<ProviderTxType, 'success' | 'warning' | 'destructive' | 'outline' | 'gold'> = {
  BET: 'outline',
  WIN: 'success',
  REFUND: 'warning',
  ROLLBACK: 'destructive',
  BONUS: 'gold',
}

export default function ProviderTransactions() {
  const [rows, setRows] = useState<AdminProviderTx[]>([])
  useEffect(() => {
    aggregatorAdminService.listProviderTransactions().then(setRows)
  }, [])

  const columns = useMemo<ColumnDef<AdminProviderTx>[]>(
    () => [
      { accessorKey: 'providerTxId', header: 'Provider Tx', cell: ({ row }) => <span className="font-mono text-xs">{row.original.providerTxId}</span> },
      { accessorKey: 'user', header: 'User' },
      { accessorKey: 'provider', header: 'Provider', cell: ({ row }) => <Badge variant="gold">{row.original.provider}</Badge> },
      { accessorKey: 'type', header: 'Type', cell: ({ row }) => <Badge variant={typeVariant[row.original.type]}>{row.original.type}</Badge> },
      { accessorKey: 'roundId', header: 'Round', cell: ({ row }) => <span className="font-mono text-xs">{row.original.roundId ?? '—'}</span> },
      { accessorKey: 'amountMinor', header: 'Amount', cell: ({ row }) => <span className="font-mono">{formatCurrency(row.original.amountMinor)}</span> },
      { accessorKey: 'balanceAfter', header: 'Balance', cell: ({ row }) => (row.original.balanceAfter != null ? <span className="font-mono text-muted-foreground">{formatCurrency(row.original.balanceAfter)}</span> : '—') },
      { accessorKey: 'createdAt', header: 'When', cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDate(row.original.createdAt)}</span> },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Provider Transaction Log</h1>
        <p className="text-sm text-muted-foreground">Seamless-wallet bets / wins / rollbacks mapped to the internal ledger</p>
      </div>
      <DataTable columns={columns} data={rows} searchPlaceholder="Search by tx, user, round…" pageSize={15} />
    </div>
  )
}
