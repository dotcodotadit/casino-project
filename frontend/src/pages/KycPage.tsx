import { useState } from 'react'
import { authService } from '@/services/auth.service'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

/** KYC simulation — submits fake document data, backend auto-approves to FULL. */
export default function KycPage() {
  const { user, setUser } = useAuthStore()
  const [form, setForm] = useState({ fullName: '', documentId: '', country: '' })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async () => {
    setBusy(true)
    setMessage(null)
    try {
      // Backend requires verified email + phone (BASIC) before FULL KYC.
      const result = await authService.submitKyc(form)
      if (user) setUser({ ...user, kycLevel: result.level })
      setMessage(`KYC submitted — level: ${result.level} (${result.status})`)
    } catch (err: any) {
      const e = err?.response?.data?.error
      setMessage(
        e?.code === 'KYC_PREREQ'
          ? 'Verify your email and phone (OTP) before submitting full KYC.'
          : e?.message ?? 'Submission failed',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>KYC Verification (simulated)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Current level: <span className="text-gold">{user?.kycLevel}</span>
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Full legal name" value={form.fullName} onChange={update('fullName')} />
          <Input placeholder="Document / ID number" value={form.documentId} onChange={update('documentId')} />
          <Input placeholder="Country" value={form.country} onChange={update('country')} />
          {message && <p className="text-sm text-gold">{message}</p>}
          <Button className="w-full" disabled={busy} onClick={submit}>
            {busy ? 'Submitting…' : 'Submit for verification'}
          </Button>
          <p className="text-xs text-muted-foreground">
            This is a simulation. No documents are uploaded or stored. Verification is auto-approved
            after basic validation for demo purposes.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
