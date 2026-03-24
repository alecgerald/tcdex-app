"use client"

import { useState, useEffect, useMemo } from "react"
import { 
  Users, 
  BarChart3, 
  Zap, 
  Share2,
  TrendingUp,
  Globe,
  Facebook,
  Instagram,
  Linkedin,
  Trophy,
  Layout,
  ExternalLink,
  MessageSquare,
  ThumbsUp,
  ChevronRight,
  X,
  Calendar,
  Loader2,
  Heart,
  UserCheck,
  Megaphone,
  Briefcase,
  Play,
  Clock,
  PieChart,
  Check,
  FileText,
  Video,
  Image as ImageIcon,
  Layers,
  Search
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
import { Badge } from "@/components/ui/badge"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

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

const PLATFORMS = [
  { id: "LinkedIn", color: "#0046ab", icon: Linkedin },
  { id: "Facebook", color: "#1877F2", icon: Facebook },
  { id: "Instagram", color: "#E4405F", icon: Instagram },
  { id: "TikTok", color: "#000000", icon: Globe }
]

const POST_TYPES = [
  { id: "Video", icon: Video },
  { id: "Reel", icon: Play },
  { id: "Image", icon: ImageIcon },
  { id: "Article", icon: FileText },
  { id: "Carousel", icon: Layers }
]

const JOB_FUNCTION_DATA = [
  { label: "Operations", value: 1547 },
  { label: "Information Technology", value: 1272 },
  { label: "Engineering", value: 892 },
  { label: "Business Development", value: 844 },
  { label: "Administrative", value: 646 },
  { label: "Education", value: 631 },
  { label: "Customer Success and Support", value: 509 },
  { label: "Media and Communication", value: 460 },
  { label: "Human Resources", value: 401 },
  { label: "Research", value: 378 },
  { label: "Quality Assurance", value: 356 },
  { label: "Sales", value: 300 },
  { label: "Program and Project Management", value: 288 },
  { label: "Arts and Design", value: 280 },
  { label: "Finance", value: 276 },
  { label: "Healthcare Services", value: 251 },
  { label: "Marketing", value: 238 },
  { label: "Accounting", value: 208 },
  { label: "Community and Social Services", value: 103 },
  { label: "Legal", value: 89 },
  { label: "Consulting", value: 70 },
  { label: "Military and Protective Services", value: 56 },
  { label: "Purchasing", value: 56 },
  { label: "Entrepreneurship", value: 35 },
  { label: "Real Estate", value: 31 },
  { label: "Product Management", value: 16 }
]

export default function ExternalBrandPage() {
  const [demographicType, setDemographicType] = useState<"followers" | "visitors">("followers")
  const [demographicTab, setDemographicTab] = useState<"seniority" | "function">("seniority")
  const [selectedPost, setSelectedPost] = useState<any | null>(null)
  
  // Filters State
  const [startDate, setStartDate] = useState("2024-01-01")
  const [endDate, setEndDate] = useState("2024-06-30")
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(PLATFORMS.map(p => p.id))
  const [selectedPostTypes, setSelectedPostTypes] = useState<string[]>(POST_TYPES.map(t => t.id))
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Simulation of "Recalculating"
  useEffect(() => {
    setIsRefreshing(true)
    const timer = setTimeout(() => setIsRefreshing(false), 600)
    return () => clearTimeout(timer)
  }, [startDate, endDate, selectedPlatforms, selectedPostTypes])

  const togglePlatform = (id: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  const togglePostType = (id: string) => {
    setSelectedPostTypes(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    )
  }

  // Base Data for simulation
  const allPosts = useMemo(() => [
    { id: 1, date: "2024-06-15", platform: "TikTok", type: "Video", caption: "Day in the life of a software engineer at TCDEX! #LifeAtTCDEX #Tech", impressions: 125000, likes: 12400, shares: 3200, saves: 1500, engRate: 13.68, monthIdx: 5 },
    { id: 2, date: "2024-06-12", platform: "Instagram", type: "Reel", caption: "Our summer internship program is now open! Apply now at tcdex.com/careers", impressions: 85000, likes: 6200, shares: 1200, saves: 900, engRate: 9.76, monthIdx: 5 },
    { id: 3, date: "2024-06-10", platform: "LinkedIn", type: "Image", caption: "Proud to be named one of the Top 10 Best Places to Work in 2024! 🏆", impressions: 210000, likes: 8400, shares: 1100, saves: 450, engRate: 4.74, monthIdx: 5 },
    { id: 4, date: "2024-06-08", platform: "LinkedIn", type: "Article", caption: "How we're scaling our infrastructure to support 10M+ users.", impressions: 150000, likes: 4200, shares: 850, saves: 1200, engRate: 4.17, monthIdx: 5 },
    { id: 5, date: "2024-06-05", platform: "TikTok", type: "Video", caption: "Office tour! 🏢 Which floor is your favorite? #TCDEX #OfficeTour", impressions: 98000, likes: 7200, shares: 1500, saves: 600, engRate: 9.49, monthIdx: 5 },
    { id: 6, date: "2024-05-28", platform: "Instagram", type: "Image", caption: "Team outing at the beach! 🏖️ Work hard, play hard.", impressions: 45000, likes: 3800, shares: 150, saves: 80, engRate: 8.96, monthIdx: 4 },
    { id: 7, date: "2024-05-15", platform: "Facebook", type: "Video", caption: "Join us for our next community town hall on June 15th.", impressions: 32000, likes: 1100, shares: 240, saves: 50, engRate: 4.34, monthIdx: 4 },
    { id: 8, date: "2024-05-10", platform: "LinkedIn", type: "Video", caption: "Introducing our new CEO, Sarah Jenkins!", impressions: 185000, likes: 5900, shares: 620, saves: 120, engRate: 3.59, monthIdx: 4 },
    { id: 9, date: "2024-04-25", platform: "Instagram", type: "Carousel", caption: "5 tips for acing your technical interview at TCDEX. 💡", impressions: 62000, likes: 4100, shares: 890, saves: 1400, engRate: 10.31, monthIdx: 3 },
    { id: 10, date: "2024-04-20", platform: "TikTok", type: "Video", caption: "Working late? Here's our favorite late-night snacks. 🍕", impressions: 74000, likes: 5800, shares: 920, saves: 310, engRate: 9.49, monthIdx: 3 },
  ], [])

  // Filtered Posts based on BOTH Platform and Post Type
  const filteredPosts = useMemo(() => {
    return allPosts.filter(p => 
      selectedPlatforms.includes(p.platform) && 
      selectedPostTypes.includes(p.type)
    )
  }, [allPosts, selectedPlatforms, selectedPostTypes])

  // Filtered Data Calculations for KPIs
  const filteredKpis = useMemo(() => {
    const impressions = filteredPosts.reduce((acc, curr) => acc + curr.impressions, 0)
    const shares = filteredPosts.reduce((acc, curr) => acc + curr.shares + curr.saves, 0)
    const avgER = filteredPosts.length > 0 
      ? (filteredPosts.reduce((acc, curr) => acc + curr.engRate, 0) / filteredPosts.length).toFixed(2) 
      : "0.00"
    
    const platformFollowers: Record<string, number> = { LinkedIn: 20100, Facebook: 9500, Instagram: 11500, TikTok: 10800 }
    const totalFollowers = selectedPlatforms.reduce((acc, curr) => acc + (platformFollowers[curr] || 0), 0)

    return [
      { label: "Total Followers", value: totalFollowers.toLocaleString(), icon: Users, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
      { label: "Total Impressions", value: (impressions / 1000).toFixed(0) + "k", icon: BarChart3, color: "text-[#0046ab]", bg: "bg-zinc-50 dark:bg-zinc-800" },
      { label: "Avg. Engagement Rate", value: avgER + "%", icon: Zap, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20" },
      { label: "Shares + Saves", value: shares.toLocaleString(), icon: Share2, color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20" }
    ]
  }, [filteredPosts, selectedPlatforms])

  // Content Performance Charts
  const impressionsTrendData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
    const datasets = selectedPlatforms.map(platform => {
      const platformColor = PLATFORMS.find(p => p.id === platform)?.color || "#ccc"
      const data = months.map((_, mIdx) => {
        return filteredPosts
          .filter(p => p.platform === platform && p.monthIdx === mIdx)
          .reduce((acc, curr) => acc + curr.impressions, 0) || (Math.random() * 5000 * selectedPostTypes.length)
      })
      return { label: platform, data, backgroundColor: platformColor + "90", fill: true }
    })
    return { labels: months, datasets }
  }, [selectedPlatforms, selectedPostTypes, filteredPosts])

  const engagementRateData = useMemo(() => {
    const datasets = [{
      label: "Avg. Engagement Rate",
      data: selectedPlatforms.map(platform => {
        const posts = filteredPosts.filter(p => p.platform === platform)
        return posts.length > 0 ? (posts.reduce((acc, curr) => acc + curr.engRate, 0) / posts.length) : 0
      }),
      backgroundColor: selectedPlatforms.map(p => PLATFORMS.find(item => item.id === p)?.color || "#ccc"),
      borderRadius: 4,
    }]
    return { labels: selectedPlatforms, datasets }
  }, [selectedPlatforms, filteredPosts])

  // Audience Growth Charts
  const growthData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
    return {
      labels: months,
      datasets: [
        { id: "LinkedIn", label: "LinkedIn", data: [12000, 13500, 15000, 16800, 18500, 20100], borderColor: "#0046ab", backgroundColor: "#0046ab20", fill: true, tension: 0.4 },
        { id: "Facebook", label: "Facebook", data: [8000, 8200, 8500, 8900, 9200, 9500], borderColor: "#1877F2", backgroundColor: "transparent", tension: 0.4 },
        { id: "Instagram", label: "Instagram", data: [5000, 5800, 6900, 8200, 9800, 11500], borderColor: "#E4405F", backgroundColor: "transparent", tension: 0.4 },
        { id: "TikTok", label: "TikTok", data: [2000, 3100, 4500, 6200, 8400, 10800], borderColor: "#000000", backgroundColor: "transparent", tension: 0.4 }
      ].filter(ds => selectedPlatforms.includes(ds.id))
    }
  }, [selectedPlatforms])

  // Seniority Breakdown Data
  const seniorityData = useMemo(() => ({
    labels: ["Entry", "Senior", "Manager", "Director", "VP/Exec"],
    datasets: [{
      data: demographicType === "followers" ? [30, 25, 20, 15, 10] : [40, 30, 15, 10, 5],
      backgroundColor: ["#0046ab", "#10b981", "#f59e0b", "#6366f1", "#ec4899"],
      borderWidth: 0, cutout: "70%"
    }]
  }), [demographicType])

  // Job Function Chart Data
  const functionChartData = useMemo(() => {
    const topItems = JOB_FUNCTION_DATA.slice(0, 10)
    const total = JOB_FUNCTION_DATA.reduce((acc, curr) => acc + curr.value, 0)
    
    return {
      labels: topItems.map(i => i.label),
      datasets: [{
        data: topItems.map(i => i.value),
        backgroundColor: [
          "#0046ab", "#10b981", "#f59e0b", "#6366f1", "#ec4899",
          "#f43f5e", "#8b5cf6", "#06b6d4", "#84cc16", "#71717a"
        ],
        borderWidth: 0,
        cutout: "70%"
      }]
    }
  }, [])

  const getPlatformIcon = (platform: string) => {
    const p = PLATFORMS.find(item => item.id === platform)
    if (!p) return <Globe className="h-4 w-4" />
    const Icon = p.icon
    return <Icon className="h-4 w-4" style={{ color: p.color }} />
  }

  return (
    <div className="space-y-6 relative overflow-hidden">
      {/* Filters Bar */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 bg-white dark:bg-zinc-900 p-6 rounded-2xl border shadow-sm">
        <div className="space-y-6 flex-1">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">External Brand Analytics</h1>
            <p className="text-sm text-zinc-500 font-medium">Portfolio Performance Dashboard</p>
          </div>

          <div className="flex flex-wrap items-center gap-8">
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-1">Social Platforms</p>
              <div className="flex items-center gap-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => togglePlatform(p.id)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold transition-all",
                      selectedPlatforms.includes(p.id) 
                        ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white" 
                        : "bg-transparent text-zinc-500 border-zinc-200 hover:border-zinc-400 shadow-sm"
                    )}
                  >
                    <p.icon className="h-3 w-3" />
                    {p.id}
                    {selectedPlatforms.includes(p.id) && <Check className="h-3 w-3 ml-1" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-1">Content Format</p>
              <div className="flex items-center gap-2">
                {POST_TYPES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => togglePostType(t.id)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold transition-all",
                      selectedPostTypes.includes(t.id) 
                        ? "bg-[#0046ab] text-white border-[#0046ab]" 
                        : "bg-transparent text-zinc-500 border-zinc-200 hover:border-zinc-400 shadow-sm"
                    )}
                  >
                    <t.icon className="h-3 w-3" />
                    {t.id}
                    {selectedPostTypes.includes(t.id) && <Check className="h-3 w-3 ml-1" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3 shrink-0">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-1">Report Period</p>
          <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800 p-1.5 rounded-xl border shadow-inner">
            <Input type="date" className="h-8 w-[130px] text-xs border-none bg-transparent focus-visible:ring-0" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <span className="text-zinc-400">-</span>
            <Input type="date" className="h-8 w-[130px] text-xs border-none bg-transparent focus-visible:ring-0" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
      </div>

      {isRefreshing ? (
        <div className="flex flex-col items-center justify-center py-40 animate-pulse">
          <Loader2 className="h-10 w-10 animate-spin text-[#0046ab] mb-4" />
          <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Synthesizing Reports...</p>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in duration-500">
          {/* KPI Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredKpis.map((kpi, index) => (
              <Card key={index} className="border-none shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className={`p-2 rounded-lg ${kpi.bg} ${kpi.color}`}><kpi.icon className="h-5 w-5" /></div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-zinc-500 font-medium">{kpi.label}</p>
                    <h3 className="text-2xl font-bold tracking-tight">{kpi.value}</h3>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Content Performance Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-2"><Layout className="h-5 w-5 text-[#0046ab]" /><h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Content Performance</h2></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 border-none shadow-sm">
                <CardHeader><CardTitle className="text-lg">Impressions Trend</CardTitle><CardDescription>Earned visibility by platform (Filtered by Post Type)</CardDescription></CardHeader>
                <CardContent><div className="h-[350px]"><Line data={impressionsTrendData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true } }, tooltip: { mode: 'index', intersect: false } }, scales: { y: { stacked: true, beginAtZero: true, grid: { color: "#f0f0f0" } }, x: { grid: { display: false } } }, elements: { point: { radius: 0 } } }} /></div></CardContent>
              </Card>
              <Card className="border-none shadow-sm">
                <CardHeader><CardTitle className="text-lg">ER vs Benchmark</CardTitle><CardDescription>Avg. ER for selected platforms & formats</CardDescription></CardHeader>
                <CardContent>
                  <div className="h-[350px]">
                    <Bar 
                      data={engagementRateData} 
                      options={{ indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, max: 15, grid: { color: "#f0f0f0" } }, y: { grid: { display: false } } } }} 
                      plugins={[{
                        id: 'benchmarkLine',
                        afterDraw: (chart) => {
                          const { ctx, chartArea: { top, bottom }, scales: { x } } = chart
                          const xPos = x.getPixelForValue(2)
                          ctx.save(); ctx.beginPath(); ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.strokeStyle = '#ef4444';
                          ctx.moveTo(xPos, top); ctx.lineTo(xPos, bottom); ctx.stroke(); ctx.restore();
                        }
                      }]}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-none shadow-sm">
              <CardHeader><CardTitle className="text-lg">Top 10 Posts (Filtered)</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-zinc-50 dark:bg-zinc-800">
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>Format</TableHead>
                      <TableHead className="max-w-[200px]">Caption</TableHead>
                      <TableHead className="text-right font-bold text-[#0046ab]">Eng. Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPosts.length > 0 ? filteredPosts.slice(0, 10).map((post) => (
                      <TableRow key={post.id} className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50" onClick={() => setSelectedPost(post)}>
                        <TableCell className="text-xs text-zinc-500">{post.date}</TableCell>
                        <TableCell><div className="flex items-center gap-2">{getPlatformIcon(post.platform)}<span className="text-xs font-bold">{post.platform}</span></div></TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px] font-bold">{post.type}</Badge></TableCell>
                        <TableCell className="text-sm truncate max-w-[200px]">{post.caption}</TableCell>
                        <TableCell className="text-right font-bold text-[#0046ab]">{post.engRate}%</TableCell>
                      </TableRow>
                    )) : (
                      <TableRow><TableCell colSpan={5} className="text-center py-10 text-zinc-400">No content matches selected filters</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* TikTok Panel */}
          {selectedPlatforms.includes("TikTok") && selectedPostTypes.some(t => ["Video", "Reel"].includes(t)) && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-black flex items-center justify-center"><Globe className="h-3.5 w-3.5 text-white" /></div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">TikTok Insights</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-none shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-bold uppercase text-zinc-500">Avg. Watch Time</CardTitle></CardHeader>
                  <CardContent><div className="flex items-baseline gap-2"><h3 className="text-3xl font-bold">14.2s</h3><Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">+2.4s</Badge></div></CardContent>
                </Card>
                <Card className="border-none shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-bold uppercase text-zinc-500">Completion Rate</CardTitle></CardHeader>
                  <CardContent><div className="flex items-baseline gap-2"><h3 className="text-3xl font-bold">32.8%</h3><Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none">Top 10%</Badge></div></CardContent>
                </Card>
                <Card className="border-none shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-bold uppercase text-zinc-500">Traffic Source</CardTitle></CardHeader>
                  <CardContent><div className="space-y-2">{[{ label: "For You", val: 82, color: "bg-[#0046ab]" }, { label: "Profile", val: 12, color: "bg-zinc-400" }, { label: "Other", val: 6, color: "bg-zinc-200" }].map(t => (<div key={t.label} className="space-y-1"><div className="flex justify-between text-[10px] font-bold"><span>{t.label}</span><span>{t.val}%</span></div><div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden"><div className={cn("h-full", t.color)} style={{ width: `${t.val}%` }} /></div></div>)) }</div></CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Audience Growth Section */}
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2"><Globe className="h-5 w-5 text-[#0046ab]" /><h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Audience Growth Platforms</h2></div>
              <Tabs value={demographicType} onValueChange={(v) => setDemographicType(v as any)} className="w-auto">
                <TabsList><TabsTrigger value="followers">Followers</TabsTrigger><TabsTrigger value="visitors">Visitors</TabsTrigger></TabsList>
              </Tabs>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-none shadow-sm">
                <CardHeader><CardTitle className="text-lg">Follower Growth by Platform</CardTitle><CardDescription>Account-level metrics (Post Type filter does not apply)</CardDescription></CardHeader>
                <CardContent><div className="h-[300px]"><Line data={growthData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } }} /></div></CardContent>
              </Card>

              {/* Enhanced Demographics Breakdown with Tabs */}
              <Card className="border-none shadow-sm overflow-hidden flex flex-col">
                <CardHeader className="pb-0">
                  <div className="flex items-center justify-between mb-4">
                    <CardTitle className="text-lg">Demographics Breakdown</CardTitle>
                    <Tabs value={demographicTab} onValueChange={(v) => setDemographicTab(v as any)}>
                      <TabsList className="h-8 bg-zinc-100 dark:bg-zinc-800">
                        <TabsTrigger value="seniority" className="text-[10px] uppercase font-bold px-3">Seniority</TabsTrigger>
                        <TabsTrigger value="function" className="text-[10px] uppercase font-bold px-3">Job Function</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <Tabs value={demographicTab} className="h-full">
                    <TabsContent value="seniority" className="mt-0 h-full flex flex-col sm:flex-row items-center gap-8 py-4 animate-in fade-in duration-300">
                      <div className="h-[200px] w-[200px] shrink-0 relative">
                        <Doughnut data={seniorityData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
                        <div className="absolute inset-0 flex items-center justify-center flex-col">
                          <p className="text-lg font-bold">100%</p>
                          <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-tighter">Seniority</p>
                        </div>
                      </div>
                      <div className="space-y-2 flex-1 w-full overflow-y-auto pr-2">
                        {seniorityData.labels.map((l, i) => (
                          <div key={l} className="flex items-center justify-between text-xs py-1 border-b border-zinc-50 last:border-0">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: seniorityData.datasets[0].backgroundColor[i] }} />
                              <span className="font-medium text-zinc-600 dark:text-zinc-400">{l}</span>
                            </div>
                            <span className="font-bold text-zinc-900 dark:text-zinc-100">{seniorityData.datasets[0].data[i]}%</span>
                          </div>
                        ))}
                      </div>
                    </TabsContent>

                    <TabsContent value="function" className="mt-0 h-full flex flex-col sm:flex-row items-center gap-8 py-4 animate-in fade-in duration-300">
                      <div className="h-[200px] w-[200px] shrink-0 relative">
                        <Doughnut data={functionChartData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
                        <div className="absolute inset-0 flex items-center justify-center flex-col">
                          <p className="text-lg font-bold">Top 10</p>
                          <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-tighter">Functions</p>
                        </div>
                      </div>
                      <ScrollArea className="flex-1 w-full h-[250px] pr-4">
                        <div className="space-y-1.5">
                          {JOB_FUNCTION_DATA.map((item, i) => {
                            const total = JOB_FUNCTION_DATA.reduce((acc, curr) => acc + curr.value, 0)
                            const percentage = ((item.value / total) * 100).toFixed(1)
                            return (
                              <div key={item.label} className="group">
                                <div className="flex items-center justify-between text-[11px] mb-1">
                                  <span className="font-medium text-zinc-600 dark:text-zinc-400 truncate max-w-[180px]">{item.label}</span>
                                  <span className="font-bold text-zinc-900 dark:text-zinc-100">{item.value.toLocaleString()}</span>
                                </div>
                                <div className="h-1.5 w-full bg-zinc-50 dark:bg-zinc-800 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-[#0046ab] opacity-80 group-hover:opacity-100 transition-opacity" 
                                    style={{ width: `${(item.value / JOB_FUNCTION_DATA[0].value) * 100}%` }} 
                                  />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Drawer */}
      {selectedPost && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setSelectedPost(null)} />
          <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-3">{getPlatformIcon(selectedPost.platform)}<div><h3 className="font-bold">Post Details</h3><p className="text-xs text-zinc-500">{selectedPost.date}</p></div></div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedPost(null)}><X className="h-5 w-5" /></Button>
            </div>
            <ScrollArea className="flex-1 p-6">
              <div className="space-y-6">
                <div className="aspect-video rounded-xl bg-zinc-100 flex items-center justify-center border border-dashed border-zinc-300"><p className="text-sm text-zinc-400 font-medium">{selectedPost.type} Content Preview</p></div>
                <div className="p-4 bg-zinc-50 rounded-xl border"><p className="text-sm italic">"{selectedPost.caption}"</p></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border bg-white space-y-1"><p className="text-[10px] text-zinc-500 font-bold uppercase">Impressions</p><p className="text-xl font-bold">{selectedPost.impressions?.toLocaleString()}</p></div>
                  <div className="p-4 rounded-xl border bg-white space-y-1"><p className="text-[10px] text-zinc-500 font-bold uppercase">Eng. Rate</p><p className="text-xl font-bold text-[#0046ab]">{selectedPost.engRate}%</p></div>
                </div>
                <Button className="w-full bg-[#0046ab] text-white gap-2"><ExternalLink className="h-4 w-4" />View Original Post</Button>
              </div>
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  )
}
