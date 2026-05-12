import { db } from '../infrastructure/database/client.js';
const w = await db.workspace.findFirst();
console.log('WORKSPACE:', JSON.stringify(w));
const ap = await db.aPProject.findFirst();
console.log('AP_PROJECT:', JSON.stringify(ap));
await db.$disconnect();
