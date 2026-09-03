import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { InstallGuide } from "./InstallGuide"
import { isStandalone } from "@/lib/pwa/platform"

export function InstallDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto p-5">
        {/* Radix requires a title for the accessible name; the guide renders
            its own heading, so this one is visually hidden rather than a
            second heading competing with it. */}
        <DialogTitle className="sr-only">Install</DialogTitle>
        <InstallGuide />
      </DialogContent>
    </Dialog>
  )
}

/** Nothing to offer when the app is already installed. */
export function useShouldOfferInstall(): boolean {
  const [offer, setOffer] = useState(false)
  useEffect(() => setOffer(!isStandalone()), [])
  return offer
}
