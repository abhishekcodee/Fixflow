import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('1. Installing client dependencies...');
execSync('npm --prefix client install', { stdio: 'inherit' });

console.log('2. Building client Vite production bundle...');
execSync('npm --prefix client run build', { stdio: 'inherit' });

console.log('3. Staging build artifacts to root dist...');
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true, force: true });
}
fs.cpSync('client/dist', 'dist', { recursive: true });

console.log('✓ FixFlow production build ready at root dist directory.');
