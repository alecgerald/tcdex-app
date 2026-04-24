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
      return { success: false, error: "System configuration error: Default password not set." }
    }
    
    let userId: string | undefined;

    const { data: newUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: defaultPassword,
      email_confirm: true 
    })

    if (authError) {
      // If user already exists, we "repair" by proceeding to update profile/role
      if (authError.message.includes("already registered") || authError.status === 422) {
        console.log("User already exists, proceeding to update profile and role.")
        // Attempt to find the existing user ID
        const { data: existingUser } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("email", email)
          .single()
        
        if (existingUser) {
          userId = existingUser.id;
        } else {
          // If not in profiles, we can't safely proceed without the ID from auth
          return { success: false, error: "User exists but profile record was not found." }
        }
      } else {
        console.error("Supabase Admin createUser error:", authError)
        return { success: false, error: authError.message }
      }
    } else {
      userId = newUser.user?.id;
    }

    if (!userId) {
      return { success: false, error: "Failed to resolve User ID." }
    }

    // 3. Create/Update Profile record
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: userId,
        email: email,
        first_name: "", 
        last_name: ""
      }, { onConflict: 'id' })

    if (profileError) {
      console.error("Profile upsert error:", profileError)
      // We don't fail here because the account exists
    }

    // 4. Assign Role
    const { data: roleData, error: roleIdError } = await supabaseAdmin
      .from("roles")
      .select("id")
      .eq("name", roleName)
      .single()

    if (roleIdError) {
      console.error("Role lookup error:", roleIdError)
      return { success: false, error: "Failed to assign role permissions." }
    }

    const { error: assignError } = await supabaseAdmin
      .from("user_roles")
      .upsert({
        user_id: userId,
        role_id: roleData.id
      }, { onConflict: 'user_id' })

    if (assignError) {
      console.error("Role assignment error:", assignError)
      return { success: false, error: "Failed to set user permissions." }
    }

    return { success: true, userId }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    console.error("Caught error in createNewUserRecord:", error)
    return { success: false, error: errorMessage }
  }
}
