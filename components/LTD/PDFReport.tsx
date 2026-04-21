import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', backgroundColor: '#ffffff' },
  header: { marginBottom: 30, borderBottom: '1pt solid #e4e4e7', paddingBottom: 10 },
  title: { fontSize: 24, color: '#0046ab', fontWeight: 'bold', marginBottom: 5 },
  subtitle: { fontSize: 12, color: '#71717a' },
  date: { fontSize: 10, color: '#a1a1aa', marginTop: 4 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, color: '#18181b', fontWeight: 'bold', marginBottom: 12, borderBottom: '1pt solid #f4f4f5', paddingBottom: 4 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: { width: '31%', padding: 12, backgroundColor: '#f8fafc', borderRadius: 6, border: '1pt solid #e2e8f0', marginBottom: 10 },
  kpiTitle: { fontSize: 9, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 },
  kpiValue: { fontSize: 18, color: '#0f172a', fontWeight: 'bold' },
  kpiDesc: { fontSize: 8, color: '#94a3b8', marginTop: 4 },
  chartContainer: { marginTop: 10, padding: 10, backgroundColor: '#ffffff', border: '1pt solid #f1f5f9', borderRadius: 4 },
  chartBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  chartLabel: { width: 120, fontSize: 9, color: '#475569', paddingRight: 10 },
  chartTrack: { flex: 1, height: 12, backgroundColor: '#f1f5f9', borderRadius: 2 },
  chartFill: { height: '100%', backgroundColor: '#0046ab', borderRadius: 2 },
  chartValue: { width: 40, textAlign: 'right', fontSize: 9, color: '#0f172a', fontWeight: 'bold' },
  table: { width: '100%', border: '1pt solid #e2e8f0', borderRadius: 4, marginTop: 10 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f8fafc', borderBottom: '1pt solid #e2e8f0', padding: 8 },
  tableRow: { flexDirection: 'row', borderBottom: '1pt solid #f1f5f9', padding: 8 },
  tableCellHead: { flex: 1, fontSize: 9, fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' },
  tableCell: { flex: 1, fontSize: 9, color: '#334155' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTop: '1pt solid #e4e4e7', paddingTop: 10 },
  footerText: { fontSize: 8, color: '#a1a1aa' }
});

export interface KPI {
  title: string;
  value: string | number;
  description?: string;
}

export interface ChartData {
  label: string;
  value: number;
  max: number;
  color?: string;
}

export interface Chart {
  title: string;
  data: ChartData[];
}

export interface TableData {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

export interface PDFReportProps {
  title: string;
  description: string;
  date: string;
  kpis?: KPI[];
  charts?: Chart[];
  tables?: TableData[];
}

export const PDFReport = ({ title, description, date, kpis, charts, tables }: PDFReportProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{description}</Text>
        <Text style={styles.date}>Generated on: {date}</Text>
      </View>

      {kpis && kpis.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Performance Indicators</Text>
          <View style={styles.kpiGrid}>
            {kpis.map((kpi, idx) => (
              <View key={idx} style={styles.kpiCard}>
                <Text style={styles.kpiTitle}>{kpi.title}</Text>
                <Text style={styles.kpiValue}>{kpi.value}</Text>
                {kpi.description && <Text style={styles.kpiDesc}>{kpi.description}</Text>}
              </View>
            ))}
          </View>
        </View>
      )}

      {charts && charts.map((chart, idx) => (
        <View key={idx} style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>{chart.title}</Text>
          <View style={styles.chartContainer}>
            {chart.data.map((item, i) => (
              <View key={i} style={styles.chartBar}>
                <Text style={styles.chartLabel}>{item.label}</Text>
                <View style={styles.chartTrack}>
                  <View style={[styles.chartFill, { width: `${(item.value / item.max) * 100}%`, backgroundColor: item.color || '#0046ab' }]} />
                </View>
                <Text style={styles.chartValue}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}

      {tables && tables.map((table, idx) => (
        <View key={idx} style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>{table.title}</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              {table.headers.map((h, i) => (
                <Text key={i} style={styles.tableCellHead}>{h}</Text>
              ))}
            </View>
            {table.rows.map((row, rIdx) => (
              <View key={rIdx} style={styles.tableRow}>
                {row.map((cell, cIdx) => (
                  <Text key={cIdx} style={styles.tableCell}>{cell}</Text>
                ))}
              </View>
            ))}
          </View>
        </View>
      ))}

      <View style={styles.footer} fixed>
        <Text style={styles.footerText}>TCDEX Leadership Dashboard</Text>
        <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
    </Page>
  </Document>
);
