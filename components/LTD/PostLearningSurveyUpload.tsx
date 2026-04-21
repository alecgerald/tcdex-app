"use client";
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
import { Badge } from "@/components/ui/badge";

interface UploadSummary {
  processed: number;
  inserted: number;
  skipped: number;
}

interface PostLearningSurveyUploadProps {
  onUploadSuccess?: () => void;
}

const PostLearningSurveyUpload: React.FC<PostLearningSurveyUploadProps> = ({ onUploadSuccess }) => {
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
      
      let headerRowIndex = -1;
      let colIndices = { 
        moduleTitle: -1, 
        sessionRating: -1, 
        facilitatorRating: -1, 
        feedbackLikes: -1, 
        feedbackSuggestions: -1 
      };

      for (let i = 0; i < Math.min(rows.length, 20); i++) {
        const row = rows[i];
        if (!row) continue;
        
        const rowStr = row.map(c => String(c || "").toLowerCase().trim());
        
        const moduleIdx = rowStr.findIndex(c => c.includes('module title'));
        const sessionIdx = rowStr.findIndex(c => c.includes('rate the effectiveness of this session'));
        const facilitatorIdx = rowStr.findIndex(c => c.includes('rate the overall effectiveness of the assigned learning experience facilitator'));
        const likesIdx = rowStr.findIndex(c => c.includes('what did you like best about the assigned learning experience facilitator/s'));
        const suggestionsIdx = rowStr.findIndex(c => c.includes('what suggestions do you have for improving the facilitation skills'));

        if (moduleIdx !== -1) {
          headerRowIndex = i;
          colIndices.moduleTitle = moduleIdx;
          colIndices.sessionRating = sessionIdx;
          colIndices.facilitatorRating = facilitatorIdx;
          colIndices.feedbackLikes = likesIdx;
          colIndices.feedbackSuggestions = suggestionsIdx;
          break;
        }
      }

      if (headerRowIndex === -1) {
        throw new Error("Could not find required headers (Module Title).");
      }

      const dataRows = rows.slice(headerRowIndex + 1);
      const finalRecords: any[] = [];
      let skipped = 0;

      for (const row of dataRows) {
        const moduleTitle = String(row[colIndices.moduleTitle] || "").trim();
        
        if (!moduleTitle || moduleTitle.toLowerCase() === 'module title' || moduleTitle.toLowerCase().includes('total')) {
          skipped++;
          continue;
        }

        const parseRating = (val: any) => {
          const num = parseInt(val);
          return isNaN(num) ? null : num;
        };

        finalRecords.push({
          module_title: moduleTitle,
          session_rating: parseRating(row[colIndices.sessionRating]),
          facilitator_rating: parseRating(row[colIndices.facilitatorRating]),
          feedback_likes: colIndices.feedbackLikes !== -1 ? String(row[colIndices.feedbackLikes] || "").trim() : "",
          feedback_suggestions: colIndices.feedbackSuggestions !== -1 ? String(row[colIndices.feedbackSuggestions] || "").trim() : "",
          uploaded_at: new Date().toISOString()
        });
      }

      if (finalRecords.length > 0) {
        const chunkSize = 100;
        for (let i = 0; i < finalRecords.length; i += chunkSize) {
          const chunk = finalRecords.slice(i, i + chunkSize);
          const { error } = await supabase
            .from('post_learning_survey')
            .insert(chunk);
          
          if (error) throw error;
        }
      }

      setSummary({
        processed: finalRecords.length + skipped,
        inserted: finalRecords.length,
        skipped: skipped
      });
      toast.success("Post-Learning Survey data imported successfully.");
      setFile(null);
      if (onUploadSuccess) onUploadSuccess();
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error(err.message || "Failed to process Post-Learning Survey file.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="shadow-sm border-zinc-100 rounded-3xl overflow-hidden">
      <CardHeader className="bg-zinc-50/50 border-b p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 rounded-lg"><FileSpreadsheet className="h-4 w-4 text-white" /></div>
            <div>
              <CardTitle className="text-xs font-black uppercase tracking-wider">Post-Learning Survey Import</CardTitle>
              <CardDescription className="text-[10px] font-medium text-zinc-400 uppercase tracking-tight">Import Microsoft Forms responses (Excel/CSV)</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-md">
            <Info className="h-3 w-3 text-emerald-600" />
            <span className="text-[9px] font-black text-emerald-600 uppercase">Survey Data</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div 
          className={cn(
            "border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center transition-all cursor-pointer",
            file ? "border-emerald-200 bg-emerald-50/30" : "border-zinc-100 hover:border-zinc-200 bg-zinc-50/50"
          )}
          onClick={() => document.getElementById('post-learning-upload-input')?.click()}
        >
          <input 
            id="post-learning-upload-input" 
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
              <p className="text-sm font-black text-zinc-400 uppercase tracking-widest">Select survey results CSV/Excel</p>
              <p className="text-[10px] font-medium text-zinc-400 mt-2">Will auto-detect headers based on survey questions</p>
            </div>
          )}
        </div>

        <Button 
          className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-black text-xs uppercase tracking-widest transition-all"
          disabled={!file || uploading}
          onClick={processFile}
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Processing...
            </>
          ) : (
            <>
              <FileUp className="h-4 w-4 mr-2" />
              Upload Survey Responses
            </>
          )}
        </Button>

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
                  {summary.inserted} Inserted / {summary.skipped} Skipped
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

export default PostLearningSurveyUpload;
