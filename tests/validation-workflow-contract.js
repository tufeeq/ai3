const assert=require('node:assert/strict');
const fs=require('node:fs');

const yml=fs.readFileSync('.github/workflows/validation-snapshots.yml','utf8');
const scorecardYml=fs.readFileSync('.github/workflows/validation-scorecard.yml','utf8');
const intelligenceYml=fs.readFileSync('.github/workflows/intelligence-feed.yml','utf8');

assert(/workflow_run:\s*\n\s*workflows:\s*\["TAGX3 Intelligence Feed"\]/m.test(yml),'validation must capture after the production intelligence workflow');
assert(/github\.event_name != 'workflow_run' \|\| github\.event\.workflow_run\.conclusion == 'success'/.test(yml),'failed intelligence runs must never generate validation snapshots');
assert(!/gh workflow run intelligence-feed\.yml/.test(yml),'validation must not dispatch intelligence and create a feedback loop');
assert(!/actions:\s*write/.test(yml),'validation no longer needs workflow-dispatch permission');
assert(/npm run check/.test(yml)&&/npm test/.test(yml),'snapshot publication must remain behind full repository contracts');
assert(/node scripts\/capture-validation-snapshot\.mjs/.test(yml),'snapshot capture step must remain present');
assert(!/npm run validation:scorecard/.test(yml),'heavy scorecard generation must not block the ten-minute snapshot lane');
assert(/npm run validation:scorecard/.test(scorecardYml),'causal scorecard generation must remain present in the independent analysis workflow');
assert(/npm run check/.test(scorecardYml)&&/npm test/.test(scorecardYml),'scorecard publication must remain behind full repository contracts');
assert(/cron:\s*'5,35 \* \* \* \*'/.test(scorecardYml),'scorecard analysis must remain slower than snapshot capture so aggregation cannot serialize measurement');
assert(/group:\s*tagx3-validation-scorecard/.test(scorecardYml),'scorecard analysis must use an independent concurrency lane');
assert(/cron:\s*'7,17,27,37,47,57 8-23 \* \* 1-5'/.test(yml),'weekday fallback must cover the EDT/EST morning and daytime extended-hours window');
assert(/cron:\s*'7,17,27,37,47,57 0-1 \* \* 2-6'/.test(yml),'post-midnight UTC fallback must cover prior-US-day late extended hours across DST');
assert(/cron:\s*'2,17,32,47 \* \* \* \*'/.test(intelligenceYml),'intelligence safety net must provide four independent refresh opportunities per hour');
assert(/Refresh market news fallback[\s\S]*github\.event_name != 'workflow_run'[\s\S]*node scripts\/build-market-news\.mjs/.test(intelligenceYml),'independent intelligence fallback must refresh market news in-process');
assert(/npm run check[\s\S]*npm test/.test(intelligenceYml),'intelligence publication must remain behind full repository contracts');
console.log('validation workflow contract: OK');
