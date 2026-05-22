require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
  const contacts = await db.contact.findMany({ where: { email: { not: null } }, take: 10, select: { id: true, firstName: true, lastName: true, email: true } });
  console.log('=== CRM Contacts with emails ===');
  if (!contacts.length) console.log('NONE — you need to add an email to a CRM contact first');
  contacts.forEach(c => console.log(c.firstName, c.lastName, '->', c.email));
  
  await db.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
