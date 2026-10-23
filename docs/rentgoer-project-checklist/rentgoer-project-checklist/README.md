# RentGoer — Master Project Checklist

**Purpose:** Track completed and remaining work for RentGoer, grouped into focused Markdown files similar to the project audit folder.

**Status rule:** `[x]` means completion was supported by prior project milestones or reported verification. `[ ]` means remaining, proposed, or awaiting verification. Audit recommendations are not automatically completed implementation tasks.

## Checklist files
- [ ] `00-project-foundation.md` — product foundation and core marketplace
- [ ] `01-authentication-sessions.md` — session security and Stage B rollout
- [ ] `02-tenant-experience.md` — tenant browsing and favorites
- [ ] `03-owner-experience.md` — owner dashboard and listings
- [ ] `04-rental-requests.md` — rental request lifecycle
- [ ] `05-chat-realtime-notifications.md` — chat and notifications
- [ ] `06-admin-reviews-verification-reports.md` — admin and trust/safety
- [ ] `07-testing-ci-cd.md` — automated tests and CI
- [ ] `08-reliability-performance-quality.md` — maintainability and operations quality
- [ ] `09-deployment-operations.md` — deployment/runbooks
- [ ] `10-documentation.md` — audit docs upkeep
- [ ] `11-future-ideas.md` — explicitly non-committed product ideas

> The checkboxes above are a table of contents, not progress indicators for whether the files exist. See each file for actual task status.

## Current guardrails
- Stage A session rollout is active. Keep `ENABLE_SESSION_ISSUANCE=false` until Stage B is explicitly approved.
- No Render Cron Job was created; scheduled cleanup is intentionally skipped for cost reasons.
- Request-time expiry and revocation checks remain the security controls; cleanup is housekeeping.
- Do not change production environment settings, run cleanup against production, migrate production DB, commit, push, or deploy as part of checklist maintenance without explicit approval.

## Source basis
Built from the supplied `docs/project-audit/` ZIP and prior project milestones. Where a report was only a recommendation or not verified against current production, the task remains unchecked.
