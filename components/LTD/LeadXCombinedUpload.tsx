"use client";

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { createClient } from '@/utils/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, FileSpreadsheet, ArrowRight, AlertCircle, Users, Mail, User } from 'lucide-react';
import { toast } from 'sonner';

interface LeadXCombinedUploadProps {
  onUploadSuccess?: () => void;
}

type UploadStep = 'idle' | 'parsing_reg' | 'uploading_reg' | 'parsing_att' | 'uploading_att' | 'completed' | 'error';

/**
 * Robust date parser for LeadX/Zoom CSV formats
 * Handles Excel serial numbers (46077.58...) and "M/D/YY H:mm" strings.
 */
const parseLeadXDate = (dateVal: any): string | null => {
  if (dateVal === null || dateVal === undefined) return null;

  let jsDate: Date | null = null;

  // 1. Handle Numeric (Excel Serial Date)
  const num = parseFloat(String(dateVal));
  if (!isNaN(num) && num > 30000 && num < 60000) { 
    jsDate = new Date(Math.round((num - 25569) * 86400 * 1000));
  } 
  // 2. Handle String formats
  else if (typeof dateVal === 'string') {
    const cleanStr = dateVal.trim();
    if (!cleanStr) return null;

    // Try standard parsing first
    const standardDate = new Date(cleanStr);
    if (!isNaN(standardDate.getTime())) {
      return standardDate.toISOString();
    }

    // Manual parsing for "M/D/YY H:mm" or "M/D/YYYY H:mm"
    try {
      const parts = cleanStr.split(' ');
      if (parts.length >= 2) {
        const dateParts = parts[0].split('/'); // [M, D, Y]
        const timeParts = parts[1].split(':'); // [H, m]
        
        if (dateParts.length === 3 && timeParts.length >= 2) {
          const m = parseInt(dateParts[0], 10);
          const d = parseInt(dateParts[1], 10);
          let y = parseInt(dateParts[2], 10);
          
          if (y < 100) y += 2000; // Assume 20YY
          
          const hh = parseInt(timeParts[0], 10);
          const mm = parseInt(timeParts[1], 10);
          
          jsDate = new Date(y, m - 1, d, hh, mm, 0);
        }
      }
    } catch (e) {
      console.warn("Manual manual parse failed for", cleanStr, e);
    }
  }

  // Final Validation
  if (jsDate && !isNaN(jsDate.getTime())) {
    return jsDate.toISOString();
  }

  console.warn(`Failed to parse date value: "${dateVal}"`);
  return null;
};

/**
 * Normalizes a name for comparison:
 * - Removes anything in parentheses (like "original name")
 * - Removes extra spaces, trims
 * - Converts to lowercase
 */
const normalizeName = (name: string): string => {
  if (!name) return "";
  return name
    .replace(/\(.*?\)/g, '') // Remove (content)
    .replace(/\s+/g, ' ')    // Normalize spaces
    .trim()
    .toLowerCase();
};

/**
 * Gets first name and last initial for fallback matching
 */
const getFirstAndInitial = (name: string): string => {
  const normalized = normalizeName(name);
  const parts = normalized.split(' ');
  if (parts.length >= 2) {
    return `${parts[0]} ${parts[parts.length - 1][0]}`;
  }
  return parts[0];
};

