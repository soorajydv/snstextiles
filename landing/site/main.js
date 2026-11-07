(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- header: solid background once scrolled, mobile menu
  const nav = document.querySelector('.nav');
  const menu = document.querySelector('.menu');
  const links = document.getElementById('nav-links');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 20);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const setMenu = (open) => {
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    links.classList.toggle('open', open);
    nav.classList.toggle('menu-open', open);
  };
  menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));
  links.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  // ---------- videos: load when near the viewport, play only while visible
  const videos = [...document.querySelectorAll('video[data-video]')];
  if (reduceMotion) {
    videos.forEach((v) => {
      v.controls = true;
      if (v.dataset.src) { v.src = v.dataset.src; v.preload = 'metadata'; }
    });
  } else if ('IntersectionObserver' in window) {
    const loader = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const v = entry.target;
        if (v.dataset.src && !v.getAttribute('src')) { v.src = v.dataset.src; v.load(); }
        loader.unobserve(v);
      }
    }, { rootMargin: '400px 0px' });
    const visible = new Set();
    let blocked = false;
    const tryPlay = (v) => v.play().then(() => { v.controls = false; }).catch((err) => {
      // Autoplay refused (e.g. iOS Low Power Mode): offer controls and retry on the first interaction.
      // Other rejections only mean a quick scroll paused the video before it started.
      if (err.name === 'NotAllowedError') { v.controls = true; blocked = true; }
    });
    const player = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const v = entry.target;
        if (entry.isIntersecting) { visible.add(v); tryPlay(v); } else { visible.delete(v); v.pause(); }
      }
    }, { threshold: 0.35 });
    videos.forEach((v) => { loader.observe(v); player.observe(v); });
    const unlock = () => {
      if (!blocked) return;
      blocked = false;
      visible.forEach(tryPlay);
    };
    ['pointerdown', 'keydown', 'touchstart'].forEach((type) => window.addEventListener(type, unlock, { passive: true }));
  } else {
    videos.forEach((v) => { if (v.dataset.src) v.src = v.dataset.src; v.controls = true; });
  }

  // ---------- reveal on scroll
  const revealables = document.querySelectorAll('.section-head, .feature, .pain, .role, .more-grid article, .shot, .chips, details, .demo-form, .mobile-copy');
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) { entry.target.classList.add('in'); io.unobserve(entry.target); }
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealables.forEach((el) => { el.classList.add('reveal'); io.observe(el); });
  }

  // ---------- workflow: stages light up one by one while the section is visible
  const stages = document.querySelector('.stages');
  if (stages) {
    const items = [...stages.children];
    let step = 0;
    let timer = null;
    const paint = () => {
      items.forEach((li, i) => li.classList.toggle('done', i < step));
      stages.style.setProperty('--progress', `${Math.max(0, step - 1) / (items.length - 1) * 100}%`);
    };
    const tick = () => {
      step = step > items.length ? 0 : step + 1;
      paint();
      timer = setTimeout(tick, step > items.length ? 1800 : step === 0 ? 400 : 750);
    };
    if (reduceMotion) { step = items.length; paint(); }
    else if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        clearTimeout(timer);
        if (entry.isIntersecting) tick();
      }, { threshold: 0.4 }).observe(stages);
    }
  }

  // ---------- screenshot lightbox
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = lightbox.querySelector('img');
  document.querySelectorAll('.shot').forEach((btn) => {
    btn.addEventListener('click', () => {
      lightboxImg.src = btn.dataset.full;
      lightboxImg.alt = btn.querySelector('img').alt;
      lightbox.showModal();
    });
  });
  lightbox.querySelector('.lightbox-close').addEventListener('click', () => lightbox.close());
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) lightbox.close(); });

  // ---------- demo form: opens the visitor's mail app with the details filled in
  const form = document.getElementById('demo-form');
  const note = form.querySelector('.form-note');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let firstInvalid = null;
    form.querySelectorAll('[required]').forEach((field) => {
      const ok = field.value.trim() !== '';
      field.setAttribute('aria-invalid', String(!ok));
      if (!ok && !firstInvalid) firstInvalid = field;
    });
    const email = form.elements.email;
    if (email.value && !email.checkValidity()) { email.setAttribute('aria-invalid', 'true'); firstInvalid ??= email; }
    if (firstInvalid) {
      note.textContent = 'Please fill in your name, company and phone.';
      firstInvalid.focus();
      return;
    }
    const data = Object.fromEntries(new FormData(form));
    const body = [
      `Name: ${data.name}`, `Company: ${data.company}`, `Phone: ${data.phone}`, `Email: ${data.email || '-'}`,
      `Makes: ${data.industry}`, '', data.message || '',
    ].join('\n');
    window.location.href = `mailto:${form.dataset.email}?subject=${encodeURIComponent(`Demo request: ${data.company}`)}&body=${encodeURIComponent(body)}`;
    note.textContent = 'Thanks! Your email app should open with the request ready to send.';
  });
  form.addEventListener('input', (e) => e.target.removeAttribute('aria-invalid'));

  document.getElementById('year').textContent = new Date().getFullYear();
})();
