import { format } from 'date-fns'
import { CalendarDays } from 'lucide-react'
import { useState } from 'react'
import { Button } from './ui/button'
import { Calendar } from './ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'

type DatePickerProps = {
  ariaLabel: string
  value: string
  onChange: (value: string) => void
}

function parseLocalDate(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return undefined
  const [, year, month, day] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  return date.getFullYear() === Number(year) && date.getMonth() === Number(month) - 1
    ? date
    : undefined
}

function toDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function DatePicker({ ariaLabel, value, onChange }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const selected = parseLocalDate(value)

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-label={`${ariaLabel}: ${selected ? format(selected, 'MMM d, yyyy') : 'Choose date'}`}
          className="min-h-10 w-full justify-start gap-2 px-3 text-left font-normal sm:w-44"
          variant="outline"
        >
          <CalendarDays aria-hidden="true" className="text-muted-foreground" />
          {selected ? format(selected, 'MMM d, yyyy') : 'Choose date'}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0" sideOffset={8}>
        <Calendar
          mode="single"
          onSelect={(date) => {
            if (date) {
              onChange(toDateValue(date))
              setOpen(false)
            }
          }}
          selected={selected}
        />
      </PopoverContent>
    </Popover>
  )
}
