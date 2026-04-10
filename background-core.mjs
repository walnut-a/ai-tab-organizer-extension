const ORGANIZABLE_PROTOCOLS = new Set(["http:", "https:"]);
const TAB_GROUP_COLORS = ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange"];
const TITLE_REWRITE_MAX_LENGTH = 24;

function getTabUrl(tab) {
  return String(tab?.url || tab?.pendingUrl || "").trim();
}

function isOrganizableTab(tab) {
  if (!tab?.id || tab?.pinned) {
    return false;
  }

  const url = getTabUrl(tab);

  if (!url) {
    return false;
  }

  try {
    return ORGANIZABLE_PROTOCOLS.has(new URL(url).protocol);
  } catch (_error) {
    return false;
  }
}

export function getCandidateTabs(tabs) {
  return (Array.isArray(tabs) ? tabs : []).filter(isOrganizableTab);
}

export function isOrganizableProtocol(url) {
  const value = String(url || "").trim();

  if (!value) {
    return false;
  }

  try {
    return ORGANIZABLE_PROTOCOLS.has(new URL(value).protocol);
  } catch (_error) {
    return false;
  }
}

export function normalizeOrganizationPlan(plan, tabs) {
  const validIds = new Set((Array.isArray(tabs) ? tabs : []).map((tab) => tab.id));
  const assignedIds = new Set();
  const normalizedGroups = [];
  const sourceGroups = Array.isArray(plan?.groups) ? plan.groups : [];

  for (const group of sourceGroups) {
    const tabIds = (Array.isArray(group?.tabIds) ? group.tabIds : [])
      .map((value) => Number(value))
      .filter((id) => validIds.has(id) && !assignedIds.has(id));

    if (tabIds.length < 2) {
      continue;
    }

    tabIds.forEach((id) => assignedIds.add(id));
    normalizedGroups.push({
      name: truncate(String(group?.name || "Group").trim() || "Group", 40),
      color: TAB_GROUP_COLORS.includes(group?.color) ? group.color : pickGroupColor(normalizedGroups.length),
      collapsed: Boolean(group?.collapsed),
      tabIds
    });
  }

  const ungroupedTabIds = (Array.isArray(plan?.ungroupedTabIds) ? plan.ungroupedTabIds : [])
    .map((value) => Number(value))
    .filter((id) => validIds.has(id) && !assignedIds.has(id));

  ungroupedTabIds.forEach((id) => assignedIds.add(id));

  for (const tab of Array.isArray(tabs) ? tabs : []) {
    if (!assignedIds.has(tab.id)) {
      ungroupedTabIds.push(tab.id);
      assignedIds.add(tab.id);
    }
  }

  return { groups: normalizedGroups, ungroupedTabIds };
}

export function normalizeBatchSelection(result, tabs) {
  const tabList = Array.isArray(tabs) ? tabs : [];
  const validIds = new Set(tabList.map((tab) => tab.id));
  const selectedIdSet = new Set(
    (Array.isArray(result?.selectedTabIds) ? result.selectedTabIds : [])
      .map((value) => Number(value))
      .filter((id) => validIds.has(id))
  );

  const selectedTabs = tabList.filter((tab) => selectedIdSet.has(tab.id));

  return {
    tabs: selectedTabs,
    rationale: String(result?.rationale || "").trim(),
    suggestedLabel: truncate(String(result?.suggestedLabel || "").trim() || deriveBatchLabel("", selectedTabs), 40)
  };
}

export function normalizeTitleRewritePlan(result, tabs) {
  const tabList = Array.isArray(tabs) ? tabs : [];
  const validIds = new Set(tabList.map((tab) => tab.id));
  const seenIds = new Set();
  const tabsById = new Map(tabList.map((tab) => [tab.id, tab]));
  const source = Array.isArray(result?.titles) ? result.titles : [];

  return source
    .map((item) => ({
      tabId: Number(item?.tabId),
      title: cleanupRewrittenTitle(
        truncate(String(item?.rewrittenTitle || "").trim(), TITLE_REWRITE_MAX_LENGTH),
        tabsById.get(Number(item?.tabId))
      )
    }))
    .filter((item) => {
      if (!validIds.has(item.tabId) || seenIds.has(item.tabId) || !item.title) {
        return false;
      }

      seenIds.add(item.tabId);
      return true;
    });
}

export function cleanupRewrittenTitle(title, tab) {
  const normalized = String(title || "")
    .replace(/\s*[|·•\-—]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return "";
  }

  const domain = safeGetDomain(tab?.url || "")
    .replace(/^www\./i, "")
    .split(".")[0]
    .toLowerCase();

  if (!domain) {
    return normalized;
  }

  const parts = normalized.split(/\s+/).filter((part) => part.toLowerCase() !== domain);
  return truncate(parts.join(" ").trim() || normalized, TITLE_REWRITE_MAX_LENGTH);
}

function safeGetDomain(url) {
  try {
    return new URL(url).hostname;
  } catch (_error) {
    return "";
  }
}

function pickGroupColor(index) {
  return TAB_GROUP_COLORS[index % TAB_GROUP_COLORS.length];
}

function truncate(value, maxLength) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function deriveBatchLabel(query, tabs) {
  const normalized = String(query || "").trim();

  if (normalized) {
    return truncate(normalized, 40);
  }

  const firstDomain = safeGetDomain(tabs[0]?.url || "");
  return firstDomain || "Arc Tabs";
}
