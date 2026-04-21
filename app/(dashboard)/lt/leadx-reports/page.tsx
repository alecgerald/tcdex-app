"use client";

import LeadXReportsDashboard from "@/components/LTD/LeadXReportsDashboard";
import { Presentation } from "lucide-react";

/**
 * LeadXReportsPage
 * 
 * Dashboard for LeadX and BuildX session analytics.
 * Includes metrics for registrations, attendance, and session-specific rates.
 */
export default function LeadXReportsPage() {
  return (
    <div className="flex-1 space-y-8 p-8 pt-6 w-full pb-20">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#0046ab]/10 rounded-lg">
            <Presentation className="h-6 w-6 text-[#0046ab]" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-[#0046ab]">LeadX & BuildX Reports</h1>
        </div>
        <p className="text-sm text-muted-foreground">Session-level engagement and attendance analytics for leadership workshops.</p>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        <LeadXReportsDashboard />
      </div>
    </div>
  );
}
