-- Automation enrollment WAIT support (complete-platform item 1).
-- resume_at: when a WAIT step finishes; last_error/attempts: step-failure visibility.
-- EXITED_BY_STEP: the enrollment left via an explicit EXIT_AUTOMATION step.
ALTER TABLE "automation_enrollments" ADD COLUMN IF NOT EXISTS "resume_at" TIMESTAMP(3);
ALTER TABLE "automation_enrollments" ADD COLUMN IF NOT EXISTS "last_error" TEXT;
ALTER TABLE "automation_enrollments" ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TYPE "EnrollmentExitReason" ADD VALUE IF NOT EXISTS 'EXITED_BY_STEP';
