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
  ChevronDown,
  BarChart3
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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
  contentPosts?: any[] // legacy
  contentDailyMetrics?: any[]
  contentPostMetrics?: any[]
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
          Please upload your LinkedIn export file to view the analytics dashboard.
        </p>
        <Link href="/comms/import-excel">
          <Button className="bg-[#0046ab] hover:bg-[#003a8f] text-white">
            Go to Import Page
          </Button>
        </Link>
      </div>
    )
  }

  const hasContentData = (data.contentDailyMetrics && data.contentDailyMetrics.length > 0) || (data.contentPosts && data.contentPosts.length > 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">LinkedIn Dashboard</h1>
          <p className="text-zinc-500 dark:text-zinc-400">LinkedIn Analytics & Insights</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Last Uploaded</p>
          <p className="text-sm font-medium">{new Date(data.uploadedAt).toLocaleString()}</p>
        </div>
      </div>

      <Tabs defaultValue={hasContentData ? "content-posts" : "followers"} className="space-y-6">
        <div className="flex items-center justify-between">
          <TabsList variant="line" className="h-auto p-0 bg-transparent border-b rounded-none w-full justify-start gap-6">
            <TabsTrigger value="content-posts" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#0046ab] data-[state=active]:bg-transparent pb-2 px-0">Content Posts</TabsTrigger>
            <TabsTrigger value="followers" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#0046ab] data-[state=active]:bg-transparent pb-2 px-0">Followers</TabsTrigger>
            <TabsTrigger value="visitors" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#0046ab] data-[state=active]:bg-transparent pb-2 px-0">Visitors</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="content-posts">
          {hasContentData ? (
            <ContentPostsView data={data} />
          ) : (
            <Card className="border-none shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-zinc-100 flex items-center justify-center dark:bg-zinc-800 text-[#0046ab]">
                  <FileSpreadsheet className="h-8 w-8" />
                </div>
                <div>
                  <CardTitle className="text-xl">No Content Posts Data</CardTitle>
                  <CardDescription>Please upload your LinkedIn Content Posts export file.</CardDescription>
                </div>
                <Link href="/comms/import-excel">
                  <Button variant="outline" className="mt-4">
                    Upload Content Posts
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="followers">
          <FollowersView data={data} />
        </TabsContent>

        <TabsContent value="visitors">
          <Card className="border-none shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-zinc-100 flex items-center justify-center dark:bg-zinc-800 text-indigo-500">
                <Users className="h-8 w-8" />
              </div>
              <div>
                <CardTitle className="text-xl">Visitors Analytics</CardTitle>
                <CardDescription>Understand who is visiting your LinkedIn profile/page.</CardDescription>
              </div>
              <Badge variant="secondary" className="px-4 py-1">Coming Soon</Badge>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ContentPostsView({ data }: { data: CommsData }) {
  const dailyMetrics = data.contentDailyMetrics || []
  const postMetrics = data.contentPostMetrics || data.contentPosts || []

  const stats = useMemo(() => {
    // Helper to extract numeric value from various possible header formats
    const getVal = (row: any, keys: string[]) => {
      for (const key of keys) {
        if (row[key] !== undefined) return Number(row[key]) || 0
      }
      // Try fuzzy match
      const entry = Object.entries(row).find(([k]) => keys.some(target => k.toLowerCase().includes(target.toLowerCase())))
      return entry ? Number(entry[1]) || 0 : 0
    }

    // KPI 1: Total Impressions (Formula is SUM(impressions_organic))
    // Prefer dailyMetrics for organic impressions if available
    let totalImpressions = 0
    if (dailyMetrics.length > 0) {
      totalImpressions = dailyMetrics.reduce((acc, curr) => acc + getVal(curr, ['Impressions (organic)', 'impressions_organic']), 0)
    } else {
      totalImpressions = postMetrics.reduce((acc, curr) => acc + getVal(curr, ['Impressions (organic)', 'Impressions', 'impressions_organic']), 0)
    }

    // KPI 3: Total clicks (SUM(clicks_organic))
    let totalClicks = 0
    if (dailyMetrics.length > 0) {
      totalClicks = dailyMetrics.reduce((acc, curr) => acc + getVal(curr, ['Clicks (organic)', 'clicks_organic']), 0)
    } else {
      totalClicks = postMetrics.reduce((acc, curr) => acc + getVal(curr, ['Clicks (organic)', 'Clicks', 'clicks_organic']), 0)
    }
    
    // KPI 4: Avg. engagement rate (AVG(engagement rate organic) * 100)
    let avgEngRate = 0
    if (dailyMetrics.length > 0) {
      avgEngRate = dailyMetrics.reduce((acc, curr) => acc + getVal(curr, ['Engagement rate (organic)', 'Engagement rate', 'engagement rate organic']), 0) / dailyMetrics.length
    } else if (postMetrics.length > 0) {
      avgEngRate = postMetrics.reduce((acc, curr) => acc + getVal(curr, ['Engagement rate (organic)', 'Engagement rate', 'engagement rate organic']), 0) / postMetrics.length
    }

    // KPI 2: Avg. daily impressions (SUM(impressions) / days in range)
    // Find date range
    const dates = (dailyMetrics.length > 0 ? dailyMetrics : postMetrics).map(p => {
      const d = p['Date'] || p['Created date']
      return d ? new Date(d).getTime() : null
    }).filter(t => t !== null) as number[]

    let daysInRange = 1
    if (dates.length > 0) {
      const minDate = Math.min(...dates)
      const maxDate = Math.max(...dates)
      daysInRange = Math.max(1, Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)) + 1)
    }
    const avgDailyImpressions = totalImpressions / daysInRange

    return {
      totalImpressions,
      totalClicks,
      avgEngRate: avgEngRate * 100,
      avgDailyImpressions
    }
  }, [dailyMetrics, postMetrics])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-[#0046ab]">
                <BarChart3 className="h-5 w-5" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-zinc-500 font-medium">Total Impressions</p>
              <h3 className="text-2xl font-bold">{stats?.totalImpressions.toLocaleString()}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-green-600">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-zinc-500 font-medium">Avg. Daily Impressions</p>
              <h3 className="text-2xl font-bold">{stats?.avgDailyImpressions.toLocaleString(undefined, { maximumFractionDigits: 1 })}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-amber-500">
                <MousePointer2 className="h-5 w-5" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-zinc-500 font-medium">Total Clicks</p>
              <h3 className="text-2xl font-bold">{stats?.totalClicks.toLocaleString()}</h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-indigo-500">
                <Zap className="h-5 w-5" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-zinc-500 font-medium">Avg. Engagement Rate</p>
              <h3 className="text-2xl font-bold">{stats?.avgEngRate.toFixed(2)}%</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Placeholder for table or more charts if needed */}
      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Recent Content Posts</CardTitle>
          <CardDescription>Detailed breakdown of your latest LinkedIn posts</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader className="bg-zinc-50 dark:bg-zinc-800 sticky top-0 z-10">
                <TableRow>
                  <TableHead>Post title</TableHead>
                  <TableHead className="text-right">Impressions</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">Likes</TableHead>
                  <TableHead className="text-right">Comments</TableHead>
                  <TableHead className="text-right">Engagement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {postMetrics.slice(0, 20).map((post, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium max-w-[300px] truncate">{post['Post title'] || post['Title'] || 'No Title'}</TableCell>
                    <TableCell className="text-right">{(post['Impressions (organic)'] || post['Impressions'] || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{(post['Clicks (organic)'] || post['Clicks'] || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{(post['Likes'] || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{(post['Comments'] || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      {((post['Engagement rate (organic)'] || post['Engagement rate'] || 0) * 100).toFixed(2)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}


function FollowersView({ data }: { data: CommsData }) {
  const [displayCategory, setDisplayCategory] = useState("daily")

  // KPI Calculations
  const stats = useMemo(() => {
    if (data.newFollowers.length === 0) return null
    
    const total = data.newFollowers.reduce((acc, curr) => acc + (curr['Total followers'] || 0), 0)
    const organic = data.newFollowers.reduce((acc, curr) => acc + (curr['Organic followers'] || 0), 0)
    const sponsored = data.newFollowers.reduce((acc, curr) => acc + (curr['Sponsored followers'] || 0), 0)
    const invited = data.newFollowers.reduce((acc, curr) => acc + (curr['Auto-invited followers'] || 0), 0)

    const mid = Math.floor(data.newFollowers.length / 2)
    const firstHalf = data.newFollowers.slice(0, mid)
    const secondHalf = data.newFollowers.slice(mid)

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
  }, [data.newFollowers])

  // Chart Data
  const lineChartData = {
    labels: data.newFollowers.map(r => r.Date),
    datasets: [
      {
        label: 'Total Followers',
        data: data.newFollowers.map(r => r['Total followers']),
        borderColor: '#0046ab',
        backgroundColor: '#0046ab20',
        fill: true,
        tension: 0.4
      },
      {
        label: 'Organic',
        data: data.newFollowers.map(r => r['Organic followers']),
        borderColor: '#10b981',
        backgroundColor: 'transparent',
        tension: 0.4
      },
      {
        label: 'Sponsored',
        data: data.newFollowers.map(r => r['Sponsored followers']),
        borderColor: '#f59e0b',
        backgroundColor: 'transparent',
        tension: 0.4
      }
    ]
  }

  // Weekly Grouping for Bar Chart
  const weeklyData = useMemo(() => {
    const weeks: Record<string, any> = {}
    data.newFollowers.forEach(r => {
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
  }, [data.newFollowers])

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

  // Table Sorting (for daily performance)
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'Date', direction: 'desc' })
  const avgTotal = stats ? stats.total / data.newFollowers.length : 0

  const sortedData = useMemo(() => {
    return [...data.newFollowers].sort((a, b) => {
      const aVal = a[sortConfig.key]
      const bVal = b[sortConfig.key]
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }, [data.newFollowers, sortConfig])

  // Insights
  const insights = useMemo(() => {
    if (data.newFollowers.length === 0) return null
    const peak = [...data.newFollowers].sort((a, b) => b['Total followers'] - a['Total followers'])[0]
    const lowest = [...data.newFollowers].sort((a, b) => a['Total followers'] - b['Total followers'])[0]
    
    const dayOfWeekTotals: Record<number, number> = {}
    data.newFollowers.forEach(r => {
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
      dailyAvg: (stats?.total || 0) / data.newFollowers.length,
      bestDayOfWeek: days[parseInt(bestDayIdx)],
      trend: (stats?.trends.total === 'up' ? 'Growing' : 'Declining')
    }
  }, [data.newFollowers, stats])

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Followers', value: stats?.total, icon: Users, trend: stats?.trends.total, color: 'text-[#0046ab]' },
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
            <CardTitle className="text-lg">Followers Over Time</CardTitle>
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

      {/* Dynamic Data Selection Card */}
      <Card className="border-none shadow-sm overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
          <div>
            <CardTitle className="text-xl font-bold">
              {displayCategory === 'daily' ? 'Daily Performance Data' : 
               displayCategory === 'location' ? 'Location Distribution' :
               displayCategory === 'job-function' ? 'Job Function Distribution' :
               displayCategory === 'seniority' ? 'Seniority Distribution' :
               displayCategory === 'industry' ? 'Industry Distribution' :
               'Company Size Distribution'}
            </CardTitle>
            <CardDescription>
              {displayCategory === 'daily' ? 'Detailed breakdown of daily follower metrics' : `Distribution of followers by ${displayCategory.replace('-', ' ')}`}
            </CardDescription>
          </div>
          <Select value={displayCategory} onValueChange={setDisplayCategory}>
            <SelectTrigger className="w-[200px] bg-white dark:bg-zinc-900">
              <SelectValue placeholder="Select Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily Performance</SelectItem>
              <SelectItem value="location">Location</SelectItem>
              <SelectItem value="job-function">Job Function</SelectItem>
              <SelectItem value="seniority">Seniority</SelectItem>
              <SelectItem value="industry">Industry</SelectItem>
              <SelectItem value="company-size">Company Size</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          {displayCategory === 'daily' ? (
            <ScrollArea className="h-[500px]">
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
                    <TableCell className="text-right">{(data.newFollowers.reduce((a, c) => a + c['Organic followers'], 0) / data.newFollowers.length).toFixed(1)}</TableCell>
                    <TableCell className="text-right">{(data.newFollowers.reduce((a, c) => a + c['Sponsored followers'], 0) / data.newFollowers.length).toFixed(1)}</TableCell>
                    <TableCell className="text-right">{(data.newFollowers.reduce((a, c) => a + c['Auto-invited followers'], 0) / data.newFollowers.length).toFixed(1)}</TableCell>
                    <TableCell className="text-right">{avgTotal.toFixed(1)}</TableCell>
                    <TableCell className="text-right">-</TableCell>
                  </TableRow>
                </tfoot>
              </Table>
            </ScrollArea>
          ) : (
            <div className="p-6">
              {displayCategory === 'location' && <DistributionContent data={data.location} title="Location" column="Location" />}
              {displayCategory === 'job-function' && <DistributionContent data={data.jobFunction} title="Job Function" column="Job function" isDonut={true} />}
              {displayCategory === 'seniority' && <DistributionContent data={data.seniority} title="Seniority" column="Seniority" isDonut={true} isPie={true} />}
              {displayCategory === 'industry' && <DistributionContent data={data.industry} title="Industry" column="Industry" />}
              {displayCategory === 'company-size' && <DistributionContent data={data.companySize} title="Company Size" column="Company size" isDonut={true} isOrdered={true} />}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function DistributionContent({ 
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Visual Distribution</h4>
          <Badge variant="outline">{chartData.labels.length} segments</Badge>
        </div>
        <div className="flex items-center justify-center min-h-[350px] bg-zinc-50/50 dark:bg-zinc-800/20 rounded-2xl p-4">
          {isDonut || isPie ? (
            <div className="h-[300px] w-full">
              <Doughnut 
                data={chartData} 
                options={{
                  maintainAspectRatio: false,
                  cutout: isDonut ? '65%' : '0%',
                  plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9 }, padding: 15 } }
                  }
                }} 
              />
            </div>
          ) : (
            <div className="h-[350px] w-full">
              <Bar 
                data={chartData} 
                options={{
                  indexAxis: 'y',
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: { 
                    x: { beginAtZero: true, grid: { display: false } },
                    y: { grid: { display: false } }
                  }
                }} 
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <div className="relative w-full max-w-[200px]">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-zinc-500" />
            <Input 
              placeholder="Filter..." 
              className="pl-8 h-8 text-xs bg-white dark:bg-zinc-900" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
          <p className="text-[10px] font-bold text-zinc-400 uppercase">Total: {total.toLocaleString()}</p>
        </div>
        <ScrollArea className="h-[350px] border rounded-xl bg-white dark:bg-zinc-900/50">
          <Table>
            <TableHeader className="bg-zinc-50 dark:bg-zinc-800 sticky top-0 z-10">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[50px] text-[10px] uppercase font-bold">Rank</TableHead>
                <TableHead className="text-[10px] uppercase font-bold">{title}</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-bold">Followers</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-bold">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTableData.map((item) => (
                <TableRow key={item.label} className="group">
                  <TableCell className="text-zinc-400 font-mono text-[10px] py-2">{item.rank}</TableCell>
                  <TableCell className="font-medium text-sm py-2">{item.label}</TableCell>
                  <TableCell className="text-right text-sm py-2">{item.value.toLocaleString()}</TableCell>
                  <TableCell className="text-right py-2">
                    <span className="text-xs font-mono font-bold text-[#0046ab] bg-[#0046ab10] px-1.5 py-0.5 rounded">
                      {item.percent}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    </div>
  )
}

