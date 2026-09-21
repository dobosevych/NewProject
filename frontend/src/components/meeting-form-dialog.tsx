import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { ParticipantPicker } from '@/components/participant-picker'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { useCreateMeeting } from '@/hooks/queries'

const timePattern = /^\d{2}:\d{2}$/

const meetingSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(200),
    description: z.string(),
    date: z.date({ error: 'Pick a date' }),
    startTime: z.string().regex(timePattern, 'Enter a start time'),
    endTime: z.string().regex(timePattern, 'Enter an end time'),
    place: z.string().trim().min(1, 'Place is required').max(200),
    participantIds: z.array(z.string()),
  })
  .refine((v) => v.endTime > v.startTime, {
    message: 'End time must be after start time',
    path: ['endTime'],
  })

type MeetingFormValues = z.input<typeof meetingSchema>

const defaultValues: MeetingFormValues = {
  title: '',
  description: '',
  date: undefined as unknown as Date,
  startTime: '10:00',
  endTime: '11:00',
  place: '',
  participantIds: [],
}

function combine(date: Date, time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const result = new Date(date)
  result.setHours(hours, minutes, 0, 0)
  return result.toISOString()
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MeetingFormDialog({ open, onOpenChange }: Props) {
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const createMeeting = useCreateMeeting()
  const form = useForm<MeetingFormValues>({
    resolver: zodResolver(meetingSchema),
    defaultValues,
  })

  const close = (next: boolean) => {
    if (!next) form.reset(defaultValues)
    onOpenChange(next)
  }

  const onSubmit = form.handleSubmit((values) => {
    createMeeting.mutate(
      {
        title: values.title.trim(),
        description: values.description.trim(),
        starts_at: combine(values.date, values.startTime),
        ends_at: combine(values.date, values.endTime),
        place: values.place.trim(),
        participant_ids: values.participantIds,
      },
      {
        onSuccess: (meeting) => {
          toast.success(`Meeting "${meeting.title}" created`)
          close(false)
        },
        onError: (error) => form.setError('root', { message: error.message }),
      },
    )
  })

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add meeting</DialogTitle>
          <DialogDescription>Fill in the details and pick who takes part.</DialogDescription>
        </DialogHeader>

        <form id="meeting-form" onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <Controller
              name="title"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="meeting-title">Title</FieldLabel>
                  <Input id="meeting-title" aria-invalid={fieldState.invalid} {...field} />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              name="description"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="meeting-description">Description</FieldLabel>
                  <Textarea id="meeting-description" rows={3} {...field} />
                </Field>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto]">
              <Controller
                name="date"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="meeting-date">Date</FieldLabel>
                    <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          id="meeting-date"
                          type="button"
                          variant="outline"
                          aria-invalid={fieldState.invalid}
                          className="justify-start font-normal"
                        >
                          <CalendarIcon />
                          {field.value ? (
                            format(field.value, 'EEE, d MMM yyyy')
                          ) : (
                            <span className="text-muted-foreground">Pick a date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => {
                            field.onChange(date)
                            setDatePickerOpen(false)
                          }}
                          autoFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
              <Controller
                name="startTime"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="meeting-start">Start</FieldLabel>
                    <Input
                      id="meeting-start"
                      type="time"
                      aria-invalid={fieldState.invalid}
                      {...field}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
              <Controller
                name="endTime"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="meeting-end">End</FieldLabel>
                    <Input
                      id="meeting-end"
                      type="time"
                      aria-invalid={fieldState.invalid}
                      {...field}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            </div>

            <Controller
              name="place"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="meeting-place">Place</FieldLabel>
                  <Input
                    id="meeting-place"
                    placeholder="Room, address, or video link"
                    aria-invalid={fieldState.invalid}
                    {...field}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              name="participantIds"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="meeting-participants">Participants</FieldLabel>
                  <ParticipantPicker
                    id="meeting-participants"
                    value={field.value}
                    onChange={field.onChange}
                    invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            {form.formState.errors.root && (
              <FieldError>{form.formState.errors.root.message}</FieldError>
            )}
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button type="submit" form="meeting-form" disabled={createMeeting.isPending}>
            {createMeeting.isPending ? 'Saving...' : 'Add meeting'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
