# Workflows + Native Engine Implementation Plan

This is the plan we’ll follow **before adding more features**. Goal: make the current workflows + native engine solid, understandable, and real.

---

## Phase 1 – Baseline & Map the Flow

**Goal:** Understand exactly what’s running now and what’s broken.

- **1.1 TypeScript + basic checks**
  - Run TS on key files:
    - `src/pages/Workflows.tsx`
    - `src/pages/automations/WorkflowBuilder.tsx`
    - `src/hooks/useWorkflows.ts`
    - `api/routes/workflows.routes.ts`
    - `api/services/workflow-engine/*`
  - Write down actual errors (not fixing yet).

- **1.2 End-to-end routes → UI map**
  - Map how these endpoints are used:
    - `GET /api/workflows` → `useWorkflows` → `Workflows` page.
    - `POST /api/workflows` → `useCreateWorkflow` → "Create Workflow".
    - `GET /api/workflows/:id/definition` → `useNativeWorkflowDefinition` → builder load.
    - `POST /api/workflows/:id/definition` → `useSaveNativeDefinition` → builder save.
    - `POST /api/workflows/:id/publish-native` → `usePublishNativeWorkflow`.
    - `POST /api/workflows/:id/test-native` → `useTestNativeWorkflow`.

**Exit criteria for Phase 1:**

- We have a short list of **real** problems (type mismatches, bad routes, etc.).
- We understand how data flows from DB → routes → hooks → pages → engine.

---

## Phase 2 – Clean, Honest Workflow Types

**Goal:** Make the workflow data model simple and accurate.

- **2.1 Align types with DB**
  - Compare:
    - Prisma `Workflow` model.
    - `src/types/automation.ts` `Workflow` interface.
    - JSON shape from `GET /api/workflows` and `GET /api/workflows/:id`.
  - Remove or split off any **Activepieces-only** fields that aren’t used.

- **2.2 Fix hooks to match the API**
  - `useWorkflows`:
    - Expect `{ data: Workflow[], total: number }` and return `Workflow[]`.
  - `useWorkflow`, `useCreateWorkflow`, `useUpdateWorkflow`, `useDeleteWorkflow`:
    - Inputs/outputs must match `workflows.routes.ts` exactly.

- **2.3 Simplify the Workflows list UI**
  - `src/pages/Workflows.tsx` should only rely on fields that really exist:
    - `name`, `status`, `triggerType`, `updatedAt`, etc.
  - Remove use of any properties that are never set by the backend.

**Exit criteria for Phase 2:**

- TypeScript is clean for workflows hooks + `Workflows.tsx`.
- A senior dev can look at `types/automation.ts` and `useWorkflows.ts` and immediately see a truthful, minimal model.

---

## Phase 3 – Make the Builder a Real Native Editor

**Goal:** React Flow builder is a true editor for the native engine definitions.

- **3.1 Node catalog and palette**
  - Ensure `NativeNodeLibrary` calls:
    - `GET /api/workflows/nodes/catalog` (via `apiClient` with correct base URL).
  - Confirm drag data format matches what the builder expects.

- **3.2 Load + save native definitions correctly**
  - In `WorkflowBuilder.tsx`:
    - Load: `useNativeWorkflowDefinition(id)` → normalize nodes/edges → React Flow.
    - Save: `useSaveNativeDefinition(id)` should send **native node/edge shapes**, not random React Flow structs.
  - Confirm `nativeWorkflowDefinition` rows are created/updated as expected.

- **3.3 Publish and test buttons are real**
  - Publish:
    - Calls `POST /api/workflows/:id/publish-native`.
    - Updates `workflow.status` to `published`.
  - Test:
    - Calls `POST /api/workflows/:id/test-native` with `triggerData`.
    - Surfaces success/failure clearly in the UI.

**Exit criteria for Phase 3 (manual scenario):**

1. Create a workflow.
2. Add `trigger.webhook` + `communication.send_email` nodes.
3. Save, publish the workflow.
4. Trigger it (test API or webhook) and see a workflow run in the UI and logs.

---

## Phase 4 – CRM Triggers + Automations UX

**Goal:** CRM events really fire workflows; "Automations" in CRM is not fake.

- **4.1 CRM event triggers**
  - Confirm `trigger.crm_event` nodes:
    - Create `crmTriggerSubscription` records on save via `POST /api/workflows/:id/definition`.
  - Confirm CRM actions (e.g. contact created) call `emitTrigger` with the right payload.

- **4.2 CRM Automations tab**
  - Decide and implement a minimal real behavior:
    - Either show relevant workflows for the contact.
    - Or provide a clear, working link into `/workflows` filtered for CRM triggers.

- **4.3 End-to-end CRM test**
  - Flow:
    1. Build workflow with `trigger.crm_event` on `contact.created`.
    2. Publish workflow.
    3. Create contact in CRM.
    4. Verify workflow run is created and nodes execute.

**Exit criteria for Phase 4:**

- Creating CRM entities (like contacts) can automatically start workflows.
- The CRM "Automations" surface points to this real behavior (not a stub).

---

## Phase 5 – Local Cleanup & Guardrails

**Goal:** Make this slice clean and low-maintenance.

- Remove only:
  - Imports, variables, and functions that became unused due to our changes.
  - Dead Activepieces-specific workflow code that is provably unused.
- Optionally add 1–2 thin tests around:
  - `POST /api/workflows` + `GET /api/workflows`.
  - A minimal native workflow executing via `engineService`.

**Exit criteria for Phase 5:**

- No TS/lint errors in workflows + engine.
- No obvious dead code in that slice.
- Another senior dev can follow workflows from DB → API → hooks → UI → engine without guessing.
