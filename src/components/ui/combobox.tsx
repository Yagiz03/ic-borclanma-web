"use client"

import * as React from "react"
import { ChevronsUpDown } from "lucide-react"
import { cn } from "cn"

export type ComboboxOption = { value: string; label: string; keywords?: string }

// Yazarak arama + otomatik tamamlama kutusu (07.09.2026, kullanıcı isteği):
// bir kısmını yazsan bile geri kalan eşleşenleri filtreleyip gösteren,
// klavye (yukarı/aşağı/Enter/Escape) ile de gezilebilen bir combobox --
// eskiden bu alanlar düz <select>'ti, uzun ISIN/kağıt listelerinde
// aranan seçeneği bulmak zordu.
export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Ara...",
  emptyText = "Sonuç yok.",
  className,
}: {
  options: ComboboxOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  emptyText?: string
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [highlight, setHighlight] = React.useState(0)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)
  // role="combobox" aria-controls ZORUNLU kılıyor -- açılır listeye kararlı bir
  // id verip girdiden ona işaret ediyoruz (ekran okuyucular listeyi bulabilsin).
  const listeId = React.useId()

  const selected = options.find((o) => o.value === value)

  const filtered = React.useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr")
    if (!q) return options
    return options.filter((o) => `${o.label} ${o.keywords ?? ""}`.toLocaleLowerCase("tr").includes(q))
  }, [options, query])

  React.useEffect(() => {
    function disariTiklama(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery("")
      }
    }
    document.addEventListener("mousedown", disariTiklama)
    return () => document.removeEventListener("mousedown", disariTiklama)
  }, [])

  React.useEffect(() => {
    if (open) {
      listRef.current?.querySelector(`[data-index="${highlight}"]`)?.scrollIntoView({ block: "nearest" })
    }
  }, [highlight, open])

  function sec(v: string) {
    onChange(v)
    setOpen(false)
    setQuery("")
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div className="relative">
        <input
          ref={inputRef}
          value={open ? query : (selected?.label ?? "")}
          onChange={(e) => {
            setQuery(e.target.value)
            // Vurguyu efekt içinde sıfırlamak zincirleme render tetikliyordu;
            // sorgu/odak değişiminin kaynağında sıfırlıyoruz.
            setHighlight(0)
            if (!open) setOpen(true)
          }}
          onFocus={() => {
            setOpen(true)
            setQuery("")
            setHighlight(0)
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault()
              setOpen(true)
              setHighlight((h) => Math.min(h + 1, filtered.length - 1))
            } else if (e.key === "ArrowUp") {
              e.preventDefault()
              setHighlight((h) => Math.max(h - 1, 0))
            } else if (e.key === "Enter") {
              e.preventDefault()
              const o = filtered[highlight]
              if (o) sec(o.value)
            } else if (e.key === "Escape") {
              setOpen(false)
              setQuery("")
              inputRef.current?.blur()
            }
          }}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={open}
          aria-controls={listeId}
          aria-autocomplete="list"
          autoComplete="off"
          className="h-10 w-full rounded-md border border-input bg-transparent px-3 pr-8 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        <ChevronsUpDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
      </div>

      {open && (
        <div
          ref={listRef}
          id={listeId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">{emptyText}</p>
          ) : (
            filtered.map((o, i) => (
              <button
                key={o.value}
                type="button"
                data-index={i}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => sec(o.value)}
                onMouseEnter={() => setHighlight(i)}
                className={cn(
                  "flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition-colors",
                  i === highlight ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                  o.value === value && "font-medium",
                )}
              >
                {o.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
