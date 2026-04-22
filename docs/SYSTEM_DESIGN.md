# GoalPilot — System Design Document

> **Version:** 1.0 | **Date:** April 2026 | **Status:** Draft  
> **Working Name:** GoalPilot  
> **Tagline:** Reduce freedom, increase clarity.

---

## Table of Contents

- [Section 0: Critical Analysis & Design Responses](#section-0-critical-analysis--design-responses)
- [Section 1: Product Overview](#section-1-product-overview)
- [Section 2: Core Architecture](#section-2-core-architecture)
- [Section 3: Data Models](#section-3-data-models)
- [Section 4: Planning Engine](#section-4-planning-engine)
- [Section 5: Agent System (Constrained)](#section-5-agent-system-constrained)
- [Section 6: Daily Loop Engine](#section-6-daily-loop-engine--the-core-product)
- [Section 7: Execution Layer](#section-7-execution-layer)
- [Section 8: Trust & Approval System](#section-8-trust--approval-system)
- [Section 9: API Design](#section-9-api-design)
- [Section 10: UX Flow](#section-10-ux-flow)
- [Section 11: Example Walkthrough — Turo Business](#section-11-example-walkthrough--turo-business)
- [Section 12: Monetization](#section-12-monetization)
- [Section 13: Implementation Roadmap](#section-13-implementation-roadmap)
- [Section 14: Competitive Landscape](#section-14-competitive-landscape)

---

# Section 0: Critical Analysis & Design Responses

This section enumerates the seven primary risks identified during the design phase
of GoalPilot. Each risk is analyzed in depth, paired with an architectural response
that is embedded structurally into the system, and given explicit acceptance criteria.
All subsequent sections of this document reference these mitigations by tag.

---

## 0.1 Risk R1: Template Rigidity vs Real Life

### Risk Statement

GoalPilot relies on structured templates — goal decomposition trees, daily action
plans, milestone checklists — to guide users through execution. The danger is that
these templates assume a predictable world. Real life is not predictable. A user
planning to "launch an Etsy store in 30 days" may discover on day 4 that Etsy
changed its fee structure, or that their supplier fell through, or that they got
sick for a week. Rigid templates that cannot absorb variance become obstacles
rather than guides. Users abandon systems that punish them for living normal lives.

### Why It Is Dangerous

Template rigidity produces two failure modes. First, the system generates plans
that feel irrelevant after disruption, eroding trust. Second, users who force
themselves to follow an outdated plan waste effort on tasks that no longer serve
the goal. Both outcomes lead to churn. Worse, rigidity signals to the user that
the system does not understand them, which is fatal for a product whose value
proposition is "I understand your goal and will help you execute it."

### Architectural Solution

GoalPilot treats every template as a living document governed by a replanning
engine. Templates are not static artifacts — they are initial hypotheses about
how to reach a goal. The system architecture includes:

1. **Adaptive Plan Graph (APG):** Goals decompose into a directed acyclic graph
   of milestones and tasks, not a flat list. Each node carries metadata: estimated
   effort, dependency links, confidence score, and a staleness timestamp. When a
   node goes unaddressed for longer than its expected cycle, the system flags it
   for replanning rather than nagging the user to complete it.

2. **Disruption Detection Module:** The daily check-in (see Section 3) includes
   a lightweight "what changed?" prompt. User responses feed a classifier that
   determines whether the current plan branch remains valid. Classification
   outputs: CONTINUE, ADJUST, REPLAN, PAUSE. Only REPLAN triggers a full
   template regeneration; ADJUST modifies parameters on existing nodes.

3. **Template Versioning:** Every plan mutation is versioned. Users can inspect
   the history of their plan, see why changes were made, and roll back if the
   system got it wrong. This preserves user agency over the template while
   allowing the system to adapt.

4. **Flex Slots:** Each daily action plan reserves one slot (out of typically
   three) as a "flex" task — a lower-priority item that can be swapped without
   triggering a replan. This absorbs minor daily variance without touching the
   plan graph.

### Specific Components

- `PlanGraphService` — maintains the APG, handles node CRUD and versioning.
- `DisruptionClassifier` — NLP model evaluating check-in responses against plan assumptions.
- `ReplanningOrchestrator` — coordinates partial or full replan cycles.
- `FlexSlotAllocator` — selects and ranks candidate flex tasks each morning.

### Acceptance Criteria

- A user who misses 3 consecutive days receives a revised plan within one
  check-in cycle, not a guilt-inducing backlog.
- Plan graph version history is queryable; rollback completes in under 2 seconds.
- Disruption classification achieves >= 85% agreement with human raters on a
  labeled evaluation set of 500 check-in transcripts.
- At least 70% of users who experience a replan event continue using the system
  for 14+ days afterward (measured via cohort analysis).

---

## 0.2 Risk R2: Cold Start Problem

### Risk Statement

GoalPilot must generate a useful, personalized plan from the very first
interaction. The user arrives with a goal — "I want to lose 20 pounds" or
"I want to launch a newsletter" — and the system must produce a credible
execution plan without historical data about this user's habits, constraints,
available time, skill level, or past failures. Getting the first plan wrong
is especially costly because the user has no prior positive experience to
anchor trust.

### Why It Is Dangerous

Cold start failures are existential for an opinionated system. A general-purpose
tool (a blank Notion page, a todo app) does not promise intelligence, so users
forgive emptiness. GoalPilot promises structure and guidance. If the first plan
is generic, irrelevant, or comically miscalibrated ("Day 1: Run a marathon"),
the user concludes the system is not smart enough to help them and leaves. There
is no second chance to make a first impression.

### Architectural Solution

GoalPilot addresses cold start through a three-layer onboarding funnel designed
to extract maximum signal with minimum friction:

1. **Goal Intake Interview:** A structured conversational flow (not a form) that
   asks 5-8 targeted questions. Questions are dynamically selected based on the
   goal category. For a fitness goal, the system asks about current activity level,
   injuries, schedule constraints. For a business goal, it asks about budget,
   timeline pressure, existing assets. The interview is capped at 3 minutes to
   prevent abandonment.

2. **Archetype Matching:** GoalPilot maintains a library of goal archetypes —
   parameterized plan templates derived from aggregated (anonymized) data across
   users pursuing similar goals. The intake interview maps the user to the nearest
   archetype, which provides a strong prior for the initial plan. Archetypes are
   not shown to the user; they are internal scaffolding.

3. **Calibration Week:** The first 7 days are explicitly labeled as a calibration
   period. Task difficulty is intentionally set low. The system observes completion
   rates, time-of-day patterns, and check-in sentiment to build a user model.
   After day 7, the system proposes a recalibrated plan and asks the user to
   confirm or adjust. This sets expectations: "We're learning about you."

4. **Progressive Disclosure of Complexity:** The initial plan shows only the
   first milestone and its immediate tasks. The full plan graph exists internally
   but is revealed incrementally as the user demonstrates engagement. This prevents
   overwhelm and reduces the surface area of potential cold-start errors.

### Specific Components

- `IntakeInterviewEngine` — manages dynamic question selection and response parsing.
- `ArchetypeRegistry` — stores and matches goal archetypes with similarity scoring.
- `CalibrationTracker` — monitors first-week signals and triggers recalibration.
- `ProgressiveDisclosureController` — gates plan visibility based on engagement metrics.

### Acceptance Criteria

- Intake interview completes in median <= 2.5 minutes.
- Initial plan relevance rated >= 3.5/5 by users in post-onboarding survey.
- Day-7 retention is >= 60% (users who complete at least one task on day 7).
- Recalibrated plan (post calibration week) relevance rated >= 4.0/5.

---

## 0.3 Risk R3: Approval Fatigue

### Risk Statement

GoalPilot is not autonomous — it proposes actions and the user approves them.
This is a deliberate design choice (see R7: AI being wrong). However, requiring
approval for every action creates friction. If the system asks "Should I do X?"
twenty times a day, the user stops reading the requests and either rubber-stamps
everything (defeating the purpose of approval) or stops engaging entirely.

### Why It Is Dangerous

Approval fatigue is a well-documented UX antipattern. It degrades both safety
and engagement simultaneously. Rubber-stamping means the human-in-the-loop
guardrail becomes theater. Disengagement means the daily action loop — the
core product mechanic — breaks down. Either outcome destroys the product's
value proposition.

### Architectural Solution

GoalPilot uses a tiered approval model that calibrates friction to consequence:

1. **Action Tiers:**
   - **Tier 0 (Auto-execute):** Informational actions with no side effects.
     Examples: researching a topic, drafting a document for user review,
     compiling a checklist. These execute without approval and surface results
     in the daily summary.
   - **Tier 1 (Batch approval):** Low-stakes actions grouped into the daily
     plan. The user approves the entire day's plan in one action during the
     morning check-in. Individual tasks do not require separate approval.
   - **Tier 2 (Explicit approval):** Actions with real-world consequences —
     sending an email, making a purchase, publishing content, scheduling a
     meeting. Each requires individual confirmation with a clear description
     of what will happen.
   - **Tier 3 (Confirm + verify):** Irreversible or high-stakes actions —
     canceling a subscription, submitting a legal document, spending above a
     threshold. Requires confirmation plus a brief cooldown period (e.g., 5
     minutes) before execution.

2. **Trust Escalation:** As the system observes that a user consistently approves
   Tier 1 actions without modification, it may propose promoting specific action
   categories to Tier 0. The user explicitly opts in. Trust only escalates; it
   never auto-escalates without user consent.

3. **Approval Bundling:** Where multiple Tier 2 actions relate to the same
   workflow (e.g., "send three follow-up emails to leads"), they are presented
   as a single bundled approval with itemized details, not three separate
   interruptions.

### Specific Components

- `ActionTierClassifier` — assigns tiers to proposed actions based on type, consequence, and reversibility.
- `ApprovalBundler` — groups related Tier 2 actions into coherent approval units.
- `TrustEscalationManager` — tracks approval patterns and proposes tier promotions.
- `CooldownEnforcer` — implements the delay window for Tier 3 actions.

### Acceptance Criteria

- Users encounter no more than 3 explicit approval requests (Tier 2+) per day
  on average across all goal types.
- Rubber-stamp rate (approving without reading, measured by time-to-approve < 1s
  on Tier 2 actions) stays below 15%.
- Trust escalation proposals are accepted >= 50% of the time (indicating they
  are well-calibrated, not premature).
- Zero Tier 3 actions execute without the full confirmation + cooldown cycle
  (hard invariant, enforced by the system).

---

## 0.4 Risk R4: "1-3 Tasks" Cap May Not Be Enough

### Risk Statement

GoalPilot's daily action loop proposes 1-3 tasks per day as its default
operating cadence. This constraint is intentional — it enforces focus and
prevents the overwhelm that kills execution. However, some goals, some users,
and some phases of execution genuinely require higher throughput. A user in
"launch week" for their product may need to execute 8 tasks in a day. A
constraint that cannot flex for legitimate intensity becomes a bottleneck.

### Why It Is Dangerous

If the system rigidly enforces a low task cap during high-intensity phases,
users will either: (a) work around the system by tracking extra tasks elsewhere,
fragmenting their execution context; or (b) conclude the system is too simplistic
for serious work. Both outcomes erode the product's position as a complete
execution partner. The risk is particularly acute for the target user — ambitious
solopreneurs who sometimes need to sprint.

### Architectural Solution

The 1-3 task default is a baseline, not a ceiling. GoalPilot implements an
adaptive workload model:

1. **Intensity Modes:**
   - **Steady (default):** 1-3 tasks/day. Optimized for sustainability.
   - **Push:** 4-6 tasks/day. Activated by user request or system suggestion
     when a milestone deadline approaches. Time-limited to 1-2 weeks max.
     Requires explicit user opt-in with a warning about burnout risk.
   - **Sprint:** 7-10 tasks/day. Available only for short bursts (3-5 days).
     The system actively monitors completion rates and check-in sentiment;
     if either degrades, it forces a downshift to Push or Steady.

2. **Task Decomposition Granularity:** When the cap feels limiting, the real
   issue is often granularity. "Set up payment processing" is one task that
   might take 4 hours. GoalPilot's decomposition engine can break it into
   sub-tasks ("create Stripe account," "configure webhook," "test checkout
   flow") that each fit the daily slot model. Users can choose their preferred
   granularity.

3. **Parallel Track Support:** For users with multiple active goals, each goal
   maintains its own daily allocation. A user with two active goals in Steady
   mode effectively has 2-6 tasks/day across both tracks, with the system
   balancing attention between them.

4. **Overflow Queue:** Tasks that do not fit today's allocation are not lost.
   They enter a prioritized overflow queue visible to the user, with clear
   scheduling into future days. This makes the cap feel like "managed
   sequencing" rather than "arbitrary limitation."

### Specific Components

- `IntensityModeController` — manages mode transitions with guardrails and time limits.
- `TaskDecompositionEngine` — breaks coarse tasks into sub-tasks at adjustable granularity.
- `CrossGoalBalancer` — allocates daily slots across multiple active goal tracks.
- `OverflowQueueManager` — prioritizes and schedules deferred tasks.
- `BurnoutDetector` — monitors signals (declining completion, negative sentiment, long gaps) and recommends downshifts.

### Acceptance Criteria

- Users in Push mode maintain >= 80% completion rate (if below, system recommends
  downshift).
- Sprint mode auto-expires after 5 days; no manual override can extend it beyond 7.
- Task decomposition reduces average task duration from > 2 hours to < 45 minutes
  per sub-task.
- Overflow queue items are scheduled within 5 business days; none remain unscheduled
  for more than 10 days without a replan event.

---

## 0.5 Risk R5: Domain Expertise Is Expensive

### Risk Statement

GoalPilot must generate credible plans across dozens of domains — fitness,
e-commerce, content creation, personal finance, software development, career
transitions, and more. Each domain has its own best practices, common pitfalls,
regulatory considerations, and expert knowledge. Building or acquiring this
expertise for every domain is prohibitively expensive if done through bespoke
engineering.

### Why It Is Dangerous

Without domain expertise, GoalPilot produces generic plans that read like
AI-generated listicles. "Step 1: Define your target market. Step 2: Create a
business plan." Users can get this from a Google search. The product's value
depends on specificity: "You said you're selling handmade candles on Etsy.
Here's how to optimize your listing titles for the Etsy search algorithm,
based on what works in the home fragrance category." Generic advice is worse
than no advice because it consumes the user's trust budget without delivering
value.

### Architectural Solution

GoalPilot uses a layered expertise model that combines LLM capabilities with
structured domain knowledge:

1. **Domain Knowledge Packs (DKPs):** Curated, structured knowledge bundles for
   specific goal categories. Each DKP contains: common milestones, typical
   timelines, known pitfalls, decision trees for common branching points, and
   recommended resources. DKPs are authored by domain experts and encoded as
   structured data (not prose), making them machine-consumable by the planning
   engine.

2. **LLM-as-Reasoner, DKP-as-Ground-Truth:** The LLM handles natural language
   understanding, plan personalization, and conversational interaction. But when
   generating specific recommendations, it is constrained by the DKP's structured
   knowledge. This prevents hallucination of domain facts while preserving
   conversational fluency. The LLM reasons over the DKP; it does not replace it.

3. **Community-Sourced Expertise (Phase 2):** As the user base grows, GoalPilot
   can mine anonymized, aggregated execution data to refine DKPs. Which tasks
   do users in "launch a Shopify store" goals consistently skip? Which milestones
   take 3x longer than estimated? This feedback loop makes DKPs self-improving
   without requiring continuous expert curation.

4. **Explicit Uncertainty Marking:** When GoalPilot operates outside its DKP
   coverage — a user pursuing a goal in an unsupported domain — it explicitly
   flags its suggestions as "general guidance, not domain-specific." This manages
   expectations and preserves trust for domains where the system is genuinely
   knowledgeable.

### Specific Components

- `DomainKnowledgePackStore` — CRUD and retrieval for DKPs, indexed by goal taxonomy.
- `DKPConstrainedPlanner` — plan generation engine that uses DKP data as hard constraints.
- `ExpertiseConfidenceScorer` — rates the system's confidence in its domain knowledge for a given goal, surfaced to the user.
- `AggregatedInsightsPipeline` — processes anonymized execution data into DKP refinements.

### Acceptance Criteria

- At launch, DKPs cover the top 10 goal categories (by user research frequency),
  representing >= 70% of expected initial user goals.
- Plans generated with DKP backing score >= 4.0/5 on domain relevance in expert
  review; plans without DKP backing score >= 3.0/5 (general quality bar).
- Explicit uncertainty flags appear on 100% of recommendations outside DKP
  coverage (hard invariant).
- Community-sourced DKP refinements improve milestone time-estimate accuracy by
  >= 20% within 6 months of Phase 2 launch.

---

## 0.6 Risk R6: Measuring Success Is Hard

### Risk Statement

Many goals that GoalPilot supports are inherently difficult to measure. "Get
healthier" has no clear finish line. "Grow my business" is continuous. Even
goals with apparent endpoints ("launch my app") have ambiguous success criteria
— launched but with zero users? Launched with 100 users? Launched and profitable?
If the system cannot measure progress, it cannot provide meaningful feedback,
and users lose the motivational reinforcement that sustains long-term execution.

### Why It Is Dangerous

Without measurable progress, the daily action loop becomes a treadmill. Users
complete tasks but do not feel they are getting anywhere. This is the leading
cause of abandonment in goal-tracking products. It is also a technical problem:
without progress signals, the adaptive planning engine (R1) cannot determine
whether the plan is working. The system becomes blind.

### Architectural Solution

GoalPilot implements a multi-dimensional progress measurement framework that
does not rely solely on goal completion as a binary outcome:

1. **Milestone-Based Progress:** Every goal decomposes into milestones with
   concrete, verifiable deliverables. "Get healthier" becomes: "Complete
   initial health assessment" -> "Establish 3x/week exercise habit for 2 weeks"
   -> "Achieve target resting heart rate." Milestones are the primary unit of
   progress, not the goal itself.

2. **Leading Indicators:** Beyond milestone completion, the system tracks
   behavioral leading indicators: consistency (% of daily plans completed),
   engagement depth (time spent in check-ins, quality of reflections), and
   velocity (tasks completed per week, trending up or down). These indicators
   provide early warning of stalls before milestone deadlines are missed.

3. **User-Defined Success Criteria:** During goal setup, the system asks the
   user to define what "done" looks like in concrete terms. The system proposes
   criteria based on the goal archetype (R2) and the user confirms or modifies.
   This anchors progress measurement to the user's own definition of success,
   not a generic standard.

4. **Progress Narratives:** Weekly, the system generates a brief narrative
   summary: "This week you completed 2 of 3 milestones ahead of schedule.
   Your consistency score is 87%, up from 72% last week. You are on track to
   reach your 30-day target." Narrative framing makes progress feel tangible
   even when the goal is abstract.

5. **Stall Detection and Intervention:** If leading indicators show a sustained
   decline (3+ days of declining completion, negative check-in sentiment), the
   system triggers a structured reflection: "It looks like momentum has slowed.
   Let's look at what's blocking you." This is not a guilt mechanism; it is a
   diagnostic conversation that may result in replanning (R1).

### Specific Components

- `MilestoneTracker` — tracks milestone status and computes completion percentages.
- `LeadingIndicatorEngine` — calculates consistency, velocity, and engagement metrics.
- `SuccessCriteriaWorkshop` — interactive flow for defining and refining success criteria.
- `ProgressNarrativeGenerator` — produces weekly natural-language progress summaries.
- `StallDetector` — monitors for sustained negative trends and triggers interventions.

### Acceptance Criteria

- 100% of active goals have at least one user-confirmed success criterion defined
  within 48 hours of goal creation.
- Leading indicators predict milestone misses >= 3 days in advance with >= 70%
  precision.
- Weekly progress narratives are rated "helpful" by >= 75% of users (in-app
  feedback).
- Stall interventions result in resumed activity (at least one task completed
  within 48 hours) >= 60% of the time.

---

## 0.7 Risk R7: AI Being Wrong

### Risk Statement

GoalPilot relies on LLM-generated plans, task suggestions, and advice. LLMs
hallucinate. They generate plausible-sounding but factually incorrect information.
They have biases. They lack real-time world knowledge. When GoalPilot tells a
user "You should register your business as an LLC in Delaware for tax benefits,"
it may be wrong — and the user may act on it. Unlike a chatbot where the user
understands they are talking to AI, GoalPilot presents itself as a structured
execution system, which implicitly elevates the authority of its outputs.

### Why It Is Dangerous

This is the most dangerous risk because it compounds with trust. The more the
user trusts GoalPilot (which is the goal of good product design), the less
critically they evaluate its recommendations. A system that is trusted and wrong
causes more damage than a system that is not trusted at all. In regulated
domains (health, finance, legal), wrong advice can have legal and personal
consequences for the user. Reputational damage to GoalPilot from a single
high-profile case of harmful advice could be existential.

### Architectural Solution

GoalPilot treats AI output as a draft, never as a directive. Multiple layers
of protection:

1. **Confidence-Gated Output:** Every AI-generated recommendation carries an
   internal confidence score. Recommendations below the confidence threshold
   are either suppressed, flagged with explicit uncertainty language ("This is
   a suggestion — verify before acting"), or escalated to a higher-quality
   reasoning path (e.g., chain-of-thought with self-critique). Users never see
   the raw score, but they see its effects in the language and framing.

2. **Domain Guardrails:** For sensitive domains (health, finance, legal), the
   system applies hard guardrails: it will not recommend specific medications,
   specific investment instruments, or specific legal structures. Instead, it
   recommends consulting a professional and provides context for what to ask.
   These guardrails are implemented as blocklists and pattern matchers at the
   output layer, not as prompt instructions (which are unreliable).

3. **Source Attribution:** When the system makes factual claims, it attributes
   them to its source — the DKP (R5), the user's own input, or general AI
   reasoning. This allows users to calibrate trust appropriately. "Based on
   your DKP for Etsy sellers..." carries more weight than "Based on general
   knowledge..."

4. **User Override Supremacy:** The user can override any system recommendation
   at any time without penalty. Overrides are logged and used to improve the
   system's calibration for that user, but the system never argues with or
   discourages an override. The user is always the final authority.

5. **Error Reporting and Learning Loop:** Users can flag any recommendation as
   incorrect. Flagged items enter a review queue. Patterns in flags (e.g., a
   DKP that consistently produces flagged recommendations) trigger DKP revision
   or confidence recalibration.

### Specific Components

- `ConfidenceScorer` — assigns confidence to generated recommendations.
- `DomainGuardrailEngine` — applies output-layer filters for sensitive domains.
- `SourceAttributionTagger` — tags each recommendation with its knowledge source.
- `UserOverrideHandler` — processes overrides and feeds them into user model.
- `ErrorFlagPipeline` — collects, categorizes, and routes user-reported errors.

### Acceptance Criteria

- Zero recommendations in health, finance, or legal domains that prescribe
  specific actions without a "consult a professional" caveat (hard invariant,
  tested via automated adversarial evaluation).
- User error flags are acknowledged within 24 hours and resolved (DKP update,
  confidence adjustment, or determination that the recommendation was correct)
  within 7 days.
- Source attribution is present on >= 95% of factual claims in generated plans.
- Confidence-gated uncertainty language appears on >= 90% of recommendations
  with confidence below the threshold.

---

# Section 1: Product Overview

## 1.1 Vision [R2][R5][R6]

Everyone deserves a strategic operator, not just another todo list.

The world is full of tools that let you organize tasks. Notion, Todoist, Asana,
Trello — they give you a blank canvas and say "go." This works for people who
already know what to do and just need a place to track it. It fails entirely for
people who know where they want to go but do not know how to get there.

GoalPilot exists for the second group. It is the system that sits between "I have
a goal" and "I have a plan and I am executing it daily." It is not a passive
receptacle for tasks. It is an active partner that decomposes goals into
executable steps, sequences them intelligently, presents them at the right cadence,
and adapts when reality intervenes.

The vision is a world where strategic execution capability — the ability to turn
ambition into structured daily action — is not a luxury reserved for people who
can afford a chief of staff or an executive coach. GoalPilot democratizes the
foreman: the person who shows up every morning with a clear plan, checks your
progress, adjusts when things go sideways, and keeps you moving forward.

## 1.2 Mission Statement [R1][R3][R7]

To build an opinionated execution system that transforms ambitious goals into
completed milestones through structured planning, constrained automation, and a
daily action loop — while keeping the human in control and the AI in service.

GoalPilot accepts three constraints as first principles:

1. The AI proposes; the human decides. (Addresses R7.)
2. Structure reduces cognitive load; freedom increases it. (Addresses R1.)
3. Daily consistency beats weekly heroics. (Addresses R3 — keep the loop lightweight.)

## 1.3 Positioning: Opinionated Execution System [R1][R3][R4]

GoalPilot is not a platform. It is not a framework. It is not a toolkit. It is
an opinionated execution system. This distinction is critical and deliberate.

**Opinionated** means GoalPilot makes decisions for you. It decides how many
tasks you should do today. It decides what order to tackle milestones. It decides
when you need to replan. You can override any of these decisions (R7: user
override supremacy), but the default path requires no decision-making from you.
This is the product's core value: you think less, execute more.

**Execution** means GoalPilot is obsessed with doing, not planning. Planning is
a means to an end. The system minimizes time spent in planning mode and maximizes
time spent in execution mode. Every feature is evaluated against the question:
"Does this help the user complete a task today?"

**System** means GoalPilot is a closed loop, not a set of disconnected features.
Goal intake feeds the planning engine. The planning engine feeds the daily action
loop. The daily action loop feeds the progress tracker. The progress tracker
feeds the replanning engine. The replanning engine updates the plan. Every
component connects to every other component in a purposeful cycle.

### Core Principle: "Reduce Freedom, Increase Clarity"

This principle inverts the dominant product design philosophy. Most productivity
tools compete on flexibility — "You can use it however you want!" GoalPilot
competes on constraint — "You use it this way, and it works."

Constraint is a feature when the user's problem is not lack of options but lack
of direction. The target user does not need 47 ways to organize their goals.
They need one way that is good enough, applied consistently. GoalPilot provides
that one way.

## 1.4 Key Differentiators [R1][R2][R5][R7]

### vs. OpenClaw (Open-Source Agent Orchestration)

OpenClaw is infrastructure for developers building AI agent systems. It provides
primitives — task routing, tool orchestration, memory management — and lets
builders assemble them into products. GoalPilot could theoretically be built on
OpenClaw, but the two serve entirely different users. OpenClaw's user is a
developer. GoalPilot's user is a solopreneur who has never heard of agent
orchestration and does not want to. GoalPilot is a finished product, not a
platform. It makes every architectural decision so the end user does not have to.

### vs. Claude Dispatch (General AI Routing)

Claude Dispatch routes requests to appropriate AI models and tools. It is a
general-purpose routing layer. GoalPilot is a domain-specific application with
a single purpose: goal execution. Where Dispatch asks "What do you need?",
GoalPilot tells you what you need to do next. Dispatch is reactive; GoalPilot
is proactive. GoalPilot may use a routing layer internally, but the user never
sees it or thinks about it.

### vs. Auto-GPT (Autonomous Agent Loops)

Auto-GPT and its successors pursue full autonomy: give the AI a goal and let
it execute without human involvement. GoalPilot explicitly rejects this model.
Full autonomy is inappropriate for personal goals because: (a) the AI will be
wrong often enough to cause harm (R7); (b) the user learns nothing from watching
an AI work; (c) many goals require human judgment, creativity, and physical
action that AI cannot perform. GoalPilot is human-in-the-loop by design, not
as a stopgap until the AI gets better, but as a permanent architectural choice.

### vs. General Agent Platforms

General agent platforms (CrewAI, LangGraph, etc.) let developers build any kind
of agent workflow. They are maximally flexible and minimally opinionated.
GoalPilot is the opposite: minimally flexible and maximally opinionated. This
is not a weakness. For the target user, fewer choices means faster execution.
GoalPilot trades generality for effectiveness within its specific domain.

## 1.5 Target Users [R2][R4][R5]

GoalPilot serves three overlapping user archetypes:

**The Side Business Builder.** Has a full-time job and is building something on
the side — an Etsy shop, a newsletter, a SaaS product, a consulting practice.
Has 1-2 hours per day to dedicate. Needs ruthless prioritization because time is
the binding constraint. Cannot afford to waste a single session figuring out what
to work on. GoalPilot's daily action loop is designed for this user: open the
app, see today's tasks, execute, close the app.

**The Solopreneur.** Running their own business full-time but without a team.
Wears every hat: sales, marketing, product, operations, finance. Drowning in
competing priorities. Needs an external system to impose structure because
self-imposed structure collapses under the weight of daily fires. GoalPilot's
intensity modes (R4) and cross-goal balancing serve this user during both
steady-state and sprint phases.

**The Structured Self-Improver.** Pursuing personal development goals — fitness,
learning a skill, building a habit, writing a book. Has tried apps, spreadsheets,
accountability partners, and various systems. Keeps falling off after 2-3 weeks.
Needs a system that adapts when life intervenes (R1), provides visible progress
(R6), and does not require willpower to maintain. GoalPilot's calibration week
(R2) and stall detection (R6) are designed for this user.

### Common Thread

All three archetypes share a trait: they are ambitious and self-directed but
struggle with sustained execution. They do not lack motivation; they lack
structure. They do not need inspiration; they need a foreman.

## 1.6 What GoalPilot Is NOT [R3][R7]

**GoalPilot is not a todo app.** Todo apps are passive containers. You put items
in; you check them off. GoalPilot actively generates, sequences, and adapts your
tasks. If you already know exactly what to do every day, you do not need
GoalPilot. Use a todo app.

**GoalPilot is not an autonomous agent.** It does not take actions in the world
without your knowledge and approval. It does not log into your accounts, send
emails on your behalf, or make purchases — unless you explicitly grant permission
for specific action categories, and even then, within the tiered approval model
(R3). The human is always in the loop. Always.

**GoalPilot is not a project management tool.** It does not support team
collaboration, resource allocation across people, Gantt charts, or stakeholder
reporting. It is a single-player tool for individual execution. If you are
managing a team, use Linear or Jira or Asana. GoalPilot is for the person doing
the work, not the person assigning it.

**GoalPilot is not a life coach.** It does not provide emotional support,
motivational speeches, or therapy. Its tone is professional and direct — like a
competent foreman, not a cheerful app notification. When it detects a stall (R6),
it initiates a diagnostic conversation, not an inspirational pep talk.

**GoalPilot is not a general AI assistant.** You cannot ask it to write poems,
summarize articles, or answer trivia. It does one thing: help you execute goals.
Requests outside this scope are politely declined with a redirect to the goal
at hand.

## 1.7 Core Product Loop [R1][R2][R3][R4][R6]

The core product loop is a daily cycle with four phases. This is described
briefly here and elaborated in Section 3.

1. **Morning Check-In (2-3 minutes).** The system presents today's action plan:
   1-3 tasks (adjustable by intensity mode, R4), each with clear deliverables
   and estimated time. The user reviews, optionally swaps the flex task, and
   confirms. One approval action covers the entire day (R3). The check-in
   includes a brief "what changed?" prompt for disruption detection (R1).

2. **Execution Phase (user's day).** The user works through tasks at their own
   pace. GoalPilot provides supporting context for each task (relevant notes,
   resources from the DKP, prior related work) but does not interrupt. Optional
   mid-day nudge if no tasks are marked complete by a user-configured time.

3. **Evening Wrap-Up (1-2 minutes).** The user marks tasks complete or incomplete.
   For incomplete tasks, a brief reason (optional but encouraged). The system
   logs completion data for leading indicator tracking (R6).

4. **Background Planning (overnight).** The system processes the day's data:
   updates leading indicators, adjusts the plan graph if needed, selects
   tomorrow's tasks, and prepares the next morning's check-in. No user
   involvement. The user wakes up to a ready plan.

This loop is the heartbeat of GoalPilot. Every feature, every component, every
architectural decision exists to make this loop reliable, lightweight, and
effective. If the loop works, the product works. If the loop breaks, nothing
else matters.

---

---

## Section 2: Core Architecture

### 2.1 High-Level System Diagram

```
+------------------------------------------------------------------+
|                        CLIENT LAYER                               |
|  +--------------------+   +------------------+   +-----------+    |
|  | React Native App   |   | Web Dashboard    |   | Push/SMS  |    |
|  | (Daily Brief, Chat)|   | (Plan Builder)   |   | Notifier  |    |
|  +--------+-----------+   +--------+---------+   +-----+-----+    |
|           |                        |                    |          |
+-----------+------------------------+--------------------+----------+
            |         WebSocket / REST API                |
            v                                             v
+------------------------------------------------------------------+
|                       API GATEWAY (FastAPI)                       |
|  Auth | Rate Limit | Request Routing | Session Mgmt              |
+--+----------+----------+----------+----------+----------+--------+
   |          |          |          |          |          |
   v          v          v          v          v          v
+------+  +------+  +--------+  +------+  +------+  +--------+
|Plan- |  |Exec- |  |Agent   |  |Deci- |  |Appro-|  |Context |
|ning  |  |ution |  |Orches- |  |sion  |  |val   |  |Engine  |
|Engine|  |Engine|  |trator  |  |Engine|  |System|  |        |
+--+---+  +--+---+  +---+----+  +--+---+  +--+---+  +---+----+
   |         |           |          |         |          |
   |         |           |          |         |          |
   +----+----+-----------+----+-----+---------+----------+
        |                     |
        v                     v
+------------------+  +-------------------+
| Monitoring       |  |  AI Integration   |
| Service          |  |  (Claude API +    |
| (Circuit Breaker,|  |   Embeddings)     |
|  48-hr Watch)    |  +-------------------+
+------------------+
        |
        v
+------------------------------------------------------------------+
|                       DATA LAYER                                  |
|  +----------------+  +----------+  +------------+  +-----------+ |
|  | PostgreSQL     |  | Redis    |  | Task Queue |  | Blob      | |
|  | (Primary Store)|  | (Cache,  |  | (Celery /  |  | Storage   | |
|  |                |  |  Pubsub) |  |  SQS)      |  | (S3)      | |
|  +----------------+  +----------+  +------------+  +-----------+ |
+------------------------------------------------------------------+
        |
        v
+------------------------------------------------------------------+
|                   OBSERVABILITY                                   |
|  +------------------+  +----------------+  +------------------+  |
|  | Structured Logs  |  | OpenTelemetry  |  | Alerting         |  |
|  | (JSON, ELK)      |  | (Traces/Mtx)   |  | (PagerDuty/etc) |  |
|  +------------------+  +----------------+  +------------------+  |
+------------------------------------------------------------------+
```

### 2.2 Component Breakdown

#### 2.2.1 Planning Engine [R1][R2][R5]

The Planning Engine is the entry point for all goal creation. It owns the
entire flow from raw user intent to a fully parameterized, actionable plan.

**Responsibilities:**
- **Goal Intake** -- Accepts a user's stated goal and runs it through a
  structured diagnostic interview (questions pulled from the matched
  GoalTemplate). Captures the user's real-life context: budget, time
  available per day, existing commitments, hard deadlines.
- **Template Parameterization** -- Matches the goal to the best-fit
  GoalTemplate using embedding similarity search. Adjusts the template's
  default milestones, durations, and agent configurations based on diagnostic
  answers. [R1] Templates are starting points, not cages -- the engine trims
  or extends milestone sequences based on user context.
- **Milestone Generation** -- Produces a sequence of milestones with weekly
  targets, leading indicators, and checkpoint criteria. Each milestone has
  clear exit conditions so the system knows when to advance. [R5] Domain
  expertise is encoded in templates, not improvised at runtime.
- **Cold Start Bootstrapping** -- For brand-new users, the engine generates a
  deliberately simple first-week plan with low-friction tasks to build
  engagement velocity before ramping up. [R2]

#### 2.2.2 Execution Engine [R3][R4][R7]

The Execution Engine runs the daily loop -- the heartbeat of GoalPilot.

**Responsibilities:**
- **Daily Loop** -- Triggered each morning (adjusted to user timezone). Pulls
  active goals, current milestone state, and yesterday's outcomes. Produces
  the day's DailyBrief.
- **Task Generation** -- Generates 1-N tasks per goal for the day. The base
  cap is 1-3 tasks but is adaptive (see Decision Engine). [R4] The cap
  expands as engagement velocity proves the user can handle more.
- **Task Scoring** -- Each task receives a composite score:
  `impact * urgency * feasibility * momentum_alignment`. Tasks are ranked
  across all active goals so multi-goal users get the highest-leverage set.
- **Execution Tracking** -- Records task start, completion, skip, and
  partial-completion events. Feeds data back into momentum metrics.

#### 2.2.3 Agent Orchestrator [R5][R7]

Manages the lifecycle of micro-agents -- small, scoped AI workers that
perform specific actions on behalf of the user.

**Responsibilities:**
- **Agent Lifecycle** -- Spawns agents for specific task types (e.g.,
  "DraftEmailAgent", "ResearchAgent", "ScheduleAgent"). Each agent is
  short-lived and stateless between invocations.
- **Constraint Enforcement** -- Every agent has a declared scope of
  allowed_actions and a maximum confidence threshold for auto-execution.
  The orchestrator hard-blocks any action outside the agent's scope. [R7]
  An agent that is unsure routes to approval; an agent that tries to act
  outside its scope is terminated.
- **Sandboxing** -- Agents operate in a constrained environment. They cannot
  access user data outside their declared scope. External API calls are
  proxied through an allowlist.

#### 2.2.4 Decision Engine [R1][R4][R6]

Answers the question: "What matters today?"

**Responsibilities:**
- **What Matters Today Algorithm** -- Combines milestone deadlines, leading
  indicator trends, momentum state, and real-life context (e.g., user
  reported a busy day) to produce a ranked priority list.
- **Adaptive Caps** -- The 1-3 task default is a floor, not a ceiling. The
  engine raises the cap when engagement_velocity is high and lowers it when
  the user is falling behind. [R4] Cap adjustments are logged and explained
  to the user.
- **Multi-Goal Balancing** -- When a user has 2+ active goals, the engine
  allocates daily capacity proportionally based on goal priority, milestone
  urgency, and diminishing returns. A neglected goal gets boosted before it
  goes critical.
- **Adaptation Triggers** -- Detects when a plan is going off-track (leading
  indicators stall for 5+ days) and triggers re-planning. [R1][R6]

#### 2.2.5 Approval System [R3][R7]

Trust-gated routing for every action that modifies user state or interacts
with external systems.

**Responsibilities:**
- **Trust-Gated Routing** -- Actions are classified into tiers:
  - Tier 0 (Info-only): Always auto-approved. Reading data, generating
    drafts for review.
  - Tier 1 (Low-risk): Auto-approved after user reaches trust_level >= 2.
    Scheduling internal reminders, reorganizing task order.
  - Tier 2 (Medium-risk): Requires explicit approval until trust_level >= 4.
    Sending emails, making purchases under threshold.
  - Tier 3 (High-risk): Always requires approval. Financial transactions,
    public posts, irreversible actions.
- **Batched Approvals** -- Groups pending approvals into a single review
  screen to reduce approval fatigue. [R3] Users approve/reject in bulk
  rather than one-at-a-time interruptions.
- **Trust Escalation** -- Tracks approval patterns. If a user approves 10
  consecutive Tier-2 actions from an agent without modification, the system
  recommends upgrading that action category to auto-approve.

#### 2.2.6 Context Engine [R1][R2]

Maintains the user's real-world constraints and feeds them into every
planning and scheduling decision.

**Responsibilities:**
- **Real-Life Constraints** -- Stores and reasons about: available hours per
  day, budget limits, existing calendar commitments, energy levels
  (user-reported or inferred from behavior), location constraints.
- **Multi-Goal Balancing Context** -- Detects conflicts between goals (e.g.,
  "save money" vs. "take a cooking class") and surfaces trade-offs for user
  decision rather than silently optimizing.
- **Temporal Awareness** -- Knows about weekends, holidays, user-specific
  patterns (e.g., user never completes tasks on Fridays). Adjusts scheduling
  to match real behavior. [R1]
- **Onboarding Context** -- During cold start, infers initial constraints from
  minimal user input and refines aggressively over the first two weeks. [R2]

#### 2.2.7 Monitoring Service [R7]

Watches agent actions and system health to prevent harm.

**Responsibilities:**
- **48-Hour Watch** -- Every agent action that modifies external state enters
  a monitoring window. The system checks for negative outcomes (bounce-back
  emails, failed transactions, user complaints) and flags anomalies.
- **Circuit Breakers** -- If an agent's actions fail 3+ times in a window,
  the agent type is suspended for that user and an alert is raised. Global
  circuit breakers trigger if failure rates exceed thresholds across users.
- **Rollback** -- Every modifiable action stores a rollback plan. If the
  48-hour watch detects a problem, the system can auto-rollback (Tier 0-1
  actions) or present the rollback option to the user (Tier 2-3). [R7]
- **Health Dashboards** -- Exposes per-goal health scores, agent success
  rates, and system-wide metrics via structured logging and OpenTelemetry.

### 2.3 End-to-End Data Flow

```
User States Goal
      |
      v
[Planning Engine] --embedding search--> [GoalTemplate Match]
      |
      v
Diagnostic Interview (questions from template)
      |
      v
Template Parameterization (adjust milestones, durations, agents)
      |
      v
[Plan Generated] --> stored in PostgreSQL
      |
      v
=== DAILY LOOP (triggered by cron per user timezone) ===
      |
      v
[Context Engine] --> loads constraints, calendar, energy
      |
      v
[Decision Engine] --> "What matters today?" scoring
      |
      v
[Execution Engine] --> generates tasks, ranks by composite score
      |
      v
[DailyBrief] --> pushed to user via WebSocket / Push notification
      |
      v
User acts on tasks / approves automations
      |
      v
[Agent Orchestrator] --> spawns micro-agents for approved automations
      |
      v
[Approval System] --> gates actions by trust level
      |
      v
[Monitoring Service] --> 48-hour watch on all external actions
      |
      v
Outcomes recorded --> [MomentumMetrics] updated
      |
      v
[Decision Engine] --> adapts caps, re-ranks priorities
      |
      v
[Planning Engine] --> re-plans if leading indicators stall
```

### 2.4 Tech Stack Recommendations

| Layer          | Technology                  | Rationale                                      |
|----------------|-----------------------------|-------------------------------------------------|
| Backend        | Python 3.12+ / FastAPI      | Async-native, strong AI/ML ecosystem, fast dev  |
| Alt Backend    | Go                          | If latency/throughput needs outweigh dev speed   |
| Primary DB     | PostgreSQL 16+              | JSONB for flexible fields, strong consistency    |
| Cache/Pubsub   | Redis 7+                    | Session cache, real-time pubsub, rate limiting   |
| Task Queue     | Celery + Redis broker        | Async task execution, scheduled daily loops      |
| Alt Queue      | AWS SQS + Lambda             | If running on AWS, lower ops burden              |
| AI - Planning  | Claude API (Sonnet/Opus)     | Structured reasoning for plans and diagnostics   |
| AI - Matching  | Embeddings (Voyage/OpenAI)   | Template similarity search, goal classification  |
| Mobile         | React Native                 | Cross-platform, single codebase                  |
| Real-time      | WebSockets (FastAPI native)  | Daily brief push, live approval notifications    |
| Monitoring     | OpenTelemetry + Grafana      | Distributed tracing, metrics, dashboards         |
| Logging        | Structured JSON logs + ELK   | Searchable, parseable, audit trail               |
| Storage        | S3-compatible                | Agent action artifacts, rollback snapshots        |

---

## Section 3: Data Models

All models are expressed as TypeScript-style interfaces. Field constraints are
noted inline. These are intended to be directly translatable to SQL CREATE TABLE
statements or ORM model definitions.

### 3.1 User [R2][R3][R4]

```typescript
interface User {
  // === Identity ===
  id: string;                          // UUID v4, primary key
  email: string;                       // unique, validated format
  display_name: string;                // 1-100 chars
  avatar_url: string | null;           // nullable, URL to profile image
  timezone: string;                    // IANA timezone (e.g., "America/New_York")
  locale: string;                      // BCP 47 language tag, default "en-US"

  // === Authentication ===
  auth_provider: "email" | "google" | "apple";
  auth_provider_id: string;            // external provider user ID
  password_hash: string | null;        // nullable for OAuth-only users

  // === Onboarding [R2] ===
  onboarding_state: "not_started"
    | "goal_selection"
    | "diagnostic_interview"
    | "first_plan_generated"
    | "first_week_active"
    | "onboarded";                     // tracks cold-start progression
  onboarding_completed_at: Date | null;
  goals_created_count: number;         // default 0, used for cold-start logic

  // === Trust & Engagement [R3][R4] ===
  trust_level: number;                 // 0-5 integer, default 0
                                       // 0 = new user (all actions need approval)
                                       // 1 = completed first week
                                       // 2 = Tier 1 auto-approve unlocked
                                       // 3 = consistent 2+ week engagement
                                       // 4 = Tier 2 auto-approve unlocked
                                       // 5 = power user, max autonomy
  engagement_velocity: number;         // 0.0-1.0 float, rolling 14-day ratio
                                       // of completed tasks / generated tasks
  adaptive_task_cap: number;           // current daily task cap, default 3
                                       // min 1, max 10 [R4]
  consecutive_active_days: number;     // streak counter, resets on full-skip day

  // === Preferences ===
  notification_preferences: {
    daily_brief_time: string;          // HH:MM in user's timezone, default "08:00"
    daily_brief_channel: "push" | "sms" | "email";  // default "push"
    approval_requests: "immediate" | "batched";      // [R3] default "batched"
    batch_window_minutes: number;      // 15-480, default 60
    celebration_notifications: boolean; // default true
    quiet_hours_start: string | null;  // HH:MM or null
    quiet_hours_end: string | null;    // HH:MM or null
  };

  // === Real-Life Context [R1] ===
  default_available_hours_weekday: number;  // 0.0-16.0, hours available per weekday
  default_available_hours_weekend: number;  // 0.0-16.0, hours available per weekend day
  energy_pattern: "morning" | "afternoon" | "evening" | "variable";
  calendar_integration_enabled: boolean;    // default false
  calendar_provider: "google" | "outlook" | "apple" | null;

  // === Metadata ===
  created_at: Date;
  updated_at: Date;
  last_active_at: Date;
  is_active: boolean;                  // soft delete flag
}
```

### 3.2 Goal [R1][R4][R6]

```typescript
interface Goal {
  // === Identity ===
  id: string;                          // UUID v4, primary key
  user_id: string;                     // FK -> User.id
  template_id: string | null;          // FK -> GoalTemplate.id, null if custom

  // === Definition ===
  title: string;                       // user-facing name, 1-200 chars
  description: string;                 // free-text elaboration, max 2000 chars
  type: string;                        // from template domain: "fitness",
                                       // "career", "finance", "learning",
                                       // "health", "creative", "relationship"
  raw_user_input: string;              // the original goal statement before
                                       // parsing, preserved for audit

  // === Context Layer [R1] ===
  context_layer: {
    budget_cents: number | null;       // total budget in cents, null = no limit
    budget_remaining_cents: number | null;
    weekly_hours_available: number;    // hours user can dedicate per week
    existing_commitments: string[];    // free-text list of competing priorities
    hard_deadline: Date | null;        // null = open-ended
    soft_deadline: Date | null;        // aspirational target
    location_constraint: string | null; // e.g., "must be near downtown"
    tools_available: string[];         // e.g., ["gym_membership", "laptop"]
    prerequisites_met: boolean;        // has user completed necessary prereqs
    blockers: string[];                // known blockers at goal creation
  };

  // === Milestones ===
  milestones: Milestone[];             // ordered list, see sub-interface
  current_milestone_index: number;     // 0-based, which milestone is active

  // === Timeline ===
  start_date: Date;
  target_end_date: Date | null;
  actual_end_date: Date | null;

  // === Status & Priority ===
  status: "draft"
    | "active"
    | "paused"
    | "completed"
    | "abandoned"
    | "replanning";                    // "replanning" = adaptation in progress
  priority_rank: number;               // 1 = highest, unique per user among
                                       // active goals. Used by Decision Engine
                                       // for multi-goal balancing [R4]

  // === Health [R6] ===
  health_score: number;                // 0.0-1.0, composite metric
                                       // >= 0.7 = on track (green)
                                       // 0.4-0.69 = at risk (yellow)
                                       // < 0.4 = off track (red)
  health_score_updated_at: Date;
  leading_indicator_values: Record<string, number>;
                                       // key = indicator name from template,
                                       // value = current measured value
  days_since_progress: number;         // 0 = progressed today, triggers
                                       // re-plan alert at 5+

  // === Metadata ===
  created_at: Date;
  updated_at: Date;
}

interface Milestone {
  id: string;                          // UUID v4
  title: string;                       // 1-200 chars
  description: string;                 // what success looks like
  order: number;                       // 0-based sequence position
  status: "pending" | "active" | "completed" | "skipped";
  weekly_targets: WeeklyTarget[];
  exit_criteria: string[];             // conditions to advance to next milestone
  exit_criteria_met: boolean[];        // parallel array, true/false per criterion
  estimated_duration_days: number;
  actual_duration_days: number | null;
  started_at: Date | null;
  completed_at: Date | null;
}

interface WeeklyTarget {
  week_number: number;                 // 1-based within milestone
  description: string;                 // what to achieve this week
  target_metric: string | null;        // quantifiable target if applicable
  target_value: number | null;
  actual_value: number | null;
  status: "upcoming" | "active" | "completed" | "missed";
}
```

### 3.3 GoalTemplate [R1][R2][R5]

```typescript
interface GoalTemplate {
  // === Identity ===
  id: string;                          // UUID v4, primary key
  slug: string;                        // unique, URL-safe identifier
                                       // e.g., "run-first-5k"
  version: number;                     // integer, incremented on template update
  is_active: boolean;                  // false = deprecated, not offered to users

  // === Classification ===
  domain: string;                      // "fitness" | "career" | "finance" | etc.
  title: string;                       // user-facing, 1-200 chars
  short_description: string;           // 1-line summary, max 300 chars
  long_description: string;            // detailed explanation, max 5000 chars
  tags: string[];                      // searchable tags for discovery
  difficulty_level: "beginner"
    | "intermediate"
    | "advanced";                      // [R2] beginners see "beginner" first
  estimated_duration_days: number;     // typical time to complete
  estimated_weekly_hours: number;      // typical weekly commitment

  // === Embedding [R1][R2] ===
  embedding_vector: number[];          // 1536-dim float array for similarity
                                       // search during goal intake

  // === Diagnostic Interview [R1][R5] ===
  diagnostic_questions: DiagnosticQuestion[];
                                       // asked during goal intake to
                                       // parameterize the plan

  // === Blueprint [R5] ===
  milestone_templates: MilestoneTemplate[];
                                       // ordered default milestones,
                                       // parameterized during planning
  allowed_actions: string[];           // exhaustive list of action types
                                       // agents may perform for this goal
                                       // e.g., ["send_email", "schedule_event",
                                       // "web_research", "generate_checklist"]
  automation_rules: AutomationRule[];  // pre-defined automations that can
                                       // fire without per-instance approval
                                       // once trust is sufficient

  // === Indicators [R6] ===
  leading_indicators: LeadingIndicator[];
                                       // what to measure to predict success
                                       // BEFORE the outcome is visible

  // === Agent Configuration [R7] ===
  default_agent_config: {
    agent_roles: string[];             // which agent types this goal uses
    max_concurrent_agents: number;     // default 2, max 5
    default_confidence_threshold: number;
                                       // 0.0-1.0, below this agents must
                                       // request approval. Default 0.8 [R7]
    sandbox_level: "strict" | "standard" | "relaxed";
                                       // default "standard"
  };

  // === Metadata ===
  created_by: string;                  // admin user ID or "system"
  created_at: Date;
  updated_at: Date;
  usage_count: number;                 // how many users have used this template
  avg_completion_rate: number;         // 0.0-1.0, historical success rate
  avg_completion_days: number | null;  // historical average
}

interface DiagnosticQuestion {
  id: string;                          // UUID v4
  order: number;                       // display order
  question_text: string;               // the question shown to user
  question_type: "single_choice"
    | "multi_choice"
    | "numeric"
    | "free_text"
    | "date"
    | "boolean";
  options: string[] | null;            // for choice types
  default_value: string | null;
  is_required: boolean;
  affects_fields: string[];            // which plan fields this answer
                                       // parameterizes, e.g.,
                                       // ["milestone_count", "weekly_hours"]
  validation_rule: string | null;      // regex or range expression
}

interface MilestoneTemplate {
  order: number;
  title_template: string;              // may contain {{variables}}
  description_template: string;
  default_duration_days: number;
  min_duration_days: number;
  max_duration_days: number;
  exit_criteria_templates: string[];
  is_optional: boolean;                // [R1] can be skipped based on diagnostics
  skip_condition: string | null;       // expression evaluated against diagnostic
                                       // answers, e.g., "experience_level > 3"
}

interface AutomationRule {
  id: string;
  action_type: string;                 // must be in allowed_actions
  trigger: string;                     // e.g., "task_completed", "milestone_start"
  condition: string | null;            // optional guard expression
  description: string;                 // human-readable explanation
  min_trust_level: number;             // trust level required for auto-execute
  tier: 0 | 1 | 2 | 3;               // approval tier override
}

interface LeadingIndicator {
  name: string;                        // e.g., "workouts_per_week"
  description: string;
  measurement_method: "user_reported"
    | "auto_tracked"
    | "agent_measured";
  target_value: number;
  unit: string;                        // e.g., "sessions", "dollars", "hours"
  measurement_frequency: "daily" | "weekly" | "milestone";
  stall_threshold_days: number;        // days without improvement before alert
                                       // default 5 [R6]
}
```

### 3.4 Plan [R1][R6]

```typescript
interface Plan {
  // === Identity ===
  id: string;                          // UUID v4, primary key
  goal_id: string;                     // FK -> Goal.id
  user_id: string;                     // FK -> User.id, denormalized for queries
  version: number;                     // incremented on re-plan, starts at 1

  // === Generation Context ===
  template_id: string | null;          // FK -> GoalTemplate.id
  diagnostic_answers: Record<string, any>;
                                       // user's answers to diagnostic questions
                                       // keyed by DiagnosticQuestion.id
  generation_prompt_hash: string;      // hash of the AI prompt used to generate
                                       // this plan, for reproducibility
  generated_by_model: string;          // e.g., "claude-sonnet-4-20250514"

  // === Content ===
  summary: string;                     // AI-generated plan summary, max 1000 chars
  approach_description: string;        // longer explanation of the strategy
  weekly_targets: PlanWeeklyTarget[];  // full weekly breakdown
  total_estimated_weeks: number;
  milestones_snapshot: Milestone[];    // milestones as generated (Goal.milestones
                                       // may diverge due to adaptation)

  // === Adaptation History [R1] ===
  adaptation_history: AdaptationRecord[];
  times_replanned: number;             // count of re-plans triggered
  last_adaptation_at: Date | null;
  adaptation_reason: string | null;    // why the most recent re-plan happened

  // === Status ===
  status: "active" | "superseded" | "abandoned";
                                       // "superseded" = replaced by newer version
  is_current: boolean;                 // only one plan per goal is current

  // === Metadata ===
  created_at: Date;
  updated_at: Date;
}

interface PlanWeeklyTarget {
  week_number: number;                 // 1-based from plan start
  milestone_id: string;                // which milestone this week belongs to
  focus_area: string;                  // short description of week's theme
  target_tasks_count: number;          // expected tasks generated this week
  target_hours: number;                // expected time commitment
  key_deliverables: string[];          // concrete outputs expected
}

interface AdaptationRecord {
  id: string;                          // UUID v4
  timestamp: Date;
  trigger: "leading_indicator_stall"
    | "user_requested"
    | "milestone_missed"
    | "context_change"
    | "health_score_critical";         // [R6] what caused the adaptation
  description: string;                 // human-readable explanation
  changes_made: {
    field: string;                     // what was changed
    old_value: any;
    new_value: any;
  }[];
  approved_by_user: boolean;           // was this adaptation user-approved
}
```

### 3.5 Task [R3][R4][R7]

```typescript
interface Task {
  // === Identity ===
  id: string;                          // UUID v4, primary key
  goal_id: string;                     // FK -> Goal.id
  plan_id: string;                     // FK -> Plan.id
  milestone_id: string;                // FK -> Milestone.id
  user_id: string;                     // FK -> User.id, denormalized
  daily_brief_id: string | null;       // FK -> DailyBrief.id, null if ad-hoc

  // === Definition ===
  type: "action" | "automation";       // "action" = user does it
                                       // "automation" = agent does it
  title: string;                       // user-facing, 1-300 chars
  description: string;                 // detailed instructions, max 2000 chars
  auto_generated_content: string | null;
                                       // for automations: the draft content
                                       // the agent produced (email draft, etc.)

  // === Scheduling ===
  scheduled_date: Date;                // the day this task is assigned to
  estimated_effort_minutes: number;    // AI estimate, 5-480
  actual_effort_minutes: number | null; // user-reported after completion
  suggested_time_of_day: "morning"
    | "afternoon"
    | "evening"
    | "anytime";                       // based on user energy_pattern
  sort_order: number;                  // position within daily brief

  // === Status ===
  status: "pending"
    | "approved"
    | "in_progress"
    | "completed"
    | "skipped"
    | "deferred"
    | "failed";
  started_at: Date | null;
  completed_at: Date | null;
  skipped_reason: string | null;       // user can explain why they skipped
  deferred_to_date: Date | null;       // if deferred, when rescheduled to

  // === Approval [R3] ===
  approval_state: "not_required"       // action tasks by default
    | "pending_approval"               // waiting for user
    | "approved"
    | "rejected"
    | "auto_approved";                 // trust level was sufficient [R3]
  approval_tier: 0 | 1 | 2 | 3;       // which tier this task falls into
  approved_at: Date | null;
  approved_by: "user" | "auto" | null;

  // === AI Confidence [R7] ===
  confidence_score: number;            // 0.0-1.0, how confident the AI is
                                       // that this task is correct and helpful
                                       // < 0.6 = flagged for review
  confidence_reasoning: string;        // brief explanation of confidence level
  alternative_tasks: string[] | null;  // if confidence is low, suggest
                                       // alternatives [R7]

  // === Dependencies ===
  dependencies: string[];              // Task.id[] that must complete first
  blocks: string[];                    // Task.id[] that depend on this task

  // === Scoring (from Decision Engine) ===
  impact_score: number;                // 0.0-1.0
  urgency_score: number;               // 0.0-1.0
  feasibility_score: number;           // 0.0-1.0
  momentum_alignment_score: number;    // 0.0-1.0
  composite_score: number;             // weighted product of above scores

  // === Metadata ===
  created_at: Date;
  updated_at: Date;
}
```

### 3.6 Agent [R5][R7]

```typescript
interface Agent {
  // === Identity ===
  id: string;                          // UUID v4, primary key
  template_id: string;                 // FK -> GoalTemplate.id this agent
                                       // is configured for
  role: string;                        // e.g., "email_drafter", "researcher",
                                       // "scheduler", "content_generator"
  display_name: string;                // user-facing name, 1-100 chars
  description: string;                 // what this agent does, max 500 chars

  // === Scope & Constraints [R7] ===
  allowed_actions: string[];           // exhaustive list of permitted action
                                       // types. Agent CANNOT perform actions
                                       // outside this list.
  prohibited_actions: string[];        // explicit deny-list, overrides allowed
  scope_description: string;           // natural-language scope boundary
  max_confidence_for_auto_execute: number;
                                       // 0.0-1.0, actions with confidence
                                       // above this AND sufficient trust_level
                                       // can auto-execute. Default 0.85
  min_confidence_to_act: number;       // below this, agent declines and
                                       // surfaces uncertainty. Default 0.4

  // === Constraints ===
  max_actions_per_day: number;         // rate limit, default 10
  max_cost_per_action_cents: number;   // spending cap, default 0 (free only)
  max_external_api_calls: number;      // per invocation, default 5
  timeout_seconds: number;             // max execution time, default 30
  sandbox_level: "strict"              // no external access
    | "standard"                       // allowlisted external access
    | "relaxed";                       // broader access (requires trust >= 4)

  // === Model Configuration ===
  ai_model: string;                    // which model to use, e.g., "claude-sonnet"
  system_prompt: string;               // the agent's system prompt
  temperature: number;                 // 0.0-1.0, default 0.3
  max_tokens: number;                  // per invocation, default 2048

  // === Status ===
  is_active: boolean;
  suspended_until: Date | null;        // set by circuit breaker
  suspension_reason: string | null;

  // === Metadata ===
  created_at: Date;
  updated_at: Date;
  total_actions_executed: number;
  success_rate: number;                // 0.0-1.0, rolling 30-day [R7]
}
```

### 3.7 AgentAction [R7]

```typescript
interface AgentAction {
  // === Identity ===
  id: string;                          // UUID v4, primary key
  agent_id: string;                    // FK -> Agent.id
  task_id: string;                     // FK -> Task.id
  user_id: string;                     // FK -> User.id

  // === Action Details ===
  action_type: string;                 // must be in Agent.allowed_actions
  description: string;                 // human-readable summary of what was done
  input_data: Record<string, any>;     // structured input to the action
  output_data: Record<string, any> | null;
                                       // structured output, null if failed
  external_service: string | null;     // if action hit an external API,
                                       // which one (e.g., "gmail", "calendar")
  external_request_id: string | null;  // for tracing external calls

  // === Confidence & Reasoning [R7] ===
  confidence_score: number;            // 0.0-1.0, how confident the agent was
  confidence_reasoning: string;        // why this confidence level
  was_auto_executed: boolean;          // true if bypassed approval
  approval_record_id: string | null;   // FK -> ApprovalRecord.id if approved

  // === Rollback [R7] ===
  rollback_plan: {
    is_rollbackable: boolean;          // can this action be undone?
    rollback_steps: string[];          // ordered steps to undo
    rollback_deadline: Date | null;    // after this, rollback may not work
    rollback_executed: boolean;        // was rollback actually performed
    rollback_executed_at: Date | null;
  };

  // === Monitoring ===
  monitoring_window_hours: number;     // how long to watch for problems,
                                       // default 48
  monitoring_status: "watching"
    | "clear"
    | "anomaly_detected"
    | "rolled_back"
    | "expired";                       // "expired" = window closed, no issues
  monitoring_start_at: Date;
  monitoring_end_at: Date;
  anomalies_detected: string[];        // list of detected issues

  // === Outcome ===
  outcome: "success"
    | "partial_success"
    | "failure"
    | "rolled_back"
    | "pending";
  outcome_notes: string | null;        // details on outcome
  user_feedback: "positive"
    | "negative"
    | "neutral"
    | null;                            // explicit user feedback on this action

  // === Cost ===
  cost_cents: number;                  // actual cost incurred, default 0
  tokens_used: number;                 // AI tokens consumed

  // === Metadata ===
  created_at: Date;
  completed_at: Date | null;
  duration_ms: number | null;          // execution time
}
```

### 3.8 DailyBrief [R2][R3][R4]

```typescript
interface DailyBrief {
  // === Identity ===
  id: string;                          // UUID v4, primary key
  user_id: string;                     // FK -> User.id
  brief_date: Date;                    // the date this brief is for
                                       // unique per user per day

  // === Tasks ===
  tasks: Task[];                       // ordered by composite_score descending
  total_tasks: number;                 // count, respects adaptive_task_cap [R4]
  action_tasks_count: number;          // tasks requiring user effort
  automation_tasks_count: number;      // tasks agents will handle

  // === Automations Summary [R3] ===
  automations_summary: {
    pending_approval_count: number;    // how many need user sign-off
    auto_approved_count: number;       // how many were auto-approved
    completed_since_last_brief: number; // automations done since yesterday
    highlights: string[];              // top 3 automation outcomes to show user
  };

  // === Momentum Metrics ===
  momentum: {
    current_streak_days: number;       // consecutive days with >= 1 completion
    longest_streak_days: number;       // all-time best streak
    engagement_velocity: number;       // 0.0-1.0, 14-day rolling
    weekly_completion_rate: number;    // 0.0-1.0, this week so far
    trend: "improving"
      | "steady"
      | "declining";                   // compared to prior 7 days
  };

  // === Streak & Celebration ===
  streak_info: {
    is_milestone_streak: boolean;      // e.g., 7-day, 30-day, 100-day
    streak_milestone_value: number | null;
    celebration_message: string | null; // AI-generated encouragement [R2]
    process_celebration: string | null; // celebrate effort, not just outcomes
  };

  // === Goal Health Overview [R6] ===
  goal_summaries: {
    goal_id: string;
    goal_title: string;
    health_score: number;
    health_status: "green" | "yellow" | "red";
    current_milestone_title: string;
    days_until_milestone_deadline: number | null;
    top_leading_indicator: string | null;
    leading_indicator_trend: "up" | "flat" | "down" | null;
  }[];

  // === Daily Context ===
  estimated_total_effort_minutes: number;
  available_minutes_today: number;     // from Context Engine
  capacity_utilization: number;        // 0.0-1.0, effort / available
  day_type: "normal"
    | "light"
    | "heavy"
    | "recovery";                      // [R1] adjusted based on context

  // === Delivery ===
  generated_at: Date;
  delivered_at: Date | null;
  delivered_via: "push" | "sms" | "email" | "in_app" | null;
  opened_at: Date | null;

  // === Metadata ===
  created_at: Date;
  updated_at: Date;
}
```

### 3.9 TrustLevel [R3][R7]

```typescript
interface TrustLevel {
  // === Identity ===
  id: string;                          // UUID v4, primary key
  user_id: string;                     // FK -> User.id

  // === Current Level ===
  current_level: number;               // 0-5, mirrors User.trust_level
  level_achieved_at: Date;             // when current level was reached

  // === Level Definitions (system-wide config, stored per-user for overrides) ===
  level_config: TrustLevelConfig[];

  // === Escalation Tracking ===
  total_approvals_given: number;       // lifetime count
  total_approvals_rejected: number;    // lifetime rejections
  total_approvals_modified: number;    // approved but user edited the content
  consecutive_approvals_current: number;
                                       // current streak of unmodified approvals
                                       // resets on rejection or modification
  auto_approve_threshold: number;      // consecutive approvals needed before
                                       // system recommends trust upgrade,
                                       // default 10

  // === Escalation Criteria ===
  escalation_criteria: {
    min_days_at_current_level: number; // minimum tenure before upgrade, default 7
    min_approval_count: number;        // minimum approvals at this level, default 10
    max_rejection_rate: number;        // 0.0-1.0, rejection rate must be below
                                       // this to escalate, default 0.1
    requires_manual_review: boolean;   // for levels 4-5, admin must confirm
  };

  // === Per-Action-Type Trust [R3] ===
  action_type_trust: Record<string, {
    auto_approve_enabled: boolean;
    consecutive_approvals: number;
    last_rejection_at: Date | null;
    override_tier: number | null;      // if set, overrides default tier for
                                       // this action type for this user
  }>;

  // === History ===
  level_history: {
    level: number;
    achieved_at: Date;
    reason: string;                    // e.g., "10 consecutive approvals",
                                       // "admin override"
  }[];

  // === Metadata ===
  created_at: Date;
  updated_at: Date;
}

interface TrustLevelConfig {
  level: number;                       // 0-5
  name: string;                        // e.g., "New User", "Trusted", "Power User"
  description: string;
  auto_approve_tiers: number[];        // which tiers auto-approve at this level
                                       // e.g., level 2 = [0, 1]
  max_daily_auto_approvals: number;    // safety cap on auto-approvals per day
  max_auto_approve_cost_cents: number; // max cost per auto-approved action
  capabilities_unlocked: string[];     // features unlocked at this level
}
```

### 3.10 ApprovalRecord [R3]

```typescript
interface ApprovalRecord {
  // === Identity ===
  id: string;                          // UUID v4, primary key
  user_id: string;                     // FK -> User.id
  task_id: string;                     // FK -> Task.id
  agent_action_id: string | null;      // FK -> AgentAction.id, null if manual task

  // === Request ===
  action_type: string;                 // what type of action needed approval
  action_description: string;          // human-readable description
  action_tier: 0 | 1 | 2 | 3;        // approval tier
  requested_at: Date;
  auto_approve_eligible: boolean;      // was this eligible for auto-approve
                                       // based on current trust level

  // === Decision ===
  decision: "approved"
    | "rejected"
    | "modified_and_approved"
    | "auto_approved"
    | "expired";                       // expired = user never responded
  decided_at: Date | null;
  decision_latency_seconds: number | null;
                                       // time between request and decision

  // === Modification Details ===
  original_content: string | null;     // what the agent proposed
  modified_content: string | null;     // what the user changed it to
  modification_severity: "none"
    | "minor"
    | "major" | null;                  // how much the user changed
                                       // "major" modifications reset
                                       // consecutive_approvals count

  // === Feedback ===
  user_feedback: string | null;        // optional free-text from user
  rejection_reason: string | null;     // if rejected, why

  // === Trust Impact ===
  trust_level_at_decision: number;     // user's trust level when decided
  contributed_to_escalation: boolean;  // did this approval count toward
                                       // trust level upgrade

  // === Batch Context [R3] ===
  batch_id: string | null;            // if part of a batched approval session
  batch_position: number | null;       // order within batch

  // === Metadata ===
  created_at: Date;
}
```

### 3.11 MomentumMetrics [R2][R6]

```typescript
interface MomentumMetrics {
  // === Identity ===
  id: string;                          // UUID v4, primary key
  user_id: string;                     // FK -> User.id
  goal_id: string | null;              // FK -> Goal.id, null = aggregate across
                                       // all goals
  date: Date;                          // the date these metrics are for
                                       // unique per (user_id, goal_id, date)

  // === Streaks ===
  current_streak_days: number;         // consecutive active days, min 0
  longest_streak_days: number;         // all-time best, never decreases
  streak_started_at: Date | null;      // when current streak began
  streak_broken_count: number;         // total times streak was broken
  last_streak_broken_at: Date | null;

  // === Velocity [R4] ===
  engagement_velocity: number;         // 0.0-1.0, tasks completed / tasks
                                       // generated over rolling 14 days
  velocity_7d: number;                 // 0.0-1.0, 7-day rolling velocity
  velocity_30d: number;               // 0.0-1.0, 30-day rolling velocity
  velocity_trend: "improving"
    | "steady"
    | "declining";                     // compared to prior period

  // === Completion Stats ===
  tasks_generated_today: number;
  tasks_completed_today: number;
  tasks_skipped_today: number;
  tasks_deferred_today: number;
  tasks_generated_this_week: number;
  tasks_completed_this_week: number;
  weekly_completion_rate: number;      // 0.0-1.0

  // === Effort ===
  estimated_effort_today_minutes: number;
  actual_effort_today_minutes: number;
  effort_accuracy: number | null;      // actual / estimated, null if no data
                                       // used to improve future estimates

  // === Process Celebrations [R2] ===
  celebrations_earned: {
    type: "streak_milestone"           // 7, 14, 30, 60, 100 days
      | "first_completion"             // first ever task completed
      | "milestone_reached"            // completed a plan milestone
      | "velocity_record"              // new personal best velocity
      | "consistency_badge"            // completed tasks 5+ days in a row
      | "comeback"                     // resumed after 3+ day gap
      | "goal_completed";             // finished a goal
    label: string;                     // display text
    earned_at: Date;
    acknowledged: boolean;             // has user seen this celebration
  }[];

  // === Leading Indicators [R6] ===
  leading_indicator_snapshots: {
    indicator_name: string;            // matches GoalTemplate.leading_indicators
    current_value: number;
    target_value: number;
    percent_of_target: number;         // 0.0-1.0+
    trend: "up" | "flat" | "down";
    days_since_improvement: number;    // triggers stall alert at threshold
  }[];

  // === Adaptive Cap Data [R4] ===
  task_cap_at_date: number;            // what the adaptive cap was on this date
  cap_adjustment_reason: string | null; // why cap was changed, if it was

  // === Metadata ===
  created_at: Date;
  updated_at: Date;
}
```

---

### Risk Coverage Matrix

| Risk | Models Addressing It |
|------|---------------------|
| **R1**: Template rigidity vs real life | Goal.context_layer, GoalTemplate.diagnostic_questions, GoalTemplate.MilestoneTemplate.is_optional, Plan.adaptation_history, DailyBrief.day_type, User.default_available_hours_* |
| **R2**: Cold start problem | User.onboarding_state, GoalTemplate.difficulty_level, GoalTemplate.embedding_vector, DailyBrief.streak_info, MomentumMetrics.celebrations_earned |
| **R3**: Approval fatigue | User.notification_preferences.approval_requests, Task.approval_state, TrustLevel (entire model), ApprovalRecord (entire model), DailyBrief.automations_summary |
| **R4**: Task cap limitations | User.adaptive_task_cap, User.engagement_velocity, Goal.priority_rank, DailyBrief.total_tasks, MomentumMetrics.velocity_*, MomentumMetrics.task_cap_at_date |
| **R5**: Domain expertise cost | GoalTemplate (entire model), Agent.system_prompt, Agent.allowed_actions, GoalTemplate.default_agent_config |
| **R6**: Measuring success | Goal.health_score, Goal.leading_indicator_values, GoalTemplate.leading_indicators, Plan.adaptation_history, MomentumMetrics.leading_indicator_snapshots |
| **R7**: AI being wrong | Agent.max_confidence_for_auto_execute, Agent.min_confidence_to_act, AgentAction.confidence_score, AgentAction.rollback_plan, AgentAction.monitoring_*, Task.confidence_score, Task.alternative_tasks, TrustLevel (entire model) |
---

## Section 4: Planning Engine

The Planning Engine is the strategic brain of GoalPilot. It transforms a user's
raw intention ("I want to grow a Turo business") into a structured, time-bound,
actionable plan with milestones, weekly targets, and daily tasks. Unlike generic
goal-setting apps that accept free-form input, GoalPilot uses guided diagnostic
questions and domain-specific templates to generate plans that are grounded in
real expertise. [R1] [R5]

---

### 4.1 Goal Intake: Guided Diagnostic Questions

GoalPilot does NOT use free-form goal entry. Users do not type "what's your goal"
into an empty text box. Instead, the system walks them through a structured intake
flow designed to extract the information necessary to build a realistic plan. [R2]

**Why guided intake matters:**
- Free-form goals are vague ("make more money", "get healthy") and lead to vague plans
- Users often don't know what information is relevant to planning
- Guided questions force specificity, which produces better plans
- The system can match answers to known templates and domain expertise [R5]

**Intake flow structure:**

```
Step 1: Category Selection
  User picks from high-level goal categories:
    - Business / Side Hustle
    - Health / Fitness
    - Learning / Skills
    - Creative / Content
    - Career / Professional
    - Financial

Step 2: Subcategory Narrowing
  Based on category, system presents 4-8 specific goal types.
  Example for "Business / Side Hustle":
    - Start a Turo rental business
    - Launch a SaaS product
    - Grow a freelance practice
    - Start an e-commerce store
    - Monetize a newsletter
    - Build a consulting business

Step 3: Diagnostic Questions
  System presents 8-10 domain-specific questions tailored to the
  selected goal type. These are NOT generic. Each template defines
  its own diagnostic set.

Step 4: Constraint Capture
  Universal questions about time, budget, energy, and competing
  priorities. These apply to ALL goal types.

Step 5: Plan Generation
  System matches answers to a template, parameterizes it, applies
  constraints, and generates the initial plan.
```

**Cold start mitigation:** [R2]
For new users, the intake flow includes 3-4 additional "calibration" questions:
- "How would you describe your typical day structure?" (time availability signal)
- "When you've tried something like this before, what usually stopped you?" (failure mode detection)
- "On a scale of 1-5, how comfortable are you with ambiguity?" (autonomy calibration)
- "Do you prefer detailed daily instructions or weekly goals with flexibility?" (plan granularity signal)

These calibration answers persist across goals and improve plan quality over time.

---

### 4.2 Template Selection and Parameterization

Templates are the domain expertise layer of GoalPilot. Each template encodes
knowledge about HOW to achieve a specific type of goal — the milestones that
matter, the leading indicators to track, the common pitfalls, and the automations
that help. [R5]

**Template architecture:**

```
Template {
  id: string
  name: string
  description: string
  category: GoalCategory
  diagnostic_questions: DiagnosticQuestion[]    // 8-10 per template
  milestone_generator: (answers) => Milestone[]  // Parameterized generation
  leading_indicators: Indicator[]                // Domain-specific metrics
  allowed_automations: Automation[]              // What agents can do
  default_agent_assignments: AgentAssignment[]   // Which agents activate
  difficulty_estimate: (answers) => DifficultyLevel
  typical_duration_weeks: { min: number, max: number }
  common_failure_modes: FailureMode[]            // Known pitfalls
  replan_triggers: ReplanTrigger[]               // When to adjust
}
```

**Parameterization process:**
The system does not use templates as rigid blueprints. Instead, diagnostic answers
parameterize the template — adjusting timelines, milestone order, task complexity,
and resource requirements based on the user's specific situation. [R1]

```
Example parameterization for "Grow a Turo business":

  User answers: "I have $15,000 budget, 0 cars, live in Austin, TX,
                 can spend 10 hours/week, never hosted before"

  Template generates:
    - Extended Phase 1 (vehicle acquisition) because 0 cars
    - Austin-specific market research tasks
    - Conservative pricing strategy (new host)
    - Longer timeline (16 weeks vs 10 for experienced hosts)
    - Extra education milestones (Turo policies, insurance, etc.)

  vs.

  User answers: "I have $40,000 budget, 2 cars already listed, live in
                 Miami, FL, can spend 20 hours/week, 6 months hosting"

  Template generates:
    - Skip Phase 1, start at fleet optimization
    - Miami market competitive analysis tasks
    - Dynamic pricing strategy (experienced host)
    - Shorter timeline (8 weeks)
    - Growth-focused milestones (fleet expansion, automation)
```

---

### 4.3 Template Definitions

#### Template 1: "Grow a Turo Business"

**Description:** Build or scale a car-sharing business on Turo, from first
vehicle acquisition through fleet management and optimization.

**Diagnostic Questions:**

| # | Question | Answer Type | Why It Matters |
|---|----------|-------------|----------------|
| 1 | How many vehicles do you currently have listed on Turo? | Number (0-20+) | Determines starting phase |
| 2 | What is your total budget for this goal? | Currency range | Constrains vehicle acquisition and marketing |
| 3 | What city/metro area will you operate in? | Location | Market-specific pricing, demand patterns, regulations |
| 4 | How many hours per week can you dedicate? | Range (5-40) | Determines pace and automation needs |
| 5 | Do you have experience with car maintenance or detailing? | Yes/Some/No | Affects outsourcing recommendations |
| 6 | What is your monthly income target from Turo? | Currency | Sets fleet size target and pricing strategy |
| 7 | Do you have a place to park/store multiple vehicles? | Yes/No/Can arrange | Logistics constraint |
| 8 | Are you open to financing vehicles or cash only? | Finance/Cash/Either | Affects vehicle selection and ROI calculations |
| 9 | What vehicle types interest you? (Economy, SUV, Luxury, Specialty) | Multi-select | Fleet composition strategy |
| 10 | Have you read Turo's host policies and insurance options? | Yes/Partially/No | Education milestone inclusion |

**Milestone Structure:**
- M1: Market Research & Vehicle Selection (Week 1-2)
- M2: First Vehicle Acquisition & Setup (Week 2-4)
- M3: Listing Optimization & First Bookings (Week 4-6)
- M4: Guest Management & Reviews (Week 6-8)
- M5: Fleet Expansion Planning (Week 8-10)
- M6: Scaling & Automation (Week 10-14)

**Leading Indicators:**
- Listing views per day
- Booking request rate (requests / views)
- Average daily rate vs market average
- Response time to guest inquiries
- Review score trajectory
- Vehicle utilization rate (booked days / available days)

**Allowed Automations:**
- Market price monitoring and alerts
- Listing description optimization suggestions
- Automated guest message templates (approval required to activate)
- Competitor pricing tracking
- Revenue and expense tracking

**Default Agent Assignments:**
- Research Agent: market analysis, vehicle comparisons, regulation lookup
- Content Agent: listing descriptions, guest communication templates
- Analytics Agent: pricing data, utilization tracking, revenue reports
- Marketing Agent: listing optimization suggestions (no direct spend)

---

#### Template 2: "Launch a SaaS"

**Description:** Take a software product idea from validation through MVP
launch and first paying customers.

**Diagnostic Questions:**

| # | Question | Answer Type | Why It Matters |
|---|----------|-------------|----------------|
| 1 | Describe your SaaS idea in one sentence. | Short text | Core concept for validation research |
| 2 | Who is your target customer? | Text + select (B2B/B2C/B2B2C) | Determines go-to-market strategy |
| 3 | Can you build the product yourself, or do you need a developer? | Self/Need dev/Have team | Timeline and budget implications |
| 4 | What is your budget for the first 6 months? | Currency range | Constrains tooling, marketing, hiring |
| 5 | Have you talked to potential customers about this problem? | Yes (N people)/No | Validation phase depth |
| 6 | Are there existing solutions? Who are your competitors? | Text | Competitive positioning research |
| 7 | What is your target price point? | Currency/month | Revenue model and customer acquisition strategy |
| 8 | How many hours per week can you dedicate? | Range | Pace of development and launch timeline |
| 9 | Do you have an existing audience or distribution channel? | Yes (describe)/No | Launch strategy (warm vs cold) |
| 10 | What does success look like at 3 months? | Select (Revenue/Users/Validation) | Milestone prioritization |

**Milestone Structure:**
- M1: Problem Validation (Week 1-3)
- M2: Solution Design & Competitive Analysis (Week 3-5)
- M3: MVP Definition & Build (Week 5-10)
- M4: Beta Testing & Iteration (Week 10-13)
- M5: Launch Preparation (Week 13-15)
- M6: Launch & First Customers (Week 15-18)

**Leading Indicators:**
- Customer interviews completed
- Problem-solution fit score (from interview analysis)
- MVP feature completion percentage
- Beta user activation rate
- Beta user retention (week 1 → week 2)
- Waitlist signups / landing page conversion rate
- First paying customer timeline

**Allowed Automations:**
- Competitor monitoring (new features, pricing changes)
- Landing page A/B test management
- Beta user onboarding email sequences (approval required)
- Analytics dashboard generation
- Social listening for problem-space mentions

**Default Agent Assignments:**
- Research Agent: competitor analysis, market sizing, customer discovery synthesis
- Content Agent: landing page copy, email sequences, product descriptions
- Analytics Agent: beta metrics, conversion tracking, cohort analysis
- Marketing Agent: launch campaign suggestions, channel recommendations
- Growth Agent: distribution channel identification, partnership opportunities

---

#### Template 3: "Get Fit"

**Description:** Achieve a specific fitness goal through structured exercise
programming, nutrition guidance, and habit building.

**Diagnostic Questions:**

| # | Question | Answer Type | Why It Matters |
|---|----------|-------------|----------------|
| 1 | What is your primary fitness goal? | Select (Lose weight/Build muscle/Run a race/General fitness/Sport-specific) | Program type selection |
| 2 | What is your current fitness level? | Select (Sedentary/Lightly active/Moderately active/Very active) | Starting intensity calibration |
| 3 | How many days per week can you exercise? | Number (2-7) | Program structure |
| 4 | How long per session? | Select (20min/30min/45min/60min/90min) | Workout design |
| 5 | What equipment do you have access to? | Multi-select (None/Dumbbells/Full gym/Home gym/Outdoor space) | Exercise selection |
| 6 | Any injuries or physical limitations? | Text (optional) | Exercise modification flags |
| 7 | Are you also interested in nutrition changes? | Yes/Somewhat/No, just exercise | Nutrition milestone inclusion |
| 8 | Have you followed a structured program before? | Yes/Tried but quit/No | Habit-building milestone depth |
| 9 | What time of day do you prefer to exercise? | Select (Morning/Lunch/Evening/Flexible) | Scheduling optimization |
| 10 | What specific target? (e.g., lose 20 lbs, run a 5K, bench 225) | Text | Measurable goal setting |

**Milestone Structure:**
- M1: Habit Foundation (Week 1-2) — establish routine, baseline measurements
- M2: Progressive Build (Week 3-5) — increase intensity, refine technique
- M3: Consistency Lock-in (Week 5-8) — maintain momentum, adjust nutrition
- M4: Performance Push (Week 8-12) — targeted progression toward goal
- M5: Assessment & Recalibration (Week 12-14) — measure progress, set next phase

**Leading Indicators:**
- Workout completion rate (sessions done / sessions planned)
- Progressive overload tracking (weight/reps/distance trends)
- Consistency streak (consecutive weeks with 80%+ completion)
- Subjective energy and recovery scores
- Body measurements / performance benchmarks at checkpoints

**Allowed Automations:**
- Workout plan generation for each week
- Rest day recommendations based on reported fatigue
- Progress photo reminders
- Nutrition logging reminders
- Weekly progress report generation

**Default Agent Assignments:**
- Research Agent: exercise form guides, nutrition information lookup
- Content Agent: workout plan formatting, progress summaries
- Analytics Agent: progress tracking, trend analysis, plateau detection

---

#### Template 4: "Learn a Skill"

**Description:** Systematically acquire a new skill through structured learning,
deliberate practice, and measurable progress checkpoints.

**Diagnostic Questions:**

| # | Question | Answer Type | Why It Matters |
|---|----------|-------------|----------------|
| 1 | What skill do you want to learn? | Text + category select | Curriculum template selection |
| 2 | What is your current level? | Select (Complete beginner/Some exposure/Intermediate/Advanced seeking mastery) | Starting point calibration |
| 3 | Why do you want to learn this? | Select (Career/Hobby/Specific project/General growth) | Motivation alignment and milestone design |
| 4 | How many hours per week can you dedicate to learning? | Range (2-20) | Pace and depth of curriculum |
| 5 | What is your preferred learning style? | Multi-select (Video/Reading/Hands-on/Instructor-led/Practice-heavy) | Resource curation strategy |
| 6 | Do you have a specific deadline or target date? | Date (optional) | Timeline compression/expansion |
| 7 | What does "success" look like for this skill? | Text | Measurable outcome definition |
| 8 | Are you willing to spend money on courses or tools? | Budget range | Resource recommendations |
| 9 | Do you learn better alone or with accountability partners? | Select (Alone/Partner/Group/Community) | Social features activation |
| 10 | Have you tried learning this before? What stopped you? | Text (optional) | Failure mode prevention |

**Milestone Structure:**
- M1: Foundation & Resource Setup (Week 1-2)
- M2: Core Concepts & First Practice (Week 2-4)
- M3: Deliberate Practice Phase (Week 4-8)
- M4: Applied Project (Week 8-10) — build something real
- M5: Assessment & Portfolio (Week 10-12) — demonstrate competence
- M6: Advanced Topics & Continued Learning Path (Week 12+)

**Leading Indicators:**
- Study session completion rate
- Practice hours logged (with quality self-rating)
- Concept checkpoint scores (periodic self-assessments)
- Project milestone completion
- Time-to-competency vs plan estimate

**Allowed Automations:**
- Learning resource curation and scheduling
- Practice reminder generation
- Progress checkpoint scheduling
- Spaced repetition review scheduling
- Weekly learning summary generation

**Default Agent Assignments:**
- Research Agent: resource discovery, curriculum gap analysis, community finding
- Content Agent: study notes formatting, flashcard generation, project briefs
- Analytics Agent: progress tracking, learning velocity analysis

---

#### Template 5: "Grow on Social Media"

**Description:** Build an engaged audience on a specific social media platform
through consistent content creation, community engagement, and strategic growth.

**Diagnostic Questions:**

| # | Question | Answer Type | Why It Matters |
|---|----------|-------------|----------------|
| 1 | Which platform is your primary focus? | Select (YouTube/TikTok/Instagram/Twitter-X/LinkedIn/Newsletter) | Platform-specific strategy |
| 2 | What is your niche or topic area? | Text + category | Content strategy and competitor research |
| 3 | What is your current follower count? | Number | Starting phase determination |
| 4 | How often can you create content? | Select (Daily/3-5x week/1-2x week/Weekly) | Content calendar design |
| 5 | What content format are you best at? | Multi-select (Writing/Short video/Long video/Photography/Audio) | Content type strategy |
| 6 | Are you monetizing or planning to monetize? | Select (Not yet/Want to/Already am) | Growth vs monetization balance |
| 7 | What is your content creation time per piece? | Range (30min-8hrs) | Volume feasibility |
| 8 | Do you have existing content we can analyze? | Yes (link)/No | Style analysis and improvement suggestions |
| 9 | Are you comfortable on camera / showing your face? | Yes/Working on it/No | Content format constraints |
| 10 | What is your 6-month follower target? | Number | Growth rate expectations and strategy intensity |

**Milestone Structure:**
- M1: Profile Optimization & Content Strategy (Week 1-2)
- M2: Content Pipeline Setup (Week 2-3)
- M3: Consistency Phase — publish on schedule for 4 weeks (Week 3-7)
- M4: Engagement & Community Building (Week 7-10)
- M5: Growth Experiments (Week 10-14)
- M6: Monetization Foundations (Week 14-18)

**Leading Indicators:**
- Posts published vs planned (consistency rate)
- Engagement rate per post (likes + comments + shares / followers)
- Follower growth rate (weekly net new)
- Content quality score (self-rated + engagement signals)
- Best-performing content type identification
- Average views / impressions per post

**Allowed Automations:**
- Content calendar generation and reminders
- Trending topic monitoring in niche
- Competitor content analysis (weekly digest)
- Best posting time analysis
- Draft content suggestions (approval required to post) [R3]
- Engagement metrics tracking and weekly reports
- Hashtag / keyword research

**Default Agent Assignments:**
- Research Agent: niche analysis, competitor study, trending topics, audience research
- Content Agent: caption drafts, content ideas, hook suggestions, hashtag sets
- Analytics Agent: engagement tracking, growth analysis, content performance ranking
- Marketing Agent: collaboration opportunities, cross-promotion suggestions
- Growth Agent: growth experiment design, viral content pattern analysis

---

### 4.4 Goal Decomposition Hierarchy

Every goal in GoalPilot follows a strict four-level hierarchy:

```
Goal
  The top-level objective. One sentence, measurable, time-bound.
  Example: "Launch my SaaS and get 50 paying customers in 4 months"

  └── Milestone (2-6 week chunks)
        A significant checkpoint that represents real progress.
        Example: "Complete problem validation with 20 customer interviews"

        └── Weekly Target
              What should be accomplished THIS week to stay on track
              for the current milestone.
              Example: "Conduct 5 customer interviews and synthesize findings"

              └── Daily Task
                    A single, concrete action that takes 15-90 minutes.
                    Example: "Interview Sarah Chen (Acme Corp) — prepared
                    questions in your brief"
```

**Decomposition rules:**

1. Goals produce 4-8 milestones (depending on template and duration)
2. Each milestone produces weekly targets (milestone duration / 1 week)
3. Each weekly target produces 3-5 daily tasks per day [R4]
4. Tasks are atomic: completable in one session, no ambiguity about "done"
5. Tasks have clear deliverables: "write 500 words of landing page copy"
   NOT "work on landing page" [R1]

**Why this structure matters:** [R1]
Templates provide the skeleton, but real life is messy. A rigid 12-week plan
that doesn't account for a user's vacation in week 6, or their budget running
low in month 2, will fail. The decomposition hierarchy allows the system to
adjust at the right level:
- Missed a day? Redistribute tasks within the week.
- Bad week? Adjust weekly targets within the milestone.
- Milestone taking longer? Shift subsequent milestones.
- Life change? Replan at the goal level.

---

### 4.5 Context Layer: Real-Life Constraint Modification

Plans don't exist in a vacuum. The Context Layer continuously modifies plans
based on real-life constraints. [R1]

**Constraint types and their effects:**

```
Budget Constraints:
  - Remaining budget tracked against plan requirements
  - If budget is running low: defer expensive milestones, suggest
    alternatives, flag risk
  - Example: "Your Turo plan assumed buying a 3rd car in Week 10,
    but your current earnings suggest waiting until Week 14.
    Adjusting fleet expansion milestone."

Time Constraints:
  - Available hours/week is not static — system asks periodically
  - Busy week detected (user marking tasks as "can't today"): auto-reduce
  - Vacation/travel: pause and resume with catch-up plan
  - Example: "You mentioned a busy work week. Reducing to 2 tasks/day
    and deferring the competitor analysis to next week."

Energy Constraints:
  - End-of-day reviews capture energy levels (1-5 scale)
  - Low energy trend: shift to lighter tasks, reduce load
  - High energy trend: offer bonus tasks, advance timeline
  - Example: "Your energy has been low this week. Today's tasks are
    all quick wins — nothing over 20 minutes."

Multi-Goal Conflicts:
  - Users can run up to 3 goals simultaneously
  - System detects time/budget conflicts between goals
  - Suggests priority ranking or interleaving strategy
  - Example: "Your SaaS launch and fitness goals both require heavy
    time investment this week. Which would you like to prioritize?"

External Dependencies:
  - Some tasks depend on external responses (waiting for interview,
    approval from partner, delivery of equipment)
  - System tracks pending externals and routes around them
  - Example: "Still waiting on your Turo vehicle inspection. Moving
    listing optimization tasks forward while you wait."
```

---

### 4.6 Adaptive Replanning

The system does not stubbornly follow the original plan. Replanning happens
at defined triggers: [R1] [R7]

**Replan triggers:**

| Trigger | Severity | Action |
|---------|----------|--------|
| User completes milestone early | Low | Advance next milestone, offer stretch goals |
| User falls 1 week behind milestone | Medium | Redistribute remaining tasks, extend milestone by 3-5 days |
| User falls 2+ weeks behind | High | Full milestone replan, check if goal timeline needs adjustment |
| Budget deviation > 20% from plan | Medium | Replan budget-dependent milestones |
| User reports goal change | High | Re-run diagnostic, potentially switch templates |
| 3+ consecutive days missed | Medium | Reduce daily load, send check-in |
| Leading indicator trending negative for 2+ weeks | High | Diagnose root cause, suggest strategy pivot |
| User requests replan | Any | Full replan with current context |

**Replan process:**
1. Identify what changed (trigger analysis)
2. Assess impact on current milestone and subsequent milestones
3. Generate 2-3 replan options (conservative, moderate, aggressive) [R7]
4. Present options to user with tradeoffs explained
5. User selects preferred option (or requests modification)
6. System implements new plan, preserving completed work

**Guardrail against AI replanning errors:** [R7]
- Replans always show what changed and why
- Major replans (affecting 3+ milestones) require explicit user approval
- System tracks replan frequency — if replanning more than 2x/month,
  flags potential template mismatch to the user
- Users can revert to previous plan version within 48 hours

---
---

## Section 5: Agent System (Constrained)

GoalPilot's agent system is deliberately constrained. This is not a general-purpose
AI agent platform where agents can take arbitrary actions. Every agent has a narrow
role, limited scope, explicit permissions, and hard boundaries. The philosophy:
agents should make users more effective, not replace user judgment. [R3] [R7]

---

### 5.1 Micro-Agent Architecture

**Design principles:**

1. **Single Responsibility:** Each agent does ONE type of thing. No "super agents."
2. **Least Privilege:** Agents can only access what they need for their role.
3. **Explicit Boundaries:** Every agent has a written list of allowed and forbidden actions.
4. **Human-in-the-Loop by Default:** Agents suggest; users approve. Autonomous execution
   is the exception, not the rule, and is always gated. [R3]
5. **Transparency:** Every agent action is logged, explained, and reversible.
6. **Composability:** Multiple narrow agents collaborate rather than one broad agent acting.

**Why micro-agents over monolithic agents:**
- A monolithic agent that "handles your Turo business" is a black box with too much power
- Micro-agents are auditable — users can see exactly what each agent did and why
- Failure is contained — if the Content Agent produces bad copy, it doesn't affect
  the Analytics Agent's reports
- Trust is built incrementally — users approve specific agent types independently
- Domain expertise can be improved per-agent without retraining everything [R5]

**Agent lifecycle:**

```
1. Assignment:  Template determines which agents activate for a goal
2. Activation:  Agent is initialized with goal context and constraints
3. Operation:   Agent performs tasks within its allowed scope
4. Output:      Every output includes confidence score and explanation
5. Review:      User reviews and approves/rejects/modifies output
6. Learning:    User feedback adjusts agent behavior within constraints
7. Deactivation: Agent is deactivated when its role is no longer needed
```

---

### 5.2 Agent Type Definitions

#### Research Agent

**Role:** Finds information, compares options, summarizes findings. NEVER acts
on the information it finds — it only presents.

```
Allowed Actions:
  - Search the web for information relevant to user's goal
  - Compare products, services, tools, and options
  - Summarize articles, reviews, and data sources
  - Generate comparison tables and recommendation reports
  - Monitor specific topics for changes (competitor tracking, market shifts)
  - Compile resource lists (courses, tools, communities)

Forbidden Actions:
  - Make purchases or commitments
  - Contact anyone on behalf of the user
  - Sign up for services
  - Share user information with external parties
  - Make definitive recommendations without confidence scores

Max Spend: $0 (no spending authority)
Requires Approval: No (for research), Yes (for monitoring setup)
Output Format: Research briefs with sources, confidence levels, and caveats
```

**Example output:**
```
Research Brief: Best Economy Vehicles for Turo in Austin, TX
Confidence: 0.82
Sources: Turo marketplace data, KBB, Edmunds, r/turo

Top 3 Recommendations:
1. Toyota Corolla 2022-2024 ($18-22K) — Highest utilization in Austin market
   Avg daily rate: $45-55 | Avg utilization: 72% | Est. monthly revenue: $980-1,190
2. Honda Civic 2022-2024 ($19-23K) — Strong reviews, lower maintenance
   Avg daily rate: $48-58 | Avg utilization: 68% | Est. monthly revenue: $950-1,150
3. Hyundai Elantra 2023-2024 ($17-20K) — Best ROI due to lower purchase price
   Avg daily rate: $40-48 | Avg utilization: 65% | Est. monthly revenue: $760-910

Caveats:
- Utilization data based on top-quartile hosts; new hosts typically see 15-20% lower [R7]
- Prices reflect current market; may shift with new model releases
- Insurance costs not included in revenue estimates
```

---

#### Content Agent

**Role:** Drafts copy, generates content variations, edits existing content.
Requires approval before anything is published or sent. [R3]

```
Allowed Actions:
  - Draft text content (listings, posts, emails, descriptions)
  - Generate multiple variations of content for A/B testing
  - Edit and improve existing user content
  - Suggest content calendars and topic ideas
  - Format content for specific platforms
  - Generate image prompts (not images directly)

Forbidden Actions:
  - Publish content anywhere without explicit user approval
  - Send emails or messages without approval
  - Create accounts on platforms
  - Commit to deadlines or promises on behalf of the user
  - Generate content that impersonates the user without disclosure

Max Spend: $0 (no spending authority)
Requires Approval: Yes (for all publish/send actions)
Output Format: Draft content with platform-specific formatting notes
```

**Approval flow for content:** [R3]
```
1. Agent generates draft → presented to user in daily brief or on-demand
2. User can: Approve as-is / Edit then approve / Request revision / Reject
3. If approved with "auto-approve similar" flag:
   - Future content of same type skips approval for 7 days
   - User can revoke auto-approve at any time
   - Auto-approve never extends beyond 7 days without renewal
4. All published content is logged and reversible within 1 hour
```

**Approval fatigue mitigation:** [R3]
- Content Agent batches similar approvals (e.g., 5 social posts at once)
- "Approve style, review content" mode: user approves tone/approach once,
  then only reviews content for factual accuracy
- Low-stakes content (internal notes, tracking updates) never requires approval
- Approval requests are throttled to max 3 per day across all agents

---

#### Marketing Agent

**Role:** Suggests campaigns, creates ad copy, identifies promotional opportunities.
All suggestions are advisory. Any spending is budget-gated with hard limits. [R3]

```
Allowed Actions:
  - Suggest marketing campaigns and strategies
  - Draft ad copy and creative briefs
  - Identify promotional opportunities (events, partnerships, trends)
  - Analyze marketing channel effectiveness
  - Create A/B test designs
  - Generate audience targeting suggestions
  - Draft outreach messages (approval required to send)

Forbidden Actions:
  - Spend money without explicit per-action approval
  - Launch campaigns autonomously
  - Commit to partnerships or agreements
  - Access user's ad accounts without permission
  - Exceed the user-set budget cap under any circumstances

Max Spend: User-defined per goal (default: $0 until explicitly set)
Requires Approval: Yes (for all spending actions), Yes (for outreach)
Output Format: Campaign briefs with expected outcomes, budget breakdown, and risk notes

Budget Gate Implementation:
  - User sets monthly marketing budget during goal setup (can be $0)
  - Each proposed action shows exact cost before approval
  - Running spend total always visible
  - Hard stop at 90% of budget — remaining 10% requires manual override
  - No recurring charges without explicit recurring approval
```

---

#### Analytics Agent

**Role:** Tracks metrics, generates reports, identifies trends. Strictly read-only —
this agent observes and reports but never modifies anything. [R7]

```
Allowed Actions:
  - Collect and aggregate metrics from connected platforms
  - Generate daily, weekly, and milestone progress reports
  - Identify trends (positive and negative) in leading indicators
  - Flag anomalies (sudden drops, unexpected spikes)
  - Create visualizations and dashboards
  - Compare current performance to plan projections
  - Benchmark against template averages (anonymized)

Forbidden Actions:
  - Modify any data or settings on connected platforms
  - Make changes based on its own analysis
  - Share user data externally
  - Access data outside the scope of the user's goals
  - Present projections as certainties

Max Spend: $0 (no spending authority)
Requires Approval: No (for reporting), Yes (for new data source connections)
Output Format: Reports with data, trends, confidence intervals, and actionable insights

Confidence in Analytics: [R7]
  - All projections include confidence intervals
  - Trend identification requires minimum 2 weeks of data
  - Anomaly flags distinguish between "data issue" and "real change"
  - Reports clearly label "measured" vs "estimated" vs "projected" data
```

---

#### Execution Agent

**Role:** Performs approved actions within strict constraints. This is the only
agent that CAN take action in external systems, and it operates under the
tightest controls. [R3] [R7]

```
Allowed Actions (ONLY after explicit approval):
  - Post approved content to connected platforms
  - Send approved messages/emails
  - Update listings with approved changes
  - Execute approved A/B tests
  - Adjust pricing within user-defined bounds
  - Schedule approved content for future posting

Forbidden Actions:
  - ANY action without prior approval (no exceptions)
  - Actions outside the approved scope (no "while I'm at it" behavior)
  - Irreversible actions without double-confirmation
  - Actions that exceed monetary limits
  - Bulk actions without itemized approval
  - Actions during user-defined "quiet hours"

Max Spend: Inherited from Marketing Agent budget
Requires Approval: Yes (ALWAYS — this is non-negotiable)
Output Format: Action confirmation with exact details of what was done,
               timestamp, and reversal instructions

Execution Safeguards:
  - Pre-execution: show exact action preview ("I will post this text
    to your Instagram at 2pm EST")
  - During execution: real-time status updates
  - Post-execution: confirmation with screenshot/proof
  - Reversal window: 1 hour for most actions, clearly stated per action
  - Execution log: permanent record of all actions taken
```

---

#### Growth Agent

**Role:** Identifies opportunities, suggests experiments, and spots potential
areas for improvement. Strictly advisory — never executes. [R5]

```
Allowed Actions:
  - Analyze current performance for growth opportunities
  - Suggest experiments with hypothesis and expected outcomes
  - Identify underperforming areas and suggest improvements
  - Monitor industry trends and emerging opportunities
  - Suggest partnerships, collaborations, and cross-promotions
  - Design growth experiment frameworks

Forbidden Actions:
  - Execute any experiments directly
  - Commit resources or budget
  - Contact potential partners or collaborators
  - Make promises about outcomes
  - Suggest strategies that conflict with user-stated values

Max Spend: $0 (advisory only)
Requires Approval: N/A (suggestions don't require approval; implementing them does)
Output Format: Opportunity briefs with hypothesis, expected impact, required effort,
               confidence level, and risks
```

---

### 5.3 Agent Assignment Model

Users do NOT choose which agents to activate. The system assigns agents based on
the goal template. This is intentional — most users don't know which agents they
need, and offering choice creates decision paralysis and configuration errors. [R2]

**Assignment rules:**

```
Template → Agent Mapping (defined per template, examples above)

Assignment Modifiers:
  - If user has $0 marketing budget → Marketing Agent is advisory-only mode
  - If user hasn't connected any platforms → Execution Agent stays dormant
  - If goal is purely physical (fitness) → Content and Marketing agents not assigned
  - If user opts out of automations → Execution Agent disabled entirely

Progressive Activation:
  - Not all assigned agents activate immediately
  - Phase-based activation matches milestone progression
  - Example for "Launch a SaaS":
    - Phase 1 (Validation): Research Agent only
    - Phase 2 (Build): Research + Content Agents
    - Phase 3 (Launch): All assigned agents activate
```

---

### 5.4 Confidence Score System

Every agent output includes a confidence score between 0 and 1. This is not
a vague "AI confidence" — it's a structured calculation. [R7]

**Confidence calculation:**

```
confidence_score = weighted_average(
  data_quality:    0.30,   // How reliable are the data sources?
  domain_match:    0.25,   // How well does this match known patterns?
  recency:         0.20,   // How current is the information?
  user_context:    0.15,   // How much user-specific data informed this?
  consensus:       0.10    // Do multiple sources/approaches agree?
)
```

**Component definitions:**

- **data_quality (0.30):** Measures source reliability. Primary data (user's own metrics)
  scores highest. Established databases score high. Forum posts and anecdotal data
  score low. Missing data scores 0.

- **domain_match (0.25):** How closely the current situation matches patterns in the
  template's domain knowledge. A Turo pricing recommendation for a Toyota Corolla in
  Austin has high domain match. A pricing recommendation for a rare exotic car in a
  small town has low domain match. [R5]

- **recency (0.20):** Data freshness. Real-time data scores 1.0. Data from this week
  scores 0.8-0.9. Data from this month scores 0.5-0.7. Data older than 3 months
  scores below 0.5.

- **user_context (0.15):** How much personalized information informed the output.
  A recommendation based on the user's actual sales data scores high. A generic
  recommendation based only on template defaults scores low. Improves over time
  as the system learns more about the user. [R2]

- **consensus (0.10):** Whether multiple data sources or analytical approaches agree.
  Three sources saying the same thing scores high. Contradictory sources score low.

**Confidence threshold behaviors:**

```
Score < 0.5 (Low Confidence):
  - Output is labeled "LOW CONFIDENCE — treat as a rough starting point"
  - Agent explains what data is missing and why confidence is low
  - No automated actions allowed regardless of other permissions
  - System suggests how user can provide information to improve confidence
  - Example: "My pricing recommendation is low confidence because I
    couldn't find comparable luxury EVs in your market. Here's my best
    estimate, but I'd suggest checking with local hosts."

Score 0.5-0.7 (Moderate Confidence):
  - Output is labeled "MODERATE CONFIDENCE — review recommended"
  - Agent provides its recommendation with clearly stated assumptions
  - Automated actions require explicit approval (even if normally auto-approved)
  - System highlights which assumptions most affect the recommendation
  - Example: "Based on market data, I recommend pricing at $65/day.
    This assumes average seasonal demand — your actual results may vary
    by +/- 15% depending on local events."

Score 0.7-0.9 (High Confidence):
  - Output presented as a standard recommendation
  - Automated actions follow normal approval settings
  - Confidence score visible but not prominently flagged
  - Example: "Recommended price: $52/day. This is based on 340 comparable
    listings in your area over the past 30 days. Confidence: 0.84"

Score > 0.9 (Very High Confidence):
  - Output presented with high conviction
  - Eligible for auto-execution if user has enabled it for this agent type
  - Still logged and reversible
  - Example: "Your listing views are 3x higher on weekends. I've drafted
    a weekend-specific pricing adjustment. Confidence: 0.93"
```

---

### 5.5 Circuit Breakers

Circuit breakers are automatic safety mechanisms that pause or restrict agent
activity when something appears to be going wrong. [R7]

**Circuit breaker triggers:**

```
Trigger 1: Consecutive Low Confidence
  Condition: Agent produces 3+ outputs with confidence < 0.5 in a 24-hour period
  Action: Agent is paused, user notified
  Resolution: User reviews situation, system diagnoses data quality issue
  Rationale: Repeated low confidence suggests the agent lacks adequate data
             for this user's situation and should not keep guessing [R5]

Trigger 2: High Rejection Rate
  Condition: User rejects 5+ consecutive agent suggestions
  Action: Agent enters "observation mode" (continues tracking but stops suggesting)
  Resolution: After 48 hours, agent provides a single "recalibration" output
              asking if its approach should change
  Rationale: Repeated rejections mean the agent's model of user preferences
             is wrong — continuing to suggest wastes the user's time [R3]

Trigger 3: Anomalous Results
  Condition: Agent output deviates > 2 standard deviations from its own
             recent outputs without clear cause
  Action: Output is held for review, not presented as normal recommendation
  Resolution: System checks for data errors, market shifts, or bugs
  Rationale: Sudden dramatic changes in recommendations are more likely
             errors than insights [R7]

Trigger 4: Execution Failures
  Condition: 2+ failed execution attempts (API errors, permission issues)
  Action: Execution Agent paused for affected platform
  Resolution: System diagnoses connection issue, prompts user to re-authorize
  Rationale: Continuing to attempt failed executions is wasteful and may
             indicate a revoked permission or platform change

Trigger 5: Budget Threshold
  Condition: Spending reaches 80% of allocated budget
  Action: All spending-related suggestions paused, budget report generated
  Resolution: User reviews and either increases budget or accepts reduced scope
  Rationale: Prevents budget overrun from compounding small approved spends

Trigger 6: User Inactivity
  Condition: User hasn't engaged with agent outputs for 5+ days
  Action: Agent reduces output frequency to weekly summaries only
  Resolution: User engagement resumes normal cadence
  Rationale: Generating daily outputs for a disengaged user creates
             notification fatigue upon return [R3]
```

**Circuit breaker status visibility:**
Users can always see which agents are active, paused, or in observation mode.
The system explains WHY each circuit breaker tripped and what options the user has.

---

### 5.6 Rollback Mechanisms

Every automated action taken by the Execution Agent is reversible within a
defined window. This is non-negotiable for user trust. [R7]

**Rollback architecture:**

```
Pre-Action State Capture:
  Before any execution, the system captures:
  - Full state of the item being modified (listing text, price, post content)
  - Timestamp and action details
  - Connected platform API response (for verification)
  - Screenshot/snapshot where applicable

Rollback Windows:
  - Social media posts: 1 hour (can delete/edit)
  - Email sends: NOT reversible (this is why emails ALWAYS require approval) [R3]
  - Listing updates: 24 hours (restore previous version)
  - Pricing changes: 24 hours (revert to previous price)
  - Scheduled content: until scheduled time (cancel/modify)
  - Account setting changes: 48 hours (restore previous settings)

Rollback Process:
  1. User taps "Undo" on any automation in their activity log
  2. System verifies rollback is within the allowed window
  3. System executes reversal via platform API
  4. Confirmation shown to user with proof of reversal
  5. Incident logged for circuit breaker consideration

Automatic Rollback Triggers:
  - If a posted content item receives negative engagement spike
    (3x normal negative reaction rate within 1 hour), system alerts user
    and offers immediate rollback
  - If a pricing change results in 0 bookings for 48 hours when the
    previous price was generating bookings, system alerts and suggests reversal
  - If an A/B test variant performs > 50% worse than control after
    statistical significance, system recommends stopping the test

Post-Rollback Analysis:
  After any rollback, the system:
  - Records what went wrong
  - Adjusts agent confidence for similar future actions
  - If pattern detected (repeated rollbacks of same action type),
    triggers circuit breaker for that action type
```

---
---

## Section 6: Daily Loop Engine — THE CORE PRODUCT

The Daily Loop Engine is the heart of GoalPilot. Everything else — planning,
agents, templates — exists to serve this engine. The core insight: most goals
fail not because of bad strategy but because of inconsistent daily execution.
GoalPilot solves this by making "what should I do today?" effortless and
"did I do it?" frictionless. [R1] [R4]

The Daily Loop is a cycle:

```
Morning Brief → Execute Tasks → Review Automations → End-of-Day Review → Sleep → Repeat
```

Every component of this loop is optimized for one thing: sustained daily engagement
with the user's goals. Not engagement for engagement's sake — engagement that
produces real progress.

---

### 6.1 Task Prioritization: "What Matters Today"

Each morning, the system must decide which 3-5 tasks (from the pool of available
tasks across all active goals) the user should focus on today. This is a scoring
algorithm, not random selection. [R4]

**Priority Score Formula:**

```
priority_score = (urgency × 0.3) + (impact × 0.3) + (inverse_effort × 0.15)
               + (dependency_weight × 0.15) + (confidence × 0.1)
```

**Factor definitions and calculation:**

**Urgency (weight: 0.3)**
How time-sensitive is this task? Urgency increases as deadlines approach.

```
Calculation:
  If task has a hard deadline:
    urgency = 1.0 - (days_until_deadline / deadline_buffer_days)
    Clamped to [0.0, 1.0]
    Example: deadline in 2 days, buffer is 7 days → urgency = 1.0 - (2/7) = 0.71

  If task has a soft deadline (milestone target):
    urgency = 1.0 - (days_until_milestone_end / milestone_total_days)
    Multiplied by 0.8 (soft deadlines are less urgent than hard)
    Example: milestone ends in 5 days, total 14 days → urgency = (1.0 - 5/14) × 0.8 = 0.51

  If task has no deadline:
    urgency = 0.3 (base urgency — these still matter, just less time-pressure)

  Urgency boost: +0.2 if task has been deferred 2+ times (prevents permanent deferral)
```

**Impact (weight: 0.3)**
How much does completing this task move the needle on the user's goal?

```
Calculation:
  impact = milestone_progress_contribution × goal_importance_weight

  milestone_progress_contribution:
    Estimated % of milestone this task represents.
    Example: If milestone has 20 tasks and this is one of them, base = 0.05
    Modified by task type:
      - "Keystone tasks" (unlocks other tasks): base × 2.0
      - "Quality tasks" (improves existing work): base × 1.0
      - "Maintenance tasks" (keeps things running): base × 0.7

  goal_importance_weight:
    If user has multiple goals, each goal has a user-set priority (1-5).
    Normalized to 0-1 range.
    Single goal: always 1.0

  Example: Keystone task in a 20-task milestone for the user's top-priority goal
           impact = (0.05 × 2.0) × 1.0 = 0.10... normalized to scale → 0.85
           (Normalization maps the raw score to 0-1 based on historical task range)
```

**Inverse Effort (weight: 0.15)**
Shorter/easier tasks get a slight boost. This ensures quick wins appear in
the daily mix, maintaining momentum and preventing all-hard-task days. [R4]

```
Calculation:
  inverse_effort = 1.0 - (estimated_minutes / max_task_minutes)
  max_task_minutes = 90 (hardcoded — no task should take > 90 min)

  Example: 15-minute task → inverse_effort = 1.0 - (15/90) = 0.83
  Example: 60-minute task → inverse_effort = 1.0 - (60/90) = 0.33
  Example: 90-minute task → inverse_effort = 1.0 - (90/90) = 0.0

  This means quick tasks get a small priority boost, ensuring at least
  1 "quick win" appears in most daily briefs.
```

**Dependency Weight (weight: 0.15)**
Tasks that block other tasks get a priority boost. Unblocking is high leverage.

```
Calculation:
  dependency_weight = min(1.0, blocked_task_count × 0.25)

  blocked_task_count: number of other tasks waiting on this task's completion

  Example: This task blocks 0 others → dependency_weight = 0.0
  Example: This task blocks 2 others → dependency_weight = 0.5
  Example: This task blocks 4+ others → dependency_weight = 1.0

  Why this matters: A customer interview that must happen before you can
  finalize your feature list should be prioritized over a task with no
  downstream dependencies.
```

**Confidence (weight: 0.1)**
How certain is the system that this is the right task at the right time? [R7]

```
Calculation:
  confidence = average(
    plan_confidence,    // How stable is the current plan? (recent replans lower this)
    data_confidence,    // How much user data informed this task's creation?
    template_confidence // How well-validated is this task type in the template?
  )

  Example: Well-established task from a proven template for an active user
           confidence = average(0.9, 0.8, 0.95) = 0.88

  Example: New task created during a replan for a new user
           confidence = average(0.5, 0.3, 0.7) = 0.50
```

**Full scoring example:**

```
Task: "Interview your 5th potential customer (Sarah Chen, Acme Corp)"

  urgency:           0.71  (milestone deadline in 3 days, 7-day buffer)
  impact:            0.85  (keystone task — unlocks synthesis milestone)
  inverse_effort:    0.67  (30-minute call)
  dependency_weight: 0.50  (2 tasks depend on interview completion)
  confidence:        0.88  (validated template, active user)

  priority_score = (0.71 × 0.3) + (0.85 × 0.3) + (0.67 × 0.15)
                 + (0.50 × 0.15) + (0.88 × 0.1)
                 = 0.213 + 0.255 + 0.1005 + 0.075 + 0.088
                 = 0.7315

Task: "Update your LinkedIn headline to mention your new product"

  urgency:           0.30  (no deadline)
  impact:            0.35  (maintenance task, secondary goal)
  inverse_effort:    0.89  (10-minute task)
  dependency_weight: 0.00  (blocks nothing)
  confidence:        0.75  (moderate — template suggestion, not data-driven)

  priority_score = (0.30 × 0.3) + (0.35 × 0.3) + (0.89 × 0.15)
                 + (0.00 × 0.15) + (0.75 × 0.1)
                 = 0.09 + 0.105 + 0.1335 + 0.0 + 0.075
                 = 0.4035

Result: Customer interview (0.73) is prioritized over LinkedIn update (0.40).
```

---

### 6.2 Adaptive Task Cap

GoalPilot defaults to 3 tasks per day. This is intentional — it's better to
complete 3 tasks consistently than to face 10 tasks and feel overwhelmed.
But the cap adapts based on user behavior. [R4]

**Engagement Velocity Calculation:**

```
engagement_velocity = tasks_completed_last_7_days / tasks_presented_last_7_days

Example: User was presented 21 tasks over 7 days, completed 18
         engagement_velocity = 18/21 = 0.857
```

**Cap Adjustment Rules:**

```
Base daily cap: 3 tasks

Velocity > 0.95 for 7+ days:
  Cap → 5 tasks (maximum)
  Message: "You're on a streak! Here are 2 bonus tasks if you have the energy."

Velocity > 0.80 for 7+ days:
  Cap → 4 tasks
  Message: "Great consistency. Adding one more task to your day."

Velocity 0.50 - 0.80:
  Cap remains at 3 tasks (default)
  No messaging change.

Velocity < 0.50 for 5+ days:
  Cap → 2 tasks
  Message: "Let's focus on what matters most. Here are your 2 priorities."
  System triggers replan check (might be too hard, wrong time, etc.) [R1]

Velocity < 0.25 for 7+ days:
  Cap → 1 task + check-in
  Message: "Just one thing today. And a quick question..."
  System initiates goal relevance check (does the user still want this?)
```

**Hard Limits:**

```
Maximum human tasks per day: 5 (even for highest performers)
Minimum human tasks per day: 1 (unless user explicitly pauses goal)
Automations for review: Unlimited (these don't count against the cap)

Rationale for hard maximum of 5: [R4]
  - GoalPilot tasks are substantial (15-90 minutes each)
  - 5 tasks × average 45 minutes = 3.75 hours of goal work per day
  - Most users have jobs, families, other commitments
  - Exceeding 5 leads to incomplete tasks, which hurts momentum
  - If users genuinely want more, they should split into multiple goals
```

**Bonus Tasks:**

```
High performers (velocity > 0.95) who complete their daily tasks before
3pm local time receive an optional "bonus task" notification:

"All done for today! If you have extra energy, here's a bonus task
 that would give you a head start on tomorrow: [task description]"

Bonus task rules:
  - Never mandatory
  - Doesn't count against tomorrow's tasks (it's truly extra)
  - Completing bonus tasks increases momentum score
  - Maximum 1 bonus task per day
  - Only offered if all assigned tasks are completed (no partial credit)
```

---

### 6.3 Actions vs. Automations

GoalPilot distinguishes between two fundamentally different types of daily items:

**Actions: Things the User Must DO**

```
Definition:
  An action requires human effort, judgment, creativity, or presence.
  The system cannot do it for you. You must actively perform it.

Examples:
  - "Write 500 words of landing page copy" (creative work)
  - "Call 3 potential customers for interviews" (human interaction)
  - "Decide between these 3 vehicle options" (judgment call)
  - "Record a 60-second video for Instagram" (content creation)
  - "Review and approve this week's content calendar" (decision)
  - "Complete today's workout: 3x8 squats, 3x8 bench press" (physical)

How actions appear in the daily brief:
  ┌─────────────────────────────────────────────────────┐
  │ TODAY'S ACTIONS                                      │
  │                                                      │
  │ 1. [HIGH] Interview Sarah Chen (Acme Corp)           │
  │    30 min · Call at 2pm EST · Questions prepared ↓    │
  │    Impact: Unlocks feature validation milestone       │
  │                                                      │
  │ 2. [MED] Write Turo listing description for Corolla  │
  │    45 min · Template and tips below ↓                 │
  │    Impact: Needed before your first listing goes live │
  │                                                      │
  │ 3. [QUICK WIN] Update profile photo on Turo          │
  │    5 min · Current photo is low quality               │
  │    Impact: Hosts with clear photos get 23% more views │
  └─────────────────────────────────────────────────────┘

Action properties:
  - Always have estimated time
  - Always have clear "done" criteria
  - Always explain WHY this matters today
  - May include supporting materials (questions, templates, guides)
  - Have priority labels: [HIGH], [MED], [QUICK WIN]
```

**Automations: Things the System Already Did**

```
Definition:
  An automation is an action the system performed on the user's behalf
  (with prior approval). The user reviews the result.

Examples:
  - "Posted your approved Instagram carousel at 9am" (content published)
  - "Updated your Turo pricing to $55/day based on weekend demand" (price adjusted)
  - "Sent follow-up email to beta signup list" (email sent)
  - "Generated this week's analytics report" (report created)
  - "Monitored competitor pricing — no significant changes" (monitoring)

How automations appear in the daily brief:
  ┌─────────────────────────────────────────────────────┐
  │ OVERNIGHT AUTOMATIONS                                │
  │                                                      │
  │ ✓ Posted Instagram carousel: "5 tips for..."        │
  │   Result: 47 likes, 3 comments in first 2 hours      │
  │   [View Post] [Undo]                                 │
  │                                                      │
  │ ✓ Adjusted Turo pricing: $48 → $55 (weekend rate)   │
  │   Reason: Weekend demand is 2.3x weekday in your area│
  │   [View Details] [Revert]                            │
  │                                                      │
  │ ⓘ Competitor monitor: No significant changes          │
  │   [View Full Report]                                 │
  └─────────────────────────────────────────────────────┘

Automation properties:
  - Always show what was done with specifics
  - Always have [Undo/Revert] option where applicable
  - Show results/metrics where available
  - Grouped separately from actions — users review, not do
  - Don't count against daily task cap
```

**Why the distinction matters:** [R3]
Users experience decision fatigue when asked to approve too many things.
By cleanly separating "things you need to do" from "things that were done
for you," the daily brief stays focused. Actions demand energy; automations
are informational. The user knows exactly how much active effort their day requires.

---

### 6.4 Daily Brief Generation

The Daily Brief is the single most important touchpoint between GoalPilot and
the user. It is generated fresh each day and delivered as the user's morning
"game plan."

**Generation timing:**
- Generated at 5:00 AM user's local time
- Uses data up to 4:59 AM (overnight automations included)
- Ready for immediate viewing when user opens the app
- If user hasn't opened by 8:00 AM, push notification is sent

**Brief structure:**

```
1. Greeting & Momentum Update
   Personalized greeting + current streak + momentum score.
   Example: "Good morning, Minte. Day 12 of your SaaS launch journey.
             You completed 3/3 tasks yesterday — momentum is strong."

2. Today's Actions (the core)
   Prioritized list of 1-5 tasks (based on adaptive cap).
   Each task includes: priority label, estimated time, context, and
   supporting materials.
   See Section 6.3 for detailed format.

3. Overnight Automations
   What the system did while the user slept.
   Each automation includes: what happened, result, and undo option.
   See Section 6.3 for detailed format.

4. Quick Wins (optional)
   If the system identified small, high-impact opportunities:
   "Quick win: Your Turo listing is getting views but no bookings.
    Try dropping the price by $3 for this weekend."
   These are NOT counted as tasks — they're optional nudges.

5. Context Reminders (optional)
   Relevant context the user might need:
   - "Remember: Sarah Chen interview at 2pm (questions prepared below)"
   - "Your Turo vehicle inspection is tomorrow — make sure it's clean"
   - "You mentioned feeling low energy yesterday — today's tasks are lighter"

6. Milestone Progress
   Brief progress bar for current milestone:
   "Feature Validation: ████████░░ 78% (3 tasks remaining)"
```

**Tone and voice guidelines:**

```
DO:
  - Be direct and action-oriented ("Here's your plan" not "We suggest")
  - Be encouraging but not performative ("Strong progress" not "OMG AMAZING!!!")
  - Be specific ("You completed 3/3 tasks" not "You did great")
  - Acknowledge difficulty when appropriate ("Yesterday was tough — today is lighter")
  - Use the user's name occasionally (not every message)
  - Keep it scannable — bullet points, clear headers, minimal prose

DON'T:
  - Use corporate jargon ("leverage synergies", "action items")
  - Be sycophantic ("You're CRUSHING it!!")
  - Use guilt language ("You missed yesterday's tasks...")
  - Be overly casual or use slang excessively
  - Write long paragraphs — the brief should take < 2 minutes to read
  - Use emojis excessively (one or two per brief maximum, e.g., streak fire)

Voice: Competent coach. Think: experienced friend who's done this before
and knows what matters today. Not a cheerleader, not a drill sergeant.
```

---

### 6.5 Push Notification Strategy

GoalPilot respects the user's attention. Notifications are sparse, well-timed,
and always actionable. [R3]

**Notification schedule:**

```
Morning Brief (1 notification):
  Time: 8:00 AM if brief hasn't been viewed (brief available since 5:00 AM)
  Content: "Your day is planned. 3 actions ready." (or 2, or 4, etc.)
  Action: Opens daily brief
  Rule: ONLY if user hasn't already opened the app today

Mid-Day Nudge (conditional, max 1 notification):
  Time: 12:30 PM local time
  Condition: User has opened brief but completed 0 tasks
  Content: "Quick reminder: [highest priority task name]. 30 min is all it takes."
  Action: Opens task detail
  Rule: ONLY sent if user viewed brief but hasn't started any task
  NOT sent if: User marked "busy today" or has an active pause

End-of-Day Review (1 notification):
  Time: 8:00 PM local time
  Condition: User has completed at least 1 task today
  Content: "Ready for your 2-min review? [X/Y tasks done today]"
  Action: Opens review flow
  Rule: ONLY sent if user completed at least 1 task
  NOT sent if: User already completed end-of-day review

HARD RULES:
  - Never more than 3 notifications per day (total across all types)
  - Never between 9pm and 7am (user local time) unless user customizes
  - No notifications on user-declared rest days
  - No notifications during active pause
  - User can disable each notification type independently
  - If user ignores notifications for 3+ days, frequency auto-reduces
  - No marketing, upsell, or social notifications — ONLY goal-relevant
```

**Notification content principles:**
- Every notification is actionable (tapping does something useful)
- Every notification is specific (mentions the actual task, not generic)
- Every notification can be acted on in < 2 minutes from tap
- Notifications never contain bad news without a solution
- Notifications never create anxiety — they reduce it

---

### 6.6 Missed Day Handling

Users will miss days. Life happens. GoalPilot's response to missed days is
critical — guilt creates avoidance, which creates more missed days.
The system is always momentum-forward. [R1]

**1 missed day:**

```
Response: Gentle catch-up
Brief title: "Welcome back — here's your adjusted plan."

Behavior:
  - Yesterday's uncompleted tasks are re-evaluated, not auto-carried-over
  - High-priority tasks from yesterday are re-scored for today
  - Low-priority tasks from yesterday may be deferred or dropped
  - Task cap stays the same (don't punish with extra work)
  - Brief tone: no mention of "missed day" — just presents today's plan
  - Automations from the missed day are summarized at the top

Example brief opening:
  "Good morning, Minte. Here's your plan for today. Your Turo listing
   got 12 views yesterday — nice momentum building."
  (No mention of missed tasks — just forward motion)
```

**2-3 missed days:**

```
Response: Welcome back brief with reduced load
Brief title: "Welcome back — let's ease into it."

Behavior:
  - Task cap reduced by 1 for the return day (e.g., 3 → 2)
  - System re-prioritizes: only the highest-impact tasks appear
  - Brief includes a short summary of what happened while away:
    "While you were away: 3 automations ran, your Turo listing got
     28 views, and your milestone deadline shifted by 2 days."
  - No urgency signals unless something genuinely time-critical
  - End-of-day review is simplified (1 question instead of 3)

Example brief opening:
  "Hey, Minte — good to have you back. I've trimmed today to 2 key tasks.
   Here's a quick summary of the last few days, then let's get moving."
```

**7+ missed days:**

```
Response: Replan trigger with goal relevance check
Brief title: "Let's recalibrate."

Behavior:
  - System does NOT present tasks immediately
  - Instead, opens a short check-in flow (3 questions):
    1. "Are you still interested in pursuing [goal name]?" (Yes/Adjusted/No)
    2. "Has anything major changed? (budget, time, priorities)" (Yes/No + details)
    3. "What pace feels right going forward?" (Light/Normal/Intense)
  - Based on answers, system either:
    a. Replans with adjusted timeline and constraints
    b. Pauses the goal (preserving all progress)
    c. Closes the goal with a progress summary
  - If user chooses to continue, first day back has 1-2 easy tasks
  - Milestones are recalculated based on new reality

Example:
  "Hey, Minte — it's been a while. Before we jump back in, let's make
   sure your plan still fits your life. Quick 3 questions..."

CRITICAL TONE RULE:
  Never: "You've been away for 12 days and fell behind."
  Always: "Let's figure out the best path forward from here."
  The system NEVER references time away as a failure. [R1]
```

**Prolonged inactivity (30+ days):**

```
Response: Gentle re-engagement or graceful closure
  - Single notification: "Your [goal name] plan is paused. Tap to resume
    or close it — no pressure either way."
  - If no response in 7 more days: goal auto-pauses
  - All progress is preserved indefinitely
  - User can resume any paused goal at any time
  - Resumption always starts with the recalibration flow
```

---

### 6.7 Streak and Momentum System

GoalPilot celebrates process, not just outcomes. The momentum system is designed
to reinforce consistency — the behavior that actually drives results. [R6]

**Why process over outcomes:** [R6]
- Outcomes are lagging indicators and often outside the user's control
- "You made $500 this month" might be luck, not skill
- "You've listed your car for 14 consecutive days" IS the skill
- Process celebrations are more frequent, providing regular positive feedback
- Process metrics are fully within the user's control, reducing frustration

**Momentum Score Calculation:**

```
momentum_score = weighted_average(
  completion_rate_7d × 0.40,    // Task completion over last 7 days
  streak_bonus × 0.25,          // Consecutive days with 1+ completion
  quality_signal × 0.20,        // End-of-day review engagement
  velocity_trend × 0.15         // Is completion rate improving or declining?
)

completion_rate_7d:
  tasks_completed / tasks_presented over rolling 7-day window
  Range: 0.0 - 1.0

streak_bonus:
  Calculated as: min(1.0, consecutive_active_days / 14)
  0 days → 0.0, 7 days → 0.5, 14+ days → 1.0
  "Active day" = completed at least 1 task

quality_signal:
  Did the user complete end-of-day reviews?
  reviews_completed / active_days over last 7 days
  Range: 0.0 - 1.0

velocity_trend:
  Compares completion_rate of last 7 days to previous 7 days.
  Improving → 0.5 - 1.0
  Stable → 0.5
  Declining → 0.0 - 0.5
```

**Momentum score display:**

```
Score ranges and labels:
  0.0 - 0.2: "Building" (just starting or returning from break)
  0.2 - 0.4: "Warming up" (establishing rhythm)
  0.4 - 0.6: "Steady" (consistent but room to grow)
  0.6 - 0.8: "Strong" (reliable daily engagement)
  0.8 - 1.0: "On fire" (exceptional consistency)

Visual: Simple progress bar in daily brief header
  Momentum: ██████████░░░░ Strong (0.72)
```

**Celebration Triggers:**

```
Streak-based celebrations:
  3-day streak:  "3 days in a row. The habit is forming."
  7-day streak:  "One full week of consistent action. This is how goals happen."
  14-day streak: "Two weeks strong. You're in the top 20% of GoalPilot users."
  30-day streak: "30 days. This isn't a streak anymore — it's who you are."
  (Beyond 30: acknowledged monthly, not daily — avoid celebration fatigue)

Milestone celebrations:
  Milestone completed: "Milestone complete: Problem Validation. You interviewed
                        12 customers and identified 3 key pain points.
                        Next up: Solution Design."
  (Milestone celebrations summarize what was ACCOMPLISHED, not just that time passed)

Process celebrations (domain-specific):
  Turo: "You've responded to every guest inquiry within 1 hour for 10 days straight."
  SaaS: "5 customer interviews completed this week. That's more than most founders do in a month."
  Fitness: "You haven't missed a scheduled workout in 3 weeks."
  Social Media: "You've posted every day this week. Consistency is the algorithm hack."
  Learning: "15 hours of practice logged this month. Deliberate practice adds up."

Anti-celebrations (things the system NEVER does):
  - Never compares user unfavorably to others
  - Never celebrates spending money ("You spent $5000 on ads!")
  - Never celebrates vanity metrics without context
  - Never celebrates in a way that makes missing tomorrow feel like failure
  - Never sends celebration notifications — they appear in-brief only
```

---

### 6.8 End-of-Day Review

The End-of-Day Review closes the daily loop. It's short (2 minutes target),
captures information that improves tomorrow's planning, and gives the user a
sense of closure. [R1] [R7]

**Review flow:**

```
Screen 1: Task Completion Check
  Shows today's tasks with checkboxes.
  User marks completed/not completed.
  For incomplete tasks: optional quick reason
    (Ran out of time / Too hard / Not relevant / Blocked by external)
  Time: 30 seconds

Screen 2: Difficulty & Energy
  "How was today overall?"
  Difficulty slider: 1 (too easy) — 3 (just right) — 5 (too hard)
  Energy level: 1 (exhausted) — 3 (normal) — 5 (energized)
  Time: 15 seconds

Screen 3: Quick Note (Optional)
  "Anything the system should know for tomorrow?"
  Free-text field, max 280 characters.
  Suggestions: "Meeting moved to Thursday", "Budget approved",
               "Feeling motivated to do more"
  Time: 0-30 seconds

Screen 4: Tomorrow Preview
  "Here's a preview of tomorrow. Sleep well."
  Shows top 2 tasks tentatively planned for tomorrow.
  User can flag if something looks wrong.
  Time: 15 seconds

Total target time: 1-2 minutes
```

**How review data feeds back into planning:**

```
Task Completion Data:
  - Updates engagement_velocity for cap adjustment
  - Incomplete tasks are re-scored for tomorrow (not auto-added)
  - Repeated "too hard" feedback → system reduces task complexity [R1]
  - Repeated "not relevant" feedback → triggers template review [R1] [R7]
  - "Blocked by external" → system tracks dependency and routes around it

Difficulty Calibration:
  - Average difficulty > 4 for 3+ days → reduce task complexity/quantity
  - Average difficulty < 2 for 3+ days → increase challenge level
  - This feeds directly into the inverse_effort factor of priority scoring

Energy Tracking:
  - Low energy trend → tomorrow's tasks are lighter, more quick wins
  - High energy trend → tomorrow can include harder, higher-impact tasks
  - Energy patterns over time → system learns user's weekly rhythm
    (e.g., Mondays are always low energy → plan lighter Mondays)

Quick Notes:
  - Parsed for scheduling changes, constraint updates, sentiment signals
  - Positive sentiment → maintain or increase pace
  - Negative sentiment → check-in question in tomorrow's brief
  - Factual updates → integrated into plan context (budget changes, etc.)

Tomorrow Preview Feedback:
  - If user flags an issue → system adjusts before generating morning brief
  - If user consistently previews (engagement signal) → add more detail
  - If user skips preview → keep it minimal
```

**Review engagement strategy:**

```
The review must be frictionless or users will skip it.

Rules:
  - Never more than 4 screens
  - Never require typing (except optional note)
  - Never take more than 2 minutes
  - If user completed 0 tasks, review is just 1 screen:
    "No worries about today. Tomorrow is a fresh start. Quick check:
     are you still on track this week, or should we adjust?"
  - If user did the review yesterday, pre-fill what hasn't changed
  - Review can be done from a push notification (inline reply on mobile)

Incentive:
  - Completing the review counts toward streak maintenance
  - Review streak: "You've reviewed 10 days straight — your plan gets
    smarter every time you do this."
  - Reviews that include notes produce measurably better next-day plans
    (system can tell the user this: "Users who leave notes see 15% better
    task-fit scores the next day") [R6]
```

---

### 6.9 Weekly Rhythm and Reset

While the daily loop is the core product, a weekly cycle adds structure. [R1]

```
Sunday Evening (or user-chosen reset day):
  Weekly Review notification:
  "Your week in review — 2 minutes to set up next week."

Weekly Review includes:
  - Tasks completed / presented ratio
  - Milestone progress update
  - Leading indicator trends (with sparkline charts)
  - Top accomplishment of the week (auto-selected)
  - What worked well (based on high-completion, low-difficulty tasks)
  - What to improve (based on deferred or struggled tasks)
  - Next week preview: key tasks and any deadlines

  Example:
  "This week: 14/17 tasks completed (82%). Your Turo listing got 45 views
   and 3 booking requests. Interview milestone is 90% done. Next week:
   finalize feature list and start wireframes."

Weekly also triggers:
  - Agent confidence recalibration based on the week's data
  - Leading indicator trend analysis (2-week minimum for trends)
  - Template fit check: are tasks appropriate for user's actual situation? [R1]
  - Budget reconciliation: actual spend vs planned spend
```

---

### Section Cross-Reference Notes

These three sections form the operational core of GoalPilot:

- **Section 4 (Planning Engine)** creates the plan — templates, milestones, and
  task decomposition provide the strategic structure. [R1] [R2] [R5]

- **Section 5 (Agent System)** augments execution — constrained agents research,
  draft, analyze, and execute within strict boundaries. [R3] [R5] [R7]

- **Section 6 (Daily Loop Engine)** drives daily engagement — the scoring algorithm,
  adaptive cap, brief generation, and review cycle keep users making progress
  every single day. [R1] [R4] [R6]

The risks tracked throughout:
- [R1] Template rigidity vs real life — addressed by context layer, adaptive replanning, missed day handling
- [R2] Cold start problem — addressed by calibration questions, progressive agent activation
- [R3] Approval fatigue — addressed by batching, auto-approve windows, notification limits
- [R4] "1-3 tasks" cap may not be enough — addressed by adaptive cap, bonus tasks, unlimited automations
- [R5] Domain expertise is expensive — addressed by template architecture, agent specialization
- [R6] Measuring success is hard — addressed by leading indicators, process celebrations, momentum score
- [R7] AI being wrong — addressed by confidence scores, circuit breakers, rollback mechanisms, replan guardrails
---

# 7. Execution Layer

The execution layer is where GoalPilot translates plans into real-world outcomes. Every
automated action flows through controlled workflows ("lanes"), passes the approval
system, and enters a monitoring window. Nothing runs unchecked.

**Risk tags in this section: [R1] [R5] [R6] [R7]**

---

## 7.1 Execution Lanes

Each goal template defines an **execution lane** — a constrained workflow that declares
exactly which integrations are permitted, what actions the agent can take, and what
data flows between systems. Lanes exist to prevent the agent from improvising outside
its competence. [R1] [R7]

### 7.1.1 Lane Architecture

```
┌─────────────────────────────────────────────────────┐
│                   EXECUTION LANE                     │
│                                                      │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────┐ │
│  │ Allowed  │   │   Action     │   │   Output     │ │
│  │ Integra- │──▶│   Pipeline   │──▶│   Handlers   │ │
│  │ tions    │   │              │   │              │ │
│  └──────────┘   └──────────────┘   └──────────────┘ │
│        │               │                  │          │
│        ▼               ▼                  ▼          │
│  ┌──────────────────────────────────────────────┐    │
│  │          Approval Gate (Section 8)           │    │
│  └──────────────────────────────────────────────┘    │
│        │               │                  │          │
│        ▼               ▼                  ▼          │
│  ┌──────────────────────────────────────────────┐    │
│  │        48-Hour Monitoring Window             │    │
│  └──────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### 7.1.2 Lane Definitions by Goal Type

**Turo Side Hustle Lane**

| Component         | Details                                              |
|-------------------|------------------------------------------------------|
| Allowed APIs      | Turo API, Google Maps, weather services, pricing tools |
| Allowed Actions   | Adjust pricing, respond to inquiries, optimize photos, update availability |
| Data In           | Booking data, market comps, vehicle telemetry, reviews |
| Data Out          | Price changes, listing updates, guest messages        |
| Forbidden         | Accepting/declining bookings (always manual), financial account changes |

**SaaS Builder Lane**

| Component         | Details                                              |
|-------------------|------------------------------------------------------|
| Allowed APIs      | GitHub, Vercel, Stripe, PostHog, Resend              |
| Allowed Actions   | Create issues, deploy previews, draft changelogs, send transactional emails |
| Data In           | Repository data, deploy status, revenue metrics, user analytics |
| Data Out          | Code commits (to branches only), deploy triggers, email drafts |
| Forbidden         | Production deploys (staging only), Stripe plan changes, deleting repos |

**Fitness Lane**

| Component         | Details                                              |
|-------------------|------------------------------------------------------|
| Allowed APIs      | Apple Health, MyFitnessPal, Strava                   |
| Allowed Actions   | Log meals, suggest workouts, track metrics, set reminders |
| Data In           | Health metrics, workout history, nutrition data       |
| Data Out          | Meal plans, workout schedules, progress reports       |
| Forbidden         | Modifying health records, medical advice, supplement purchases |

**Social Media Growth Lane**

| Component         | Details                                              |
|-------------------|------------------------------------------------------|
| Allowed APIs      | Twitter/X API, Instagram Graph API, Buffer, Canva    |
| Allowed Actions   | Schedule posts, draft content, analyze engagement, suggest hashtags |
| Data In           | Engagement metrics, follower data, content performance |
| Data Out          | Scheduled posts, content drafts, analytics reports    |
| Forbidden         | DM automation, follow/unfollow bots, purchasing followers |

Lanes are intentionally rigid. A fitness goal cannot suddenly start posting to Twitter.
If a user needs cross-lane functionality, they create a separate goal — GoalPilot does
not blend lanes. This prevents the system from overreaching and keeps domain expertise
focused. [R1] [R5]

### 7.1.3 Custom Lane Requests

Users can request new lane types. These go into a review queue:

1. User describes the goal type and desired integrations.
2. GoalPilot team reviews for feasibility and safety.
3. If approved, a new lane template is built with appropriate guardrails.
4. Lane enters beta with heightened monitoring for the first 30 days.

This is deliberately slow. Rushing lane creation risks exposing users to poorly
constrained automation. [R5] [R7]

---

## 7.2 Integration Points

### 7.2.1 Connection Model

All third-party integrations use OAuth2 where available. API key integrations are
stored encrypted (AES-256) and scoped to the minimum permissions required.

```
User grants OAuth2 permission
        │
        ▼
┌─────────────────┐
│ Token Vault      │  ← encrypted at rest, per-user isolation
│ - access_token   │
│ - refresh_token  │
│ - scopes[]       │
│ - expires_at     │
└─────────────────┘
        │
        ▼
┌─────────────────┐
│ Integration      │  ← abstraction layer per service
│ Adapter          │
│ - rate limiting  │
│ - error handling │
│ - data mapping   │
└─────────────────┘
        │
        ▼
┌─────────────────┐
│ Third-Party API  │
└─────────────────┘
```

### 7.2.2 Data Flow Rules

- **Inbound data** is normalized into GoalPilot's internal schema before processing.
- **Outbound actions** are serialized into an action record before execution.
- All data flows are logged with timestamps, payloads (sensitive fields redacted),
  and correlation IDs.
- No raw third-party data is stored beyond 90 days unless the user opts in.

---

## 7.3 Automated Action Pipeline

Every agent-initiated action follows this pipeline without exception:

### Step 1: Action Proposal

The agent generates a proposed action based on the current plan state, available data,
and goal context.

```
ActionProposal {
  id:            uuid
  goal_id:       uuid
  lane:          string          // e.g., "turo", "saas"
  action_type:   string          // e.g., "adjust_pricing"
  description:   string          // human-readable explanation
  parameters:    object          // action-specific payload
  confidence:    float (0-1)     // agent's self-assessed confidence
  risk_level:    enum            // low, medium, high
  estimated_cost: float | null   // financial cost if applicable
  reversible:    boolean
  reasoning:     string          // why the agent thinks this is right
}
```

### Step 2: Confidence Gate

Before reaching the approval system, the action passes through confidence-gated
execution (see Section 7.5). Actions below the confidence threshold are blocked
regardless of trust level. [R7]

### Step 3: Approval Routing

The action routes through the trust and approval system (Section 8). Depending on
trust level and risk classification, the action is either:
- Queued for pre-approval
- Auto-executed with post-review
- Auto-executed within guardrails

### Step 4: Execution

Upon approval (or auto-approval), the action executes through the lane's integration
adapter. The system records:
- Execution timestamp
- API call details (method, endpoint, request/response)
- Success/failure status
- Side effects observed

### Step 5: Confirmation and Logging

```
ActionResult {
  action_id:      uuid
  status:         enum            // success, partial, failed, rolled_back
  executed_at:    timestamp
  result_data:    object          // what changed
  monitoring_id:  uuid            // links to 48-hour monitoring window
  rollback_available: boolean
  rollback_deadline:  timestamp   // when rollback expires
}
```

---

## 7.4 48-Hour Monitoring Window

Every automated action enters a 48-hour monitoring window immediately after execution.
This is non-negotiable — even at the Autonomous trust level. [R6] [R7]

### 7.4.1 What Is Monitored

| Signal            | Description                                    | Example                          |
|-------------------|------------------------------------------------|----------------------------------|
| Engagement delta  | Change in relevant metrics post-action          | Post engagement dropped 40%      |
| Error rate        | API errors or unexpected responses              | Turo API returning 500s          |
| Cost tracking     | Financial impact of the action                  | Ad spend exceeding projected     |
| Anomaly detection | Statistical deviation from baseline             | Unusual traffic pattern          |
| User signals      | User complaints, negative feedback              | Bad review after price change    |

### 7.4.2 Alert Thresholds

- **Yellow alert**: Metric deviates > 1 standard deviation from baseline. User notified,
  no automatic action taken.
- **Orange alert**: Metric deviates > 2 standard deviations. User notified urgently.
  Rollback recommended.
- **Red alert**: Metric deviates > 3 standard deviations OR hard limit breached.
  Auto-rollback triggered. User notified immediately.

### 7.4.3 Auto-Rollback Triggers

Auto-rollback fires without waiting for user input when:
- Financial cost exceeds 2x the estimated cost
- Error rate exceeds 10% of related API calls
- A "forbidden action" somehow executed (defense in depth)
- The third-party service reports the action violated their ToS

Rollback records the reversal and decrements trust score (see Section 8).

---

## 7.5 Confidence-Gated Execution

The agent assigns a confidence score (0.0 to 1.0) to every proposed action. This score
reflects how certain the agent is that the action is correct, timely, and aligned with
the user's goal. Confidence gating is a safety layer independent of trust levels. [R7]

### Confidence Tiers

```
Confidence < 0.5   │  BLOCKED
                    │  Action is rejected outright. Flagged for human review.
                    │  Agent must explain uncertainty and suggest alternatives.
                    │  This prevents the system from acting on guesses.
────────────────────┼──────────────────────────────────────────────────────
0.5 ≤ Conf < 0.7   │  MANDATORY APPROVAL
                    │  Requires explicit user approval regardless of trust
                    │  level. Even Autonomous users must approve these.
                    │  Presented with the agent's reasoning and caveats.
────────────────────┼──────────────────────────────────────────────────────
0.7 ≤ Conf < 0.9   │  TRUST-DEPENDENT
                    │  Follows normal trust level rules (Section 8).
                    │  New users approve; Autonomous users auto-execute.
────────────────────┼──────────────────────────────────────────────────────
Confidence ≥ 0.9   │  AUTO-EXECUTE (Trusted+)
                    │  Auto-executes for users at Trusted or Autonomous
                    │  level. New and Building users still approve.
                    │  Still enters 48-hour monitoring window.
```

### Confidence Calibration

Confidence scores are not arbitrary. They are calibrated against historical outcomes:
- If the agent says 0.9 confidence, approximately 90% of such actions should succeed.
- Calibration is tracked per lane and per action type.
- Poorly calibrated agents have their confidence scores dampened (multiplied by a
  calibration factor < 1.0) until accuracy improves. [R7]

---

## 7.6 Execution Layer Risk Analysis

| Risk | How It Manifests | Mitigation |
|------|-----------------|------------|
| [R1] Template rigidity vs real life | Lanes are too restrictive for edge cases | Custom lane requests, regular lane reviews |
| [R5] Domain expertise is expensive | Each lane requires deep integration knowledge | Start with 4 lanes, expand slowly, partner with domain experts |
| [R6] Measuring success is hard | 48-hour window may miss slow-moving impacts | Extend monitoring for high-risk actions, track long-term trends |
| [R7] AI being wrong | Agent proposes harmful or incorrect actions | Confidence gating, approval pipeline, auto-rollback, lane constraints |

---
---

# 8. Trust & Approval System

The trust system governs how much autonomy GoalPilot earns over time. It starts
locked down and opens up gradually — but only if the system proves it deserves
that trust. Users always retain override authority.

**Risk tags in this section: [R3] [R6] [R7]**

---

## 8.1 Trust Levels

GoalPilot defines four trust levels. Every user starts at New. Progression is
earned, never assumed.

### 8.1.1 Level Definitions

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   NEW (Days 1–7)                                             │
│   ══════════════                                             │
│   ALL actions require pre-approval. No exceptions.           │
│                                                              │
│   The system is in learning mode:                            │
│   - Observing user preferences and approval patterns         │
│   - Calibrating confidence scores against user feedback      │
│   - Building a baseline for anomaly detection                │
│                                                              │
│   User experience: High-touch. Every proposed action gets    │
│   a notification. This is intentionally friction-heavy to    │
│   build user confidence in the system. [R3]                  │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   BUILDING (Days 8–21)                                       │
│   ═══════════════════                                        │
│   Low-risk actions shift to post-review.                     │
│   Medium-risk actions still require pre-approval.            │
│   High-risk actions always require pre-approval.             │
│                                                              │
│   The system begins to act independently on safe tasks:      │
│   - Research, data gathering, draft creation                 │
│   - Internal analytics and reporting                         │
│   - Scheduling and reminders                                 │
│                                                              │
│   User experience: Reduced notification volume. Daily        │
│   summary of auto-handled low-risk actions. [R3]             │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   TRUSTED (Days 22–60)                                       │
│   ═══════════════════                                        │
│   Most actions shift to post-review.                         │
│   Only high-risk and high-cost actions pre-approve.          │
│                                                              │
│   The system handles the majority of routine execution:      │
│   - Publishing content on approved schedules                 │
│   - Making purchases within budget limits                    │
│   - Sending communications from approved templates           │
│                                                              │
│   User experience: Weekly autonomy report replaces daily     │
│   check-ins for most actions. Urgent items still notify      │
│   immediately. [R3]                                          │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   AUTONOMOUS (Day 60+)                                       │
│   ═════════════════════                                      │
│   System operates within defined guardrails.                 │
│   User reviews weekly summary.                               │
│                                                              │
│   The system runs the goal with minimal interruption:        │
│   - All actions within guardrails execute automatically      │
│   - User reviews a weekly autonomy report                    │
│   - Only guardrail-exceeding actions require approval        │
│                                                              │
│   User experience: "Set and forget" within boundaries.       │
│   User spends ~5 minutes per week reviewing. [R3]            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 8.1.2 Trust Level Per Goal

Trust levels are tracked **per goal**, not per user. A user might be Autonomous on
their Turo goal (running for 90 days) but New on a freshly created SaaS goal. This
prevents trust earned in one domain from granting unearned autonomy in another. [R7]

---

## 8.2 Risk Classification

Every action the agent can take is pre-classified into a risk tier. Classification
is determined by the lane definition and cannot be overridden by the agent.

### 8.2.1 Risk Tiers

**Low-Risk Actions**
- Research and data gathering
- Draft content creation (not published)
- Internal analytics and reporting
- Scheduling reminders and calendar events
- Generating recommendations (no execution)
- Reading data from integrations

**Medium-Risk Actions**
- Publishing content to platforms
- Sending communications (emails, messages)
- Making purchases under $50
- Modifying non-critical settings
- Creating public-facing drafts for review
- Scheduling actions for future execution

**High-Risk Actions**
- Purchases over $50
- Account setting changes
- Public-facing changes (live content, pricing)
- Anything irreversible
- Actions affecting other people (team invites, permissions)
- Financial account modifications
- Deleting data or content

### 8.2.2 Risk Escalation

Certain combinations escalate risk regardless of individual classification:
- More than 5 medium-risk actions in a single day → treated as high-risk batch
- Any action targeting a new integration (first use) → escalated one tier
- Actions during unusual hours (for the user) → escalated one tier
- Repeated actions that were previously rejected → escalated one tier

---

## 8.3 Trust Escalation

Trust progression is not purely time-based. The day ranges (1-7, 8-21, etc.) are
**minimums**. A user cannot reach Trusted before day 22, but they might not reach
it until day 45 if the system has concerns.

### 8.3.1 Trust Score Formula

```
trust_score = (
    approval_rate        * 0.35    // % of proposed actions approved
  + response_speed       * 0.15    // how quickly user responds to approvals
  + action_success_rate  * 0.30    // % of executed actions without rollback
  + consistency_score    * 0.20    // regularity of user engagement
)
```

Each component is normalized to 0.0–1.0.

**Escalation thresholds:**
- New → Building: trust_score ≥ 0.6 AND minimum 7 days AND ≥ 10 approved actions
- Building → Trusted: trust_score ≥ 0.7 AND minimum 22 days AND ≥ 30 approved actions
- Trusted → Autonomous: trust_score ≥ 0.8 AND minimum 60 days AND ≥ 100 approved actions

### 8.3.2 Trust Regression

Trust can decrease. The following events cause trust regression:

| Event                          | Impact                                    |
|--------------------------------|-------------------------------------------|
| User rejects a proposed action | -0.02 to trust_score                      |
| Action requires rollback       | -0.05 to trust_score                      |
| Auto-rollback triggered        | -0.10 to trust_score, possible level drop  |
| User files a complaint         | -0.15 to trust_score, mandatory level drop |
| User manually activates emergency stop | Reset to New for that goal        |

**Level drop rules:**
- If trust_score drops below the threshold for the current level, the system
  drops one level after a 48-hour grace period.
- During the grace period, all actions revert to pre-approval.
- The user is notified of the regression and the reasons.
- Regaining a lost level requires meeting the original threshold again but with
  no minimum day requirement (the system already knows the user).

---

## 8.4 Weekly Autonomy Report

At the Trusted and Autonomous levels, the system generates a weekly autonomy report.
This is the primary mechanism for keeping users informed without overwhelming them. [R3]

### 8.4.1 Report Structure

```
Weekly Autonomy Report — [Goal Name]
Week of [Date Range]
Trust Level: [Level] (Score: [X.XX])

═══ SUMMARY ════════════════════════════════════
Actions taken automatically:     [count]
Actions requiring your approval: [count]
Actions blocked by system:       [count]
Total estimated value delivered:  [amount or metric]

═══ WHAT THE SYSTEM DID ON ITS OWN ═════════════
[List of auto-executed actions, grouped by type]
- Adjusted Turo pricing 3 times (avg +$8/day)
- Published 5 social media posts
- Responded to 2 guest inquiries

═══ WHAT IT ASKED YOU ABOUT AND WHY ════════════
[List of actions that required approval, with reasons]
- Asked to purchase new listing photos ($75) — exceeded $50 threshold
- Asked to change availability for July — high-risk scheduling change

═══ WHAT WAS BLOCKED ═══════════════════════════
[List of blocked actions with explanations]
- Attempted to lower price below minimum — confidence too low (0.45)
- Proposed a guest response — new message type, escalated for review

═══ RECOMMENDATIONS ════════════════════════════
Based on this week's patterns:
- Consider raising the auto-purchase limit to $75 (3 approvals were
  routine purchases between $50-$75)
- The system is confident in pricing adjustments — consider moving
  to Autonomous for this action type

═══ YOUR CONTROLS ══════════════════════════════
[Adjust trust boundaries]  [Pause automation]  [Review all actions]
```

### 8.4.2 User Adjustments

From the weekly report, users can:
- Raise or lower spend limits
- Move specific action types between risk tiers
- Pause automation for specific integrations
- Expand or contract the set of auto-approved actions
- Override the trust level (up or down) for the goal

---

## 8.5 Pre-Approval to Post-Review Shift

The transition from pre-approval to post-review is the core mechanism for reducing
approval fatigue. [R3]

### 8.5.1 Post-Review Batching

Post-review items are batched and presented in three tiers:

**"Nothing to worry about"** (green)
- Routine actions that succeeded as expected.
- Metrics are within normal range.
- User can skim or skip entirely.
- Example: "Adjusted pricing based on demand — bookings unchanged."

**"Heads up"** (yellow)
- Actions that succeeded but with noteworthy outcomes.
- Metrics deviated slightly from expected.
- User should read but likely no action needed.
- Example: "Published post — engagement 20% lower than average."

**"Needs your attention"** (red)
- Actions that may need reversal or follow-up.
- Metrics deviated significantly or unexpected side effects observed.
- User should review and decide.
- Example: "Price drop resulted in 3 bookings at low margin — review pricing."

### 8.5.2 Reversal Window

All post-review actions include a **24-hour reversal window**:
- During this window, the user can undo any auto-executed action with one tap.
- After 24 hours, reversal requires a manual process (some actions may be irreversible).
- The 24-hour clock starts when the user is **notified**, not when the action executes.
  This prevents the window from expiring before the user sees the action.

---

## 8.6 Safety Rails and Hard Limits

These guardrails cannot be bypassed by the agent or overridden by trust progression.
They are absolute constraints. [R7]

### 8.6.1 Financial Limits

- **Daily spend cap**: User-configurable, default $25/day.
- **Single transaction cap**: User-configurable, default $50.
- **Weekly spend cap**: 5x daily cap by default.
- **Monthly spend cap**: 20x daily cap by default.
- All caps can be raised by the user but never by the agent.

### 8.6.2 Action Rate Limits

- **Maximum actions per hour**: 10 (prevents runaway loops).
- **Maximum actions per day**: 50 (prevents excessive automation).
- **Maximum API calls per integration per hour**: 100 (prevents rate limit abuse).
- Rate limits apply even at Autonomous level.

### 8.6.3 Forbidden Action Categories

The following actions are NEVER auto-executed, regardless of trust level:

- Deleting user accounts or data
- Changing authentication credentials
- Granting third-party access to user accounts
- Making legal commitments (signing agreements, ToS acceptance)
- Sending communications that impersonate the user without disclosure
- Actions that violate the third-party service's ToS
- Financial actions without clear user-set budgets

### 8.6.4 Emergency Stop

Users can trigger an emergency stop at any time:

1. **Immediate effect**: All pending and in-progress actions halt.
2. **Rollback offer**: System offers to rollback all actions from the last 24 hours.
3. **Trust reset**: Trust level for the affected goal resets to New.
4. **Cool-down**: 48-hour cool-down before automation can resume.
5. **Post-mortem**: System generates a report of what happened and why.

The emergency stop is accessible from:
- The mobile app (prominent red button)
- The web dashboard
- A dedicated email address (stop@goalpilot.com)
- Reply "STOP" to any GoalPilot notification

---

## 8.7 Trust System Risk Analysis

| Risk | How It Manifests | Mitigation |
|------|-----------------|------------|
| [R3] Approval fatigue | Users ignore approvals, rubber-stamp everything | Post-review batching, tiered urgency, gradual autonomy |
| [R3] Too much friction early on | Users abandon during New phase | Clear progress indicators, "X days until less approvals" messaging |
| [R6] Measuring trust accurately | Trust score may not reflect actual reliability | Multi-factor score, calibration tracking, regression mechanisms |
| [R7] AI acting on false confidence | High confidence + wrong action = damage | Confidence calibration, 48-hour monitoring, hard limits |

---
---

# 9. API Design

GoalPilot exposes a RESTful API for all client interactions. All endpoints require
authentication unless noted. All request and response bodies are JSON.

**Base URL**: `https://api.goalpilot.com/api/v1`

**Risk tags in this section: [R2] [R4] [R7]**

---

## 9.1 Authentication Model

### JWT with Refresh Tokens

- Access tokens expire after 15 minutes.
- Refresh tokens expire after 30 days.
- Refresh tokens are rotated on use (one-time use).
- All tokens are signed with RS256.

### OAuth2 for Third-Party Integrations

- GoalPilot acts as an OAuth2 client for third-party services.
- User grants permissions via OAuth2 authorization code flow.
- Tokens are stored encrypted in the Token Vault (see Section 7.2.1).

---

## 9.2 Auth Endpoints

### POST /api/v1/auth/register

Create a new user account.

**Auth required**: No

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123!",
  "name": "Alex Chen",
  "timezone": "America/Los_Angeles"
}
```

**Response (201 Created):**
```json
{
  "user": {
    "id": "usr_a1b2c3d4e5f6",
    "email": "user@example.com",
    "name": "Alex Chen",
    "timezone": "America/Los_Angeles",
    "created_at": "2026-04-21T10:00:00Z"
  },
  "tokens": {
    "access_token": "eyJhbGciOiJSUzI1NiIs...",
    "refresh_token": "rt_x7y8z9...",
    "expires_in": 900
  }
}
```

**Errors:**
- `409 Conflict` — Email already registered
- `422 Unprocessable Entity` — Invalid email format or weak password

---

### POST /api/v1/auth/login

Authenticate an existing user.

**Auth required**: No

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123!"
}
```

**Response (200 OK):**
```json
{
  "user": {
    "id": "usr_a1b2c3d4e5f6",
    "email": "user@example.com",
    "name": "Alex Chen",
    "timezone": "America/Los_Angeles"
  },
  "tokens": {
    "access_token": "eyJhbGciOiJSUzI1NiIs...",
    "refresh_token": "rt_x7y8z9...",
    "expires_in": 900
  }
}
```

**Errors:**
- `401 Unauthorized` — Invalid credentials
- `429 Too Many Requests` — Rate limited after 5 failed attempts

---

### POST /api/v1/auth/refresh

Refresh an expired access token.

**Auth required**: No (refresh token in body)

**Request body:**
```json
{
  "refresh_token": "rt_x7y8z9..."
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "refresh_token": "rt_newtoken...",
  "expires_in": 900
}
```

**Errors:**
- `401 Unauthorized` — Invalid or expired refresh token

---

## 9.3 User Endpoints

### GET /api/v1/users/me

Retrieve the authenticated user's profile.

**Auth required**: Yes (Bearer token)

**Response (200 OK):**
```json
{
  "id": "usr_a1b2c3d4e5f6",
  "email": "user@example.com",
  "name": "Alex Chen",
  "timezone": "America/Los_Angeles",
  "created_at": "2026-04-21T10:00:00Z",
  "active_goals_count": 2,
  "integrations_connected": ["turo", "github"],
  "notification_preferences": {
    "email": true,
    "push": true,
    "sms": false
  }
}
```

---

### PATCH /api/v1/users/me

Update user profile fields.

**Auth required**: Yes

**Request body (partial update):**
```json
{
  "name": "Alex M. Chen",
  "timezone": "America/New_York",
  "notification_preferences": {
    "sms": true
  }
}
```

**Response (200 OK):** Updated user object (same shape as GET).

---

### GET /api/v1/users/me/trust-level

Get trust level summary across all goals.

**Auth required**: Yes

**Response (200 OK):**
```json
{
  "goals": [
    {
      "goal_id": "goal_abc123",
      "goal_name": "Turo Side Hustle",
      "trust_level": "trusted",
      "trust_score": 0.78,
      "days_at_level": 15,
      "next_level": "autonomous",
      "next_level_requirements": {
        "min_days_remaining": 23,
        "min_score_needed": 0.80,
        "approved_actions_needed": 42
      }
    },
    {
      "goal_id": "goal_def456",
      "goal_name": "Launch MVP",
      "trust_level": "new",
      "trust_score": 0.55,
      "days_at_level": 3,
      "next_level": "building",
      "next_level_requirements": {
        "min_days_remaining": 4,
        "min_score_needed": 0.60,
        "approved_actions_needed": 6
      }
    }
  ]
}
```

---

### GET /api/v1/users/me/momentum

Get the user's momentum score and streak data.

**Auth required**: Yes

**Response (200 OK):**
```json
{
  "momentum_score": 72,
  "trend": "rising",
  "current_streak": 12,
  "longest_streak": 18,
  "weekly_completion_rate": 0.85,
  "momentum_history": [
    { "date": "2026-04-20", "score": 70 },
    { "date": "2026-04-19", "score": 68 },
    { "date": "2026-04-18", "score": 71 }
  ]
}
```

---

## 9.4 Goal Endpoints

### POST /api/v1/goals

Create a new goal with diagnostic answers. This is the primary onboarding endpoint. [R2]

**Auth required**: Yes

**Request body:**
```json
{
  "template_id": "tmpl_turo_side_hustle",
  "diagnostic_answers": {
    "what_do_you_want": "Make $2000/month renting my car on Turo",
    "why_now": "Car sits unused 20 days a month, need extra income",
    "tried_before": "Listed it once but got no bookings",
    "time_available": "5_hours_per_week",
    "budget": "$200 for initial setup",
    "timeline": "90_days",
    "biggest_obstacle": "Don't know how to price competitively",
    "success_looks_like": "Consistent bookings at $75+/day"
  },
  "integrations": ["turo"],
  "preferences": {
    "daily_task_limit": 3,
    "notification_channel": "push",
    "preferred_action_time": "09:00"
  }
}
```

**Response (201 Created):**
```json
{
  "goal": {
    "id": "goal_abc123",
    "user_id": "usr_a1b2c3d4e5f6",
    "template_id": "tmpl_turo_side_hustle",
    "name": "Turo Side Hustle — $2000/mo",
    "status": "active",
    "created_at": "2026-04-21T10:30:00Z",
    "target_date": "2026-07-20T00:00:00Z",
    "trust_level": "new",
    "lane": "turo",
    "health": {
      "status": "on_track",
      "score": 100,
      "message": "Just getting started — let's build momentum."
    },
    "milestones": [
      {
        "id": "ms_001",
        "title": "Optimize listing",
        "target_date": "2026-04-28T00:00:00Z",
        "status": "not_started",
        "tasks_count": 5
      },
      {
        "id": "ms_002",
        "title": "First booking",
        "target_date": "2026-05-12T00:00:00Z",
        "status": "not_started",
        "tasks_count": 3
      },
      {
        "id": "ms_003",
        "title": "Consistent bookings",
        "target_date": "2026-06-15T00:00:00Z",
        "status": "not_started",
        "tasks_count": 8
      },
      {
        "id": "ms_004",
        "title": "Hit $2000/mo run rate",
        "target_date": "2026-07-20T00:00:00Z",
        "status": "not_started",
        "tasks_count": 6
      }
    ],
    "daily_task_limit": 3,
    "first_brief_at": "2026-04-22T09:00:00-07:00"
  }
}
```

**Errors:**
- `400 Bad Request` — Missing required diagnostic answers
- `422 Unprocessable Entity` — Invalid template ID or incompatible answers

Note on [R4]: The `daily_task_limit` defaults to 3 but can be set between 1 and 7.
The system recommends 1-3 for most users. Power users may increase this, but the
system will warn that completion rates typically drop above 3 tasks/day.

---

### GET /api/v1/goals

List all goals for the authenticated user.

**Auth required**: Yes

**Query parameters:**
- `status` (optional): `active`, `paused`, `completed`, `abandoned`
- `page` (optional): Page number (default 1)
- `per_page` (optional): Results per page (default 20, max 50)

**Response (200 OK):**
```json
{
  "goals": [
    {
      "id": "goal_abc123",
      "name": "Turo Side Hustle — $2000/mo",
      "status": "active",
      "trust_level": "trusted",
      "health": { "status": "on_track", "score": 82 },
      "progress_pct": 45,
      "created_at": "2026-02-01T10:00:00Z",
      "target_date": "2026-07-20T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 1,
    "total_pages": 1
  }
}
```

---

### GET /api/v1/goals/:id

Get full details for a specific goal.

**Auth required**: Yes

**Response (200 OK):** Full goal object (same shape as POST creation response, plus
current metrics and progress data).

**Errors:**
- `404 Not Found` — Goal does not exist or belongs to another user

---

### PATCH /api/v1/goals/:id

Update goal settings.

**Auth required**: Yes

**Request body (partial update):**
```json
{
  "daily_task_limit": 2,
  "preferences": {
    "preferred_action_time": "08:00"
  },
  "target_date": "2026-08-01T00:00:00Z"
}
```

**Response (200 OK):** Updated goal object.

---

### DELETE /api/v1/goals/:id

Abandon a goal. This does not delete data — it marks the goal as abandoned and
stops all automation.

**Auth required**: Yes

**Request body:**
```json
{
  "reason": "Changed priorities",
  "feedback": "The system was helpful but I'm focusing elsewhere"
}
```

**Response (200 OK):**
```json
{
  "id": "goal_abc123",
  "status": "abandoned",
  "abandoned_at": "2026-04-21T15:00:00Z",
  "automation_stopped": true,
  "pending_actions_cancelled": 3
}
```

---

### POST /api/v1/goals/:id/replan

Trigger a replan for a goal. Used when circumstances change significantly. [R1]

**Auth required**: Yes

**Request body:**
```json
{
  "reason": "Got a second car to list",
  "changes": {
    "new_target": "$3500/month with two cars",
    "additional_context": "Second car is a Tesla Model 3, already insured"
  }
}
```

**Response (200 OK):**
```json
{
  "replan_id": "rp_xyz789",
  "status": "processing",
  "estimated_completion": "2026-04-21T15:05:00Z",
  "message": "Replanning in progress. You'll receive updated milestones shortly."
}
```

---

### GET /api/v1/goals/:id/milestones

Get all milestones for a goal.

**Auth required**: Yes

**Response (200 OK):**
```json
{
  "milestones": [
    {
      "id": "ms_001",
      "title": "Optimize listing",
      "description": "Get your Turo listing to competitive quality",
      "target_date": "2026-04-28T00:00:00Z",
      "status": "completed",
      "completed_at": "2026-04-26T14:00:00Z",
      "tasks_total": 5,
      "tasks_completed": 5
    },
    {
      "id": "ms_002",
      "title": "First booking",
      "description": "Land your first Turo booking",
      "target_date": "2026-05-12T00:00:00Z",
      "status": "in_progress",
      "completed_at": null,
      "tasks_total": 3,
      "tasks_completed": 1
    }
  ]
}
```

---

### GET /api/v1/goals/:id/health

Get goal health assessment. [R6]

**Auth required**: Yes

**Response (200 OK):**
```json
{
  "goal_id": "goal_abc123",
  "health": {
    "status": "at_risk",
    "score": 55,
    "factors": [
      {
        "name": "completion_rate",
        "value": 0.60,
        "impact": "negative",
        "message": "Task completion has dropped — 3 of 5 tasks skipped this week"
      },
      {
        "name": "milestone_pace",
        "value": 0.80,
        "impact": "neutral",
        "message": "Slightly behind on Milestone 3 but recoverable"
      },
      {
        "name": "engagement",
        "value": 0.45,
        "impact": "negative",
        "message": "You haven't opened the app in 3 days"
      }
    ],
    "recommendation": "Consider reducing daily tasks to 1-2 to rebuild momentum",
    "next_check": "2026-04-22T09:00:00Z"
  }
}
```

---

## 9.5 Template Endpoints

### GET /api/v1/templates

List available goal templates.

**Auth required**: Yes

**Query parameters:**
- `category` (optional): `income`, `fitness`, `learning`, `creative`, `business`
- `search` (optional): Free text search

**Response (200 OK):**
```json
{
  "templates": [
    {
      "id": "tmpl_turo_side_hustle",
      "name": "Turo Side Hustle",
      "category": "income",
      "description": "Turn your idle car into a consistent income stream on Turo",
      "typical_timeline": "90 days",
      "required_integrations": ["turo"],
      "optional_integrations": ["google_calendar"],
      "popularity": 342,
      "avg_completion_rate": 0.68
    }
  ]
}
```

---

### GET /api/v1/templates/:id

Get full template details.

**Auth required**: Yes

**Response (200 OK):** Full template object with lane definition, integration
requirements, and milestone structure.

---

### GET /api/v1/templates/:id/diagnostic

Get the diagnostic questionnaire for a template. [R2]

**Auth required**: Yes

**Response (200 OK):**
```json
{
  "template_id": "tmpl_turo_side_hustle",
  "questions": [
    {
      "id": "what_do_you_want",
      "type": "text",
      "question": "What's your income target from Turo?",
      "required": true,
      "placeholder": "e.g., $2000/month"
    },
    {
      "id": "time_available",
      "type": "select",
      "question": "How many hours per week can you dedicate?",
      "required": true,
      "options": [
        { "value": "2_hours_per_week", "label": "~2 hours" },
        { "value": "5_hours_per_week", "label": "~5 hours" },
        { "value": "10_hours_per_week", "label": "~10 hours" }
      ]
    }
  ]
}
```

---

## 9.6 Daily Loop Endpoints

### GET /api/v1/daily/brief

Get today's daily brief. This is the most frequently called endpoint. [R4]

**Auth required**: Yes

**Query parameters:**
- `goal_id` (optional): Filter to a specific goal. Omit for combined brief.

**Response (200 OK):**
```json
{
  "date": "2026-04-21",
  "greeting": "Good morning, Alex. Here's your Monday brief.",
  "momentum": {
    "score": 72,
    "trend": "rising",
    "streak": 12,
    "message": "Strong week — you're building real momentum."
  },
  "goals_summary": [
    {
      "goal_id": "goal_abc123",
      "goal_name": "Turo Side Hustle",
      "health": "on_track",
      "highlight": "2 bookings confirmed this week — $180 earned"
    }
  ],
  "tasks": [
    {
      "id": "task_t1",
      "goal_id": "goal_abc123",
      "title": "Review and approve updated pricing strategy",
      "description": "The system analyzed competitor pricing and recommends adjusting your weekday rate from $65 to $72. Review the analysis and approve or modify.",
      "type": "human_action",
      "priority": "high",
      "estimated_minutes": 10,
      "context": {
        "analysis_url": "/api/v1/agent-actions/aa_pricing_01",
        "current_price": 65,
        "recommended_price": 72,
        "reasoning": "3 comparable vehicles within 5 miles are priced at $70-$80"
      },
      "due_by": "2026-04-21T23:59:00Z"
    },
    {
      "id": "task_t2",
      "goal_id": "goal_abc123",
      "title": "Take 3 new interior photos",
      "description": "Your listing photos are 30 days old. Listings with fresh photos get 23% more views. Take 3 new interior shots in natural light.",
      "type": "human_action",
      "priority": "medium",
      "estimated_minutes": 15,
      "context": {
        "photo_tips_url": "/docs/photo-guide",
        "current_photo_count": 8,
        "recommended_photo_count": 12
      },
      "due_by": "2026-04-21T23:59:00Z"
    },
    {
      "id": "task_t3",
      "goal_id": "goal_abc123",
      "title": "Respond to guest question about airport pickup",
      "description": "A potential guest asked about airport pickup options. Draft response is ready for your review.",
      "type": "review_and_approve",
      "priority": "high",
      "estimated_minutes": 5,
      "context": {
        "draft_response": "Hi! I don't offer airport pickup, but LAX FlyAway bus stops 2 blocks from the car. Happy to share directions!",
        "guest_message": "Do you offer airport pickup?",
        "approval_id": "appr_msg_01"
      },
      "due_by": "2026-04-21T18:00:00Z"
    }
  ],
  "agent_updates": [
    {
      "type": "auto_completed",
      "description": "Adjusted weekend pricing to $85/day based on demand surge",
      "action_id": "aa_wknd_01",
      "status": "monitoring",
      "monitoring_hours_remaining": 36
    }
  ],
  "pending_approvals_count": 1,
  "next_brief_at": "2026-04-22T09:00:00-07:00"
}
```

---

### POST /api/v1/daily/tasks/:id/complete

Mark a task as completed.

**Auth required**: Yes

**Request body:**
```json
{
  "notes": "Updated photos uploaded to Turo",
  "attachments": [],
  "time_spent_minutes": 12
}
```

**Response (200 OK):**
```json
{
  "task_id": "task_t2",
  "status": "completed",
  "completed_at": "2026-04-21T14:30:00Z",
  "momentum_impact": "+3",
  "new_momentum_score": 75
}
```

---

### POST /api/v1/daily/tasks/:id/skip

Skip a task with a reason.

**Auth required**: Yes

**Request body:**
```json
{
  "reason": "no_time",
  "reschedule": true,
  "notes": "Will do tomorrow morning"
}
```

**Response (200 OK):**
```json
{
  "task_id": "task_t2",
  "status": "skipped",
  "rescheduled_to": "2026-04-22",
  "momentum_impact": "-1",
  "new_momentum_score": 71,
  "skip_count_this_week": 2,
  "warning": null
}
```

---

### POST /api/v1/daily/review

Submit end-of-day review.

**Auth required**: Yes

**Request body:**
```json
{
  "energy_level": 3,
  "wins": "Got great photos, pricing looks better",
  "blockers": "Didn't have time for the guest message",
  "tomorrow_focus": "Respond to pending messages first thing"
}
```

**Response (200 OK):**
```json
{
  "review_id": "rev_20260421",
  "recorded_at": "2026-04-21T22:00:00Z",
  "summary": "Solid day — 2 of 3 tasks completed. Tomorrow's brief will prioritize the guest response.",
  "momentum_score": 71,
  "streak_status": "maintained"
}
```

---

### GET /api/v1/daily/history

Get daily brief and review history.

**Auth required**: Yes

**Query parameters:**
- `from` (optional): Start date (ISO 8601)
- `to` (optional): End date (ISO 8601)
- `goal_id` (optional): Filter by goal
- `page`, `per_page` (optional)

**Response (200 OK):**
```json
{
  "days": [
    {
      "date": "2026-04-20",
      "tasks_assigned": 3,
      "tasks_completed": 3,
      "tasks_skipped": 0,
      "momentum_score": 70,
      "review_submitted": true
    }
  ],
  "pagination": { "page": 1, "per_page": 20, "total": 15, "total_pages": 1 }
}
```

---

## 9.7 Approval Endpoints

### GET /api/v1/approvals/pending

Get all pending approval requests.

**Auth required**: Yes

**Query parameters:**
- `goal_id` (optional): Filter by goal
- `risk_level` (optional): `low`, `medium`, `high`

**Response (200 OK):**
```json
{
  "approvals": [
    {
      "id": "appr_msg_01",
      "goal_id": "goal_abc123",
      "action_type": "send_message",
      "risk_level": "medium",
      "description": "Send response to guest inquiry about airport pickup",
      "proposed_action": {
        "platform": "turo",
        "action": "send_guest_message",
        "content": "Hi! I don't offer airport pickup, but LAX FlyAway bus stops 2 blocks from the car. Happy to share directions!",
        "recipient": "Guest: Sarah M."
      },
      "agent_confidence": 0.85,
      "agent_reasoning": "Based on your previous responses to similar questions and your location data. You've answered 4 similar questions with comparable content.",
      "created_at": "2026-04-21T08:30:00Z",
      "expires_at": "2026-04-22T08:30:00Z",
      "estimated_cost": null,
      "reversible": false
    }
  ],
  "total_pending": 1
}
```

---

### POST /api/v1/approvals/:id/approve

Approve a pending action.

**Auth required**: Yes

**Request body:**
```json
{
  "modifications": null,
  "notes": "Looks good, send it"
}
```

Or with modifications:
```json
{
  "modifications": {
    "content": "Hi! I don't offer airport pickup, but the LAX FlyAway bus stops just 2 blocks away. I'll send directions after booking!"
  },
  "notes": "Tweaked the wording slightly"
}
```

**Response (200 OK):**
```json
{
  "approval_id": "appr_msg_01",
  "status": "approved",
  "approved_at": "2026-04-21T14:45:00Z",
  "modifications_applied": true,
  "execution_status": "executing",
  "monitoring_id": "mon_abc123"
}
```

---

### POST /api/v1/approvals/:id/reject

Reject a pending action.

**Auth required**: Yes

**Request body:**
```json
{
  "reason": "wrong_tone",
  "feedback": "Too casual — I prefer a more professional tone for guest messages",
  "alternative_instruction": "Rewrite in a professional but friendly tone"
}
```

**Response (200 OK):**
```json
{
  "approval_id": "appr_msg_01",
  "status": "rejected",
  "rejected_at": "2026-04-21T14:45:00Z",
  "trust_impact": -0.02,
  "retry_action_id": "aa_retry_msg_01",
  "message": "Got it. I'll redraft with a more professional tone."
}
```

---

### GET /api/v1/approvals/history

Get approval history.

**Auth required**: Yes

**Query parameters:**
- `goal_id`, `status` (`approved`, `rejected`, `expired`), `from`, `to`, `page`, `per_page`

**Response (200 OK):**
```json
{
  "approvals": [
    {
      "id": "appr_price_01",
      "action_type": "adjust_pricing",
      "status": "approved",
      "risk_level": "medium",
      "decided_at": "2026-04-20T10:00:00Z",
      "outcome": "success",
      "monitoring_status": "completed_clean"
    }
  ],
  "pagination": { "page": 1, "per_page": 20, "total": 45, "total_pages": 3 }
}
```

---

## 9.8 Agent Action Endpoints

### GET /api/v1/agent-actions

List all agent actions.

**Auth required**: Yes

**Query parameters:**
- `goal_id` (optional)
- `status` (optional): `proposed`, `approved`, `executing`, `completed`, `failed`, `rolled_back`
- `monitoring` (optional): `active`, `completed`, `alert`
- `page`, `per_page`

**Response (200 OK):**
```json
{
  "actions": [
    {
      "id": "aa_wknd_01",
      "goal_id": "goal_abc123",
      "action_type": "adjust_pricing",
      "description": "Adjusted weekend pricing to $85/day",
      "status": "completed",
      "confidence": 0.92,
      "risk_level": "medium",
      "executed_at": "2026-04-20T06:00:00Z",
      "monitoring": {
        "status": "active",
        "hours_remaining": 36,
        "alerts": [],
        "metrics": {
          "bookings_since": 2,
          "revenue_impact": "+$30"
        }
      },
      "rollback_available": true,
      "rollback_deadline": "2026-04-22T06:00:00Z"
    }
  ],
  "pagination": { "page": 1, "per_page": 20, "total": 12, "total_pages": 1 }
}
```

---

### GET /api/v1/agent-actions/:id

Get full details for a specific agent action.

**Auth required**: Yes

**Response (200 OK):** Full action object with complete execution log, monitoring
data, and rollback information.

**Errors:**
- `404 Not Found`

---

### POST /api/v1/agent-actions/:id/rollback

Manually trigger rollback for an action.

**Auth required**: Yes

**Request body:**
```json
{
  "reason": "Price too aggressive — getting low-quality bookings"
}
```

**Response (200 OK):**
```json
{
  "action_id": "aa_wknd_01",
  "rollback_status": "executing",
  "rollback_action": "Reverting weekend price from $85 to $75",
  "estimated_completion": "2026-04-21T15:02:00Z",
  "trust_impact": -0.05,
  "message": "Rolling back. The pricing will revert within 2 minutes."
}
```

**Errors:**
- `400 Bad Request` — Rollback window expired
- `409 Conflict` — Action already rolled back

---

## 9.9 WebSocket Endpoints

### ws://api.goalpilot.com/api/v1/ws/daily-brief

Real-time updates to the daily brief. Used by the mobile app and web dashboard to
reflect changes without polling.

**Auth**: JWT token sent as query parameter or in first message.

**Events sent by server:**
```json
{ "type": "task.added", "data": { "task": { ... } } }
{ "type": "task.updated", "data": { "task_id": "...", "changes": { ... } } }
{ "type": "agent.action.started", "data": { "action": { ... } } }
{ "type": "agent.action.completed", "data": { "action": { ... } } }
{ "type": "momentum.updated", "data": { "score": 75, "trend": "rising" } }
```

---

### ws://api.goalpilot.com/api/v1/ws/notifications

Real-time notification stream.

**Auth**: JWT token sent as query parameter or in first message.

**Events sent by server:**
```json
{ "type": "approval.needed", "data": { "approval_id": "...", "summary": "..." } }
{ "type": "alert.monitoring", "data": { "level": "yellow", "action_id": "...", "message": "..." } }
{ "type": "milestone.reached", "data": { "milestone": { ... } } }
{ "type": "trust.level.changed", "data": { "old": "building", "new": "trusted" } }
{ "type": "emergency.stop", "data": { "reason": "...", "actions_halted": 3 } }
```

---

## 9.10 Webhook Endpoints

### POST /api/v1/webhooks

Register a webhook for event notifications. Used by third-party integrations and
advanced users.

**Auth required**: Yes

**Request body:**
```json
{
  "url": "https://example.com/goalpilot-webhook",
  "events": [
    "task.created",
    "task.completed",
    "approval.needed",
    "agent.action.completed",
    "goal.milestone.reached"
  ],
  "secret": "whsec_user_provided_secret"
}
```

**Response (201 Created):**
```json
{
  "webhook_id": "wh_abc123",
  "url": "https://example.com/goalpilot-webhook",
  "events": [
    "task.created",
    "task.completed",
    "approval.needed",
    "agent.action.completed",
    "goal.milestone.reached"
  ],
  "status": "active",
  "created_at": "2026-04-21T10:00:00Z",
  "last_triggered": null
}
```

### Webhook Event Types

| Event                      | Trigger                                        | Payload Includes              |
|----------------------------|------------------------------------------------|-------------------------------|
| `task.created`             | New task added to daily brief                  | Task object                   |
| `task.completed`           | User marks a task complete                     | Task object, momentum impact  |
| `task.skipped`             | User skips a task                              | Task object, reason           |
| `approval.needed`          | Agent proposes an action needing approval       | Approval object               |
| `approval.decided`         | User approves or rejects                       | Approval object, decision     |
| `agent.action.completed`   | Agent finishes executing an action             | Action object, result         |
| `agent.action.rolled_back` | An action is rolled back                       | Action object, reason         |
| `goal.milestone.reached`   | A milestone is completed                       | Milestone object, goal summary|
| `goal.health.changed`      | Goal health status changes                     | Health object, previous state |
| `trust.level.changed`      | Trust level changes (up or down)               | Old level, new level, reason  |

### Webhook Delivery

- Webhooks are delivered via HTTP POST with a JSON body.
- Each delivery includes an `X-GoalPilot-Signature` header (HMAC-SHA256 of the
  body using the webhook secret).
- Failed deliveries are retried 3 times with exponential backoff (1min, 5min, 30min).
- Webhooks that fail consistently (10 consecutive failures) are automatically disabled.

---

## 9.11 Error Response Format

All API errors follow a consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request body is invalid",
    "details": [
      {
        "field": "diagnostic_answers.what_do_you_want",
        "message": "This field is required"
      }
    ],
    "request_id": "req_xyz789",
    "documentation_url": "https://docs.goalpilot.com/errors/VALIDATION_ERROR"
  }
}
```

**Standard error codes:**

| HTTP Status | Code                  | Meaning                                |
|-------------|----------------------|----------------------------------------|
| 400         | BAD_REQUEST          | Malformed request                      |
| 401         | UNAUTHORIZED         | Missing or invalid auth token          |
| 403         | FORBIDDEN            | Valid auth but insufficient permissions |
| 404         | NOT_FOUND            | Resource does not exist                |
| 409         | CONFLICT             | Resource state conflict                |
| 422         | VALIDATION_ERROR     | Request body fails validation          |
| 429         | RATE_LIMITED         | Too many requests                      |
| 500         | INTERNAL_ERROR       | Server error (includes request_id)     |

---

## 9.12 Rate Limiting

All endpoints are rate limited per user:

| Endpoint Group  | Limit              | Window    |
|-----------------|--------------------|-----------|
| Auth            | 10 requests        | 1 minute  |
| Read (GET)      | 120 requests       | 1 minute  |
| Write (POST/PATCH/DELETE) | 60 requests | 1 minute |
| WebSocket       | 5 connections      | concurrent|
| Webhooks        | 100 events         | 1 minute  |

Rate limit headers are included in every response:
```
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 118
X-RateLimit-Reset: 1682089200
```

---

## 9.13 API Versioning

- The API is versioned via URL path (`/api/v1/`).
- Breaking changes require a new version (`/api/v2/`).
- Deprecated endpoints return a `Sunset` header with the retirement date.
- Minimum 6-month deprecation window before removing old versions.

---

## 9.14 API Design Risk Analysis

| Risk | How It Manifests | Mitigation |
|------|-----------------|------------|
| [R2] Cold start problem | New users must complete diagnostic before seeing any value | Diagnostic is short (5-8 questions), first brief generated within minutes |
| [R4] "1-3 tasks" cap may not be enough | Power users feel constrained by default task limit | Configurable limit (1-7), but system warns about completion rate drops above 3 |
| [R7] AI being wrong | Agent proposes incorrect actions via API | All actions pass through confidence gating and approval pipeline before execution |
---

## Section 10: UX Flow

### 10.1 First-Time Experience

**Onboarding Flow (5 screens, under 3 minutes):**

Screen 1 — Welcome & Framing:
- "GoalPilot turns your goals into a daily action plan."
- "Pick a goal. We handle the planning. You handle the doing."
- Single CTA: "Let's go"

Screen 2 — Goal Category Selection:
- Grid of goal categories with icons:
  - Side Income (Turo, Etsy, Freelancing)
  - Content & Audience (YouTube, Newsletter, Podcast)
  - Health & Fitness (Weight loss, Marathon, Habit building)
  - Career (Job search, Promotion, Skill acquisition)
  - Education (Certification, Language, Online course)
  - Finance (Debt payoff, Savings target, Investment)
- User taps one category, then selects a specific template within it
- [R1] Templates are curated and opinionated — user cannot create a blank goal at this stage

Screen 3 — Diagnostic Questions:
- Template-specific intake questionnaire (5-10 questions)
- Conversational format, one question at a time
- Answers feed directly into plan parameterization
- Progress bar at top showing "3 of 8 questions"
- [R2] These questions ARE the cold-start solution — they gather enough signal to generate a meaningful plan from minute one

Screen 4 — The Demo Moment (Plan Generation):
- Real-time plan generation with visible reasoning
- Each milestone appears with a brief explanation:
  ```
  Creating Milestone 1: "List and Launch" (Week 1-2)
  → Because you're a first-time Turo host, we start with
    getting your 2021 Camry listed with optimized photos
    and competitive pricing for the Austin market.
  ```
- Milestones build sequentially with connecting lines
- Leading indicators appear next to each milestone
- Total generation time: 8-15 seconds (intentionally paced for readability, not speed)
- [R7] Disclaimer at bottom: "This plan is AI-generated. You can adjust milestones during weekly reviews."

Screen 5 — First Daily Brief Preview:
- "Here's what tomorrow looks like:"
- Shows Day 1 brief with 2-3 tasks
- User sees exactly what the daily experience will feel like
- CTA: "Start tomorrow" or "Start now"
- First daily brief notification scheduled within minutes

**Day 1 Task Quality Standard:**
- Tasks MUST be specific: "Take 12 photos of your Camry using the Turo photo guide" not "Prepare your car"
- Tasks MUST be completable: estimated time shown, resources linked
- Tasks MUST feel actionable: verb-first language, clear done-state
- [R4] Default is 1-3 tasks, but Day 1 may intentionally lean toward 2 to avoid overwhelming new users

### 10.2 Daily Experience

**The Daily Loop (Core UX):**

```
Open app
  → Today's Brief (single screen)
    → Task 1: [title] — [est. time] — [tap to start]
    → Task 2: [title] — [est. time] — [tap to start]
    → Task 3: [title] — [est. time] — [tap to start]
    → Automation Summary: "2 actions completed overnight" [tap to review]
    → Momentum: streak count, leading indicator sparkline
```

**Task Completion Flow:**
1. Tap task → expanded view with instructions, resources, context
2. Complete the task in the real world
3. Tap "Done" → optional: add a note, attach a photo, log a metric
4. Confetti/check animation → next task surfaces
5. Total interaction: 1-2 taps for simple tasks, 3-4 for tasks with logging

**Automation Review Flow:**
- Overnight, agents may have executed approved automations
- Morning brief shows summary: "While you slept: pricing adjusted to $67/day (was $72), 2 guest inquiries auto-replied"
- Swipe right to approve / swipe left to reject (batch mode)
- Tap for detail view with agent reasoning
- [R3] Batch approval reduces fatigue — 5 automations reviewed in 15 seconds, not 5 separate prompts

**Quick-Action Shortcuts:**
- Long-press a task to: snooze to tomorrow, mark as blocked, delegate to agent
- Shake device to surface "What should I do right now?" (context-aware micro-task)

### 10.3 Weekly Review

**5-Minute Guided Review (Every Sunday):**

Step 1 — Progress Snapshot (60 seconds):
- Milestone progress bar
- Tasks completed this week: X/Y
- Streak status
- "You completed 85% of your tasks this week. That's above average for Week 2 users."

Step 2 — Leading Indicator Trends (60 seconds):
- Sparkline charts for each tracked metric
- Green/yellow/red status for each
- "Your listing views are UP 40% but your booking rate is DOWN. Let's focus on conversion next week."

Step 3 — What Worked / What Didn't (60 seconds):
- Auto-detected patterns: "You consistently complete morning tasks but skip afternoon ones"
- User input: optional text field for reflections

Step 4 — Plan Adjustments (60 seconds):
- System proposes changes: "Recommend extending Milestone 2 by one week based on booking pace"
- User approves or modifies
- [R1] This is where template rigidity bends — the weekly review is the structured adjustment point

Step 5 — Next Week Preview (60 seconds):
- High-level view of next week's focus
- Any automations queued
- "Next week's focus: convert your first 5 inquiries into bookings"

### 10.4 Goal Completion

**Celebration Moment:**
- Full-screen animation when final milestone is marked complete
- Summary card: duration, tasks completed, automations run, metrics achieved
- "You reached $1,500/month on Turo in 11 weeks."

**Retrospective:**
- "What did you learn?" — guided prompts
- Key decisions that mattered most (system-identified)
- Skills developed (tagged for future goal recommendations)

**Next Goal Suggestion:**
- Based on completed goal context: "Now that your Turo business is running, consider: Scale to 2 vehicles, Start a complementary side income, Optimize for passive income"
- [R5] Suggestions stay within domains where GoalPilot has strong templates

### 10.5 Mobile-First Principles

| Principle | Implementation |
|-----------|---------------|
| Under 60 seconds | Every interaction designed to complete in < 1 min |
| One-handed operation | All primary actions reachable in thumb zone |
| Offline capability | Today's tasks cached locally, sync when online |
| Glanceable | Key info visible without scrolling on brief screen |
| Interruption-friendly | State preserved mid-task, resume seamlessly |
| Minimal typing | Tap-to-complete, pre-filled options, voice notes |

### 10.6 Notification Strategy

| Type | Timing | Frequency | Can Disable? | Channel |
|------|--------|-----------|-------------|---------|
| Morning brief | 7:00 AM (adjustable) | Daily | No (core loop) | Push + email |
| Task reminder | 2 hours before EOD | Daily (if tasks pending) | Yes | Push only |
| Automation complete | Real-time | As they happen (batched) | Yes | Push only |
| Approval needed | Real-time | As needed | No (required for trust) | Push + in-app |
| Weekly review | Sunday 10:00 AM | Weekly | Can reschedule, not disable | Push + email |
| Milestone reached | On completion | Per milestone | No | Push + email |
| Streak at risk | 8:00 PM if no tasks done | Daily (conditional) | Yes | Push only |
| Agent insight | Batched, 1x/day max | Daily max | Yes | In-app only |

[R3] Notification volume is carefully managed. Max 3 push notifications per day during normal operation. Approval requests are batched where possible to prevent fatigue.

### 10.7 Accessibility & Inclusive Design

- VoiceOver / TalkBack full support
- Dynamic type scaling
- Color-blind safe status indicators (icons + color, never color alone)
- Reduced motion mode for animations
- Right-to-left language support in layout system

---

## Section 11: Example Walkthrough — Turo Business

This section provides a complete, end-to-end walkthrough of a single user's journey through GoalPilot. Every screen, every brief, every automation — made concrete.

### 11.1 Meet the User

**Profile:**
- Name: Marcus
- Location: Austin, TX
- Vehicle: 2021 Toyota Camry SE (paid off, personal car)
- Goal: Earn $1,500/month passive income on Turo
- Available time: 10 hours/week
- Budget for setup: $200
- Experience: Zero — never listed a car on any platform
- Motivation: Wants to build a side income stream without quitting his day job

### 11.2 Diagnostic Intake

Marcus selects "Side Income → Turo Hosting" from the goal category screen. The diagnostic intake begins:

**Question 1:** "Do you currently own a vehicle you want to list, or are you looking to acquire one?"
→ Marcus answers: "I have a 2021 Toyota Camry"

**Question 2:** "What trim level and any notable features? (Helps with listing optimization)"
→ "SE trim, backup camera, Apple CarPlay, 38k miles"

**Question 3:** "What's your monthly income target from Turo?"
→ "$1,500/month"

**Question 4:** "How many hours per week can you dedicate to Turo hosting?"
→ "10 hours"

**Question 5:** "What's your budget for initial setup (cleaning supplies, photos, professional detailing, etc.)?"
→ "$200"

**Question 6:** "Where are you located? (City and state for market analysis)"
→ "Austin, TX"

**Question 7:** "Do you have a dedicated parking spot where guests can pick up the vehicle?"
→ "Yes, home driveway"

**Question 8:** "Have you listed on any car-sharing or rental platforms before?"
→ "No, first time"

**Question 9:** "Are you open to eventually adding more vehicles if the first one performs well?"
→ "Yes, if the first one works"

**Question 10:** "How flexible is your schedule for guest handoffs? (e.g., can you accommodate early morning / late night pickups?)"
→ "Somewhat flexible — I work 9-5 but can do mornings before work and evenings"

**Question 11:** "Do you have a secondary vehicle or alternate transportation for days when your Camry is rented out?"
→ "Yes, my partner has a car I can use"

**Question 12:** "Any cosmetic damage, mechanical issues, or upcoming maintenance on the vehicle?"
→ "No, it's in good condition. Oil change due in about 2,000 miles"

The system now has enough signal to generate a parameterized plan.

### 11.3 Generated Plan

The plan generation screen animates in real-time:

```
Analyzing Austin, TX Turo market...
  → Found 847 active Turo listings in Austin metro
  → 2021 Toyota Camry median daily rate: $58-$72/day
  → Peak demand: weekends, SXSW (March), ACL (October), F1 (October)
  → To hit $1,500/month at ~$65/day avg: need ~23 rental days/month

Building your plan...
```

**Milestone 1: "List and Launch" (Week 1-2)**
- Objective: Get your Camry listed on Turo with an optimized, competitive listing
- Key results:
  - Listing published with 12+ professional-quality photos
  - Pricing set based on competitive analysis ($62/day initial)
  - Insurance/coverage selected
  - Auto-response templates configured
  - Profile completed with 100% score
- Leading indicators: Profile completion %, listing quality score, search appearance rank
- [R7] Confidence note: "Market rate estimate based on 847 active listings. Actual optimal price may vary — we'll adjust in Week 3 based on real data."

**Milestone 2: "First Bookings" (Week 3-4)**
- Objective: Secure first 5 bookings and earn first 5-star reviews
- Key results:
  - 5 completed trips
  - 4.8+ average rating
  - Response time under 15 minutes
  - Zero cancellations
- Leading indicators: Inquiry rate, booking conversion rate, response time, guest communication quality
- [R5] Domain knowledge applied: "First 5 reviews are critical for Turo algorithm ranking. We'll price 10-15% below market to accelerate bookings."

**Milestone 3: "Optimize and Scale" (Week 5-8)**
- Objective: Optimize pricing, guest experience, and operational efficiency to hit $1,000/month run rate
- Key results:
  - Revenue trending toward $1,000+/month
  - Pricing dynamically adjusted based on demand
  - Guest experience refined (cleaning checklist, welcome kit)
  - Time per booking under 45 minutes total
- Leading indicators: Revenue/day trend, utilization rate, average rating, time-per-handoff

**Milestone 4: "Evaluate Expansion" (Week 9-12)**
- Objective: Analyze ROI and determine if/when to add a second vehicle
- Key results:
  - Consistent $1,200+/month revenue
  - Full financial analysis (revenue, costs, net profit, ROI)
  - Decision framework for second vehicle
  - If expanding: vehicle acquisition criteria defined
- Leading indicators: Monthly net profit, profit margin %, operational hours/booking, demand overflow (declined bookings)
- [R6] Success measurement: "$1,500/month is the stated goal. We'll track net profit (after insurance, cleaning, wear) not just gross revenue. Target may need adjustment based on actual cost data."

### 11.4 First Week — Day by Day

#### Day 1 (Monday): Account Setup & Research

**Morning Brief (7:00 AM):**
```
Good morning, Marcus. Welcome to Day 1 of your Turo journey.

Today's focus: Set up your foundation.

YOUR TASKS (3):
1. Create your Turo host account [15 min]
   → Go to turo.com/host, sign up, complete identity verification
   → Have your driver's license and insurance info ready

2. Take 15 photos of your Camry [30 min]
   → Follow the GoalPilot Turo Photo Guide (linked below)
   → Best lighting: early morning or golden hour
   → Required angles: front 3/4, rear 3/4, driver side, passenger side,
     dashboard, center console, back seat, trunk, odometer, tires (x4)
   → Clean car first (quick wash at minimum)

3. Research your top 5 competitors [20 min]
   → Search "Toyota Camry" on Turo in Austin
   → Note their daily rates, photo quality, number of reviews
   → Screenshot the top 3 listings for reference

AUTOMATION STATUS:
   → Research agent is analyzing Austin Turo market data (results by tomorrow AM)

MOMENTUM: Day 1 of your journey. Let's build that streak.
```

**Tasks completed:** Marcus creates his Turo account, washes his car at a self-service station ($8), takes photos in his driveway at 5:30 PM, and browses competitor listings for 20 minutes.

**What he logs:** Marks all 3 tasks complete. Attaches 16 photos to task 2. Notes on task 3: "Most Camrys in Austin are listed at $55-$70/day. Top-rated ones have 50+ reviews."

#### Day 2 (Tuesday): Listing Creation

**Morning Brief (7:00 AM):**
```
Day 2. Yesterday: 3/3 tasks done. Streak: 2 days.

OVERNIGHT AUTOMATION:
  → Research agent completed Austin market analysis (see below)
  → Recommended starting price: $62/day (weekday), $72/day (weekend)
  → Confidence: 0.82

YOUR TASKS (3):
1. Review market analysis and approve pricing [10 min]
   → Tap to see full competitive analysis
   → Approve or adjust the recommended pricing

2. Write your listing title and description [25 min]
   → Content agent has drafted a listing for you (see below)
   → Review, personalize, and approve
   → Key differentiators to highlight: Apple CarPlay, low mileage, SE trim

3. Select your Turo protection plan [15 min]
   → We recommend the 80% plan for new hosts (best coverage-to-cost ratio)
   → Compare plans in the Turo app: 60%, 70%, 80%, 85%
   → Higher coverage = lower payout per trip but less personal risk
```

**Approval Prompt 1 — Pricing Recommendation:**
```
AUTOMATION: Set pricing for your listing

Research agent analyzed 847 listings in Austin, TX.
For 2021 Toyota Camry SE with your specs:

  Recommended daily rate:
    Weekday: $62/day (market avg: $65, we go slightly below to accelerate bookings)
    Weekend: $72/day (market avg: $70, weekends have higher demand)
    Weekly discount: 15% off
    Monthly discount: 30% off

  Rationale: New listings with zero reviews should price 5-10% below
  market to attract first bookings. After 5+ five-star reviews, we'll
  raise to market rate.

  Confidence: 0.82 (high — based on 214 similar vehicles in market)

  [Approve]  [Adjust]  [Reject]
```

Marcus approves the pricing.

**Approval Prompt 2 — Listing Description:**
```
AUTOMATION: Publish listing description

Content agent drafted your Turo listing:

  Title: "2021 Toyota Camry SE — Apple CarPlay, Backup Cam, Spotless"

  Description:
  "Welcome! You're renting a well-maintained 2021 Toyota Camry SE with
  only 38k miles. Perfect for exploring Austin — whether you're here
  for SXSW, a weekend getaway, or just need reliable wheels.

  FEATURES:
  - Apple CarPlay & Android Auto
  - Backup camera
  - Bluetooth connectivity
  - Spacious trunk for luggage
  - Excellent fuel economy (~30 MPG combined)

  PICKUP: Easy driveway pickup in [neighborhood]. Flexible scheduling
  available mornings and evenings.

  I'm a responsive host — expect quick replies and a clean car every time."

  Confidence: 0.75 (medium — generic template adapted to your specs.
  Personalization recommended.)

  [Approve]  [Edit First]  [Reject]
```

Marcus taps "Edit First," adds a sentence about his neighborhood being near downtown, and then approves.

#### Day 3 (Wednesday): Listing Optimization

**Morning Brief (7:00 AM):**
```
Day 3. Yesterday: 3/3 tasks. Streak: 3 days.

YOUR TASKS (2):
1. Upload photos and finalize listing [20 min]
   → Your 16 photos have been auto-sorted by the content agent
   → Recommended order: front 3/4 first, interior second, detail shots last
   → Remove the 4 lowest-quality photos (marked in app)
   → Add captions to top 3 photos

2. Set up vehicle availability calendar [10 min]
   → Block out dates you need the car
   → Set minimum trip duration: 1 day (recommended for new hosts)
   → Enable instant booking (increases visibility 40% per Turo data)

AUTOMATION STATUS:
  → Content agent sorted and ranked your photos (12 of 16 recommended for upload)

INSIGHT: Listings with 12+ photos get 2.3x more views than listings with fewer than 8.
```

#### Day 4 (Thursday): Publish and Prepare

**Morning Brief (7:00 AM):**
```
Day 4. Yesterday: 2/2 tasks. Streak: 4 days.

TODAY'S FOCUS: Go live.

YOUR TASKS (3):
1. Final listing review and publish [10 min]
   → Everything is ready. Do a final review and hit "Publish"
   → Checklist: photos ✓, description ✓, pricing ✓, calendar ✓, coverage ✓

2. Set up guest auto-response templates [20 min]
   → Content agent has drafted 4 templates:
     a) Booking confirmation + pickup instructions
     b) Day-before reminder
     c) Post-trip thank you + review request
     d) FAQ response (parking, gas policy, etc.)
   → Review and approve each

3. Create a cleaning/handoff checklist [15 min]
   → Template provided — customize for your car
   → Items: interior vacuum, wipe surfaces, check gas level, check tire
     pressure, remove personal items, place welcome card on dash
```

**Approval Prompt 3 — Auto-Response Templates:**
```
AUTOMATION: Enable auto-responses for guest messages

Content agent drafted 4 message templates. Sample:

  BOOKING CONFIRMATION:
  "Hi [Guest Name]! Thanks for booking my Camry. Here are your
  pickup details:

  Address: [your address — filled from profile]
  Pickup time: [booking start time]
  Parking: Driveway — look for the silver Camry

  I'll send a reminder the day before. Let me know if you have
  any questions!"

  [Approve All 4]  [Review Each]  [Reject]
```

Marcus reviews each template, makes minor edits, and approves.

#### Day 5 (Friday): Launch Promotion

**Morning Brief (7:00 AM):**
```
Day 5. LISTING IS LIVE! Streak: 5 days.

OVERNIGHT:
  → Your listing went live at 9:47 PM yesterday
  → Already indexed in Turo search
  → Current search position: page 3 for "Toyota Camry Austin"

YOUR TASKS (2):
1. Share your listing link with friends/family [10 min]
   → Link: [turo.com/your-listing]
   → Even non-booking views improve search ranking
   → Consider posting on local Austin community groups

2. Review and approve a 10% new-listing discount [5 min]
   → Research agent recommends: 10% off first 3 trips
   → This is the #1 tactic for new hosts to get initial bookings
   → Discount auto-expires after 3 completed trips

AUTOMATION STATUS:
  → Research agent monitoring competitor price changes daily
  → Analytics agent tracking listing impressions and search rank

INSIGHT: Average time to first booking for new Austin hosts: 5-8 days.
Don't worry if it doesn't happen today.
```

#### Day 6 (Saturday): Weekend Review

**Morning Brief (9:00 AM — weekend timing):**
```
Day 6. Streak: 6 days. Weekend mode: lighter tasks.

YOUR TASKS (1):
1. Quick weekend check-in [10 min]
   → Review listing stats (views, saves, inquiries)
   → Respond to any guest messages (response time matters!)
   → No heavy tasks today — rest is part of the plan

OVERNIGHT AUTOMATIONS:
  → Analytics agent: 47 listing views, 3 saves, 0 inquiries yet
  → Research agent: Austin weekend demand is high — your pricing looks competitive

INSIGHT: Saturday-Sunday are the highest search days on Turo.
Your listing is actively being seen.
```

#### Day 7 (Sunday): Week 1 Review

**Morning Brief (10:00 AM):**
```
Day 7. Streak: 7 days! One full week complete.

YOUR TASK (1):
1. Complete your first weekly review [5 min]
   → Guided review will walk you through Week 1 results
   → Plan adjustments proposed based on data

AUTOMATION SUMMARY (this week):
  → Research agent: 3 analyses completed
  → Content agent: listing description + 4 message templates drafted
  → Analytics agent: daily tracking initiated

MILESTONE 1 PROGRESS: 72% complete
  ✓ Account created
  ✓ Photos taken and uploaded (12)
  ✓ Listing written and published
  ✓ Pricing set ($62/$72)
  ✓ Coverage selected (80%)
  ✓ Auto-responses configured
  ○ First booking (pending)
  ○ Optimize based on first-week data (next week)
```

### 11.5 Sample Agent Outputs

**Research Agent — Competitive Pricing Analysis:**
```
AUSTIN, TX TURO MARKET ANALYSIS: 2021 Toyota Camry
Generated: [Date] | Confidence: 0.82

MARKET OVERVIEW:
  Total active listings (Austin metro): 847
  Toyota Camry listings: 63
  2019-2022 Camry listings: 28
  Avg daily rate (comparable): $65.40
  Avg rating (comparable): 4.7 stars
  Avg trips (comparable): 34 trips

PRICING DISTRIBUTION (2019-2022 Camry, Austin):
  $45-55/day: 6 listings (budget segment)
  $55-65/day: 12 listings (value segment) ← recommended entry
  $65-75/day: 8 listings (market rate)
  $75-85/day: 2 listings (premium, high reviews only)

SEASONAL ADJUSTMENT FACTORS:
  Jan-Feb: 0.85x (low season)
  Mar (SXSW): 1.8x (surge)
  Apr-May: 1.0x (baseline)
  Jun-Aug: 1.15x (summer travel)
  Sep: 0.95x (slight dip)
  Oct (ACL + F1): 1.6x (surge)
  Nov-Dec: 0.9x (holiday mixed)

RECOMMENDATION:
  Base weekday: $62/day (5th percentile below market — new listing strategy)
  Base weekend: $72/day (at market — weekends sell regardless)
  SXSW week: $115/day (follow surge pricing)
  ACL/F1 weeks: $100/day

  Expected monthly revenue (steady state): $1,300-$1,700
  Expected utilization: 65-75% (19-23 days/month)

SOURCES: Turo public listing data, Turo host forums, historical
Austin event calendars.

LIMITATIONS: Cannot access Turo internal algorithm data. Pricing
recommendations based on public listing analysis. Actual search
ranking influenced by factors beyond price.
```

**Content Agent — Listing Description Draft:**
```
LISTING DRAFT: 2021 Toyota Camry SE
Generated: [Date] | Confidence: 0.75

OUTPUT:
[See Day 2 approval prompt above for full listing text]

GENERATION NOTES:
  - Based on "high-performing Turo listing" template
  - Personalized with: vehicle specs, Apple CarPlay, neighborhood info
  - SEO keywords included: "Austin," "SXSW," "reliable," "clean"
  - Tone: friendly, professional, concise

CONFIDENCE BREAKDOWN:
  - Template match: 0.90 (strong fit for vehicle type)
  - Personalization: 0.65 (limited personal details — would improve
    with host personality info)
  - Competitive differentiation: 0.70 (standard differentiators,
    nothing truly unique flagged)

RECOMMENDATION: Host should add personal touches. Template gets
you to 80%; personality gets you to 100%.
```

**Analytics Agent — Week 1 Performance Report:**
```
WEEK 1 PERFORMANCE REPORT
Period: Day 1-7 | Milestone 1 Progress: 72%

LISTING METRICS:
  Total views: 312
  Unique views: 198
  Saves: 14
  Inquiries: 3
  Bookings: 0 (within expected range for Week 1)

  Search rank: Page 2, position 7 (improved from page 3 on Day 5)
  Profile completion: 95%

TASK METRICS:
  Tasks assigned: 15
  Tasks completed: 15 (100%)
  Avg completion time: 18 min
  Streak: 7 days

AGENT ACTIVITY:
  Research analyses: 3
  Content drafts: 5 (listing + 4 templates)
  Automations executed: 2 (photo sort, daily monitoring)
  Automations pending approval: 0

LEADING INDICATORS:
  View-to-save rate: 4.5% (market avg: 3.8%) ✓ ABOVE AVERAGE
  Inquiry rate: 1.0% (market avg: 1.5%) — BELOW (expected for new listing)
  Response time: 12 min avg ✓ EXCELLENT
  Photo count: 12 ✓ ABOVE MINIMUM

ASSESSMENT: On track. No plan adjustments recommended yet.
First booking expected within days 8-14 based on current trajectory.
```

### 11.6 Leading Indicator Dashboard After Week 1

```
┌─────────────────────────────────────────────────┐
│  MOMENTUM DASHBOARD — Week 1 Complete           │
│  Goal: $1,500/month on Turo                     │
│  Streak: 7 days 🔥                              │
├─────────────────────────────────────────────────┤
│                                                 │
│  MILESTONE 1: List and Launch          [72%]    │
│  ████████████████████░░░░░░░                    │
│                                                 │
│  LISTING VIEWS          SAVES                   │
│  312 total              14 total                │
│  ▁▂▃▄▅▆▇ trending up   ▁▁▂▃▃▅▇ trending up    │
│                                                 │
│  SEARCH RANK            INQUIRY RATE            │
│  Page 2, #7             1.0%                    │
│  ▇▆▅▃ improving         ▁▁▂▂▃ building         │
│  (was page 3)           (target: 2.5%)          │
│                                                 │
│  PROFILE SCORE          RESPONSE TIME           │
│  95%  ✓                 12 min avg  ✓           │
│                                                 │
│  REVENUE (MTD)          BOOKINGS                │
│  $0                     0 (first expected        │
│                          days 8-14)             │
│                                                 │
│  TASKS COMPLETED        TIME INVESTED           │
│  15/15 (100%)           ~3.5 hours              │
│                                                 │
│  NEXT MILESTONE UNLOCK: First confirmed booking │
├─────────────────────────────────────────────────┤
│  AI CONFIDENCE IN PLAN: 0.79                    │
│  "On track. Market conditions favorable."       │
│  [R7]                                           │
└─────────────────────────────────────────────────┘
```

### 11.7 What Happens Next (Weeks 2-12 Preview)

**Week 2:** First booking arrives (Day 9). Marcus handles his first handoff. Rating: 5 stars. Agent adjusts pricing up by $3/day.

**Week 3-4:** 5 bookings completed. Average rating: 4.9. Listing moves to page 1 in search. Revenue: $410 in Week 3, $520 in Week 4. Agent recommends removing the new-listing discount.

**Week 5-8:** Pricing optimized dynamically. Marcus creates a welcome kit ($15 from his budget). Utilization rate hits 70%. Monthly revenue crosses $1,200. Agent flags: "At current trajectory, $1,500/month achievable by Week 10."

**Week 9-12:** Revenue hits $1,480 in Month 3. Agent generates a full ROI analysis. Marcus decides to pursue a second vehicle. GoalPilot suggests: "Start a new goal: Scale Turo to 2 vehicles" with a different template optimized for fleet expansion.

[R6] Final success assessment: "Goal was $1,500/month. Achieved $1,480 in Month 3 with upward trajectory. Marking as achieved with note: consistent $1,500+ expected in Month 4."

---

## Section 12: Monetization

### 12.1 Tier Structure

**Free Tier — "Get Started"**

| Feature | Limit |
|---------|-------|
| Active goals | 1 |
| Daily tasks | 2 per day |
| Automations | None |
| Templates | Basic only (3 starter templates) |
| Agent actions | None (manual research suggestions only) |
| Weekly review | Simplified (progress bar only) |
| Momentum tracking | Streak only, no analytics |
| History | 30 days |

Purpose: Let users experience the daily loop and prove the value of structured planning. The free tier is deliberately limited but still useful enough to form the daily habit.
[R2] Free tier still solves cold start — users get a generated plan and daily tasks, just fewer of them.

**Pro Tier — "$19/month" (or $15/month billed annually)**

| Feature | Limit |
|---------|-------|
| Active goals | 3 |
| Daily tasks | Adaptive (1-5 based on capacity and schedule) |
| Automations | Full automation suite |
| Templates | All templates in library |
| Agent actions | All 6 agent types active |
| Weekly review | Full guided review with analytics |
| Momentum tracking | Full dashboard with leading indicators |
| History | Unlimited |
| Priority support | Email within 24 hours |
| Integrations | All supported third-party integrations |

Purpose: The core product. This is where GoalPilot delivers its full value proposition.
[R4] Adaptive task cap means Pro users are not stuck at 1-3 tasks — the system can assign up to 5 when the user has demonstrated capacity and the goal requires it.

**Business Tier — "$49/month" (or $39/month billed annually)**

| Feature | Limit |
|---------|-------|
| Active goals | Unlimited |
| Daily tasks | Unlimited (system still recommends optimal count) |
| Automations | Full + custom automation rules |
| Templates | All + custom template creation |
| Agent actions | All + custom agent configurations |
| Weekly review | Full + exportable reports |
| API access | REST API for integrations |
| Team features | Share goals, delegate tasks, team dashboards |
| Advanced analytics | Trend analysis, forecasting, benchmarking |
| Priority support | Chat within 4 hours |

Purpose: Power users, small business owners managing multiple ventures, coaches managing client goals.

### 12.2 Pricing Rationale

| Comparable Product | Price | What GoalPilot Adds |
|-------------------|-------|-------------------|
| Todoist Pro | $5/month | Plan generation, not just task organization |
| Notion Plus | $10/month | Opinionated structure, not a blank canvas |
| Motion | $19/month | Strategic planning + execution, not just scheduling |
| Monday.com Standard | $12/seat/month | Personal goals, daily loop, AI agents |
| BetterUp (coaching) | $300+/month | AI-driven at 1/15th the cost |

At $19/month, GoalPilot sits at the premium end of productivity tools but well below human coaching. The value proposition: "A fraction of what a coach costs, available 24/7, with actual automation that saves you hours."

### 12.3 Gating Strategy

What specifically pushes users from Free to Pro:
1. **Automation previews**: Free users see "Research agent WOULD have done this analysis" but can't access the output. The value is demonstrated, not just described.
2. **Task cap friction**: When the system wants to assign a third task but can't, it says: "You have a third task queued — upgrade to Pro to unlock adaptive scheduling."
3. **Second goal desire**: After completing or progressing on Goal 1, user naturally wants to add a second. "You've built momentum. Add a second goal with Pro."

### 12.4 Free Trial Strategy

- 14 days of full Pro access
- Trial MUST include at least one "wow moment": an automation that saves the user real, measurable time
- [R3] Trial approval prompts are spaced out to show value without causing fatigue
- Day 7: mid-trial check-in email showing what automations have done and time saved
- Day 12: pre-expiration email with personalized summary of value delivered
- Day 14: grace period — 3 more days of Pro if the user has an active automation in progress

### 12.5 Revenue Projections (Not Included)

Revenue projections intentionally omitted from this design document. They belong in a separate financial model that accounts for conversion rates, churn, and CAC. The monetization design here focuses on value delivery alignment, not revenue forecasting.

---

## Section 13: Implementation Roadmap

### 13.1 Phase 1: MVP (Months 1-3)

**Objective:** Validate the daily loop hypothesis with a single template.

**Scope:**
- Daily loop engine: brief generation, task assignment, completion tracking
- 1 template: Turo Business (most concrete, best for demo)
- Planning engine: diagnostic intake → parameterized plan generation
- Task generation: LLM-powered daily task creation within template constraints
- Streak/momentum system: basic streak tracking, completion rates
- Mobile app: React Native (iOS + Android), core screens only
  - Onboarding flow
  - Daily brief screen
  - Task detail/completion screen
  - Basic progress view
- Backend: Node.js/Python API, PostgreSQL, basic LLM integration (Claude API)
- No automations, no agents, no approval system (all tasks are manual)

**Team:** 2-3 engineers, 1 designer

**Key Milestones:**
- Month 1, Week 2: Diagnostic intake flow functional with Turo template
- Month 1, Week 4: Plan generation producing reasonable Turo plans
- Month 2, Week 2: Daily brief generation + task completion loop working end-to-end
- Month 2, Week 4: Mobile app alpha with core loop
- Month 3, Week 2: Internal dogfooding (team members run through full Turo journey)
- Month 3, Week 4: Closed beta with 50 users

**Success Criteria:**
- 50 beta users complete at least 2 weeks of daily engagement
- Task completion rate > 60%
- 7-day retention > 40%
- Qualitative: Users report tasks feel specific and actionable, not generic
- [R1] Validate: Does the Turo template work for different user situations, or does it break for edge cases?

**Go/No-Go for Phase 2:**
- GO if: 7-day retention > 40% AND qualitative feedback confirms daily loop value
- ADJUST if: Retention is 25-40% — investigate and iterate on task quality before adding features
- NO-GO if: Retention < 25% — fundamental hypothesis may be wrong, pivot or abandon

### 13.2 Phase 2: Templates + Trust (Months 4-6)

**Objective:** Prove the template model scales across domains and introduce the trust/automation foundation.

**Scope:**
- 3 additional templates:
  - YouTube Channel Launch
  - Job Search Optimization
  - Fitness Goal (e.g., Run a 5K)
- Trust and approval system:
  - Trust score model (starts at 0, builds with successful approvals)
  - Approval prompt UI with approve/adjust/reject
  - Trust tier thresholds (manual → suggest → auto with review → auto)
- Basic agent system:
  - Research agent: market analysis, competitor research, data gathering
  - Content agent: draft generation, template filling, copy optimization
  - Agents operate in suggest-only mode initially (no autonomous execution)
- Integration with 2-3 third-party services:
  - Calendar integration (Google Calendar)
  - Basic notification service (push + email)
  - One domain-specific API (e.g., Turo pricing data, YouTube Analytics)
- Weekly review system: guided 5-minute review flow

**Team:** 3-4 engineers, 1 designer

**Key Milestones:**
- Month 4, Week 2: Trust score model designed and implemented
- Month 4, Week 4: YouTube template in beta
- Month 5, Week 2: Research and Content agents producing outputs in test
- Month 5, Week 4: Job Search and Fitness templates in beta
- Month 6, Week 2: Approval system live with graduated trust levels
- Month 6, Week 4: Open beta with 500 users across all 4 templates

**Success Criteria:**
- 500 beta users, at least 100 per template
- Cross-template retention remains > 40% at 7 days
- Approval acceptance rate > 70% (agents are producing useful outputs)
- Trust system progression: 30% of users reach "auto with review" tier within 4 weeks
- [R3] Validate: Approval fatigue measured — if users report prompt exhaustion, adjust batching
- [R5] Validate: Domain expertise quality across 4 different domains — are templates good enough?

**Go/No-Go for Phase 3:**
- GO if: Cross-template retention holds AND agent outputs accepted > 70%
- ADJUST if: Some templates underperform — double down on what works, retire what doesn't
- NO-GO if: Template expansion doesn't hold engagement — model may only work for specific domains

### 13.3 Phase 3: Full Agents + Integrations (Months 7-10)

**Objective:** Deliver the full automation promise with all agent types and comprehensive integrations.

**Scope:**
- All 6 agent types operational:
  - Research agent (enhanced)
  - Content agent (enhanced)
  - Scheduling agent: calendar management, time blocking, handoff coordination
  - Analytics agent: metric tracking, trend analysis, performance reports
  - Integration agent: third-party API actions (posting, purchasing, messaging)
  - Monitoring agent: track external metrics, alert on anomalies, 48-hour watch
- Full integration layer:
  - Social media APIs (YouTube, Instagram, Twitter/X, TikTok)
  - Financial tools (basic expense tracking, revenue logging)
  - Communication tools (email, SMS)
  - Calendar (Google, Apple, Outlook)
  - Domain-specific platforms (Turo, Etsy, Upwork, etc.)
- 48-hour monitoring and rollback system:
  - All autonomous agent actions tracked with full audit trail
  - Rollback capability for reversible actions
  - Alert system for irreversible actions approaching thresholds
- Advanced analytics dashboard:
  - Leading indicator trends with forecasting
  - Cross-goal insights
  - Time-saved metrics
  - Agent confidence calibration data
- 2 additional templates (6 total)

**Team:** 4-5 engineers, 1 designer, 1 data scientist

**Key Milestones:**
- Month 7, Week 4: Scheduling and Analytics agents in test
- Month 8, Week 4: Integration agent connected to 5+ third-party services
- Month 9, Week 2: Monitoring agent + rollback system operational
- Month 9, Week 4: Advanced analytics dashboard in beta
- Month 10, Week 2: Full system integration testing
- Month 10, Week 4: Production launch with 2,000+ users

**Success Criteria:**
- 2,000+ active users
- Automation adoption: 60%+ of Pro users have at least one active automation
- Agent accuracy: Confidence calibration within 10% (predicted vs actual success)
- Rollback rate: < 5% of autonomous actions rolled back
- User time saved: measurable reduction in manual effort reported
- [R7] Validate: Agent error rate acceptable — less than 10% of outputs rejected by users
- [R6] Validate: Can users see measurable goal progress attributable to the system?

**Go/No-Go for Phase 4:**
- GO if: Strong Pro conversion rate (> 8%) AND agent system stable
- ADJUST if: Agents are useful but narrow — expand domain coverage before marketplace
- NO-GO if: Agent system unreliable or users don't trust autonomous actions

### 13.4 Phase 4: Marketplace (Months 11-14)

**Objective:** Open the template ecosystem to community and third-party creators.

**Scope:**
- Template marketplace:
  - Browse, preview, and activate community templates
  - Rating and review system for templates
  - Template usage analytics (for creators)
  - Revenue sharing: template creators earn per activation
- Community templates:
  - Template creation toolkit (structured builder, not freeform)
  - Quality review process (automated checks + manual review)
  - Template versioning and update system
- API for third-party template creators:
  - REST API documentation
  - Template schema specification
  - Webhook support for custom integrations
  - Sandbox environment for testing
- Template analytics:
  - Effectiveness scores per template (completion rates, user ratings)
  - A/B testing framework for template variants
  - Automated template improvement suggestions

**Team:** 3-4 engineers, 1 product manager

**Key Milestones:**
- Month 11, Week 4: Template creation toolkit in alpha
- Month 12, Week 2: Marketplace UI and review system functional
- Month 12, Week 4: API documentation and sandbox live
- Month 13, Week 2: 10 community templates submitted and reviewed
- Month 13, Week 4: Marketplace open beta with 20+ templates
- Month 14, Week 4: Full marketplace launch with 50+ templates

**Success Criteria:**
- 50+ community templates live with quality scores > 3.5/5
- 10%+ of active users engage with a community template
- Template creators earning revenue (validates marketplace economics)
- API adopted by at least 3 third-party developers
- Overall platform reaches 10,000+ active users
- [R1] Validate: Community templates maintain quality — the review system effectively filters poor templates
- [R5] Validate: Third-party domain expertise fills gaps GoalPilot team cannot cover internally

### 13.5 Roadmap Summary

```
Month:  1   2   3   4   5   6   7   8   9   10  11  12  13  14
        ├───────────┤───────────┤───────────────┤───────────────┤
Phase:  │  1: MVP   │ 2: Scale  │ 3: Full Auto  │ 4: Marketplace│
        │           │           │               │               │
Users:  │    50     │   500     │    2,000      │   10,000      │
Tmpl:   │    1      │    4      │      6        │     50+       │
Agents: │    0      │    2      │      6        │      6+       │
Rev:    │   $0      │  ~$2K     │   ~$20K       │   ~$100K      │
```

---

## Section 14: Competitive Landscape

### 14.1 Comparison Matrix

| Feature | GoalPilot | Notion AI | Monday.com | Todoist AI | Motion | Reclaim.ai | Auto-GPT | Noom/BetterUp |
|---------|-----------|-----------|------------|-----------|--------|-----------|----------|---------------|
| Plan generation | Full (diagnostic → plan) | None | None | None | None | None | Freeform | Human coach |
| Daily action loop | Core feature | No | No | Basic reminders | Calendar blocks | Calendar blocks | No | Coach check-ins |
| Domain templates | Opinionated, curated | Generic | Generic | None | None | None | None | Domain-specific |
| AI agents | Constrained, domain-specific | General assistant | Basic automation | Task suggestions | Scheduling AI | Scheduling AI | Unconstrained | None |
| Trust/approval system | Graduated autonomy | N/A | N/A | N/A | N/A | N/A | None (full auto) | Human judgment |
| Leading indicators | Per-goal tracking | None | Custom dashboards | None | None | None | None | Coach-tracked |
| Automation execution | Reviewed + autonomous | None | Rule-based | None | Calendar only | Calendar only | Full autonomous | None |
| Price | $19/mo Pro | $10/mo | $12/seat/mo | $5/mo | $19/mo | $10/mo | Free/variable | $300+/mo |

### 14.2 Detailed Competitor Analysis

#### Notion AI
**What they do well:**
- Extremely flexible workspace — can build almost anything
- Strong AI writing assistant integrated into docs
- Large template marketplace with community contributions
- Excellent collaboration features
- Brand loyalty and large user base

**What they miss:**
- Blank canvas problem: Users must design their own goal-tracking system
- No daily action loop — Notion doesn't proactively tell you what to do today
- AI is reactive (answers questions, drafts text) not proactive (generates plans, assigns tasks)
- No domain expertise — AI doesn't know how to launch a Turo business
- No automation execution — can't take actions on your behalf

**How GoalPilot is different:**
GoalPilot is the opposite of a blank canvas. Where Notion says "build whatever you want," GoalPilot says "tell me your goal and I'll build the plan." This is a feature, not a limitation. Most people don't need another tool — they need someone to tell them what to do next. [R1] The trade-off is real: Notion's flexibility means it works for anything; GoalPilot's rigidity means it works well for supported goal types but not at all for unsupported ones.

#### Monday.com
**What they do well:**
- Powerful project management with multiple views (Kanban, Gantt, Calendar)
- Strong team collaboration and communication
- AI automations for repetitive workflows
- Extensive integrations (200+)
- Enterprise-grade reliability

**What they miss:**
- Designed for teams, not individuals with personal goals
- Project management paradigm assumes you already know the plan
- No diagnostic intake — you fill out the board yourself
- AI assists with existing workflows, doesn't create new ones
- Overwhelming for a single person trying to start a side hustle

**How GoalPilot is different:**
Monday.com is a project management tool. GoalPilot is a goal achievement tool. The difference: Monday helps you manage tasks you've already defined. GoalPilot defines the tasks for you based on your goal and context. A first-time Turo host doesn't need a Gantt chart — they need someone to say "today, take 12 photos of your car using this guide."

#### Todoist AI
**What they do well:**
- Clean, fast task management across platforms
- AI-powered task parsing ("Buy groceries tomorrow at 3pm" → structured task)
- Natural language input is excellent
- Strong habit and recurring task support
- Lightweight and focused

**What they miss:**
- Organizes tasks you create — doesn't generate a plan
- No domain knowledge — can't tell you what tasks you need for a specific goal
- No automation or agent system — purely a task tracker
- No leading indicators or strategic progress measurement
- Reactive, not proactive

**How GoalPilot is different:**
Todoist is the best tool for managing tasks you already know about. GoalPilot is for when you don't know what the tasks should be. "I want to earn $1,500/month on Turo" is not a task — it's a goal. GoalPilot decomposes it into a plan, milestones, and daily tasks. Todoist can't do this. [R4] That said, Todoist's simplicity is a strength — GoalPilot must avoid becoming bloated while delivering more capability.

#### Motion
**What they do well:**
- AI-powered automatic scheduling — truly innovative calendar management
- Intelligently reschedules tasks when conflicts arise
- Time-blocking based on task priority and deadlines
- Clean, focused interface
- Saves meaningful time on scheduling decisions

**What they miss:**
- Scheduling optimization, not strategic planning — assumes you know what tasks to schedule
- No goal decomposition or milestone planning
- No domain expertise or templates
- No agent execution — moves tasks on a calendar but doesn't do tasks
- No progress measurement beyond task completion

**How GoalPilot is different:**
Motion solves "when should I do this?" GoalPilot solves "what should I do?" and "why?" and sometimes does it for you. They're complementary tools, not direct competitors — but GoalPilot's scheduling agent could absorb Motion's core value proposition within a goal context. [R3] Motion's auto-scheduling is instructive: fully automatic scheduling works because calendar actions are low-stakes and reversible. GoalPilot's approval system should be calibrated similarly — low-stakes actions auto-approved, high-stakes actions require human review.

#### Reclaim.ai
**What they do well:**
- AI-powered scheduling for habits, tasks, and meetings
- Smart 1:1 meeting scheduling
- Team calendar coordination
- Slack and Asana integrations
- Good balance of automation and control

**What they miss:**
- Calendar-centric — everything maps to time blocks
- No goal planning or decomposition
- No domain knowledge
- No execution beyond scheduling
- No measurement of goal progress

**How GoalPilot is different:**
Similar to Motion — Reclaim optimizes your calendar, GoalPilot optimizes your trajectory toward a goal. Reclaim might schedule "1 hour for Turo listing" but GoalPilot tells you exactly what to do in that hour, provides an agent-drafted listing to start from, and measures whether your listing views are trending in the right direction.

#### General Agent Platforms (Auto-GPT, AgentGPT, CrewAI)
**What they do well:**
- Fully autonomous AI agent execution
- Can theoretically do anything — maximum flexibility
- Open-source community innovation
- Cutting-edge AI capabilities
- No constraints on what agents can attempt

**What they miss:**
- Unconstrained autonomy is dangerous and unreliable — agents go off-rails
- No domain-specific knowledge or guardrails
- No trust building — full autonomy from minute one
- No daily loop or habit formation
- Not designed for sustained, multi-week goal pursuit
- Outputs are unpredictable and often wrong
- No rollback system for mistakes

**How GoalPilot is different:**
This is GoalPilot's philosophical core. Auto-GPT says "let the AI do everything." GoalPilot says "let the AI do the right things, in the right order, with human oversight that decreases as trust is earned." [R7] Unconstrained agents are wrong too often for high-stakes goal work. GoalPilot's constrained agents operate within template-defined boundaries, produce outputs with confidence scores, and require graduated approval. Less freedom, more reliability.

#### Life Coaching Apps (Noom, BetterUp, Coach.me)
**What they do well:**
- Human expertise and empathy
- Accountability through personal relationships
- Domain expertise in specific areas (health, career)
- Emotional support and motivation
- Proven behavior change frameworks

**What they miss:**
- Expensive ($150-$500/month for quality coaching)
- Not available 24/7
- Coach quality is variable and hard to scale
- No automation — coaches suggest, humans execute everything
- Limited by coach's bandwidth (15-30 min/week interaction)

**How GoalPilot is different:**
GoalPilot is not a replacement for coaching — it's structured AI guidance at 1/15th the price. It cannot provide emotional support or nuanced human judgment. But it CAN provide: daily action plans, automated research, execution assistance, and data-driven progress tracking — all things a human coach does poorly or inconsistently at scale. [R5] The gap: domain expertise. A great Turo coach knows things our templates might miss. This is why template quality is our content moat — we need to encode that expertise rigorously.

### 14.3 GoalPilot's Competitive Moat

**Moat 1: Opinionated Templates (Content Moat)**
- Each template encodes real domain expertise: competitive analysis patterns, milestone sequencing, leading indicator selection, task generation rules
- This content is expensive to create, hard to replicate, and improves with data
- Templates get better as more users complete goals (task effectiveness data feeds back)
- Community marketplace (Phase 4) creates a network effect — more templates attract more users, which attract more template creators
- [R5] Risk: Template quality is only as good as the domain expertise invested. Requires ongoing research and validation.

**Moat 2: Trust System (Gets Better With Use)**
- Individual trust scores create personalized automation levels
- Users who invest weeks building trust are unlikely to switch — their GoalPilot "knows" their preferences
- Trust data is proprietary — a competitor can't replicate your trust profile
- The graduated autonomy model means the product literally gets better the more you use it
- Switching cost: starting over with manual approvals on a new platform

**Moat 3: Daily Loop (Habit Formation)**
- The daily brief becomes a habit within 2-3 weeks (per habit formation research)
- Streak mechanics create loss aversion — users don't want to break a 30-day streak
- Unlike tools you open when you need them, GoalPilot comes to you every morning
- This shifts the relationship from "tool I use" to "system I follow"
- Habit stickiness is the strongest retention mechanism in consumer software

**Moat 4: Goal Completion Data**
- Over time, GoalPilot accumulates data on what works: which task sequences lead to successful Turo launches, which milestone pacing produces the best outcomes, which leading indicators actually predict success
- This data is a flywheel: better data → better plans → higher success rates → more users → more data
- [R6] This moat only materializes if we can actually measure success reliably — which remains a core risk

### 14.4 Where GoalPilot Loses

Honest assessment of scenarios where competitors win:

| Scenario | Better Choice | Why |
|----------|--------------|-----|
| Need a flexible workspace for everything | Notion | GoalPilot is goal-specific, not general-purpose |
| Managing a team project | Monday.com | GoalPilot is individual-first, not team-first |
| Just need a simple task list | Todoist | GoalPilot is overkill if you know your tasks |
| Only need calendar optimization | Motion / Reclaim | GoalPilot's scheduling is a feature, not the product |
| Want full AI autonomy for one-off tasks | Auto-GPT | GoalPilot's constraints are a liability for ad-hoc requests |
| Need emotional support and human connection | BetterUp / therapy | GoalPilot is a system, not a relationship |
| Goal is outside supported templates | Any general tool | GoalPilot has nothing to offer without a matching template |

[R1] The last row is critical. GoalPilot's biggest competitive weakness is template coverage. Until a template exists for a user's goal, GoalPilot is useless. This is why the marketplace (Phase 4) is strategically essential — it converts the weakness into a strength through community contribution.

### 14.5 Positioning Statement

**For** individuals pursuing specific, measurable goals
**Who** need more than a task list but less than a human coach
**GoalPilot** is an opinionated execution system
**That** generates structured plans, provides daily actions, and automates execution with graduated trust
**Unlike** general productivity tools that give you a blank canvas, or unconstrained AI agents that act without guardrails
**GoalPilot** reduces your choices to increase your progress.
