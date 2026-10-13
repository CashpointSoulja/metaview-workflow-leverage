import { runEvals } from './cases.ts';

const variant = process.argv.includes('--variant=broken') ? 'broken' : 'standard';
const out = runEvals(variant);
const RED = '\x1b[31m', GREEN = '\x1b[32m', RESET = '\x1b[0m';
console.log(`Evaluations (${out.rules} rules). Synthetic fixtures only.\n`);
for (const r of out.results) {
  console.log(`${r.pass ? GREEN + 'PASS' : RED + 'FAIL'}${RESET} ${r.id} ${r.title}`);
  console.log(`     expected: ${r.expected}`);
  console.log(`     actual:   ${r.actual}`);
}
console.log(`\n${out.passed} passed, ${out.failed} failed of ${out.results.length}`);
if (process.argv.includes('--json')) console.log(JSON.stringify(out));
process.exitCode = out.failed ? 1 : 0;
