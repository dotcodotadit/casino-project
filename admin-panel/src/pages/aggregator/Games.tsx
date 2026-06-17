import { useEffect, useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { aggregatorAdminService } from '@/services/aggregator.admin.service'
import { useToast } from '@/store/useToast'
import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { AdminGame } from '@/types/aggregator.types'

export default function AggregatorGames() {
  const [games, setGames] = useState<AdminGame[]>([])
  const [editing, setEditing] = useState<AdminGame | null>(null)
  const push = useToast((s) => s.push)

  useEffect(() => {
    aggregatorAdminService.listGames().then(setGames)
  }, [])

  const apply = async (id: string, patch: Partial<AdminGame>, note: string) => {
    const g = await aggregatorAdminService.updateGame(id, patch)
    setGames((prev) => prev.map((x) => (x.id === id ? g : x)))
    push(note, 'success')
  }

  const columns = useMemo<ColumnDef<AdminGame>[]>(
    () => [
      { accessorKey: 'name', header: 'Game' },
      { accessorKey: 'provider', header: 'Provider', cell: ({ row }) => <Badge variant="gold">{row.original.provider}</Badge> },
      { accessorKey: 'category', header: 'Category', cell: ({ row }) => <Badge variant="outline">{row.original.category}</Badge> },
      { accessorKey: 'rtp', header: 'RTP', cell: ({ row }) => (row.original.rtp != null ? `${(row.original.rtp * 100).toFixed(1)}%` : '—') },
      {
        accessorKey: 'enabled',
        header: 'State',
        cell: ({ row }) =>
          row.original.maintenance ? (
            <Badge variant="warning">Maintenance</Badge>
          ) : row.original.enabled ? (
            <Badge variant="success">Live</Badge>
          ) : (
            <Badge variant="destructive">Disabled</Badge>
          ),
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        cell: ({ row }) => {
          const g = row.original
          return (
            <div className="flex flex-wrap gap-1">
              <Button size="sm" variant="outline" onClick={() => setEditing(g)}>RTP</Button>
              <Button
                size="sm"
                variant={g.maintenance ? 'secondary' : 'outline'}
                onClick={() => apply(g.id, { maintenance: !g.maintenance }, `${g.name} maintenance ${!g.maintenance ? 'ON' : 'OFF'}`)}
              >
                Maint.
              </Button>
              <Button
                size="sm"
                variant={g.enabled ? 'destructive' : 'success'}
                onClick={() => apply(g.id, { enabled: !g.enabled }, `${g.name} ${!g.enabled ? 'enabled' : 'disabled'}`)}
              >
                {g.enabled ? 'Disable' : 'Enable'}
              </Button>
            </div>
          )
        },
      },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Game Management</h1>
        <p className="text-sm text-muted-foreground">{games.length} games · edit RTP, maintenance &amp; availability</p>
      </div>

      <DataTable columns={columns} data={games} searchPlaceholder="Search games…" pageSize={12} />

      <RtpDialog
        game={editing}
        onClose={() => setEditing(null)}
        onSave={(id, rtp) => apply(id, { rtp }, 'RTP updated')}
      />
    </div>
  )
}

function RtpDialog({ game, onClose, onSave }: { game: AdminGame | null; onClose: () => void; onSave: (id: string, rtp: number) => void }) {
  const [val, setVal] = useState('')
  useEffect(() => {
    if (game) setVal(((game.rtp ?? 0.96) * 100).toFixed(2))
  }, [game])

  return (
    <Dialog open={!!game} onClose={onClose} title="Edit RTP" description={game ? game.name : ''}>
      <div className="space-y-3">
        <label className="block text-xs text-muted-foreground">RTP (%)</label>
        <Input type="number" min="50" max="120" step="0.1" value={val} onChange={(e) => setVal(e.target.value)} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => {
              if (game) onSave(game.id, parseFloat(val) / 100)
              onClose()
            }}
          >
            Save
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
