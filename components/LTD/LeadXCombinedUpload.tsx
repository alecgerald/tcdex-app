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

const parseLeadXDate = (dateVal: any): string | null => {
  if (dateVal === null || dateVal === undefined) return null;
  let jsDate: Date | null = null;
  const num = parseFloat(String(dateVal));
  if (!isNaN(num) && num > 30000 && num < 60000) { 
    jsDate = new Date(Math.round((num - 25569) * 86400 * 1000));
  } else if (typeof dateVal === 'string') {
    const cleanStr = dateVal.trim();
    if (!cleanStr) return null;
    const standardDate = new Date(cleanStr);
    if (!isNaN(standardDate.getTime())) return standardDate.toISOString();
    try {
      const parts = cleanStr.split(' ');
      if (parts.length >= 2) {
        const dateParts = parts[0].split('/');
        const timeParts = parts[1].split(':');
        if (dateParts.length === 3 && timeParts.length >= 2) {
          const m = parseInt(dateParts[0], 10);
          const d = parseInt(dateParts[1], 10);
          let y = parseInt(dateParts[2], 10);
          if (y < 100) y += 2000;
          const hh = parseInt(timeParts[0], 10);
          const mm = parseInt(timeParts[1], 10);
          jsDate = new Date(y, m - 1, d, hh, mm, 0);
        }
      }
    } catch (e) {}
  }
  return jsDate && !isNaN(jsDate.getTime()) ? jsDate.toISOString() : null;
};

const normalizeName = (name: string): string => name ? name.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim().toLowerCase() : "";
const getFirstAndInitial = (name: string): string => {
  const norm = normalizeName(name);
  const parts = norm.split(' ');
  return parts.length >= 2 ? `${parts[0]} ${parts[parts.length - 1][0]}` : parts[0];
};

