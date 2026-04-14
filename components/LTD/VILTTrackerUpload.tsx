"use client";
import { Badge } from "@/components/ui/badge";
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { createClient } from '@/utils/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
}

interface VILTTrackerUploadProps {
  onUploadSuccess?: () => void;
}

const VILTTrackerUpload: React.FC<VILTTrackerUploadProps> = ({ onUploadSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState<UploadSummary | null>(null);
  const [year, setYear] = useState<string>("2026");
  const [cohort, setCohort] = useState<string>("Q1 Cohort 1");
  
  const supabase = createClient();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      setSummary(null);
    }
  };

  const processFile = async () => {
    if (!file) return;

    // Validation
    const yearNum = parseInt(year);
    if (isNaN(yearNum) || year.length !== 4) {
      toast.error("Please enter a valid 4-digit year.");
      return;
    }
    if (!cohort.trim()) {
      toast.error("Please enter a cohort name.");
      return;
    }

    setUploading(true);
    setSummary(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      
      // Get data as array of arrays to manually find headers
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      
      // 1. Find Header Row
      let headerRowIndex = -1;
      let colIndices = { 
        email: -1, name: -1, dept: -1, remarks: -1,
        m1: -1, m2a: -1, m2b: -1, m3e: -1, m3fb1: -1, m4: -1
      };

      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const row = rows[i];
        if (!row) continue;
        
        const rowStr = row.map(c => String(c).toLowerCase().trim());
        const emailIdx = rowStr.findIndex(c => c === 'email');
        const nameIdx = rowStr.findIndex(c => c === 'name');

        if (emailIdx !== -1 && nameIdx !== -1) {
          headerRowIndex = i;
          colIndices.email = emailIdx;
          colIndices.name = nameIdx;
          colIndices.dept = rowStr.findIndex(c => c.includes('department') || c.includes('delivery unit'));
          colIndices.remarks = rowStr.findIndex(c => c === 'remarks');
          
          // Module detection
          colIndices.m1 = rowStr.findIndex(c => c === 'm1');
          colIndices.m2a = rowStr.findIndex(c => c === 'm2a');
          colIndices.m2b = rowStr.findIndex(c => c === 'm2b');
          colIndices.m3e = rowStr.findIndex(c => c === 'm3e');
          colIndices.m3fb1 = rowStr.findIndex(c => c === 'm3f-b1');
          colIndices.m4 = rowStr.findIndex(c => c === 'm4');
          break;
        }
      }

      if (headerRowIndex === -1) {
        throw new Error("Could not find required headers (Email, Name).");
      }

      // 2. Extract Data Rows
      const dataRows = rows.slice(headerRowIndex + 1);
      const finalRecords: any[] = [];
      let skipped = 0;

      for (const row of dataRows) {
        const email = String(row[colIndices.email] || "").trim().toLowerCase();
        const name = String(row[colIndices.name] || "").trim();
        
        if (String(row[0]).toUpperCase().startsWith('SUMMARY') || (!email && !name)) {
          if (finalRecords.length > 0) break; 
          skipped++;
          continue;
        }

        if (!email.includes('@')) {
          skipped++;
          continue;
        }

        // Helper to parse "1" as true
        const isSet = (idx: number) => idx !== -1 && String(row[idx]) === "1";

        finalRecords.push({
          email,
          name,
          department: colIndices.dept !== -1 ? String(row[colIndices.dept] || "Unknown").trim() : "Unknown",
          overall_status: colIndices.remarks !== -1 ? String(row[colIndices.remarks] || "Incomplete").trim() : "Incomplete",
          modules: {
            "M1": isSet(colIndices.m1),
            "M2A": isSet(colIndices.m2a),
            "M2B": isSet(colIndices.m2b),
            "M3E": isSet(colIndices.m3e),
            "M3F-B1": isSet(colIndices.m3fb1),
            "M4": isSet(colIndices.m4)
          },
          year: yearNum,
          cohort: cohort.trim(),
          updated_at: new Date().toISOString()
        });
      }

      // 3. Batch Upsert to Supabase
      if (finalRecords.length > 0) {
        // Process in chunks of 100 to avoid request size limits
        const chunkSize = 100;
        for (let i = 0; i < finalRecords.length; i += chunkSize) {
          const chunk = finalRecords.slice(i, i + chunkSize);
          const { error } = await supabase
            .from('vilt_tracker')
            .upsert(chunk, { onConflict: 'email, year, cohort' });
          
          if (error) throw error;
        }
      }

      setSummary({
        processed: finalRecords.length + skipped,
        inserted: finalRecords.length,
        skipped: skipped
      });
      toast.success("VILT Data synchronized successfully.");
      setFile(null);
      if (onUploadSuccess) onUploadSuccess();
    } catch (err: any) {
      console.error("Upload error:", err);
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
              <CardTitle className="text-xs font-black uppercase tracking-wider">VILT Enrollment Import</CardTitle>
              <CardDescription className="text-[10px] font-medium text-zinc-400 uppercase tracking-tight">Sync attendance from Microsoft Forms / Teams exports</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-md">
            <Info className="h-3 w-3 text-[#0046ab]" />
            <span className="text-[9px] font-black text-[#0046ab] uppercase">{year} {cohort}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* Session Details */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-zinc-400">Target Year</Label>
            <Input 
              type="number" 
              value={year} 
              onChange={(e) => setYear(e.target.value)} 
              className="h-10 text-xs font-bold"
              placeholder="2026"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-zinc-400">Target Cohort</Label>
            <Input 
              type="text" 
              value={cohort} 
              onChange={(e) => setCohort(e.target.value)} 
              className="h-10 text-xs font-bold"
              placeholder="e.g., Q1 Cohort 1"
            />
          </div>
        </div>

        {/* Upload Area */}
        <div 
          className={cn(
            "border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center transition-all cursor-pointer",
            file ? "border-blue-200 bg-blue-50/30" : "border-zinc-100 hover:border-zinc-200 bg-zinc-50/50"
          )}
          onClick={() => document.getElementById('vilt-upload-input')?.click()}
        >
          <input 
            id="vilt-upload-input" 
            type="file" 
            className="hidden" 
            accept=".csv,.xlsx" 
            onChange={handleFileChange} 
          />
          
          {file ? (
            <div className="text-center">
              <div className="p-4 bg-white rounded-2xl shadow-sm border mb-4 inline-block">
                <FileSpreadsheet className="h-10 w-10 text-emerald-500" />
              </div>
              <p className="text-sm font-black text-zinc-800">{file.name}</p>
              <p className="text-[10px] font-medium text-zinc-400 uppercase mt-1">Ready for processing</p>
              <Button 
                variant="ghost" 
                size="sm" 
                className="mt-4 text-rose-500 hover:text-rose-600 font-black text-[10px] uppercase h-7"
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
              >
                <Trash2 className="h-3 w-3 mr-1.5" /> Clear File
              </Button>
            </div>
          ) : (
            <div className="text-center">
              <div className="p-4 bg-white rounded-2xl shadow-sm border mb-4 inline-block">
                <FileUp className="h-10 w-10 text-zinc-200" />
              </div>
              <p className="text-sm font-black text-zinc-400 uppercase tracking-widest">Select enrollment CSV</p>
              <p className="text-[10px] font-medium text-zinc-400 mt-2">Will auto-detect headers and ignore summary rows</p>
            </div>
          )}
        </div>

        {/* Action Button */}
        <Button 
          className="w-full h-12 rounded-xl bg-[#0046ab] hover:bg-[#003580] font-black text-xs uppercase tracking-widest transition-all"
          disabled={!file || uploading}
          onClick={processFile}
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Analyzing & Syncing...
            </>
          ) : (
            <>
              <FileUp className="h-4 w-4 mr-2" />
              Sync VILT Tracker
            </>
          )}
        </Button>

        {/* Summary Result */}
        {summary && (
          <div className={cn(
            "p-4 rounded-2xl border flex items-center justify-between",
            summary.inserted > 0 ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"
          )}>
            <div className="flex items-center gap-3">
              {summary.inserted > 0 ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-rose-500" />
              )}
              <div>
                <p className="text-xs font-black text-zinc-800 uppercase">Process Complete</p>
                <p className="text-[10px] font-medium text-zinc-500 uppercase">
                  {summary.inserted} Updated / {summary.skipped} Skipped
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px] font-black bg-white">
              {summary.processed} Total Rows
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VILTTrackerUpload;
