# Agency actors, org roles & mandate assignment — design

**Date:** 2026-07-12  
**Status:** Approved product rules (freeze)  
**Related:** `2026-06-27-paradis-immo-design.md` §4.8 Mandates; web auth one-role rule (`2026-07-12-web-email-google-auth-design.md`)

## Purpose

Freeze how **agencies**, **agents**, and **owners** relate for delegation. This doc does not implement UI; it constrains future agency / mandate / assignment work.

## Core principles

1. **One business account role:** a web user is either **Owner** or **Agent** (or platform admin). Never both.
2. **The agency is not an actor.** `Organization` of type `AGENCY` is a container (brand, portfolio under mandate, member list). It never “does” anything by itself.
3. **Only agent users act for the agency.** Every operational action (visits, leases, payments validation, maintenance, creating a listing for an owner, assigning work) is performed by a **User** with an agent membership in that agency.
4. **Owner delegates to an agency, not to a named agent.** The mandate target is always an `Organization` (`AGENCY` or platform org). Assignment to a specific agent is an **internal agency** step after the mandate exists.

## Actors

| Actor | Account | What they are |
|-------|---------|----------------|
| Owner | Web `OWNER` (org type `OWNER`) | Owns properties; may self-manage or mandate an agency |
| Agency | Org `AGENCY` only | Legal/commercial container — **no login, no API identity** |
| Agency manager (gérant) | Web **Agent** account | Agent with elevated org role inside the agency |
| Field agent | Web **Agent** account | Agent limited to properties/tasks assigned to them |
| Platform admin | `PLATFORM_ADMIN` | Separate; not an agency actor |

## Org membership roles (inside an `AGENCY`)

Reuse existing `OrgMemberRole` with this meaning for **agency** orgs:

| `OrgMemberRole` | Product name | Powers (agency context) |
|-----------------|--------------|-------------------------|
| `ADMIN` | Gérant | Act for the whole agency portfolio under mandate; invite/remove agents; **assign** mandated properties (or work) to agents including self; create properties **on behalf of** an owner when agreed; configure agency settings |
| `AGENT` | Agent | Act only on properties / work **assigned** to them; no org-wide assignment; no inviting gérants |
| `OWNER` | — | **Not used** on `AGENCY` orgs (reserved for `OrganizationType.OWNER` personal orgs) |

Notes:

- Self-serve web signup as “Agent” today attaches to the platform org as `AGENT`. Becoming **gérant** of a partner agency is provisioning / affiliation (not the same as owner↔agent role picker).
- A gérant is still a single **agent** account (dashboard `/agent`), not a fourth web role.

## Flows

### A — Owner self-manages

1. Owner keeps properties under their `OWNER` org.
2. No mandate (or mandate ended).
3. Owner performs all ops on `/owner/*`.

### B — Owner mandates an agency

1. Owner selects an **agency organization** (not a person) for a property.
2. System creates `Mandate` `{ propertyId, organizationId: agencyId, status: ACTIVE }` (already the shape today).
3. From that point, day-to-day ops for that property are agency-side; **sensitive** actions still go through `MandateApproval` to the owner (leases, major repair, rent reduction — as in parent design).
4. Owner does **not** pick which agent works the file at mandate time.

### C — Gérant assigns work inside the agency

1. Gérant (`OrgMemberRole.ADMIN` on the agency) sees mandated properties for the org.
2. Gérant assigns a property (or a work item) to a specific agent user in the same org — **including themselves**.
3. Assigned agent can operate; unassigned agents cannot act on that property.
4. Gérant may reassign.

**Data gap (to implement later):** today `Mandate` has no `assignedAgentId` (mentioned as intent in the parent design). Assignment may be:

- `Mandate.assignedAgentId` (nullable User), and/or  
- a dedicated `PropertyAssignment` / work-queue table if multiple concurrent assignees are needed.

Until that exists, treat “any agency member can manage mandated property” as **legacy interim** behavior to be narrowed.

### D — Agency creates a property for an owner

1. Only a **gérant** (or later an explicitly allowed agent) may create a listing **for** an owner who struggles with the product.
2. Resulting `Property.ownerId` = the owner user; managing org / mandate links the agency as agreed (product choice at implementation: create under owner org then mandate, or create already under agency management with owner attribution).
3. Owner retains ownership and approval rights on sensitive actions when under mandate.
4. The acting identity in audit logs is the **agent user**, with org context = agency — never “the agency” as userId.

## Web surfaces

| Surface | Who |
|---------|-----|
| `/owner/*` | Owner accounts only |
| `/agent/*` | Agent accounts (gérant and field agents share the shell; capabilities differ by org role + assignment) |
| `/admin/*` | Platform admin |

No role switcher between owner and agent on one account (enforced in web eligibility + proxy).

## Non-goals (this freeze)

- Full UI for assignment or “create for owner”
- Renaming Prisma enums
- Changing mobile tenant OTP
- Multi-agency membership for one agent (defer; if needed later, still one **account type** = agent)

## Implementation checklist (when scheduled)

- [ ] Persist assignment (`assignedAgentId` or equivalent); gate managed lists/actions on it
- [ ] Map gérant = `OrgMemberRole.ADMIN` on `AGENCY`; document in API guards
- [ ] Owner mandate UI: pick **agency org** only
- [ ] Agent UI: gérant sees org portfolio + assign; agent sees assigned only
- [ ] “Create property for owner” flow + audit (actor = agent userId, org = agencyId)
- [ ] Seed: at least one gérant + one field agent on demo agency for QA

## Consistency with current code

| Area | Today | Target |
|------|--------|--------|
| Mandate target | Org ✅ | Unchanged |
| Who acts | Any org member often allowed | Assigned agent (+ gérant overrides) |
| `assignedAgentId` | Not in schema | Add when building assignment |
| Web role switcher | Fixed to not force owner onto agents | Keep single-role rule |
| Org `ADMIN` | Exists in enum | = gérant for agencies |
