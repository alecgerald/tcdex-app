"use server"

import { createAdminClient } from "@/utils/supabase/admin"
import { createClient as createServerClient } from "@/utils/supabase/server"

export async function createNewUserRecord(email: string, roleName: 'lead' | 'viewer') {
  console.log("Starting createNewUserRecord for:", email, roleName)
  const supabaseAdmin = createAdminClient()
  const supabase = await createServerClient()

  try {
    // 1. Verify the requester is actually an 'owner'
    const { data: { user: requester }, error: userError } = await supabase.auth.getUser()
    if (userError) {
      console.error("Auth getUser error:", userError)
      return { success: false, error: "Authentication failed: " + userError.message }
    }
    if (!requester) {
      console.error("No requester found")
      return { success: false, error: "Not authenticated" }
    }

    console.log("Requester ID:", requester.id)

    const { data: requesterRole, error: requesterRoleError } = await supabase
      .from("user_roles")
      .select("roles(name)")
      .eq("user_id", requester.id)
      .single()

    if (requesterRoleError) {
      console.error("Error fetching requester role:", requesterRoleError)
      return { success: false, error: "Failed to verify permissions: " + requesterRoleError.message }
    }

    if (!requesterRole || (requesterRole as any).roles.name !== "owner") {
      console.error("Unauthorized: requester role is not owner")
      return { success: false, error: "Unauthorized: Only owners can create users" }
    }

    // 2. Create the user in Supabase Auth
    console.log("Creating user in Supabase Auth...")
    const defaultPassword = process.env.NEXT_PUBLIC_DEFAULT_USER_PASSWORD;
    
    if (!defaultPassword) {
      console.error("Missing NEXT_PUBLIC_DEFAULT_USER_PASSWORD environment variable")
      return { success: false, error: "System configuration error: Default password not set." }
    }
    
    const { data: newUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: defaultPassword,
      email_confirm: true 
    })

    if (authError) {
      console.error("Supabase Admin createUser error:", authError)
      return { success: false, error: authError.message }
    }
    if (!newUser.user) {
      console.error("User creation failed: no user returned")
      return { success: false, error: "User creation failed" }
    }

    console.log("New User Created ID:", newUser.user.id)

    // 3. Create/Update Profile record
    // Using upsert in case a database trigger already created a profile
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: newUser.user.id,
        email: email,
        first_name: "", 
        last_name: ""
      }, { onConflict: 'id' })

    if (profileError) {
      console.error("Profile creation/upsert error:", profileError)
      // We don't necessarily want to fail the whole process if only profile fails, 
      // but usually this indicates a database issue.
      return { success: false, error: "Account created but profile setup failed: " + profileError.message }
    }

    // 4. Assign Role
    const { data: roleData, error: roleIdError } = await supabaseAdmin
      .from("roles")
      .select("id")
      .eq("name", roleName)
      .single()

    if (roleIdError) {
      console.error("Role lookup error:", roleIdError)
      return { success: false, error: "Account created but role lookup failed: " + roleIdError.message }
    }

    // Using upsert for roles as well for robustness
    const { error: assignError } = await supabaseAdmin
      .from("user_roles")
      .upsert({
        user_id: newUser.user.id,
        role_id: roleData.id
      }, { onConflict: 'user_id' })

    if (assignError) {
      console.error("Role assignment error:", assignError)
      return { success: false, error: "Account created but role assignment failed: " + assignError.message }
    }

    console.log("User record created successfully")
    return { success: true, userId: newUser.user.id }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    console.error("Caught error in createNewUserRecord:", error)
    return { success: false, error: errorMessage }
  }
}
