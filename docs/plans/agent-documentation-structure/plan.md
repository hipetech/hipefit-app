---
type: plan
status: completed
area: documentation
created: 2026-08-04
---

# Plan: agent instructions and feature documentation lifecycle

## Outcome

Restructure [`AGENTS.md`](../../../AGENTS.md) into a concise set of mandatory rules and
task-triggered reading instructions. Move the detailed UI system guidance into durable application
documentation, and make the feature lifecycle explicit so substantial features are planned before
implementation and every shipped behavior change updates the affected current-state documentation.

When complete, an agent can determine what to plan, what documentation to read, and what durable
documentation to update without loading a catalogue of unrelated project context.

## Context

The documentation tiers and their authority are already defined in
[`docs/README.md`](../../README.md) and were established by the historical
[`documentation-system` plan](../documentation-system/plan.md). The templates already contain parts
of the intended lifecycle, but the rules are distributed across
[`plan.md`](../../templates/plan.md), [`task.md`](../../templates/task.md), and
[`flow.md`](../../templates/flow.md) rather than presented as one executable feature-development
process.

`AGENTS.md` still mixes mandatory repository rules with descriptions of the current route tree,
UI primitives, framework behavior, measured exceptions, and implementation rationale. This makes
unrelated context automatic while the actual documentation lifecycle is no longer discoverable
there.

## Approach

Use task-triggered discovery instead of a general reference catalogue. `AGENTS.md` will state the
condition that makes a document required reading, while [`docs/README.md`](../../README.md) and the
durable documents will own the detail.

The ownership model will be:

- `AGENTS.md` owns unconditional constraints and task-triggered documentation obligations.
- [`docs/README.md`](../../README.md) owns the feature planning and documentation lifecycle.
- `docs/app/` owns current shared systems, including the UI system.
- `docs/flows/` owns current end-to-end user journeys.
- `docs/plans/` owns proposed work, implementation decisions, and historical rationale.
- Source code owns low-level APIs and implementation details.

Substantial feature work requires `docs/plans/<initiative-name>/plan.md`. Work is substantial when
it introduces or materially changes a user journey, shared system, persistent data model, native
integration, or coordinated behavior across multiple implementation areas. Small fixes do not need
ceremonial plans, but every behavior change must still assess and update its durable documentation
impact.

Do not add a `docs/features/` tier. A feature's proposed work belongs in its initiative plan; its
shipped cross-feature architecture belongs in `docs/app/`; and its shipped user journey belongs in
`docs/flows/`.

## Target `AGENTS.md` structure

The rewritten file should contain only information an agent needs automatically:

1. **Project constraints** — iOS-only, Expo bare workflow, Bun, and primary technologies.
2. **Development workflow** — inspect before changing, follow existing boundaries, and apply the
   documentation lifecycle.
3. **Commands and verification** — include `docs:check` and checks selected by change type.
4. **Architecture boundaries** — concise placement rules for routes, features, data, and native
   configuration rather than current-state inventories.
5. **Task-triggered documentation** — direct agents to the relevant durable document only when the
   task touches that system.
6. **Code conventions** — strict TypeScript, component and import conventions, naming, and shared
   helper placement.

The task-triggered rules should include:

- Before planning substantial feature work, read [`docs/README.md`](../../README.md) and create an
  initiative plan from [`docs/templates/plan.md`](../../templates/plan.md).
- Before UI work, read `docs/app/ui.md`.
- Before navigation work, read [`docs/app/navigation.md`](../../app/navigation.md).
- Before data-boundary work, read [`docs/app/database.md`](../../app/database.md) and
  [`docs/db-structure.md`](../../db-structure.md) as applicable.
- Before changing user-visible behavior, read the affected flow documents and update them in the
  same change.
- Create a flow document for a new user goal or independently understandable cross-screen journey.
- Create or extend an app document when a feature introduces a reusable cross-feature system.
- Treat plans as proposed or historical intent, never as current shipped behavior.

The route tree, UI primitive inventory, Figma inventory, cross-agent setup, and long explanations of
framework defects do not belong in `AGENTS.md`.

## Feature development lifecycle

Add one authoritative lifecycle to [`docs/README.md`](../../README.md):

1. **Classify the work.** Identify whether it changes a user journey, a shared application system,
   both, or neither.
2. **Plan substantial work.** Create `docs/plans/<initiative-name>/plan.md`, list affected app and
   flow documents, and identify whether new durable documents are needed.
3. **Prepare execution context.** When task notes are useful, put the exact durable documents and
   source files in their `context:` arrays.
4. **Implement against proposed intent.** Keep behavior that has not shipped in the plan rather than
   describing it as current in `docs/app/` or `docs/flows/`.
5. **Reconcile durable documentation.** Before completion, update existing app and flow documents or
   create and index the new documents required by the shipped behavior.
6. **Verify and complete.** Run the required checks, mark task notes done, and mark the initiative
   plan completed only after code and durable documentation agree.

A flow must be reviewed and updated whenever a feature changes any of these:

- entry points or availability;
- routes, screens, or step order;
- decisions, branches, and alternate paths;
- state reads, writes, or persistence;
- loading, empty, disabled, and error behavior;
- completion state or user-visible result.

A new flow is required when a feature introduces a distinct user goal or a journey that can be
understood independently. A new shared subsystem belongs in `docs/app/`, even when it was introduced
by one feature.

## UI documentation migration

Create `docs/app/ui.md` as the current UI-system document. Move, consolidate, and verify the existing
guidance rather than copying it into another location. It should cover:

