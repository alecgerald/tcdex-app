"use client";

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { createClient } from '@/utils/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, AlertCircle, MousePointer2 } from 'lucide-react';
import { toast } from 'sonner';

interface LMSUploadProps {
  onUploadSuccess?: () => void;
}

/**
 * LMSUpload
 * 
 * Standalone component to upload LMS Self-Paced reports.
 * Columns: First name, Last name, Email, Course, Enrolled on, Status
 */
const LMSUpload: React.FC<LMSUploadProps> = ({ onUploadSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; inserted: number; skipped: number } | null>(null);
  const supabase = createClient();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setProgress(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (jsonData.length < 2) {
        toast.error("File appears to be empty or missing data rows.");
        setLoading(false);
        return;
      }

      // 1. Detect Header Row and Columns
      let headerIndex = -1;
      let emailCol = -1;
      let courseCol = -1;
      let statusCol = -1;
      let dateCol = -1;

      for (let i = 0; i < Math.min(jsonData.length, 20); i++) {
        const row = jsonData[i].map(cell => String(cell || "").toLowerCase().trim());
        const eIdx = row.findIndex(cell => cell === "email");
        const cIdx = row.findIndex(cell => cell.includes("course"));
        const sIdx = row.findIndex(cell => cell.includes("status"));
        const dIdx = row.findIndex(cell => cell.includes("enrolled on") || cell.includes("date") || cell.includes("completed at"));

        if (eIdx !== -1 && cIdx !== -1 && sIdx !== -1) {
          headerIndex = i;
          emailCol = eIdx;
          courseCol = cIdx;
          statusCol = sIdx;
          dateCol = dIdx;
          break;
        }
      }

      if (headerIndex === -1) {
        toast.error("Could not detect required columns (Email, Course, Status).");
        setLoading(false);
        return;
      }

      const dataRows = jsonData.slice(headerIndex + 1);
      const total = dataRows.length;
      let insertedCount = 0;
      let skippedCount = 0;

      setProgress({ current: 0, total, inserted: 0, skipped: 0 });

      // 2. Process Rows in Batches
      const batchSize = 100;
      for (let i = 0; i < dataRows.length; i += batchSize) {
        const batch = dataRows.slice(i, i + batchSize);
        
        // Collect emails for bulk lookup
        const emails = batch
          .map(row => String(row[emailCol] || "").trim().toLowerCase())
          .filter(e => e !== "");

        if (emails.length === 0) {
          skippedCount += batch.length;
          continue;
        }

        // Bulk lookup participants by email
        const { data: participants, error: pError } = await supabase
          .from('participants')
          .select('id, email')
          .in('email', emails);

        if (pError) throw pError;

        // Map email to participant_id
        const emailMap = new Map(participants?.map(p => [p.email.toLowerCase(), p.id]));
        const toInsert: any[] = [];

        for (const row of batch) {
          const email = String(row[emailCol] || "").trim().toLowerCase();
          const courseName = String(row[courseCol] || "").trim();
          const status = String(row[statusCol] || "").trim();
          const enrolledOn = dateCol !== -1 ? String(row[dateCol] || "").trim() : null;

          const participantId = emailMap.get(email);

          if (participantId && courseName) {
            toInsert.push({
              participant_id: participantId,
              course_name: courseName,
              status: status,
              completed_at: enrolledOn
            });
          } else {
            skippedCount++;
          }
        }

        if (toInsert.length > 0) {
          const { error: insertError } = await supabase
            .from('lms_completions')
            .insert(toInsert);

          if (insertError) {
            console.error("Batch insert error:", insertError);
            skippedCount += toInsert.length;
          } else {
            insertedCount += toInsert.length;
          }
        }

        setProgress(prev => ({
          ...prev!,
          current: Math.min(i + batchSize, total),
          inserted: insertedCount,
          skipped: skippedCount
        }));
      }

      toast.success(`Upload complete: ${insertedCount} inserted, ${skippedCount} skipped.`);
      if (onUploadSuccess) onUploadSuccess();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to process LMS report.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-sm border-zinc-200">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <MousePointer2 className="h-5 w-5 text-purple-600" />
          LMS Self-Paced Upload
        </CardTitle>
        <CardDescription className="text-xs">
          Match records by Email. Participants must already exist in the system.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid w-full items-center gap-1.5">
          <Label htmlFor="lms-file-upload" className="text-[10px] font-bold uppercase text-muted-foreground">Select Excel/CSV File</Label>
          <Input 
            id="lms-file-upload" 
            type="file" 
            accept=".xlsx, .xls, .csv" 
            onChange={handleFileUpload}
            disabled={loading}
            className="text-xs"
          />
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center p-6 bg-muted/30 rounded-lg">
            <Loader2 className="h-6 w-6 animate-spin text-purple-600 mb-2" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-purple-600">Syncing Records...</p>
            {progress && (
              <p className="text-[10px] text-muted-foreground font-medium mt-1">
                {progress.current} / {progress.total}
              </p>
            )}
          </div>
        )}

        {progress && !loading && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3 bg-purple-50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900 rounded-lg flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-lg font-black text-purple-700 dark:text-purple-400">{progress.inserted}</p>
                <p className="text-[9px] font-bold text-purple-600 uppercase tracking-tighter">Inserted</p>
              </div>
            </div>
            <div className="p-3 bg-zinc-50 dark:bg-zinc-900/20 border border-zinc-100 dark:border-zinc-800 rounded-lg flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-zinc-400" />
              <div>
                <p className="text-lg font-black text-zinc-600 dark:text-zinc-400">{progress.skipped}</p>
                <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-tighter">Skipped</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LMSUpload;
