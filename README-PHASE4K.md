# Phase 4K — Separate Club Management Workspace

Phase 4K separates the club experience by responsibility instead of showing organizer forms inside the member page.

## Member and public experience

- `/clubs/[slug]` remains the polished Club Command Center for visitors and registered members.
- It contains the club home, live matches, events, rankings, member directory, follow/join controls and clubhouse.
- Owners and admins see a single **Manage club** button, but the page itself stays in member-preview mode.
- Calendar, announcements, honours, practice and venue sections are read-only from the organizer perspective on this page.

## Owner and admin experience

- `/clubs/[slug]/manage` is the private organizer workspace.
- Overview brings pending requests, upcoming plans, challenges, honours, followers and live activity together.
- People contains membership approvals, member roles and editable club details.
- Content contains calendar publishing, announcements and club honours.
- Operations contains the club guide, practice controls and venue table management.
- Dashboard shortcuts deep-link to the relevant management section.

## Access control

- The manage route is included in organizer route protection, so signed-out users are sent to sign in.
- The server page verifies the authenticated user with Supabase Auth.
- The server checks that the user is the club owner or has the `owner`/`admin` membership role before rendering any management UI.
- Non-admin club members are redirected to the normal club page.
- Supabase Row Level Security remains the final authorization boundary for every mutation.
