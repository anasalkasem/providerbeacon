/** Bounded, dependency-free 3D scene: world coordinates, camera projection,
 * shaded solids and depth-sorted paths. No network or provider data. */
type V3 = [number, number, number];
type Point = { x: number; y: number; z: number; scale: number };
type Paint = { depth: number; draw: () => void };
const TAU = Math.PI * 2;
const colors = ["#a481ff", "#5bbdff", "#ffb829", "#35b49a", "#e0cfff"];
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const particles = Array.from({ length: 160 }, (_, i) => {
  const azimuth = i * 2.399963;
  const y = 1 - (i / 159) * 2;
  const radius = 2.7 + (i % 7) * 0.16;
  const width = Math.sqrt(1 - y * y);
  return {
    point: [
      Math.cos(azimuth) * width * radius,
      y * radius * 0.7,
      Math.sin(azimuth) * width * radius,
    ] as V3,
    color: colors[i % colors.length],
    size: 1 + (i % 4) * 0.35,
  };
});

export function createOrbitRenderer(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return null;
  let width = 1,
    height = 1,
    frame = 0,
    elapsed = 6,
    last = 0;
  let running = true,
    inView = true,
    destroyed = false;
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  const canRun = () =>
    running && inView && !document.hidden && !media.matches && !destroyed;

  function paint() {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    const unit = Math.min(width, height) * 0.165;
    const yaw = -0.38 + Math.sin(elapsed * 0.14) * 0.15;
    const tilt = 0.32;
    function project([x, y, z]: V3): Point {
      const rx = x * Math.cos(yaw) + z * Math.sin(yaw);
      const rz = -x * Math.sin(yaw) + z * Math.cos(yaw);
      const ry = y * Math.cos(tilt) + rz * Math.sin(tilt);
      const depth = -y * Math.sin(tilt) + rz * Math.cos(tilt);
      const scale = 6.8 / (7 + depth);
      return {
        x: width / 2 + rx * unit * scale,
        y: height * 0.49 - ry * unit * scale,
        z: depth,
        scale,
      };
    }
    const queue: Paint[] = [];
    function path(
      points: V3[],
      color: string,
      alpha = 1,
      lineWidth = 1,
      fill = false
    ) {
      const projected = points.map(project);
      queue.push({
        depth: projected.reduce((sum, p) => sum + p.z, 0) / projected.length,
        draw: () => {
          ctx!.globalAlpha = alpha;
          ctx!.beginPath();
          projected.forEach((p, i) =>
            i ? ctx!.lineTo(p.x, p.y) : ctx!.moveTo(p.x, p.y)
          );
          if (fill) {
            ctx!.closePath();
            ctx!.fillStyle = color;
            ctx!.fill();
          } else {
            ctx!.strokeStyle = color;
            ctx!.lineWidth = lineWidth;
            ctx!.stroke();
          }
        },
      });
    }
    function light(point: V3, color: string, radius: number) {
      const p = project(point);
      queue.push({
        depth: p.z,
        draw: () => {
          const r = radius * p.scale;
          ctx!.globalAlpha = 1;
          const glow = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 6);
          glow.addColorStop(0, color + "c0");
          glow.addColorStop(0.2, color + "45");
          glow.addColorStop(1, color + "00");
          ctx!.fillStyle = glow;
          ctx!.fillRect(p.x - r * 6, p.y - r * 6, r * 12, r * 12);
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, r, 0, TAU);
          ctx!.fillStyle = "#fff";
          ctx!.fill();
        },
      });
    }
    function prism(
      bottom: number,
      top: number,
      lowerRadius: number,
      upperRadius: number,
      luminous = false
    ) {
      const ring = (y: number, radius: number): V3[] =>
        Array.from({ length: 6 }, (_, i) => [
          Math.cos((i / 6) * TAU) * radius,
          y,
          Math.sin((i / 6) * TAU) * radius,
        ]);
      const lower = ring(bottom, lowerRadius),
        upper = ring(top, upperRadius);
      const shades = luminous
        ? ["#cbbeff", "#a183ff", "#7650d9", "#2e2057", "#493773", "#f2eaff"]
        : ["#4a396b", "#312445", "#18121f", "#0e0b16", "#211b2c", "#736087"];
      for (let i = 0; i < 6; i++) {
        const next = (i + 1) % 6;
        const face = [lower[i], lower[next], upper[next], upper[i]];
        path(face, shades[i], 1, 0, true);
        path(
          [...face, face[0]],
          luminous ? "#c0a2ff" : "#9d82c5",
          luminous ? 0.65 : 0.28,
          0.7
        );
      }
      path(upper, luminous ? "#f5eeff" : "#766583", 1, 0, true);
      path([...upper, upper[0]], "#cdb7fa", 0.65, 0.8);
    }

    // A quiet glow under the world, confined to the decorative scene.
    const haze = ctx.createRadialGradient(
      width * 0.5,
      height * 0.58,
      0,
      width * 0.5,
      height * 0.58,
      unit * 2.5
    );
    haze.addColorStop(0, "#8052ff18");
    haze.addColorStop(1, "#8052ff00");
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, width, height);
    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i];
      const [x, y, z] = particle.point;
      const a = elapsed * 0.023;
      const p = project([
        x * Math.cos(a) + z * Math.sin(a),
        y + Math.sin(elapsed * 0.2 + i) * 0.05,
        -x * Math.sin(a) + z * Math.cos(a),
      ]);
      const size = particle.size * p.scale;
      ctx.globalAlpha = 0.2 + (p.scale - 0.5) * 0.36;
      ctx.strokeStyle = particle.color;
      ctx.lineWidth = 0.65;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - size);
      ctx.lineTo(p.x + size, p.y + size);
      ctx.lineTo(p.x - size, p.y + size);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Orbital paths and travelling signals are genuine points in 3D space.
    for (let orbit = 0; orbit < 3; orbit++) {
      const radius = 2 + orbit * 0.45;
      const rotation = orbit * 1.3 + 0.3;
      const inclination = [0.12, 0.65, -0.4][orbit];
      const position = (a: number): V3 => {
        const x = Math.cos(a) * radius,
          z = Math.sin(a) * radius;
        return [
          x * Math.cos(rotation) + z * Math.sin(rotation),
          -0.12 + z * Math.sin(inclination),
          (-x * Math.sin(rotation) + z * Math.cos(rotation)) *
            Math.cos(inclination),
        ];
      };
      for (let i = 0; i < 80; i++) {
        const a = (i / 80) * TAU;
        path([position(a), position(a + TAU / 80)], colors[orbit], 0.22, 0.85);
      }
      for (let i = 0; i < 2; i++) {
        const a = elapsed * (0.11 + orbit * 0.025) + i * Math.PI + orbit;
        light(position(a), colors[orbit], i === 0 ? 3.2 : 1.6);
        for (let j = 0; j < 10; j++)
          path(
            [position(a - j * 0.03), position(a - (j + 1) * 0.03)],
            colors[orbit],
            0.7 * (1 - j / 10),
            1.8
          );
      }
    }
    // Hexagonal plinth, tapering tower, floating lens and beacon cap.
    prism(-1.45, -1.3, 0.86, 0.86);
    prism(-1.3, -1.19, 0.74, 0.64);
    prism(-1.19, 0.76, 0.47, 0.25);
    prism(0.77, 0.85, 0.42, 0.42);
    prism(0.91, 1.24, 0.24, 0.24, true);
    prism(1.3, 1.39, 0.43, 0.43);
    prism(1.39, 1.65, 0.43, 0.025);
    for (let level = 0; level < 4; level++) {
      const y = mix(-0.9, 0.5, level / 3);
      const r = mix(0.43, 0.28, level / 3);
      const ring: V3[] = Array.from({ length: 7 }, (_, i) => [
        Math.cos((i / 6) * TAU) * r,
        y,
        Math.sin((i / 6) * TAU) * r,
      ]);
      path(ring, "#ae8dff", 0.38, 0.8);
    }
    light([0, 1.075, -0.27], "#d8c3ff", 5);
    const beamAngle = elapsed * 0.18;
    for (let i = 0; i < 18; i++) {
      const a = beamAngle + (i / 17 - 0.5) * 0.36;
      path(
        [
          [0, 1.06, 0],
          [Math.cos(a) * 2.8, 0.72, Math.sin(a) * 2.8],
          [Math.cos(a + 0.025) * 2.8, 1.35, Math.sin(a + 0.025) * 2.8],
        ],
        "#9a78f5",
        0.015,
        0,
        true
      );
    }
    queue.sort((a, b) => b.depth - a.depth).forEach(item => item.draw());
    ctx.globalAlpha = 1;
    canvas.dataset.renderState = "ready";
  }
  function tick(now: number) {
    frame = 0;
    if (!canRun()) return;
    if (!last || now - last >= 1000 / 30) {
      elapsed += last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      paint();
    }
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    canvas.dataset.motion = canRun() ? "running" : "paused";
    if (canRun()) frame = requestAnimationFrame(tick);
  }
  function resize() {
    const box = canvas.getBoundingClientRect();
    width = Math.max(box.width, 1);
    height = Math.max(box.height, 1);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint();
  }
  const intersection =
    typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver(
          ([entry]) => {
            inView = entry.isIntersecting;
            sync();
          },
          { threshold: 0.01 }
        );
  const resizer =
    typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
  intersection?.observe(canvas);
  resizer?.observe(canvas);
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", sync);
  media.addEventListener("change", sync);
  resize();
  sync();
  return {
    setRunning(value: boolean) {
      running = value;
      sync();
    },
    dispose() {
      destroyed = true;
      if (frame) cancelAnimationFrame(frame);
      intersection?.disconnect();
      resizer?.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", sync);
      media.removeEventListener("change", sync);
    },
  };
}
