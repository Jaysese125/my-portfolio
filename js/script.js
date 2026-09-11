/* ═══════════════════════════════════════════════════════════════
   CJS INTERACTION LAYER — v8

   FIX FOR THE CLICK FREEZE:

   Rapid anchor clicks were firing overlapping
   `scrollIntoView({ behavior: "smooth" })` calls. Chromium runs
   those scrolls on the compositor thread; when a second smooth
   scroll starts before the first finishes, the compositor's
   hit-test tree can fall out of sync with the visual tree. The
   symptom is exactly what you described: wheel scroll keeps
   working (different code path) but pointer events — hover,
   click — resolve against stale coordinates, so the rail never
   expands and nothing responds.

   Two changes fix it:

   1. CANCEL the in-flight smooth scroll before starting a new one.
      `window.scrollTo(0, window.scrollY)` performs an instant
      write at the current position, which halts any smooth scroll
      animation in Chromium. Then the new scrollIntoView starts
      from a clean state.

   2. REPAIR the hit-test tree once after navigation settles.
      Toggling `body.style.pointerEvents` off and back on forces
      Chromium to rebuild its hit-test tree. It happens in a single
      frame — no visual flash, no layout thrash.
   ═══════════════════════════════════════════════════════════════ */

(() => {
    "use strict";

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = document.documentElement;

    /* ═══════════════════════════════════════════════════════
       0. HIT-TEST REPAIR
       ═══════════════════════════════════════════════════════ */

    function repairHitTest() {
        const b = document.body;
        if (!b) return;
        // Toggle pointer-events off and back on. Reading offsetHeight
        // in between forces a synchronous layout, which causes
        // Chromium to rebuild its hit-test tree from the fresh
        // layout. The user never sees a change — this happens
        // within a single frame.
        b.style.pointerEvents = "none";
        void b.offsetHeight;
        b.style.pointerEvents = "";
    }

    let repairTimer = null;
    function scheduleRepair(delay) {
        if (repairTimer) clearTimeout(repairTimer);
        repairTimer = setTimeout(() => {
            repairTimer = null;
            repairHitTest();
        }, typeof delay === "number" ? delay : 400);
    }

    /* ═══════════════════════════════════════════════════════
       1. BOOT LOADER
       ═══════════════════════════════════════════════════════ */

    (function bootLoader() {
        const bootEl = document.getElementById("arkBoot");
        if (!bootEl) return;
        if (prefersReduced) { bootEl.remove(); return; }

        const logEl = document.getElementById("bootLog");
        const barEl = document.getElementById("bootBar");
        const counterEl = document.getElementById("bootCounter");
        if (!logEl || !barEl || !counterEl) { bootEl.remove(); return; }

        root.classList.add("ark-no-scroll");

        setTimeout(() => {
            const b = document.getElementById("arkBoot");
            if (b) {
                b.classList.add("is-dead");
                b.remove();
            }
            root.classList.remove("ark-no-scroll");
        }, 4000);

        const logs = [
            "INITIALIZING CORE",
            "LOADING INTERFACE",
            "ESTABLISHING LINK",
            "CALIBRATING SENSORS",
            "SYSTEM READY"
        ];

        logs.forEach((text, i) => {
            setTimeout(() => {
                const line = document.createElement("div");
                line.className = "ark-boot-log-line";
                line.textContent = text;
                logEl.appendChild(line);
                requestAnimationFrame(() => line.classList.add("is-visible"));
            }, 220 + i * 220);
        });

        const start = performance.now();
        const duration = 1300;

        function tick(now) {
            const t = Math.min((now - start) / duration, 1);
            barEl.style.transform = `scaleX(${t})`;
            counterEl.textContent = String(Math.floor(t * 100)).padStart(2, "0");
            if (t < 1) requestAnimationFrame(tick);
            else setTimeout(finish, 250);
        }

        function finish() {
            bootEl.classList.add("is-revealing");
            root.classList.remove("ark-no-scroll");
            setTimeout(() => {
                bootEl.classList.add("is-dead");
                bootEl.remove();
            }, 1100);
        }

        requestAnimationFrame(tick);
    })();

    /* ═══════════════════════════════════════════════════════
       2. PALETTE TOGGLE
       ═══════════════════════════════════════════════════════ */

    (function paletteToggle() {
        const toggle = document.getElementById("paletteToggle");
        const label = document.getElementById("paletteLabel");
        if (!toggle || !label) return;

        const STORAGE_KEY = "jayfield-palette";
        const PALETTES = { ember: "EMBER", tidal: "TIDAL" };

        function applyPalette(name) {
            const safe = PALETTES[name] ? name : "ember";
            root.setAttribute("data-palette", safe);
            label.textContent = PALETTES[safe];
            toggle.setAttribute("aria-label", `Toggle accent palette (currently ${PALETTES[safe]})`);
        }

        let saved = "ember";
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored && PALETTES[stored]) saved = stored;
        } catch (_) {}

        applyPalette(saved);

        toggle.addEventListener("click", () => {
            const current = root.getAttribute("data-palette") || "ember";
            const next = current === "ember" ? "tidal" : "ember";
            applyPalette(next);
            try { localStorage.setItem(STORAGE_KEY, next); } catch (_) {}
        });
    })();

    /* ═══════════════════════════════════════════════════════
       3. SCROLL SPY + REVEAL
       ═══════════════════════════════════════════════════════ */

    const panels = Array.from(document.querySelectorAll(".ark-section"));
    const navLinks = Array.from(document.querySelectorAll(".ark-rail-link"));

    let currentSectionId = null;

    function setActiveSection(id) {
        if (id === currentSectionId) return;
        currentSectionId = id;
        panels.forEach((panel) => {
            panel.classList.toggle("is-active", panel.id === id);
        });
        navLinks.forEach((link) => {
            link.classList.toggle("active", link.getAttribute("href") === `#${id}`);
        });
    }

    if ("IntersectionObserver" in window) {
        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("is-revealed");
                    revealObserver.unobserve(entry.target);
                }
            });
        }, { rootMargin: "0px 0px -15% 0px", threshold: 0 });

        panels.forEach((panel) => revealObserver.observe(panel));
    } else {
        panels.forEach((p) => p.classList.add("is-revealed", "is-active"));
    }

    let spyTicking = false;

    function updateActiveFromScroll() {
        spyTicking = false;
        const probeLine = window.innerHeight * 0.42;
        let activeId = panels[0] ? panels[0].id : null;

        for (let i = 0; i < panels.length; i++) {
            const rect = panels[i].getBoundingClientRect();
            if (rect.top <= probeLine) activeId = panels[i].id;
            else break;
        }

        if (activeId) setActiveSection(activeId);
    }

    function onScroll() {
        if (!spyTicking) {
            spyTicking = true;
            requestAnimationFrame(updateActiveFromScroll);
        }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    updateActiveFromScroll();

    /* ═══════════════════════════════════════════════════════
       4. RAIL — EXPANDS ON HOVER
       ═══════════════════════════════════════════════════════ */

    const railEl = document.getElementById("arkRail");

    (function railControl() {
        const rail = railEl;
        if (!rail) return;

        let closeTimer = null;

        function forceClose() {
            if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
            rail.classList.remove("is-open");
        }

        function open() {
            if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
            rail.classList.add("is-open");
        }

        function railContainsFocus() {
            const ae = document.activeElement;
            if (!ae || !rail.contains(ae)) return false;
            try { return ae.matches(":focus-visible"); }
            catch (_) { return true; }
        }

        function scheduleClose(delay) {
            if (closeTimer) clearTimeout(closeTimer);
            closeTimer = setTimeout(() => {
                closeTimer = null;
                if (!rail.matches(":hover") && !railContainsFocus()) {
                    rail.classList.remove("is-open");
                }
            }, typeof delay === "number" ? delay : 80);
        }

        rail.addEventListener("pointerenter", open);
        rail.addEventListener("pointerleave", () => scheduleClose(80));

        rail.addEventListener("focusin", (e) => {
            if (e.target && e.target.matches && e.target.matches(":focus-visible")) open();
        });
        rail.addEventListener("focusout", () => {
            setTimeout(() => {
                if (!railContainsFocus()) scheduleClose(0);
            }, 0);
        });

        document.addEventListener("click", (e) => {
            if (!rail.contains(e.target)) forceClose();
        }, true);

        document.addEventListener("visibilitychange", () => {
            if (document.hidden) forceClose();
        });
    })();

    /* ═══════════════════════════════════════════════════════
       5. NAVIGATION
       Cancel any in-flight smooth scroll before starting a new
       one, then repair the hit-test tree after the new scroll
       settles.
       ═══════════════════════════════════════════════════════ */

    document.querySelectorAll('a[href^="#"]').forEach((link) => {
        link.addEventListener("click", (e) => {
            const href = link.getAttribute("href");
            if (!href || href === "#") return;
            const id = href.slice(1);
            const target = document.getElementById(id);
            if (!target) return;

            e.preventDefault();
            try { link.blur(); } catch (_) {}
            if (railEl) railEl.classList.remove("is-open");

            try { history.replaceState(null, "", `#${id}`); } catch (_) {}

            // ── CRITICAL: cancel any in-flight smooth scroll ──
            // Writing the current scroll position performs an
            // instant scroll at the current location, which halts
            // any Chromium smooth-scroll animation still running.
            // The user sees no jump — we're writing the exact
            // position they're already at.
            if (!prefersReduced) {
                window.scrollTo(0, window.scrollY);
            }

            target.scrollIntoView({
                behavior: prefersReduced ? "auto" : "smooth",
                block: "start"
            });

            // After the new scroll settles, repair the hit-test
            // tree once. Debounced: if another nav happens before
            // the timer fires, the timer resets.
            scheduleRepair(400);

            if (link.classList.contains("ark-skip-link")) {
                target.setAttribute("tabindex", "-1");
                try { target.focus({ preventScroll: true }); } catch (_) {}
            }
        });

        link.addEventListener("mousedown", () => {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0 && !sel.isCollapsed) sel.removeAllRanges();
        });
    });

    /* ═══════════════════════════════════════════════════════
       6. KEYBOARD SECTION NAV
       ═══════════════════════════════════════════════════════ */

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            if (document.activeElement && document.activeElement.blur) {
                document.activeElement.blur();
            }
            if (railEl) railEl.classList.remove("is-open");
            return;
        }

        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const tag = (e.target.tagName || "").toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select") return;

        const prevKeys = ["ArrowUp", "PageUp"];
        const nextKeys = ["ArrowDown", "PageDown"];
        if (!prevKeys.includes(e.key) && !nextKeys.includes(e.key)) return;

        const activeIdx = panels.findIndex((p) => p.classList.contains("is-active"));
        const current = activeIdx === -1 ? 0 : activeIdx;
        const currentPanel = panels[current];
        if (currentPanel && currentPanel.scrollHeight > window.innerHeight + 4) return;

        const dir = prevKeys.includes(e.key) ? -1 : 1;
        const next = Math.max(0, Math.min(panels.length - 1, current + dir));
        const target = panels[next];
        if (!target) return;

        e.preventDefault();
        if (!prefersReduced) window.scrollTo(0, window.scrollY);
        target.scrollIntoView({
            behavior: prefersReduced ? "auto" : "smooth",
            block: "start"
        });
        scheduleRepair(400);
    });

    /* ═══════════════════════════════════════════════════════
       7. DYNAMIC YEAR
       ═══════════════════════════════════════════════════════ */

    const year = String(new Date().getFullYear());
    document.querySelectorAll(".js-year").forEach((el) => {
        el.textContent = year;
    });

    /* ═══════════════════════════════════════════════════════
       8. LIVE CLOCK + DATE
       ═══════════════════════════════════════════════════════ */

    const clockEl = document.getElementById("liveClock");
    const dateEl = document.getElementById("liveDate");

    const pad = (n) => String(n).padStart(2, "0");
    const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN",
                    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

    const tzAbbr = (() => {
        try {
            const parts = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" })
                .formatToParts(new Date());
            const tz = parts.find((p) => p.type === "timeZoneName");
            return tz ? tz.value : "";
        } catch (_) { return ""; }
    })();

    function tickClock() {
        const d = new Date();
        if (clockEl) {
            clockEl.textContent =
                `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
                (tzAbbr ? ` ${tzAbbr}` : "");
        }
        if (dateEl) {
            dateEl.textContent =
                `${WEEKDAYS[d.getDay()]} ${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
        }
    }

    if (clockEl || dateEl) {
        tickClock();
        setInterval(tickClock, 1000);
    }

    /* ═══════════════════════════════════════════════════════
       9. MARQUEE
       ═══════════════════════════════════════════════════════ */

    (function buildMarquee() {
        const marquee = document.querySelector(".ark-marquee");
        const track = document.getElementById("marqueeTrack");
        if (!marquee || !track || prefersReduced) return;

        const originalHTML = track.innerHTML;
        const targetWidth = Math.max(window.innerWidth, 900);
        let guard = 0;
        while (track.getBoundingClientRect().width < targetWidth && guard++ < 10) {
            track.innerHTML += originalHTML;
        }

        const clone = track.cloneNode(true);
        clone.removeAttribute("id");
        clone.setAttribute("aria-hidden", "true");
        marquee.appendChild(clone);

        [track, clone].forEach((el) => { el.style.animation = "none"; });
        void marquee.offsetHeight;
        [track, clone].forEach((el) => { el.style.animation = ""; });

        const trackWidth = track.scrollWidth;
        const durationSec = Math.max(trackWidth / 60, 20);
        [track, clone].forEach((el) => {
            el.style.animationDuration = `${durationSec}s`;
        });
    })();

    /* ═══════════════════════════════════════════════════════
       10. HIT-TEST REPAIR ON TAB FOCUS
       Coming back to the tab after alt-tabbing is a common
       moment for the hit-test tree to be stale.
       ═══════════════════════════════════════════════════════ */

    window.addEventListener("focus", () => {
        scheduleRepair(50);
    });

})();