(function () {
  'use strict';

  const STYLE_IDS = ['dd-yt', 'dd-ig'];
  const linkedinHiddenElements = new Map();
  let linkedinObserver = null;

  function injectStyle(id, css) {
    let style = document.getElementById(id);
    if (!style) {
      style = document.createElement('style');
      style.id = id;
      (document.head || document.documentElement).appendChild(style);
    }
    style.textContent = css;
  }

  function restoreLinkedinElements() {
    linkedinHiddenElements.forEach((display, element) => {
      if (element.isConnected) element.style.display = display;
    });
    linkedinHiddenElements.clear();
  }

  function stopDeclutter() {
    STYLE_IDS.forEach(id => document.getElementById(id)?.remove());
    linkedinObserver?.disconnect();
    linkedinObserver = null;
    restoreLinkedinElements();
  }

  function hideLinkedinDistractions() {
    document.querySelectorAll('span, h2, h3').forEach((element) => {
      const text = element.innerText || '';
      const shouldHide = ['熱門新聞', '本日解謎遊戲', '推廣']
        .some(keyword => text.includes(keyword));
      if (!shouldHide) return;

      const container = element.closest('aside, section, li, .artdeco-card');
      if (container && !linkedinHiddenElements.has(container)) {
        linkedinHiddenElements.set(container, container.style.display);
        container.style.display = 'none';
      }
    });
  }

  function runDeclutter(settings = {}) {
    stopDeclutter();
    if (!settings.enabled || settings.declutterEnabled === false) return;

    const host = location.hostname.replace(/^www\./, '');

    if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      injectStyle('dd-yt', `
        #related, #comments, ytd-reel-shelf-renderer, #shorts-container,
        ytd-browse[page-subtype="home"] ytd-rich-grid-renderer {
          display: none !important;
        }
      `);
      return;
    }

    if (host === 'instagram.com' || host.endsWith('.instagram.com')) {
      injectStyle('dd-ig', `
        div[role="presentation"], article, aside[role="complementary"] {
          display: none !important;
        }
      `);
      return;
    }

    if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) {
      hideLinkedinDistractions();
      linkedinObserver = new MutationObserver(hideLinkedinDistractions);
      linkedinObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  window.__ddDeclutter = {
    run: runDeclutter,
    stop: stopDeclutter
  };
})();