const LeadXCombinedUpload: React.FC<LeadXCombinedUploadProps> = ({ onUploadSuccess }) => {
  const [regFile, setRegFile] = useState<File | null>(null);
  const [attFile, setAttFile] = useState<File | null>(null);
  const [step, setStep] = useState<UploadStep>('idle');
  const [summary, setSummary] = useState<{ topic: string; registrants: number; attendees: number; session_type: string } | null>(null);
  const supabase = createClient();

  const processLeadXData = async () => {
    if (!regFile || !attFile) {
      toast.error("Please select both Registration and Attendance files.");
      return;
    }

    setStep('parsing_reg');
    try {
      const regData = await regFile.arrayBuffer();
      const regRows = XLSX.utils.sheet_to_json(regWorkbook(regData).Sheets[regWorkbook(regData).SheetNames[0]], { header: 1 }) as any[][];
      
      let topic = "", zoomId = "", scheduledTimeISO = "", duration = 0, regHeaderIdx = -1;

      // 1. Robust Session Info Extraction
      for (let i = 0; i < regRows.length; i++) {
        const firstCell = String(regRows[i]?.[0] || "").trim().toLowerCase();
        if (firstCell === "topic") {
          const dataRow = regRows[i + 1];
          if (dataRow) {
            topic = String(dataRow[0] || "").trim();
            zoomId = String(dataRow[1] || "").trim();
            scheduledTimeISO = parseLeadXDate(dataRow[2]) || "";
            duration = parseInt(String(dataRow[3] || "0")) || 0;
            console.log("Found Session Info at row", i + 1, { topic, zoomId, scheduledTimeISO });
            break;
          }
        }
      }

      if (!topic || !scheduledTimeISO) throw new Error("Could not find session 'Topic' header. Ensure the registration file is valid.");

      // 2. Find Registrant Header
      for (let i = 0; i < regRows.length; i++) {
        const cell = String(regRows[i]?.[0] || "").toLowerCase();
        if (cell.includes("registrant details") || cell.includes("attendee details")) {
          regHeaderIdx = i + 1;
          console.log("Found Registrant Header at row", regHeaderIdx);
          break;
        }
      }

      if (regHeaderIdx === -1 || !regRows[regHeaderIdx]) throw new Error("Could not find 'Registrant Details' section.");

      const regHeaders = regRows[regHeaderIdx].map(h => String(h || "").trim().toLowerCase());
      const findRegIdx = (p: string[]) => regHeaders.findIndex(h => p.some(x => h.includes(x)));
      const fNameIdx = findRegIdx(["first name"]), lNameIdx = findRegIdx(["last name"]), emailIdx = findRegIdx(["email"]), 
            timeIdx = findRegIdx(["registration time"]), statusIdx = findRegIdx(["approval status"]), 
            empIdIdx = findRegIdx(["employee id"]), deptIdx = regHeaders.findIndex(h => h.includes("delivery unit") || h.includes("department"));

      setStep('uploading_reg');
      const sessionType = topic.toLowerCase().includes('buildx') ? 'buildx' : (topic.toLowerCase().includes('leadx') ? 'leadx' : 'other');
      const { data: sessionData, error: sessionError } = await supabase.from('leadx_sessions').upsert({
        topic, external_id: zoomId, scheduled_time: scheduledTimeISO, duration, session_type: sessionType
      }, { onConflict: 'topic, scheduled_time' }).select().single();
      if (sessionError) throw sessionError;

      const registrants = regRows.slice(regHeaderIdx + 1).filter(r => r[emailIdx] && String(r[emailIdx]).includes("@")).map(row => ({
        session_id: sessionData.id, employee_id: String(row[empIdIdx] || "").trim(),
        name: `${String(row[fNameIdx] || "").trim()} ${String(row[lNameIdx] || "").trim()}`.trim(),
        email: String(row[emailIdx]).trim().toLowerCase(), department: String(row[deptIdx] || "").trim(),
        registration_time: parseLeadXDate(row[timeIdx]), approval_status: String(row[statusIdx] || "").trim() || 'Approved', attended: false
      }));

      if (registrants.length > 0) await supabase.from('leadx_registrants').upsert(registrants, { onConflict: 'session_id, email' });

      // 3. Process Attendance
      setStep('parsing_att');
      const attData = await attFile.arrayBuffer();
      const attRows = XLSX.utils.sheet_to_json(XLSX.read(attData).Sheets[XLSX.read(attData).SheetNames[0]], { header: 1 }) as any[][];
      let attHeaderIdx = -1;
      for (let i = 0; i < attRows.length; i++) {
        const r = attRows[i]?.map(c => String(c || "").toLowerCase()) || [];
        if (["name", "email", "duration"].every(p => r.some(cell => cell.includes(p)))) { attHeaderIdx = i; break; }
      }
      if (attHeaderIdx === -1) throw new Error("Invalid attendance file format.");

      const attHeaders = attRows[attHeaderIdx].map(h => String(h || "").trim().toLowerCase());
      const findAttIdx = (p: string[]) => attHeaders.findIndex(h => p.some(x => h.includes(x)));
      const attNameIdx = findAttIdx(["name"]), attEmailIdx = findAttIdx(["email"]), attDurIdx = findAttIdx(["duration"]);

      setStep('uploading_att');
      const { data: allReg } = await supabase.from('leadx_registrants').select('*').eq('session_id', sessionData.id);
      let attendeesCount = 0;

      for (const row of attRows.slice(attHeaderIdx + 1)) {
        const email = String(row[attEmailIdx] || "").trim().toLowerCase();
        if (!email.includes("@")) continue;
        const durationMin = parseInt(String(row[attDurIdx] || "0")) || 0;
        const target = allReg?.find(r => r.email === email || normalizeName(r.name) === normalizeName(String(row[attNameIdx])));
        
        if (target) {
          await supabase.from('leadx_registrants').update({ attended: true, attendance_duration: durationMin }).eq('id', target.id);
        } else {
          const isHost = email === 'agsison@innodata.com';
          await supabase.from('leadx_registrants').insert({
            session_id: sessionData.id, email, name: String(row[attNameIdx]), attended: true,
            attendance_duration: durationMin, approval_status: isHost ? 'Host' : 'Attended without registration'
          });
        }
        attendeesCount++;
      }

      setStep('completed');
      setSummary({ topic, registrants: registrants.length, attendees: attendeesCount, session_type: sessionType });
      toast.success("LeadX/BuildX sync complete.");
      if (onUploadSuccess) onUploadSuccess();
    } catch (err: any) {
      console.error("Upload Error:", err);
      setStep('error');
      toast.error(err.message || "Sync failed.");
    }
  };

  const regWorkbook = (data: ArrayBuffer) => XLSX.read(data);

  return (
    <Card className="border-2 shadow-md">
      <CardHeader>
        <CardTitle className="text-xl font-black text-[#0046ab] flex items-center gap-2"><FileSpreadsheet className="h-6 w-6" /> Data Pipeline</CardTitle>
        <CardDescription>Upload Registration and Attendance reports for LeadX or BuildX.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
            <Label className="font-bold text-xs uppercase text-[#0046ab]">Registrant Details CSV</Label>
            <Input type="file" accept=".csv" onChange={(e) => setRegFile(e.target.files?.[0] || null)} />
          </div>
          <div className="space-y-3 p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
            <Label className="font-bold text-xs uppercase text-emerald-600">Attendance Report CSV</Label>
            <Input type="file" accept=".csv" onChange={(e) => setAttFile(e.target.files?.[0] || null)} />
          </div>
        </div>
        <Button onClick={processLeadXData} disabled={!regFile || !attFile || (step !== 'idle' && step !== 'completed' && step !== 'error')} className="w-full h-11 bg-[#0046ab]">
          {step === 'idle' || step === 'completed' || step === 'error' ? "Process Data" : <Loader2 className="animate-spin" />}
        </Button>
        {summary && (
          <div className="mt-4 p-5 rounded-2xl bg-zinc-900 text-white animate-in zoom-in-95">
            <p className="text-lg font-bold border-b border-zinc-800 pb-2">{summary.topic} ({summary.session_type})</p>
            <div className="flex justify-between pt-4">
              <div className="text-center w-1/2 border-r border-zinc-800"><p className="text-2xl font-black text-blue-400">{summary.registrants}</p><p className="text-[9px] text-zinc-500 uppercase">Registrants</p></div>
              <div className="text-center w-1/2"><p className="text-2xl font-black text-emerald-400">{summary.attendees}</p><p className="text-[9px] text-zinc-500 uppercase">Attendees</p></div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LeadXCombinedUpload;
