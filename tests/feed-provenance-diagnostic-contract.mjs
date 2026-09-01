import assert from 'node:assert/strict';
import fs from 'node:fs';
import {classifyFeedProvenance} from '../scripts/feed-provenance-diagnostic.mjs';

const behind=classifyFeedProvenance({
  consumerGeneratedAt:'2026-09-01T16:56:36Z',
  consumerNewestObservedAt:'2026-09-01T16:37:30Z',
  upstreamUpdatedAt:'2026-09-01T17:13:33Z',
  upstreamNewestObservedAt:'2026-09-01T17:13:32Z'
});
assert.equal(behind.status,'UPSTREAM_HAS_ADVANCED_SINCE_CONSUMER');
assert.equal(behind.upstreamAdvanceAfterConsumerMin,17);
assert(behind.upstreamQuoteAdvanceMin>35,'diagnostic must expose material quote advance without changing thresholds');
assert.equal(behind.consumerQuoteAgeAtBuildMin,19.1);

const aligned=classifyFeedProvenance({
  consumerGeneratedAt:'2026-09-01T17:15:00Z',
  consumerNewestObservedAt:'2026-09-01T17:14:00Z',
  upstreamUpdatedAt:'2026-09-01T17:15:20Z',
  upstreamNewestObservedAt:'2026-09-01T17:14:30Z'
});
assert.equal(aligned.status,'ALIGNED_OR_NO_NEWER_UPSTREAM_EVIDENCE');

const incomplete=classifyFeedProvenance({consumerGeneratedAt:'2026-09-01T17:15:00Z'});
assert.equal(incomplete.status,'INSUFFICIENT_PROVENANCE');

const source=fs.readFileSync('scripts/feed-provenance-diagnostic.mjs','utf8');
assert(source.includes("policy:'Diagnostic only. Never changes freshness thresholds, Sharia controls, rankings, or trading decisions.'"),'diagnostic must remain observational only');
assert(!/marketDataFresh\s*=|<=\s*\d+/.test(source),'diagnostic must not implement or weaken production freshness thresholds');
console.log('feed provenance diagnostic contract ok');
