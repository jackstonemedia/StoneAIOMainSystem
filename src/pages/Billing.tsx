import { useState } from 'react';
import { Check, CreditCard, Download, Zap, Clock, ArrowRight } from 'lucide-react';

export default function Billing() {
  const [currentPlan] = useState('starter');

  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: '$0',
      period: 'forever',
      desc: 'For getting started with AI agents.',
      features: ['500 credits/month', '1 workflow agent', 'Community support', 'Basic templates'],
      color: 'border-border',
    },
    {
      id: 'starter',
      name: 'Starter',
      price: '$29',
      period: '/month',
      desc: 'For creators building their first automations.',
      features: ['5,000 credits/month', '5 agents (all types)', 'Email support', '200+ templates', 'CRM access'],
      color: 'border-primary',
      popular: true,
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '$99',
      period: '/month',
      desc: 'For professionals and growing businesses.',
      features: ['25,000 credits/month', 'Unlimited agents', 'Priority support', 'Voice agents', 'Autonomous agents', 'Cloud Computer', 'Advanced analytics'],
      color: 'border-purple',
    },
    {
      id: 'team',
      name: 'Team',
      price: '$299',
      period: '/month',
      desc: 'For teams that need scale and control.',
      features: ['100,000 credits/month', 'Everything in Pro', 'Team workspaces', 'Custom integrations', 'SSO / SAML', 'Dedicated support', 'Custom image upload'],
      color: 'border-amber',
    },
  ];

  const invoices = [
    { id: 'INV-001', date: 'Mar 1, 2026', amount: '$29.00', status: 'Paid' },
    { id: 'INV-002', date: 'Feb 1, 2026', amount: '$29.00', status: 'Paid' },
    { id: 'INV-003', date: 'Jan 1, 2026', amount: '$29.00', status: 'Paid' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight mb-1">Billing</h1>
          <p className="text-sm text-text-muted">Manage your subscription and usage.</p>
        </header>

        {/* Usage Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 stagger-children">
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 text-text-muted mb-3">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium uppercase tracking-wider">Credits Used</span>
            </div>
            <div className="text-2xl font-bold mb-2">2,340 <span className="text-sm font-normal text-text-muted">/ 5,000</span></div>
            <div className="w-full bg-bg rounded-full h-2">
              <div className="bg-primary h-2 rounded-full transition-all" style={{ width: '47%' }} />
            </div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 text-text-muted mb-3">
              <Clock className="w-4 h-4 text-amber" />
              <span className="text-xs font-medium uppercase tracking-wider">Billing Cycle</span>
            </div>
            <div className="text-2xl font-bold mb-1">9 days left</div>
            <div className="text-xs text-text-muted">Renews on April 1, 2026</div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 text-text-muted mb-3">
              <CreditCard className="w-4 h-4 text-green" />
              <span className="text-xs font-medium uppercase tracking-wider">Payment Method</span>
            </div>
            <div className="text-lg font-bold mb-1">•••• 4242</div>
            <div className="text-xs text-text-muted">Visa · Expires 12/27</div>
          </div>
        </div>

        {/* Plans */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Plans</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`bg-surface border-2 rounded-xl p-6 relative transition-all ${
                  currentPlan === plan.id ? plan.color + ' ring-1 ring-primary' : 'border-border hover:border-text-muted'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-primary text-white text-[10px] font-bold uppercase tracking-wider rounded-full">
                    Current Plan
                  </div>
                )}
                <h3 className="font-bold text-lg mb-1">{plan.name}</h3>
                <div className="mb-3">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-text-muted text-sm">{plan.period}</span>
                </div>
                <p className="text-sm text-text-muted mb-4">{plan.desc}</p>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentPlan === plan.id
                      ? 'bg-bg border border-border text-text-muted cursor-default'
                      : 'bg-primary text-white hover:bg-primary/90'
                  }`}
                  disabled={currentPlan === plan.id}
                >
                  {currentPlan === plan.id ? 'Current Plan' : 'Upgrade'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Invoice History */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Invoice History</h2>
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-bg border-b border-border text-text-muted">
                <tr>
                  <th className="px-6 py-3 font-medium">Invoice</th>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Amount</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-surface-hover transition-colors">
                    <td className="px-6 py-4 font-medium font-mono text-xs">{inv.id}</td>
                    <td className="px-6 py-4">{inv.date}</td>
                    <td className="px-6 py-4 font-medium">{inv.amount}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green/10 text-green">{inv.status}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-primary hover:underline text-xs font-medium flex items-center gap-1 justify-end w-full">
                        <Download className="w-3 h-3" /> PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
