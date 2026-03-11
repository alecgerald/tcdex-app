"use client"

import { useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { cn } from "@/lib/utils"

export default function LTLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Sidebar onToggle={setIsSidebarOpen} />

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
