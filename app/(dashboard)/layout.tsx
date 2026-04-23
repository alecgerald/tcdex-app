"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
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
  Heart,
  Presentation,
  ClipboardCheck
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
      { name: "Dashboard", href: "/lms/dashboard", icon: LayoutDashboard },
      { name: "Upload Excel", href: "/lms/upload-excel", icon: FileUp },
      { name: "History", href: "/lms/history", icon: FileClock },
    ],
  },
  {
    name: "L&TD",
    id: "lt",
    icon: Briefcase,
    items: [
      { name: "Leadership Dashboard", href: "/lt/dashboard", icon: LayoutDashboard },
      { name: "Training Reports", href: "/lt/training-reports", icon: BarChart3 },
      { name: "Self-Paced", href: "/lt/self-paced", icon: GraduationCap },
      { name: "VILT Tracker", href: "/lt/vilt-tracker", icon: Presentation },
      { name: "Post-Learning Survey", href: "/lt/post-learning", icon: ClipboardCheck },
      { name: "LeadX & BuildX Reports", href: "/lt/leadx-reports", icon: Presentation },
      { name: "Import Excel", href: "/lt/import", icon: FileUp },
    ],
  },
  {
    name: "EX",
    id: "ex",
    icon: Heart,
    items: [
      { name: "Dashboard", href: "/ex", icon: LayoutDashboard },
      { name: "Reports", href: "/ex/reports", icon: BarChart3 },
    ],
  },
  {
    name: "ERG",
    id: "erg",
    icon: Users,
    items: [
      { name: "Dashboard", href: "/erg", icon: LayoutDashboard },
      { name: "Membership Directory", href: "/erg/directory", icon: Users },
      { name: "Upload Excel", href: "/erg/upload", icon: FileUp },
      { name: "Audit Logs", href: "/erg/audit-logs", icon: FileClock },
    ],
  },
  {
    name: "Comms",
    id: "comms",
    icon: Megaphone,
    items: [
      { name: "External Brand", href: "/comms/external-brand", icon: Heart },
      { name: "Upload Excel", href: "/comms/upload-excel", icon: FileUp },
      { name: "History", href: "/comms/history", icon: FileClock },
    ],
  },
  {
    name: "Governance",
    id: "governance",
    icon: Shield,
    items: [
      { name: "Dashboard", href: "/governance", icon: LayoutDashboard },
      { name: "Upload Excel", href: "/governance/upload", icon: FileUp },
      { name: "Reports", href: "/governance/reports", icon: BarChart3 },
    ],
  },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [openCategories, setOpenCategories] = useState<string[]>(["lms"])
  const [username, setUsername] = useState("User")
  const [userRole, setUserRole] = useState<string | null>(null)
  const [isRoleLoading, setIsRoleLoading] = useState(true)

  useEffect(() => {
    const fetchUserAndRole = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Fetch Profile
        const { data: profileData } = await supabase
          .from("profiles")
          .select("first_name, last_name, email")
          .eq("id", user.id)
          .single()
        
        if (profileData) {
          const fullName = `${profileData.first_name || ""} ${profileData.last_name || ""}`.trim()
          setUsername(fullName || profileData.email?.split("@")[0] || user.email?.split("@")[0] || "User")
        } else {
          setUsername(user.email?.split("@")[0] || "User")
        }

        // Fetch Role
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("roles(name)")
          .eq("user_id", user.id)
          .single()

        if (roleData && (roleData as any).roles) {
          setUserRole((roleData as any).roles.name)
        } else {
          setUserRole("viewer") // Default to viewer if no role found
        }
      }
      setIsRoleLoading(false)
    }
    fetchUserAndRole()
  }, [])

  // Access control check
  useEffect(() => {
    if (isRoleLoading || !userRole) return

    const isViewer = userRole === "viewer"
    if (isViewer) {
      const allowedPaths = [
        "/lms/dashboard",
        "/lms/history",
        "/comms/external-brand",
        "/comms/history",
        "/profile"
      ]
      
      const isForbidden = (
        pathname.includes("/upload") || 
        pathname.includes("/import")
      )

      if (isForbidden) {
        // Find first allowed dashboard
        router.push("/lms/dashboard")
      }
    }
  }, [userRole, isRoleLoading, pathname, router])

  const filteredCategories = sidebarCategories.filter(category => {
    if (isRoleLoading) return false
    if (userRole === "owner" || userRole === "lead") return true
    
    // Viewer restrictions
    return true // All categories visible for now, items filtered below
  }).map(category => {
    if (userRole !== "viewer") return category

    // Filter items within category for viewer
    return {
      ...category,
      items: category.items.filter(item => {
        // Viewer cannot access upload/import pages
        return !item.href.includes("/upload") && !item.href.includes("/import")
      })
    }
  })

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  // Automatically open the category corresponding to the current pathname
  useEffect(() => {
    // pathname example: "/lms/upload"
    const currentCategory = sidebarCategories.find(cat => pathname.startsWith(`/${cat.id}`))
    if (currentCategory) {
      setOpenCategories((prev) =>
        prev.includes(currentCategory.id) ? prev : [...prev, currentCategory.id]
      )
    }
  }, [pathname])

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
          <div className={cn("flex items-center overflow-hidden transition-all", !isSidebarOpen && "w-0 opacity-0")}>
            <span className="font-extrabold text-xl tracking-tight text-[#0046ab] truncate pl-3">TCDEX</span>
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

        <ScrollArea className="flex-1 min-h-0">
          <nav className="space-y-2 p-4">
            {filteredCategories.map((category) => {
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

        <div className={cn("p-4 border-t shrink-0 flex items-center", !isSidebarOpen ? "justify-center" : "justify-between")}>
          <div 
            onClick={() => router.push("/profile")}
            className={cn(
              "flex items-center gap-3 overflow-hidden transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800 p-2 rounded-lg cursor-pointer", 
              !isSidebarOpen && "w-0 opacity-0"
            )}
          >
            <div className="h-8 w-8 shrink-0 rounded-full bg-zinc-100 flex items-center justify-center dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
              <span className="text-[#0046ab] font-bold text-xs capitalize">{username[0]}</span>
            </div>
            <span className="font-semibold text-sm text-zinc-900 truncate dark:text-zinc-100">{username}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="shrink-0 text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-500 dark:hover:bg-red-950/30 rounded-full transition-colors"
            title="Logout"
          >
            <LogOut className="h-5 w-5" />
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
