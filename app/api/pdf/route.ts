import { renderToBuffer } from '@react-pdf/renderer';
import { PDFReport } from '@/components/LTD/PDFReport';
import { NextResponse } from 'next/server';
import React from 'react';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Create the buffer using react-pdf
    const buffer = await renderToBuffer(React.createElement(PDFReport, body));
    
    return new Response(buffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="report.pdf"`,
      },
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
