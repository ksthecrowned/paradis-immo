# Agent Record Cash Payment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Agents/owners/gérants can record (create+validate) a cash rent payment from lease schedule, tenant dossier, and payments page.

**Architecture:** New `POST /payments/record-cash` creates a VALIDATED CASH payment with `userId=tenant`, allocations, and emits PAYMENT_VALIDATED. Web shared helper + confirm CTAs on three surfaces.

**Tech Stack:** NestJS PaymentsService, Prisma, Next.js web (confirm dialogs matching existing UX).

---

### Task 1: API `recordCashPayment` (TDD)

**Files:**
- Modify: `apps/api/src/payments/payments.service.ts`
- Modify: `apps/api/src/payments/payments.controller.ts`
- Modify: `apps/api/src/payments/payments.spec.ts`

**Steps:** Write failing unit tests → implement service+controller → green.

### Task 2: Web client + UI

**Files:**
- Modify: `apps/web/lib/agent/payments.ts` (+ owner if shared)
- Create: `apps/web/components/payments/record-cash-payment-button.tsx`
- Modify: lease-detail, tenant-detail-page, agent-payments-validation
