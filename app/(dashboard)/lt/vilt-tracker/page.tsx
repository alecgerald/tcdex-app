"use client";

import React from 'react';
import VILTTrackerDashboard from "@/components/LTD/VILTTrackerDashboard";
import { Presentation } from 'lucide-react';

export default function VILTTrackerPage() {
  return (
    <div className="w-full space-y-8 pb-20 px-4">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-xl"><Presentation className="h-6 w-6 text-[#0046ab]" /></div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#0046ab]">VILT Performance Tracker</h1>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Attendance & Enrollment Management</p>
          </div>
        </div>
      </div>

      <div className="w-full">
        <VILTTrackerDashboard />
      </div>
    </div>
  );
}
