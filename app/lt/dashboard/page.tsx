"use client";

import React from 'react';
import { useSearchParams } from 'next/navigation';
import ExecutiveDashboard from '@/components/LTD/ExecutiveDashboard';

export default function LTDashboardPage() {
  const searchParams = useSearchParams();
  const refresh = searchParams.get('refresh') || 'initial';

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Leadership Dashboard</h2>
      </div>
      <ExecutiveDashboard refreshTrigger={refresh} />
    </div>
  );
}
