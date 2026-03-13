import { NextResponse, type NextRequest } from "next/server";
import { supabase } from "@/lib/scim/db";
import { faker } from "@faker-js/faker";
import { ScimUser, ScimGroup, ScimEntitlement, ScimRole } from "@/lib/scim/models/scimSchemas";

interface RouteParams {
  params: { userId: string };
}

const ROLES_CATALOG: { displayName: string; description: string }[] = [
  { displayName: "Super Admin",        description: "Full system access across all tenants" },
  { displayName: "Admin",              description: "Administrative access within the tenant" },
  { displayName: "Manager",            description: "Team management and reporting capabilities" },
  { displayName: "Developer",          description: "Access to development tools and environments" },
  { displayName: "Read Only",          description: "View-only access to all resources" },
  { displayName: "Support Agent",      description: "Customer support tooling access" },
  { displayName: "Auditor",            description: "Read access for compliance and audit purposes" },
  { displayName: "Security Analyst",   description: "Access to security dashboards and alerts" },
];

const ENTITLEMENT_CATALOG: { displayName: string; type: string; description: string }[] = [
  { displayName: "Admin Access",           type: "role",       description: "Full administrative privileges" },
  { displayName: "Read Only",              type: "role",       description: "View-only access to all resources" },
  { displayName: "Developer",              type: "role",       description: "Access to development environments and tools" },
  { displayName: "Manager",               type: "role",       description: "Team management and reporting access" },
  { displayName: "Billing",               type: "permission", description: "View and manage billing information" },
  { displayName: "Audit Logs",            type: "permission", description: "Access to audit trail and compliance logs" },
  { displayName: "API Access",            type: "permission", description: "Programmatic access via API keys" },
  { displayName: "Premium Support",       type: "license",    description: "Priority support with SLA guarantees" },
  { displayName: "Standard License",      type: "license",    description: "Standard product license" },
  { displayName: "Enterprise License",    type: "license",    description: "Full enterprise feature set" },
  { displayName: "SSO",                   type: "feature",    description: "Single sign-on integration" },
  { displayName: "Advanced Analytics",    type: "feature",    description: "Access to advanced reporting and analytics" },
];

const DEPARTMENTS = [
  "Engineering", "Product", "Design", "Marketing", "Sales",
  "Finance", "Human Resources", "Legal", "Operations", "Security",
  "Customer Success", "Data Science", "DevOps", "QA", "Support",
];

const JOB_TITLES = [
  "Software Engineer", "Senior Software Engineer", "Principal Engineer", "Staff Engineer",
  "Product Manager", "Senior Product Manager", "Director of Product",
  "UX Designer", "Senior Designer", "Design Lead",
  "Marketing Manager", "Growth Manager", "Brand Strategist",
  "Account Executive", "Sales Manager", "Business Development Manager",
  "Financial Analyst", "Senior Accountant", "Finance Manager",
  "HR Business Partner", "Talent Acquisition Specialist",
  "Legal Counsel", "Compliance Manager",
  "Operations Manager", "Program Manager",
  "Security Engineer", "Security Analyst",
  "Customer Success Manager", "Implementation Specialist",
  "Data Scientist", "ML Engineer", "Data Analyst",
  "DevOps Engineer", "Site Reliability Engineer",
  "QA Engineer", "Test Automation Engineer",
  "Support Specialist", "Technical Support Engineer",
];

