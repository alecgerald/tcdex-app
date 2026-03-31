"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { toast } from "sonner"
import { Users, UserPlus, LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useRouter } from "next/navigation"

const formSchema = z.object({
  username: z.string().min(2, {
    message: "Username must be at least 2 characters.",
  }),
  password: z.string().min(6, {
    message: "Password must be at least 6 characters.",
  }),
})

export default function AdminPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      password: "tcdex.123",
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)
    
    setTimeout(() => {
      toast.success(`Account created for ${values.username}`)
      form.reset({
        username: "",
        password: "tcdex.123",
      })
      setIsLoading(false)
    }, 1500)
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <nav className="border-b bg-white dark:bg-zinc-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded bg-[#0046ab] flex items-center justify-center">
            <span className="text-white font-bold text-sm">T</span>
          </div>
          <span className="font-bold text-xl tracking-tight text-[#0046ab]">TCDEX Admin</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => router.push("/login")} className="text-zinc-500">
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </nav>

      <main className="max-w-5xl mx-auto p-6 lg:p-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">Dashboard</h1>
          <p className="text-zinc-500 dark:text-zinc-400">Manage internal company accounts.</p>
        </div>

        <Tabs defaultValue="create" className="space-y-6">
          <TabsList className="bg-white dark:bg-zinc-900 border shadow-sm p-1">
            <TabsTrigger value="create" className="data-[state=active]:bg-zinc-100 dark:data-[state=active]:bg-zinc-800">
              <UserPlus className="h-4 w-4 mr-2" />
              Create Account
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-zinc-100 dark:data-[state=active]:bg-zinc-800">
              <Users className="h-4 w-4 mr-2" />
              User List
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="border-none shadow-md">
                <CardHeader>
                  <CardTitle className="text-xl">Add New User</CardTitle>
                  <CardDescription>
                    Create a new internal account.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input placeholder="Employee username" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Default Password</FormLabel>
                            <FormControl>
                              <Input placeholder="••••••••" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button 
                        type="submit" 
                        className="w-full bg-[#0046ab] hover:bg-[#003a8f] text-white"
                        disabled={isLoading}
                      >
                        {isLoading ? "Creating..." : "Create Account"}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="border-none bg-[#0046ab]/5 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg text-[#0046ab]">Guidelines</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-zinc-600 space-y-3">
                    <p>• Usernames should follow the company format (e.g., first.last).</p>
                    <p>• Default password is set to <strong>tcdex.123</strong> for all new accounts.</p>
                    <p>• Users will be prompted to change their password on first login.</p>
                  </CardContent>
                </Card>
                
                <div className="grid grid-cols-1 gap-4">
                  <div className="bg-white p-4 rounded-xl border shadow-sm">
                    <p className="text-zinc-500 text-xs font-medium uppercase mb-1">Total Users</p>
                    <p className="text-2xl font-bold">124</p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="users">
            <Card className="border-none shadow-md">
              <CardHeader>
                <CardTitle>Internal Users</CardTitle>
                <CardDescription>View and manage all active employee accounts.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
                  <Users className="h-12 w-12 mb-4 opacity-20" />
                  <p>User directory integration in progress...</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
