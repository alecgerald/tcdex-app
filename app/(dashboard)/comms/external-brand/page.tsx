"use client"

import { useEffect, useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Users, Eye, Play, Instagram as InstagramIcon, Facebook, Linkedin, ChevronDown, ChevronUp, ChevronsUpDown, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { createClient } from "@/utils/supabase/client"

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

interface ImportData {
  id: string
  fileName: string
  uploadedAt: string
  type: string
  rows: any[]
  sheets?: Record<string, any[]>
}

export default function ExternalBrandPage() {
  const [fbRawData, setFbRawData] = useState<any[]>([])
  const [igRawData, setIgRawData] = useState<any[]>([])
  const [liRawData, setLiRawData] = useState<any[]>([])
  const [liPostsRawData, setLiPostsRawData] = useState<any[]>([])
  const [ttRawData, setTtRawData] = useState<any[]>([])

  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null)
  const [currentPage, setCurrentPage] = useState<number>(1)

  const [startDate, setStartDate] = useState<string>(() => {
    const today = new Date()
    const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    return `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-${String(firstDay.getDate()).padStart(2, '0')}`
  })
  
  const [endDate, setEndDate] = useState<string>(() => {
    const today = new Date()
    const lastDay = new Date(today.getFullYear(), today.getMonth(), 0)
    return `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`
  })

  useEffect(() => {
    async function loadData() {
      const supabase = createClient()
      
      const { data: fbData } = await supabase.from('comms_facebook_visits').select('*')
      if (fbData) {
        setFbRawData(fbData.map(r => ({ ...r, Date: r.date, Primary: r.primary_visits })))
      }

      const { data: igData } = await supabase.from('comms_instagram_views').select('*')
      if (igData) {
        setIgRawData(igData.map(r => ({ ...r, Date: r.date, Primary: r.primary_views })))
      }

      const { data: liGeneral } = await supabase.from('comms_linkedin_general').select('*')
      if (liGeneral) {
        setLiRawData(liGeneral.map(r => ({ 
           ...r, 
           Date: r.date, 
           Impressions: r.impressions_total,
           'Total impressions': r.impressions_total 
        })))
      }

      const { data: liPosts } = await supabase.from('comms_linkedin_posts').select('*')
      if (liPosts) {
         setLiPostsRawData(liPosts.map(r => ({
           ...r,
           'post title': r.post_title,
           'post link': r.post_link,
           'created date': r.created_date,
           impressions: r.impressions,
           clicks: r.clicks,
           likes: r.likes,
           comments: r.comments,
           reposts: r.reposts,
           'engagement rate': r.engagement_rate
         })))
      }

      const { data: ttData } = await supabase.from('comms_tiktok_overview').select('*')
      if (ttData) {
         setTtRawData(ttData.map(r => ({
            ...r,
            Date: r.date,
            'Video views': r.video_views,
            Views: r.video_views
         })))
      }
    }
    
    loadData()
  }, [])


  // Filter Data
  const getNormalizeDateString = (rawDate: any): string | null => {
    if (!rawDate) return null;
    let d: Date | null = null;

    if (typeof rawDate === 'number') {
      // Excel serial date to JS Date
      d = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
    } else if (typeof rawDate === 'string') {
      const dateStr = rawDate.split('T')[0].split(' ')[0];

      if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          } else {
            d = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
          }
        }
      } else {
        d = new Date(dateStr + "T00:00:00"); // Force local time
      }
    } else if (rawDate instanceof Date) {
      d = rawDate;
    }

    if (d && !isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    return null;
  }

  const filterDataByDate = (rows: any[]) => {
    return rows.filter((row) => {
      const lcRow: Record<string, any> = {};
      Object.keys(row).forEach(k => { lcRow[k.trim().toLowerCase()] = row[k]; });
      
      const rawDate = lcRow['date'] || lcRow['created date'] || lcRow['start date'];
      const rowDateStr = getNormalizeDateString(rawDate);

      if (!rowDateStr) return true; // Keep if no valid date found

      if (startDate && rowDateStr < startDate) return false;
      if (endDate && rowDateStr > endDate) return false;

      return true;
    }).sort((a, b) => {
      const lcRowA: Record<string, any> = {};
      Object.keys(a).forEach(k => { lcRowA[k.trim().toLowerCase()] = a[k]; });
      const lcRowB: Record<string, any> = {};
      Object.keys(b).forEach(k => { lcRowB[k.trim().toLowerCase()] = b[k]; });

      const aStr = getNormalizeDateString(lcRowA['date'] || lcRowA['created date'] || lcRowA['start date']) || "";
      const bStr = getNormalizeDateString(lcRowB['date'] || lcRowB['created date'] || lcRowB['start date']) || "";
      return aStr.localeCompare(bStr);
    })
  }

  const filteredFbData = useMemo(() => filterDataByDate(fbRawData), [fbRawData, startDate, endDate])
  const filteredIgData = useMemo(() => filterDataByDate(igRawData), [igRawData, startDate, endDate])
  const filteredLiData = useMemo(() => filterDataByDate(liRawData), [liRawData, startDate, endDate])
  const filteredLiPostsData = useMemo(() => filterDataByDate(liPostsRawData), [liPostsRawData, startDate, endDate])
  const filteredTtData = useMemo(() => filterDataByDate(ttRawData), [ttRawData, startDate, endDate])

  const fbTotalVisits = useMemo(() => {
    return filteredFbData.reduce((sum, row) => {
      const val = parseFloat(row.Primary || row.primary || 0)
      return sum + (isNaN(val) ? 0 : val)
    }, 0)
  }, [filteredFbData])

  const igTotalViews = useMemo(() => {
    return filteredIgData.reduce((sum, row) => {
      const val = parseFloat(row.Primary || row.primary || row.Views || row.views || 0)
      return sum + (isNaN(val) ? 0 : val)
    }, 0)
  }, [filteredIgData])

  const liTotalImpressions = useMemo(() => {
    return filteredLiData.reduce((sum, row) => {
      // Common LinkedIn columns: "Impressions", "Total impressions", "Impressions (total)", "Primary"
      const val = parseFloat(row.Impressions || row['Total impressions'] || row['Impressions (total)'] || row.Primary || row.primary || 0)
      return sum + (isNaN(val) ? 0 : val)
    }, 0)
  }, [filteredLiData])

  const ttTotalViews = useMemo(() => {
    return filteredTtData.reduce((sum, row) => {
      // Common TikTok columns: "Video views", "Views", "Primary"
      const val = parseFloat(row['Video views'] || row.Views || row.views || row.Primary || row.primary || 0)
      return sum + (isNaN(val) ? 0 : val)
    }, 0)
  }, [filteredTtData])

  // Extract LinkedIn Posts for the generic table exclusively from sheet 2
  const liPosts = useMemo(() => {
    const postRows = filteredLiPostsData.filter(row => {
      const keys = Object.keys(row).map(k => k.trim().toLowerCase());
      return keys.includes('post link') || keys.includes('post title') || keys.includes('title') || keys.includes('campaign name') || keys.includes('post title (optional)');
    });
    
    return postRows.map(row => {
      const lcRow: Record<string, any> = {};
      Object.keys(row).forEach(k => { lcRow[k.trim().toLowerCase()] = row[k]; });

      const titleRaw = String(lcRow['post title'] || lcRow['title'] || lcRow['campaign name'] || lcRow['post title (optional)'] || lcRow['post link'] || "Untitled Post");
      const title = titleRaw;
      
      const impressions = parseFloat(lcRow['impressions'] || lcRow['total impressions'] || lcRow['impressions (total)'] || 0) || 0;
      const clicks = parseFloat(lcRow['clicks'] || lcRow['clicks (total)'] || 0) || 0;
      const likes = parseFloat(lcRow['likes'] || lcRow['reactions'] || lcRow['reactions (organic)'] || 0) || 0;
      const comments = parseFloat(lcRow['comments'] || lcRow['comments (organic)'] || 0) || 0;
      const reposts = parseFloat(lcRow['reposts'] || lcRow['shares'] || lcRow['shares (organic)'] || 0) || 0;
      
      let engagementRate = lcRow['engagement rate'];
      if (!engagementRate && impressions > 0) {
        engagementRate = (((clicks + likes + comments + reposts) / impressions) * 100).toFixed(2) + '%';
      } else if (!engagementRate) {
        engagementRate = '0%';
      } else if (typeof engagementRate === 'number') {
        engagementRate = (engagementRate * 100).toFixed(2) + '%';
      }

      const createdDateRaw = lcRow['created date'] || lcRow['date'] || '';
      const createdDateValue = getNormalizeDateString(createdDateRaw);
      const postLink = lcRow['post link'] || '';
      
      return {
        title, titleRaw, postLink, impressions, clicks, likes, comments, reposts, engagementRate, createdDateRaw, createdDateValue
      }
    }).sort((a, b) => {
      const dateA = a.createdDateValue || "";
      const dateB = b.createdDateValue || "";
      return dateB.localeCompare(dateA); // descending
    });
  }, [filteredLiPostsData]);

  const sortedPosts = useMemo(() => {
    let sortableItems = [...liPosts];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aVal = a[sortConfig.key as keyof typeof a];
        let bVal = b[sortConfig.key as keyof typeof b];

        if (typeof aVal === 'string' && aVal.includes('%')) {
          aVal = parseFloat(aVal.replace('%', ''));
          bVal = parseFloat((bVal as string).replace('%', ''));
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [liPosts, sortConfig]);

  const ITEMS_PER_PAGE = 5;
  const totalPages = Math.ceil(sortedPosts.length / ITEMS_PER_PAGE);
  const paginatedPosts = sortedPosts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (current?.key === key) {
        if (current.direction === 'asc') return { key, direction: 'desc' }
        return null // reset
      }
      return { key, direction: 'asc' }
    });
    setCurrentPage(1); // Reset pagination on explicit sort
  }

  const renderSortableHeader = (label: string, sortKey: string, isLast = false) => {
    return (
      <TableHead 
        className={`text-right py-3 cursor-pointer hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 transition-colors group select-none ${isLast ? 'pr-6' : ''}`}
        onClick={() => handleSort(sortKey)}
      >
        <div className="flex items-center justify-end gap-1">
          {label}
          <span className="text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors">
            {sortConfig?.key === sortKey ? (
              sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronsUpDown className="h-3 w-3 opacity-30" />
            )}
          </span>
        </div>
      </TableHead>
    )
  }

  const kpis = [
    {
      title: "Facebook Visits",
      value: fbTotalVisits.toLocaleString(),
      description: "Total page visits from upload",
      icon: Facebook,
      color: "text-blue-600",
    },
    {
      title: "LinkedIn Impressions",
      value: liTotalImpressions.toLocaleString(),
      description: "Total post impressions",
      icon: Linkedin,
      color: "text-blue-700",
    },
    {
      title: "Tiktok Video Views",
      value: ttTotalViews.toLocaleString(),
      description: "Total video views",
      icon: Play,
      color: "text-zinc-900 dark:text-zinc-100",
    },
    {
      title: "Instagram Views",
      value: igTotalViews.toLocaleString(),
      description: "Total profile views",
      icon: InstagramIcon,
      color: "text-pink-600",
    },
  ]

  const spansMultipleMonths = useMemo(() => {
    if (!startDate || !endDate) return false;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
    return start.getFullYear() !== end.getFullYear() || start.getMonth() !== end.getMonth();
  }, [startDate, endDate]);

  // Chart Data prep
  const formatLabelDate = (rawDate: any) => {
    if (!rawDate) return "";

    // Clean string by removing time components
    let dateStr = String(rawDate).trim().split('T')[0].split(' ')[0];

    let m = "";
    let d = "";

    // Handle formats with '-'
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length >= 3) {
        if (parts[0].length === 4) { m = parts[1]; d = parts[2]; } // YYYY-MM-DD
        else if (parts[2].length === 4) { m = parts[1]; d = parts[0]; } // DD-MM-YYYY
      } else if (parts.length === 2) {
        m = parts[0]; d = parts[1];
      }
    }
    // Handle formats with '/'
    else if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length >= 3) {
        if (parts[0].length === 4) { m = parts[1]; d = parts[2]; }
        else { m = parts[0]; d = parts[1]; }
      }
    }

    if (!m || !d) {
      // Fallback for valid Date objects or timestamps
      const dateObj = new Date(rawDate);
      if (!isNaN(dateObj.getTime())) {
        m = String(dateObj.getMonth() + 1);
        d = String(dateObj.getDate());
      }
    }

    if (m && d) {
      return `${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    return dateStr;
  }

  const validFbData = filteredFbData.filter(row => getNormalizeDateString(row.Date || row.date))
  const validIgData = filteredIgData.filter(row => getNormalizeDateString(row.Date || row.date))
  const validTtData = filteredTtData.filter(row => getNormalizeDateString(row.Date || row.date))
  const validLiData = filteredLiData.filter(row => getNormalizeDateString(row.Date || row.date))

  const fbChartData = {
    labels: validFbData.map(row => formatLabelDate(row.Date || row.date)),
    datasets: [
      {
        label: "Facebook Daily Visits",
        data: validFbData.map(row => parseFloat(row.Primary || row.primary || 0) || 0),
        borderColor: "rgb(59, 130, 246)",
        borderWidth: 3,
        pointRadius: 0,
        pointHoverRadius: 6,
        fill: true,
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 400);
          gradient.addColorStop(0, "rgba(59, 130, 246, 0.2)");
          gradient.addColorStop(1, "rgba(59, 130, 246, 0.0)");
          return gradient;
        },
        tension: 0.4,
      }
    ]
  }

  const igChartData = {
    labels: validIgData.map(row => formatLabelDate(row.Date || row.date)),
    datasets: [
      {
        label: "Instagram Daily Views",
        data: validIgData.map(row => parseFloat(row.Primary || row.primary || row.Views || row.views || 0) || 0),
        borderColor: "rgb(219, 39, 119)", // pink-600
        borderWidth: 3,
        pointRadius: 0,
        pointHoverRadius: 6,
        fill: true,
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 400);
          gradient.addColorStop(0, "rgba(219, 39, 119, 0.2)");
          gradient.addColorStop(1, "rgba(219, 39, 119, 0.0)");
          return gradient;
        },
        tension: 0.4,
      }
    ]
  }

  const ttChartData = {
    labels: validTtData.map(row => formatLabelDate(row.Date || row.date)),
    datasets: [
      {
        label: "TikTok Daily Views",
        data: validTtData.map(row => parseFloat(row['Video views'] || row.Views || row.views || row.Primary || row.primary || 0) || 0),
        borderColor: "rgb(24, 24, 27)", // zinc-900
        borderWidth: 3,
        pointRadius: 0,
        pointHoverRadius: 6,
        fill: true,
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 400);
          gradient.addColorStop(0, "rgba(24, 24, 27, 0.2)");
          gradient.addColorStop(1, "rgba(24, 24, 27, 0.0)");
          return gradient;
        },
        tension: 0.4,
      }
    ]
  }

  const liChartData = {
    labels: validLiData.map(row => formatLabelDate(row.Date || row.date)),
    datasets: [
      {
        label: "LinkedIn Daily Impressions",
        data: validLiData.map(row => parseFloat(row.Impressions || row['Total impressions'] || row['Impressions (total)'] || row.Primary || row.primary || 0) || 0),
        borderColor: "rgb(29, 78, 216)", // blue-700
        borderWidth: 3,
        pointRadius: 0,
        pointHoverRadius: 6,
        fill: true,
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 400);
          gradient.addColorStop(0, "rgba(29, 78, 216, 0.2)");
          gradient.addColorStop(1, "rgba(29, 78, 216, 0.0)");
          return gradient;
        },
        tension: 0.4,
      }
    ]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(255, 255, 255, 0.9)",
        titleColor: "#18181b",
        bodyColor: "#18181b",
        borderColor: "#e4e4e7",
        borderWidth: 1,
        padding: 12,
        boxPadding: 4,
        usePointStyle: true,
        titleFont: { size: 14, weight: 'bold' as const },
        bodyFont: { size: 13 },
        callbacks: {
          label: (context: any) => ` ${context.dataset.label.split(' ')[0]}: ${context.parsed.y}`
        }
      },
    },
    scales: {
      x: {
        grid: {
          display: true,
          drawOnChartArea: true,
          color: (context: any) => {
            if (!spansMultipleMonths || context.index === 0) return 'transparent';
            try {
              const currentLabel = context.scale.getLabelForValue(context.tick.value);
              const prevLabel = context.scale.getLabelForValue(context.scale.ticks[context.index - 1].value);
              
              if (currentLabel && prevLabel && typeof currentLabel === 'string' && typeof prevLabel === 'string') {
                if (currentLabel.includes('-') && prevLabel.includes('-')) {
                  const currentMonth = parseInt(currentLabel.split('-')[0], 10);
                  const prevMonth = parseInt(prevLabel.split('-')[0], 10);
                  if (currentMonth !== prevMonth) {
                    return 'rgba(161, 161, 170, 0.8)'; // Visible line (zinc-400)
                  }
                }
              }
            } catch(e) {}
            return 'transparent';
          },
        },
        ticks: {
          font: { size: 11 },
          color: "#71717a",
          autoSkip: false,
          maxRotation: 0,
          callback: function(value: any, index: number, values: any[]) {
            const label = this.getLabelForValue(value) as string;
            
            if (label.includes('-') && spansMultipleMonths) {
               const parts = label.split('-');
               const month = parseInt(parts[0], 10);
               const day = parseInt(parts[1], 10);
               
               const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
               
               // Find the center index of the current month
               let startIdx = index;
               while (startIdx > 0) {
                 const prevLabel = this.getLabelForValue(values[startIdx - 1].value) as string;
                 if (parseInt(prevLabel.split('-')[0], 10) === month) startIdx--;
                 else break;
               }
               
               let endIdx = index;
               while (endIdx < values.length - 1) {
                 const nextLabel = this.getLabelForValue(values[endIdx + 1].value) as string;
                 if (parseInt(nextLabel.split('-')[0], 10) === month) endIdx++;
                 else break;
               }
               
               const midIdx = Math.floor((startIdx + endIdx) / 2);
               
               if (index === midIdx) {
                 return [day.toString(), monthNames[month - 1]];
               }
               return day.toString();
            }
            
            return label; // standard single month behavior
          }
        }
      },
      y: {
        beginAtZero: true,
        border: {
          display: false,
          dash: [4, 4],
        },
        grid: {
          color: "rgba(161, 161, 170, 0.15)",
        },
        ticks: {
          font: { size: 11 },
          color: "#71717a",
          padding: 8,
        }
      },
    },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">External Brand</h2>
          <p className="text-muted-foreground">
            Overview of social media performance metrics pulled from imported data.
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-white dark:bg-zinc-900 p-2 rounded-md border shadow-sm">
          <span className="text-sm font-medium text-zinc-500 mr-2">Filter Date:</span>
          <Input
            type="date"
            className="w-auto h-8 text-sm border-none focus-visible:ring-0 shadow-none bg-transparent"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <span className="text-sm text-zinc-400">to</span>
          <Input
            type="date"
            className="w-auto h-8 text-sm border-none focus-visible:ring-0 shadow-none bg-transparent"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title} className="border-none shadow-sm bg-white/50 dark:bg-white/5 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {kpi.title}
              </CardTitle>
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <p className="text-xs text-muted-foreground">
                {kpi.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {(filteredFbData.length > 0 || filteredLiData.length > 0 || filteredTtData.length > 0 || filteredIgData.length > 0) && (
        <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-zinc-950">
          <Tabs defaultValue={filteredFbData.length > 0 ? "facebook" : filteredLiData.length > 0 ? "linkedin" : "tiktok"} className="w-full">
            <CardHeader className="border-b bg-zinc-50/50 dark:bg-zinc-900/50">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-bold">Performance Analytics</CardTitle>
                  <CardDescription>Daily trend analysis across platforms</CardDescription>
                </div>
                <TabsList className="flex flex-wrap h-auto w-full md:w-auto">
                  <TabsTrigger value="facebook" disabled={filteredFbData.length === 0} className="flex-1 md:flex-none">Facebook Visits</TabsTrigger>
                  <TabsTrigger value="linkedin" disabled={filteredLiData.length === 0} className="flex-1 md:flex-none">LinkedIn Impressions</TabsTrigger>
                  <TabsTrigger value="tiktok" disabled={filteredTtData.length === 0} className="flex-1 md:flex-none">TikTok Video Views</TabsTrigger>
                  <TabsTrigger value="instagram" disabled={filteredIgData.length === 0} className="flex-1 md:flex-none">Instagram Views</TabsTrigger>
                </TabsList>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <TabsContent value="facebook" className="m-0">
                <div className="h-[350px] w-full">
                  <Line data={fbChartData} options={chartOptions} />
                </div>
              </TabsContent>
              <TabsContent value="instagram" className="m-0">
                <div className="h-[350px] w-full">
                  <Line data={igChartData} options={chartOptions} />
                </div>
              </TabsContent>
              <TabsContent value="linkedin" className="m-0">
                <div className="h-[350px] w-full">
                  <Line data={liChartData} options={chartOptions} />
                </div>
              </TabsContent>
              <TabsContent value="tiktok" className="m-0">
                <div className="h-[350px] w-full">
                  <Line data={ttChartData} options={chartOptions} />
                </div>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      )}

      <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-zinc-950 mt-6">
        <CardHeader className="border-b bg-zinc-50/50 dark:bg-zinc-900/50">
          <CardTitle className="text-xl font-bold">Recent LinkedIn Posts</CardTitle>
          <CardDescription>Performance metrics for recent posts</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {liPosts.length > 0 ? (
            <div className="flex flex-col w-full">
              <div className="w-full overflow-x-auto">
                <Table>
                  <TableHeader className="bg-zinc-100/50 dark:bg-zinc-800/50">
                    <TableRow>
                      <TableHead className="w-[300px] pl-6 py-3">Post Title</TableHead>
                      {renderSortableHeader("Impressions", "impressions")}
                      {renderSortableHeader("Clicks", "clicks")}
                      {renderSortableHeader("Likes", "likes")}
                      {renderSortableHeader("Comments", "comments")}
                      {renderSortableHeader("Reposts", "reposts")}
                      {renderSortableHeader("Engagement Rate", "engagementRate", true)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedPosts.map((post: any, i: number) => (
                      <TableRow key={i} className="hover:bg-zinc-100 dark:hover:bg-zinc-800">
                        <TableCell className="max-w-[300px] pl-6 py-3">
                          <div className="truncate font-medium text-zinc-900 dark:text-zinc-100" title={post.titleRaw}>
                            {post.title}
                          </div>
                          <div className="flex items-center mt-1">
                            <span className="text-[10px] text-zinc-500">
                              {post.createdDateValue ? (() => {
                                const [y, m, d] = post.createdDateValue.split('-');
                                return `${m}/${d}/${y}`
                              })() : "N/A"}
                            </span>
                            {post.postLink && (
                              <a href={post.postLink.startsWith('http') ? post.postLink : `https://${post.postLink}`} target="_blank" rel="noopener noreferrer" className="ml-1.5 text-zinc-400 hover:text-blue-500 transition-colors" title="View Post on LinkedIn">
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-zinc-600 dark:text-zinc-400 font-mono text-xs py-3">{post.impressions.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-zinc-600 dark:text-zinc-400 font-mono text-xs py-3">{post.clicks.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-zinc-600 dark:text-zinc-400 font-mono text-xs py-3">{post.likes.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-zinc-600 dark:text-zinc-400 font-mono text-xs py-3">{post.comments.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-zinc-600 dark:text-zinc-400 font-mono text-xs py-3">{post.reposts.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-medium text-blue-600 dark:text-blue-400 font-mono text-xs pr-6 py-3">{post.engagementRate}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-3 border-t bg-zinc-50/50 dark:bg-zinc-900/50">
                  <span className="text-sm text-zinc-500 max-sm:hidden">
                    Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, sortedPosts.length)} of {sortedPosts.length} posts
                  </span>
                  <span className="text-sm text-zinc-500 sm:hidden">
                    {sortedPosts.length} posts
                  </span>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
                    </button>
                    <span className="text-sm font-medium w-16 text-center">
                      {currentPage} / {totalPages}
                    </span>
                    <button 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="p-1 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-zinc-500 flex flex-col items-center justify-center min-h-[150px]">
              <p className="font-medium text-zinc-900 dark:text-zinc-100">No posts found</p>
              <p className="text-sm mt-1">There are no LinkedIn posts that fall within the current date filter ({startDate} to {endDate}).</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
