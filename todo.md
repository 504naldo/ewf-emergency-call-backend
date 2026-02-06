# EWF Emergency Call Service - TODO

## Database & Schema
- [x] Create users table with role field (tech, admin, manager)
- [x] Create oncall_schedule table for on-call assignments
- [x] Create rotation_state table for rotating pool pointer
- [x] Create sites table for site information
- [x] Create incidents table for emergency incidents
- [x] Create call_attempts table for call routing log
- [x] Create incident_events table for audit trail
- [x] Create notifications table for push notification tracking
- [x] Create system_config table for business hours and ring duration
- [x] Add seed data for test users (techs, admins, managers)
- [x] Add seed data for test sites
- [x] Add seed data for initial on-call schedule
- [x] Add seed data for system configuration

## Routing Engine & Webhooks
- [x] Implement business hours detection logic
- [x] Implement business hours ladder routing (primary -> secondary -> admin -> manager -> broadcast)
- [x] Implement after hours ladder routing (primary -> secondary -> manager -> admin -> rotating pool)
- [x] Implement rotating pool selection (next 3 eligible techs, sequential)
- [x] Implement 30-second ring timeout per step
- [x] Create webhook endpoint for incoming_call event
- [x] Create webhook endpoint for ringing event
- [x] Create webhook endpoint for answered event
- [x] Create webhook endpoint for completed event
- [x] Create webhook endpoint for missed event
- [x] Implement call attempt logging
- [ ] Implement answered but unclaimed detection (90s timeout)
- [x] Implement broadcast alert for unanswered emergencies
- [ ] Create tRPC procedure for manual escalation
- [ ] Create tRPC procedure for manual assignment

## Mobile App - Tech Screens
- [x] Update app branding (name, logo)
- [x] Create Home screen with availability toggle
- [x] Create Home screen with current incident card
- [x] Create Home screen with recent incidents list
- [ ] Create Incoming Emergency screen with caller info
- [ ] Create Incoming Emergency screen with Accept/Decline buttons
- [ ] Create decline reason picker modal
- [x] Create Incident Detail screen with status timeline
- [x] Create Incident Detail screen with caller information
- [x] Create Incident Detail screen with call attempts log
- [x] Create status update picker modal
- [x] Create close incident form with outcome picker
- [ ] Implement push notification handling
- [ ] Implement deep linking to Incoming Emergency screen
- [ ] Implement deep linking to Incident Detail screen
- [ ] Add native phone dialer integration
- [ ] Add native maps integration
- [ ] Implement offline status update queueing
- [x] Implement pull-to-refresh on Home screen

## Admin Web Board
- [x] Create admin board layout with header and filters
- [x] Create live incidents table with all columns
- [x] Create SLA timer with color coding
- [x] Create incident detail side panel
- [ ] Implement status filter (All, Open, En Route, On Site, Unclaimed)
- [ ] Implement critical only toggle
- [ ] Implement search by incident ID or site
- [ ] Create assign/reassign tech dropdown
- [ ] Create force escalate action
- [ ] Create mark critical action
- [ ] Create add internal note form
- [ ] Create close incident form (admin version)
- [ ] Implement real-time updates for incident list
- [ ] Implement missed/declined indicators

## Configuration Panel
- [x] Create configuration panel layout
- [x] Create business hours editor (days, times, timezone)
- [x] Create ring duration slider
- [x] Create business hours ladder drag-and-drop editor
- [x] Create after hours ladder drag-and-drop editor
- [ ] Create rotating pool tech selection
- [x] Implement save configuration logic
- [x] Add validation for configuration changes

## Authentication & RBAC
- [ ] Implement role-based access control (tech, admin, manager)
- [ ] Protect admin routes with admin/manager role check
- [ ] Protect tech routes with authentication
- [ ] Add role field to user context
- [ ] Implement permission checks in tRPC procedures

## Testing & Integration
- [ ] Write unit tests for routing engine
- [ ] Write unit tests for business hours detection
- [ ] Write unit tests for rotating pool selection
- [ ] Test webhook integration with mock telephony provider
- [ ] Test push notification delivery
- [ ] Test deep linking on iOS and Android
- [ ] Test offline queueing and sync
- [ ] Test admin board real-time updates
- [ ] Test RBAC permissions
- [ ] End-to-end test of full call flow

## New Features
- [x] Add DEV-ONLY GET endpoint at /api/webhooks/telephony/test for browser testing

## Bug Fixes
- [x] Ensure admin + mobile use correct backend URL (https://3000-...)
- [x] Fix tRPC incidents.list to return all incidents without filters
- [x] Add GET /api/debug/incidents endpoint for verification
- [x] Add error logging to UI for tRPC/fetch errors

## User Management
- [x] Update current user role to admin for testing

## Authentication & Security
- [x] Require login on app launch (no guest mode)
- [x] Add logout button to settings/profile
- [x] Enforce auth on all tRPC routes (except public endpoints)
- [x] Enforce auth on REST routes (except /health and webhooks)
- [x] Implement server-side RBAC (admin/manager routes)
- [x] Restrict techs to only their own data
- [x] Add webhook signature verification

## Email/Password Authentication
- [x] Create login API endpoint (POST /api/auth/login)
- [x] Update login screen with email/password form
- [x] Store auth token securely (SecureStore on native, localStorage on web)
- [x] Fetch current user on app load after login
- [x] Show user name + role in Settings tab
- [x] Update logout to clear token and redirect to login
