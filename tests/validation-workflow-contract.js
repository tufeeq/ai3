const assert=require('node:assert/strict');
const fs=require('node:fs');

const yml=fs.readFileSync('.github/workflows/validation-snapshots.yml','utf8');

assert(/workflow_run:\s*\n\s*workflows:\s*\["TAGX3 Intelligence Feed"\]/m.test(yml),'validation must capture after the production intelligence workflow');
assert(/github\.event_name != 'workflow_run' \|\| github\.event\.workflow_run\.conclusion == 'success'/.test(yml),'failed intelligence runs must never generate validation snapshots');
assert(!/gh workflow run intelligence-feed\.yml/.test(yml),'validation must not dispatch intelligence and create a feedback loop');
assert(!/actions:\s*write/.test(yml),'validation no longer needs workflow-dispatch permission');
assert(/npm run check/.test(yml)&&/npm test/.test(yml),'snapshot publication must remain behind full repository contracts');
assert(/node scripts\/capture-validation-snapshot\.mjs/.test(yml)&&/npm run validation:scorecard/.test(yml),'snapshot and causal scorecard steps must remain present');
assert(/cron:\s*'7,22,37,52 12-22 \* \* 1-5'/.test(yml),'scheduled fallback cadence must remain available independently of event coupling');
console.log('validation workflow contract: OK');
