"use client";

import React, { useState, ChangeEvent } from 'react';
import * as XLSX from 'xlsx';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

interface AssessmentUploadProps {
  onUploadSuccess?: () => void;
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

const AssessmentUpload: React.FC<AssessmentUploadProps> = ({ onUploadSuccess }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const supabase = createClient();

  const competencyRanges: CompetencyRange[] = [
    { name: 'Challenge', start: 0, end: 8 },    // 9 items
    { name: 'Relationship', start: 9, end: 17 }, // 9 items
    { name: 'Self', start: 18, end: 23 },        // 6 items
    { name: 'HR', start: 24, end: 28 },          // 5 items
    { name: 'Strategic', start: 29, end: 33 }    // 5 items
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
    setMessage('Reading Excel file...');

    const reader = new FileReader();
    reader.onload = async (evt: ProgressEvent<FileReader>) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

        if (rows.length === 0) {
          toast.error("The file is empty.");
          setUploading(false);
          return;
        }

        const headers = rows[0];
        const dataRows = rows.slice(1).filter(row => row.length > 0 && row[3]); // index 3 is email

        let processed = 0;
        let errors = 0;

        for (const row of dataRows) {
          const email = row[3]?.toString().trim().toLowerCase();
          if (!email) {
            errors++;
            continue;
          }

          // Find or create participant
          let participantId: string;
          const { data: existing, error: fetchError } = await supabase
            .from('participants')
            .select('id')
            .eq('email', email)
            .maybeSingle();

          if (fetchError) {
            console.error('Fetch participant error:', fetchError);
            errors++;
            continue;
          }

          if (existing) {
            participantId = existing.id;
          } else {
            const name = row[4]?.toString().trim() || 'Unknown';
            const department = row[5]?.toString().trim() || 'Unknown';
            const { data: newPart, error: insertError } = await supabase
              .from('participants')
              .insert({ email, name, department })
              .select()
              .single();
            if (insertError) {
              console.error('Insert participant error:', insertError);
              errors++;
              continue;
            }
            participantId = newPart.id;
          }

          // Prepare batch insert for indicator responses
          const ratingsBatch: RatingBatchItem[] = [];
          const competencySums: Record<string, CompetencySum> = {
            Challenge: { sum: 0, count: 0 },
            Relationship: { sum: 0, count: 0 },
            Self: { sum: 0, count: 0 },
            HR: { sum: 0, count: 0 },
            Strategic: { sum: 0, count: 0 }
          };

          for (let i = 0; i < 34; i++) {
            const raw = row[12 + i]?.toString().trim().toLowerCase() || '';
            let rating: number | null = null;
            if (raw.includes('not applicable')) rating = 1;
            else if (raw.includes('rarely')) rating = 2;
            else if (raw.includes('sometimes')) rating = 3;
            else if (raw.includes('often')) rating = 4;
            else if (raw.includes('consistently')) rating = 5;
            else {
              continue;
            }

            // Determine competency
            let comp: string | null = null;
            for (const cr of competencyRanges) {
              if (i >= cr.start && i <= cr.end) {
                comp = cr.name;
                break;
              }
            }
            if (!comp) continue;

            const indicatorText = headers[12 + i]?.toString() || `Indicator ${i+1}`;

            ratingsBatch.push({
              participant_id: participantId,
              assessment_type: 'pre',
              indicator_text: indicatorText,
              competency: comp,
              rating,
              rater_name: row[6]?.toString().trim() || null,
              relationship: row[10]?.toString().trim() || null,
              length_working: row[11]?.toString().trim() || null
            });

            competencySums[comp].sum += rating;
            competencySums[comp].count++;
          }

          // Insert all ratings for this participant in one batch
          if (ratingsBatch.length > 0) {
            const { error: batchError } = await supabase
              .from('indicator_responses')
              .insert(ratingsBatch);
            if (batchError) {
              console.error('Batch insert error:', batchError);
              errors++;
              continue;
            }
          }

          // Insert competency averages
          for (const [comp, data] of Object.entries(competencySums)) {
            if (data.count > 0) {
              const avg = data.sum / data.count;
              await supabase
                .from('competency_scores')
                .insert({
                  participant_id: participantId,
                  assessment_type: 'pre',
                  competency: comp,
                  average_score: avg
                });
            }
          }
          processed++;
        }

        setMessage(`Successfully processed ${processed} assessment rows. Errors: ${errors}`);
        toast.success(`Processed ${processed} rows successfully.`);
        if (processed > 0 && onUploadSuccess) onUploadSuccess();
      } catch (err: any) {
        setMessage('Error: ' + err.message);
        toast.error('Processing failed: ' + err.message);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const handleResetData = async () => {
    if (!window.confirm("WARNING: Delete all assessment data?")) return;
    setUploading(true);
    try {
      await supabase.from('competency_scores').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('indicator_responses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      setMessage('Database cleared.');
      toast.success('All L&T assessment data has been reset.');
      if (onUploadSuccess) onUploadSuccess();
    } catch (err: any) {
      setMessage('Reset Error: ' + err.message);
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
            <CardTitle>Upload Pre‑Assessment Data</CardTitle>
            <CardDescription>Select an Excel file (.xlsx) to process leadership assessments.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleResetData} className="text-destructive hover:text-destructive border-destructive hover:bg-destructive/10">
            Reset Data
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <input 
              id="file" 
              type="file" 
              accept=".xlsx,.xls" 
              onChange={handleFileSelection} 
              disabled={uploading}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <Button 
            onClick={processFile} 
            disabled={!selectedFile || uploading}
            className="bg-[#0046ab] hover:bg-[#003a8f] text-white"
          >
            {uploading ? (
              <>
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
                Processing...
              </>
            ) : 'Process File'}
          </Button>
        </div>
        {message && (
          <div className="p-3 bg-muted rounded-md text-sm border">
            {message}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AssessmentUpload;