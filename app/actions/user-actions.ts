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
    if (userError || !requester) {
      return { success: false, error: "Authentication failed." }
    }

    // Checking if requester has the 'owner' role using inner join
    const { data: requesterRole, error: roleCheckError } = await supabaseAdmin
      .from("user_roles")
      .select("roles!inner(name)")
      .eq("user_id", requester.id)
      .eq("roles.name", "owner")
      .maybeSingle()

    if (roleCheckError || !requesterRole) {
      console.error("Owner verification failed:", roleCheckError)
      return { success: false, error: "Unauthorized: Only owners can create users." }
    }

    // 2. Resolve or Create the user in Supabase Auth
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
      // If user already exists, we "repair" by proceeding to resolve ID and update records
      if (authError.message.includes("already registered") || authError.status === 422) {
        console.log("User already exists, proceeding to resolve ID and update records.")
        
        // Search in profiles first as it's faster
        const { data: existingProfile } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("email", email)
          .maybeSingle()
        
        if (existingProfile) {
          userId = existingProfile.id;
        } else {
          // Fallback: search in Auth directly (requires admin privileges)
          const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers()
          const existingAuthUser = authUsers?.users.find(u => u.email === email)
          userId = existingAuthUser?.id;
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
    }

    // 4. Assign Role
    const { data: roleData, error: roleLookupError } = await supabaseAdmin
      .from("roles")
      .select("id")
      .eq("name", roleName)
      .single()

    if (roleLookupError || !roleData) {
      console.error("Role lookup error:", roleLookupError)
      return { success: false, error: "Failed to resolve role permissions." }
    }

    // Clear any existing roles to ensure a clean single-role state for the user
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId)

    // Insert the new role assignment
    const { error: assignError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: userId,
        role_id: roleData.id
      })

    if (assignError) {
      console.error("Role assignment error:", assignError)
      return { success: false, error: "Failed to assign user permissions." }
    }

    console.log("User record handled successfully")
    return { success: true, userId }
  } catch (error: any) {
    console.error("Unexpected error in createNewUserRecord:", error)
    return { success: false, error: "An unexpected error occurred." }
  }
}
