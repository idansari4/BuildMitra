#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: Add explicit Role Selection (Worker / Contractor / Client) column on the Create New Account (Register) screen so users can clearly identify who they are during signup.

frontend:
  - task: "Role selection on Register screen"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(auth)/register.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Added 3 role selection cards (Worker/Contractor/Client) with icons, description, and radio indicator above Name/Mobile/Password fields. Default = worker (or from route param). Selection required before submit; role is sent in register payload."

  - task: "Attendance module completion (Worker + Client/Contractor/Admin views)"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/attendance.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Rewrote attendance screen with (a) Worker view: Today's status card (check-in/out times + hours), enhanced history with job_title + geofence badge + distance, Monthly Salary Summary from /salary/summary, pull-to-refresh, better permission handling (canAskAgain + Open Settings). (b) Client/Contractor: NEW Workforce Attendance monitor with day filter (1/7/30), stats row (workers, check-ins, verified, flagged), rich per-row cards from /attendance/my-workers. (c) Admin: same monitor UI powered by /admin/attendance endpoint."

  - task: "Attendance PDF & CSV Export"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/attendance.tsx, /app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Added backend endpoints GET /api/attendance/export/csv and /api/attendance/export/pdf. Both accept days (int) and scope ('mine'|'workers'). scope='mine' for workers only (403 for others); scope='workers' for client/contractor (their jobs) and admin (all). PDF built with reportlab (landscape A4 with summary block + detail table). CSV uses stdlib csv. Frontend adds ExportBar with CSV+PDF pills in (a) Worker's Recent section header (b) Monitor view's filter row. downloadExport utility handles web (blob URL download) and native (expo-file-system + expo-sharing)."

  - task: "Wallet module completion (Top-up + Withdraw + Referral stats + rich transactions)"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/wallet.tsx, /app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "BUG FIX + Completion. Prior wallet had PaymentSheet imported but NEVER RENDERED — top-up buttons did nothing. Rewrote wallet screen with (a) PaymentSheet correctly wired to quick topup buttons. (b) NEW Custom Top-up bottom sheet (₹10 – ₹1,00,000 with preset chips + 5 presets). (c) NEW Withdraw modal with amount + UPI ID (regex validated) + 25/50/100% presets + success confirmation screen (calls /wallet/withdraw). (d) Money-flow mini stats (credited/debited totals) on hero card. (e) Referral stats row on hero card (Invited count + Earned ₹) via NEW backend GET /api/wallet/referral-stats. (f) Tap-to-copy referral code (web). (g) Filter chips (All/Money In/Money Out) for transactions. (h) Type-based transaction icons (referral=gift purple, salary=cash green, withdraw=up-red, topup=down-green, erp=briefcase-blue). (i) Pull-to-refresh. (j) Improved empty state."

  - task: "Wallet CSV + PDF export & enhanced withdrawal status display"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/wallet.tsx, /app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Iter 22: Added backend GET /api/wallet/export/csv?months=N and /api/wallet/export/pdf?months=N with proper role auth (any authenticated user gets their own txns). PDF has header/user info/summary block (balance, credited, debited, net) + detail table with row-shading and green/red amount colouring. CSV includes running totals footer. NEW backend GET /api/wallet/withdrawals returns dedicated withdrawal list. Frontend: WalletExportBar with CSV+PDF pills next to Transactions header. Enhanced withdrawal transaction display: 'Processing' pill (amber) + description 'Bank transfer usually completes in 24 hours.'; 'Paid' pill (green) + 'Sent to <upi>' when successful; 'Failed' pill (red) + 'Amount refunded'."

  - task: "Attendance: Leave request/inbox discoverability"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/attendance.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Added a Leave link card at the top of the Attendance screen. For worker: 'Leave Requests — Apply for leave · Track approval status' (testID request-leave-link). For client/contractor/admin (Monitor view): 'Leave Inbox — Approve or reject worker leave requests' (testID leave-inbox-link). Both navigate to /leave route (which is a fully-working screen from prior iterations)."

  - task: "Worker Profile — Job title rename, new skill levels, Availability toggle"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(tabs)/profile.tsx, /app/frontend/src/theme.ts, /app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Iter 23. (1) Renamed 'My skills' section heading to 'Job title'. Updated SKILLS list: removed Helper, Welder, Site Supervisor; added Fabrication Worker, Marbal Mason, Marbal Ghisai Worker, Shuttering Carpenter, Wood Polisher, Gypsum Worker, Glass Installer, AC Technician, CCTV Installer, Duct Installer. Selection is still multi-select — Chip testIDs are now `profile-jobtitle-<name>`. (2) Added NEW 'My skills' section (single-select) with 4 experience levels via new EXPERIENCE_LEVELS constant: Full trained, Semi trained, Helper, Supervisor (testIDs `profile-skill-level-<name>`). Persisted to backend field `experience_level` (added to ProfileUpdate model). Empty selection allowed (tap same chip to clear). (3) Added Availability toggle Switch at top of worker sections (testID `availability-toggle`) — persists instantly via PUT /me { available: bool } and reverts on failure. Card testID `availability-card`. Text updates based on state ('You are visible…' vs 'You will not receive…')."

backend:
  - task: "POST /auth/register accepts role field"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: true
          agent: "main"
          comment: "RegisterIn model already includes `role` string field and validates it against worker/contractor/client. No backend change required, but should be re-verified end-to-end with new UI payload."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 1
  run_ui: true

test_plan:
  current_focus:
    - "Role selection on Register screen"
    - "POST /auth/register accepts role field"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    - agent: "main"
      message: "Implemented explicit role selector on register screen. Please test: (1) The 3 role cards render with icons+desc and one is always selected (worker by default). (2) Tapping any card visually highlights it (border+bg color + checkmark). (3) Register submit sends selected role — verify by registering a fresh Contractor via mobile 9111111111 / password test1234 and checking that GET /auth/me returns role=contractor. (4) Try registering worker/client too with unique mobile numbers. (5) Ensure existing demo logins (9000000002/9000000001/9000000003/9000000000) still work unchanged."
    - agent: "main"
      message: "ATTENDANCE MODULE COMPLETION — Please test the following on /app/frontend/app/(tabs)/attendance.tsx: (A) WORKER (9000000002/demo1234): (a) 'Today' status card renders with Check-in, Check-out, Hours cells. (b) Job selector chips including 'General (No job)' and any hired job titles. (c) Monthly Summary card appears if there are historic check-ins with days_present & earnings ₹. (d) Recent history entries show job_title (if any), Verified/Off-site badge with distance in meters. (e) Pull-to-refresh works. (f) Check-in / Check-out buttons work (may fail in web due to no camera — that's ok, just verify UI). (B) CLIENT (9000000001/demo1234) and CONTRACTOR (9000000003/demo1234): (a) See 'Workforce Attendance' screen (NOT the previous 'Attendance is for workers' lock screen). (b) Day filter chips (Today / 7 days / 30 days) switch data. (c) Stats row shows Workers / Check-ins / Verified / Flagged counts. (d) Each row shows worker name, job title, timestamp, verified badge. (C) ADMIN (9000000000/admin1234): sees admin view via /admin/attendance endpoint with same UI. (D) Backend: verify /api/attendance/my-workers returns 200 for client & contractor, 403 for worker; /api/salary/summary returns 200 for worker with `rows`, `current_wage`."
