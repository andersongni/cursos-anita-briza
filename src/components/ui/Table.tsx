import { cn } from '@/lib/utils'

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className={cn('min-w-full divide-y divide-border', className)}>
        {children}
      </table>
    </div>
  )
}

export function TableHeader({ children }: { children: React.ReactNode }) {
  return <thead className="bg-muted">{children}</thead>
}

export function TableBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-border bg-white">{children}</tbody>
}

export function TableRow({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <tr className={cn(onClick && 'cursor-pointer hover:bg-muted/50', className)} onClick={onClick}>
      {children}
    </tr>
  )
}

export function TableHead({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={cn('px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider', className)}>
      {children}
    </th>
  )
}

export function TableCell({ children, className, colSpan }: { children?: React.ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={cn('px-4 py-3 text-sm', className)}>{children}</td>
}
