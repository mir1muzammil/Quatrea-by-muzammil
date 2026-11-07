/* ==========================================================================
   Quatréa — motion engine
   Lenis smooth scroll + GSAP/ScrollTrigger, jQuery for UI glue.
   Everything degrades: no GSAP → content simply shows; reduced motion → no travel.
   ========================================================================== */
(function ($) {
  'use strict';

  var root = document.documentElement;
  var GA_ID = 'G-XXXXXXXXXX'; // ← replace with your GA4 measurement ID

  /* ---------- failsafe: no GSAP means no hidden content ---------- */
  if (!window.gsap || !window.ScrollTrigger) {
    root.classList.remove('js');
    initUI(null);
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var lenis = null;
  var seen = false;
  try { seen = sessionStorage.getItem('qt-seen') === '1'; sessionStorage.setItem('qt-seen', '1'); } catch (e) {}

  /* ---------- smooth scroll ---------- */
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ duration: 1.15, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); }, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }
  function scrollToTarget(target, opts) {
    if (lenis) lenis.scrollTo(target, opts || { offset: -70, duration: 1.6 });
    else if (typeof target === 'number') window.scrollTo({ top: target, behavior: reduce ? 'auto' : 'smooth' });
    else { var el = document.querySelector(target); if (el) el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); }
  }

  /* ---------- word splitter (masked rise) ---------- */
  function splitWords(el) {
    if (el.dataset.done) return [];
    el.dataset.done = '1';
    var label = el.textContent.replace(/\s+/g, ' ').trim();
    el.setAttribute('aria-label', label);
    var out = [];
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            var w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
            var i = document.createElement('span'); i.textContent = part; w.appendChild(i); frag.appendChild(w); out.push(i);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1) { n.setAttribute('aria-hidden', 'true'); walk(n); }
      });
    })(el);
    return out;
  }

  /* ---------- curtain: preload + page transitions ---------- */
  var curtain = document.querySelector('.curtain');
  var strips = curtain ? curtain.querySelectorAll('i') : [];
  var logoBox = curtain ? curtain.querySelector('.curtain-logo') : null;
  var countEl = curtain ? curtain.querySelector('.curtain-count') : null;
  var introDone = false;

  function runIntro() {
    if (introDone) return; introDone = true;
    var tl = gsap.timeline({ defaults: { ease: 'expo.inOut' } });
    if (curtain) {
      tl.to(logoBox, { autoAlpha: 0, y: -24, duration: .5, ease: 'power2.in' }, 0)
        .set(strips, { transformOrigin: 'top' })
        .to(strips, { scaleY: 0, duration: 1, stagger: { each: .09, from: 'start' } }, .15)
        .set(curtain, { display: 'none' });
    }
    tl.add(function () { heroIn(); ScrollTrigger.refresh(); }, curtain ? '-=.55' : 0);
  }
  function startCurtain() {
    if (!curtain || reduce) { if (curtain) curtain.style.display = 'none'; introDone = true; return; }
    var hold = seen ? .35 : 1.5;
    var count = { v: 0 };
    gsap.to(count, { v: 100, duration: hold, ease: 'power2.inOut', onUpdate: function () { if (countEl) countEl.textContent = Math.round(count.v) + ''; } });
    var ready = new Promise(function (res) { if (document.readyState === 'complete') res(); else window.addEventListener('load', res); });
    var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    var min = new Promise(function (res) { setTimeout(res, hold * 1000); });
    var cap = new Promise(function (res) { setTimeout(res, 3500); });
    Promise.race([Promise.all([ready, fonts, min]), cap]).then(runIntro);
  }
  window.addEventListener('pageshow', function (e) { if (e.persisted && curtain) { gsap.set(curtain, { display: 'none' }); } });

  // cover the screen, then navigate
  $(document).on('click', 'a[href]', function (e) {
    var a = this, href = a.getAttribute('href');
    if (!href || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank' || a.hasAttribute('download')) return;
    if (/^(mailto:|tel:|https?:|#|javascript:)/i.test(href)) {
      if (href.charAt(0) === '#' && href.length > 1 && document.querySelector(href)) { e.preventDefault(); closeMenu(); scrollToTarget(href); }
      return;
    }
    if (!curtain || reduce) return;
    e.preventDefault();
    closeMenu();
    gsap.set(curtain, { display: 'flex' });
    gsap.set(logoBox, { autoAlpha: 0 });
    gsap.set(strips, { transformOrigin: 'bottom', scaleY: 0 });
    gsap.to(strips, { scaleY: 1, duration: .7, ease: 'expo.inOut', stagger: .07, onComplete: function () { window.location.href = a.href; } });
  });

  /* ---------- hero intro ---------- */
  function heroIn() {
    var h = document.querySelector('[data-hero]');
    if (!h || reduce) return;
    var words = Array.prototype.concat.apply([], Array.prototype.slice.call(h.querySelectorAll('[data-split]')).map(splitWords));
    var tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    if (words.length) tl.from(words, { yPercent: 115, rotate: 4, duration: 1.3, stagger: .07 }, 0);
    tl.from(h.querySelectorAll('[data-hero-fade]'), { y: 26, autoAlpha: 0, duration: 1, stagger: .12 }, .35);
    var arches = h.querySelectorAll('.hb');
    if (arches.length) {
      tl.from(arches, { yPercent: 60, autoAlpha: 0, duration: 1.4, stagger: .12, clearProps: 'opacity,visibility' }, .2);
      tl.from(h.querySelectorAll('.hb img'), { yPercent: 20, duration: 1.6, stagger: .12 }, .35);
    }
    var ring = h.querySelector('.hero-ring');
    if (ring && !reduce) gsap.to(ring, { rotation: 360, duration: 90, ease: 'none', repeat: -1 });
  }

  /* ---------- helpers ---------- */
  function particles(container, opt) {
    var H = container.offsetHeight || window.innerHeight, W = container.offsetWidth || window.innerWidth;
    var tl = gsap.timeline();
    for (var i = 0; i < opt.count; i++) {
      var el = document.createElement('div');
      el.className = 'ptc'; el.innerHTML = opt.svg(i);
      var s = gsap.utils.random(opt.min, opt.max);
      gsap.set(el, { left: gsap.utils.random(0, 100) + '%', scale: s, opacity: gsap.utils.random(.55, 1) });
      container.appendChild(el);
      var dur = gsap.utils.random(opt.dur[0], opt.dur[1]);
      tl.to(el, { y: H + 120, duration: dur, ease: 'none', repeat: -1 }, -gsap.utils.random(0, dur));
      tl.to(el, { x: '+=' + gsap.utils.random(-opt.sway, opt.sway), rotation: gsap.utils.random(-200, 200), duration: gsap.utils.random(2.4, 4.6), ease: 'sine.inOut', yoyo: true, repeat: -1 }, 0);
    }
    ScrollTrigger.create({ trigger: container, start: 'top bottom', end: 'bottom top', onToggle: function (self) { self.isActive ? tl.play() : tl.pause(); } });
    tl.pause();
    return tl;
  }
  var PETAL = function () { return '<svg width="26" height="32" viewBox="0 0 26 32"><path d="M13 1C22 8 25 20 13 31 1 20 4 8 13 1Z" fill="' + gsap.utils.random(['#e9a0b5', '#f7c3d1', '#fff', '#d97a98']) + '"/></svg>'; };
  var LEAF = function () { return '<svg width="38" height="38" viewBox="0 0 38 38"><path d="M19 2C33 8 36 24 19 36 2 24 5 8 19 2Z" fill="' + gsap.utils.random(['#f0b35c', '#d9814a', '#7a2f12', '#e3a13a']) + '"/><path d="M19 8V34" stroke="#7a2f12" stroke-width="1.4" opacity=".5"/></svg>'; };
  var FLAKE = function () { return '<svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="' + gsap.utils.random(2.2, 6) + '" fill="#fff"/></svg>'; };

  /* ---------- build scroll scenes (page order matters) ---------- */
  var mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)', function () {
    // progress bar + header behaviour
    var prog = document.querySelector('.qprog');
    if (prog) gsap.to(prog, { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: .2 } });
    var header = document.querySelector('.site-header');
    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: function (self) {
      if (!header) return;
      header.classList.toggle('solid', self.scroll() > 40);
      var hide = self.direction === 1 && self.scroll() > 400 && !document.body.classList.contains('menu-open');
      header.classList.toggle('hide', hide);
    } });

    // hero: mouse parallax on bottles
    var hero = document.querySelector('[data-hero]');
    if (hero && window.matchMedia('(hover: hover)').matches) {
      var imgs = hero.querySelectorAll('.hb img'), ring = hero.querySelector('.hero-ring');
      var qx = gsap.utils.toArray(imgs).map(function (el, i) { return gsap.quickTo(el, 'x', { duration: .9 + i * .1, ease: 'power3' }); });
      hero.addEventListener('mousemove', function (e) {
        var nx = (e.clientX / window.innerWidth - .5);
        qx.forEach(function (f, i) { f(nx * (18 + i * 8)); });
      });
    }
    // hero scroll-out
    if (hero) gsap.to(hero.querySelector('h1'), { yPercent: -18, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });

    // marquee velocity skew
    var mq = document.querySelector('.marquee-in');
    if (mq) {
      var skew = gsap.quickTo(mq, 'skewX', { duration: .5, ease: 'power3' });
      ScrollTrigger.create({ start: 0, end: 'max', onUpdate: function (self) { skew(gsap.utils.clamp(-8, 8, self.getVelocity() / -450)); } });
    }

    // THE WHEEL — pinned four-season story
    var wheel = document.querySelector('.wheel');
    if (wheel) {
      var stage = wheel.querySelector('.wheel-stage'), panels = gsap.utils.toArray('.wp'), dots = gsap.utils.toArray('.wheel-dots li'), dial = wheel.querySelector('.wheel-dial');
      var tones = [
        { bg: '#f2d4da', fg: '#3a1c27' }, { bg: '#f4b942', fg: '#3b2504' },
        { bg: '#b4511f', fg: '#fbeedd' }, { bg: '#1d2f48', fg: '#e8f0fa' }
      ];
      gsap.set(stage, { backgroundColor: tones[0].bg, color: tones[0].fg });
      gsap.set(panels.slice(1), { autoAlpha: 0 });
      dots[0] && dots[0].classList.add('on');
      var tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: wheel, start: 'top top', end: '+=320%', pin: true, scrub: .7, anticipatePin: 1,
          snap: { snapTo: 'labels', duration: { min: .25, max: .7 }, delay: .05, ease: 'power2.inOut' } }
      });
      tl.addLabel('s0', 0);
      for (var i = 1; i < panels.length; i++) {
        (function (i) {
          var at = i - .7;
          tl.to(stage, { backgroundColor: tones[i].bg, color: tones[i].fg, duration: .7, ease: 'power1.inOut' }, at)
            .to(panels[i - 1], { autoAlpha: 0, y: -60, duration: .35, ease: 'power2.in' }, at)
            .fromTo(panels[i], { autoAlpha: 0, y: 60 }, { autoAlpha: 1, y: 0, duration: .45, ease: 'power2.out' }, at + .3)
            .fromTo(panels[i].querySelector('.wp-visual img'), { rotate: 8 }, { rotate: 0, duration: .7 }, at)
            .to(dial, { rotation: -90 * i, duration: .7, ease: 'power2.inOut' }, at)
            .call(function () { dots.forEach(function (d, k) { d.classList.toggle('on', k === i); }); }, null, at + .35)
            .addLabel('s' + i, i);
        })(i);
      }
      // reverse-direction dot sync
      ScrollTrigger.create({ trigger: wheel, start: 'top top', end: '+=320%', onUpdate: function (self) {
        var idx = Math.min(panels.length - 1, Math.round(self.progress * (panels.length - 1)));
        dots.forEach(function (d, k) { d.classList.toggle('on', k === idx); });
      } });
    }

    // CHAPTERS
    gsap.utils.toArray('.chapter').forEach(function (ch) {
      var fx = ch.querySelector('.fx'), img = ch.querySelector('.bottle-wrap img');
      if (img) gsap.fromTo(img, { yPercent: 10, rotate: -3 }, { yPercent: -10, rotate: 3, ease: 'none', scrollTrigger: { trigger: ch, start: 'top bottom', end: 'bottom top', scrub: .8 } });
      var words = Array.prototype.concat.apply([], Array.prototype.slice.call(ch.querySelectorAll('[data-split]')).map(splitWords));
      if (words.length) gsap.from(words, { yPercent: 115, rotate: 3, duration: 1.2, ease: 'expo.out', stagger: .08, scrollTrigger: { trigger: ch, start: 'top 65%', once: true } });
      if (ch.classList.contains('c-spring') && fx) particles(fx, { count: 20, svg: PETAL, min: .6, max: 1.5, dur: [9, 16], sway: 120 });
      if (ch.classList.contains('c-autumn') && fx) {
        particles(fx, { count: 16, svg: LEAF, min: .6, max: 1.4, dur: [8, 14], sway: 160 });
        var bw = ch.querySelector('.bigword'); if (bw) gsap.fromTo(bw, { xPercent: 0 }, { xPercent: -45, ease: 'none', scrollTrigger: { trigger: ch, start: 'top bottom', end: 'bottom top', scrub: true } });
      }
      if (ch.classList.contains('c-winter') && fx) {
        particles(fx, { count: 46, svg: FLAKE, min: .5, max: 1.3, dur: [10, 20], sway: 50 });
        var fr = ch.querySelector('.frost'); if (fr) gsap.fromTo(fr, { scale: .4 }, { scale: 1.15, ease: 'none', scrollTrigger: { trigger: ch, start: 'top bottom', end: 'center center', scrub: true } });
      }
      if (ch.classList.contains('c-summer')) {
        var sun = ch.querySelector('.sun'), rays = ch.querySelector('.sun-rays'), wave = ch.querySelector('.wave');
        if (sun) gsap.fromTo(sun, { scale: .55, yPercent: 40 }, { scale: 1.05, yPercent: 0, ease: 'none', scrollTrigger: { trigger: ch, start: 'top bottom', end: 'center center', scrub: true } });
        if (rays) gsap.to(rays, { rotation: 360, duration: 60, ease: 'none', repeat: -1 });
        if (wave) gsap.to(wave, { xPercent: -50, duration: 9, ease: 'none', repeat: -1 });
      }
    });

    // inner-page season hero effects
    var sh = document.querySelector('.season-hero');
    if (sh) {
      var sfx = sh.querySelector('.fx'), kind = sh.dataset.season;
      if (sfx && kind === 'spring') particles(sfx, { count: 20, svg: PETAL, min: .6, max: 1.5, dur: [9, 16], sway: 120 });
      if (sfx && kind === 'autumn') particles(sfx, { count: 16, svg: LEAF, min: .6, max: 1.4, dur: [8, 14], sway: 160 });
      if (sfx && kind === 'winter') particles(sfx, { count: 46, svg: FLAKE, min: .5, max: 1.3, dur: [10, 20], sway: 50 });
      var ssun = sh.querySelector('.sun'), srays = sh.querySelector('.sun-rays'), swave = sh.querySelector('.wave');
      if (srays) gsap.to(srays, { rotation: 360, duration: 60, ease: 'none', repeat: -1 });
      if (swave) gsap.to(swave, { xPercent: -50, duration: 9, ease: 'none', repeat: -1 });
      if (ssun) gsap.fromTo(ssun, { scale: .6 }, { scale: 1, duration: 2, ease: 'expo.out', delay: 1.6 });
      var fr2 = sh.querySelector('.frost'); if (fr2) gsap.fromTo(fr2, { scale: .5 }, { scale: 1, duration: 2.2, ease: 'expo.out', delay: 1.4 });
      var sbottle = sh.querySelector('.bottle-wrap img');
      if (sbottle) { gsap.to(sbottle, { y: -14, duration: 3, ease: 'sine.inOut', yoyo: true, repeat: -1 }); gsap.to(sbottle, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: sh, start: 'top top', end: 'bottom top', scrub: true } }); }
    }

    // 404 snow
    var nfx = document.querySelector('.nf .fx');
    if (nfx) particles(nfx, { count: 46, svg: FLAKE, min: .5, max: 1.3, dur: [10, 20], sway: 50 });

    // METHOD — horizontal pinned scroll (desktop)
    var method = document.querySelector('.method');
    if (method && window.matchMedia('(min-width: 992px)').matches) {
      var track = method.querySelector('.method-track');
      var dist = function () { return Math.max(0, track.scrollWidth - document.documentElement.clientWidth); };
      gsap.to(track, { x: function () { return -dist(); }, ease: 'none', scrollTrigger: { trigger: method, start: 'top top', end: function () { return '+=' + dist(); }, pin: true, scrub: .8, invalidateOnRefresh: true, anticipatePin: 1 } });
      gsap.to('.method-bar span', { scaleX: 1, ease: 'none', scrollTrigger: { trigger: method, start: 'top top', end: function () { return '+=' + dist(); }, scrub: true, invalidateOnRefresh: true } });
    } else if (method) { gsap.to('.method-bar span', { scaleX: 1 }); }

    // season-page meters + pyramid
    gsap.utils.toArray('.meter .bar i').forEach(function (b) {
      gsap.fromTo(b, { scaleX: 0 }, { scaleX: 1, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: b, start: 'top 90%', once: true } });
    });

    // generic reveals — created last so every pin above is already measured
    ScrollTrigger.batch('[data-reveal]', {
      start: 'top 88%', once: true,
      onEnter: function (els) { gsap.to(els, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: .09, overwrite: true }); }
    });
    gsap.utils.toArray('[data-split]:not([data-hero] [data-split])').forEach(function (el) {
      if (el.closest('.chapter')) return;
      var words = splitWords(el);
      if (words.length) gsap.from(words, { yPercent: 115, rotate: 3, duration: 1.2, ease: 'expo.out', stagger: .06, scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
    });
    ScrollTrigger.refresh();
  });

  // reduced motion: show everything immediately
  mm.add('(prefers-reduced-motion: reduce)', function () {
    gsap.set('[data-reveal]', { opacity: 1, y: 0, clearProps: 'all' });
  });

  /* ---------- finder (live thing) ---------- */
  var FIND = {
    spring: { name: 'Éveil', tag: 'Pear blossom, green tea, white musk', copy: 'Cool light and open windows. A first-warm-day scent that smells like the garden before anyone is awake.', bg: '#f2d4da', fg: '#3a1c27', url: 'spring.html', img: 'assets/img/bottle-spring.svg', alt: 'Éveil spring eau de parfum bottle in blush pink' },
    summer: { name: 'Zénith', tag: 'Blood orange, sea salt, driftwood', copy: 'Salt on the skin and long bright afternoons. Citrus up front, warm frangipani underneath.', bg: '#f4b942', fg: '#3b2504', url: 'summer.html', img: 'assets/img/bottle-summer.svg', alt: 'Zénith summer eau de parfum bottle in sun gold' },
    autumn: { name: 'Récolte', tag: 'Cardamom, fig leaf, amber', copy: 'Woodsmoke, spiced fruit and slow evenings. Rich enough to wear with a wool coat.', bg: '#b4511f', fg: '#fbeedd', url: 'autumn.html', img: 'assets/img/bottle-autumn.svg', alt: 'Récolte autumn eau de parfum bottle in burnt amber' },
    winter: { name: 'Givre', tag: 'Juniper, iris, white cedar', copy: 'Clear air and fresh snow. Cold, clean and quietly luminous, with a soft incense glow.', bg: '#1d2f48', fg: '#e8f0fa', url: 'winter.html', img: 'assets/img/bottle-winter.svg', alt: 'Givre winter eau de parfum bottle in frost blue' }
  };
  $(document).on('click', '.chip', function () {
    var k = $(this).data('pick'), d = FIND[k]; if (!d) return;
    $('.chip').attr('aria-pressed', 'false'); $(this).attr('aria-pressed', 'true');
    var $r = $('.result');
    var swap = function () {
      $r.css({ backgroundColor: d.bg, color: d.fg });
      $r.find('img').attr({ src: d.img, alt: d.alt });
      $r.find('h3').text(d.name); $r.find('.rt').text(d.tag); $r.find('.rc').text(d.copy);
      $r.find('a').attr('href', d.url).text('Discover ' + d.name);
      if (window.gsap) gsap.fromTo($r.children(), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: .7, ease: 'expo.out', stagger: .08 });
    };
    if (window.gsap && !reduce) gsap.to($r.children(), { autoAlpha: 0, y: -16, duration: .25, ease: 'power2.in', onComplete: swap }); else swap();
    if (window.gtag) gtag('event', 'finder_pick', { season: k });
  });

  /* ---------- custom cursor ---------- */
  var cur = document.querySelector('.cursor');
  if (cur && window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reduce) {
    var cx = gsap.quickTo(cur, 'x', { duration: .25, ease: 'power3' }), cy = gsap.quickTo(cur, 'y', { duration: .25, ease: 'power3' });
    window.addEventListener('mousemove', function (e) { cur.classList.add('on'); cx(e.clientX); cy(e.clientY); }, { passive: true });
    document.addEventListener('mouseleave', function () { cur.classList.remove('on'); });
    $(document).on('mouseenter', 'a, button, .chip, .accordion-button', function () { cur.classList.add('big'); }).on('mouseleave', 'a, button, .chip, .accordion-button', function () { cur.classList.remove('big'); });
  }

  /* ---------- menu helpers ---------- */
  function closeMenu() {
    var el = document.getElementById('menu');
    if (el && window.bootstrap) { var inst = bootstrap.Offcanvas.getInstance(el); if (inst) inst.hide(); }
  }
  var menuEl = document.getElementById('menu');
  if (menuEl) {
    menuEl.addEventListener('show.bs.offcanvas', function () {
      document.body.classList.add('menu-open'); if (lenis) lenis.stop();
      $('.menu-btn').attr('aria-expanded', 'true');
      gsap.fromTo(menuEl.querySelectorAll('.big, .meta'), { y: 50, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .9, ease: 'expo.out', stagger: .07, delay: .15 });
    });
    menuEl.addEventListener('hidden.bs.offcanvas', function () {
      document.body.classList.remove('menu-open'); if (lenis) lenis.start();
      $('.menu-btn').attr('aria-expanded', 'false');
    });
  }

  /* ---------- tap-to-top + sticky CTA hook for scroll ---------- */
  window.__qScrollTo = scrollToTarget;
  initUI(scrollToTarget);
  startCurtain();

  /* ====================================================================== */
  function initUI(scrollTo) {
    /* back to top */
    var $top = $('.to-top'), $sticky = $('.sticky-cta');
    function onScroll() {
      var y = window.pageYOffset || document.documentElement.scrollTop;
      $top.toggleClass('show', y > 700);
      $sticky.toggleClass('show', y > 320);
    }
    $(window).on('scroll', onScroll); onScroll();
    $top.on('click', function () { if (scrollTo) scrollTo(0, { duration: 1.6 }); else window.scrollTo({ top: 0, behavior: 'smooth' }); });

    /* cookie banner + consented analytics */
    var consent = null; try { consent = localStorage.getItem('qt-consent'); } catch (e) {}
    if (consent === 'yes') loadGA();
    if (!consent) setTimeout(function () { $('.cookie').fadeIn(350); }, 3500);
    $('.cookie [data-consent]').on('click', function () {
      var v = $(this).data('consent'); try { localStorage.setItem('qt-consent', v); } catch (e) {}
      $('.cookie').fadeOut(250); if (v === 'yes') loadGA();
    });

    /* contact form → opens the visitor's mail client (no backend needed) */
    $('#contact-form').on('submit', function (e) {
      e.preventDefault();
      var f = this, d = {}; $(f).serializeArray().forEach(function (x) { d[x.name] = x.value; });
      var body = 'Name: ' + d.name + '\nPhone: ' + (d.phone || '-') + '\nInterested in: ' + d.interest + '\n\n' + d.message;
      window.location.href = 'mailto:hello@quatrea.example?subject=' + encodeURIComponent('Scent consult — ' + d.name) + '&body=' + encodeURIComponent(body);
      $('.form-ok').slideDown(200);
      if (window.gtag) gtag('event', 'generate_lead', { method: 'contact_form' });
    });

    /* analytics events for CTAs (only fire if consent loaded gtag) */
    $(document).on('click', '[data-ga]', function () { if (window.gtag) gtag('event', 'cta_click', { label: $(this).data('ga') }); });

    $('.yr').text(new Date().getFullYear());
  }

  function loadGA() {
    if (window.__gaLoaded || GA_ID.indexOf('XXXX') > -1) return;
    window.__gaLoaded = true;
    var s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID; document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    gtag('js', new Date()); gtag('config', GA_ID, { anonymize_ip: true });
  }
})(window.jQuery);
