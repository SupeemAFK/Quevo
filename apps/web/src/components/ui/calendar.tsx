import { cn } from 'cn'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react'
import type { DayPickerProps } from 'react-day-picker'
import { DayPicker } from 'react-day-picker'

type CalendarChevronProps = {
  className?: string
  disabled?: boolean
  orientation?: 'up' | 'down' | 'left' | 'right'
  size?: number
  style?: React.CSSProperties
}

function CalendarChevron({ className, orientation, size, style }: CalendarChevronProps) {
  const Icon =
    orientation === 'left'
      ? ChevronLeft
      : orientation === 'up'
        ? ChevronUp
        : orientation === 'down'
          ? ChevronDown
          : ChevronRight
  return <Icon aria-hidden="true" className={className} size={size} style={style} />
}

function Calendar({ className, classNames, ...props }: DayPickerProps) {
  return (
    <DayPicker
      className={cn('w-fit p-3', className)}
      classNames={{
        months: 'flex flex-col gap-4',
        month: 'space-y-3',
        month_caption: 'relative flex h-8 items-center justify-center',
        caption_label: 'text-sm font-medium',
        nav: 'absolute inset-x-0 top-0 flex items-center justify-between',
        button_previous:
          'inline-flex size-8 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40',
        button_next:
          'inline-flex size-8 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40',
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'w-9 rounded-md text-center text-xs font-medium text-muted-foreground',
        weeks: 'mt-2 flex flex-col gap-1',
        week: 'flex w-full',
        day: 'relative size-9 p-0 text-center',
        day_button:
          'inline-flex size-9 items-center justify-center rounded-md text-sm font-normal text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected:
          '[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground',
        today: '[&>button]:font-semibold [&>button]:underline [&>button]:underline-offset-4',
        outside: '[&>button]:text-muted-foreground/50',
        disabled:
          '[&>button]:cursor-not-allowed [&>button]:text-muted-foreground/40 [&>button]:opacity-40',
        hidden: 'invisible',
        chevron: 'size-4',
        ...classNames,
      }}
      components={{
        Chevron: CalendarChevron,
        ...props.components,
      }}
      {...props}
    />
  )
}

export { Calendar }