- the boundary between React Native, `@expo/ui`, and `ui/` primitives;
- `Host` ownership, `RNHostView`, and native-tree composition;
- component file and props conventions;
- the reusable primitive inventory and when to add to it;
- semantic colors, app theme propagation, and prohibited styling systems;
- module-scope RN styles and SwiftUI modifier arrays;
- modifier ordering, composition rules, and the repository's override of bundled skill guidance;
- the shared Dynamic Type typography vocabulary;
- bounded SwiftUI lists versus virtualized catalogue lists;
- control hit testing, accessibility, and known `Menu` behavior;
- haptics, native motion, numeric transitions, and Reduce Motion;
- source links to canonical implementations and measured constants.

Move navigation-specific behavior, especially the global create button's tab-bar placement and menu
contract, into [`docs/app/navigation.md`](../../app/navigation.md). Replace the UI section in
[`docs/app/architecture.md`](../../app/architecture.md) with a concise system boundary and a link to
the new UI document. Add the new document to the current-documents index in
[`docs/README.md`](../../README.md).

After the migration, `AGENTS.md` should contain only the task-triggered requirement to read
`docs/app/ui.md` before UI work, not a duplicate description of the UI library.

## Implementation phases

### Phase 1: establish durable ownership

- [x] Create `docs/app/ui.md` from the verified UI guidance currently split between `AGENTS.md` and
      [`docs/app/architecture.md`](../../app/architecture.md).
- [x] Consolidate navigation-specific create-button guidance in
      [`docs/app/navigation.md`](../../app/navigation.md).
- [x] Reduce the UI section in [`docs/app/architecture.md`](../../app/architecture.md) to boundaries
      and a link to the new UI document.
- [x] Index the new UI document in [`docs/README.md`](../../README.md).

### Phase 2: define the feature lifecycle

- [x] Add the substantial-work threshold and six-step feature lifecycle to
      [`docs/README.md`](../../README.md).
- [x] Define precisely when existing flows must change and when a new flow or app-system document is
      required.
- [x] Update [`docs/templates/plan.md`](../../templates/plan.md) so planning records affected flows,
      shared systems, and new durable documents before implementation.
- [x] Update [`docs/templates/task.md`](../../templates/task.md) so completion requires the task's
      shipped documentation changes, not only a generic confirmation.
- [x] Update [`docs/templates/flow.md`](../../templates/flow.md) with the flow-change triggers while
      keeping optional sections non-ceremonial.

### Phase 3: restructure agent instructions

- [x] Rewrite [`AGENTS.md`](../../../AGENTS.md) using the target structure above.
- [x] Remove current-state inventories and detailed UI guidance after their durable destinations
      exist.
- [x] Add task-triggered links for feature planning, UI, navigation, data, and user-flow work.
- [x] Add `bun run docs:check` and documentation-aware verification guidance to the commands section.
- [x] Correct stale or contradictory statements encountered during migration rather than preserving
      them in the shorter file.

### Phase 4: audit and verify

- [x] Confirm every rule removed from `AGENTS.md` is either unnecessary automatic context or has one
      authoritative durable destination.
- [x] Confirm the same UI rule is not maintained in `AGENTS.md`, `architecture.md`, and `ui.md`.
- [x] Confirm all current app and flow documents remain discoverable from
      [`docs/README.md`](../../README.md).
- [x] Run the documentation and formatting checks.

## Documentation impact

- [x] Affected `docs/app/` documents:
      [`architecture.md`](../../app/architecture.md),
      [`navigation.md`](../../app/navigation.md), and new `docs/app/ui.md`.
- [x] Affected `docs/flows/` documents: none; this initiative changes documentation policy and
      organization, not shipped user behavior.
- [x] Affected documentation infrastructure:
      [`docs/README.md`](../../README.md),
      [`plan.md`](../../templates/plan.md),
      [`task.md`](../../templates/task.md), and
      [`flow.md`](../../templates/flow.md).
- [x] Update [`AGENTS.md`](../../../AGENTS.md) only after the durable UI destination exists.
- [x] Ensure every moved or added citation resolves in the same change.

This initiative is not complete when `AGENTS.md` is shorter. It is complete when feature planning,
flow maintenance, and UI-system discovery remain explicit and have one authoritative home each.

## Verification

```bash
bun run docs:check
bun run format:check
```

Review the resulting documents manually for duplicated rules that structural checks cannot detect.

## Acceptance criteria

- [x] `AGENTS.md` contains mandatory rules and task-triggered reading instructions rather than
      current-state catalogues.
- [x] `AGENTS.md` contains no detailed UI-library description and directs UI work to
      `docs/app/ui.md`.
- [x] `docs/app/ui.md` is the authoritative current description of the UI system and links to its
      canonical source implementations.
- [x] Navigation-specific create-button behavior has one authoritative home in
      [`docs/app/navigation.md`](../../app/navigation.md).
- [x] [`docs/README.md`](../../README.md) explains the complete lifecycle for substantial feature
      work.
- [x] The lifecycle requires every behavior change to assess durable documentation impact, even when
      the change does not need a plan.
- [x] Existing flows must be updated for entry-point, route, state, alternate-path, error, or
      completion changes.
- [x] New user journeys require new indexed flow documents, and new shared systems require new or
      extended app documents.
- [x] Plan and task templates make the required documentation changes explicit before completion.
- [x] No `docs/features/` tier is introduced.
- [x] `bun run docs:check` and `bun run format:check` pass.

## Non-goals

- Changing application behavior or UI implementation.
- Requiring a plan document for every small fix.
- Creating a per-feature durable documentation tier.
- Loading all durable documentation into every agent session.
- Moving low-level APIs, prop tables, or component trees from source code into prose.
- Rewriting unrelated historical plans.

## Follow-up decisions

- Decide after use whether the substantial-work threshold needs examples from completed initiatives.
- Decide whether `docs:check` should eventually enforce that current documents are indexed by
  [`docs/README.md`](../../README.md); semantic documentation accuracy will still require review.
