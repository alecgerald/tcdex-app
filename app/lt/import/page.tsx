"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import AssessmentUpload from '@/components/LTD/AssessmentUpload';

export default function LTImportPage() {
  const router = useRouter();

  const handleUploadSuccess = () => {
    // Redirect to dashboard with a refresh trigger
    router.push(`/lt/dashboard?refresh=${Date.now()}`);
  };

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Import Assessment Data</h2>
      </div>
      <div className="max-w-4xl">
        <AssessmentUpload onUploadSuccess={handleUploadSuccess} />
      </div>
    </div>
  );
}