const USER_TYPES   = ["Employee", "Employee", "Employee", "Contractor"];
const LOCALES      = ["en-US", "en-US", "en-GB", "fr-FR", "de-DE", "ja-JP", "es-ES"];
const TIMEZONES    = [
  "America/New_York", "America/Los_Angeles", "America/Chicago", "America/Denver",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Tokyo", "Asia/Singapore",
];
const LANGUAGES    = ["en", "en", "fr", "de", "ja", "es"];

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { userId } = await params;

  try {
    let body: any = {};
    try { body = await request.json(); } catch {}

    const deleteExisting = body.deleteExisting === true;
    const userCount      = typeof body.userCount  === "number" ? Math.min(body.userCount, 1000) : 20;
    const groupCount     = typeof body.groupCount === "number" ? Math.min(body.groupCount, 100) : 5;

    if (deleteExisting) {
      const { error: er } = await supabase.from("scim_roles").delete().eq("tenantId", userId);
      if (er) throw new Error(`Failed to delete roles: ${er.message}`);
      const { error: ee } = await supabase.from("scim_entitlements").delete().eq("tenantId", userId);
      if (ee) throw new Error(`Failed to delete entitlements: ${ee.message}`);
      const { error: eg } = await supabase.from("scim_groups").delete().eq("tenantId", userId);
      if (eg) throw new Error(`Failed to delete groups: ${eg.message}`);
      const { error: eu } = await supabase.from("scim_users").delete().eq("tenantId", userId);
      if (eu) throw new Error(`Failed to delete users: ${eu.message}`);
    }

    let existingUsers: ScimUser[] = [];
    if (!deleteExisting) {
      const { data, error } = await supabase.from("scim_users").select("resource").eq("tenantId", userId);
      if (error) throw new Error(`Failed to fetch existing users: ${error.message}`);
      existingUsers = (data?.map((u) => u.resource) || []) as ScimUser[];
      existingUsers.forEach((u) => { if (!u.groups) u.groups = []; });
    }

    const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    const users: ScimUser[] = [];
    for (let i = 0; i < userCount; i++) {
      const firstName = faker.person.firstName();
      const lastName  = faker.person.lastName();
      const id        = faker.string.uuid();
      const now       = new Date().toISOString();
      users.push({
        schemas:           ["urn:ietf:params:scim:schemas:core:2.0:User"],
        id,
        userName:          faker.internet.username({ firstName, lastName }),
        displayName:       `${firstName} ${lastName}`,
        name: {
          givenName:  firstName,
          familyName: lastName,
          formatted:  `${firstName} ${lastName}`,
        },
        title:             faker.helpers.arrayElement(JOB_TITLES),
        userType:          faker.helpers.arrayElement(USER_TYPES),
        preferredLanguage: faker.helpers.arrayElement(LANGUAGES),
        locale:            faker.helpers.arrayElement(LOCALES),
        timezone:          faker.helpers.arrayElement(TIMEZONES),
        emails: [{
          primary: true,
          value:   faker.internet.exampleEmail({ firstName, lastName }),
          type:    "work",
        }],
        active: faker.datatype.boolean({ probability: 0.9 }),
        groups: [],
        meta: {
          resourceType: "User",
          created:      now,
          lastModified: now,
          location:     `${BASE_URL}/api/${userId}/scim/v2/Users/${id}`,
          version:      `W/"${Date.now()}"`,
        },
      });
    }

    const usedNames = new Set<string>();
    const groups: ScimGroup[] = [];
    for (let i = 0; i < groupCount; i++) {
      let name: string;
      let attempts = 0;
      do {
        const dept = faker.helpers.arrayElement(DEPARTMENTS);
        const suffix = faker.helpers.arrayElement(["Team", "Group", "Squad", "Chapter"]);
        name = `${dept} ${suffix}`;
        attempts++;
      } while (usedNames.has(name) && attempts < 20);
      usedNames.add(name);

      const id  = faker.string.uuid();
      const now = new Date().toISOString();
      groups.push({
        schemas:     ["urn:ietf:params:scim:schemas:core:2.0:Group"],
        id,
        displayName: name,
        members:     [],
        meta: {
          resourceType: "Group",
          created:      now,
          lastModified: now,
          location:     `${BASE_URL}/api/${userId}/scim/v2/Groups/${id}`,
          version:      `W/"${Date.now()}"`,
        },
      });
    }

    const allUsers = [...existingUsers, ...users];

    if (allUsers.length > 0 && groups.length > 0) {
      const addMember = (group: ScimGroup, user: ScimUser) => {
        if (group.members.some((m) => m.value === user.id)) return;
        group.members.push({
          value:   user.id,
          display: user.name?.formatted || user.displayName || user.userName,
          $ref:    `${BASE_URL}/api/${userId}/scim/v2/Users/${user.id}`,
        });
        if (!user.groups) user.groups = [];
        if (!user.groups.some((g) => g.value === group.id)) {
          user.groups.push({
            value:   group.id,
            display: group.displayName,
            $ref:    `${BASE_URL}/api/${userId}/scim/v2/Groups/${group.id}`,
          });
        }
      };

      users.forEach((user) => {
        const group = faker.helpers.arrayElement(groups);
        addMember(group, user);
      });

      groups.forEach((group) => {
        const extra = faker.number.int({ min: 0, max: Math.min(allUsers.length - 1, 8) });
        faker.helpers.shuffle([...allUsers]).slice(0, extra).forEach((u) => addMember(group, u));
      });
    }

    // Generate a subset of entitlements from the catalog
    const entitlementCount = faker.number.int({ min: 5, max: ENTITLEMENT_CATALOG.length });
    const selectedCatalog  = faker.helpers.shuffle([...ENTITLEMENT_CATALOG]).slice(0, entitlementCount);
    const entitlements: ScimEntitlement[] = selectedCatalog.map((e) => {
      const id  = faker.string.uuid();
      const now = new Date().toISOString();
      return {
        schemas:     ["urn:okta:scim:schemas:core:1.0:Entitlement"],
        id,
        displayName: e.displayName,
        type:        e.type,
        description: e.description,
        meta: {
          resourceType: "Entitlement",
          created:      now,
          lastModified: now,
          location:     `${BASE_URL}/api/${userId}/scim/v2/Entitlements/${id}`,
          version:      `W/"${Date.now()}"`,
        },
      };
    });

    // Assign 0–2 random entitlements to each new user
    if (entitlements.length > 0) {
      users.forEach((user) => {
        const count = faker.number.int({ min: 0, max: Math.min(2, entitlements.length) });
        if (count === 0) return;
        user.entitlements = faker.helpers.shuffle([...entitlements]).slice(0, count).map((e) => ({
          value:   e.id,
          display: e.displayName,
          type:    e.type,
        }));
      });
    }

    // Generate roles from catalog
    const roleCount    = faker.number.int({ min: 3, max: ROLES_CATALOG.length });
    const selectedRoles = faker.helpers.shuffle([...ROLES_CATALOG]).slice(0, roleCount);
    const roles: ScimRole[] = selectedRoles.map((r) => {
      const id  = faker.string.uuid();
      const now = new Date().toISOString();
      return {
        schemas:     ["urn:okta:scim:schemas:core:1.0:Role"],
        id,
        displayName: r.displayName,
        description: r.description,
        meta: {
          resourceType: "Entitlement",
          created:      now,
          lastModified: now,
          location:     `${BASE_URL}/api/${userId}/scim/v2/Roles/${id}`,
          version:      `W/"${Date.now()}"`,
        },
      };
    });

    // Assign 0–1 roles to each new user (most users have one role)
    if (roles.length > 0) {
      users.forEach((user) => {
        const count = faker.number.int({ min: 0, max: Math.min(1, roles.length) });
        if (count === 0) return;
        user.roles = faker.helpers.shuffle([...roles]).slice(0, count).map((r) => ({
          value:   r.id,
          display: r.displayName,
        }));
      });
    }

    if (users.length > 0) {
      const { error } = await supabase.from("scim_users").insert(
        users.map((u) => ({ id: u.id, username: u.userName, active: u.active, resource: u, tenantId: userId }))
      );
      if (error) throw new Error(`User insertion failed: ${error.message}`);
    }

    if (existingUsers.length > 0) {
      const { error } = await supabase.from("scim_users").upsert(
        existingUsers.map((u) => ({ id: u.id, username: u.userName, active: u.active, resource: u, tenantId: userId })),
        { onConflict: "id" }
      );
      if (error) throw new Error(`Existing user update failed: ${error.message}`);
    }

    if (groups.length > 0) {
      const { error } = await supabase.from("scim_groups").insert(
        groups.map((g) => ({ id: g.id, display_name: g.displayName, resource: g, tenantId: userId }))
      );
      if (error) throw new Error(`Group insertion failed: ${error.message}`);
    }

    if (entitlements.length > 0) {
      const { error } = await supabase.from("scim_entitlements").insert(
        entitlements.map((e) => ({ id: e.id, display_name: e.displayName, resource: e, tenantId: userId }))
      );
      if (error) throw new Error(`Entitlement insertion failed: ${error.message}`);
    }

    if (roles.length > 0) {
      const { error } = await supabase.from("scim_roles").insert(
        roles.map((r) => ({ id: r.id, display_name: r.displayName, resource: r, tenantId: userId }))
      );
      if (error) throw new Error(`Role insertion failed: ${error.message}`);
    }

    return NextResponse.json({
      message: `Generated ${users.length} users, ${groups.length} groups, ${entitlements.length} entitlements, and ${roles.length} roles. Updated ${existingUsers.length} existing users.`,
    });
  } catch (error: any) {
    console.error("Seed failed:", error);
    return NextResponse.json({ detail: "Internal Server Error", error: error.message }, { status: 500 });
  }
}
