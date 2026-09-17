/** Bounded, dependency-free 3D scene: world coordinates, camera projection,
 * smooth lathed solids and depth-sorted paths. No network or provider data. */
type V3 = [number, number, number];
type Point = { x: number; y: number; z: number; scale: number };
type Paint = {
  depth: number;
  draw: (surface: CanvasRenderingContext2D) => void;
};
const TAU = Math.PI * 2;
const colors = ["#a481ff", "#5bbdff", "#ffb829", "#35b49a", "#e0cfff"];
const particles = Array.from({ length: 120 }, (_, i) => {
  const azimuth = i * 2.399963;
  const y = 1 - (i / 119) * 2;
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
  let sculpture: Paint[] | null = null;
  let sculptureImage: Paint | null = null;
  let artwork: HTMLImageElement | null = null;
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  const canRun = () =>
    running && inView && !document.hidden && !media.matches && !destroyed;

  function paint() {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    const unit = Math.min(width, height) * 0.165;
    const yaw = -0.38;
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
      color: string | CanvasGradient,
      alpha = 1,
      lineWidth = 1,
      fill = false,
      depthOffset = 0
    ) {
      const projected = points.map(project);
      queue.push({
        depth:
          projected.reduce((sum, p) => sum + p.z, 0) / projected.length +
          depthOffset,
        draw: surface => {
          surface.globalAlpha = alpha;
          surface.beginPath();
          projected.forEach((p, i) =>
            i ? surface.lineTo(p.x, p.y) : surface.moveTo(p.x, p.y)
          );
          if (fill) {
            surface.closePath();
            surface.fillStyle = color;
            surface.fill();
            if (lineWidth > 0) {
              surface.strokeStyle = color;
              surface.lineWidth = lineWidth;
              surface.stroke();
            }
          } else {
            surface.strokeStyle = color;
            surface.lineWidth = lineWidth;
            surface.stroke();
          }
        },
      });
    }
    function light(point: V3, color: string, radius: number) {
      const p = project(point);
      queue.push({
        depth: p.z,
        draw: surface => {
          const r = radius * p.scale;
          surface.globalAlpha = 1;
          const glow = surface.createRadialGradient(
            p.x,
            p.y,
            0,
            p.x,
            p.y,
            r * 6
          );
          glow.addColorStop(0, color + "c0");
          glow.addColorStop(0.2, color + "45");
          glow.addColorStop(1, color + "00");
          surface.fillStyle = glow;
          surface.fillRect(p.x - r * 6, p.y - r * 6, r * 12, r * 12);
          surface.beginPath();
          surface.arc(p.x, p.y, r, 0, TAU);
          surface.fillStyle = "#fff";
          surface.fill();
        },
      });
    }
    const sides = 80;
    const ring = (y: number, radius: number): V3[] =>
      Array.from({ length: sides }, (_, i) => [
        Math.cos((i / sides) * TAU) * radius,
        y,
        Math.sin((i / sides) * TAU) * radius,
      ]);
    type Material = "silver" | "graphite" | "glass";
    // Surface normals and a broad studio reflection create a continuous material,
    // rather than assigning one flat color to each side of a polygonal tower.
    function shade(angle: number, slope: number, material: Material) {
      const length = Math.hypot(1, slope);
      const nx = Math.cos(angle) / length,
        ny = slope / length,
        nz = Math.sin(angle) / length;
      const diffuse = Math.max(0, nx * -0.55 + ny * 0.62 - nz * 0.56);
      const highlight = Math.pow(
        Math.max(0, nx * -0.34 + ny * 0.35 - nz * 0.87),
        22
      );
      const reflection = Math.pow(Math.max(0, Math.cos(angle + 2.15)), 10);
      const value =
        material === "graphite"
          ? 0.14 + diffuse * 0.26
          : material === "glass"
            ? 0.35 + diffuse * 0.4
            : 0.3 + diffuse * 0.58;
      const base = material === "glass" ? [68, 153, 202] : [193, 209, 220];
      return `rgb(${base
        .map((v, i) =>
          Math.round(
            Math.min(
              255,
              v * value + highlight * 115 + reflection * (i === 0 ? 25 : 40)
            )
          )
        )
        .join(",")})`;
    }
    function lathe(profile: [number, number][], material: Material = "silver") {
      for (let level = 0; level < profile.length - 1; level++) {
        const [bottom, lowerRadius] = profile[level],
          [top, upperRadius] = profile[level + 1];
        const lower = ring(bottom, lowerRadius),
          upper = ring(top, upperRadius);
        const slope = (lowerRadius - upperRadius) / (top - bottom);
        for (let i = 0; i < sides; i++) {
          const next = (i + 1) % sides;
          const face = [lower[i], lower[next], upper[next], upper[i]];
          path(
            face,
            shade(((i + 0.5) / sides) * TAU, slope, material),
            material === "glass" ? 0.54 : 1,
            material === "glass" ? 0 : 0.65,
            true
          );
        }
      }
      const [top, radius] = profile[profile.length - 1];
      if (radius > 0.01)
        path(
          ring(top, radius),
          material === "graphite" ? "#3a4957" : "#a0bdcd",
          0.92,
          0,
          true
        );
    }
    function rim(
      y: number,
      radius: number,
      color: string,
      alpha = 0.8,
      thickness = 0.8
    ) {
      const points = ring(y, radius);
      // Segment the circle so near and far edges occlude correctly against the tower.
      for (let i = 0; i < sides; i++)
        path([points[i], points[(i + 1) % sides]], color, alpha, thickness);
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
    haze.addColorStop(0, "#4aa8d916");
    haze.addColorStop(1, "#4aa8d900");
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
    for (let orbit = 0; orbit < 2; orbit++) {
      const radius = 2.35 + orbit * 0.5;
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
        path([position(a), position(a + TAU / 80)], colors[orbit], 0.3, 0.85);
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
    // Camera and sculpture are stationary: cache their projection/material work.
    // Only the small orbital signals and beam are recomputed each frame.
    const sculptureStart = queue.length;
    if (!artwork && !sculpture) {
      // Turned, bevelled metal, a tapering pearl body and a suspended glass lens.
      lathe(
        [
          [-1.56, 0.66],
          [-1.52, 0.81],
          [-1.43, 0.81],
          [-1.38, 0.73],
        ],
        "graphite"
      );
      rim(-1.43, 0.815, "#77d4ff", 0.7, 1);
      lathe([
        [-1.37, 0.67],
        [-1.32, 0.69],
        [-1.25, 0.53],
        [-1.18, 0.46],
        [-0.97, 0.43],
        [0.54, 0.27],
        [0.71, 0.29],
        [0.76, 0.38],
      ]);
      rim(-1.32, 0.69, "#e4f6ff", 0.65);
      // A single optical inlay gives the tower a distinctive, uncluttered silhouette.
      const inlayPoint = (angle: number, y: number): V3 => {
        const radius = 0.43 - ((y + 0.97) / 1.51) * 0.16 + 0.008;
        return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
      };
      path(
        [
          inlayPoint(-1.72, -0.94),
          inlayPoint(-1.57, -0.94),
          inlayPoint(-1.57, 0.4),
          inlayPoint(-1.72, 0.4),
        ],
        "#264958",
        1,
        0,
        true,
        -0.6
      );
      path(
        [inlayPoint(-1.72, -0.94), inlayPoint(-1.72, 0.4)],
        "#bcf0ff",
        0.8,
        0.75,
        false,
        -0.6
      );
      lathe([
        [0.77, 0.4],
        [0.8, 0.48],
        [0.88, 0.48],
        [0.92, 0.39],
      ]);
      rim(0.88, 0.485, "#ddf5ff", 0.9, 1.15);
      lathe(
        [
          [0.96, 0.3],
          [1.35, 0.3],
        ],
        "glass"
      );
      // Finely spaced Fresnel ridges catch the white-blue signal.
      for (let i = 0; i < 7; i++)
        rim(0.98 + i * 0.055, 0.305, "#a3e4ff", 0.44, 0.8);
      for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        const x = Math.cos(angle) * 0.315,
          z = Math.sin(angle) * 0.315;
        path(
          [
            [x, 0.93, z],
            [x, 1.38, z],
          ],
          "#d8e9f1",
          0.8,
          1.5
        );
      }
      lathe([
        [1.38, 0.38],
        [1.42, 0.47],
        [1.48, 0.47],
        [1.53, 0.38],
        [1.6, 0.25],
        [1.65, 0.06],
        [1.67, 0.005],
      ]);
      rim(1.42, 0.475, "#d9f2ff", 0.88, 1);
      light([0, 1.15, -0.35], "#72d6ff", Math.max(3, unit * 0.062));
      sculpture = queue.splice(sculptureStart);
      const bounds = [-0.95, 0.95].flatMap(x =>
        [-1.7, 1.8].flatMap(y => [-0.95, 0.95].map(z => project([x, y, z])))
      );
      const left = Math.floor(Math.min(...bounds.map(p => p.x))) - 24;
      const top = Math.floor(Math.min(...bounds.map(p => p.y))) - 24;
      const bw = Math.ceil(Math.max(...bounds.map(p => p.x)) - left) + 24;
      const bh = Math.ceil(Math.max(...bounds.map(p => p.y)) - top) + 24;
      const buffer = canvas.ownerDocument.createElement("canvas");
      const density = Math.min(window.devicePixelRatio || 1, 1.75);
      buffer.width = Math.ceil(bw * density);
      buffer.height = Math.ceil(bh * density);
      const surface = buffer.getContext("2d");
      if (surface) {
        surface.setTransform(
          density,
          0,
          0,
          density,
          -left * density,
          -top * density
        );
        sculpture
          .sort((a, b) => b.depth - a.depth)
          .forEach(item => item.draw(surface));
        sculptureImage = {
          depth: 0,
          draw: target => {
            target.globalAlpha = 1;
            target.drawImage(buffer, left, top, bw, bh);
          },
        };
        // Retain only the cropped bitmap, not hundreds of draw closures.
        sculpture = [];
      }
    }
    if (artwork) {
      const image = artwork;
      const size = Math.min(width, height) * 0.68;
      queue.push({
        depth: 0,
        draw: surface => {
          surface.globalAlpha = 1;
          surface.drawImage(
            image,
            (width - size) / 2,
            height * 0.49 - size / 2,
            size,
            size
          );
        },
      });
    } else if (sculptureImage) queue.push(sculptureImage);
    else queue.push(...(sculpture ?? []));
    // Soft, slowly sweeping light. No strobing and no full-screen bloom.
    const beamAngle = -Math.PI * 0.55 + Math.sin(elapsed * 0.14) * 0.75;
    const signalHeight = artwork ? 1.4 : 1.15;
    const source: V3 = [0, signalHeight, -0.15];
    const tip: V3 = [
      Math.cos(beamAngle) * 3.2,
      signalHeight,
      Math.sin(beamAngle) * 3.2,
    ];
    const origin = project(source),
      end = project(tip);
    const beam = ctx.createLinearGradient(origin.x, origin.y, end.x, end.y);
    beam.addColorStop(0, "#c3efff38");
    beam.addColorStop(0.3, "#73caff12");
    beam.addColorStop(1, "#73caff00");
    path(
      [
        source,
        [tip[0], tip[1] + 0.42, tip[2]],
        [tip[0], tip[1] - 0.42, tip[2]],
      ],
      beam,
      1,
      0,
      true
    );

    queue.sort((a, b) => b.depth - a.depth).forEach(item => item.draw(ctx));
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
    sculpture = null;
    sculptureImage = null;
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
    setArtwork(image: HTMLImageElement) {
      if (destroyed || !image.complete || !image.naturalWidth) return;
      artwork = image;
      sculpture = null;
      sculptureImage = null;
      canvas.dataset.artwork = "lighthouse";
      paint();
    },
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
