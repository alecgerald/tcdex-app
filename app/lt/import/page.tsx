"use client";

import React, { useState } from 'react';
import AssessmentUpload from '@/components/LTD/AssessmentUpload';
import TrainingReportsUpload from '@/components/LTD/TrainingReportsUpload';
import LMSUpload from '@/components/LTD/LMSUpload';
import LeadXCombinedUpload from '@/components/LTD/LeadXCombinedUpload';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  FileSpreadsheet, 
  GraduationCap, 
  Laptop, 
  Presentation,
  Info
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/**
 * LTImportPage
 * 
 * Central hub for uploading different types of learning and development data.
 * Refactored into a horizontal 3-column flex layout.
 */
export default function LTImportPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [assessmentType, setAssessmentType] = useState<'pre' | 'post'>('pre');

  const handleUploadSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="flex-1 space-y-8 p-8 pt-6 w-full pb-20">
      {/* Title Section */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight text-[#0046ab]">Data Import Center</h1>
        <p className="text-sm text-muted-foreground">Centralized tools for synchronizing learning metrics and assessment data.</p>
      </div>
      
      {/* Horizontal Flex Layout */}
      <div className="flex flex-wrap lg:flex-nowrap gap-4 items-stretch justify-start">
        
        {/* Module 1: Pre & Post Assessment */}
        <Card className="flex-1 min-w-[320px] shadow-sm hover:shadow-md transition-shadow flex flex-col">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-3 mb-1">
              <div className="p-1.5 bg-[#0046ab]/10 rounded-lg">
                <FileSpreadsheet className="h-4 w-4 text-[#0046ab]" />
              </div>
              <CardTitle className="text-base font-bold">Pre & Post Assessment</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Upload Microsoft Forms Excel exports for assessment feedback.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-4 flex-1">
            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Assessment Phase</Label>
              <Tabs 
                value={assessmentType} 
                onValueChange={(val) => setAssessmentType(val as 'pre' | 'post')}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2 h-8">
                  <TabsTrigger value="pre" className="text-[10px] font-bold">Pre-Program</TabsTrigger>
                  <TabsTrigger value="post" className="text-[10px] font-bold">Post-Program</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <AssessmentUpload 
              onUploadSuccess={handleUploadSuccess} 
              assessmentType={assessmentType} 
            />
          </CardContent>
        </Card>

        {/* Module 2: Training Reports */}
        <Card className="flex-1 min-w-[320px] shadow-sm hover:shadow-md transition-shadow flex flex-col">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-3 mb-1">
              <div className="p-1.5 bg-emerald-50 rounded-lg">
                <GraduationCap className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold">Training Reports</CardTitle>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[250px] p-3 text-[10px] leading-relaxed">
                      <p className="font-bold mb-1">SQL Schema Note:</p>
                      <code className="block p-1 bg-zinc-100 dark:bg-zinc-800 rounded border font-mono">
                        ALTER TABLE training_reports ADD COLUMN employee_id TEXT, ADD COLUMN employee_name TEXT;
                      </code>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            <CardDescription className="text-xs">
              Upload virtual instructor-led training completion data.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2 flex flex-col flex-1">
            <div className="flex-1">
              <TrainingReportsUpload onUploadSuccess={handleUploadSuccess} />
            </div>
            <p className="mt-4 text-[9px] text-muted-foreground leading-tight italic border-t pt-3">
              Note: Rows are appended directly to the database. All rows are inserted as new completion records.
            </p>
          </CardContent>
        </Card>

        {/* Module 3: LeadX & BuildX Workshop Data */}
        <Card className="flex-1 min-w-[320px] shadow-sm hover:shadow-md transition-shadow flex flex-col">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-3 mb-1">
              <div className="p-1.5 bg-blue-50 rounded-lg">
                <Presentation className="h-4 w-4 text-blue-600" />
              </div>
              <CardTitle className="text-base font-bold">LeadX & BuildX Workshop Data</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Synchronize session registration and attendance reports together.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2 flex-1">
            <LeadXCombinedUpload onUploadSuccess={handleUploadSuccess} />
          </CardContent>
        </Card>

      </div>

      {/* Secondary Row for remaining imports */}
      <div className="flex flex-wrap gap-4 items-stretch justify-start">
        {/* Module 4: Self-Paced (LMS) Reports */}
        <Card className="w-full lg:w-[calc(33.33%-1rem)] shadow-sm hover:shadow-md transition-shadow flex flex-col">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-3 mb-1">
              <div className="p-1.5 bg-purple-50 rounded-lg">
                <Laptop className="h-4 w-4 text-purple-600" />
              </div>
              <CardTitle className="text-base font-bold">Self-Paced (LMS) Reports</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Sync digital learning activity via email address matching.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <LMSUpload onUploadSuccess={handleUploadSuccess} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
