const fs = require('fs');
const file = 'c:/Users/jackx/Desktop/StoneAIO/src/pages/crm/components/NewContactSlideOver.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace border-none with border-0 to override Tailwind Forms
content = content.replaceAll('border-none', 'border-0');

// For the phone popover inputs
content = content.replaceAll('className="flex-1 min-w-0 px-3 py-2.5 text-[14px] bg-transparent outline-none text-text-main font-medium"', 'className="flex-1 min-w-0 px-3 py-2.5 text-[14px] bg-transparent border-0 ring-0 shadow-none focus:ring-0 outline-none text-text-main font-medium"');
content = content.replaceAll('className="w-[100px] shrink-0 px-3 py-2.5 text-[14px] bg-transparent outline-none text-text-main placeholder:text-text-muted font-medium"', 'className="w-[100px] shrink-0 px-3 py-2.5 text-[14px] bg-transparent border-0 ring-0 shadow-none focus:ring-0 outline-none text-text-main placeholder:text-text-muted font-medium"');
content = content.replaceAll('className="absolute inset-0 opacity-0 cursor-pointer w-full"', 'className="absolute inset-0 opacity-0 cursor-pointer w-full border-0 ring-0 shadow-none"');

fs.writeFileSync(file, content);
console.log('done');
