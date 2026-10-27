import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('====================================================');
console.log('🚀 Starting FixFlow Full-Stack Development Environment');
console.log('   - Backend API: http://localhost:5000');
console.log('   - Frontend App: http://localhost:5173');
console.log('====================================================\n');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

// Spawn Backend Server
const serverProc = spawn(npmCmd, ['run', 'dev'], {
  cwd: path.join(rootDir, 'server'),
  stdio: 'inherit',
  shell: true,
});

// Spawn Frontend Vite Client
const clientProc = spawn(npmCmd, ['run', 'dev'], {
  cwd: path.join(rootDir, 'client'),
  stdio: 'inherit',
  shell: true,
});

let isCleaningUp = false;

const cleanup = (code = 0) => {
  if (isCleaningUp) return;
  isCleaningUp = true;
  console.log('\n🛑 Shutting down FixFlow dev processes...');

  if (isWindows) {
    if (serverProc && serverProc.pid) {
      try { spawn('taskkill', ['/pid', serverProc.pid.toString(), '/f', '/t'], { stdio: 'ignore' }); } catch {}
    }
    if (clientProc && clientProc.pid) {
      try { spawn('taskkill', ['/pid', clientProc.pid.toString(), '/f', '/t'], { stdio: 'ignore' }); } catch {}
    }
  } else {
    if (serverProc) serverProc.kill('SIGTERM');
    if (clientProc) clientProc.kill('SIGTERM');
  }

  process.exit(code);
};

process.on('SIGINT', () => cleanup(0));
process.on('SIGTERM', () => cleanup(0));
process.on('exit', () => cleanup(0));

serverProc.on('exit', (code) => {
  if (!isCleaningUp && code !== 0) {
    console.error(`Backend process exited with code ${code}`);
  }
});

clientProc.on('exit', (code) => {
  if (!isCleaningUp && code !== 0) {
    console.error(`Frontend process exited with code ${code}`);
  }
});
