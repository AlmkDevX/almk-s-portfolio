(() => {
  'use strict';

  const CATEGORY_LABELS = {
    'ai-development': 'AI Development',
    'thumbnail-design': 'Thumbnail Design',
    'web-development': 'Web Development',
  };

  const loginView = document.getElementById('loginView');
  const adminView = document.getElementById('adminView');
  const loginForm = document.getElementById('loginForm');
  const passwordInput = document.getElementById('password');
  const loginError = document.getElementById('loginError');
  const loginBtn = document.getElementById('loginBtn');
  const togglePassword = document.getElementById('togglePassword');
  const logoutBtn = document.getElementById('logoutBtn');

  const projectList = document.getElementById('projectList');
  const projectSearch = document.getElementById('projectSearch');
  const listCount = document.getElementById('listCount');
  const newProjectBtn = document.getElementById('newProjectBtn');

  const statTotal = document.getElementById('statTotal');
  const statAi = document.getElementById('statAi');
  const statThumb = document.getElementById('statThumb');
  const statWeb = document.getElementById('statWeb');

  const projectDialog = document.getElementById('projectDialog');
  const projectForm = document.getElementById('projectForm');
  const projectFormTitle = document.getElementById('projectFormTitle');
  const formMode = document.getElementById('formMode');
  const formClose = document.getElementById('formClose');
  const formCancel = document.getElementById('formCancel');
  const formSave = document.getElementById('formSave');
  const formError = document.getElementById('formError');

  const fTitle = document.getElementById('fTitle');
  const fCategory = document.getElementById('fCategory');
  const fYear = document.getElementById('fYear');
  const fDescription = document.getElementById('fDescription');
  const descCount = document.getElementById('descCount');
  const fTags = document.getElementById('fTags');
  const fLink = document.getElementById('fLink');
  const fCover = document.getElementById('fCover');
  const fAccent = document.getElementById('fAccent');
  const fFeatured = document.getElementById('fFeatured');

  const confirmDialog = document.getElementById('confirmDialog');
  const confirmName = document.getElementById('confirmName');
  const confirmCancel = document.getElementById('confirmCancel');
  const confirmDelete = document.getElementById('confirmDelete');

  const toastEl = document.getElementById('toast');

  let projects = [];
  let editingId = null;
  let deletingId = null;

  /* ---------- api ---------- */

  async function api(path, options = {}) {
    const res = await fetch(path, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
      ...options,
    });
    if (res.status === 401 && !path.endsWith('/login')) {
      showLogin();
      throw new Error('Session expired. Sign in again.');
    }
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) throw new Error((data && (data.error || data.message)) || `Request failed (${res.status})`);
    return data;
  }

  /* ---------- toast ---------- */

  let toastTimer = null;
  function toast(message, isError = false) {
    toastEl.textContent = message;
    toastEl.classList.toggle('is-error', isError);
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.hidden = true;
    }, 3600);
  }

  /* ---------- views ---------- */

  function showLogin() {
    adminView.hidden = true;
    loginView.hidden = false;
    document.title = 'Admin — Almk Portfolio';
    passwordInput.value = '';
    loginError.hidden = true;
    passwordInput.focus();
  }

  async function showAdmin() {
    loginView.hidden = true;
    adminView.hidden = false;
    document.title = 'Manage work — Almk Portfolio';
    await loadProjects();
  }

  /* ---------- auth ---------- */

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    loginError.hidden = true;
    loginBtn.disabled = true;
    const label = loginBtn.textContent;
    loginBtn.textContent = 'Unlocking…';
    try {
      await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ password: passwordInput.value }),
      });
      await showAdmin();
    } catch (error) {
      loginError.textContent = error.message || 'Incorrect password. Try again.';
      loginError.hidden = false;
      passwordInput.select();
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = label;
    }
  });

  togglePassword.addEventListener('click', () => {
    const show = passwordInput.type === 'password';
    passwordInput.type = show ? 'text' : 'password';
    togglePassword.setAttribute('aria-pressed', String(show));
    togglePassword.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    passwordInput.focus();
  });

  logoutBtn.addEventListener('click', async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch {
      /* ignore — still show login */
    }
    showLogin();
    toast('Signed out.');
  });

  /* ---------- render ---------- */

  function initials(title) {
    const words = String(title || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return 'AL';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  function svgIcon(d, size = 16) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.7');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('stroke-linecap', 'square');
    svg.appendChild(path);
    return svg;
  }

  function updateStats() {
    statTotal.textContent = String(projects.length);
    statAi.textContent = String(projects.filter((p) => p.category === 'ai-development').length);
    statThumb.textContent = String(projects.filter((p) => p.category === 'thumbnail-design').length);
    statWeb.textContent = String(projects.filter((p) => p.category === 'web-development').length);
  }

  function buildRow(project) {
    const row = document.createElement('div');
    row.className = 'p-row';
    row.setAttribute('role', 'listitem');

    const thumb = document.createElement('div');
    thumb.className = 'p-thumb';
    thumb.style.setProperty('--pa', project.accent || '#5468FF');
    thumb.textContent = initials(project.title);
    if (project.cover) {
      const img = document.createElement('img');
      img.src = project.cover;
      img.alt = '';
      img.loading = 'lazy';
      thumb.appendChild(img);
    }

    const info = document.createElement('div');
    info.className = 'p-info';

    const titleRow = document.createElement('div');
    titleRow.className = 'p-title-row';
    const title = document.createElement('span');
    title.className = 'p-title';
    title.textContent = project.title;
    titleRow.appendChild(title);
    if (project.featured) {
      const badge = document.createElement('span');
      badge.className = 'p-badge featured';
      badge.textContent = 'Featured';
      titleRow.appendChild(badge);
    }

    const meta = document.createElement('div');
    meta.className = 'p-meta';
    const cat = document.createElement('span');
    cat.textContent = CATEGORY_LABELS[project.category] || project.category;
    meta.appendChild(cat);
    if (project.year) {
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.setAttribute('aria-hidden', 'true');
      const year = document.createElement('span');
      year.textContent = project.year;
      meta.append(dot, year);
    }

    const tags = document.createElement('div');
    tags.className = 'p-tags';
    (project.tags || []).forEach((tag) => {
      const chip = document.createElement('span');
      chip.className = 'p-tag';
      chip.textContent = tag;
      tags.appendChild(chip);
    });

    info.append(titleRow, meta, tags);

    const actions = document.createElement('div');
    actions.className = 'p-actions';

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'icon-btn';
    edit.setAttribute('aria-label', `Edit ${project.title}`);
    edit.title = 'Edit';
    edit.appendChild(svgIcon('M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3ZM14.5 6.5l3 3'));
    edit.addEventListener('click', () => openForm(project));

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'icon-btn is-danger';
    del.setAttribute('aria-label', `Delete ${project.title}`);
    del.title = 'Delete';
    del.appendChild(svgIcon('M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6'));
    del.addEventListener('click', () => openConfirm(project));

    actions.append(edit, del);
    row.append(thumb, info, actions);
    return row;
  }

  function renderList() {
    const query = projectSearch.value.trim().toLowerCase();
    const visible = query
      ? projects.filter(
          (p) =>
            p.title.toLowerCase().includes(query) ||
            (CATEGORY_LABELS[p.category] || '').toLowerCase().includes(query) ||
            (p.tags || []).some((t) => t.toLowerCase().includes(query))
        )
      : projects;

    projectList.replaceChildren();

    if (!projects.length) {
      const empty = document.createElement('p');
      empty.className = 'list-empty';
      empty.textContent = 'No projects yet — create your first one.';
      projectList.appendChild(empty);
    } else if (!visible.length) {
      const empty = document.createElement('p');
      empty.className = 'list-empty';
      empty.textContent = 'No projects match that search.';
      projectList.appendChild(empty);
    } else {
      visible.forEach((project) => projectList.appendChild(buildRow(project)));
    }

    projectList.setAttribute('aria-busy', 'false');
    listCount.textContent = `${visible.length} of ${projects.length} shown`;
  }

  async function loadProjects() {
    projectList.setAttribute('aria-busy', 'true');
    try {
      const data = await api('/api/projects');
      projects = Array.isArray(data.projects) ? data.projects : [];
      updateStats();
      renderList();
    } catch (error) {
      projectList.replaceChildren();
      const empty = document.createElement('p');
      empty.className = 'list-empty';
      empty.textContent = 'Could not load projects. Refresh to try again.';
      projectList.appendChild(empty);
      projectList.setAttribute('aria-busy', 'false');
      toast(error.message, true);
    }
  }

  projectSearch.addEventListener('input', renderList);

  /* ---------- form ---------- */

  function setFormError(message) {
    if (!message) {
      formError.hidden = true;
      formError.textContent = '';
      return;
    }
    formError.textContent = message;
    formError.hidden = false;
  }

  function updateDescCount() {
    descCount.textContent = String(fDescription.value.length);
  }

  fDescription.addEventListener('input', updateDescCount);

  function openForm(project = null) {
    editingId = project ? project.id : null;
    projectForm.reset();
    setFormError('');
    updateDescCount();

    if (project) {
      formMode.textContent = 'Editing';
      projectFormTitle.textContent = 'Edit project';
      formSave.textContent = 'Save changes';
      fTitle.value = project.title || '';
      fCategory.value = project.category || 'ai-development';
      fYear.value = project.year || '';
      fDescription.value = project.description || '';
      fTags.value = (project.tags || []).join(', ');
      fLink.value = project.link || '';
      fCover.value = project.cover || '';
      fAccent.value = (project.accent || '#5468FF').toLowerCase();
      fFeatured.checked = Boolean(project.featured);
    } else {
      formMode.textContent = 'New entry';
      projectFormTitle.textContent = 'New project';
      formSave.textContent = 'Save project';
      fCategory.value = 'ai-development';
      fYear.value = String(new Date().getFullYear());
      fAccent.value = '#5468ff';
      fFeatured.checked = false;
    }

    updateDescCount();
    projectDialog.showModal();
    fTitle.focus();
  }

  function parseTags(raw) {
    return raw
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  projectForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setFormError('');

    if (!fTitle.value.trim()) {
      setFormError('A title is required.');
      fTitle.focus();
      return;
    }

    const payload = {
      title: fTitle.value.trim(),
      category: fCategory.value,
      year: fYear.value.trim(),
      description: fDescription.value.trim(),
      tags: parseTags(fTags.value),
      link: fLink.value.trim(),
      cover: fCover.value.trim(),
      accent: fAccent.value,
      featured: fFeatured.checked,
    };

    formSave.disabled = true;
    const label = formSave.textContent;
    formSave.textContent = 'Saving…';
    try {
      if (editingId) {
        await api(`/api/projects/${encodeURIComponent(editingId)}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        toast('Project updated.');
      } else {
        await api('/api/projects', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast('Project added.');
      }
      projectDialog.close();
      await loadProjects();
    } catch (error) {
      setFormError(error.message);
    } finally {
      formSave.disabled = false;
      formSave.textContent = label;
    }
  });

  formClose.addEventListener('click', () => projectDialog.close());
  formCancel.addEventListener('click', () => projectDialog.close());
  projectForm.addEventListener('input', () => setFormError(''));
  newProjectBtn.addEventListener('click', () => openForm());

  /* ---------- delete ---------- */

  function openConfirm(project) {
    deletingId = project.id;
    confirmName.textContent = project.title;
    confirmDialog.showModal();
    confirmCancel.focus();
  }

  confirmCancel.addEventListener('click', () => confirmDialog.close());

  confirmDelete.addEventListener('click', async () => {
    if (!deletingId) return;
    confirmDelete.disabled = true;
    const label = confirmDelete.textContent;
    confirmDelete.textContent = 'Removing…';
    try {
      await api(`/api/projects/${encodeURIComponent(deletingId)}`, { method: 'DELETE' });
      confirmDialog.close();
      deletingId = null;
      await loadProjects();
      toast('Project removed.');
    } catch (error) {
      toast(error.message, true);
    } finally {
      confirmDelete.disabled = false;
      confirmDelete.textContent = label;
    }
  });

  /* ---------- boot ---------- */

  (async function boot() {
    try {
      const data = await api('/api/auth/me');
      if (data && data.authenticated) {
        await showAdmin();
      } else {
        showLogin();
      }
    } catch {
      showLogin();
    }
  })();
})();
