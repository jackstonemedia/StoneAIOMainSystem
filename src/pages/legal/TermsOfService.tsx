// Legal pages — drafted for launch; counsel review still owed before
// they are treated as final (see the end-to-end build report).
import React from 'react';

export function LegalLayout({ title, updated, children }: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg text-text-main">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <a href="/" className="text-sm text-primary hover:underline">← Back to Stone AIO</a>
        <h1 className="text-3xl font-bold tracking-tight mt-6 mb-2">{title}</h1>
        <p className="text-sm text-text-muted mb-8">Last updated: {updated}</p>
        <div className="space-y-6 text-[15px] leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold pt-2">{children}</h2>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-text-main/90">{children}</p>;
}

export default function TermsOfService() {
  return (
    <LegalLayout title="Terms of Service" updated="October 27, 2026">
      <P>
        These Terms of Service govern your use of Stone AIO (the “Service”),
        operated by Stone AI Platform (“we”, “us”). By creating an account or
        using the Service, you agree to these terms.
      </P>
      <H>1. The Service</H>
      <P>
        Stone AIO is a customer relationship and business platform that includes
        contact and deal management, email marketing, automations, and an AI
        agent that can read workspace data, draft content, and — with your
        approval — take actions such as sending messages or updating records.
        Features vary by subscription plan.
      </P>
      <H>2. Accounts</H>
      <P>
        You are responsible for keeping your account credentials secure and for
        all activity under your account. You must provide accurate information
        and promptly update it if it changes. One account may serve one
        workspace; workspaces are billed separately.
      </P>
      <H>3. Subscriptions, billing, and trial</H>
      <P>
        Paid plans (Basic $19/month, Plus $49/month, Complete $99/month) are
        billed monthly through Stripe. New paid subscriptions include a 7-day
        free trial, once per workspace; your card is not charged until the trial
        ends, and you may cancel during the trial from the billing portal.
        Subscriptions renew automatically until canceled. Canceling stops future
        charges; you keep access until the end of the current billing period.
        Downgrading takes effect at the next billing period, and features
        exclusive to higher tiers stop working at that point.
      </P>
      <H>4. AI agent and your responsibility</H>
      <P>
        The AI agent acts on your instructions and on the approvals you give it.
        Sends, posts, payments, deletions, and bulk exports require your exact
        approval unless you have explicitly granted the agent autonomy for a
        class of actions. You are responsible for reviewing anything the agent
        sends or publishes on your behalf. AI output can be wrong; verify
        important content before relying on it. Agent usage is metered monthly
        by plan (see your workspace token usage); usage beyond your plan’s
        monthly budget is blocked until the next month.
      </P>
      <H>5. Acceptable use</H>
      <P>
        You may not use the Service to send spam or unsolicited bulk messages,
        to harass or deceive others, to violate the law, to infringe
        intellectual property, to probe or attack the Service, or to resell
        access without permission. Email sending requires a connected mailbox
        and a lawful basis for contacting recipients, including honoring
        unsubscribes and suppression lists. We may suspend accounts that abuse
        the Service or harm other users.
      </P>
      <H>6. Your data</H>
      <P>
        You own the data you put into the Service (contacts, deals, messages,
        campaigns). You grant us a limited license to host and process it solely
        to operate the Service. You are responsible for having the right to
        share any personal data you upload, including complying with applicable
        privacy laws for your contacts.
      </P>
      <H>7. Third-party services</H>
      <P>
        The Service connects to third parties you authorize (such as Gmail,
        Outlook, Stripe, and AI model providers). Their own terms and privacy
        policies apply to their services. We are not responsible for third-party
        outages or changes.
      </P>
      <H>8. Availability and liability</H>
      <P>
        The Service is provided “as is” without warranties of any kind. We do
        not guarantee uninterrupted or error-free operation. To the fullest
        extent permitted by law, our liability is limited to the fees you paid
        in the 12 months before the claim, and we are not liable for indirect,
        incidental, or consequential damages.
      </P>
      <H>9. Termination</H>
      <P>
        You may cancel at any time from the billing portal. We may suspend or
        terminate accounts that breach these terms or remain unpaid. On
        termination, your access ends and your data may be deleted after a
        reasonable retention window.
      </P>
      <H>10. Changes</H>
      <P>
        We may update these terms; material changes will be posted here with a
        new date. Continued use after a change means you accept the new terms.
      </P>
      <H>11. Contact</H>
      <P>
        Questions about these terms can be sent through the support channel in
        the app.
      </P>
    </LegalLayout>
  );
}
