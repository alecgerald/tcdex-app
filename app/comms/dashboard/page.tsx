"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { 
  Loader2, 
  FileSpreadsheet, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  MousePointer2, 
  Zap, 
  UserPlus,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  ChevronUp,
  ChevronDown
} from "lucide-react"
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend, 
  ArcElement,
  Filler
} from 'chart.js'
import { Line, Bar, Doughnut } from 'react-chartjs-2'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface CommsData {
  uploadedAt: string
  newFollowers: any[]
  location: any[]
  jobFunction: any[]
  seniority: any[]
  industry: any[]
  companySize: any[]
}

export default function CommsDashboard() {
  const [data, setData] = useState<CommsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const savedData = localStorage.getItem("comms_linkedin_data")
    if (savedData) {
      try {
        setData(JSON.parse(savedData))
      } catch (e) {
        console.error("Failed to parse saved data", e)
      }
    }
    setIsLoading(false)
  }, [])

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#0046ab]" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <div className="h-20 w-20 rounded-full bg-zinc-100 flex items-center justify-center dark:bg-zinc-800">
          <FileSpreadsheet className="h-10 w-10 text-zinc-400" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">No LinkedIn Data</h1>
        <p className="text-zinc-500 max-w-sm">
          Please upload your LinkedIn followers export file to view the analytics dashboard.
        </p>
        <Link href="/comms/import-excel">
          <Button className="bg-[#0046ab] hover:bg-[#003a8f] text-white">
            Go to Import Page
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Comms Dashboard</h1>
          <p className="text-zinc-500 dark:text-zinc-400">LinkedIn Followers Analytics & Insights</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Last Uploaded</p>
          <p className="text-sm font-medium">{new Date(data.uploadedAt).toLocaleString()}</p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <div className="flex items-center justify-between">
          <TabsList variant="line" className="h-auto p-0 bg-transparent border-b rounded-none w-full justify-start gap-6">
            <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#0046ab] data-[state=active]:bg-transparent pb-2 px-0">Overview</TabsTrigger>
            <TabsTrigger value="location" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#0046ab] data-[state=active]:bg-transparent pb-2 px-0">Location</TabsTrigger>
            <TabsTrigger value="job-function" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#0046ab] data-[state=active]:bg-transparent pb-2 px-0">Job Function</TabsTrigger>
            <TabsTrigger value="seniority" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#0046ab] data-[state=active]:bg-transparent pb-2 px-0">Seniority</TabsTrigger>
            <TabsTrigger value="industry" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#0046ab] data-[state=active]:bg-transparent pb-2 px-0">Industry</TabsTrigger>
            <TabsTrigger value="company-size" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#0046ab] data-[state=active]:bg-transparent pb-2 px-0">Company Size</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview">
          <OverviewTab data={data.newFollowers} />
        </TabsContent>
        <TabsContent value="location">
          <DistributionTab data={data.location} title="Location" column="Location" />
        </TabsContent>
        <TabsContent value="job-function">
          <DistributionTab data={data.jobFunction} title="Job Function" column="Job function" isDonut={true} />
        </TabsContent>
        <TabsContent value="seniority">
          <DistributionTab data={data.seniority} title="Seniority" column="Seniority" isDonut={true} isPie={true} />
        </TabsContent>
        <TabsContent value="industry">
          <DistributionTab data={data.industry} title="Industry" column="Industry" />
        </TabsContent>
        <TabsContent value="company-size">
          <DistributionTab data={data.companySize} title="Company Size" column="Company size" isDonut={true} isOrdered={true} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function OverviewTab({ data }: { data: any[] }) {
  // KPI Calculations
  const stats = useMemo(() => {
    if (data.length === 0) return null
    
    const total = data.reduce((acc, curr) => acc + (curr['Total followers'] || 0), 0)
    const organic = data.reduce((acc, curr) => acc + (curr['Organic followers'] || 0), 0)
    const sponsored = data.reduce((acc, curr) => acc + (curr['Sponsored followers'] || 0), 0)
    const invited = data.reduce((acc, curr) => acc + (curr['Auto-invited followers'] || 0), 0)

    const mid = Math.floor(data.length / 2)
    const firstHalf = data.slice(0, mid)
    const secondHalf = data.slice(mid)

    const calcTrend = (key: string) => {
      const fSum = firstHalf.reduce((acc, curr) => acc + (curr[key] || 0), 0)
      const sSum = secondHalf.reduce((acc, curr) => acc + (curr[key] || 0), 0)
      return sSum >= fSum ? 'up' : 'down'
    }

    return {
      total, organic, sponsored, invited,
      trends: {
        total: calcTrend('Total followers'),
        organic: calcTrend('Organic followers'),
        sponsored: calcTrend('Sponsored followers'),
        invited: calcTrend('Auto-invited followers')
      }
    }
  }, [data])

  // Chart Data
  const lineChartData = {
    labels: data.map(r => r.Date),
    datasets: [
      {
        label: 'Total Followers',
        data: data.map(r => r['Total followers']),
        borderColor: '#0046ab',
        backgroundColor: '#0046ab20',
        fill: true,
        tension: 0.4
      },
      {
        label: 'Organic',
        data: data.map(r => r['Organic followers']),
        borderColor: '#10b981',
        backgroundColor: 'transparent',
        tension: 0.4
      },
      {
        label: 'Sponsored',
        data: data.map(r => r['Sponsored followers']),
        borderColor: '#f59e0b',
        backgroundColor: 'transparent',
        tension: 0.4
      }
    ]
  }

  // Weekly Grouping for Bar Chart
  const weeklyData = useMemo(() => {
    const weeks: Record<string, any> = {}
    data.forEach(r => {
      // Very basic weekly grouping by index-based 7-day chunks or date parsing
      const date = new Date(r.Date)
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay())
      const weekKey = weekStart.toISOString().split('T')[0]
      
      if (!weeks[weekKey]) {
        weeks[weekKey] = { label: `Week of ${weekKey}`, organic: 0, sponsored: 0, invited: 0, total: 0 }
      }
      weeks[weekKey].organic += (r['Organic followers'] || 0)
      weeks[weekKey].sponsored += (r['Sponsored followers'] || 0)
      weeks[weekKey].invited += (r['Auto-invited followers'] || 0)
      weeks[weekKey].total += (r['Total followers'] || 0)
    })
    return Object.values(weeks)
  }, [data])

  const barChartData = {
    labels: weeklyData.map(w => w.label),
    datasets: [
      {
        label: 'Organic',
        data: weeklyData.map(w => w.organic),
        backgroundColor: '#10b981',
      },
      {
        label: 'Sponsored',
        data: weeklyData.map(w => w.sponsored),
        backgroundColor: '#f59e0b',
      },
      {
        label: 'Auto-invited',
        data: weeklyData.map(w => w.invited),
        backgroundColor: '#6366f1',
      }
    ]
  }

  // Table Sorting
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'Date', direction: 'desc' })
  const avgTotal = stats ? stats.total / data.length : 0

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      const aVal = a[sortConfig.key]
      const bVal = b[sortConfig.key]
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [data, sortConfig])

  // Insights
  const insights = useMemo(() => {
    if (data.length === 0) return null
    const peak = [...data].sort((a, b) => b['Total followers'] - a['Total followers'])[0]
    const lowest = [...data].sort((a, b) => a['Total followers'] - b['Total followers'])[0]
    
    const dayOfWeekTotals: Record<number, number> = {}
    data.forEach(r => {
      const d = new Date(r.Date).getDay()
      dayOfWeekTotals[d] = (dayOfWeekTotals[d] || 0) + r['Total followers']
    })
    const bestDayIdx = Object.entries(dayOfWeekTotals).sort((a, b) => b[1] - a[1])[0][0]
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

    return {
      peakDay: peak.Date,
      peakVal: peak['Total followers'],
      lowDay: lowest.Date,
      lowVal: lowest['Total followers'],
      dailyAvg: (stats?.total || 0) / data.length,
      bestDayOfWeek: days[parseInt(bestDayIdx)],
      trend: (stats?.trends.total === 'up' ? 'Growing' : 'Declining')
    }
  }, [data, stats])

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total New Followers', value: stats?.total, icon: Users, trend: stats?.trends.total, color: 'text-[#0046ab]' },
          { label: 'Organic Followers', value: stats?.organic, icon: MousePointer2, trend: stats?.trends.organic, color: 'text-green-600' },
          { label: 'Sponsored Followers', value: stats?.sponsored, icon: Zap, trend: stats?.trends.sponsored, color: 'text-amber-500' },
          { label: 'Auto-invited', value: stats?.invited, icon: UserPlus, trend: stats?.trends.invited, color: 'text-indigo-500' },
        ].map((kpi) => (
          <Card key={kpi.label} className="border-none shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 ${kpi.color}`}>
                  <kpi.icon className="h-5 w-5" />
                </div>
                {kpi.trend === 'up' ? (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    Growth
                  </Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none">
                    <TrendingDown className="h-3 w-3 mr-1" />
                    Decline
                  </Badge>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-sm text-zinc-500 font-medium">{kpi.label}</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-2xl font-bold">{kpi.value?.toLocaleString()}</h3>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">New Followers Over Time</CardTitle>
            <CardDescription>Daily growth across all channels</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <Line 
                data={lineChartData} 
                options={{ 
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'bottom' },
                    tooltip: { mode: 'index', intersect: false }
                  },
                  scales: {
                    y: { beginAtZero: true }
                  }
                }} 
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Insights & Performance</CardTitle>
            <CardDescription>Key milestones and trends</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-[10px] text-zinc-400 uppercase font-bold">Peak Performance</p>
                <p className="text-sm font-bold">{insights?.peakDay}</p>
                <p className="text-xs text-green-600 font-medium">{insights?.peakVal} followers</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-zinc-400 uppercase font-bold">Daily Average</p>
                <p className="text-sm font-bold">{insights?.dailyAvg.toFixed(1)}</p>
                <p className="text-xs text-zinc-500">Per Day</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-zinc-400 uppercase font-bold">Best Day of Week</p>
                <p className="text-sm font-bold">{insights?.bestDayOfWeek}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-zinc-400 uppercase font-bold">Overall Trend</p>
                <div className="flex items-center gap-1">
                  <p className={`text-sm font-bold ${insights?.trend === 'Growing' ? 'text-green-600' : 'text-red-600'}`}>
                    {insights?.trend}
                  </p>
                  {insights?.trend === 'Growing' ? <ArrowUpRight className="h-4 w-4 text-green-600" /> : <ArrowDownRight className="h-4 w-4 text-red-600" />}
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-white dark:bg-zinc-700 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-[#0046ab]" />
                </div>
                <div>
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-tighter">Observation</p>
                  <p className="text-sm font-medium">Follower growth peaked on {insights?.peakDay}.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Weekly Follower Acquisition</CardTitle>
          <CardDescription>Followers grouped by calendar week and acquisition channel</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <Bar 
              data={barChartData}
              options={{
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'bottom' },
                },
                scales: {
                  x: { stacked: true },
                  y: { stacked: true, beginAtZero: true }
                }
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg">Daily Performance Data</CardTitle>
          <CardDescription>Detailed breakdown of daily follower metrics</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader className="bg-zinc-50 dark:bg-zinc-800 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="cursor-pointer hover:text-[#0046ab]" onClick={() => setSortConfig({ key: 'Date', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>
                    Date {sortConfig.key === 'Date' && (sortConfig.direction === 'asc' ? <ChevronUp className="inline h-4 w-4" /> : <ChevronDown className="inline h-4 w-4" />)}
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:text-[#0046ab]" onClick={() => setSortConfig({ key: 'Organic followers', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>
                    Organic {sortConfig.key === 'Organic followers' && (sortConfig.direction === 'asc' ? <ChevronUp className="inline h-4 w-4" /> : <ChevronDown className="inline h-4 w-4" />)}
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:text-[#0046ab]" onClick={() => setSortConfig({ key: 'Sponsored followers', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>
                    Sponsored {sortConfig.key === 'Sponsored followers' && (sortConfig.direction === 'asc' ? <ChevronUp className="inline h-4 w-4" /> : <ChevronDown className="inline h-4 w-4" />)}
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:text-[#0046ab]" onClick={() => setSortConfig({ key: 'Auto-invited followers', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>
                    Auto-invited {sortConfig.key === 'Auto-invited followers' && (sortConfig.direction === 'asc' ? <ChevronUp className="inline h-4 w-4" /> : <ChevronDown className="inline h-4 w-4" />)}
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:text-[#0046ab]" onClick={() => setSortConfig({ key: 'Total followers', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>
                    Total {sortConfig.key === 'Total followers' && (sortConfig.direction === 'asc' ? <ChevronUp className="inline h-4 w-4" /> : <ChevronDown className="inline h-4 w-4" />)}
                  </TableHead>
                  <TableHead className="text-right">vs Avg</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.map((row, idx) => {
                  const diff = row['Total followers'] - avgTotal
                  return (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{row.Date}</TableCell>
                      <TableCell className="text-right">{row['Organic followers']}</TableCell>
                      <TableCell className="text-right">{row['Sponsored followers']}</TableCell>
                      <TableCell className="text-right">{row['Auto-invited followers']}</TableCell>
                      <TableCell className="text-right font-bold">{row['Total followers']}</TableCell>
                      <TableCell className="text-right">
                        <span className={`text-xs font-bold ${diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {diff >= 0 ? '+' : ''}{diff.toFixed(1)}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
              <tfoot className="bg-zinc-100 dark:bg-zinc-800/80 sticky bottom-0 z-10 font-bold">
                <TableRow>
                  <TableCell>AVERAGE</TableCell>
                  <TableCell className="text-right">{(data.reduce((a, c) => a + c['Organic followers'], 0) / data.length).toFixed(1)}</TableCell>
                  <TableCell className="text-right">{(data.reduce((a, c) => a + c['Sponsored followers'], 0) / data.length).toFixed(1)}</TableCell>
                  <TableCell className="text-right">{(data.reduce((a, c) => a + c['Auto-invited followers'], 0) / data.length).toFixed(1)}</TableCell>
                  <TableCell className="text-right">{avgTotal.toFixed(1)}</TableCell>
                  <TableCell className="text-right">-</TableCell>
                </TableRow>
              </tfoot>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}

function DistributionTab({ 
  data, 
  title, 
  column, 
  isDonut = false, 
  isPie = false, 
  isOrdered = false 
}: { 
  data: any[], 
  title: string, 
  column: string, 
  isDonut?: boolean,
  isPie?: boolean,
  isOrdered?: boolean
}) {
  const [searchTerm, setSearchTerm] = useState("")
  const total = useMemo(() => data.reduce((acc, curr) => acc + (curr['Total followers'] || 0), 0), [data])
  
  const processedData = useMemo(() => {
    let sorted = [...data].sort((a, b) => (b['Total followers'] || 0) - (a['Total followers'] || 0))
    
    if (isOrdered && title === "Company Size") {
      const order = ["1", "2-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5001-10000", "10001+"]
      sorted = [...data].sort((a, b) => {
        return order.indexOf(a[column]) - order.indexOf(b[column])
      })
    }

    return sorted.map((r, idx) => ({
      rank: idx + 1,
      label: r[column],
      value: r['Total followers'],
      percent: total > 0 ? ((r['Total followers'] / total) * 100).toFixed(1) : "0.0"
    }))
  }, [data, column, total, isOrdered, title])

  const chartData = useMemo(() => {
    let topItems = processedData
    if (title === "Location" || title === "Industry") {
      topItems = processedData.slice(0, 15)
    } else if (title === "Job Function") {
      const main = processedData.slice(0, 8)
      const others = processedData.slice(8).reduce((acc, curr) => acc + curr.value, 0)
      if (others > 0) {
        topItems = [...main, { label: 'Others', value: others, percent: ((others / total) * 100).toFixed(1), rank: 9 }]
      } else {
        topItems = main
      }
    }

    const colors = [
      '#0046ab', '#10b981', '#f59e0b', '#6366f1', 
      '#ec4899', '#f43f5e', '#8b5cf6', '#06b6d4',
      '#84cc16', '#71717a', '#a855f7', '#14b8a6',
      '#f97316', '#3b82f6', '#ef4444'
    ]

    return {
      labels: topItems.map(i => i.label),
      datasets: [{
        label: 'Followers',
        data: topItems.map(i => i.value),
        backgroundColor: colors.slice(0, topItems.length),
        borderWidth: 1
      }]
    }
  }, [processedData, title, total])

  const filteredTableData = processedData.filter(i => 
    i.label?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">{title} Breakdown</CardTitle>
            <CardDescription>
              {isDonut || isPie ? 'Proportional distribution' : `Top ${chartData.labels.length} ${title}s`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center min-h-[400px]">
            {isDonut || isPie ? (
              <div className="h-[350px] w-full">
                <Doughnut 
                  data={chartData} 
                  options={{
                    maintainAspectRatio: false,
                    cutout: isDonut ? '60%' : '0%',
                    plugins: {
                      legend: { position: 'right', labels: { boxWidth: 12, font: { size: 10 } } }
                    }
                  }} 
                />
              </div>
            ) : (
              <div className="h-[400px] w-full">
                <Bar 
                  data={chartData} 
                  options={{
                    indexAxis: 'y',
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { x: { beginAtZero: true } }
                  }} 
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm flex flex-col">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Data Table</CardTitle>
                <CardDescription>Full list of {title.toLowerCase()} data</CardDescription>
              </div>
              <div className="relative w-48">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                <Input 
                  placeholder="Search..." 
                  className="pl-9 h-9" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader className="bg-zinc-50 dark:bg-zinc-800 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="w-[60px]">Rank</TableHead>
                    <TableHead>{title}</TableHead>
                    <TableHead className="text-right">Followers</TableHead>
                    <TableHead className="text-right">% of Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTableData.map((item) => (
                    <TableRow key={item.label}>
                      <TableCell className="text-zinc-500 font-mono text-xs">{item.rank}</TableCell>
                      <TableCell className="font-medium">{item.label}</TableCell>
                      <TableCell className="text-right">{item.value.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="font-mono text-[#0046ab]">{item.percent}%</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
