import { Suspense } from 'react';
import ExecutiveDashboard from '@/components/LTD/ExecutiveDashboard';

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading dashboard...</div>}>
      <ExecutiveDashboard />
    </Suspense>
  );
}
