"use client";

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { createClient } from '@/utils/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, FileUp, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

/*
  SQL MIGRATION:
  Run this in your Supabase SQL Editor if table is not ready:

  CREATE TABLE IF NOT EXISTS lms_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    name TEXT,
    course_name TEXT,
    status TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
*/

interface LMSUploadProps {
  onUploadSuccess?: () => void;
}

const LMSUpload: React.FC<LMSUploadProps> = ({ onUploadSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const supabase = createClient();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setMessage(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (jsonData.length < 1) {
          toast.error("File appears to be empty.");
          setLoading(false);
          return;
        }

        // 1. Find Header Row
        let headerRowIndex = -1;
        let emailIdx = -1;
        let courseIdx = -1;
        let firstNameIdx = -1;
        let lastNameIdx = -1;
        let enrolledOnIdx = -1;
        let statusIdx = -1;

        console.log("LMS Upload: Scanning first 50 rows for headers...");

        for (let i = 0; i < Math.min(jsonData.length, 50); i++) {
          const row = (jsonData[i] || []).map(cell => String(cell || "").toLowerCase().trim());
          
          // Flexible search for Email and Course columns
          const eIdx = row.findIndex(c => c === "email" || c.includes("email"));
          const cIdx = row.findIndex(c => c === "course" || c.includes("course") || c.includes("module"));
          
          if (eIdx !== -1 && cIdx !== -1) {
            console.log(`LMS Upload: Found headers at row ${i}`, row);
            headerRowIndex = i;
            emailIdx = eIdx;
            courseIdx = cIdx;
            firstNameIdx = row.findIndex(c => c.includes("first name") || c === "name");
            lastNameIdx = row.findIndex(c => c.includes("last name"));
            enrolledOnIdx = row.findIndex(c => 
              c.includes("enrolled") || c === "date" || c.includes("completion") || c.includes("time")
            );
            statusIdx = row.findIndex(c => c.includes("status"));
            break;
          }
        }

        if (headerRowIndex === -1) {
          toast.error("Could not find header row with 'Email' and 'Course'.");
          setLoading(false);
          return;
        }

        const dataRows = jsonData.slice(headerRowIndex + 1);
        const toInsert: any[] = [];
        let errorCount = 0;

        // 2. Process Data Rows
        for (const row of dataRows) {
          try {
            const email = String(row[emailIdx] || "").trim().toLowerCase();
            const courseName = String(row[courseIdx] || "").trim();
            
            if (!email || !courseName || email === "email") continue;

            const firstName = firstNameIdx !== -1 ? String(row[firstNameIdx] || "").trim() : "";
            const lastName = lastNameIdx !== -1 ? String(row[lastNameIdx] || "").trim() : "";
            const fullName = `${firstName} ${lastName}`.trim();
            const status = statusIdx !== -1 ? String(row[statusIdx] || "").trim() : "Unknown";
            let rawDate = enrolledOnIdx !== -1 ? row[enrolledOnIdx] : null;
            let completedAt: string | null = null;

            // Robust Date Handling
            if (rawDate) {
              if (rawDate instanceof Date) {
                completedAt = rawDate.toISOString();
              } else {
                const dateStr = String(rawDate).trim();
                const d = new Date(dateStr);
                if (!isNaN(d.getTime())) {
                  completedAt = d.toISOString();
                } else {
                  // Fallback for M/D/YYYY or D/M/YYYY
                  const parts = dateStr.split(/[\/\-.]/);
                  if (parts.length === 3) {
                    const year = parts[2].length === 2 ? 2000 + Number(parts[2]) : Number(parts[2]);
                    const month = Number(parts[0]) - 1;
                    const day = Number(parts[1]);
                    const fallbackDate = new Date(year, month, day);
                    if (!isNaN(fallbackDate.getTime())) {
                      completedAt = fallbackDate.toISOString();
                    }
                  }
                }
              }
            }

            toInsert.push({
              email,
              name: fullName || null,
              course_name: courseName,
              status,
              completed_at: completedAt
            });
          } catch (err) {
            console.error("Row mapping error:", err);
            errorCount++;
          }
        }

        // 3. Batch Insert
        let insertedCount = 0;
        if (toInsert.length > 0) {
          const chunkSize = 500;
          for (let i = 0; i < toInsert.length; i += chunkSize) {
            const chunk = toInsert.slice(i, i + chunkSize);
            const { error: insertError } = await supabase
              .from('lms_completions')
              .insert(chunk);

            if (insertError) {
              console.error("Batch insert error:", insertError);
              throw new Error("Database insertion failed.");
            }
            insertedCount += chunk.length;
          }
        }

        const summary = `${insertedCount} records inserted, ${errorCount} errors`;
        setMessage(summary);
        toast.success("Upload successful!");
        
        if (onUploadSuccess) onUploadSuccess();
      } catch (error: any) {
        console.error("LMS Upload Error:", error);
        toast.error(`Upload failed: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  return (
    <Card className="w-full shadow-sm border-zinc-200">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileUp className="h-5 w-5 text-[#0046ab]" />
          LMS Self-Paced Upload
        </CardTitle>
        <CardDescription className="text-xs">
          Upload report (Email, Course, Name, Status, Enrolled on). Skips non-header rows automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="lms-file-input" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Select Report File
          </Label>
          <Input 
            id="lms-file-input"
            type="file" 
            accept=".csv, .xlsx, .xls" 
            onChange={handleFileUpload}
            disabled={loading}
            className="text-xs cursor-pointer file:text-[#0046ab] file:font-bold"
          />
        </div>

        {loading && (
          <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-100 animate-pulse">
            <Loader2 className="h-4 w-4 animate-spin text-[#0046ab]" />
            <p className="text-xs font-bold text-[#0046ab] uppercase tracking-wider">Processing Records...</p>
          </div>
        )}

        {message && !loading && (
          <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-lg border border-emerald-100">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <p className="text-xs font-bold text-emerald-700">{message}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LMSUpload;
