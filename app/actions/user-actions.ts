"use server"

import { createAdminClient } from "@/utils/supabase/admin"
import { createClient as createServerClient } from "@/utils/supabase/server"

export async function createNewUserRecord(email: string, roleName: 'lead' | 'viewer') {
  const supabaseAdmin = createAdminClient()
  const supabase = await createServerClient()

  // 1. Verify the requester is actually an 'owner'
  const { data: { user: requester } } = await supabase.auth.getUser()
  if (!requester) throw new Error("Not authenticated")

  const { data: requesterRole } = await supabase
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", requester.id)
    .single()

  if (!requesterRole || (requesterRole as any).roles.name !== "owner") {
    throw new Error("Unauthorized: Only owners can create users")
  }

  // 2. Create the user in Supabase Auth
  const { data: newUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: "tcdexwebapp.123",
    email_confirm: true // Automatically confirm so they can log in immediately
  })

  if (authError) throw authError
  if (!newUser.user) throw new Error("User creation failed")

  try {
    // 3. Create Profile record
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: newUser.user.id,
        email: email,
        first_name: "", // Initial empty, they can update later
        last_name: ""
      })

    if (profileError) throw profileError

    // 4. Assign Role
    // First find role id
    const { data: roleData, error: roleIdError } = await supabaseAdmin
      .from("roles")
      .select("id")
      .eq("name", roleName)
      .single()

    if (roleIdError) throw roleIdError

    const { error: assignError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: newUser.user.id,
        role_id: roleData.id
      })

    if (assignError) throw assignError

    return { success: true, userId: newUser.user.id }
  } catch (error: any) {
    // Cleanup if something failed (optional, but good practice)
    await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
    throw error
  }
}
