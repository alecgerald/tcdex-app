"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Eye, Play, Instagram as InstagramIcon, Facebook } from "lucide-react"

interface ImportData {
  id: string
  fileName: string
  uploadedAt: string
  type: string
  rows: any[]
}

export default function ExternalBrandPage() {
  const [facebookVisits, setFacebookVisits] = useState<number>(0)
  const [instagramViews, setInstagramViews] = useState<number>(0)
  const [tiktokViews, setTiktokViews] = useState<number>(0)
  const [linkedinImpressions, setLinkedinImpressions] = useState<number>(0)

  useEffect(() => {
    // Load Facebook Visits
    const fbDataStr = localStorage.getItem("comms_facebook_visits_data")
    if (fbDataStr) {
      try {
        const fbData: ImportData = JSON.parse(fbDataStr)
        if (fbData.rows && fbData.rows.length > 0) {
          const total = fbData.rows.reduce((sum, row) => {
            const val = parseFloat(row.Primary || row.primary || 0)
            return sum + (isNaN(val) ? 0 : val)
          }, 0)
          setFacebookVisits(total)
        }
      } catch (e) {
        console.error("Failed to parse Facebook data", e)
      }
    } else {
      setFacebookVisits(0)
    }

    // Load Instagram Views
    const igDataStr = localStorage.getItem("comms_instagram_views_data")
    if (igDataStr) {
      try {
        const igData: ImportData = JSON.parse(igDataStr)
        if (igData.rows && igData.rows.length > 0) {
          const total = igData.rows.reduce((sum, row) => {
            const val = parseFloat(row.Primary || row.primary || 0)
            return sum + (isNaN(val) ? 0 : val)
          }, 0)
          setInstagramViews(total)
        }
      } catch (e) {
        console.error("Failed to parse Instagram data", e)
      }
    } else {
      setInstagramViews(0)
    }

    // Load other data types similarly if they exist
  }, [])

  const kpis = [
    {
      title: "Facebook Visits",
      value: facebookVisits.toLocaleString(),
      description: "Total page visits from upload",
      icon: Facebook,
      color: "text-blue-600",
    },
    {
      title: "LinkedIn Impressions",
      value: linkedinImpressions.toLocaleString(),
      description: "Total post impressions",
      icon: Eye,
      color: "text-blue-700",
    },
    {
      title: "Tiktok Video Views",
      value: tiktokViews.toLocaleString(),
      description: "Total video views",
      icon: Play,
      color: "text-zinc-900 dark:text-zinc-100",
    },
    {
      title: "Instagram Views",
      value: instagramViews.toLocaleString(),
      description: "Total profile views",
      icon: InstagramIcon,
      color: "text-pink-600",
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">External Brand</h2>
        <p className="text-muted-foreground">
          Overview of social media performance metrics pulled from imported data.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title}>
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
    </div>
  )
}
