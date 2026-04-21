"use client";
import { Badge } from "@/components/ui/badge";
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { createClient } from '@/utils/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  FileUp, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  FileSpreadsheet,
  Trash2,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";

interface UploadSummary {
  processed: number;
  inserted: number;
  skipped: number;
  year: string;
  cohort: string;
  skippedDetails: string[];
}

interface VILTTrackerUploadProps {
  onUploadSuccess?: () => void;
}

const VILTTrackerUpload: React.FC<VILTTrackerUploadProps> = ({ onUploadSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState<UploadSummary | null>(null);
  
  const supabase = createClient();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      setSummary(null);
    }
  };

  const processFile = async () => {
    if (!file) return;

    setUploading(true);
    setSummary(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      
      console.log("VILT DEBUG: Analyzing top 10 rows...", rows.slice(0, 10));

      // 1. Dynamic Header Mapping
      let headerRowIndex = -1;
      let colMap: Record<string, number> = {};
      const essential = ['email', 'name'];

      for (let i = 0; i < Math.min(rows.length, 25); i++) {
        const row = rows[i];
        if (!row) continue;
        
        const rowLower = row.map(c => String(c || "").toLowerCase().trim());
        const tempMap: Record<string, number> = {};
        
        rowLower.forEach((val, idx) => {
          if (val === 'email') tempMap.email = idx;
          if (val === 'name' || val.includes('name (first, last name only)')) tempMap.name = idx;
          if (val === 'cohort') tempMap.cohort = idx;
          if (val === 'year') tempMap.year = idx;
          if (val === 'remarks') tempMap.remarks = idx;
          if (val.includes('delivery unit') || val.includes('department')) tempMap.department = idx;
          
          ['m1', 'm2a', 'm2b', 'm3e', 'm3f-b1', 'm4'].forEach(m => {
            if (val === m) tempMap[m] = idx;
          });
        });

        if (tempMap.email !== undefined && tempMap.name !== undefined) {
          headerRowIndex = i;
          colMap = tempMap;
          break;
        }
      }

      console.log("VILT DEBUG: Column Map Detected:", colMap);

      if (headerRowIndex === -1) {
        throw new Error(`Critical Error: Headers 'Email' and 'Name' not found. Headers detected: [${rows[0]?.join(', ')}]`);
      }

      // Check for year/cohort columns
      if (colMap.year === undefined || colMap.cohort === undefined) {
        throw new Error(`Configuration Error: Missing 'Year' or 'Cohort' columns. Found headers: [${rows[headerRowIndex]?.join(', ')}]`);
      }

      // 2. Process Data Rows
      const dataRows = rows.slice(headerRowIndex + 1);
      const finalRecords: any[] = [];
      const skippedDetails: string[] = [];
      let totalSkipped = 0;
      let detectedYear = "";
      let detectedCohort = "";

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        if (!row || row.length === 0) continue;

        // Break on summary or empty start
        const firstValue = String(row[0] || "");
        if (firstValue.toUpperCase().startsWith('SUMMARY')) break;

        const email = String(row[colMap.email] || "").trim().toLowerCase();
        const name = String(row[colMap.name] || "").trim();
        const year = String(row[colMap.year] || "").trim();
        const cohort = String(row[colMap.cohort] || "").trim();
        const department = colMap.department !== undefined ? String(row[colMap.department] || "Unknown").trim() : "Unknown";

        // Logging first 5 rows for visibility
        if (i < 5) {
          console.log(`VILT ROW ${i+1}:`, { email, name, year, cohort, department });
        }

        // Validity Checks
        if (!email || !email.includes('@')) {
          totalSkipped++;
          continue;
        }

        // Graceful skip for missing Year/Cohort
        if (!year || !cohort) {
          console.warn(`VILT SKIP: Row ${i+1} (${email}) is missing Year or Cohort.`);
          skippedDetails.push(`${email} (Missing ${!year ? 'Year' : 'Cohort'})`);
          totalSkipped++;
          continue;
        }

        // Lock baseline session
        if (!detectedYear) detectedYear = year;
        if (!detectedCohort) detectedCohort = cohort;

        const isSet = (key: string) => colMap[key] !== undefined && String(row[colMap[key]] || "") === "1";

        finalRecords.push({
          email,
          name,
          department,
          overall_status: colMap.remarks !== undefined ? String(row[colMap.remarks] || "Incomplete").trim() : "Incomplete",
          modules: {
            "M1": isSet('m1'), "M2A": isSet('m2a'), "M2B": isSet('m2b'),
            "M3E": isSet('m3e'), "M3F-B1": isSet('m3f-b1'), "M4": isSet('m4')
          },
          year,
          cohort,
          updated_at: new Date().toISOString()
        });
      }

      console.log(`VILT SYNC: Preparing to upload ${finalRecords.length} records. ${totalSkipped} skipped.`);

      // 3. Batch Upsert (Chunks of 100)
      if (finalRecords.length > 0) {
        const chunkSize = 100;
        for (let j = 0; j < finalRecords.length; j += chunkSize) {
          const { error } = await supabase
            .from('vilt_tracker')
            .upsert(finalRecords.slice(j, j + chunkSize), { 
              onConflict: 'email, year, cohort' 
            });
          if (error) throw error;
        }
      }

      setSummary({
        processed: finalRecords.length + totalSkipped,
        inserted: finalRecords.length,
        skipped: totalSkipped,
        year: detectedYear,
        cohort: detectedCohort,
        skippedDetails
      });
      
      toast.success(`Sync Complete: ${finalRecords.length} records for ${detectedCohort} (${detectedYear})`);
      setFile(null);
      if (onUploadSuccess) onUploadSuccess();
    } catch (err: any) {
      console.error("VILT PROCESSOR ERROR:", err);
      toast.error(err.message || "Failed to process VILT file.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="shadow-sm border-zinc-100 rounded-3xl overflow-hidden">
      <CardHeader className="bg-zinc-50/50 border-b p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#0046ab] rounded-lg"><FileSpreadsheet className="h-4 w-4 text-white" /></div>
            <div>
              <CardTitle className="text-xs font-black uppercase tracking-wider">VILT Enrollment Sync</CardTitle>
              <CardDescription className="text-[10px] font-medium text-zinc-400 uppercase tracking-tight">Fully automated data detection & batch sync</CardDescription>
            </div>
          </div>
          {summary && (
            <Badge variant="outline" className="text-[9px] font-black bg-blue-50 text-[#0046ab] border-blue-100 uppercase">
              {summary.year} {summary.cohort}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div 
          className={cn(
            "border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center transition-all cursor-pointer",
            file ? "border-blue-200 bg-blue-50/30" : "border-zinc-100 hover:border-zinc-200 bg-zinc-50/50"
          )}
          onClick={() => document.getElementById('vilt-upload-input')?.click()}
        >
          <input id="vilt-upload-input" type="file" className="hidden" accept=".csv,.xlsx" onChange={handleFileChange} />
          {file ? (
            <div className="text-center">
              <FileSpreadsheet className="h-10 w-10 text-emerald-500 mx-auto mb-4" />
              <p className="text-sm font-black text-zinc-800">{file.name}</p>
              <Button variant="ghost" size="sm" className="mt-4 text-rose-500 font-black text-[10px] uppercase h-7" onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                <Trash2 className="h-3 w-3 mr-1.5" /> Clear File
              </Button>
            </div>
          ) : (
            <div className="text-center">
              <FileUp className="h-10 w-10 text-zinc-200 mx-auto mb-4" />
              <p className="text-sm font-black text-zinc-400 uppercase tracking-widest">Select enrollment file</p>
              <p className="text-[10px] font-medium text-zinc-400 mt-2">Required: Year, Cohort, Email, Name</p>
            </div>
          )}
        </div>

        <Button className="w-full h-12 rounded-xl bg-[#0046ab] hover:bg-[#003580] font-black text-xs uppercase tracking-widest transition-all" disabled={!file || uploading} onClick={processFile}>
          {uploading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Processing...</> : <><FileUp className="h-4 w-4 mr-2" /> Start Sync</>}
        </Button>

        {summary && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl border bg-emerald-50 border-emerald-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <div>
                  <p className="text-xs font-black text-zinc-800 uppercase">Sync Complete</p>
                  <p className="text-[10px] font-medium text-zinc-500 uppercase">
                    {summary.inserted} Participants / {summary.skipped} Skipped
                  </p>
                </div>
              </div>
            </div>

            {summary.skippedDetails.length > 0 && (
              <div className="p-4 rounded-2xl border bg-amber-50 border-amber-100">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <p className="text-[10px] font-black text-amber-800 uppercase">Rows skipped due to missing session data:</p>
                </div>
                <div className="max-h-24 overflow-y-auto space-y-1">
                  {summary.skippedDetails.map((detail, idx) => (
                    <p key={idx} className="text-[10px] font-medium text-amber-700 font-mono">{detail}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VILTTrackerUpload;
