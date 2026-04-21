import { RULES } from './rules.js';

let _styleTag = null;
let _observer = null;

const injectStyles = (selectors) => {
  if (_styleTag) _styleTag.remove();
  const style = document.createElement('style');
  style.id = 'dd-declutter-logic';
  style.textContent = selectors.map(s => `${s} { display: none !important; }`).join('\n');
  (document.head || document.documentElement).appendChild(style);
  _styleTag = style;
};

export function runDecluttering(settings = { enabled: true }) {
  if (!settings.enabled) {
    if (_styleTag) _styleTag.remove();
    if (_observer) _observer.disconnect();
    return;
  }

  const host = window.location.hostname;
  const key = Object.keys(RULES).find(d => host.includes(d));
  if (!key) return;

  const rule = RULES[key];
  injectStyles(rule.selectors);

  if (rule.routeEvent) {
    window.addEventListener(rule.routeEvent, () => injectStyles(rule.selectors));
  }

  _observer = new MutationObserver(() => {
    if (!document.getElementById('dd-declutter-logic')) {
      injectStyles(rule.selectors);
    }
  });
  _observer.observe(document.documentElement, { childList: true, subtree: true });
}