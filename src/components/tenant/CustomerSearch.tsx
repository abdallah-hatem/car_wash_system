import { useState, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCustomerSearch } from "@/lib/tenant/queries"
import type { CustomerMatch } from "@/lib/tenant/customer-search"

interface Props {
  onOpenCustomer: (match: CustomerMatch) => void
}

export function CustomerSearch({ onOpenCustomer }: Props) {
  const { t } = useTranslation()
  const [term, setTerm] = useState("")
  const [debouncedTerm, setDebouncedTerm] = useState("")
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounce the term into debouncedTerm — the query hook is idle when debouncedTerm is empty
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const trimmed = term.trim()
    if (!trimmed) {
      setDebouncedTerm("")
      return
    }
    timerRef.current = setTimeout(() => {
      setDebouncedTerm(trimmed)
    }, 300)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [term])

  const { data: results = [], isFetching, isSuccess } = useCustomerSearch(debouncedTerm)

  const trimmed = term.trim()
  const state =
    !trimmed
      ? "idle"
      : isFetching
        ? "searching"
        : isSuccess && results.length === 0
          ? "no-results"
          : isSuccess && results.length > 0
            ? "results"
            : "idle"

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="customer-search">{t("customerSearch.label")}</Label>
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="customer-search"
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={t("customerSearch.placeholder")}
          className="min-h-[44px] ps-9"
          autoComplete="off"
        />
      </div>

      {state === "searching" && (
        <p className="text-sm text-muted-foreground">{t("plateSearch.searching")}</p>
      )}

      {state === "no-results" && (
        <p className="text-sm text-muted-foreground">{t("customerSearch.noResults")}</p>
      )}

      {state === "results" && results.length > 0 && (
        <ul role="list" className="flex flex-col gap-1 rounded-md border bg-background p-1 max-w-sm">
          {results.map((match) => (
            <li key={match.id}>
              <button
                type="button"
                onClick={() => onOpenCustomer(match)}
                className="w-full text-start rounded px-3 py-2 text-sm hover:bg-muted min-h-[44px] flex flex-col justify-center"
              >
                <span className="font-semibold text-teal-700 dark:text-teal-400">{match.name}</span>
                <span className="text-muted-foreground text-xs flex flex-wrap gap-x-2">
                  {match.phone && <span>{match.phone}</span>}
                  {match.matched_plate && (
                    <span>
                      {t("customerSearch.matchedPlate")}: {match.matched_plate}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
