import { countInstructions } from '../src/java.mjs';
import { writeReport } from '../src/report.mjs';

const a6 = countInstructions('sh1-2014-a6');
const a7 = countInstructions('sh1-2014-a7');
const percent = ((a7 / a6 - 1) * 100).toFixed(1);

writeReport('code-volume.json', { a6, a7, a7PercentLarger: Number(percent) });
console.log(`sh1-2014-a6: ${a6} instructions. sh1-2014-a7: ${a7} instructions (${percent}% more).`);
