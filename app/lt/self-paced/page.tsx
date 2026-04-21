"use client";

import SelfPacedDashboard from "@/components/LTD/SelfPacedDashboard";
import { MousePointer2 } from "lucide-react";

/**
 * SelfPacedPage
 * 
 * Main entry for the LMS Self-Paced dashboard.
 * Displays engagement metrics and module distribution.
 */
export default function SelfPacedPage() {
  return (
    <div className="flex-1 space-y-8 p-8 pt-6 w-full pb-20">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <MousePointer2 className="h-6 w-6 text-purple-600" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-purple-600">Self-Paced Dashboard</h1>
        </div>
        <p className="text-sm text-muted-foreground">Detailed engagement and completion analytics for digital learning modules.</p>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        <SelfPacedDashboard />
      </div>
    </div>
  );
}
