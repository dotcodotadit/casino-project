import { useEffect, useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Ban, CheckCircle2, CircleSlash, Wallet } from 'lucide-react'
import { adminService } from '@/services/admin.service'
import { useToast } from '@/store/useToast'
import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { AdminUser, UserStatus } from '@/types/admin.types'

const statusVariant: Record<UserStatus, 'success' | 'warning' | 'destructive' | 'outline'> = {
  ACTIVE: 'success',
  SUSPENDED: 'warning',
  BANNED: 'destructive',
  SELF_EXCLUDED: 'outline',
}

export default function Users() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [adjusting, setAdjusting] = useState<AdminUser | null>(null)
  const push = useToast((s) => s.push)

  useEffect(() => {
    adminService.listUsers().then(setUsers)
  }, [])

  const replace = (u: AdminUser) => setUsers((prev) => prev.map((x) => (x.id === u.id ? u : x)))

  const toggleBan = async (u: AdminUser) => {
    const next = u.status === 'BANNED' ? 'ACTIVE' : 'BANNED'
    replace(await adminService.setUserStatus(u.id, next))
    push(`${u.username} ${next === 'BANNED' ? 'banned' : 'reinstated'}`, next === 'BANNED' ? 'error' : 'success')
  }

  const approveKyc = async (u: AdminUser) => {
    replace(await adminService.approveKyc(u.id))
    push(`KYC approved for ${u.username}`, 'success')
  }
  const rejectKyc = async (u: AdminUser) => {
    replace(await adminService.rejectKyc(u.id))
    push(`KYC rejected for ${u.username}`, 'error')
  }

  const columns = useMemo<ColumnDef<AdminUser>[]>(
    () => [
      {
        accessorKey: 'username',
        header: 'User',
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.username}</p>
            <p className="text-xs text-muted-foreground">{row.original.email}</p>
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => <Badge variant={statusVariant[row.original.status]}>{row.original.status}</Badge>,
      },
      {
        accessorKey: 'kycStatus',
        header: 'KYC',
        cell: ({ row }) => {
          const { kycLevel, kycStatus } = row.original
          const variant = kycStatus === 'VERIFIED' ? 'success' : kycStatus === 'PENDING' ? 'warning' : kycStatus === 'REJECTED' ? 'destructive' : 'outline'
          return (
            <div className="flex flex-col gap-0.5">
              <Badge variant={variant}>{kycStatus}</Badge>
              <span className="text-[10px] text-muted-foreground">{kycLevel}</span>
            </div>
          )
        },
      },
      {
        accessorKey: 'balanceMinor',
        header: 'Balance',
        cell: ({ row }) => <span className="font-mono">{formatCurrency(row.original.balanceMinor)}</span>,
      },
      {
        accessorKey: 'createdAt',
        header: 'Joined',
        cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDate(row.original.createdAt).split(',')[0]}</span>,
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        cell: ({ row }) => {
          const u = row.original
          return (
            <div className="flex flex-wrap gap-1">
              {u.kycStatus === 'PENDING' && (
                <>
                  <Button size="sm" variant="success" onClick={() => approveKyc(u)} title="Approve KYC">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => rejectKyc(u)} title="Reject KYC">
                    <CircleSlash className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
              <Button size="sm" variant="outline" onClick={() => setAdjusting(u)} title="Adjust balance">
                <Wallet className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant={u.status === 'BANNED' ? 'secondary' : 'destructive'} onClick={() => toggleBan(u)} title={u.status === 'BANNED' ? 'Unban' : 'Ban'}>
                <Ban className="h-3.5 w-3.5" />
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
        <h1 className="text-2xl font-bold">User Management</h1>
        <p className="text-sm text-muted-foreground">{users.length} users · search, ban, KYC, balance adjustments</p>
      </div>

      <DataTable columns={columns} data={users} searchPlaceholder="Search users by name, email…" pageSize={12} />

      <BalanceDialog
        user={adjusting}
        onClose={() => setAdjusting(null)}
        onApplied={(u, note) => {
          replace(u)
          push(note, 'success')
        }}
      />
    </div>
  )
}

function BalanceDialog({
  user,
  onClose,
  onApplied,
}: {
  user: AdminUser | null
  onClose: () => void
  onApplied: (u: AdminUser, note: string) => void
}) {
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const apply = async (sign: 1 | -1) => {
    const minor = Math.round(parseFloat(amount || '0') * 100) * sign
    if (!Number.isFinite(minor) || minor === 0 || !user) return
    setBusy(true)
    const updated = await adminService.adjustBalance(user.id, minor)
    setBusy(false)
    onApplied(updated, `${sign > 0 ? 'Credited' : 'Debited'} ${formatCurrency(Math.abs(minor))} ${sign > 0 ? 'to' : 'from'} ${user.username}`)
    setAmount('')
    setReason('')
    onClose()
  }

  return (
    <Dialog open={!!user} onClose={onClose} title="Adjust balance" description={user ? `${user.username} · current ${formatCurrency(user.balanceMinor)}` : ''}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Amount (USD)</label>
          <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Reason (audit note)</label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. goodwill credit" />
        </div>
        <div className="flex gap-2">
          <Button variant="success" className="flex-1" disabled={busy} onClick={() => apply(1)}>
            Credit
          </Button>
          <Button variant="destructive" className="flex-1" disabled={busy} onClick={() => apply(-1)}>
            Debit
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
