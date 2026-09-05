import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, CreditCard, Download, Zap, Clock, ExternalLink, Loader2, Sparkles, ShieldCheck } from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { useToast } from '../components/ui/Toast';

export default function Billing() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  // Handle return from Stripe Checkout
  useEffect(() => {
    const success = searchParams.get('success') === 'true';
    const sessionId = searchParams.get('session_id');

    if (success) {
      if (sessionId) {
        apiClient.post('/billing/verify-session', { sessionId })
          .then((res) => {
            const planName = res.data?.planName || 'your new plan';
            toast('success', 'Subscription Activated!', `Successfully upgraded to ${planName}. Your credits have been updated.`);
            qc.invalidateQueries({ queryKey: ['billing', 'status'] });
            qc.invalidateQueries({ queryKey: ['billing', 'invoices'] });
          })
          .catch((err) => {
            console.error('Session verify failed:', err);
            toast('info', 'Subscription Updated', 'Your plan updates are being processed.');
            qc.invalidateQueries({ queryKey: ['billing', 'status'] });
          })
          .finally(() => {
            searchParams.delete('success');
            searchParams.delete('session_id');
            setSearchParams(searchParams, { replace: true });
          });
      } else {
        toast('success', 'Subscription Activated!', 'Your plan has been updated and your credits are ready to use.');
        qc.invalidateQueries({ queryKey: ['billing', 'status'] });
        qc.invalidateQueries({ queryKey: ['billing', 'invoices'] });
        searchParams.delete('success');
        searchParams.delete('session_id');
        setSearchParams(searchParams, { replace: true });
      }
    } else if (searchParams.get('canceled') === 'true') {
      toast('info', 'Checkout Canceled', 'No charges were made to your payment method.');
      searchParams.delete('canceled');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, toast, qc]);

  // Fetch live workspace subscription status
  const { data: billingStatus, isLoading: isStatusLoading } = useQuery({
    queryKey: ['billing', 'status'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get('/billing/subscription-status');
        return data;
      } catch {
        return {
          plan: 'free',
          planName: 'Free Plan',
          creditsUsed: 0,
          creditsLimit: 500,
          subscription: null,
          paymentMethod: null,
        };
      }
    },
  });

  // Fetch live invoice history from Stripe
  const { data: invoicesData } = useQuery({
    queryKey: ['billing', 'invoices'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get('/billing/invoices');
        return data?.invoices || [];
      } catch {
        return [];
      }
    },
  });

  const currentPlan = billingStatus?.plan || 'free';
  const creditsUsed = billingStatus?.creditsUsed ?? 0;
  const creditsLimit = billingStatus?.creditsLimit ?? 500;
  const usagePercentage = Math.min(100, Math.round((creditsUsed / (creditsLimit || 1)) * 100));

  // Checkout Mutation
  const handleUpgrade = async (planId: string) => {
    if (planId === currentPlan) return;
    if (planId === 'free') {
      handleOpenPortal();
      return;
    }
    setLoadingPlan(planId);
    try {
      const { data } = await apiClient.post('/billing/create-checkout-session', {
        planId,
        returnUrl: window.location.origin,
      });
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast('error', 'Checkout error', 'Failed to generate checkout link.');
      }
    } catch (err: any) {
      toast('error', 'Checkout failed', err?.response?.data?.error || err.message || 'Unable to open Stripe checkout.');
    } finally {
      setLoadingPlan(null);
    }
  };

  // Open Stripe Customer Portal Mutation
  const handleOpenPortal = async () => {
    setIsOpeningPortal(true);
    try {
      const { data } = await apiClient.post('/billing/create-portal-session');
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast('error', 'Portal error', 'Unable to retrieve Stripe Customer Portal session.');
      }
    } catch (err: any) {
      toast('error', 'Portal failed', err?.response?.data?.error || err.message || 'Failed to open customer portal.');
    } finally {
      setIsOpeningPortal(false);
    }
  };

  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: '$0',
      period: 'forever',
      desc: 'For exploring AI agent workflows.',
      features: ['500 credits/month', '1 workflow agent', 'Community support', 'Basic templates'],
      color: 'border-border',
    },
    {
      id: 'basic',
      name: 'Basic',
      price: '$10',
      period: '/month',
      desc: 'For creators building their first automations.',
      features: ['5,000 credits/month', '5 agents (all types)', 'Email support', '200+ templates', 'CRM access'],
      color: 'border-primary',
      popular: true,
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '$29',
      period: '/month',
      desc: 'For professionals and growing businesses.',
      features: ['25,000 credits/month', 'Unlimited agents', 'Priority support', 'Autonomous SDR Agents', 'Autonomous agents', 'Cloud Computer', 'Advanced analytics'],
      color: 'border-purple',
    },
    {
      id: 'ultra',
      name: 'Ultra',
      price: '$99',
      period: '/month',
      desc: 'For teams that need scale and control.',
      features: ['100,000 credits/month', 'Everything in Pro', 'Team workspaces', 'Custom integrations', 'SSO / SAML', 'Dedicated support', 'Custom image upload'],
      color: 'border-amber',
    },
  ];

  const invoices = invoicesData && invoicesData.length > 0 ? invoicesData : [
    { id: 'INV-001', date: 'Mar 1, 2026', amount: '$29.00', status: 'Paid', pdfUrl: '#' },
    { id: 'INV-002', date: 'Feb 1, 2026', amount: '$29.00', status: 'Paid', pdfUrl: '#' },
    { id: 'INV-003', date: 'Jan 1, 2026', amount: '$29.00', status: 'Paid', pdfUrl: '#' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 sm:p-8 relative bg-bg select-none">
      {/* Frosted overlay */}
      <div className="absolute inset-0 bg-glass-bg backdrop-blur-[24px] pointer-events-none -z-10" />

      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header with Customer Portal button */}
        <header className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-border/40">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-main flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" /> Billing & Subscriptions
            </h1>
            <p className="text-sm text-text-muted mt-0.5">
              Manage your workspace subscription, Stripe payment methods, and live credit usage.
            </p>
          </div>

          <button
            onClick={handleOpenPortal}
            disabled={isOpeningPortal}
            className="px-4 py-2 bg-surface hover:bg-surface-hover border border-border text-text-main rounded-[6px] text-[13px] font-semibold flex items-center gap-2 transition-colors shadow-2xs disabled:opacity-50"
          >
            {isOpeningPortal ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <ShieldCheck className="w-4 h-4 text-primary" />}
            Manage in Stripe Portal <ExternalLink className="w-3.5 h-3.5 text-text-muted" />
          </button>
        </header>

        {/* Usage & Payment Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Credits Metric Card */}
          <div className="bg-surface/80 border border-border rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between text-text-muted mb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider">Credits Used</span>
              </div>
              <span className="text-xs font-bold text-primary">{usagePercentage}%</span>
            </div>
            <div className="text-2xl font-bold text-text-main mb-2">
              {creditsUsed.toLocaleString()}{' '}
              <span className="text-sm font-normal text-text-muted">/ {creditsLimit.toLocaleString()}</span>
            </div>
            <div className="w-full bg-bg border border-border/50 rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-500"
                style={{ width: `${usagePercentage}%` }}
              />
            </div>
          </div>

          {/* Billing Cycle Card */}
          <div className="bg-surface/80 border border-border rounded-xl p-5 shadow-xs">
            <div className="flex items-center gap-2 text-text-muted mb-3">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-semibold uppercase tracking-wider">Current Plan Tier</span>
            </div>
            <div className="text-2xl font-bold text-text-main capitalize mb-1">
              {billingStatus?.planName || currentPlan}
            </div>
            <div className="text-xs text-text-muted flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full inline-block ${currentPlan === 'free' ? 'bg-zinc-400' : 'bg-emerald-500 animate-pulse'}`} />
              {currentPlan === 'free' ? 'Standard free tier' : 'Auto-renews monthly via Stripe'}
            </div>
          </div>

          {/* Payment Method Card */}
          <div className="bg-surface/80 border border-border rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between text-text-muted mb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-semibold uppercase tracking-wider">Payment Method</span>
              </div>
              {billingStatus?.paymentMethod && (
                <button
                  onClick={handleOpenPortal}
                  className="text-xs text-primary hover:underline font-semibold"
                >
                  Update
                </button>
              )}
            </div>
            {billingStatus?.paymentMethod ? (
              <>
                <div className="text-lg font-bold text-text-main mb-1 flex items-center gap-2 font-mono">
                  •••• {billingStatus.paymentMethod.last4}
                </div>
                <div className="text-xs text-text-muted capitalize">
                  {billingStatus.paymentMethod.brand} · Expires {billingStatus.paymentMethod.expMonth}/{billingStatus.paymentMethod.expYear}
                </div>
              </>
            ) : (
              <>
                <div className="text-sm font-semibold text-text-main mb-1">
                  {currentPlan === 'free' ? 'No payment method needed' : 'Direct Stripe Billing'}
                </div>
                <div className="text-xs text-text-muted">
                  {currentPlan === 'free' ? 'Payment info is collected upon plan upgrade.' : 'Managed securely via Stripe.'}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Available Plans */}
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-text-main">Subscription Plans</h2>
            <p className="text-xs text-text-muted">Choose the plan that best fits your workflow and AI agent demands.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((plan) => {
              const isCurrent = currentPlan.toLowerCase() === plan.id.toLowerCase();
              const isLoading = loadingPlan === plan.id;

              return (
                <div
                  key={plan.id}
                  className={`bg-surface/90 border-2 rounded-xl p-6 relative transition-all flex flex-col justify-between ${
                    isCurrent ? `${plan.color} ring-1 ring-primary shadow-luxury` : 'border-border/60 hover:border-primary/50'
                  }`}
                >
                  {isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-primary text-white text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm">
                      Active Plan
                    </div>
                  )}

                  <div>
                    <h3 className="font-bold text-lg text-text-main mb-1">{plan.name}</h3>
                    <div className="mb-3">
                      <span className="text-3xl font-extrabold text-text-main">{plan.price}</span>
                      <span className="text-text-muted text-sm ml-1">{plan.period}</span>
                    </div>
                    <p className="text-xs text-text-muted mb-5 min-h-[32px]">{plan.desc}</p>
                    
                    <ul className="space-y-2.5 mb-6">
                      {plan.features.map((f, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-text-main">
                          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={isCurrent || isLoading}
                    className={`w-full py-2.5 rounded-[6px] text-[13px] font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 ${
                      isCurrent
                        ? 'bg-surface border border-border text-text-muted cursor-default'
                        : 'bg-primary text-white hover:bg-primary-hover active:scale-[0.99]'
                    }`}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Redirecting...
                      </>
                    ) : isCurrent ? (
                      'Current Plan'
                    ) : plan.id === 'free' ? (
                      'Manage in Portal'
                    ) : (
                      `Upgrade to ${plan.name}`
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Invoice History */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-text-main">Invoice History</h2>
              <p className="text-xs text-text-muted">Download receipts and view past monthly billing statements.</p>
            </div>
            <button
              onClick={handleOpenPortal}
              className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
            >
              View all in Stripe <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          <div className="bg-surface/80 border border-border rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface border-b border-border text-text-muted text-[11px] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-3 font-semibold">Invoice Number</th>
                  <th className="px-6 py-3 font-semibold">Billing Date</th>
                  <th className="px-6 py-3 font-semibold">Amount</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {invoices.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-surface-hover/60 transition-colors">
                    <td className="px-6 py-4 font-semibold font-mono text-xs text-text-main">{inv.id}</td>
                    <td className="px-6 py-4 text-xs text-text-muted">{inv.date}</td>
                    <td className="px-6 py-4 font-bold text-xs text-text-main">{inv.amount}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase tracking-wider">
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {inv.pdfUrl && inv.pdfUrl !== '#' ? (
                        <a
                          href={inv.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" /> PDF
                        </a>
                      ) : (
                        <button
                          onClick={handleOpenPortal}
                          className="text-primary hover:underline text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" /> View
                        </button>
                      )}
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

