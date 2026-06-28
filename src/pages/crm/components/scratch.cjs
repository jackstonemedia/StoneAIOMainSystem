const fs = require('fs');
const file = 'c:/Users/jackx/Desktop/StoneAIO/src/pages/crm/components/NewContactSlideOver.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove blur
content = content.replace("  // Blur logic\n  const isIdentityEmpty = !newContact.email && !newContact.firstName && !newContact.lastName;\n\n", "");
content = content.replace("  // Blur logic\n  const isIdentityEmpty = !newContact.email && !newContact.firstName && !newContact.lastName;\n", "");

const blurOverlay = `        {/* Overlay that blurs the rest of the form if identity is empty */}
        <div className="relative">
          {isIdentityEmpty && (
            <div className="absolute inset-0 z-10 backdrop-blur-[3px] bg-surface/30 flex items-center justify-center rounded-[8px] border border-border/50">
              <p className="text-[13px] font-medium text-text-muted bg-surface px-4 py-2 rounded-full border border-border shadow-sm">
                Fill out primary details to unlock
              </p>
            </div>
          )}

          <div className={\`space-y-6 \${isIdentityEmpty ? 'opacity-40 pointer-events-none' : ''}\`}>`;

content = content.replace(blurOverlay, '        <div className="space-y-6">');

const closingDivs = `          </div>
        </div>

        {/* --- Actions --- */}`;

content = content.replace(closingDivs, `        </div>

        {/* --- Actions --- */}`);

// 2. Remove tacky borders from inputs
content = content.replaceAll("bg-surface border border-border", "bg-surface-hover border border-transparent");

// 3. Clean up the Cancel buttons (e.g. at the bottom)
content = content.replaceAll("border border-border", "border-none");

fs.writeFileSync(file, content);
console.log('Done!');
