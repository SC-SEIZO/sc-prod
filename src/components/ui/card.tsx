import * as React from "react"
import { cn } from "../../lib/utils"

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("bg-white text-slate-900 border border-slate-200 rounded-xl shadow-sm", className)} {...props} />
))
Card.displayName = "Card"

export { Card }
