import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { bonusAdminService } from '@/services/bonus.admin.service'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { AdminBonus, BonusFormData, BonusCondition, ConditionType } from '@/types/bonus.types'

const KINDS = ['WELCOME', 'DEPOSIT', 'RELOAD', 'FREE_SPIN', 'CASHBACK', 'LOYALTY', 'NO_DEPOSIT', 'MANUAL'] as const
const REWARD_TYPES = ['PERCENTAGE', 'FIXED', 'FREE_SPINS'] as const
const CLAIM_MODES = ['AUTO', 'MANUAL', 'CODE'] as const
const STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED', 'ARCHIVED'] as const
const CONDITION_TYPES: ConditionType[] = [
  'MIN_DEPOSIT',
  'MIN_KYC_LEVEL',
  'COUNTRY_ALLOW',
  'COUNTRY_DENY',
  'NEW_USERS_ONLY',
  'FIRST_DEPOSIT_ONLY',
  'MIN_ACCOUNT_AGE_HOURS',
  'GAME_CATEGORY',
  'CUSTOM',
]

/**
 * Bonus create/edit form + condition builder. Money fields are entered in major
 * units (dollars) and converted to minor units on save. The condition list is
 * the "promotion builder" — add/remove eligibility rules without code.
 */
export default function BonusForm({
  bonus,
  onClose,
  onSaved,
}: {
  bonus: AdminBonus | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!bonus
  const [form, setForm] = useState<BonusFormData>({
    name: bonus?.name ?? '',
    code: bonus?.code ?? undefined,
    kind: bonus?.kind ?? 'WELCOME',
    rewardType: bonus?.rewardType ?? 'PERCENTAGE',
    claimMode: bonus?.claimMode ?? 'AUTO',
    status: bonus?.status ?? 'DRAFT',
    percentage: bonus?.percentage ? bonus.percentage * 100 : 100,
    maxAmountMinor: bonus?.maxAmount ?? undefined,
    wagerMultiplier: bonus?.wagerMultiplier ?? 35,
    wagerIncludesDeposit: false,
    expiryHours: 168,
    allowStacking: false,
    priority: bonus?.priority ?? 0,
    maxClaimsPerUser: 1,
  })
  const [conditions, setConditions] = useState<BonusCondition[]>([])
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof BonusFormData>(k: K, v: BonusFormData[K]) => setForm((f) => ({ ...f, [k]: v }))

  const dollarsToMinor = (v: string): number | undefined => {
    const n = parseFloat(v)
    return isNaN(n) ? undefined : Math.round(n * 100)
  }

  const save = async () => {
    setSaving(true)
    try {
      // percentage entered as 0-100, stored as 0-1 fraction.
      const payload: BonusFormData = { ...form, percentage: form.percentage != null ? form.percentage / 100 : undefined }
      const saved = isEdit
        ? await bonusAdminService.update(bonus!.id, payload)
        : await bonusAdminService.create(payload)
      if (conditions.length) await bonusAdminService.setConditions(saved.id, conditions)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={onClose} title={isEdit ? 'Edit bonus' : 'Create bonus'} className="max-w-2xl">
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        <Field label="Name">
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Welcome 100%…" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Kind">
            <Select value={form.kind} onChange={(e) => set('kind', e.target.value as BonusFormData['kind'])}>
              {KINDS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </Select>
          </Field>
          <Field label="Reward type">
            <Select value={form.rewardType} onChange={(e) => set('rewardType', e.target.value as BonusFormData['rewardType'])}>
              {REWARD_TYPES.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </Select>
          </Field>
          <Field label="Claim mode">
            <Select value={form.claimMode} onChange={(e) => set('claimMode', e.target.value as BonusFormData['claimMode'])}>
              {CLAIM_MODES.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => set('status', e.target.value as BonusFormData['status'])}>
              {STATUSES.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </Select>
          </Field>
        </div>

        {form.claimMode === 'CODE' && (
          <Field label="Promo code">
            <Input value={form.code ?? ''} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="FREESPINS50" />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          {form.rewardType === 'PERCENTAGE' && (
            <Field label="Match %">
              <Input type="number" value={form.percentage ?? ''} onChange={(e) => set('percentage', parseFloat(e.target.value))} />
            </Field>
          )}
          {form.rewardType === 'FIXED' && (
            <Field label="Fixed amount ($)">
              <Input type="number" onChange={(e) => set('fixedAmountMinor', dollarsToMinor(e.target.value))} />
            </Field>
          )}
          <Field label="Max bonus ($)">
            <Input
              type="number"
              defaultValue={form.maxAmountMinor != null ? form.maxAmountMinor / 100 : ''}
              onChange={(e) => set('maxAmountMinor', dollarsToMinor(e.target.value))}
            />
          </Field>
          <Field label="Min deposit ($)">
            <Input type="number" onChange={(e) => set('minDepositMinor', dollarsToMinor(e.target.value))} />
          </Field>
          <Field label="Max bet while wagering ($)">
            <Input type="number" onChange={(e) => set('maxBetMinor', dollarsToMinor(e.target.value))} />
          </Field>
        </div>

        {form.rewardType === 'FREE_SPINS' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Free spin count">
              <Input type="number" onChange={(e) => set('freeSpinCount', parseInt(e.target.value) || undefined)} />
            </Field>
            <Field label="Spin value ($)">
              <Input type="number" onChange={(e) => set('freeSpinValueMinor', dollarsToMinor(e.target.value))} />
            </Field>
          </div>
        )}

        {form.kind === 'CASHBACK' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cashback basis">
              <Select onChange={(e) => set('cashbackBasis', e.target.value as 'NET_LOSS' | 'DEPOSIT')}>
                <option value="NET_LOSS">Net loss</option>
                <option value="DEPOSIT">Deposits</option>
              </Select>
            </Field>
            <Field label="Period (hours)">
              <Input type="number" defaultValue={24} onChange={(e) => set('cashbackPeriodHours', parseInt(e.target.value) || undefined)} />
            </Field>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <Field label="Wager ×">
            <Input type="number" value={form.wagerMultiplier} onChange={(e) => set('wagerMultiplier', parseFloat(e.target.value) || 0)} />
          </Field>
          <Field label="Expiry (hours)">
            <Input type="number" value={form.expiryHours} onChange={(e) => set('expiryHours', parseInt(e.target.value) || 168)} />
          </Field>
          <Field label="Priority">
            <Input type="number" value={form.priority} onChange={(e) => set('priority', parseInt(e.target.value) || 0)} />
          </Field>
        </div>

        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.wagerIncludesDeposit} onChange={(e) => set('wagerIncludesDeposit', e.target.checked)} />
            Wager includes deposit
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.allowStacking} onChange={(e) => set('allowStacking', e.target.checked)} />
            Allow stacking
          </label>
        </div>

        {/* ── Condition builder ── */}
        <div className="rounded-lg border border-border p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">Eligibility conditions</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConditions((c) => [...c, { type: 'MIN_DEPOSIT', operator: '>=', value: '' }])}
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
          {conditions.length === 0 && <p className="text-xs text-muted-foreground">No conditions (open to all).</p>}
          <div className="space-y-2">
            {conditions.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <Select
                  value={c.type}
                  onChange={(e) =>
                    setConditions((list) => list.map((x, j) => (j === i ? { ...x, type: e.target.value as ConditionType } : x)))
                  }
                  className="flex-1"
                >
                  {CONDITION_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </Select>
                <Input
                  placeholder="value"
                  value={c.value}
                  onChange={(e) => setConditions((list) => list.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                  className="w-32"
                />
                <Button size="sm" variant="ghost" onClick={() => setConditions((list) => list.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button disabled={saving || !form.name} onClick={save}>
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create bonus'}
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
