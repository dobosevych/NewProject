import { format, isSameDay } from 'date-fns'
import { CalendarXIcon, MapPinIcon, PlusIcon, Trash2Icon } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useMeetings } from '@/hooks/queries'
import type { Meeting, Participant } from '@/lib/api'

const MAX_BADGES = 3

function formatWhen(meeting: Meeting): string {
  const start = new Date(meeting.starts_at)
  const end = new Date(meeting.ends_at)
  const day = format(start, 'EEE, d MMM yyyy')
  if (isSameDay(start, end)) {
    return `${day} · ${format(start, 'HH:mm')}–${format(end, 'HH:mm')}`
  }
  return `${day} ${format(start, 'HH:mm')} – ${format(end, 'EEE, d MMM HH:mm')}`
}

function ParticipantBadges({ participants }: { participants: Participant[] }) {
  if (participants.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>
  }
  const shown = participants.slice(0, MAX_BADGES)
  const hidden = participants.slice(MAX_BADGES)
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((p) => (
        <Badge key={p.id} variant="secondary" title={p.email}>
          {p.name}
        </Badge>
      ))}
      {hidden.length > 0 && (
        <Badge variant="outline" title={hidden.map((p) => p.name).join(', ')}>
          +{hidden.length}
        </Badge>
      )}
    </div>
  )
}

function DeleteButton({ meeting, onDelete }: { meeting: Meeting; onDelete: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`Delete ${meeting.title}`}
      onClick={onDelete}
    >
      <Trash2Icon />
    </Button>
  )
}

type Props = {
  onAdd: () => void
  onDelete: (meeting: Meeting) => void
}

export function MeetingList({ onAdd, onDelete }: Props) {
  const meetings = useMeetings()

  if (meetings.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  if (meetings.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load meetings</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-2">
          <span>{meetings.error.message}</span>
          <Button variant="outline" size="sm" onClick={() => meetings.refetch()}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (meetings.data.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
        <CalendarXIcon className="size-10 text-muted-foreground" />
        <p className="text-lg font-medium">No meetings yet</p>
        <Button onClick={onAdd}>
          <PlusIcon />
          Add meeting
        </Button>
      </div>
    )
  }

  return (
    <>
      {/* Wide screens: table */}
      <div className="hidden rounded-xl border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Meeting</TableHead>
              <TableHead>When</TableHead>
              <TableHead>Place</TableHead>
              <TableHead>Participants</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {meetings.data.map((meeting) => (
              <TableRow key={meeting.id}>
                <TableCell className="max-w-64 whitespace-normal">
                  <div className="font-medium">{meeting.title}</div>
                  {meeting.description && (
                    <div
                      className="truncate text-sm text-muted-foreground"
                      title={meeting.description}
                    >
                      {meeting.description}
                    </div>
                  )}
                </TableCell>
                <TableCell>{formatWhen(meeting)}</TableCell>
                <TableCell className="max-w-48 truncate" title={meeting.place}>
                  {meeting.place}
                </TableCell>
                <TableCell className="whitespace-normal">
                  <ParticipantBadges participants={meeting.participants} />
                </TableCell>
                <TableCell>
                  <DeleteButton meeting={meeting} onDelete={() => onDelete(meeting)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Narrow screens: cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {meetings.data.map((meeting) => (
          <Card key={meeting.id}>
            <CardContent className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium">{meeting.title}</div>
                  <div className="text-sm text-muted-foreground">{formatWhen(meeting)}</div>
                </div>
                <DeleteButton meeting={meeting} onDelete={() => onDelete(meeting)} />
              </div>
              {meeting.description && (
                <p className="line-clamp-2 text-sm text-muted-foreground">{meeting.description}</p>
              )}
              <div className="flex items-center gap-1 text-sm">
                <MapPinIcon className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{meeting.place}</span>
              </div>
              <ParticipantBadges participants={meeting.participants} />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
