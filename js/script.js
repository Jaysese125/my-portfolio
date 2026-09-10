/* ═══════════════════════════════════════════════════════════════
   CJS INTERACTION LAYER
   0. Boot loader
   1. Scroll-spy (rail highlight) + one-shot reveal
   2. Dynamic year
   3. Live local clock
   4. Marquee
   ═══════════════════════════════════════════════════════════════ */

(() => {
    "use strict";

    /* ---------- 0. Boot loader ---------- */

    (function bootLoader() {
        const boot = document.getElementById("arkBoot");
        if (!boot) return;

        const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (prefersReduced) { boot.remove(); return; }

        const logEl = document.getElementById("bootLog");
        const barEl = document.getElementById("bootBar");
        const counterEl = document.getElementById("bootCounter");
        if (!logEl || !barEl || !counterEl) { boot.remove(); return; }

        const logs = [
            "INITIALIZING CORE",
            "LOADING INTERFACE",
            "ESTABLISHING LINK",
            "CALIBRATING SENSORS",
            "SYSTEM READY"
        ];

        document.body.style.overflow = "hidden";

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
            else finish();
        }
        requestAnimationFrame(tick);

        function finish() {
            setTimeout(() => {
                boot.classList.add("is-revealing");
                document.body.style.overflow = "";
                setTimeout(() => boot.remove(), 1100);
            }, 250);
        }
    })();

    /* ---------- 1. Scroll-spy + one-shot reveal ---------- */

    const panels = Array.from(document.querySelectorAll(".ark-section"));
    const navLinks = Array.from(document.querySelectorAll(".ark-rail-link"));
    const allHashLinks = Array.from(document.querySelectorAll('a[href^="#"]'));

    function setActiveSection(id) {
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
        }, {
            rootMargin: "0px 0px -15% 0px",
            threshold: 0
        });

        panels.forEach((panel) => revealObserver.observe(panel));

        const activeObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    setActiveSection(entry.target.id);
                    if (location.hash !== `#${entry.target.id}`) {
                        try { history.replaceState(null, "", `#${entry.target.id}`); } catch (_) {}
                    }
                }
            });
        }, {
            rootMargin: "-45% 0px -45% 0px",
            threshold: 0
        });

        panels.forEach((panel) => activeObserver.observe(panel));
    } else {
        panels.forEach((p) => p.classList.add("is-revealed", "is-active"));
    }

    allHashLinks.forEach((link) => {
        link.addEventListener("click", (e) => {
            const href = link.getAttribute("href");
            if (!href || href === "#") return;
            const id = href.slice(1);
            const target = document.getElementById(id);
            if (!target) return;

            if (e.detail > 0) link.blur();

            if (!("scrollBehavior" in document.documentElement.style)) {
                e.preventDefault();
                target.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        });
    });

    document.addEventListener("keydown", (e) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const tag = (e.target.tagName || "").toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select") return;

        const prevKeys = ["ArrowUp", "PageUp"];
        const nextKeys = ["ArrowDown", "PageDown"];
        if (!prevKeys.includes(e.key) && !nextKeys.includes(e.key)) return;

        const activeIdx = panels.findIndex((p) => p.classList.contains("is-active"));
        const current = activeIdx === -1 ? 0 : activeIdx;
        const dir = prevKeys.includes(e.key) ? -1 : 1;
        const next = Math.max(0, Math.min(panels.length - 1, current + dir));

        e.preventDefault();
        panels[next].scrollIntoView({ behavior: "smooth", block: "start" });
    });

    /* ---------- 2. Dynamic year ---------- */

    const year = String(new Date().getFullYear());
    document.querySelectorAll(".js-year").forEach((el) => {
        el.textContent = year;
    });

    /* ---------- 3. Live local clock ---------- */

    const clockEl = document.getElementById("liveClock");
    if (clockEl) {
        const pad = (n) => String(n).padStart(2, "0");

        // Detect the visitor's timezone abbreviation (e.g. "PST", "GMT+8").
        const tzAbbr = (() => {
            try {
                const parts = new Intl.DateTimeFormat("en-US", {
                    timeZoneName: "short"
                }).formatToParts(new Date());
                const tz = parts.find((p) => p.type === "timeZoneName");
                return tz ? tz.value : "";
            } catch (_) {
                return "";
            }
        })();

        function tickClock() {
            const d = new Date();
            clockEl.textContent =
                `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
                (tzAbbr ? ` ${tzAbbr}` : "");
        }

        tickClock();
        setInterval(tickClock, 1000);
    }

    /* ---------- 4. Marquee ---------- */

    (function buildMarquee() {
        const marquee = document.querySelector(".ark-marquee");
        const track = document.getElementById("marqueeTrack");
        if (!marquee || !track) return;

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
    })();

})();