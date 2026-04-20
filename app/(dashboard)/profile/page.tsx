"use client"

import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { User, Lock, Mail, Eye, EyeOff, Loader2, UserPlus, ShieldCheck } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createNewUserRecord } from "@/app/actions/user-actions"

export default function ProfilePage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [updatingProfile, setUpdatingProfile] = useState(false)
  const [updatingPassword, setUpdatingPassword] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isCreatingUser, setIsCreatingUser] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  
  const [profile, setProfile] = useState({
    firstName: "",
    lastName: "",
    email: ""
  })
  
  const [passwords, setPasswords] = useState({
    newPassword: "",
    confirmPassword: ""
  })
  
  const [newUser, setNewUser] = useState({
    email: "",
    role: "viewer" as "lead" | "viewer"
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

      // Fetch Profile
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

      // Fetch Role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("roles(name)")
        .eq("user_id", user.id)
        .single()

      if (roleData && (roleData as any).roles) {
        setUserRole((roleData as any).roles.name)
      }
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
          email: profile.email
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

  const handleCreateUser = async () => {
    if (!newUser.email) {
      toast.error("Please enter an email address")
      return
    }

    try {
      setIsCreatingUser(true)
      await createNewUserRecord(newUser.email, newUser.role)
      toast.success("User created successfully!")
      setIsCreateModalOpen(false)
      setNewUser({ email: "", role: "viewer" })
    } catch (error: any) {
      toast.error(error.message || "Failed to create user")
    } finally {
      setIsCreatingUser(false)
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
            User Profile
            {userRole === 'owner' && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider dark:bg-blue-900/30 dark:text-blue-400">
                <ShieldCheck className="h-3 w-3" />
                Owner
              </div>
            )}
          </h1>
          <p className="text-muted-foreground">Manage your account settings and profile information.</p>
        </div>

        {userRole === "owner" && (
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#0046ab] hover:bg-[#003d96] text-white gap-2 shadow-lg shadow-blue-500/10">
                <UserPlus className="h-4 w-4" />
                Add New User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-[#0046ab]" />
                  Create User Account
                </DialogTitle>
                <DialogDescription>
                  Register a new user to the TCDEX system.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="new-email">Email Address</Label>
                  <Input 
                    id="new-email" 
                    placeholder="user@example.com" 
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-password">Initial Password</Label>
                  <Input 
                    id="new-password" 
                    value="tcdexwebapp.123" 
                    readOnly 
                    className="bg-zinc-50 dark:bg-zinc-900 text-zinc-500 cursor-default"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-role">Role Membership</Label>
                  <Select 
                    value={newUser.role} 
                    onValueChange={(val: any) => setNewUser({ ...newUser, role: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  onClick={handleCreateUser} 
                  className="bg-[#0046ab] hover:bg-[#003d96] text-white w-full"
                  disabled={isCreatingUser}
                >
                  {isCreatingUser && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Create Account
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
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
