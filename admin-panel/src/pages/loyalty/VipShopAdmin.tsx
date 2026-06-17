import { useEffect, useState } from 'react'
import { ShoppingBag, Plus, Pencil, UserCog } from 'lucide-react'
import { loyaltyAdminService } from '@/services/loyalty.admin.service'
import { useToast } from '@/store/useToast'
import { Dialog } from '@/components/ui/dialog'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import type { AdminShopItem } from '@/types/loyalty.types'

const TYPES = ['FREE_SPINS', 'BONUS_MONEY', 'CASHBACK_BOOST', 'PHYSICAL', 'CUSTOM']

type ShopForm = Partial<AdminShopItem> & { sku: string; name: string; type: string; costPoints: number }

/**
 * VIP shop management + manual player point adjustment. Items configure the
 * reward catalog; the adjustment panel lets support credit/debit a player's
 * points (audited via the point ledger).
 */
export default function VipShopAdmin() {
  const [items, setItems] = useState<AdminShopItem[]>([])
  const [editing, setEditing] = useState<AdminShopItem | null>(null)
  const [creating, setCreating] = useState(false)
  const push = useToast((s) => s.push)

  const load = () => {
    void loyaltyAdminService.shop().then(setItems)
  }
  useEffect(load, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ShoppingBag className="h-6 w-6 text-gold" /> Loyalty Shop
          </h1>
          <p className="text-sm text-muted-foreground">Reward catalog & manual point adjustments</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> New item
        </Button>
      </div>

      <div className="admin-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Min level</TableHead>
              <TableHead>Enabled</TableHead>
              <TableHead className="text-right">Edit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((i) => (
              <TableRow key={i.id}>
                <TableCell>
                  <div className="font-medium">{i.name}</div>
                  <div className="text-xs text-muted-foreground">{i.sku}</div>
                </TableCell>
                <TableCell><Badge variant="gold">{i.type}</Badge></TableCell>
                <TableCell>{i.costPoints.toLocaleString()} pts</TableCell>
                <TableCell>{i.stock == null ? '∞' : i.stock}</TableCell>
                <TableCell>{i.minLevel}</TableCell>
                <TableCell><Badge variant={i.enabled ? 'success' : 'outline'}>{i.enabled ? 'Yes' : 'No'}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(i)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <PlayerAdjust />

      {(creating || editing) && (
        <ItemDialog
          item={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={() => {
            setCreating(false)
            setEditing(null)
            load()
            push('Item saved', 'success')
          }}
        />
      )}
    </div>
  )
}

function PlayerAdjust() {
  const [userId, setUserId] = useState('')
  const [loyaltyDelta, setLoyalty] = useState(0)
  const [statusDelta, setStatus] = useState(0)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const push = useToast((s) => s.push)

  const submit = async () => {
    if (!userId) return
    setBusy(true)
    try {
      await loyaltyAdminService.adjustPlayer(userId, loyaltyDelta, statusDelta, note)
      push('Adjustment applied', 'success')
      setLoyalty(0)
      setStatus(0)
      setNote('')
    } catch {
      push('Adjustment failed (player may have no VIP progress yet)', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserCog className="h-5 w-5 text-gold" /> Manual point adjustment
        </CardTitle>
        <p className="text-xs text-muted-foreground">Credit or debit a player&apos;s points. Audited via the point ledger.</p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="User ID">
            <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="cuid…" />
          </Field>
          <Field label="Loyalty Δ">
            <Input type="number" value={loyaltyDelta} onChange={(e) => setLoyalty(parseInt(e.target.value) || 0)} />
          </Field>
          <Field label="Status Δ">
            <Input type="number" value={statusDelta} onChange={(e) => setStatus(parseInt(e.target.value) || 0)} />
          </Field>
          <Field label="Note">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="reason" />
          </Field>
        </div>
        <Button className="mt-3" disabled={busy || !userId} onClick={submit}>
          {busy ? 'Applying…' : 'Apply adjustment'}
        </Button>
      </CardContent>
    </Card>
  )
}

function ItemDialog({ item, onClose, onSaved }: { item: AdminShopItem | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<ShopForm>({
    id: item?.id,
    sku: item?.sku ?? '',
    name: item?.name ?? '',
    description: item?.description ?? '',
    type: item?.type ?? 'FREE_SPINS',
    costPoints: item?.costPoints ?? 500,
    valueMinor: item?.valueMinor ?? undefined,
    stock: item?.stock ?? null,
    minLevel: item?.minLevel ?? 0,
    enabled: item?.enabled ?? true,
    sortOrder: item?.sortOrder ?? 0,
  })
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof ShopForm>(k: K, v: ShopForm[K]) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    setSaving(true)
    try {
      await loyaltyAdminService.saveShopItem(form)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={onClose} title={item ? `Edit ${item.name}` : 'Create shop item'}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="SKU">
          <Input value={form.sku} onChange={(e) => set('sku', e.target.value.toUpperCase())} />
        </Field>
        <Field label="Name">
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Type">
          <Select value={form.type} onChange={(e) => set('type', e.target.value)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </Field>
        <Field label="Cost (points)">
          <Input type="number" value={form.costPoints} onChange={(e) => set('costPoints', parseInt(e.target.value) || 0)} />
        </Field>
        <Field label="Value (minor, optional)">
          <Input type="number" value={form.valueMinor ?? ''} onChange={(e) => set('valueMinor', e.target.value ? parseInt(e.target.value) : undefined)} />
        </Field>
        <Field label="Stock (blank = ∞)">
          <Input type="number" value={form.stock ?? ''} onChange={(e) => set('stock', e.target.value ? parseInt(e.target.value) : null)} />
        </Field>
        <Field label="Min level">
          <Input type="number" value={form.minLevel} onChange={(e) => set('minLevel', parseInt(e.target.value) || 0)} />
        </Field>
        <Field label="Enabled">
          <Select value={String(form.enabled)} onChange={(e) => set('enabled', e.target.value === 'true')}>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </Select>
        </Field>
      </div>
      <Field label="Description">
        <Input value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} />
      </Field>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button disabled={saving || !form.sku || !form.name} onClick={save}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
