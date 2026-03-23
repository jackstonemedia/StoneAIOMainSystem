import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Globe, Cpu, HardDrive, Variable, Key, Shield, Wrench, 
  CheckCircle2, ArrowRight, ArrowLeft, Server, Loader2, Plus, Trash2
} from 'lucide-react';

const REGIONS = [
  { id: 'us-east', name: 'US East', location: 'Virginia, USA', latency: '~8ms', recommended: true },
  { id: 'us-west', name: 'US West', location: 'Oregon, USA', latency: '~22ms' },
  { id: 'eu-west', name: 'EU West', location: 'Frankfurt, Germany', latency: '~14ms' },
  { id: 'eu-north', name: 'EU North', location: 'London, UK', latency: '~12ms' },
  { id: 'ap-east', name: 'AP East', location: 'Tokyo, Japan', latency: '~18ms' },
  { id: 'ap-southeast', name: 'AP Southeast', location: 'Singapore', latency: '~20ms' },
];

const SIZES = [
  { id: 'micro', name: 'Micro', cpu: '0.5 vCPU', ram: '512 MB', plan: 'Free', useCase: 'Simple API calls, text processing' },
  { id: 'standard', name: 'Standard', cpu: '2 vCPU', ram: '2 GB', plan: 'Starter+', useCase: 'Browser automation, moderate data' },
  { id: 'performance', name: 'Performance', cpu: '4 vCPU', ram: '8 GB', plan: 'Pro+', useCase: 'Heavy data processing, parallel ops' },
  { id: 'power', name: 'Power', cpu: '8 vCPU', ram: '16 GB', plan: 'Team+', useCase: 'Enterprise workloads, ML inference' },
];

const IMAGES = [
  { id: 'full', name: 'Full Stack', size: '~2.1 GB', boot: '~150ms', desc: 'Ubuntu 24.04, Python 3.12, Node 22, Chromium, FFmpeg', recommended: true },
  { id: 'python', name: 'Python Only', size: '~800 MB', boot: '~120ms', desc: 'Ubuntu 24.04, Python 3.12, Data Science libs' },
  { id: 'minimal', name: 'Minimal', size: '~200 MB', boot: '~100ms', desc: 'Bare Ubuntu 24.04, curl, git' },
  { id: 'custom', name: 'Custom Image', size: 'Varies', boot: 'Varies', desc: 'Upload your own Dockerfile (Team+)' },
];

