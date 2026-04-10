import test from "node:test";
import assert from "node:assert/strict";
import * as backgroundCore from "../background-core.mjs";

const {
  getCandidateTabs,
  normalizeBatchSelection,
  normalizeOrganizationPlan,
  normalizeTitleRewritePlan
} = backgroundCore;

test("getCandidateTabs keeps only non-pinned http/https tabs", () => {
  const tabs = [
    { id: 1, pinned: false, url: "https://example.com/a" },
    { id: 2, pinned: false, url: "http://example.com/b" },
    { id: 3, pinned: true, url: "https://example.com/c" },
    { id: 4, pinned: false, url: "chrome://settings" },
    { id: 5, pinned: false, url: "chrome-extension://abc/popup.html" },
    { id: 6, pinned: false, url: "file:///Users/demo/test.html" },
    { id: 7, pinned: false, url: "about:blank" },
    { id: 8, pinned: false, url: "", pendingUrl: "https://pending.example.com" }
  ];

  assert.deepEqual(
    getCandidateTabs(tabs).map((tab) => tab.id),
    [1, 2, 8]
  );
});

test("normalizeOrganizationPlan drops invalid groups, dedupes ids, and appends omitted tabs", () => {
  const tabs = [
    { id: 101, url: "https://a.test" },
    { id: 102, url: "https://b.test" },
    { id: 103, url: "https://c.test" },
    { id: 104, url: "https://d.test" }
  ];

  const plan = normalizeOrganizationPlan(
    {
      groups: [
        { name: "Work", color: "blue", collapsed: false, tabIds: [101, 102, 999] },
        { name: "Solo", color: "red", collapsed: false, tabIds: [103] },
        { name: "Dupes", color: "green", collapsed: false, tabIds: [101, 104] }
      ],
      ungroupedTabIds: [102]
    },
    tabs
  );

  assert.deepEqual(plan.groups, [
    { name: "Work", color: "blue", collapsed: false, tabIds: [101, 102] }
  ]);
  assert.deepEqual(plan.ungroupedTabIds, [103, 104]);
});

test("normalizeBatchSelection keeps valid selected tabs and falls back to a label", () => {
  const tabs = [
    { id: 1, title: "Docs", url: "https://docs.example.com/page" },
    { id: 2, title: "Mail", url: "https://mail.example.com/inbox" }
  ];

  const result = normalizeBatchSelection(
    {
      selectedTabIds: [2, 2, 999],
      rationale: "These tabs match the request.",
      suggestedLabel: ""
    },
    tabs
  );

  assert.deepEqual(
    result.tabs.map((tab) => tab.id),
    [2]
  );
  assert.equal(result.rationale, "These tabs match the request.");
  assert.equal(result.suggestedLabel, "mail.example.com");
});

test("normalizeTitleRewritePlan cleans titles, removes duplicates, and skips invalid entries", () => {
  const tabs = [
    { id: 1, title: "Inbox - Gmail", url: "https://mail.google.com/mail/u/0/#inbox" },
    { id: 2, title: "Pull Request · GitHub", url: "https://github.com/openai/openai/pull/1" }
  ];

  const result = normalizeTitleRewritePlan(
    {
      titles: [
        { tabId: 1, rewrittenTitle: "mail 收件箱" },
        { tabId: 1, rewrittenTitle: "重复项" },
        { tabId: 2, rewrittenTitle: "Pull Request · GitHub" },
        { tabId: 999, rewrittenTitle: "Ignore me" }
      ]
    },
    tabs
  );

  assert.deepEqual(result, [
    { tabId: 1, title: "收件箱" },
    { tabId: 2, title: "Pull Request" }
  ]);
});
