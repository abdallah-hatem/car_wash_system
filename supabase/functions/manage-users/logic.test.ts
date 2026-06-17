import { assertEquals, assertObjectMatch, assertRejects } from "jsr:@std/assert@1";
import {
  validateInput,
  sanitizePermissions,
  createUser,
  updateUser,
  ManageError,
} from "./logic.ts";

// ── validateInput ─────────────────────────────────────────────────────────────
Deno.test("validateInput: create — accepts + trims, sanitizes perms/branches", () => {
  const r = validateInput({
    action: "create",
    email: "  m@x.test  ",
    password: "secret12",
    fullName: "  Sam  ",
    branchIds: ["b1", "b1", "b2", 7],
    permissions: { queue: "edit", bogus: "edit", staff: "nope" },
  });
  assertEquals(r, {
    action: "create",
    email: "m@x.test",
    password: "secret12",
    fullName: "Sam",
    branchIds: ["b1", "b2"],
    permissions: { queue: "edit" },
  });
});

Deno.test("validateInput: create — rejects bad email / short password", () => {
  assertObjectMatch(validateInput({ action: "create", email: "nope", password: "secret12" }), { error: "invalid" });
  assertObjectMatch(validateInput({ action: "create", email: "m@x.test", password: "short" }), { error: "invalid" });
});

Deno.test("validateInput: update — userId required; optional fields pass through", () => {
  assertObjectMatch(validateInput({ action: "update" }), { error: "invalid" });
  assertEquals(validateInput({ action: "update", userId: "u1", branchIds: ["b1"] }), {
    action: "update", userId: "u1", branchIds: ["b1"],
  });
});

Deno.test("validateInput: setActive needs a boolean", () => {
  assertObjectMatch(validateInput({ action: "setActive", userId: "u1" }), { error: "invalid" });
  assertEquals(validateInput({ action: "setActive", userId: "u1", isActive: false }), {
    action: "setActive", userId: "u1", isActive: false,
  });
});

Deno.test("validateInput: resetPassword enforces min length; delete needs userId", () => {
  assertObjectMatch(validateInput({ action: "resetPassword", userId: "u1", password: "x" }), { error: "invalid" });
  assertEquals(validateInput({ action: "delete", userId: "u1" }), { action: "delete", userId: "u1" });
});

Deno.test("validateInput: rejects unknown action / non-object", () => {
  assertObjectMatch(validateInput({ action: "nuke", userId: "u1" }), { error: "invalid" });
  assertObjectMatch(validateInput(null), { error: "invalid" });
  assertObjectMatch(validateInput("nope"), { error: "invalid" });
});

Deno.test("sanitizePermissions keeps valid tab/level pairs only", () => {
  assertEquals(
    sanitizePermissions({ queue: "edit", packages: "view", dashboard: "none", bogus: "edit", staff: 1 }),
    { queue: "edit", packages: "view", dashboard: "none" },
  );
  assertEquals(sanitizePermissions("nope"), {});
});

// ── Handler guards (compact chainable mock) ───────────────────────────────────
// A builder that is both chainable (returns itself) and awaitable (resolves a
// canned response keyed by `${table}.${op}`); maybeSingle() is its own terminal.
function makeAdmin(responses: Record<string, { data: unknown; error: unknown }>, hooks: {
  createUser?: () => { data: unknown; error: unknown };
} = {}) {
  let createUserCalls = 0;
  let deleteUserCalls = 0;
  const from = (table: string) => {
    let op = "select";
    const b = {
      select() { op = "select"; return b; },
      insert() { op = "insert"; return b; },
      update() { op = "update"; return b; },
      delete() { op = "delete"; return b; },
      eq() { return b; },
      in() { return b; },
      maybeSingle: () => Promise.resolve(responses[`${table}.maybeSingle`] ?? { data: null, error: null }),
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve(responses[`${table}.${op}`] ?? { data: null, error: null }).then(res, rej),
    };
    return b;
  };
  const admin = {
    from,
    auth: {
      admin: {
        createUser: () => {
          createUserCalls++;
          return Promise.resolve(hooks.createUser ? hooks.createUser() : { data: { user: { id: "new-user" } }, error: null });
        },
        deleteUser: () => { deleteUserCalls++; return Promise.resolve({ data: null, error: null }); },
        updateUserById: () => Promise.resolve({ data: null, error: null }),
      },
    },
    calls: () => ({ createUserCalls, deleteUserCalls }),
  };
  // deno-lint-ignore no-explicit-any
  return admin as any;
}

Deno.test("createUser: rejects a branch outside the caller tenant (before creating the auth user)", async () => {
  // branches lookup returns 0 rows for a requested branch id -> invalid, no auth user created.
  const admin = makeAdmin({ "branches.select": { data: [], error: null } });
  await assertRejects(
    () => createUser(admin, "tenant-1", {
      action: "create", email: "m@x.test", password: "secret12", fullName: "Sam",
      branchIds: ["other-tenant-branch"], permissions: {},
    }),
    ManageError,
  );
  assertEquals(admin.calls().createUserCalls, 0);
});

Deno.test("createUser: maps a duplicate-email auth error to email_exists", async () => {
  const admin = makeAdmin({}, { createUser: () => ({ data: null, error: { message: "User already registered" } }) });
  const err = await assertRejects(
    () => createUser(admin, "tenant-1", {
      action: "create", email: "dupe@x.test", password: "secret12", fullName: "", branchIds: [], permissions: {},
    }),
    ManageError,
  );
  assertEquals((err as ManageError).code, "email_exists");
});

Deno.test("updateUser: refuses to target a non-manager (e.g. another owner)", async () => {
  const admin = makeAdmin({ "profiles.maybeSingle": { data: { tenant_id: "tenant-1", role: "owner" }, error: null } });
  const err = await assertRejects(
    () => updateUser(admin, "tenant-1", { action: "update", userId: "owner-2", permissions: { queue: "edit" } }),
    ManageError,
  );
  assertEquals((err as ManageError).code, "not_found");
});

Deno.test("updateUser: refuses a target in another tenant", async () => {
  const admin = makeAdmin({ "profiles.maybeSingle": { data: { tenant_id: "tenant-2", role: "manager" }, error: null } });
  await assertRejects(
    () => updateUser(admin, "tenant-1", { action: "update", userId: "u-other", branchIds: [] }),
    ManageError,
  );
});
