import * as fs from 'fs';
import * as path from 'path';

const LOG_DIR  = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'log.txt');

export async function appendLog(text: string) {
  await fs.promises.mkdir(LOG_DIR, { recursive: true });
  await fs.promises.appendFile(LOG_FILE, text, 'utf8');
}

// Optional: per-device/file logging
export async function appendLogTo(filename: string, text: string) {
  await fs.promises.mkdir(LOG_DIR, { recursive: true });
  const file = path.join(LOG_DIR, filename);
  await fs.promises.appendFile(file, text, 'utf8');
}
