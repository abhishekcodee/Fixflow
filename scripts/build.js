import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('1. Installing server dependencies...');
execSync('npm --prefix server install', { stdio: 'inherit' });

console.log('2. Generating Prisma client...');
try {
  execSync('npm --prefix server run prisma:generate', { stdio: 'inherit' });
} catch (err) {
  console.warn('Prisma generate warning (continuing build):', err.message);
}

console.log('3. Installing client dependencies...');
execSync('npm --prefix client install', { stdio: 'inherit' });

console.log('4. Building client Vite production bundle...');
execSync('npm --prefix client run build', { stdio: 'inherit' });

console.log('5. Staging build artifacts to root dist...');
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true, force: true });
}
if (fs.existsSync('client/dist')) {
  fs.cpSync('client/dist', 'dist', { recursive: true });
}

console.log('✓ FixFlow production build ready at root dist directory.');

