import * as React from "react"
import { useTranslation } from "react-i18next"
import { CalendarDays } from "lucide-react"
import { format } from "date-fns"
import { ar } from "date-fns/locale/ar"
import { enUS } from "date-fns/locale/en-US"
import type { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { formatYmd, parseYmd, presetRange, type RangePreset } from "@/lib/tenant/duration"

interface DateRangePickerProps {
  from: string
  to: string
  onChange: (from: string, to: string) => void
  className?: string
}

const PRESETS: RangePreset[] = ["today", "last7", "last30", "thisMonth"]

const PRESET_KEY: Record<RangePreset, string> = {
  today: "dateRange.today",
  last7: "dateRange.last7",
  last30: "dateRange.last30",
  thisMonth: "dateRange.thisMonth",
}

export function DateRangePicker({
  from,
  to,
  onChange,
  className,
}: DateRangePickerProps) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = React.useState(false)
  const [isWide, setIsWide] = React.useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(min-width: 768px)").matches
      : false
  )

  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    const handler = (e: MediaQueryListEvent) => setIsWide(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  // Local draft selection. The trigger always shows the applied range, but the
  // calendar edits a draft so a complete applied range doesn't make the first
  // click collapse it: opening seeds the applied range, the first click starts a
  // fresh range from the clicked day, and the second click completes + applies it.
  const [draft, setDraft] = React.useState<DateRange | undefined>(undefined)
  const startFresh = React.useRef(true)

  React.useEffect(() => {
    if (open) {
      setDraft({ from: parseYmd(from), to: parseYmd(to) })
      startFresh.current = true
    }
  }, [open, from, to])

  const dir = i18n.dir()
  const locale = i18n.language === "ar" ? ar : enUS

  // Display label: localised range string
  const fromDate = parseYmd(from)
  const toDate = parseYmd(to)
  const fromLabel = format(fromDate, "PP", { locale })
  const toLabel = format(toDate, "PP", { locale })
  const label = from === to ? fromLabel : `${fromLabel} – ${toLabel}`

  function handleSelect(range: DateRange | undefined, clickedDay: Date) {
    // First click after opening starts a brand-new range from the clicked day,
    // so the previously-applied range never interferes with the new selection.
    if (startFresh.current) {
      startFresh.current = false
      setDraft({ from: clickedDay, to: undefined })
      return
    }
    setDraft(range)
    // Apply + close only once both ends are chosen.
    if (range?.from && range?.to) {
      onChange(formatYmd(range.from), formatYmd(range.to))
      setOpen(false)
    }
  }

  function handlePreset(kind: RangePreset) {
    const { from: f, to: t2 } = presetRange(kind, new Date())
    onChange(f, t2)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label={label}
          className={cn(
            "min-h-[44px] w-full justify-start gap-2 text-start font-normal sm:w-auto sm:min-w-[260px]",
            className
          )}
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-auto p-0"
        align="start"
        sideOffset={4}
      >
        <div className={cn("flex", isWide ? "flex-row" : "flex-col")}>
          {/* Preset buttons */}
          <div
            className={cn(
              "flex gap-1 p-3",
              isWide
                ? "flex-col border-e border-border"
                : "flex-row flex-wrap border-b border-border"
            )}
          >
            {PRESETS.map((kind) => (
              <Button
                key={kind}
                variant="ghost"
                size="sm"
                className="min-h-[44px] justify-start px-3 text-sm font-normal"
                onClick={() => handlePreset(kind)}
              >
                {t(PRESET_KEY[kind])}
              </Button>
            ))}
          </div>

          {/* Calendar */}
          <Calendar
            mode="range"
            numberOfMonths={isWide ? 2 : 1}
            dir={dir}
            locale={locale}
            selected={draft}
            defaultMonth={toDate}
            onSelect={handleSelect}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
