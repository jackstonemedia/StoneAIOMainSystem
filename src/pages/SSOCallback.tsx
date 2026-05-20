import { AuthenticateWithRedirectCallback } from '@clerk/clerk-react';
import EnterpriseAuthLayout from '../components/layout/EnterpriseAuthLayout';
import { Loader2 } from 'lucide-react';

export default function SSOCallback() {
  return (
    <EnterpriseAuthLayout>
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-white animate-spin mb-4" />
        <h2 className="text-xl font-semibold text-white">Authenticating...</h2>
        <p className="text-[#A3A3A3] text-sm mt-2">Please wait while we verify your account.</p>
        
        {/* This component handles the actual OAuth redirect logic securely */}
        <AuthenticateWithRedirectCallback signInForceRedirectUrl="/crm" signUpForceRedirectUrl="/crm" />
      </div>
    </EnterpriseAuthLayout>
  );
}
