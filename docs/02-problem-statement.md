# 02 — Problem Statement & Solution Space

## 1. Context & Background
Organizations that operate physical spaces—such as educational institutions, shared offices, corporate parks, and residential complexes—must continuously maintain physical infrastructure: plumbing, electrical wiring, HVAC, lighting, structural fittings, and safety equipment.

While routine wear and tear is normal, the processes used to report, track, and remediate maintenance issues remain largely broken in many organizations.

---

## 2. Key Failure Points in Traditional Workflows

### A. Unstructured Intake & Information Deficits
- **Symptoms:** Issues are submitted via phone calls, chat apps (e.g., Slack, WhatsApp), or verbal complaints to reception desk personnel.
- **Consequences:** Critical triage information is routinely missing—such as exact room/wing numbers, asset identification, time of occurrence, severity, or photographic evidence. Technicians often arrive at the site unprepared with the wrong tools or replacement parts.

### B. Lack of Triage & Objective Prioritization
- **Symptoms:** Requests are addressed on a "first-come, first-served" basis or whoever complains the loudest.
- **Consequences:** High-hazard issues (such as water leakage near server racks, electrical sparks, or broken primary access doors) sit in the queue behind cosmetic issues (such as a scuffed wall baseboard).

### C. The "Black Hole" Effect for Requesters
- **Symptoms:** Once a user submits a ticket, they receive no automated updates, ticket reference IDs, or progress timelines.
- **Consequences:** Requesters repeatedly call or email staff for updates ("Did anyone check my AC yet?"), wasting staff time and generating user frustration.

### D. Manual, Opaque Technician Dispatch
- **Symptoms:** Dispatch relies on whiteboard notes or memory.
- **Consequences:** Workload distribution across technicians is uneven. Skill-matching is ignored (e.g., assigning a specialized HVAC fault to a general carpenter), leading to prolonged downtime.

### E. Missing Auditability & Accountability
- **Symptoms:** When a repair is postponed or marked complete, there is no immutable historical log recording who changed the status, why a delay occurred, or what parts were replaced.
- **Consequences:** Chronic issues recur without root-cause analysis, and management cannot identify training or vendor supply gaps.

---

## 3. How FixFlow Solves These Problems

| Problem Area | Traditional Process | FixFlow Solution |
| :--- | :--- | :--- |
| **Intake** | Disorganized chats, missing location details | Structured submission forms with mandatory fields (Title, Category, Location, Priority Level, Description, Optional Attachments). |
| **Triage** | Random prioritization | Automatic priority classifications (Urgent, High, Medium, Low) with administrative override and SLA indicators. |
| **Visibility** | Zero visibility after report | Real-time status badges (`SUBMITTED`, `ACKNOWLEDGED`, `ASSIGNED`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`), complete with a visual timeline. |
| **Dispatch** | Ad-hoc phone calls | Dedicated Admin Console enabling 1-click assignment based on category, technician availability, and skill specialization. |
| **Accountability** | Unverified resolution claims | Mandatory technician resolution notes, completion timestamps, and user closure confirmation. |
| **Metrics** | Gut-feel estimations | Database-backed dashboards computing real metrics: open tickets, average resolution turnaround time, category distribution, and SLA adherence. |

---

## 4. Explicit Scope & Non-Goals

To maintain high code quality and adhere to software engineering best practices, FixFlow explicitly establishes boundaries:

### In Scope
- Secure multi-role authentication (User, Technician, Admin) with JWT.
- Full complaint lifecycle management with state transitions.
- Technician queue management and work order resolution workflows.
- Administrative triage and assignment dashboard.
- Chronological timeline tracking for every complaint.
- Filtering, sorting, and pagination for high-volume complaint tables.

### Out of Scope (Non-Goals)
- **Billing & Payment Gateways:** FixFlow is an operational maintenance system, not a commercial invoicing platform.
- **Full CAD/BIM 3D Floorplan Mapping:** Precise geographic GIS/CAD navigation is out of scope; hierarchical text location (Building > Floor > Room) is used instead.
- **Artificial Intelligence / LLM Hallucinations:** Status changes and routing are deterministic and rule-driven, eliminating erratic automated behavior.
