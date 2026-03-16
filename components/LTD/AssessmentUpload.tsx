"use client";

import React, { useState, ChangeEvent } from 'react';
import * as XLSX from 'xlsx';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

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
    { name: 'Challenge Orientation', start: 0, end: 8 },    // 9 items
    { name: 'Relationship-Building', start: 9, end: 17 }, // 9 items
    { name: 'Self-Leadership', start: 18, end: 23 },        // 6 items
    { name: 'HR Partnership', start: 24, end: 28 },          // 5 items
    { name: 'Strategic & Inclusive', start: 29, end: 33 }    // 5 items
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
    setMessage(`Uploading ${assessmentType.toUpperCase()} assessment...`);

    const reader = new FileReader();
    reader.onload = async (evt: ProgressEvent<FileReader>) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

        if (rows.length < 2) {
          toast.error("The file is empty.");
          setUploading(false);
          return;
        }

        const headers = rows[0];
        
        /* 
          EXACT MAPPING BASED ON PROVIDED HEADERS:
          Index 6: Your Name (Rater Name)
          Index 8: Delivery Unit / Department
          Index 9: Name of i-ELEVATE Participant (ACTUAL PARTICIPANT)
          Index 10: Your Relationship
          Index 11: Length of Time Working
          Index 12: Ratings Start
        */
        const pNameIdx = 9;
        const deptIdx = 8;
        const rNameIdx = 6;
        const relIdx = 10;
        const timeIdx = 11;
        const ratingStartIdx = 12;

        const dataRows = rows.slice(1).filter(row => row.length > 0 && row[pNameIdx]);

        let processed = 0;
        let errors = 0;

        for (const row of dataRows) {
          const participantName = row[pNameIdx]?.toString().trim();
          if (!participantName) {
            errors++;
            continue;
          }

          // Use name as identifier since email isn't in the specific participant column
          // We generate a consistent internal email for the DB unique constraint
          const internalEmail = `${participantName.toLowerCase().replace(/\s+/g, '.')}@internal.tcdex`;

          // 1. Ensure Participant exists
          let participantId: string;
          const { data: existing, error: fetchError } = await supabase
            .from('participants')
            .select('id')
            .eq('name', participantName)
            .maybeSingle();

          if (fetchError) {
            errors++;
            continue;
          }

          if (existing) {
            participantId = existing.id;
          } else {
            const department = row[deptIdx]?.toString().trim() || 'Unknown';
            const { data: newPart, error: insertError } = await supabase
              .from('participants')
              .insert({ email: internalEmail, name: participantName, department })
              .select()
              .single();
            if (insertError) {
              console.error('Insert Error:', insertError);
              errors++;
              continue;
            }
            participantId = newPart.id;
          }

          // 2. Process 34 Rating Indicators
          const ratingsBatch: RatingBatchItem[] = [];
          const competencySums: Record<string, CompetencySum> = {
            Challenge: { sum: 0, count: 0 },
            Relationship: { sum: 0, count: 0 },
            Self: { sum: 0, count: 0 },
            HR: { sum: 0, count: 0 },
            Strategic: { sum: 0, count: 0 }
          };

          for (let i = 0; i < 34; i++) {
            const raw = row[ratingStartIdx + i]?.toString().trim().toLowerCase() || '';
            let rating: number | null = null;
            
            if (raw.includes('not applicable')) rating = 1;
            else if (raw.includes('rarely')) rating = 2;
            else if (raw.includes('sometimes')) rating = 3;
            else if (raw.includes('often')) rating = 4;
            else if (raw.includes('consistently')) rating = 5;
            else continue;

            let comp: string | null = null;
            for (const cr of competencyRanges) {
              if (i >= cr.start && i <= cr.end) {
                comp = cr.name;
                break;
              }
            }
            if (!comp) continue;

            const indicatorText = headers[ratingStartIdx + i]?.toString() || `Indicator ${i+1}`;

            ratingsBatch.push({
              participant_id: participantId,
              assessment_type: assessmentType,
              indicator_text: indicatorText,
              competency: comp,
              rating,
              rater_name: row[rNameIdx]?.toString().trim() || null,
              relationship: row[relIdx]?.toString().trim() || null,
              length_working: row[timeIdx]?.toString().trim() || null
            });

            competencySums[comp].sum += rating;
            competencySums[comp].count++;
          }

          if (ratingsBatch.length > 0) {
            await supabase.from('indicator_responses').insert(ratingsBatch);
          }

          // 3. Update Competency Averages
          for (const [comp, data] of Object.entries(competencySums)) {
            if (data.count > 0) {
              const avg = data.sum / data.count;
              await supabase.from('competency_scores').insert({
                participant_id: participantId,
                assessment_type: assessmentType,
                competency: comp,
                average_score: avg
              });
            }
          }
          processed++;
        }

        setMessage(`Successfully processed ${processed} rows for ${assessmentType}. Errors: ${errors}`);
        toast.success(`Upload complete for ${assessmentType}.`);
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
    if (!window.confirm("CRITICAL: This will permanently delete ALL participants and their scores. Continue?")) return;
    setUploading(true);
    try {
      // Clear tables in order to respect potential foreign keys
      await supabase.from('competency_scores').delete().filter('id', 'not.is', null);
      await supabase.from('indicator_responses').delete().filter('id', 'not.is', null);
      await supabase.from('participants').delete().filter('id', 'not.is', null);
      
      setMessage('All data wiped. Refreshing dashboard...');
      toast.success('Database cleared.');
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
            <CardTitle>Upload Assessment Data</CardTitle>
            <CardDescription>Format: Microsoft Forms Excel Export (Pre & Post Assessment)</CardDescription>
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
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <Button 
            onClick={processFile} 
            disabled={!selectedFile || uploading}
            className="bg-[#0046ab] hover:bg-[#003a8f] text-white whitespace-nowrap"
          >
            {uploading ? 'Processing...' : `Process ${assessmentType.toUpperCase()} File`}
          </Button>
        </div>
        {message && <div className="p-3 bg-blue-50 text-blue-700 rounded-md text-sm border border-blue-100">{message}</div>}
      </CardContent>
    </Card>
  );
};

export default AssessmentUpload;