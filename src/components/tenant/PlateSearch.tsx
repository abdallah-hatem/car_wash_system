import { useState, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { usePlateSearch } from "@/lib/tenant/queries"

interface Props {
  onOpenCustomer: (customerId: string) => void
}

export function PlateSearch({ onOpenCustomer }: Props) {
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

  const { data: results = [], isFetching, isSuccess } = usePlateSearch(debouncedTerm)

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
      <Label htmlFor="plate-search">{t("plateSearch.label")}</Label>
      <Input
        id="plate-search"
        type="search"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder={t("plateSearch.placeholder")}
        className="min-h-[44px] max-w-sm"
        autoComplete="off"
      />

      {state === "searching" && (
        <p className="text-sm text-muted-foreground">{t("plateSearch.searching")}</p>
      )}

      {state === "no-results" && (
        <p className="text-sm text-muted-foreground">{t("plateSearch.noResults")}</p>
      )}

      {state === "results" && results.length > 0 && (
        <ul role="list" className="flex flex-col gap-1 rounded-md border bg-background p-1 max-w-sm">
          {results.map((match) => (
            <li key={match.id}>
              <button
                type="button"
                disabled={!match.customer_id}
                onClick={() => {
                  if (match.customer_id) onOpenCustomer(match.customer_id)
                }}
                className="w-full text-start rounded px-3 py-2 text-sm hover:bg-muted disabled:cursor-default disabled:opacity-60 min-h-[44px] flex flex-col justify-center"
              >
                <span className="font-semibold">{match.plate_number}</span>
                <span className="text-muted-foreground text-xs">
                  {match.make || match.model
                    ? [match.make, match.model].filter(Boolean).join(" ")
                    : null}
                  {match.customer_name ? (
                    <>
                      {(match.make || match.model) ? " · " : ""}
                      {t("plateSearch.owner")}: {match.customer_name}
                    </>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
