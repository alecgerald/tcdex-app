"use client";

import React from 'react';
import VILTTrackerDashboard from "@/components/LTD/VILTTrackerDashboard";
import VILTTrackerUpload from "@/components/LTD/VILTTrackerUpload";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Presentation, FileUp, MousePointer2 } from 'lucide-react';

export default function VILTTrackerPage() {
  return (
    <div className="w-full space-y-8 pb-20 px-4">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-xl"><Presentation className="h-6 w-6 text-[#0046ab]" /></div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#0046ab]">VILT Performance Tracker</h1>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Attendance & Enrollment Management</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="tracker" className="w-full space-y-6">
        <div className="flex justify-center sm:justify-start">
          <TabsList className="bg-zinc-100 p-1 rounded-2xl h-12">
            <TabsTrigger 
              value="tracker" 
              className="rounded-xl px-6 font-black text-xs uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-[#0046ab] data-[state=active]:shadow-sm transition-all"
            >
              <MousePointer2 className="h-3.5 w-3.5 mr-2" />
              Quick Tracker
            </TabsTrigger>
            <TabsTrigger 
              value="import" 
              className="rounded-xl px-6 font-black text-xs uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-[#0046ab] data-[state=active]:shadow-sm transition-all"
            >
              <FileUp className="h-3.5 w-3.5 mr-2" />
              Import Data
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="tracker" className="mt-0 outline-none">
          <VILTTrackerDashboard />
        </TabsContent>
        
        <TabsContent value="import" className="mt-0 outline-none max-w-3xl mx-auto">
          <VILTTrackerUpload />
        </TabsContent>
      </Tabs>
    </div>
  );
}
