"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  LayoutDashboard, 
  FileUp, 
  BarChart3, 
  LogOut,
  Menu,
  X,
  ChevronDown,
  GraduationCap,
  Briefcase,
  Users,
  Megaphone,
  Shield,
  FileClock,
  Heart
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"

const sidebarCategories = [
  {
    name: "LMS",
    id: "lms",
    icon: GraduationCap,
    items: [
      { name: "Dashboard", href: "/lms", icon: LayoutDashboard },
      { name: "Import Excel", href: "/lms/upload", icon: FileUp },
      { name: "Audit Logs", href: "/lms/audit-logs", icon: FileClock },
    ],
  },
  {
    name: "L&TD",
    id: "ltd",
    icon: Briefcase,
    items: [
      { name: "Dashboard", href: "/ltd", icon: LayoutDashboard },
      { name: "Import Excel", href: "/ltd/upload", icon: FileUp },
      { name: "Reports", href: "/ltd/reports", icon: BarChart3 },
    ],
  },
  {
    name: "EX",
    id: "ex",
    icon: Heart,
    items: [
      { name: "Dashboard", href: "/ex", icon: LayoutDashboard },
      { name: "Import Excel", href: "/ex/upload", icon: FileUp },
      { name: "Reports", href: "/ex/reports", icon: BarChart3 },
    ],
  },
  {
    name: "ERG",
    id: "erg",
    icon: Users,
    items: [
      { name: "Dashboard", href: "/erg", icon: LayoutDashboard },
      { name: "Import Excel", href: "/erg/upload", icon: FileUp },
      { name: "Reports", href: "/erg/reports", icon: BarChart3 },
    ],
  },
  {
    name: "Comms",
    id: "comms",
    icon: Megaphone,
    items: [
      { name: "External Brand", href: "/comms/external-brand", icon: Heart },
      { name: "Import Excel", href: "/comms/import-excel", icon: FileUp },
      { name: "Audit Logs", href: "/comms/audit-logs", icon: FileClock },
    ],
  },
  {
    name: "Governance",
    id: "governance",
    icon: Shield,
    items: [
      { name: "Dashboard", href: "/governance", icon: LayoutDashboard },
      { name: "Import Excel", href: "/governance/upload", icon: FileUp },
      { name: "Reports", href: "/governance/reports", icon: BarChart3 },
    ],
  },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [openCategories, setOpenCategories] = useState<string[]>(["comms"])
  const username = "tcdex.user"

  // Automatically open the category corresponding to the current pathname
  useEffect(() => {
    // pathname example: "/lms/upload"
    const currentCategory = sidebarCategories.find(cat => pathname.startsWith(`/${cat.id}`))
    if (currentCategory && !openCategories.includes(currentCategory.id)) {
      setOpenCategories((prev) => [...prev, currentCategory.id])
    }
  }, [pathname, openCategories])

  const toggleCategory = (id: string) => {
    setOpenCategories((prev) => 
      prev.includes(id) 
        ? prev.filter((c) => c !== id) 
        : [...prev, id]
    )
  }

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r transition-all duration-300 dark:bg-zinc-900",
          isSidebarOpen ? "w-64" : "w-20"
        )}
      >
        <div className="flex h-16 items-center justify-between px-4 border-b shrink-0">
          <div className={cn("flex items-center gap-3 overflow-hidden transition-all", !isSidebarOpen && "w-0 opacity-0")}>
            <div className="h-8 w-8 rounded-full bg-zinc-100 flex items-center justify-center dark:bg-zinc-800">
              <span className="text-[#0046ab] font-bold text-xs capitalize">{username[0]}</span>
            </div>
            <span className="font-semibold text-zinc-900 truncate dark:text-zinc-100">{username}</span>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="shrink-0"
          >
            {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <nav className="space-y-2 p-4">
            {sidebarCategories.map((category) => {
              const isOpen = openCategories.includes(category.id)
              const hasActiveChild = category.items.some(item => pathname === item.href)

              return (
                <div key={category.id} className="space-y-1">
                  <button
                    onClick={() => {
                      if (!isSidebarOpen) {
                        setIsSidebarOpen(true)
                        if (!isOpen) toggleCategory(category.id)
                      } else {
                        toggleCategory(category.id)
                      }
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer",
                      hasActiveChild 
                        ? "text-[#0046ab]" 
                        : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800",
                      !isSidebarOpen && "justify-center px-2"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <category.icon className={cn("h-5 w-5 shrink-0", hasActiveChild && "text-[#0046ab]")} />
                      <span className={cn("transition-all duration-300", !isSidebarOpen && "hidden opacity-0")}>
                        {category.name}
                      </span>
                    </div>
                    {isSidebarOpen && (
                      <ChevronDown 
                        className={cn(
                          "h-4 w-4 transition-transform duration-200",
                          isOpen ? "rotate-0" : "-rotate-90"
                        )} 
                      />
                    )}
                  </button>
                  
                  {isSidebarOpen && isOpen && (
                    <div className="ml-4 mt-1 space-y-1 border-l pl-4">
                      {category.items.map((item: any) => {
                        const isActive = pathname === item.href
                        
                        if (item.disabled) {
                          return (
                            <div 
                              key={item.name} 
                              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-300 dark:text-zinc-600 cursor-not-allowed"
                            >
                              <item.icon className="h-4 w-4 shrink-0" />
                              <span className="font-medium">
                                {item.name}
                              </span>
                            </div>
                          )
                        }

                        return (
                          <Link 
                            key={item.name} 
                            href={item.href}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                              isActive 
                                ? "bg-[#0046ab]/10 text-[#0046ab]" 
                                : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                            )}
                          >
                            <item.icon className={cn("h-4 w-4 shrink-0", isActive && "text-[#0046ab]")} />
                            <span className="font-medium">
                              {item.name}
                            </span>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>
        </ScrollArea>

        <div className="p-4 border-t shrink-0">
          <Button 
            variant="ghost" 
            asChild
            className={cn(
              "w-full justify-start text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-50",
              !isSidebarOpen && "justify-center"
            )}
          >
            <Link href="/login">
              <LogOut className="h-5 w-5 shrink-0" />
              <span className={cn("ml-3 transition-all duration-300", !isSidebarOpen && "hidden opacity-0")}>Logout</span>
            </Link>
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className={cn(
        "flex flex-col flex-1 transition-all duration-300 min-w-0",
        isSidebarOpen ? "pl-64" : "pl-20"
      )}>
        <main className="p-6 lg:p-10 min-h-screen">
          {children}
        </main>
      </div>
    </div>
  )
}
