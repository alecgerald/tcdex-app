"use client";

import React from 'react';
import PostLearningDashboard from "@/components/LTD/PostLearningDashboard";
import { ClipboardCheck } from 'lucide-react';

export default function PostLearningPage() {
  return (
    <div className="w-full space-y-8 pb-20 px-4">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-50 rounded-xl">
            <ClipboardCheck className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-emerald-600">Post-Learning Experience Survey</h1>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">i-ELEVATE Q1 Cohort 1 Feedback</p>
          </div>
        </div>
      </div>

      <div className="w-full">
        <PostLearningDashboard />
      </div>
    </div>
  );
}
