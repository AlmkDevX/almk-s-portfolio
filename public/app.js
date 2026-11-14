(() => {
  'use strict';

  const CATEGORY_LABELS = {
    'ai-development': 'AI Development',
    'thumbnail-design': 'Thumbnail Design',
    'web-development': 'Web Development',
  };

  const workGrid = document.getElementById('workGrid');
  const filters = document.querySelectorAll('.filter');
  const dialog = document.getElementById('projectDialog');
  const pdClose = document.getElementById('pdClose');
  const pdCover = document.getElementById('pdCover');
  const pdCategory = document.getElementById('pdCategory');
  const pdYear = document.getElementById('pdYear');
  const pdTitle = document.getElementById('pdTitle');
  const pdDesc = document.getElementById('pdDesc');
  const pdTags = document.getElementById('pdTags');
  const pdLink = document.getElementById('pdLink');

  let projects = [];
  let activeFilter = 'all';

  /* ---------- reveal motion ---------- */

  document.documentElement.classList.add('js-reveal');

  const revealEls = [...document.querySelectorAll('.reveal')];
  revealEls.forEach((el) => {
    const siblings = [...(el.parentElement?.querySelectorAll(':scope > .reveal') || [])];
    const index = siblings.indexOf(el);
    if (index > 0) el.style.transitionDelay = `${Math.min(index, 5) * 60}ms`;
  });

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    revealEls.forEach((el) => io.observe(el));
    setTimeout(() => revealEls.forEach((el) => el.classList.add('in')), 2400);
  } else {
    revealEls.forEach((el) => el.classList.add('in'));
  }

  /* ---------- mobile nav ---------- */

  const navToggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('primaryNav');

  function setNav(open) {
    if (!navToggle || !nav) return;
    nav.classList.toggle('is-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  if (navToggle) {
    navToggle.addEventListener('click', () => setNav(!nav.classList.contains('is-open')));
  }
  if (nav) {
    nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) setNav(false);
    });
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav && nav.classList.contains('is-open')) {
      setNav(false);
      navToggle?.focus();
    }
  });

  /* ---------- helpers ---------- */

  function initials(title) {
    const words = String(title || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!words.length) return 'AL';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  function svgIcon(paths, size = 18) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', paths);
    path.setAttribute('stroke-linecap', 'square');
    svg.appendChild(path);
    return svg;
  }

  function makeTag(text) {
    const li = document.createElement('li');
    li.className = 'tag';
    li.textContent = text;
    return li;
  }

  /* ---------- rendering ---------- */

  function buildCard(project, index) {
    const article = document.createElement('article');
    article.className = 'project-card';
    article.dataset.category = project.category;

    const cover = document.createElement('div');
    cover.className = 'card-cover';
    cover.style.setProperty('--pa', project.accent || '#5468FF');

    if (project.cover) {
      const img = document.createElement('img');
      img.className = 'cover-img';
      img.src = project.cover;
      img.alt = '';
      img.loading = 'lazy';
      cover.appendChild(img);
    }

    const top = document.createElement('div');
    top.className = 'cover-top';
    const cat = document.createElement('span');
    cat.className = 'cover-cat';
    cat.textContent = CATEGORY_LABELS[project.category] || project.category;
    top.appendChild(cat);
    if (project.featured) {
      const feat = document.createElement('span');
      feat.className = 'cover-featured';
      feat.textContent = '★ Featured';
      top.appendChild(feat);
    }
    cover.appendChild(top);

    const mark = document.createElement('span');
    mark.className = 'cover-mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = initials(project.title);
    cover.appendChild(mark);

    const arrow = document.createElement('span');
    arrow.className = 'cover-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.appendChild(svgIcon('M7 17L17 7M9 7h8v8', 16));
    cover.appendChild(arrow);

    const body = document.createElement('div');
    body.className = 'card-body';

    const title = document.createElement('h3');
    title.className = 'card-title';
    title.textContent = project.title;

    const meta = document.createElement('div');
    meta.className = 'card-meta';
    const metaLeft = document.createElement('span');
    metaLeft.textContent = project.year || '';
    const metaRight = document.createElement('span');
    metaRight.textContent = 'View project ↗';
    meta.append(metaLeft, metaRight);

    const tags = document.createElement('ul');
    tags.className = 'tag-list';
    (project.tags || []).slice(0, 4).forEach((tag) => tags.appendChild(makeTag(tag)));

    body.append(title, meta, tags);

    const hit = document.createElement('button');
    hit.type = 'button';
    hit.className = 'card-hit';
    hit.setAttribute('aria-label', `View project: ${project.title}`);
    hit.addEventListener('click', () => openProject(project));

    article.style.animationDelay = `${Math.min(index, 8) * 50}ms`;
    article.classList.add('card-enter');
    article.append(cover, body, hit);
    return article;
  }

  function render() {
    if (!workGrid) return;
    const visible =
      activeFilter === 'all' ? projects : projects.filter((p) => p.category === activeFilter);

    workGrid.setAttribute('aria-busy', 'false');
    workGrid.replaceChildren();

    if (!visible.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'Nothing here yet — check back soon.';
      workGrid.appendChild(empty);
      return;
    }

    visible.forEach((project, index) => workGrid.appendChild(buildCard(project, index)));
  }

  function openProject(project) {
    pdCategory.textContent = CATEGORY_LABELS[project.category] || project.category;
    pdYear.textContent = project.year || '';
    pdTitle.textContent = project.title;
    pdDesc.textContent = project.description || 'Details coming soon.';
    pdTags.replaceChildren(...(project.tags || []).map(makeTag));

    pdCover.style.setProperty('--pa', project.accent || '#5468FF');
    pdCover.replaceChildren();
    if (project.cover) {
      const img = document.createElement('img');
      img.src = project.cover;
      img.alt = '';
      pdCover.appendChild(img);
    }

    if (project.link) {
      pdLink.href = project.link;
      pdLink.hidden = false;
    } else {
      pdLink.hidden = true;
      pdLink.removeAttribute('href');
    }

    document.body.classList.add('modal-open');
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    pdClose.focus();
  }

  function closeProject() {
    document.body.classList.remove('modal-open');
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }

  if (pdClose) pdClose.addEventListener('click', closeProject);
  if (dialog) {
    dialog.addEventListener('close', () => document.body.classList.remove('modal-open'));
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const outside =
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom;
      if (outside) closeProject();
    });
  }

  /* ---------- inquiry form ---------- */

  const inquiryDialog = document.getElementById('inquiryDialog');
  const iqForm = document.getElementById('inquiryForm');
  const iqClose = document.getElementById('iqClose');
  const iqName = document.getElementById('iqName');
  const iqEmail = document.getElementById('iqEmail');
  const iqDiscord = document.getElementById('iqDiscord');
  const iqProject = document.getElementById('iqProject');
  const iqBudget = document.getElementById('iqBudget');
  const iqTimeline = document.getElementById('iqTimeline');
  const iqMessage = document.getElementById('iqMessage');
  const iqStatus = document.getElementById('iqStatus');
  const iqSubmit = document.getElementById('iqSubmit');
  const iqSubmitLabel = document.getElementById('iqSubmitLabel');
  const iqSuccess = document.getElementById('iqSuccess');
  const iqSuccessCopy = document.getElementById('iqSuccessCopy');
  const iqAgain = document.getElementById('iqAgain');
  const iqDone = document.getElementById('iqDone');

  function setIqError(message) {
    if (!iqStatus) return;
    iqStatus.textContent = message || '';
    iqStatus.hidden = !message;
  }

  function setIqBusy(busy) {
    if (!iqSubmit) return;
    iqSubmit.disabled = busy;
    if (iqSubmitLabel) iqSubmitLabel.textContent = busy ? 'Sending…' : 'Send inquiry';
  }

  function resetInquiry() {
    if (!iqForm) return;
    iqForm.reset();
    iqForm.hidden = false;
    iqSuccess.hidden = true;
    setIqError('');
    setIqBusy(false);
  }

  function openInquiry() {
    if (!inquiryDialog) return;
    resetInquiry();
    document.body.classList.add('modal-open');
    if (typeof inquiryDialog.showModal === 'function') inquiryDialog.showModal();
    else inquiryDialog.setAttribute('open', '');
    iqName?.focus();
  }

  function closeInquiry() {
    if (!inquiryDialog) return;
    document.body.classList.remove('modal-open');
    if (typeof inquiryDialog.close === 'function') inquiryDialog.close();
    else inquiryDialog.removeAttribute('open');
  }

  document.querySelectorAll('[data-inquiry-open]').forEach((trigger) => {
    trigger.addEventListener('click', openInquiry);
  });

  if (iqClose) iqClose.addEventListener('click', closeInquiry);
  if (iqDone) iqDone.addEventListener('click', closeInquiry);
  if (iqAgain) {
    iqAgain.addEventListener('click', () => {
      resetInquiry();
      iqName?.focus();
    });
  }

  if (inquiryDialog) {
    inquiryDialog.addEventListener('close', () => document.body.classList.remove('modal-open'));
    inquiryDialog.addEventListener('click', (event) => {
      if (event.target !== inquiryDialog) return;
      const rect = inquiryDialog.getBoundingClientRect();
      const outside =
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom;
      if (outside) closeInquiry();
    });
  }

  if (iqForm) {
    iqForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (iqSubmit && iqSubmit.disabled) return;

      const name = iqName.value.trim();
      const email = iqEmail.value.trim();
      const projectType = iqProject.value;

      if (!name) {
        setIqError("Add your name so I know who I'm talking to.");
        iqName.focus();
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        setIqError("That email doesn't look right — check it and try again.");
        iqEmail.focus();
        return;
      }
      if (!projectType) {
        setIqError('Pick a project type — or choose "Something else".');
        iqProject.focus();
        return;
      }
      if (iqMessage.value.trim().length < 10) {
        setIqError('Tell me a little more about the project (10+ characters).');
        iqMessage.focus();
        return;
      }

      setIqError('');
      setIqBusy(true);

      try {
        const res = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            name,
            email,
            discord: iqDiscord.value.trim(),
            projectType,
            budget: iqBudget.value,
            timeline: iqTimeline.value,
            message: iqMessage.value.trim(),
            website: document.getElementById('iqWebsite').value,
          }),
        });

        let data = {};
        try {
          data = await res.json();
        } catch {
          /* no JSON body */
        }

        if (!res.ok) throw new Error(data.error || 'Could not send your inquiry. Try Discord instead.');

        const firstName = name.split(/\s+/)[0];
        iqSuccessCopy.textContent = `Thanks ${firstName} — I'll reply to ${email} within 24–48 hours.`;
        iqForm.hidden = true;
        iqSuccess.hidden = false;
        iqDone.focus();
      } catch (err) {
        setIqError(err.message || 'Could not send your inquiry. Try Discord instead.');
      } finally {
        setIqBusy(false);
      }
    });
  }

  filters.forEach((button) => {
    button.addEventListener('click', () => {
      activeFilter = button.dataset.filter || 'all';
      filters.forEach((b) => {
        const isActive = b === button;
        b.classList.toggle('is-active', isActive);
        b.setAttribute('aria-pressed', String(isActive));
      });
      render();
    });
  });

  function showError() {
    if (!workGrid) return;
    workGrid.setAttribute('aria-busy', 'false');
    workGrid.replaceChildren();
    const wrap = document.createElement('div');
    wrap.className = 'empty-state';
    wrap.textContent = 'Work could not load. ';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'filter';
    retry.style.marginLeft = '12px';
    retry.textContent = 'Retry';
    retry.addEventListener('click', load);
    wrap.appendChild(retry);
    workGrid.appendChild(wrap);
  }

  async function load() {
    try {
      const res = await fetch('/api/projects', { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      projects = Array.isArray(data.projects) ? data.projects : [];
      render();
    } catch {
      showError();
    }
  }

  load();
})();
