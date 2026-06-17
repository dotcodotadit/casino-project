import { useEffect, useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { RotateCw, ShieldCheck, ShieldX } from 'lucide-react'
import { aggregatorAdminService } from '@/services/aggregator.admin.service'
import { useToast } from '@/store/useToast'
import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import type { AdminCallback, CallbackStatus } from '@/types/aggregator.types'

const variant: Record<CallbackStatus, 'success' | 'warning' | 'destructive' | 'outline'> = {
  PROCESSED: 'success',
  RECEIVED: 'outline',
  REJECTED: 'warning',
  FAILED: 'destructive',
}

export default function Callbacks() {
  const [rows, setRows] = useState<AdminCallback[]>([])
  const push = useToast((s) => s.push)

  useEffect(() => {
    aggregatorAdminService.listCallbacks().then(setRows)
  }, [])

  const retry = async (c: AdminCallback) => {
    const updated = await aggregatorAdminService.retryCallback(c.id)
    setRows((prev) => prev.map((x) => (x.id === c.id ? updated : x)))
    push(`Callback ${c.id} reprocessed`, 'success')
  }

  const columns = useMemo<ColumnDef<AdminCallback>[]>(
    () => [
      { accessorKey: 'providerCode', header: 'Provider', cell: ({ row }) => <Badge variant="gold">{row.original.providerCode}</Badge> },
      { accessorKey: 'action', header: 'Action', cell: ({ row }) => <Badge variant="outline">{row.original.action}</Badge> },
      {
        accessorKey: 'signatureValid',
        header: 'Sig',
        cell: ({ row }) =>
          row.original.signatureValid ? <ShieldCheck className="h-4 w-4 text-emerald-400" /> : <ShieldX className="h-4 w-4 text-destructive" />,
      },
      { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge variant={variant[row.original.status]}>{row.original.status}</Badge> },
      { accessorKey: 'attempts', header: 'Tries' },
      { accessorKey: 'error', header: 'Error', cell: ({ row }) => <span className="text-xs text-destructive">{row.original.error ?? '—'}</span> },
      { accessorKey: 'createdAt', header: 'When', cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDate(row.original.createdAt)}</span> },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.status === 'FAILED' ? (
            <Button size="sm" variant="outline" onClick={() => retry(row.original)}>
              <RotateCw className="h-3.5 w-3.5" /> Retry
            </Button>
          ) : null,
      },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Callback Log</h1>
        <p className="text-sm text-muted-foreground">
          {rows.filter((c) => c.status === 'FAILED').length} failed · HMAC verification &amp; retry
        </p>
      </div>
      <DataTable columns={columns} data={rows} searchPlaceholder="Search callbacks…" pageSize={15} />
    </div>
  )
}
