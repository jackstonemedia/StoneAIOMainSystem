// Privacy Policy — drafted for launch; counsel review still owed
// before it is treated as final (see the end-to-end build report).
import React from 'react';
import { LegalLayout } from './TermsOfService';

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold pt-2">{children}</h2>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-text-main/90">{children}</p>;
}

export default function PrivacyPolicy() {
  return (
    <LegalLayout title="Privacy Policy" updated="October 27, 2026">
      <P>
        This policy explains what Stone AIO collects, how it is used, and the
        choices you have. Stone AI Platform (“we”, “us”) operates the Service.
      </P>
      <H>1. Data we collect</H>
      <P>
        Account data: your name, email address, and workspace details. Workspace
        data: the contacts, deals, messages, campaigns, and automations you
        create or connect. Billing data: payment is processed by Stripe; we
        store only your Stripe customer and subscription identifiers, never
        your full card number. Usage data: pages visited, features used, and
        AI token usage for metering your plan. If you connect a mailbox
        (Gmail, Outlook), we access messages only as needed for the features
        you use, such as reading threads for drafts or sending on your behalf.
      </P>
      <H>2. How AI processing works</H>
      <P>
        When you use the AI agent, copilots, or AI campaign tools, the relevant
        workspace content (for example, a conversation thread or a campaign
        brief) is sent to our AI model provider to generate a response. The
        provider processes it to produce the output and does not use it to
        train shared models under our current configuration. The agent’s
        memory stores only short statements you or your corrections create,
        visible and deletable from Settings, and never shared across
        workspaces.
      </P>
      <H>3. How we use data</H>
      <P>
        To operate and improve the Service, to bill your subscription, to
        enforce plan limits and acceptable use, to provide support, and to
        communicate about the Service. We do not sell your personal data or
        your contacts’ data, and we do not use it for advertising.
      </P>
      <H>4. Third parties</H>
      <P>
        We share data only with the processors needed to run the Service:
        Stripe (payments), Clerk (authentication), our hosting provider, and
        our AI model provider (generation only, as above). Connected mailbox
        and channel providers receive only what you authorize them to receive.
        We may disclose data if required by law or to protect the Service and
        its users.
      </P>
      <H>5. Retention</H>
      <P>
        Workspace data is kept while your account is active and for a
        reasonable window after cancellation, then deleted. You may delete
        individual records, memories, and conversations from within the app at
        any time. Backups may retain copies for a limited period.
      </P>
      <H>6. Security</H>
      <P>
        We use encrypted connections, workspace-scoped access controls, and
        role-based permissions. No system is perfectly secure; please keep
        your credentials private and tell us promptly if you suspect
        unauthorized access.
      </P>
      <H>7. Your choices and rights</H>
      <P>
        You may access, correct, export, or delete your account and workspace
        data from the app, disconnect connected mailboxes and channels, and
        opt out of non-essential communications. Depending on your location,
        you may have additional rights under applicable privacy law; contact
        us through the app’s support channel to exercise them.
      </P>
      <H>8. Changes</H>
      <P>
        We may update this policy; material changes will be posted here with a
        new date. Continued use after a change means you accept the new policy.
      </P>
    </LegalLayout>
  );
}
