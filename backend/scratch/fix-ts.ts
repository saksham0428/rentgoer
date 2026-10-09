import fs from 'fs';
import path from 'path';

const files = [
  'src/controllers/admin-property.controller.ts',
  'src/controllers/admin-user.controller.ts',
  'src/controllers/admin-verification.controller.ts',
  'src/controllers/verification.controller.ts'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace direct assignments in where objects
  content = content.replace(/where: \{\s*id\s*\}/g, 'where: { id: id as string }');
  content = content.replace(/where: \{\s*id: [^\}]+\}/g, (match) => {
    if (match.includes('as string')) return match;
    return match.replace(/id:\s*([^ }]+)/, 'id: $1 as string');
  });

  // Specifically fix req.query/req.params issues
  content = content.replace(/const \{ id \} = req\.params;/g, 'const { id } = req.params as { id: string };');
  content = content.replace(/const propertyId = req\.params\.id;/g, 'const propertyId = req.params.id as string;');
  content = content.replace(/const ownerId = req\.query\.ownerId;/g, 'const ownerId = req.query.ownerId as string;');
  content = content.replace(/const propertyId = req\.query\.propertyId;/g, 'const propertyId = req.query.propertyId as string;');
  content = content.replace(/req\.query\.type/g, '(req.query.type as string)');
  content = content.replace(/req\.query\.status/g, '(req.query.status as string)');
  content = content.replace(/where: \{ propertyId \}/g, 'where: { propertyId: propertyId as string }');
  content = content.replace(/where: \{ ownerId \}/g, 'where: { ownerId: ownerId as string }');
  
  fs.writeFileSync(file, content);
  console.log(`Fixed ${file}`);
}
