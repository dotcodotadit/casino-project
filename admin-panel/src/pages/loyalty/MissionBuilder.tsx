import { useEffect, useState } from 'react'
import { Target, Plus, Pencil } from 'lucide-react'
import { loyaltyAdminService } from '@/services/loyalty.admin.service'
import { useToast } from '@/store/useToast'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import type { AdminMission, MissionFormData } from '@/types/loyalty.types'

const TYPES = ['DAILY', 'WEEKLY', 'MONTHLY', 'ACHIEVEMENT', 'TIER']
const METRICS = ['BET_COUNT', 'BET_AMOUNT', 'DEPOSIT_AMOUNT', 'WIN_AMOUNT', 'LOGIN_STREAK', 'GAME_CATEGORY_BETS', 'POINTS_EARNED']

/**
 * Mission & challenge builder. List + create/edit. The metric + target define
 * the goal; rewardPoints/rewardStatusPoints define the payout. Configurable
 * without redeploy (saved via the loyalty admin API).
 */
export default function MissionBuilder() {
  const [missions, setMissions] = useState<AdminMission[]>([])
  const [editing, setEditing] = useState<AdminMission | null>(null)
  const [creating, setCreating] = useState(false)
  const push = useToast((s) => s.push)

  const load = () => {
    void loyaltyAdminService.missions().then(setMissions)
  }
  useEffect(load, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Target className="h-6 w-6 text-gold" /> Mission Builder
          </h1>
          <p className="text-sm text-muted-foreground">Daily, weekly, monthly & achievement challenges</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> New mission
        </Button>
      </div>

      <div className="admin-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mission</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Metric</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Reward</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Edit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {missions.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <div className="font-medium">{m.name}</div>
                  <div className="text-xs text-muted-foreground">{m.key}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="gold">{m.type}</Badge>
                </TableCell>
                <TableCell className="text-xs">{m.metric}</TableCell>
                <TableCell>{m.target.toLocaleString()}</TableCell>
                <TableCell className="text-sm">+{m.rewardPoints} pts</TableCell>
                <TableCell>
                  <Badge variant={m.status === 'ACTIVE' ? 'success' : 'outline'}>{m.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(m)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {(creating || editing) && (
        <MissionDialog
          mission={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={() => {
            setCreating(false)
            setEditing(null)
            load()
            push('Mission saved', 'success')
          }}
        />
      )}
    </div>
  )
}

function MissionDialog({ mission, onClose, onSaved }: { mission: AdminMission | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<MissionFormData>({
    id: mission?.id,
    key: mission?.key ?? '',
    name: mission?.name ?? '',
    description: mission?.description ?? '',
    type: mission?.type ?? 'DAILY',
    metric: mission?.metric ?? 'BET_COUNT',
    status: mission?.status ?? 'ACTIVE',
    target: mission?.target ?? 10,
    rewardPoints: mission?.rewardPoints ?? 100,
    rewardStatusPoints: mission?.rewardStatusPoints ?? 100,
    sortOrder: mission?.sortOrder ?? 0,
  })
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof MissionFormData>(k: K, v: MissionFormData[K]) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    setSaving(true)
    try {
      await loyaltyAdminService.saveMission(form)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={onClose} title={mission ? `Edit ${mission.name}` : 'Create mission'}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Key (unique)">
            <Input value={form.key} onChange={(e) => set('key', e.target.value)} placeholder="daily-spins" />
          </Field>
          <Field label="Name">
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
        </div>
        <Field label="Description">
          <Input value={form.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={form.type} onChange={(e) => set('type', e.target.value)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="Metric">
            <Select value={form.metric} onChange={(e) => set('metric', e.target.value)}>
              {METRICS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="Target">
            <Input type="number" value={form.target} onChange={(e) => set('target', parseInt(e.target.value) || 1)} />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="ACTIVE">ACTIVE</option>
              <option value="PAUSED">PAUSED</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </Select>
          </Field>
          <Field label="Reward loyalty pts">
            <Input type="number" value={form.rewardPoints} onChange={(e) => set('rewardPoints', parseInt(e.target.value) || 0)} />
          </Field>
          <Field label="Reward status pts">
            <Input type="number" value={form.rewardStatusPoints} onChange={(e) => set('rewardStatusPoints', parseInt(e.target.value) || 0)} />
          </Field>
        </div>
        {form.metric === 'GAME_CATEGORY_BETS' && (
          <Field label="Category (params)">
            <Input
              placeholder="SLOTS"
              onChange={(e) => set('params', { category: e.target.value.toUpperCase() })}
            />
          </Field>
        )}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button disabled={saving || !form.key || !form.name} onClick={save}>
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