export default function ComputerSetup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isBuilding, setIsBuilding] = useState(false);

  // Form State
  const [region, setRegion] = useState('us-east');
  const [size, setSize] = useState('standard');
  const [image, setImage] = useState('full');
  const [envVars, setEnvVars] = useState([{ key: '', value: '' }]);
  const [secrets, setSecrets] = useState([{ key: '', value: '' }]);
  const [network, setNetwork] = useState('allow-all');

  const handleNext = () => {
    if (step < 7) setStep(step + 1);
    else handleBuild();
  };

  const handleBuild = () => {
    setIsBuilding(true);
    // Simulate build time
    setTimeout(() => {
      navigate('/computer');
    }, 3000);
  };

  const addEnvVar = () => setEnvVars([...envVars, { key: '', value: '' }]);
  const updateEnvVar = (index: number, field: 'key' | 'value', value: string) => {
    const newVars = [...envVars];
    newVars[index][field] = value;
    setEnvVars(newVars);
  };
  const removeEnvVar = (index: number) => setEnvVars(envVars.filter((_, i) => i !== index));

  const addSecret = () => setSecrets([...secrets, { key: '', value: '' }]);
  const updateSecret = (index: number, field: 'key' | 'value', value: string) => {
    const newSecrets = [...secrets];
    newSecrets[index][field] = value;
    setSecrets(newSecrets);
  };
  const removeSecret = (index: number) => setSecrets(secrets.filter((_, i) => i !== index));

  const steps = [
    { num: 1, title: 'Region', icon: Globe },
    { num: 2, title: 'Size', icon: Cpu },
    { num: 3, title: 'Image', icon: HardDrive },
    { num: 4, title: 'Environment', icon: Variable },
    { num: 5, title: 'Secrets', icon: Key },
    { num: 6, title: 'Network', icon: Shield },
    { num: 7, title: 'Build', icon: Wrench },
  ];

  return (
    <div className="flex-1 flex bg-bg overflow-hidden h-full">
      {/* Left Sidebar - Steps */}
      <div className="w-64 border-r border-border bg-surface/30 p-6 flex flex-col">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-text-main">Cloud Computer</h2>
            <p className="text-xs text-text-muted">Setup Wizard</p>
          </div>
        </div>

        <div className="flex flex-col gap-1 flex-1">
          {steps.map((s) => {
            const isActive = step === s.num;
            const isCompleted = step > s.num;
            return (
              <div
                key={s.num}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive ? 'bg-primary/10 text-primary' : 
                  isCompleted ? 'text-text-main' : 'text-text-muted opacity-50'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <s.icon className="w-4 h-4" />
                )}
                <span className="text-sm font-medium">{s.title}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto">
        <div className="flex-1 max-w-4xl w-full mx-auto p-10">
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h1 className="text-2xl font-semibold mb-2">Choose your Region</h1>
              <p className="text-text-muted mb-8">Select where your Cloud Computer will live. This affects latency and data residency.</p>
              
              <div className="grid grid-cols-2 gap-4">
                {REGIONS.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setRegion(r.id)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      region === r.id 
                        ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                        : 'border-border bg-surface hover:border-text-muted'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium flex items-center gap-2">
                        {r.name}
                        {r.recommended && (
                          <span className="text-[10px] uppercase tracking-wider bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                            Recommended
                          </span>
                        )}
                      </div>
                      <Globe className={`w-4 h-4 ${region === r.id ? 'text-primary' : 'text-text-muted'}`} />
                    </div>
                    <div className="text-sm text-text-muted">{r.location}</div>
                    <div className="text-xs text-text-muted mt-2">Latency: {r.latency}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h1 className="text-2xl font-semibold mb-2">Choose Computer Size</h1>
              <p className="text-text-muted mb-8">Determines CPU and RAM allocated to each container when agents run.</p>
              
              <div className="grid grid-cols-1 gap-4">
                {SIZES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSize(s.id)}
                    className={`p-5 rounded-xl border text-left transition-all flex items-center justify-between ${
                      size === s.id 
                        ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                        : 'border-border bg-surface hover:border-text-muted'
                    }`}
                  >
                    <div>
                      <div className="font-medium text-lg mb-1">{s.name}</div>
                      <div className="text-sm text-text-muted">{s.useCase}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm">{s.cpu} / {s.ram}</div>
                      <div className="text-xs text-primary mt-1">{s.plan} Plan</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h1 className="text-2xl font-semibold mb-2">Choose Base Image</h1>
              <p className="text-text-muted mb-8">The operating system and pre-installed software snapshot for your containers.</p>
              
              <div className="grid grid-cols-1 gap-4">
                {IMAGES.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => setImage(img.id)}
                    className={`p-5 rounded-xl border text-left transition-all ${
                      image === img.id 
                        ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                        : 'border-border bg-surface hover:border-text-muted'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium text-lg flex items-center gap-2">
                        {img.name}
                        {img.recommended && (
                          <span className="text-[10px] uppercase tracking-wider bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                            Recommended
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-text-muted">Size: {img.size}</div>
                        <div className="text-xs text-text-muted">Boot: {img.boot}</div>
                      </div>
                    </div>
                    <div className="text-sm text-text-muted">{img.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h1 className="text-2xl font-semibold mb-2">Environment Variables</h1>
              <p className="text-text-muted mb-8">Global variables injected into every container. Do not put sensitive secrets here.</p>
              
              <div className="space-y-3">
                {envVars.map((env, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <input 
                      type="text" 
                      placeholder="KEY_NAME" 
                      value={env.key}
                      onChange={(e) => updateEnvVar(i, 'key', e.target.value)}
                      className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary font-mono"
                    />
                    <span className="text-text-muted">=</span>
                    <input 
                      type="text" 
                      placeholder="Value" 
                      value={env.value}
                      onChange={(e) => updateEnvVar(i, 'value', e.target.value)}
                      className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary font-mono"
                    />
                    <button 
                      onClick={() => removeEnvVar(i)}
                      className="p-2 text-text-muted hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button 
                  onClick={addEnvVar}
                  className="flex items-center gap-2 text-sm text-primary hover:text-primary-hover mt-4"
                >
                  <Plus className="w-4 h-4" /> Add Variable
                </button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h1 className="text-2xl font-semibold mb-2">Secrets Vault</h1>
              <p className="text-text-muted mb-8">Encrypted secrets stored separately. Never written to disk, masked in logs.</p>
              
              <div className="space-y-3">
                {secrets.map((secret, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <input 
                      type="text" 
                      placeholder="SECRET_NAME" 
                      value={secret.key}
                      onChange={(e) => updateSecret(i, 'key', e.target.value)}
                      className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary font-mono"
                    />
                    <span className="text-text-muted">=</span>
                    <input 
                      type="password" 
                      placeholder="••••••••••••••••" 
                      value={secret.value}
                      onChange={(e) => updateSecret(i, 'value', e.target.value)}
                      className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary font-mono"
                    />
                    <button 
                      onClick={() => removeSecret(i)}
                      className="p-2 text-text-muted hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button 
                  onClick={addSecret}
                  className="flex items-center gap-2 text-sm text-primary hover:text-primary-hover mt-4"
                >
                  <Plus className="w-4 h-4" /> Add Secret
                </button>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h1 className="text-2xl font-semibold mb-2">Network Rules</h1>
              <p className="text-text-muted mb-8">Configure what your containers can and cannot reach on the internet.</p>
              
              <div className="space-y-4">
                <label className={`flex items-start gap-4 p-5 rounded-xl border cursor-pointer transition-all ${network === 'allow-all' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-surface'}`}>
                  <input 
                    type="radio" 
                    name="network" 
                    checked={network === 'allow-all'} 
                    onChange={() => setNetwork('allow-all')}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium mb-1">Allow all outbound traffic</div>
                    <div className="text-sm text-text-muted">Containers can reach any public IP address. Internal platform IPs and metadata services are always blocked.</div>
                  </div>
                </label>

                <label className={`flex items-start gap-4 p-5 rounded-xl border cursor-pointer transition-all ${network === 'allowlist' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-surface'}`}>
                  <input 
                    type="radio" 
                    name="network" 
                    checked={network === 'allowlist'} 
                    onChange={() => setNetwork('allowlist')}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium mb-1">Custom Allowlist</div>
                    <div className="text-sm text-text-muted">Containers can only reach specifically approved domains. Platform LLM endpoints are always allowed.</div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {step === 7 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-center py-12">
              <div className="w-24 h-24 bg-surface rounded-full flex items-center justify-center mx-auto mb-6">
                <Server className="w-12 h-12 text-primary" />
              </div>
              <h1 className="text-2xl font-semibold mb-2">Ready to Build</h1>
              <p className="text-text-muted mb-8 max-w-md mx-auto">
                We'll bake your environment variables, network rules, and base image into a snapshot, then pre-warm containers for instant boot times.
              </p>
              
              {isBuilding ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
                  <div className="text-sm text-text-muted">Building image snapshot...</div>
                  <div className="w-64 bg-surface h-1.5 rounded-full mt-4 overflow-hidden">
                    <div className="bg-primary h-full w-[60%] animate-pulse" />
                  </div>
                </div>
              ) : (
                <button 
                  onClick={handleBuild}
                  className="bg-primary text-white px-8 py-3 rounded-lg font-medium hover:bg-primary-hover transition-colors inline-flex items-center gap-2"
                >
                  <Wrench className="w-5 h-5" />
                  Build Cloud Computer
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        {!isBuilding && (
          <div className="p-6 border-t border-border bg-bg flex justify-between items-center">
            <button
              onClick={() => setStep(step - 1)}
              disabled={step === 1}
              className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-main disabled:opacity-50 flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            
            {step < 7 && (
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors flex items-center gap-2"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
