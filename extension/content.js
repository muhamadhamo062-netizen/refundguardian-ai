// RefundGuardian AI - Content script: semantic extraction (no fragile CSS/IDs)
// Supported: Amazon, Uber, Uber Eats, DoorDash, Grubhub

(function () {
  const host = window.location.hostname;
  let provider = null;
  if (host.includes('amazon')) provider = 'amazon';
  else if (host.includes('ubereats')) provider = 'uber_eats';
  else if (host.includes('uber.com')) provider = 'uber';
  else if (host.includes('doordash')) provider = 'doordash';
  else if (host.includes('grubhub')) provider = 'grubhub';

  if (!provider) return;

  chrome.runtime.sendMessage({ type: 'PAGE_VISIT', url: window.location.href, provider });

  // Keywords that indicate order creation / order date
  const ORDER_CREATION_KEYWORDS = [
    'order placed',
    'order date',
    'placed on',
    'ordered on',
    'purchase date',
    'order time',
  ];

  // Keywords that indicate estimated / promised delivery
  const ESTIMATED_DELIVERY_KEYWORDS = [
    'arriving by',
    'expected by',
    'estimated delivery',
    'delivery time',
    'arrival time',
    'estimated arrival',
    'delivery by',
    'get it by',
    'scheduled for',
    'expected delivery',
    'delivers by',
  ];

  // Keywords that indicate actual delivery (delivered)
  const ACTUAL_DELIVERY_KEYWORDS = [
    'delivered on',
    'delivered at',
    'delivered',
    'arrived at',
    'completed at',
    'drop-off',
    'drop off',
  ];

  // Status-like phrases (for order_status)
  const STATUS_KEYWORDS = [
    'delivered',
    'out for delivery',
    'on the way',
    'preparing',
    'confirmed',
    'shipped',
    'picked up',
    'canceled',
    'cancelled',
  ];

  /**
   * Get all text content from a node (self + descendants), normalized.
   */
  function getFullText(node) {
    if (!node) return '';
    if (node.nodeType === Node.TEXT_NODE) return (node.textContent || '').trim();
    return (node.textContent || '').trim().replace(/\s+/g, ' ');
  }

  /**
   * Check if element's text (or its block) contains the keyword (case-insensitive).
   */
  function textContainsKeyword(node, keyword) {
    const text = getFullText(node).toLowerCase();
    return text.includes(keyword.toLowerCase());
  }

  /**
   * Find the smallest containing block: prefer the node itself if it has the keyword,
   * else walk up to find a block that has the keyword and return its immediate text + siblings.
   */
  function findBlockWithKeyword(root, keyword) {
    const lower = keyword.toLowerCase();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    const candidates = [];
    let n;
    while ((n = walker.nextNode())) {
      const text = (n.textContent || '').trim();
      if (!text) continue;
      if (text.toLowerCase().includes(lower)) {
        let el = n.parentElement;
        while (el && el !== root) {
          const blockText = getFullText(el);
          if (blockText.toLowerCase().includes(lower) && blockText.length < 500) {
            candidates.push(el);
            break;
          }
          el = el.parentElement;
        }
      }
    }
    return candidates;
  }

  /**
   * Extract a date/time string from a block's text.
   * Looks for common patterns: ISO, "Jan 15, 2025", "3:45 PM", "Tomorrow at 5pm", etc.
   */
  function extractDateTimeFromText(text) {
    if (!text || typeof text !== 'string') return null;
    const t = text.trim();
    // ISO-like
    const iso = t.match(/\d{4}-\d{2}-\d{2}(?:T|\s)\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/);
    if (iso) return iso[0];
    // "Jan 15, 2025" or "January 15, 2025"
    const longDate = t.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}/i);
    if (longDate) return longDate[0];
    // "15 Jan 2025" or "15 January 2025"
    const altDate = t.match(/\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}/i);
    if (altDate) return altDate[0];
    // "MM/DD/YYYY" or "DD/MM/YYYY"
    const slash = t.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/);
    if (slash) return slash[0];
    // Time only "3:45 PM" or "15:30"
    const time = t.match(/\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?/i);
    if (time) return time[0];
    // "Tomorrow at 5pm", "Today at 3:30"
    const rel = t.match(/(?:today|tomorrow|yesterday)\s+at\s+\d{1,2}(?::\d{2})?\s*(?:AM|PM)?/i);
    if (rel) return rel[0];
    return null;
  }

  /**
   * For a block element, get "value" text: same block, or next sibling, or next meaningful text node.
   */
  function getValueNearBlock(block) {
    if (!block) return null;
    const full = getFullText(block);
    const dt = extractDateTimeFromText(full);
    if (dt) return dt;
    let next = block.nextElementSibling;
    for (let i = 0; i < 3 && next; i++) {
      const nextText = getFullText(next);
      if (nextText.length > 0 && nextText.length < 200) {
        const d = extractDateTimeFromText(nextText);
        if (d) return d;
      }
      next = next.nextElementSibling;
    }
    const parent = block.parentElement;
    if (parent) {
      const parentText = getFullText(parent);
      return extractDateTimeFromText(parentText);
    }
    return null;
  }

  /**
   * Find first matching keyword in list and return extracted value from that block.
   */
  function extractByKeywords(keywordList) {
    const body = document.body;
    if (!body) return null;
    for (const keyword of keywordList) {
      const blocks = findBlockWithKeyword(body, keyword);
      for (const block of blocks) {
        const value = getValueNearBlock(block);
        if (value) return value;
      }
    }
    return null;
  }

  /**
   * Extract a single status phrase from page text (first match).
   */
  function extractStatus() {
    const body = document.body;
    if (!body) return null;
    const fullPage = getFullText(body).toLowerCase();
    for (const status of STATUS_KEYWORDS) {
      if (fullPage.includes(status)) return status;
    }
    return null;
  }

  /**
   * Try to find an order/reference ID in page text (alphanumeric, often near "order" or "ID").
   */
  function extractOrderId() {
    const body = document.body;
    if (!body) return null;
    const text = getFullText(body);
    const idPatterns = [
      /\border\s*#?\s*([A-Z0-9\-]{6,30})\b/i,
      /\b(?:order|reference)\s*id[:\s]*([A-Z0-9\-]{6,30})/i,
      /\b([0-9]{10,20})\b/,
    ];
    for (const re of idPatterns) {
      const m = text.match(re);
      if (m && m[1]) return m[1].trim();
    }
    return null;
  }

  function extractOrderData() {
    const order = {
      provider,
      url: window.location.href,
      order_creation_time: extractByKeywords(ORDER_CREATION_KEYWORDS),
      estimated_delivery_time: extractByKeywords(ESTIMATED_DELIVERY_KEYWORDS),
      actual_delivery_time: extractByKeywords(ACTUAL_DELIVERY_KEYWORDS),
      order_status: extractStatus(),
      order_id: extractOrderId(),
      raw: {},
    };

    const snippet = document.body ? getFullText(document.body).slice(0, 3000) : '';
    order.raw = { pageSnippet: snippet };

    return order;
  }

  function sendOrder() {
    const order = extractOrderData();
    chrome.runtime.sendMessage({ type: 'ORDER_DETECTED', payload: order }, () => {
      if (chrome.runtime.lastError) return;
    });
  }

  setTimeout(sendOrder, 2000);
  const observer = new MutationObserver(() => setTimeout(sendOrder, 500));
  observer.observe(document.body, { childList: true, subtree: true });
})();
