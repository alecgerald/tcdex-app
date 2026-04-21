"use client";

import TrainingReportsDashboard from "@/components/LTD/TrainingReportsDashboard";
import { FileText } from "lucide-react";

/**
 * TrainingReportsPage
 * 
 * Main entry for the VILT Training Reports dashboard.
 * Displays independent metrics and performance distribution by department.
 */
export default function TrainingReportsPage() {
  return (
    <div className="flex-1 space-y-8 p-8 pt-6 w-full pb-20">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#0046ab]/10 rounded-lg">
            <FileText className="h-6 w-6 text-[#0046ab]" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-[#0046ab]">Training Reports Dashboard</h1>
        </div>
        <p className="text-sm text-muted-foreground">Comprehensive analytics for Virtual Instructor-Led Training (VILT) performance.</p>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        <TrainingReportsDashboard />
      </div>
    </div>
  );
}
