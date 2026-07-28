/* ==========================================================================
   CANVAS ANIMATED GRADIENT & CURSOR DISTORTION (DARK MODE ONLY)
   ========================================================================== */

(function () {
  'use strict';

  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let animationFrameId = null;

  // Check if system prefers reduced motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Initial random values within tight, tasteful midnight hue range
  const randomHueOffset = Math.random() * 20; // tight 20deg variation
  const baseAngle = Math.random() * Math.PI * 2;
  let currentAngle = baseAngle;

  // Mouse tracking with lerp for smooth lens distortion
  let mouse = { x: -1000, y: -1000, targetX: -1000, targetY: -1000, active: false };

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  window.addEventListener('resize', resizeCanvas, { passive: true });
  resizeCanvas();

  // Mouse move handler (throttled via rAF lerp loop)
  window.addEventListener('mousemove', (e) => {
    mouse.targetX = e.clientX;
    mouse.targetY = e.clientY;
    mouse.active = true;
  }, { passive: true });

  window.addEventListener('mouseleave', () => {
    mouse.active = false;
  }, { passive: true });

  // Gradient color generators
  function getMidnightColors(hueShift) {
    // Tight midnight spectrum (navy -> dark indigo -> charcoal)
    return [
      `hsl(${220 + hueShift}, 30%, 6%)`,
      `hsl(${235 + hueShift}, 35%, 8%)`,
      `hsl(${210 + hueShift}, 25%, 5%)`,
      `hsl(${250 + hueShift}, 28%, 7%)`
    ];
  }

  function renderFrame() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    
    if (!isDark) {
      // Light mode: clear canvas and stop drawing loop
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      animationFrameId = requestAnimationFrame(renderFrame);
      return;
    }

    const width = canvas.width;
    const height = canvas.height;

    // Slowly rotate background gradient angle (10s+ imperceptible drift)
    if (!prefersReducedMotion) {
      currentAngle += 0.0003;
    }

    // Lerp mouse position for silky smooth distortion warp
    mouse.x += (mouse.targetX - mouse.x) * 0.08;
    mouse.y += (mouse.targetY - mouse.y) * 0.08;

    // Calculate dynamic linear gradient endpoints based on currentAngle
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.sqrt(cx * cx + cy * cy);
    const x0 = cx - Math.cos(currentAngle) * radius;
    const y0 = cy - Math.sin(currentAngle) * radius;
    const x1 = cx + Math.cos(currentAngle) * radius;
    const y1 = cy + Math.sin(currentAngle) * radius;

    const colors = getMidnightColors(randomHueOffset);
    const bgGradient = ctx.createLinearGradient(x0, y0, x1, y1);
    bgGradient.addColorStop(0, colors[0]);
    bgGradient.addColorStop(0.35, colors[1]);
    bgGradient.addColorStop(0.7, colors[2]);
    bgGradient.addColorStop(1, colors[3]);

    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Render subtle local lens distortion near cursor if active
    if (mouse.active && mouse.x > 0 && mouse.y > 0 && !prefersReducedMotion) {
      const distRadius = 220; // subtle lens influence area
      const radialGradient = ctx.createRadialGradient(
        mouse.x, mouse.y, 0,
        mouse.x, mouse.y, distRadius
      );

      // Subtle refraction highlight & color warp
      radialGradient.addColorStop(0, `hsla(${225 + randomHueOffset}, 60%, 18%, 0.18)`);
      radialGradient.addColorStop(0.4, `hsla(${235 + randomHueOffset}, 45%, 12%, 0.09)`);
      radialGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = radialGradient;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, distRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    animationFrameId = requestAnimationFrame(renderFrame);
  }

  // Start render loop
  renderFrame();
})();
