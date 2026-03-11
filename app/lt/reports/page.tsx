"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export default function LTReportsPage() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Reports</h2>
      </div>
      <Card className="flex flex-col items-center justify-center border-dashed bg-muted/30 py-24 text-center">
        <CardContent>
          <div className="mb-4 rounded-full bg-muted p-4 inline-block">
            <AlertCircle className="h-10 w-10 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold text-muted-foreground">Module Coming Soon</CardTitle>
          <p className="max-w-md text-muted-foreground mt-2">
            The reports section for L&T is currently under development. Soon you'll be able to export detailed competency insights and executive readiness reports.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
