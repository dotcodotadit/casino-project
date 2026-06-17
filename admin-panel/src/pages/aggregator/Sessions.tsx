import { useEffect, useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { aggregatorAdminService } from '@/services/aggregator.admin.service'
import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import type { AdminSession } from '@/types/aggregator.types'

const variant = { ACTIVE: 'success', CLOSED: 'outline', EXPIRED: 'warning' } as const

export default function Sessions() {
  const [rows, setRows] = useState<AdminSession[]>([])
  useEffect(() => {
    aggregatorAdminService.listSessions().then(setRows)
  }, [])

  const columns = useMemo<ColumnDef<AdminSession>[]>(
    () => [
      { accessorKey: 'id', header: 'Session', cell: ({ row }) => <span className="font-mono text-xs">{row.original.id}</span> },
      { accessorKey: 'user', header: 'User' },
      { accessorKey: 'provider', header: 'Provider', cell: ({ row }) => <Badge variant="gold">{row.original.provider}</Badge> },
      { accessorKey: 'game', header: 'Game', cell: ({ row }) => row.original.game ?? '—' },
      { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant={variant[row.original.status]}>{row.original.status}</Badge> },
      { accessorKey: 'createdAt', header: 'Started', cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDate(row.original.createdAt)}</span> },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Session Monitor</h1>
        <p className="text-sm text-muted-foreground">{rows.filter((s) => s.status === 'ACTIVE').length} active · {rows.length} total</p>
      </div>
      <DataTable columns={columns} data={rows} searchPlaceholder="Search by user, provider…" pageSize={15} />
    </div>
  )
}
