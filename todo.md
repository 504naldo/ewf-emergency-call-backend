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

## Build Fixes
- [x] Fix jsonwebtoken ESM/CommonJS import error in server/auth.ts

## Authentication Flow Fixes
- [x] Update tRPC client to attach JWT token to all requests
- [x] Fix app launch auth check (load token -> route accordingly)
- [x] Add visible error display on login failure (Alert.alert)
- [x] Add real password hashing and validation (bcrypt)
- [x] Seed test users with real hashed passwords
- [x] Set JWT_SECRET environment variable (built-in)
- [x] Create users.me tRPC procedure for token validation (getMe)

## Auth Regression Fixes
- [x] Store JWT token in SecureStore/AsyncStorage on successful login
- [x] Load token on app launch and set global auth state
- [x] Call users.me after token load, route to Login on 401
- [x] Gate tRPC queries until authReady=true
- [x] Add debug info in Settings (authStatus, tokenPresent, currentUser)
- [x] Fix logout to clear token and reset tRPC cache

## Login Issue Debug
- [x] Test login API endpoint directly with curl
- [x] Check if JWT token is being generated correctly
- [x] Fix AuthGuard to properly redirect when no token exists
- [x] Add loading state to prevent Home screen rendering before auth check
- [x] Ensure tRPC queries don't run until auth is confirmed

## Persistent Login Issue
- [x] Check if Expo Router redirect is working properly
- [x] Try alternative approach: render login screen directly instead of redirect
- [x] Add more detailed console logging to track navigation flow
- [x] Removed router navigation dependency - AuthGuard renders login directly

## tRPC Token Attachment Fix
- [x] Update tRPC client to read JWT token from storage on every request
- [x] Ensure Authorization header is attached to all tRPC calls
- [x] Update tRPC context to validate JWT tokens from Authorization header
- [ ] Test that authenticated endpoints work after login

## Automatic Logout on 401
- [x] Update AuthContext to clear token and logout when users.me returns 401
- [x] Add token validation on app load that calls users.getMe
- [x] Automatically logout and show login screen when 401 detected
- [ ] Test token expiration and invalid token scenarios

## Login Screen Logo
- [x] Add EWF logo centered above "Emergency Call Service" title
- [x] Set max width to ~170px with auto height
- [x] Maintain proper spacing to avoid pushing login fields too low
- [x] Replace with correct EWF "earth wind and fire" logo

## Dark Mode Logo Support
- [x] Generate light version of EWF logo for dark mode
- [x] Upload light logo to CDN
- [x] Implement automatic logo switching based on color scheme in login screen

## Login Redirect Issue
- [x] Debug why users are redirected back to login screen after signing in
- [x] Check AuthContext token validation logic
- [x] Check AuthGuard rendering logic
- [x] Verify token is being stored correctly
- [x] Remove automatic token validation that was causing 401 errors
- [x] Fix JWT token field name mismatch (id vs userId) in tRPC context
- [x] Test complete login flow end-to-end

## Twilio Studio Flow Integration
- [x] Create POST /api/telephony/next-target endpoint
- [x] Create POST /api/telephony/answered endpoint
- [x] Create POST /api/telephony/completed endpoint
- [x] Create POST /api/telephony/attempt-failed endpoint
- [x] Implement BH ladder routing (primary->secondary->admin->manager)
- [x] Implement AH ladder routing (primary->secondary->manager->admin->rotating_pool)
- [x] Exclude unavailable users from routing
- [x] Exclude already-rung users from routing
- [x] Persist call_attempts for each routing step
- [x] Add Twilio signature verification for webhook security
- [x] Add shared secret header fallback for webhook security
- [x] Create Twilio Studio Flow plan document
- [x] Test all webhook endpoints

## EAS Build Configuration
- [x] Update app name to "EWF Emergency" in app.config.ts
- [x] Verify app icon and splash screen are configured
- [x] Add EXPO_PUBLIC_API_URL environment variable
- [x] Update tRPC client to use EXPO_PUBLIC_API_URL
- [x] Create eas.json with preview and production profiles
- [x] Configure preview profile for Android APK and iOS internal distribution
- [x] Configure production profile for Android AAB and iOS App Store
- [x] Document build process and distribution steps
- [ ] Build Android APK for internal distribution (requires Expo account)
- [ ] Build iOS TestFlight-ready build (requires Apple Developer account)

## Android APK Build
- [x] Authenticate with Expo account
- [x] Configure EAS project
- [x] Build Android APK with preview profile
- [x] Download APK file
- [x] Provide APK to user for distribution
