import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  in_stock: "bg-primary-soft text-primary border-transparent",
  low_stock: "bg-warning/15 text-warning-foreground border-warning/40",
  out_of_stock: "bg-destructive/10 text-destructive border-destructive/30",
  draft: "bg-muted text-muted-foreground border-border",
  sent: "bg-accent text-accent-foreground border-transparent",
  overdue: "bg-destructive/10 text-destructive border-destructive/30",
  paid: "bg-primary-soft text-primary border-transparent",
  partially_paid: "bg-warning/20 text-warning border-warning/40",
  unpaid: "bg-destructive/10 text-destructive border-destructive/30",
  cancelled: "bg-muted text-muted-foreground line-through border-border",
};

const labels: Record<string, string> = {
  in_stock: "In stock",
  low_stock: "Low stock",
  out_of_stock: "Out of stock",
  draft: "Draft",
  sent: "Sent",
  overdue: "Overdue",
  paid: "Paid",
  partially_paid: "Partially Paid",
  unpaid: "Unpaid",
  cancelled: "Cancelled",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-sm px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em]",
        styles[status] ?? "",
      )}
    >
      {labels[status] ?? status}
    </Badge>
  );
}
