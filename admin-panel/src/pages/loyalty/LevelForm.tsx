import { useState } from 'react'
import { loyaltyAdminService } from '@/services/loyalty.admin.service'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { AdminVipLevel, LevelFormData } from '@/types/loyalty.types'

/**
 * Create/edit a VIP tier. requiredPoints drives promotion; keepPoints is the
 * downgrade floor. Money (weekly bonus) is entered in dollars → minor units.
 */
export default function LevelForm({
  level,
  onClose,
  onSaved,
}: {
  level: AdminVipLevel | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!level
  const [form, setForm] = useState<LevelFormData>({
    id: level?.id,
    level: level?.level ?? 0,
    name: level?.name ?? '',
    color: level?.color ?? '#d4af37',
    requiredPoints: level?.requiredPoints ?? 0,
    keepPoints: level?.keepPoints ?? 0,
    pointMultiplier: level?.pointMultiplier ?? 1,
    cashbackPct: level?.cashbackPct ?? 0,
    weeklyBonusMinor: level?.weeklyBonus ?? 0,
  })
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof LevelFormData>(k: K, v: LevelFormData[K]) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    setSaving(true)
    try {
      await loyaltyAdminService.saveLevel(form)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={onClose} title={isEdit ? `Edit ${level!.name}` : 'Create VIP level'}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Level (order)">
            <Input type="number" value={form.level} onChange={(e) => set('level', parseInt(e.target.value) || 0)} />
          </Field>
          <Field label="Name">
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="Required points">
            <Input type="number" value={form.requiredPoints} onChange={(e) => set('requiredPoints', parseInt(e.target.value) || 0)} />
          </Field>
          <Field label="Keep points (downgrade floor)">
            <Input type="number" value={form.keepPoints} onChange={(e) => set('keepPoints', parseInt(e.target.value) || 0)} />
          </Field>
          <Field label="Point multiplier">
            <Input type="number" step="0.05" value={form.pointMultiplier} onChange={(e) => set('pointMultiplier', parseFloat(e.target.value) || 1)} />
          </Field>
          <Field label="Cashback %">
            <Input type="number" step="0.5" value={form.cashbackPct} onChange={(e) => set('cashbackPct', parseFloat(e.target.value) || 0)} />
          </Field>
          <Field label="Weekly bonus (minor)">
            <Input type="number" value={form.weeklyBonusMinor} onChange={(e) => set('weeklyBonusMinor', parseInt(e.target.value) || 0)} />
          </Field>
          <Field label="Color">
            <Input type="color" value={form.color} onChange={(e) => set('color', e.target.value)} />
          </Field>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={saving || !form.name} onClick={save}>
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
