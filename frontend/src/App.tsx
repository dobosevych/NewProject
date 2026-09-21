import { useState } from 'react'
import { PlusIcon } from 'lucide-react'

import { DeleteMeetingDialog } from '@/components/delete-meeting-dialog'
import { MeetingFormDialog } from '@/components/meeting-form-dialog'
import { MeetingList } from '@/components/meeting-list'
import { Button } from '@/components/ui/button'
import type { Meeting } from '@/lib/api'

export default function App() {
  const [formOpen, setFormOpen] = useState(false)
  const [meetingToDelete, setMeetingToDelete] = useState<Meeting | null>(null)

  return (
    <div className="mx-auto flex min-h-svh max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Meetings</h1>
          <p className="text-sm text-muted-foreground">Upcoming meetings, soonest first.</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <PlusIcon />
          Add meeting
        </Button>
      </header>

      <main>
        <MeetingList onAdd={() => setFormOpen(true)} onDelete={setMeetingToDelete} />
      </main>

      <MeetingFormDialog open={formOpen} onOpenChange={setFormOpen} />
      <DeleteMeetingDialog meeting={meetingToDelete} onClose={() => setMeetingToDelete(null)} />
    </div>
  )
}
