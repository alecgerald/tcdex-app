"use client";

import React, { useState, ChangeEvent } from 'react';
import * as XLSX from 'xlsx';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

/*
  SQL MIGRATION REQUIRED:
  Run this in your Supabase SQL Editor to add rater metadata columns:

  ALTER TABLE indicator_responses 
  ADD COLUMN IF NOT EXISTS rater_name TEXT,
  ADD COLUMN IF NOT EXISTS rater_email TEXT,
  ADD COLUMN IF NOT EXISTS relationship TEXT,
  ADD COLUMN IF NOT EXISTS length_working TEXT;
*/

interface AssessmentUploadProps {
  onUploadSuccess?: () => void;
  assessmentType?: 'pre' | 'post';
}

interface CompetencyRange {
  name: string;
  start: number;
  end: number;
}

interface CompetencySum {
  sum: number;
  count: number;
}

interface RatingBatchItem {
  participant_id: string;
  assessment_type: string;
  indicator_text: string;
  competency: string;
  rating: number;
  rater_name: string | null;
  rater_email: string | null;
  relationship: string | null;
  length_working: string | null;
}

const AssessmentUpload: React.FC<AssessmentUploadProps> = ({ 
  onUploadSuccess, 
  assessmentType = 'pre' 
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const supabase = createClient();

  const competencyRanges: CompetencyRange[] = [
    { name: 'Challenge Orientation', start: 0, end: 8 },
    { name: 'Relationship-Building', start: 9, end: 17 },
    { name: 'Self-Leadership', start: 18, end: 23 },
    { name: 'HR Partnership', start: 24, end: 28 },
    { name: 'Strategic & Inclusive', start: 29, end: 33 }
  ];

  const handleFileSelection = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setMessage('');
    }
  };

  const processFile = async () => {
    if (!selectedFile) {
      toast.error('Please select a file first.');
      return;
    }

    setUploading(true);
    setMessage(`Processing ${assessmentType.toUpperCase()} file...`);

    const reader = new FileReader();
    reader.onload = async (evt: ProgressEvent<FileReader>) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

        if (rows.length < 2) {
          toast.error("The file is empty or missing data.");
          setUploading(false);
          return;
        }

        const headers = rows[0];
        
        /* 
          MAPPING (0-based indices):
          row[3]: Rater Email
          row[4]: Rater Name
          row[9]: Name of i-ELEVATE Participant
          row[10]: Relationship
          row[11]: Length of Time Working
          row[12-45]: Ratings (34 columns)
        */
        const pNameIdx = 9;
        const rEmailIdx = 3;
        const rNameIdx = 4;
        const relIdx = 10;
        const timeIdx = 11;
        const ratingStartIdx = 12;

        const dataRows = rows.slice(1).filter(row => row.length > 0 && row[pNameIdx]);

        let processedRows = 0;
        let createdParticipants = 0;
        let errors = 0;

        const participantCache = new Map<string, string>(); // Name -> ID
        const allRatings: RatingBatchItem[] = [];
        const allScores: any[] = [];

        for (const row of dataRows) {
          const participantName = row[pNameIdx]?.toString().trim();
          if (!participantName) {
            errors++;
            continue;
          }

          // Now participantName is a non‑empty string
          const cacheKey = participantName.toLowerCase().trim(); // always a string
          let participantId: string | null = null;

          // 1. Participant Identification / Creation
          if (participantCache.has(cacheKey)) {
            participantId = participantCache.get(cacheKey)!;
          } else {
            const { data: existing } = await supabase
              .from('participants')
              .select('id')
              .ilike('name', participantName)
              .maybeSingle();

            if (existing && cacheKey) {
              participantId = existing.id;
              participantCache.set(cacheKey, participantId);
            } else {
              const placeholderEmail = `${participantName.toLowerCase().replace(/[^a-z0-9]/g, '')}@placeholder.local`;
              const { data: newPart, error: insErr } = await supabase
                .from('participants')
                .insert({ 
                  name: participantName, 
                  email: placeholderEmail,
                  department: row[8]?.toString().trim() || 'Imported'
                })
                .select('id')
                .single();
              
              if (insErr) {
                console.error('Participant Creation Error:', insErr);
                errors++;
                continue;
              }
              if (newPart && cacheKey) {
                participantId = newPart.id;
                participantCache.set(cacheKey, participantId);
              }
              createdParticipants++;
            }
          }

          if (!participantId) continue;

          // 2. Process Ratings
          const competencySums: Record<string, CompetencySum> = {};
          competencyRanges.forEach(cr => competencySums[cr.name] = { sum: 0, count: 0 });

          for (let i = 0; i < 34; i++) {
            const rawRating = row[ratingStartIdx + i]?.toString().trim().toLowerCase() || '';
            let ratingValue = 0;
            
            if (rawRating.includes('not applicable')) ratingValue = 1;
            else if (rawRating.includes('rarely')) ratingValue = 2;
            else if (rawRating.includes('sometimes')) ratingValue = 3;
            else if (rawRating.includes('often')) ratingValue = 4;
            else if (rawRating.includes('consistently')) ratingValue = 5;
            else continue;

            const comp = competencyRanges.find(cr => i >= cr.start && i <= cr.end);
            if (!comp) continue;

            allRatings.push({
              participant_id: participantId,
              assessment_type: assessmentType,
              indicator_text: headers[ratingStartIdx + i]?.toString() || `Indicator ${i+1}`,
              competency: comp.name,
              rating: ratingValue,
              rater_name: row[rNameIdx]?.toString().trim() || null,
              rater_email: row[rEmailIdx]?.toString().trim() || null,
              relationship: row[relIdx]?.toString().trim() || null,
              length_working: row[timeIdx]?.toString().trim() || null
            });

            competencySums[comp.name].sum += ratingValue;
            competencySums[comp.name].count++;
          }

          // 3. Competency Averages
          Object.entries(competencySums).forEach(([name, data]) => {
            if (data.count > 0) {
              allScores.push({
                participant_id: participantId,
                assessment_type: assessmentType,
                competency: name,
                average_score: data.sum / data.count
              });
            }
          });

          processedRows++;
        }

        // 4. Batch Operations
        if (allRatings.length > 0) {
          const chunkSize = 500;
          for (let i = 0; i < allRatings.length; i += chunkSize) {
            await supabase.from('indicator_responses').insert(allRatings.slice(i, i + chunkSize));
          }
        }

        if (allScores.length > 0) {
          await supabase.from('competency_scores').insert(allScores);
        }

        const summary = `${processedRows} rows processed, ${createdParticipants} participants created, ${errors} errors`;
        setMessage(summary);
        toast.success(`Upload complete: ${summary}`);
        if (onUploadSuccess) onUploadSuccess();
      } catch (err: any) {
        console.error(err);
        toast.error('Processing failed: ' + err.message);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const handleResetData = async () => {
    if (!window.confirm("CRITICAL: This will permanently delete ALL data. Continue?")) return;
    setUploading(true);
    try {
      await supabase.from('competency_scores').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('indicator_responses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('participants').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      setMessage('Database cleared.');
      toast.success('All data wiped.');
      if (onUploadSuccess) onUploadSuccess();
    } catch (err: any) {
      toast.error('Reset failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Assessment Data Upload</CardTitle>
            <CardDescription>Upload Pre or Post Assessment Excel files (Microsoft Forms Export)</CardDescription>
          </div>
          <Button variant="destructive" size="sm" onClick={handleResetData} disabled={uploading}>
            Wipe All Data
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <input 
            type="file" 
            accept=".xlsx,.xls" 
            onChange={handleFileSelection} 
            disabled={uploading}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:opacity-50"
          />
          <Button 
            onClick={processFile} 
            disabled={!selectedFile || uploading}
            className="bg-[#0046ab] hover:bg-[#003a8f] text-white whitespace-nowrap"
          >
            {uploading ? 'Processing...' : `Upload ${assessmentType.toUpperCase()} Assessment`}
          </Button>
        </div>
        {message && (
          <div className="p-3 bg-blue-50 text-blue-700 rounded-md text-sm border border-blue-100 font-medium">
            {message}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AssessmentUpload;