"use client";

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { createClient } from '@/utils/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, FileText, Info } from 'lucide-react';
import { toast } from 'sonner';

interface TrainingReportsUploadProps {
  onUploadSuccess?: () => void;
}

/**
 * TrainingReportsUpload
 * 
 * Updated component to insert ALL rows from VILT Training Reports.
 * Columns: No., Username (employee_id), Name (employee_name), Course, Status, No. of Hours, Delivery Unit
 */
const TrainingReportsUpload: React.FC<TrainingReportsUploadProps> = ({ onUploadSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; inserted: number } | null>(null);
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
      let usernameCol = -1;
      let nameCol = -1;
      let courseCol = -1;
      let statusCol = -1;
      let hoursCol = -1;
      let deptCol = -1;

      for (let i = 0; i < Math.min(jsonData.length, 20); i++) {
        const row = jsonData[i].map(cell => String(cell || "").toLowerCase().trim());
        const uIdx = row.findIndex(cell => cell.includes("username") || cell === "employee id" || cell === "id");
        const nIdx = row.findIndex(cell => cell === "name" || cell === "employee name" || cell === "full name");
        const cIdx = row.findIndex(cell => cell.includes("course"));
        const sIdx = row.findIndex(cell => cell.includes("status"));
        const hIdx = row.findIndex(cell => cell.includes("hours") || cell.includes("no. of hours"));
        const dIdx = row.findIndex(cell => cell.includes("delivery unit") || cell.includes("department"));

        if (uIdx !== -1 && cIdx !== -1 && sIdx !== -1) {
          headerIndex = i;
          usernameCol = uIdx;
          nameCol = nIdx;
          courseCol = cIdx;
          statusCol = sIdx;
          hoursCol = hIdx;
          deptCol = dIdx;
          break;
        }
      }

      if (headerIndex === -1) {
        toast.error("Could not detect required columns (Username, Course, Status).");
        setLoading(false);
        return;
      }

      const dataRows = jsonData.slice(headerIndex + 1);
      const total = dataRows.length;
      let insertedCount = 0;

      setProgress({ current: 0, total, inserted: 0 });

      // 2. Process Rows in Batches
      const batchSize = 100;
      for (let i = 0; i < dataRows.length; i += batchSize) {
        const batch = dataRows.slice(i, i + batchSize);
        const toInsert: any[] = [];

        for (const row of batch) {
          const employeeId = String(row[usernameCol] || "").trim();
          const employeeName = nameCol !== -1 ? String(row[nameCol] || "").trim() : "";
          const courseName = String(row[courseCol] || "").trim();
          const status = String(row[statusCol] || "").trim();
          const hours = parseFloat(String(row[hoursCol] || "0")) || 0;
          const deliveryUnit = String(row[deptCol] || "").trim();

          if (!employeeId || !courseName) continue;

          toInsert.push({
            employee_id: employeeId,
            employee_name: employeeName,
            course_name: courseName,
            status: status,
            hours: hours,
            delivery_unit: deliveryUnit
          });
        }

        if (toInsert.length > 0) {
          const { error: insertError } = await supabase
            .from('training_reports')
            .insert(toInsert);

          if (insertError) {
            console.error("Batch insert error:", insertError);
            toast.error("Error inserting data. Check database schema.");
            setLoading(false);
            return;
          } else {
            insertedCount += toInsert.length;
          }
        }

        setProgress(prev => ({
          ...prev!,
          current: Math.min(i + batchSize, total),
          inserted: insertedCount
        }));
      }

      toast.success(`Upload complete: ${insertedCount} rows inserted.`);
      if (onUploadSuccess) onUploadSuccess();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to process training reports.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-sm border-zinc-200">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5 text-[#0046ab]" />
          Direct Training Report Upload
        </CardTitle>
        <CardDescription className="text-xs">
          All rows will be inserted directly into the database.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800 flex gap-3">
          <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-[10px] space-y-1">
            <p className="font-bold text-blue-900 dark:text-blue-100">SQL Schema Update Required:</p>
            <code className="block p-1.5 bg-white dark:bg-zinc-950 rounded border font-mono">
              ALTER TABLE training_reports ADD COLUMN employee_id TEXT, ADD COLUMN employee_name TEXT;
              ALTER TABLE training_reports ALTER COLUMN participant_id DROP NOT NULL;
            </code>
          </div>
        </div>

        <div className="grid w-full items-center gap-1.5">
          <Label htmlFor="training-direct-upload" className="text-[10px] font-bold uppercase text-muted-foreground">Select Excel/CSV File</Label>
          <Input 
            id="training-direct-upload" 
            type="file" 
            accept=".xlsx, .xls, .csv" 
            onChange={handleFileUpload}
            disabled={loading}
            className="text-xs"
          />
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center p-6 bg-muted/30 rounded-lg">
            <Loader2 className="h-6 w-6 animate-spin text-[#0046ab] mb-2" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#0046ab]">Uploading Rows...</p>
            {progress && (
              <p className="text-[10px] text-muted-foreground font-medium mt-1">
                {progress.inserted} / {progress.total}
              </p>
            )}
          </div>
        )}

        {progress && !loading && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 rounded-lg flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-lg font-black text-emerald-700 dark:text-emerald-400">{progress.inserted}</p>
              <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-tighter">Total Rows Inserted</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TrainingReportsUpload;
