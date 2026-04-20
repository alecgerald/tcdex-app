import { renderToStream } from '@react-pdf/renderer';
import { PDFReport, PDFReportProps } from '@/components/LTD/PDFReport';
import { NextResponse } from 'next/server';
import React from 'react';

export async function POST(req: Request) {
  try {
    const data: PDFReportProps = await req.json();
    
    if (!data.title) {
      return NextResponse.json({ error: 'Invalid payload: title is required' }, { status: 400 });
    }

    // Render the React PDF component to a Node.js Stream
    const stream = await renderToStream(React.createElement(PDFReport, data));
    
    // Convert Node.js Stream to Web ReadableStream for Next.js response
    const webStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk: Buffer) => {
          controller.enqueue(new Uint8Array(chunk));
        });
        stream.on('end', () => {
          controller.close();
        });
        stream.on('error', (err: Error) => {
          controller.error(err);
        });
      }
    });

    const filename = `${data.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

    return new NextResponse(webStream, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('PDF Generation Error:', error);
    return NextResponse.json({ error: 'Failed to generate PDF', details: error.message }, { status: 500 });
  }
}