const LeadXCombinedUpload: React.FC<LeadXCombinedUploadProps> = ({ onUploadSuccess }) => {
  const [regFile, setRegFile] = useState<File | null>(null);
  const [attFile, setAttFile] = useState<File | null>(null);
  const [step, setStep] = useState<UploadStep>('idle');
  const [summary, setSummary] = useState<{ 
    topic: string; 
    registrants: number; 
    attendees: number; 
    newRegistrants: number;
    matchedByEmail: number;
    matchedByName: number;
  } | null>(null);
  const supabase = createClient();

  const processLeadXData = async () => {
    if (!regFile || !attFile) {
      toast.error("Please select both Registration and Attendance files.");
      return;
    }

    setStep('parsing_reg');
    setSummary(null);

    try {
      // --- PART 1: PROCESS REGISTRATION ---
      const regData = await regFile.arrayBuffer();
      const regWorkbook = XLSX.read(regData);
      const regRows = XLSX.utils.sheet_to_json(regWorkbook.Sheets[regWorkbook.SheetNames[0]], { header: 1 }) as any[][];

      let topic = "";
      let zoomId = "";
      let scheduledTimeISO = "";
      let duration = 0;
      let registrantHeaderIndex = -1;

      // 1. Find Session Info
      for (let i = 0; i < 5; i++) {
        const row = regRows[i];
        if (row && String(row[0] || "").startsWith("LeadX")) {
          topic = String(row[0] || "").trim();
          zoomId = String(row[1] || "").trim();
          scheduledTimeISO = parseLeadXDate(row[2]) || "";
          duration = parseInt(String(row[3] || "0")) || 0;
          break;
        }
      }

      if (!topic || !scheduledTimeISO) {
        throw new Error("Could not find Session Info (Topic/Date) in registration file.");
      }

      // 2. Find Registrant Header
      for (let i = 0; i < regRows.length; i++) {
        const firstCell = String(regRows[i]?.[0] || "").toLowerCase();
        if (firstCell.includes("registrant details")) {
          registrantHeaderIndex = i + 1;
          break;
        }
      }

      if (registrantHeaderIndex === -1 || !regRows[registrantHeaderIndex]) {
        throw new Error("Could not find 'Registrant Details' section.");
      }

      // 3. Map Registrant Columns
      const regHeaders = regRows[registrantHeaderIndex].map(h => String(h || "").toLowerCase());
      const fNameIdx = regHeaders.findIndex(h => h.includes("first name"));
      const lNameIdx = regHeaders.findIndex(h => h.includes("last name"));
      const emailIdx = regHeaders.findIndex(h => h.includes("email"));
      const timeIdx = regHeaders.findIndex(h => h.includes("registration time"));
      const statusIdx = regHeaders.findIndex(h => h.includes("approval status"));
      const empIdIdx = regHeaders.findIndex(h => h.includes("employee id"));
      const deptIdx = regHeaders.findIndex(h => h.includes("delivery unit") || h.includes("department"));

      setStep('uploading_reg');
      const { data: sessionData, error: sessionError } = await supabase
        .from('leadx_sessions')
        .upsert({
          topic,
          external_id: zoomId,
          scheduled_time: scheduledTimeISO,
          duration: duration
        }, { onConflict: 'topic, scheduled_time' })
        .select()
        .single();

      if (sessionError) throw sessionError;

      const registrantsToInsert: any[] = [];
      regRows.slice(registrantHeaderIndex + 1).forEach(row => {
        const email = String(row[emailIdx] || "").trim().toLowerCase();
        if (email && email.includes("@")) {
          const status = String(row[statusIdx] || "").trim();
          registrantsToInsert.push({
            session_id: sessionData.id,
            employee_id: String(row[empIdIdx] || "").trim(),
            name: `${String(row[fNameIdx] || "").trim()} ${String(row[lNameIdx] || "").trim()}`.trim(),
            email: email,
            department: String(row[deptIdx] || "").trim(),
            registration_time: parseLeadXDate(row[timeIdx]),
            approval_status: status || 'Approved', // Ensure status is set to override any 'Walk-in' marker
            attended: false
          });
        }
      });

      if (registrantsToInsert.length > 0) {
        const { error: regInsertError } = await supabase
          .from('leadx_registrants')
          .upsert(registrantsToInsert, { onConflict: 'session_id, email' });
        if (regInsertError) throw regInsertError;
      }

      // --- PART 2: PROCESS ATTENDANCE ---
      setStep('parsing_att');
      const attData = await attFile.arrayBuffer();
      const attWorkbook = XLSX.read(attData);
      const attRows = XLSX.utils.sheet_to_json(attWorkbook.Sheets[attWorkbook.SheetNames[0]], { header: 1 }) as any[][];

      const attInfoRow = attRows[1];
      if (!attInfoRow || !String(attInfoRow[0] || "").startsWith("LeadX")) {
        throw new Error("Could not find session info in attendance file.");
      }

      const attStartTimeISO = parseLeadXDate(attInfoRow[3]);
      const attEndTimeISO = parseLeadXDate(attInfoRow[4]);
      const actualDuration = parseInt(String(attInfoRow[2] || "0")) || 0;

      setStep('uploading_att');
      await supabase
        .from('leadx_sessions')
        .update({
          start_time: attStartTimeISO,
          end_time: attEndTimeISO,
          actual_duration: actualDuration
        })
        .eq('id', sessionData.id);

      let attHeaderIdx = -1;
      for (let i = 0; i < attRows.length; i++) {
        if (attRows[i]?.some(c => String(c || "").toLowerCase().includes("total duration"))) {
          attHeaderIdx = i;
          break;
        }
      }

      if (attHeaderIdx === -1) throw new Error("Could not find attendance registrant list.");

      const attHeaders = attRows[attHeaderIdx].map(h => String(h || "").toLowerCase());
      const attNameIdx = attHeaders.findIndex(h => h.includes("name"));
      const attEmailIdx = attHeaders.findIndex(h => h.includes("email"));
      const attDurIdx = attHeaders.findIndex(h => h.includes("duration"));

      // Fetch all registrants for this session to perform local matching (including name fallback)
      const { data: allRegistrants, error: fetchRegError } = await supabase
        .from('leadx_registrants')
        .select('*')
        .eq('session_id', sessionData.id);
      
      if (fetchRegError) throw fetchRegError;

      let attendeesCount = 0;
      let newRegCount = 0;
      let matchedByEmail = 0;
      let matchedByName = 0;
      const unmatchedAttendees: any[] = [];

      // 3. Process Attendance Rows
      for (const row of attRows.slice(attHeaderIdx + 1)) {
        const rawEmail = String(row[attEmailIdx] || "").trim();
        const email = rawEmail.toLowerCase();
        const rawName = String(row[attNameIdx] || "").trim();
        if (!email || !email.includes("@")) continue;

        const durationMinutes = parseInt(String(row[attDurIdx] || "0")) || 0;
        
        // Match Strategy 1: Email Match
        let targetReg = allRegistrants?.find(r => r.email.toLowerCase() === email);
        
        if (targetReg) {
          matchedByEmail++;
        } else {
          // Match Strategy 2: Robust Name Fallback
          const normalizedAttName = normalizeName(rawName);
          
          // 2a. Exact normalized full name match
          targetReg = allRegistrants?.find(r => normalizeName(r.name) === normalizedAttName);
          
          if (targetReg) {
            matchedByName++;
          } else {
            // 2b. First name + Last initial match
            const attInitialMatchKey = getFirstAndInitial(rawName);
            targetReg = allRegistrants?.find(r => getFirstAndInitial(r.name) === attInitialMatchKey);
            
            if (targetReg) {
              matchedByName++;
            }
          }
        }

        if (targetReg) {
          // Update specific registrant record by ID (handles cases where email might differ)
          await supabase
            .from('leadx_registrants')
            .update({ 
              attended: true, 
              attendance_duration: durationMinutes 
            })
            .eq('id', targetReg.id);
        } else {
          // No match found - Insert as new "Unregistered" attendee
          await supabase
            .from('leadx_registrants')
            .insert({
              session_id: sessionData.id,
              email: email,
              name: rawName,
              attended: true,
              attendance_duration: durationMinutes,
              approval_status: 'Attended without registration'
            });
          newRegCount++;
          unmatchedAttendees.push({ name: rawName, email: rawEmail });
        }
        attendeesCount++;
      }

      if (unmatchedAttendees.length > 0) {
        console.group("LeadX Unmatched Attendees (Logged for Review)");
        console.table(unmatchedAttendees);
        console.groupEnd();
      }

      setStep('completed');
      setSummary({ 
        topic, 
        registrants: registrantsToInsert.length, 
        attendees: attendeesCount, 
        newRegistrants: newRegCount,
        matchedByEmail,
        matchedByName
      });
      toast.success("LeadX sync complete.");
      if (onUploadSuccess) onUploadSuccess();
    } catch (err: any) {
      console.error("Critical Upload Error:", err);
      setStep('error');
      toast.error(err.message || "Sync failed.");
    }
  };

  const getStatusMessage = () => {
    switch(step) {
      case 'parsing_reg': return "Analyzing registration data...";
      case 'uploading_reg': return "Saving session and registrant list...";
      case 'parsing_att': return "Analyzing attendance records...";
      case 'uploading_att': return "Processing participation metrics...";
      case 'completed': return "Success! All data synced.";
      case 'error': return "Failed. See console for details.";
      default: return "";
    }
  };

  return (
    <Card className="border-2 shadow-md">
      <CardHeader>
        <CardTitle className="text-xl font-black text-[#0046ab] flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6" /> LeadX & BuildX Data Pipeline
        </CardTitle>
        <CardDescription>Upload Registration and Attendance reports together.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0046ab] text-[10px] font-bold text-white">1</span>
              <Label className="font-bold text-xs uppercase text-[#0046ab]">Registrant Details CSV</Label>
            </div>
            <Input type="file" accept=".csv" onChange={(e) => setRegFile(e.target.files?.[0] || null)} className="bg-white border-blue-200 text-xs" />
            {regFile && <p className="text-[10px] text-emerald-600 font-medium truncate italic">✓ {regFile.name}</p>}
          </div>

          <div className="space-y-3 p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">2</span>
              <Label className="font-bold text-xs uppercase text-emerald-600">Attendance Report CSV</Label>
            </div>
            <Input type="file" accept=".csv" onChange={(e) => setAttFile(e.target.files?.[0] || null)} className="bg-white border-emerald-200 text-xs" />
            {attFile && <p className="text-[10px] text-emerald-600 font-medium truncate italic">✓ {attFile.name}</p>}
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
          <Button onClick={processLeadXData} disabled={!regFile || !attFile || (step !== 'idle' && step !== 'completed' && step !== 'error')} className="w-full sm:w-[300px] h-11 font-black uppercase tracking-widest bg-[#0046ab]">
            {step === 'idle' || step === 'completed' || step === 'error' ? (
              <span className="flex items-center gap-2">Process Data <ArrowRight className="h-4 w-4" /></span>
            ) : (
              <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Processing...</span>
            )}
          </Button>

          {step !== 'idle' && (
            <div className="flex items-center gap-2 text-xs font-bold">
              {step === 'completed' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-rose-600" />}
              <span className={step === 'completed' ? 'text-emerald-600' : 'text-[#0046ab]'}>{getStatusMessage()}</span>
            </div>
          )}
        </div>

        {summary && (
          <div className="mt-4 p-5 rounded-2xl bg-zinc-900 text-white shadow-xl animate-in zoom-in-95 duration-300">
            <h4 className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Session Sync Complete
            </h4>
            <div className="space-y-4">
              <p className="text-lg font-bold leading-tight border-b border-zinc-800 pb-3">{summary.topic}</p>
              
              <div className="grid grid-cols-3 gap-4 text-center pb-4 border-b border-zinc-800">
                <div>
                  <p className="text-2xl font-black text-blue-400">{summary.registrants}</p>
                  <p className="text-[9px] font-bold text-zinc-500 uppercase">Registrants</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-emerald-400">{summary.attendees}</p>
                  <p className="text-[9px] font-bold text-zinc-500 uppercase">Attendees</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-orange-400">{summary.newRegistrants}</p>
                  <p className="text-[9px] font-bold text-zinc-500 uppercase">Unregistered</p>
                </div>
              </div>

              <div className="flex justify-around pt-1">
                <div className="flex items-center gap-2">
                  <Mail className="h-3 w-3 text-zinc-500" />
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-tight">Email Matches: <span className="text-white">{summary.matchedByEmail}</span></span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-3 w-3 text-zinc-500" />
                  <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-tight">Name Matches: <span className="text-white">{summary.matchedByName}</span></span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LeadXCombinedUpload;
