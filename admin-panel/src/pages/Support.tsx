import { useEffect, useState } from 'react'
import { Send } from 'lucide-react'
import { adminService } from '@/services/admin.service'
import { useToast } from '@/store/useToast'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { cn, formatDate } from '@/lib/utils'
import type { SupportTicket, TicketPriority, TicketStatus } from '@/types/admin.types'

const priorityVariant: Record<TicketPriority, 'outline' | 'warning' | 'destructive'> = {
  LOW: 'outline',
  MEDIUM: 'outline',
  HIGH: 'warning',
  URGENT: 'destructive',
}
const statusVariant: Record<TicketStatus, 'success' | 'warning' | 'royal' | 'outline'> = {
  OPEN: 'warning',
  PENDING: 'royal',
  RESOLVED: 'success',
  CLOSED: 'outline',
}

export default function Support() {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const push = useToast((s) => s.push)

  useEffect(() => {
    adminService.listTickets().then((t) => {
      setTickets(t)
      setActiveId(t[0]?.id ?? null)
    })
  }, [])

  const active = tickets.find((t) => t.id === activeId) ?? null
  const replaceTicket = (t: SupportTicket) => setTickets((prev) => prev.map((x) => (x.id === t.id ? t : x)))

  const sendReply = async () => {
    if (!active || !reply.trim()) return
    replaceTicket(await adminService.replyTicket(active.id, reply.trim()))
    setReply('')
    push('Reply sent', 'success')
  }

  const changeStatus = async (status: TicketStatus) => {
    if (!active) return
    replaceTicket(await adminService.setTicketStatus(active.id, status))
    push(`Ticket marked ${status}`, 'info')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Support Tickets</h1>
        <p className="text-sm text-muted-foreground">{tickets.filter((t) => t.status === 'OPEN').length} open · {tickets.length} total</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        {/* List */}
        <div className="space-y-2">
          {tickets.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveId(t.id)}
              className={cn(
                'admin-card w-full p-3 text-left transition-colors hover:bg-muted/40',
                t.id === activeId && 'ring-1 ring-gold',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{t.subject}</span>
                <Badge variant={priorityVariant[t.priority]}>{t.priority}</Badge>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t.username}</span>
                <Badge variant={statusVariant[t.status]}>{t.status}</Badge>
              </div>
            </button>
          ))}
        </div>

        {/* Conversation */}
        <Card className="flex min-h-[420px] flex-col p-0">
          {active ? (
            <>
              <div className="flex items-center justify-between border-b border-border p-4">
                <div>
                  <p className="font-semibold">{active.subject}</p>
                  <p className="text-xs text-muted-foreground">{active.username} · opened {formatDate(active.createdAt)}</p>
                </div>
                <Select value={active.status} onChange={(e) => changeStatus(e.target.value as TicketStatus)} className="w-36">
                  {(['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'] as TicketStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {active.messages.map((m) => (
                  <div key={m.id} className={cn('flex', m.author === 'agent' ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-[75%] rounded-lg px-3 py-2 text-sm',
                        m.author === 'agent' ? 'bg-gold/15 text-foreground' : 'bg-muted',
                      )}
                    >
                      <p>{m.body}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">{m.author} · {formatDate(m.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 border-t border-border p-4">
                <Input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Type a reply…"
                  onKeyDown={(e) => e.key === 'Enter' && sendReply()}
                />
                <Button onClick={sendReply}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="grid flex-1 place-items-center text-sm text-muted-foreground">Select a ticket</div>
          )}
        </Card>
      </div>
    </div>
  )
}
