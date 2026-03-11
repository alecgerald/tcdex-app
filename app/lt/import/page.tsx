"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import AssessmentUpload from '@/components/LTD/AssessmentUpload';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';

export default function LTImportPage() {
  const router = useRouter();
  const [assessmentType, setAssessmentType] = useState<'pre' | 'post'>('pre');

  const handleUploadSuccess = () => {
    // Redirect to dashboard with a refresh trigger
    router.push(`/lt/dashboard?refresh=${Date.now()}`);
  };

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Import Assessment Data</h2>
      </div>
      
      <div className="max-w-4xl space-y-6">
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Select Assessment Phase</Label>
          <Tabs 
            value={assessmentType} 
            onValueChange={(val) => setAssessmentType(val as 'pre' | 'post')}
            className="w-[400px]"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pre">Pre-Program</TabsTrigger>
              <TabsTrigger value="post">Post-Program</TabsTrigger>
            </TabsList>
          </Tabs>
          <p className="text-xs text-muted-foreground mt-1">
            Ensure the Excel file matches the selected phase. The data will be stored as <strong>{assessmentType}</strong> assessment.
          </p>
        </div>

        <AssessmentUpload 
          onUploadSuccess={handleUploadSuccess} 
          assessmentType={assessmentType} 
        />
      </div>
    </div>
  );
}
