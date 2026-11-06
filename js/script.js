/* ═══════════════════════════════════════════════════════════════
   CJS INTERACTION LAYER — v16
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
        const prev = b.style.pointerEvents;
        b.style.pointerEvents = "none";
        void b.offsetHeight;
        b.style.pointerEvents = prev;
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

        const scrollbarW = window.innerWidth - document.documentElement.clientWidth;
        if (scrollbarW > 0) root.style.setProperty("--scrollbar-w", scrollbarW + "px");
        root.classList.add("ark-scroll-lock", "ark-no-scroll");

        function releaseLock() {
            root.classList.remove("ark-no-scroll", "ark-scroll-lock");
            root.style.removeProperty("--scrollbar-w");
        }

        const fallbackTimer = setTimeout(() => {
            const b = document.getElementById("arkBoot");
            if (b) {
                b.classList.add("is-dead");
                b.remove();
            }
            releaseLock();
        }, 4000);

        const logs = ["INITIALIZING CORE", "LOADING INTERFACE", "ESTABLISHING LINK", "CALIBRATING SENSORS", "SYSTEM READY"];

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
            counterEl.textContent = String(Math.round(t * 100)).padStart(2, "0");
            if (t < 1) requestAnimationFrame(tick);
            else setTimeout(finish, 250);
        }

        function finish() {
            clearTimeout(fallbackTimer);
            bootEl.classList.add("is-revealing");
            releaseLock();
            setTimeout(() => {
                bootEl.classList.add("is-dead");
                bootEl.remove();
            }, 1100);
        }

        requestAnimationFrame(tick);
    })();

    /* ═══════════════════════════════════════════════════════
       2. PALETTE TOGGLE + DYNAMIC FAVICON
       ═══════════════════════════════════════════════════════ */

    (function paletteToggle() {
        const toggle = document.getElementById("paletteToggle");
        const label = document.getElementById("paletteLabel");
        if (!toggle || !label) return;

        const STORAGE_KEY = "jayfield-palette";
        const PALETTES = { ember: "EMBER", tidal: "TIDAL" };
        const SIGNAL_HEX = { ember: "%23fff500", tidal: "%2314d0d0" };
        const faviconEl = document.querySelector("link[rel='icon']");

        function updateFavicon(name) {
            if (!faviconEl) return;
            const signal = SIGNAL_HEX[name] || SIGNAL_HEX.ember;
            faviconEl.href =
                "data:image/svg+xml," +
                "%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2032%2032'%3E" +
                "%3Crect%20x='3'%20y='3'%20width='26'%20height='26'%20fill='%23101110'%20stroke='" + signal +
                "'%20stroke-width='2.5'/%3E" +
                "%3Ctext%20x='16'%20y='23'%20font-family='monospace'%20font-size='13'%20font-weight='800'%20fill='" + signal +
                "'%20text-anchor='middle'%20textLength='20'%20lengthAdjust='spacingAndGlyphs'%3EJAY%3C/text%3E%3C/svg%3E";
        }

        function applyPalette(name) {
            const safe = PALETTES[name] ? name : "ember";
            root.setAttribute("data-palette", safe);
            label.textContent = PALETTES[safe];
            toggle.setAttribute("aria-label", `Toggle accent palette (currently ${PALETTES[safe]})`);
            updateFavicon(safe);
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
        panels.forEach((panel) => panel.classList.toggle("is-active", panel.id === id));
        navLinks.forEach((link) => link.classList.toggle("active", link.getAttribute("href") === `#${id}`));
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
        if (!railEl) return;
        let closeTimer = null;

        function forceClose() {
            if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
            railEl.classList.remove("is-open");
        }

        function open() {
            if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
            railEl.classList.add("is-open");
        }

        function railContainsFocus() {
            const ae = document.activeElement;
            if (!ae || !railEl.contains(ae)) return false;
            try { return ae.matches(":focus-visible"); } catch (_) { return true; }
        }

        function scheduleClose(delay) {
            if (closeTimer) clearTimeout(closeTimer);
            closeTimer = setTimeout(() => {
                closeTimer = null;
                if (!railEl.matches(":hover") && !railContainsFocus()) railEl.classList.remove("is-open");
            }, typeof delay === "number" ? delay : 80);
        }

        railEl.addEventListener("pointerenter", open);
        railEl.addEventListener("pointerleave", () => scheduleClose(80));
        
        railEl.addEventListener("focusin", (e) => {
            if (e.target.matches && e.target.matches(":focus-visible")) open();
        });
        
        railEl.addEventListener("focusout", () => {
            setTimeout(() => {
                if (!railContainsFocus()) scheduleClose(0);
            }, 0);
        });
        
        document.addEventListener("click", (e) => {
            if (!railEl.contains(e.target)) forceClose();
        }, true);
        
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) forceClose();
        });
    })();

    /* ═══════════════════════════════════════════════════════
       5. NAVIGATION
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

            if (!prefersReduced) window.scrollTo(0, window.scrollY);

            target.scrollIntoView({
                behavior: prefersReduced ? "auto" : "smooth",
                block: "start"
            });

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

    function stickyChromeHeight() {
        const topbar = document.querySelector(".ark-topbar");
        const marquee = document.querySelector(".ark-marquee");
        return (topbar ? topbar.offsetHeight : 0) + (marquee ? marquee.offsetHeight : 0);
    }

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
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
        
        if (currentPanel) {
            const usable = window.innerHeight - stickyChromeHeight();
            if (currentPanel.scrollHeight > usable + 4) return;
        }

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
    const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

    const tzAbbr = (() => {
        try {
            const parts = new Intl.DateTimeFormat("en-US", { timeZoneName: "short" }).formatToParts(new Date());
            const tz = parts.find((p) => p.type === "timeZoneName");
            return tz ? tz.value : "";
        } catch (_) { return ""; }
    })();

    function tickClock() {
        const d = new Date();
        if (clockEl) {
            clockEl.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` + (tzAbbr ? ` ${tzAbbr}` : "");
        }
        if (dateEl) {
            dateEl.textContent = `${WEEKDAYS[d.getDay()]} ${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
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

        const cs = getComputedStyle(track);
        const padL = parseFloat(cs.paddingLeft) || 0;
        const padR = parseFloat(cs.paddingRight) || 0;
        const contentWidth = track.scrollWidth - padL - padR;

        marquee.style.setProperty("--marquee-distance", contentWidth + "px");

        const durationSec = Math.max(contentWidth / 60, 20);
        [track, clone].forEach((el) => {
            el.style.animationDuration = `${durationSec}s`;
        });
    })();

    /* ═══════════════════════════════════════════════════════
       10. HIT-TEST REPAIR ON TAB FOCUS
       ═══════════════════════════════════════════════════════ */

    window.addEventListener("focus", () => {
        if (document.visibilityState !== "visible") return;
        scheduleRepair(50);
    });

       /* ═══════════════════════════════════════════════════════
       11. PROJECT SLIDER & ANIMATIONS
       ═══════════════════════════════════════════════════════ */

    (function projectSlider() {
        const slides = Array.from(document.querySelectorAll(".ark-project-slide"));
        const prevBtns = Array.from(document.querySelectorAll(".ark-project-global-controls .proj-prev"));
        const nextBtns = Array.from(document.querySelectorAll(".ark-project-global-controls .proj-next"));
        const currentNumEls = Array.from(document.querySelectorAll(".ark-project-global-controls .proj-current-num"));
        const progressSegments = Array.from(document.querySelectorAll(".ark-progress-segment"));
        
        const globalProjectBtn = document.getElementById("globalProjectBtn");
        const radarDecor = document.getElementById("radarDecor");
        
        if (!slides.length || !prevBtns.length || !nextBtns.length) return;

        let currentIndex = 0;
        let isAnimating = false;
        let globalRotation = 0; 
        let slowSpinAnim = null;

        // --- TYPEWRITER FUNCTION ---
        function typeWriter(element, text, speed, callback) {
            element.textContent = "";
            let i = 0;
            function type() {
                if (i < text.length) {
                    element.textContent += text.charAt(i);
                    i++;
                    setTimeout(type, speed);
                } else {
                    if (callback) callback();
                }
            }
            type();
        }

        slides.forEach(slide => {
            const title = slide.querySelector(".ark-project-title");
            const desc = slide.querySelector(".ark-project-desc");
            const tags = slide.querySelector(".ark-project-tags");
            if (title) title.dataset.original = title.textContent.trim();
            if (desc) desc.dataset.original = desc.textContent.trim();
            if (tags) tags.dataset.original = tags.textContent.trim();
        });

        // Start the continuous slow spin
        function startSlowSpin(wrapper, startAngle = 0) {
            if (!wrapper) return;
            if (slowSpinAnim) slowSpinAnim.cancel();
            
            slowSpinAnim = wrapper.animate(
                [
                    { transform: `rotateY(${startAngle}deg)` },
                    { transform: `rotateY(${startAngle + 360}deg)` }
                ],
                {
                    duration: 25000, // 25 seconds for one full rotation
                    iterations: Infinity,
                    easing: 'linear'
                }
            );
        }

        // Get the exact current angle of the board
        function getCurrentRotation(el) {
            const st = window.getComputedStyle(el);
            const tm = st.getPropertyValue("transform");
            if (tm && tm !== "none") {
                const values = tm.split('(')[1].split(')')[0].split(',');
                const m11 = parseFloat(values[0]);
                const m13 = parseFloat(values[2]);
                let angle = Math.atan2(m13, m11) * (180 / Math.PI);
                return angle < 0 ? angle + 360 : angle;
            }
            return 0;
        }

        // Initialize first slide
        const firstWrapper = slides[0].querySelector(".ark-project-img-wrapper");
        if (firstWrapper) startSlowSpin(firstWrapper, 0);

        function updateSlide(index, direction) {
            if (isAnimating) return;
            isAnimating = true;

            const currentSlide = slides[currentIndex];
            const nextSlide = slides[index];
            const currentWrapper = currentSlide.querySelector(".ark-project-img-wrapper");
            
            // 1. Radar Burst
            if (radarDecor) {
                radarDecor.classList.remove("spin-burst");
                void radarDecor.offsetWidth;
                radarDecor.classList.add("spin-burst");
            }

            // 2. Fast Double Spin Calculation
            const currentAngle = getCurrentRotation(currentWrapper);
            const spinDir = direction === 'next' ? 1 : -1;
            const targetAngle = currentAngle + (360 * 2 * spinDir); // 720 degrees!

            if (slowSpinAnim) slowSpinAnim.cancel();

            // Animate the current board spinning fast
            const fastSpin = currentWrapper.animate(
                [
                    { transform: `rotateY(${currentAngle}deg)` },
                    { transform: `rotateY(${targetAngle}deg)` }
                ],
                {
                    duration: 1200, // 1.2 seconds total for the fast spin
                    easing: 'cubic-bezier(0.4, 0, 0.2, 1)', // Smooth ease-in-out
                    fill: 'forwards'
                }
            );

            // Prepare next text
            const nextInfo = nextSlide.querySelector(".ark-project-info");
            const nextTitle = nextSlide.querySelector(".ark-project-title");
            nextInfo.classList.remove("show-text");
            nextTitle.textContent = ""; 

            // 3. THE MAGIC TRICK: Swap slides exactly at 600ms (when the board is sideways)
            setTimeout(() => {
                fastSpin.cancel(); // Stop the current animation
                const midAngle = currentAngle + (360 * spinDir); // It's currently at 360deg (sideways)
                
                // Swap DOM classes
                currentSlide.classList.remove("is-active");
                if (direction === "next") {
                    currentSlide.classList.add("is-prev");
                } else {
                    currentSlide.classList.remove("is-prev");
                }

                nextSlide.classList.remove("is-prev");
                nextSlide.classList.add("is-active");

                currentIndex = index;
                
                // Update UI
                currentNumEls.forEach(el => el.textContent = String(currentIndex + 1).padStart(2, "0"));
                progressSegments.forEach((seg, i) => seg.classList.toggle("is-active", i === currentIndex));

                if (globalProjectBtn) {
                    const newLinkEl = nextSlide.querySelector(".hidden-project-link");
                    if (newLinkEl) globalProjectBtn.href = newLinkEl.getAttribute("href");
                }

                // 4. Animate the new board for the remaining 360 degrees
                const nextWrapper = nextSlide.querySelector(".ark-project-img-wrapper");
                const secondHalfSpin = nextWrapper.animate(
                    [
                        { transform: `rotateY(${midAngle}deg)` },
                        { transform: `rotateY(${targetAngle}deg)` }
                    ],
                    {
                        duration: 600, // Remaining 0.6 seconds
                        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
                        fill: 'forwards'
                    }
                );

                // 5. When the fast spin finishes, hand it over to the slow infinite spin
                secondHalfSpin.onfinish = () => {
                    secondHalfSpin.cancel();
                    globalRotation = targetAngle % 360;
                    startSlowSpin(nextWrapper, globalRotation);
                    
                    // Trigger typewriter
                    typeWriter(nextTitle, nextTitle.dataset.original, 40, () => {
                        nextInfo.classList.add("show-text");
                        isAnimating = false;
                    });
                };

            }, 600); // 600ms is exactly halfway through the 1200ms fast spin
        }

        nextBtns.forEach(btn => btn.addEventListener("click", () => updateSlide((currentIndex + 1) % slides.length, "next")));
        prevBtns.forEach(btn => btn.addEventListener("click", () => updateSlide((currentIndex - 1 + slides.length) % slides.length, "prev")));

        // Initialize text
        const initialInfo = slides[0].querySelector(".ark-project-info");
        const initialTitle = slides[0].querySelector(".ark-project-title");
        setTimeout(() => {
            typeWriter(initialTitle, initialTitle.dataset.original, 40, () => {
                initialInfo.classList.add("show-text");
            });
        }, 500);
    })();

})();