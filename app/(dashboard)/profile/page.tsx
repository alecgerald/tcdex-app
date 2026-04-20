"use client"

import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { User, Lock, Mail, Eye, EyeOff, Loader2 } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"

export default function ProfilePage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [updatingProfile, setUpdatingProfile] = useState(false)
  const [updatingPassword, setUpdatingPassword] = useState(false)
  
  const [profile, setProfile] = useState({
    firstName: "",
    lastName: "",
    email: ""
  })
  
  const [passwords, setPasswords] = useState({
    newPassword: "",
    confirmPassword: ""
  })
  
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) return

      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("id", user.id)
        .single()

      if (error) throw error

      setProfile({
        firstName: data.first_name || "",
        lastName: data.last_name || "",
        email: data.email || user.email || ""
      })
    } catch (error: any) {
      toast.error("Error fetching profile: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    try {
      setUpdatingProfile(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: profile.firstName,
          last_name: profile.lastName,
          email: profile.email // Though it's read-only in UI, we update it if it changed elsewhere
        })
        .eq("id", user.id)

      if (error) throw error
      toast.success("Profile updated successfully")
    } catch (error: any) {
      toast.error("Error updating profile: " + error.message)
    } finally {
      setUpdatingProfile(false)
    }
  }

  const handleUpdatePassword = async () => {
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast.error("Passwords do not match")
      return
    }

    if (passwords.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters")
      return
    }

    try {
      setUpdatingPassword(true)
      const { error } = await supabase.auth.updateUser({
        password: passwords.newPassword
      })

      if (error) throw error
      
      toast.success("Password updated successfully")
      setPasswords({ newPassword: "", confirmPassword: "" })
    } catch (error: any) {
      toast.error("Error updating password: " + error.message)
    } finally {
      setUpdatingPassword(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#0046ab]" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">User Profile</h1>
        <p className="text-muted-foreground">Manage your account settings and profile information.</p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Profile Information */}
        <Card className="shadow-smooth border-none bg-white/50 backdrop-blur-sm dark:bg-zinc-900/50">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-blue-100 rounded-lg dark:bg-blue-900/30">
                <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle>Personal Information</CardTitle>
            </div>
            <CardDescription>
              Update your personal details below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input 
                id="firstName" 
                value={profile.firstName} 
                onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} 
                className="bg-white/80 dark:bg-zinc-800/80"
                placeholder="Enter your first name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input 
                id="lastName" 
                value={profile.lastName} 
                onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                className="bg-white/80 dark:bg-zinc-800/80"
                placeholder="Enter your last name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <Input 
                  id="email" 
                  type="email" 
                  value={profile.email} 
                  readOnly
                  className="pl-10 bg-white/80 dark:bg-zinc-800/80 cursor-default focus-visible:ring-0"
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="pt-2">
            <Button 
              onClick={handleSaveProfile} 
              disabled={updatingProfile}
              className="bg-[#0046ab] hover:bg-[#003d96] text-white gap-2"
            >
              {updatingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </CardFooter>
        </Card>

        {/* Change Password */}
        <Card className="shadow-smooth border-none bg-white/50 backdrop-blur-sm dark:bg-zinc-900/50">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-amber-100 rounded-lg dark:bg-amber-900/30">
                <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <CardTitle>Security</CardTitle>
            </div>
            <CardDescription>
              Set a new password for your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input 
                  id="newPassword" 
                  type={showNewPassword ? "text" : "password"} 
                  value={passwords.newPassword}
                  onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                  placeholder="••••••••"
                  className="bg-white/80 dark:bg-zinc-800/80 pr-10"
                />
                <button 
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">Retype New Password</Label>
              <div className="relative">
                <Input 
                  id="confirmPassword" 
                  type={showConfirmPassword ? "text" : "password"} 
                  value={passwords.confirmPassword}
                  onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                  placeholder="••••••••"
                  className="bg-white/80 dark:bg-zinc-800/80 pr-10"
                />
                <button 
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="pt-2">
            <Button 
              variant="outline" 
              onClick={handleUpdatePassword}
              disabled={updatingPassword}
              className="border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900/50 dark:text-amber-400 dark:hover:bg-amber-900/20 gap-2"
            >
              {updatingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
              Update Password
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
