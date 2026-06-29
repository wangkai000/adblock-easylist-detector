import { rmSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

rmSync(join(root, '.temp'), { recursive: true, force: true });
rmSync(join(root, 'dist'), { recursive: true, force: true });
console.log('cleaned');
