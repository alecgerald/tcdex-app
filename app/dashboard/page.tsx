import Link from "next/link";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  GraduationCap, 
  Users, 
  Target, 
  BarChart3, 
  ArrowRight
} from "lucide-react";

const modules = [
  {
    title: "Leadership & Development",
    description: "Manage leadership assessments, track competency growth, and view executive insights.",
    href: "/leadership",
    icon: GraduationCap,
    color: "text-blue-600",
    bg: "bg-blue-100 dark:bg-blue-900/20",
    features: ["Excel Assessment Upload", "Competency Dashboard", "Executive Analytics"]
  },
  {
    title: "Academy LMS",
    description: "Track course completions, monitor learning progress, and analyze training data.",
    href: "/lms",
    icon: Target,
    color: "text-green-600",
    bg: "bg-green-100 dark:bg-green-900/20",
    features: ["LMS Data Import", "Status Distribution", "Manager Reports"]
  },
  {
    title: "ERG Dashboard",
    description: "Employee Resource Group analytics and engagement tracking.",
    href: "#",
    icon: Users,
    color: "text-purple-600",
    bg: "bg-purple-100 dark:bg-purple-900/20",
    features: ["Engagement Metrics", "Event Tracking", "Diversity Analytics"],
    disabled: true
  },
  {
    title: "Performance Analytics",
    description: "Advanced analytics for employee performance and appraisal cycles.",
    href: "#",
    icon: BarChart3,
    color: "text-orange-600",
    bg: "bg-orange-100 dark:bg-orange-900/20",
    features: ["Appraisal Insights", "Skill Mapping", "Team Comparison"],
    disabled: true
  }
];

export default function DashboardPage() {
  return (
    <div className="container py-10 space-y-8">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Main Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back. Select a module to manage your data and view insights.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        {modules.map((module) => (
          <Card key={module.title} className="flex flex-col h-full shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center gap-4 space-y-0">
              <div className={`p-3 rounded-lg ${module.bg}`}>
                <module.icon className={`h-6 w-6 ${module.color}`} />
              </div>
              <div className="flex flex-col">
                <CardTitle className="text-xl">{module.title}</CardTitle>
                <CardDescription className="mt-1 line-clamp-2">
                  {module.description}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex-grow">
              <ul className="grid grid-cols-1 gap-2 text-sm text-muted-foreground">
                {module.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full group" variant={module.disabled ? "secondary" : "default"} disabled={module.disabled}>
                {module.disabled ? (
                  <span>Coming Soon</span>
                ) : (
                  <Link href={module.href} className="flex items-center justify-center gap-2">
                    Launch Module
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                )}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
