/* Research pages
   1. YouTube card: thumbnail with a play button; the player opens large in a lightbox and loads only on click.
   2. Split fitting: text-beside-media blocks get the column ratio that makes text and media end at the same height.
   3. Puzzle packing: tiles keep their natural height and are packed into the 12-column grid (masonry), so short tiles
      no longer stretch to match tall neighbours. Without JS the plain grid still works. */
(() => {
  'use strict';
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- 1. YouTube lightbox ---------- */
  const dialog = document.querySelector('.dz-yt-dialog');
  if (dialog) {
    const frame = dialog.querySelector('.frame');
    $$('[data-youtube]').forEach(btn => btn.addEventListener('click', () => {
      const id = encodeURIComponent(btn.dataset.youtube);
      frame.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1" title="${btn.getAttribute('aria-label') || 'Research video'}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
      dialog.showModal();
    }));
    dialog.querySelector('.close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener('close', () => { frame.innerHTML = ''; });
  }

  /* ---------- 2. Split fitting ---------- */
  const wide = () => window.innerWidth > 760;
  function fit(el) {
    const text = el.querySelector(':scope > .dz-text, :scope > .dz-gist');
    const media = el.querySelector(':scope > .dz-media-col, :scope > .dz-lead-media');
    if (!text || !media) return;
    if (!wide()) { el.style.removeProperty('--mfr'); return; }
    const lo0 = parseFloat(el.dataset.fitMin || 0.55), hi0 = parseFloat(el.dataset.fitMax || 2.4);
    let lo = lo0, hi = hi0;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      el.style.setProperty('--mfr', mid + 'fr');
      const d = media.getBoundingClientRect().height - text.getBoundingClientRect().height;
      if (Math.abs(d) < 4) break;
      if (d > 0) hi = mid; else lo = mid;
    }
  }

  /* ---------- 3. Puzzle packing ----------
     Two tracks: a wide one (7/12) and a narrow one (5/12). Each tile goes into whichever track is currently shorter
     (respecting its preferred width when the tracks are nearly level); full-width tiles wait until both tracks are level,
     with later tiles pulled forward to fill the shorter track. Result: columns end together, no holes. */
  const grid = document.querySelector('.dz-grid');
  const GAP = 16;
  function spanOf(t) { const m = (t.style.gridColumn || '').match(/span (\d+)/) || t.className.match(/\bc(\d+)\b/); return m ? +m[1] : 6; }
  function heightAt(t, w) { t.style.width = w + 'px'; if (t.classList.contains('split') && !t.classList.contains('unsplit')) fit(t); return t.getBoundingClientRect().height; }
  function pack() {
    if (!grid) return;
    const tiles = $$(':scope > .dz-tile', grid);
    const reset = () => { grid.classList.remove('is-packed'); grid.style.height = ''; tiles.forEach(t => { t.style.left = t.style.top = t.style.width = ''; }); };
    if (!wide()) { reset(); return; }
    if (tiles.every(t => spanOf(t) === 4)) { reset(); grid.style.alignItems = 'stretch'; return; }
    grid.classList.add('is-packed');
    const W = grid.clientWidth, wN = Math.round((W - GAP) * 5 / 12), wW = W - GAP - wN;
    const X = [0, wW + GAP], WD = [wW, wN];
    const isFull = t => spanOf(t) >= 12 && !(t.classList.contains('unsplit') && t.style.gridColumn);
    const prefers = t => { if (t.dataset.track) return t.dataset.track === 'wide' ? 0 : 1; const s = spanOf(t); return s >= 7 ? 0 : s <= 5 ? 1 : -1; };
    // split the page into segments of half-width tiles separated by full-width tiles
    const segs = [[]];
    tiles.forEach(t => { if (isFull(t)) segs.push(t, []); else segs[segs.length - 1].push(t); });
    let y = 0;
    for (const seg of segs) {
      if (!Array.isArray(seg)) { const h = heightAt(seg, W); seg.style.left = '0px'; seg.style.top = y + 'px'; y += h + GAP; continue; }
      if (!seg.length) continue;
      if (seg.length === 1) { const t = seg[0]; if (t.classList.contains('unsplit') && t.hasAttribute('data-fit')) { t.classList.remove('unsplit'); t.style.gridColumn = ''; } t.style.width = W + 'px'; if (t.classList.contains('split') && !t.classList.contains('unsplit')) fit(t); const h = t.getBoundingClientRect().height; t.style.left = '0px'; t.style.top = y + 'px'; y += h + GAP; continue; }   // a lone half-width tile takes the full width
      // Each band picks its own column ratio so both columns end level (figures stay full-bleed, no holes).
      const RATIOS = [0.40, 0.50, 0.5833, 0.68];
      const widthsAt = r => { const l = Math.round((W - GAP) * r); return [l, W - GAP - l]; };
      const HS = seg.map(t => RATIOS.map(r => { const [l, rr] = widthsAt(r); return [heightAt(t, l), heightAt(t, rr)]; }));
      const P = seg.map(prefers);
      const F = seg.map(t => t.dataset.track ? 1 : 0);   // tiles pinned to a column
      const rAt = e => RATIOS[e.j] + e.f * ((RATIOS[e.j + 1] || RATIOS[e.j]) - RATIOS[e.j]);
      // level height of tiles [a, b) under a mask: interpolate the ratio where the two column sums cross
      const evalMask = (a, b, mask) => {
        const m = b - a;
        const sums = RATIOS.map((r, j) => { const h = [0, 0]; for (let i = 0; i < m; i++) { const k = (mask >> i) & 1; h[k] += HS[a + i][j][k] + GAP; } return h; });
        let best = null;
        for (let j = 0; j < RATIOS.length; j++) { const [x, z] = sums[j]; const s = Math.max(x, z) + Math.abs(x - z) * 0.8; if (!best || s < best.s) best = { s, j, f: 0 }; }
        for (let j = 0; j + 1 < RATIOS.length; j++) {
          const d0 = sums[j][0] - sums[j][1], d1 = sums[j + 1][0] - sums[j + 1][1];
          if (d0 === 0 || (d0 < 0) !== (d1 < 0)) { const f = d0 === d1 ? 0 : d0 / (d0 - d1); const s = sums[j][0] + (sums[j + 1][0] - sums[j][0]) * f; if (s < best.s) best = { s, j, f }; }
        }
        const r = rAt(best); best.r = r;
        best.s *= 1 + 3 * Math.max(0, Math.abs(r - 0.55) - 0.07);   // keep column ratios moderate
        return best;
      };
      const groupCost = (a, b) => {       // best mask for tiles [a, b)
        const m = b - a; let best = null;
        for (let mask = 0; mask < (1 << m); mask++) {
          if (mask === 0 || mask === (1 << m) - 1) continue;           // both columns used
          const e = evalMask(a, b, mask); let pen = 0, prevTop = -1; const h = [0, 0];
          for (let i = 0; i < m; i++) {
            const k = (mask >> i) & 1, top = h[k], gi = a + i;
            if (top < prevTop - 40) pen += (prevTop - top) * 0.35;   // a later section starting above an earlier one
            if (i === 0 && k !== 0) pen += 30;                       // a band reads from the left
            prevTop = top; h[k] += HS[gi][2][k] + GAP;
            if (P[gi] >= 0 && P[gi] !== k) pen += F[gi] ? 1e6 : 25;
          }
          const sc = e.s + pen;
          if (!best || sc < best.sc) best = { sc, mask, r: e.r };
        }
        return best;
      };
      // split the segment into consecutive bands (two or more tiles each), each with its own ratio
      const n = seg.length, MAXB = 9;
      const D = Array(n + 1).fill(Infinity), cut = Array(n + 1).fill(-1), pick = Array(n + 1).fill(null);
      D[0] = 0;
      for (let b2 = 2; b2 <= n; b2++) for (let a2 = Math.max(0, b2 - MAXB); a2 <= b2 - 2; a2++) {
        if (D[a2] === Infinity) continue;
        const g = groupCost(a2, b2); if (!g) continue;
        const c = D[a2] + g.sc + 40;                                  // small cost per extra band
        if (c < D[b2]) { D[b2] = c; cut[b2] = a2; pick[b2] = g; }
      }
      const bands = []; for (let e = n; e > 0; e = cut[e]) bands.unshift([cut[e], e, pick[e]]);
      for (const [a2, b2, g] of bands) {
        const tl = seg.slice(a2, b2), mask = g.mask;
        const colH = r => { const wd = widthsAt(r); const h = [0, 0]; tl.forEach((t, i) => { const k = (mask >> i) & 1; h[k] += heightAt(t, wd[k]) + GAP; }); return h; };
        let lo = Math.max(RATIOS[0], g.r - 0.12), hi = Math.min(RATIOS[RATIOS.length - 1], g.r + 0.12), r = g.r;
        const dLo = (c => c[0] - c[1])(colH(lo)), dHi = (c => c[0] - c[1])(colH(hi));
        if ((dLo < 0) !== (dHi < 0)) {
          for (let it = 0; it < 9; it++) { r = (lo + hi) / 2; const c = colH(r); if (Math.abs(c[0] - c[1]) < 6) break; if ((c[0] - c[1] < 0) === (dLo < 0)) lo = r; else hi = r; }
        }
        const wd = widthsAt(r), xs = [0, wd[0] + GAP];
        const h = [y, y];
        tl.forEach((t, i) => { const k = (mask >> i) & 1; const hh = heightAt(t, wd[k]); t.style.left = xs[k] + 'px'; t.style.top = h[k] + 'px'; h[k] += hh + GAP; });
        y = Math.max(h[0], h[1]);
      }
      continue;
      y = Math.max(h[0], h[1]);
    }
    grid.style.height = (y - GAP) + 'px';
  }

  /* A split whose two sides cannot be balanced becomes a stacked tile:
     - media far taller than the text (portrait figures) → a narrower column tile, so neighbours pack beside it;
     - text far taller than the media (wide, short figures) → full width with the figure under the text. */
  function rebalance(el) {
    if (!el.classList.contains('dz-tile')) return;
    const text = el.querySelector(':scope > .dz-text'), media = el.querySelector(':scope > .dz-media-col');
    el.classList.remove('unsplit'); el.style.gridColumn = '';
    if (!wide() || !text || !media) return;
    fit(el);
    const th = text.getBoundingClientRect().height, mh = media.getBoundingClientRect().height;
    if (mh > th * 1.3 + 40) {
      const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
      el.classList.add('unsplit'); el.style.gridColumn = 'span ' + Math.max(1, Math.round(cols * 5 / 12));
    } else if (th > mh * 1.45 + 40) {
      el.classList.add('unsplit');
    }
  }
  function layout() {
    $$('.dz-lead[data-fit]').forEach(fit);
    if (grid) { grid.classList.remove('is-packed'); $$(':scope > .dz-tile', grid).forEach(t => { t.style.width = ''; }); }
    $$('.dz-grid [data-fit]').forEach(rebalance);
    pack();
  }
  let pending = 0;
  const schedule = () => { cancelAnimationFrame(pending); pending = requestAnimationFrame(layout); };
  layout();
  window.addEventListener('resize', schedule);
  window.addEventListener('load', schedule);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  $$('.dz-grid img, .dz-lead img').forEach(img => { if (!img.complete) img.addEventListener('load', schedule, { once: true }); });
})();
