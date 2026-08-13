import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Boxes,
  FileText,
  Receipt,
  Users,
  ScanLine,
  LogOut,
  Settings,
  BarChart3,
  Wallet,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, adminOnly: true },
  { title: "Inventory",  url: "/inventory",  icon: Boxes,           adminOnly: false },
  { title: "Scan",       url: "/scan",        icon: ScanLine,        adminOnly: false },
  { title: "Invoices",   url: "/invoices",    icon: FileText,        adminOnly: false },
  { title: "Receipts",   url: "/receipts",    icon: Receipt,         adminOnly: false },
  { title: "Clients",    url: "/clients",     icon: Users,           adminOnly: true },
  { title: "Reports",    url: "/reports",     icon: BarChart3,       adminOnly: true },
  { title: "Payroll",    url: "/payroll",     icon: Wallet,          adminOnly: true },
  { title: "Settings",   url: "/settings",    icon: Settings,        adminOnly: true },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isAdmin, role } = useRole();

  const visibleItems = items.filter((i) => (i.adminOnly ? isAdmin : true));

  const isActive = (url: string) => pathname === url || pathname.startsWith(url + "/");

  const initials = (user?.email ?? "?")
    .split("@")[0]
    .slice(0, 2)
    .toUpperCase();

  function handleSignOut() {
    signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Boxes className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold tracking-tight">StockRoom</span>
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Operations
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    className="data-[active=true]:bg-primary-soft data-[active=true]:text-primary data-[active=true]:font-medium rounded-xl"
                  >
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
          <Avatar className="h-8 w-8 border border-border">
            <AvatarFallback className="bg-primary-soft text-[11px] font-medium text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-xs font-medium text-foreground">{user?.email}</p>
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {role === "admin" ? "Administrator" : "Cashier"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 group-data-[collapsible=icon]:hidden hover:bg-destructive/10 hover:text-destructive"
            onClick={handleSignOut}
            aria-label="Sign out"
            id="sidebar-signout-btn"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
