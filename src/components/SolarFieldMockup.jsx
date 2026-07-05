import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';

function makePanelTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 440;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#121b26';
  ctx.fillRect(0, 0, 256, 440);
  ctx.strokeStyle = 'rgba(180,200,220,0.18)';
  ctx.lineWidth = 1.5;
  const cols = 6, rows = 10;
  const cw = 256 / cols, ch = 440 / rows;
  for (let c = 1; c < cols; c++) {
    ctx.beginPath(); ctx.moveTo(c * cw, 0); ctx.lineTo(c * cw, 440); ctx.stroke();
  }
  for (let r = 1; r < rows; r++) {
    ctx.beginPath(); ctx.moveTo(0, r * ch); ctx.lineTo(256, r * ch); ctx.stroke();
  }
  return new THREE.CanvasTexture(canvas);
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Extract one frame from a sprite sheet, remove near-white/grey background
function extractFrameTexture(img, col, row, cols, rows, bgThreshold = 200) {
  const fw = img.naturalWidth / cols, fh = img.naturalHeight / rows;
  const canvas = document.createElement('canvas');
  canvas.width = fw; canvas.height = fh;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, col * fw, row * fh, fw, fh, 0, 0, fw, fh);
  const d = ctx.getImageData(0, 0, fw, fh);
  const px = d.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i] > bgThreshold && px[i+1] > bgThreshold && px[i+2] > bgThreshold) px[i+3] = 0;
  }
  ctx.putImageData(d, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

const FF = 'ui-sans-serif, system-ui, sans-serif';

// Coordinates: field X ±119.5, Z ±68. Trees X ±147.5, Z ±96.
// Block gaps at X ≈ ±42. Landfill east at X=240.
// Livestock & wildflowers placed near hedgerow (X≈-42) for stops 3/4.
const TOUR_STOPS = [
  {
    title: 'Low-grade land, not prime farmland',
    body: 'This site uses Grade 4 agricultural land — rough grazing only, unsuitable for arable crops. English planning policy directs solar farms to exactly this kind of site, preserving higher-grade land for food production elsewhere.',
    waypoints: [[141, 133, 141], [30, 50, 10], [10, 22, -15]],
    lookAtEnd: [0, 0, -30],
  },
  {
    title: 'Adjacent to a closed landfill',
    body: 'The eastern boundary borders a capped municipal landfill — land that was never a candidate for food production. The vent pipes are standard post-closure infrastructure; landfill gas is captured, not released.',
    waypoints: [[10, 22, -15], [90, 50, 20], [170, 20, 10]],
    lookAtEnd: [240, 12, 0],
  },
  {
    title: 'Biodiversity net gain — wildflower meadow under the panels',
    body: 'Wildflower meadow is actively managed underneath the panels. Pre-development this was intensive ryegrass monoculture with near-zero ecological value. The shaded microclimate under the panels suits pollinators well.',
    waypoints: [[170, 20, 10], [40, 6, -5], [5, 9, -22]],
    lookAtEnd: [3, 0, 12],
  },
  {
    title: 'Livestock',
    body: 'Sheep continue to graze the site throughout the operational period. Panel tilt and row spacing allow grass growth and free movement. The land remains in productive agricultural use across the full 35-year lease.',
    waypoints: [[3, 0.5, -12], [-25, 15, -5], [-90, 22, 5]],
    lookAtEnd: [-42, 2, 5],
  },
];

const FIELD = { rows: 40, panelsPerRow: 60, blocks: 3, tiltDeg: 30 };

export default function SolarFieldMockup({ onShowChart, onShowMaintenance }) {
  const mountRef = useRef(null);
  const sceneRef = useRef({});
  const [tourActive, setTourActive] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoSlide, setInfoSlide] = useState(0);
  const [tourStop, setTourStop] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [panelFading, setPanelFading] = useState(false);
  const transitioningRef = useRef(false);
  const tourStopRef = useRef(0);

  useEffect(() => {
    const mount = mountRef.current;
    const width = mount.clientWidth, height = mount.clientHeight;
    let unmounted = false;

    // ── Scene ─────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#b8cfe0');
    scene.fog = new THREE.FogExp2('#b8cfe0', 0.0018);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 3000);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight('#c8dff0', 0.55);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight('#ffe8c0', 1.4);
    sun.position.set(200, 220, 80); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -500; sun.shadow.camera.right = 500;
    sun.shadow.camera.top = 500; sun.shadow.camera.bottom = -500;
    sun.shadow.camera.far = 1200; sun.shadow.bias = -0.0003;
    scene.add(sun);
    const fill = new THREE.DirectionalLight('#9bbfe0', 0.35);
    fill.position.set(-100, 80, -60); scene.add(fill);

    // Ground
    const groundGeo = new THREE.PlaneGeometry(3000, 3000, 40, 40);
    const groundMat = new THREE.MeshStandardMaterial({ color: '#4e8a3e', roughness: 1 });
    const posAttr = groundGeo.attributes.position;
    const gColors = new Float32Array(posAttr.count * 3);
    const gc1 = new THREE.Color('#567a45'), gc2 = new THREE.Color('#3d6e30');
    for (let i = 0; i < posAttr.count; i++) {
      const col = gc1.clone().lerp(gc2, Math.random());
      gColors[i*3] = col.r; gColors[i*3+1] = col.g; gColors[i*3+2] = col.b;
    }
    groundGeo.setAttribute('color', new THREE.BufferAttribute(gColors, 3));
    groundMat.vertexColors = true;
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    scene.add(ground);

    const panelTex = makePanelTexture();

    // ── Field (fixed params) ───────────────────────────────────────────────
    function buildField() {
      ['panelMesh', 'legMesh'].forEach(k => {
        const old = sceneRef.current[k];
        if (old) { scene.remove(old); old.geometry.dispose(); old.material.dispose(); }
      });
      const { rows, panelsPerRow, blocks, tiltDeg } = FIELD;
      const panelW = 1.0, panelD = 0.05, panelH = 1.7;
      const rowSpacing = 3.4, panelSpacing = 1.15, blockGap = 16;
      const tilt = THREE.MathUtils.degToRad(tiltDeg);
      const fieldWidth = panelsPerRow * panelSpacing;
      const totalBlocksWidth = blocks * fieldWidth + (blocks - 1) * blockGap;
      const fieldDepth = rows * rowSpacing;
      const total = rows * panelsPerRow * blocks;

      // Panels
      const panelGeo = new THREE.BoxGeometry(panelW, panelD, panelH);
      const panelMat = new THREE.MeshStandardMaterial({ map: panelTex, metalness: 0.4, roughness: 0.3 });
      const panelMesh = new THREE.InstancedMesh(panelGeo, panelMat, total);
      panelMesh.castShadow = true; panelMesh.receiveShadow = true;

      // Legs — two per panel (front & back mount points)
      const legH = 0.9;
      const legGeo = new THREE.CylinderGeometry(0.028, 0.028, legH, 5);
      const legMat = new THREE.MeshStandardMaterial({ color: '#9ca3af', metalness: 0.7, roughness: 0.3 });
      const legMesh = new THREE.InstancedMesh(legGeo, legMat, total * 2);
      legMesh.castShadow = true;

      const dummy = new THREE.Object3D(); let idx = 0, lidx = 0;
      for (let b = 0; b < blocks; b++) {
        const bx = b * (fieldWidth + blockGap) - totalBlocksWidth / 2;
        for (let r = 0; r < rows; r++) {
          const z = r * rowSpacing - fieldDepth / 2;
          for (let p = 0; p < panelsPerRow; p++) {
            const px = bx + p * panelSpacing;
            dummy.position.set(px, 0.95, z);
            dummy.rotation.set(tilt, 0, 0); dummy.updateMatrix();
            panelMesh.setMatrixAt(idx++, dummy.matrix);
            // Front leg
            dummy.position.set(px, legH / 2, z + 0.35); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
            legMesh.setMatrixAt(lidx++, dummy.matrix);
            // Back leg
            dummy.position.set(px, legH / 2, z - 0.35); dummy.updateMatrix();
            legMesh.setMatrixAt(lidx++, dummy.matrix);
          }
        }
      }
      panelMesh.instanceMatrix.needsUpdate = true;
      legMesh.instanceMatrix.needsUpdate = true;
      panelMesh.frustumCulled = false;
      legMesh.frustumCulled = false;
      scene.add(panelMesh); scene.add(legMesh);
      sceneRef.current.panelMesh = panelMesh;
      sceneRef.current.legMesh = legMesh;
    }
    sceneRef.current.buildField = buildField;
    buildField();

    // ── Static land elements ──────────────────────────────────────────────

    // Landfill — one big flat dark brown patch
    const mound = new THREE.Mesh(
      new THREE.PlaneGeometry(130, 100),
      new THREE.MeshStandardMaterial({ color: '#2e1a0a', roughness: 1 })
    );
    mound.rotation.x = -Math.PI / 2;
    mound.position.set(240, 0.05, 0);
    mound.receiveShadow = true;
    scene.add(mound);

    // Vent pipes (ground-level on flat landfill)
    const pipeMat = new THREE.MeshStandardMaterial({ color: '#888', roughness: 0.6, metalness: 0.4 });
    [[228,3,8],[242,3,-5],[250,3,10],[233,3,-8]].forEach(([x,y,z]) => {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 6, 8), pipeMat);
      pipe.position.set(x, y, z); pipe.castShadow = true; scene.add(pipe);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.35, 0.5, 8), pipeMat);
      cap.position.set(x, y + 3.2, z); scene.add(cap);
    });

    // Landfill fence
    const postMat = new THREE.MeshStandardMaterial({ color: '#8b6a40', roughness: 1 });
    const railMat = new THREE.MeshStandardMaterial({ color: '#a07840', roughness: 1 });
    for (let i = 0; i < 24; i++) {
      const a0 = (i / 24) * Math.PI * 2, a1 = ((i + 1) / 24) * Math.PI * 2;
      const p0x = 240 + Math.cos(a0) * 48, p0z = Math.sin(a0) * 40;
      const p1x = 240 + Math.cos(a1) * 48, p1z = Math.sin(a1) * 40;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 4, 6), postMat);
      post.position.set(p0x, 2, p0z); scene.add(post);
      const dx = p1x - p0x, dz = p1z - p0z;
      const rail = new THREE.Mesh(new THREE.BoxGeometry(Math.sqrt(dx*dx+dz*dz), 0.12, 0.12), railMat);
      rail.position.set((p0x+p1x)/2, 2.5, (p0z+p1z)/2);
      rail.rotation.y = Math.atan2(dz, dx); scene.add(rail);
    }

    // Hedgerows at block gap centres (X ≈ ±42)
    const hedgeMat = new THREE.MeshStandardMaterial({ color: '#2a5018', roughness: 1 });
    const hedgeMat2 = new THREE.MeshStandardMaterial({ color: '#1e4012', roughness: 1 });
    const hedgeGeo = new THREE.SphereGeometry(2.8, 7, 5);
    const hedgeGeoSm = new THREE.SphereGeometry(1.9, 6, 4);
    [-42, 42].forEach(hx => {
      for (let hz = -70; hz <= 70; hz += 5.5) {
        const hb = new THREE.Mesh(hedgeGeo, hedgeMat);
        hb.scale.set(1.3, 0.8, 1); hb.position.set(hx, 2.2, hz); hb.castShadow = true;
        scene.add(hb);
        // Second sphere for layered 3D look
        const hb2 = new THREE.Mesh(hedgeGeoSm, hedgeMat2);
        hb2.position.set(hx + (hz % 3.1 > 1.5 ? 1.2 : -1.0), 3.5, hz + 0.8);
        hb2.castShadow = true; scene.add(hb2);
      }
    });

    // 3D perimeter bushes along field boundary
    {
      const HW = 124, HD = 74;
      const bMats = [
        new THREE.MeshStandardMaterial({ color: '#2a5018', roughness: 1 }),
        new THREE.MeshStandardMaterial({ color: '#1e4012', roughness: 1 }),
        new THREE.MeshStandardMaterial({ color: '#356020', roughness: 1 }),
      ];
      const bGeos = [
        new THREE.SphereGeometry(3.2, 7, 5),
        new THREE.SphereGeometry(2.4, 6, 4),
        new THREE.SphereGeometry(1.8, 6, 4),
      ];
      const rng = (s) => { const v = Math.sin(s * 127.1) * 43758.5453; return v - Math.floor(v); };
      let bi = 0;
      const addBush = (x, z) => {
        // Main bush
        const m = new THREE.Mesh(bGeos[0], bMats[0]);
        const sx = 1.1 + rng(bi * 2.3) * 0.5, sy = 0.65 + rng(bi * 1.7) * 0.3, sz = 1.0 + rng(bi * 3.1) * 0.4;
        m.scale.set(sx, sy, sz); m.position.set(x, 2.0 * sy, z); m.castShadow = true; scene.add(m);
        // Smaller cluster on top/side
        const m2 = new THREE.Mesh(bGeos[1], bMats[1 + (bi % 2)]);
        m2.position.set(x + (rng(bi * 4.1) - 0.5) * 2.5, 2.0 * sy + 1.8 + rng(bi * 2.7) * 1.2, z + (rng(bi * 5.3) - 0.5) * 2.0);
        m2.castShadow = true; scene.add(m2);
        // Third accent sphere
        const m3 = new THREE.Mesh(bGeos[2], bMats[bi % 3]);
        m3.position.set(x + (rng(bi * 6.7) - 0.5) * 3.0, 1.5 + rng(bi * 1.3) * 2.0, z + (rng(bi * 7.9) - 0.5) * 2.5);
        m3.castShadow = true; scene.add(m3);
        bi++;
      };
      for (let x = -HW; x <= HW; x += 6) { addBush(x, -HD); addBush(x, HD); }
      for (let z = -HD + 6; z < HD; z += 6) { addBush(-HW, z); addBush(HW, z); }
    }

    // ── Flower meadow (stop 3 only) — procedural canvas-drawn ─────────────
    {
      const PETAL_COLORS = [
        ['#f9a8d4','#fde047'], // pink + yellow
        ['#c084fc','#fde047'], // purple + yellow
        ['#fdba74','#dc2626'], // orange + red
        ['#ffffff','#fde047'], // white + yellow
        ['#67e8f9','#fde047'], // sky blue + yellow
        ['#a7f3d0','#f97316'], // mint + orange
      ];
      const flowerTextures = PETAL_COLORS.map(([petal, center]) => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 128;
        const ctx = canvas.getContext('2d');
        // petals
        ctx.fillStyle = petal;
        for (let p = 0; p < 6; p++) {
          const a = (p / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.ellipse(64 + Math.cos(a)*30, 64 + Math.sin(a)*30, 24, 13, a, 0, Math.PI * 2);
          ctx.fill();
        }
        // center
        ctx.fillStyle = center;
        ctx.beginPath(); ctx.arc(64, 64, 17, 0, Math.PI * 2); ctx.fill();
        const tex = new THREE.CanvasTexture(canvas);
        tex.minFilter = THREE.LinearFilter;
        return tex;
      });
      const stemMat = new THREE.MeshStandardMaterial({ color: '#15803d', roughness: 1 });
      const rng = (s) => { const v = Math.sin(s * 127.1) * 43758.5453; return v - Math.floor(v); };
      const flowerGroup = new THREE.Group();
      // 40 bunches spread under block 1 panels (X: -28..28, Z: -5..40)
      for (let i = 0; i < 40; i++) {
        const bx = -28 + rng(i * 2.3 + 0.1) * 56;
        const bz = -5  + rng(i * 3.7 + 0.4) * 45;
        const count = 2 + Math.floor(rng(i * 1.1 + 0.9) * 4);
        for (let f = 0; f < count; f++) {
          const fx = bx + (rng(i * 5.3 + f * 0.7) - 0.5) * 2.8;
          const fz = bz + (rng(i * 4.1 + f * 1.3) - 0.5) * 2.8;
          const stemH = 0.35 + rng(i * 2.9 + f * 0.3) * 0.45;
          const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, stemH, 4), stemMat);
          stem.position.set(fx, stemH / 2, fz);
          flowerGroup.add(stem);
          const tIdx = Math.floor(rng(i * 7.1 + f * 2.3) * flowerTextures.length);
          const mat = new THREE.SpriteMaterial({ map: flowerTextures[tIdx], transparent: true });
          const sp = new THREE.Sprite(mat);
          const sz = 0.65 + rng(i * 6.3 + f * 1.7) * 0.55;
          sp.scale.set(sz, sz, 1);
          sp.position.set(fx, stemH + sz * 0.5, fz);
          flowerGroup.add(sp);
        }
      }
      flowerGroup.visible = false;
      scene.add(flowerGroup);
      sceneRef.current.flowerGroup = flowerGroup;
    }

    // ── Sprite placeholders (async below) ─────────────────────────────────
    sceneRef.current.birdSprites = [];
    sceneRef.current.birdFrameTextures = [];
    sceneRef.current.birdTime = 0;
    const BIRD_DATA = [
      { r: 30, speed: 0.52, h: 48, phase: 0 },
      { r: 38, speed: 0.36, h: 56, phase: 1.3 },
      { r: 24, speed: 0.72, h: 44, phase: 2.6 },
      { r: 42, speed: 0.44, h: 62, phase: 4.0 },
      { r: 33, speed: 0.62, h: 51, phase: 3.2 },
    ];
    sceneRef.current.BIRD_DATA = BIRD_DATA;

    // ── Async asset loading ────────────────────────────────────────────────
    ;(async () => {
      try {
        // Livestock sprites — 4 pixel-art sheep types near hedgerow (stop 4)
        function removeBg(img, dark) {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
          const d = ctx.getImageData(0, 0, c.width, c.height); const px = d.data;
          for (let i = 0; i < px.length; i += 4) {
            const r = px[i], g = px[i+1], b = px[i+2];
            if (dark ? (r < 35 && g < 35 && b < 35) : (r > 210 && g > 210 && b > 210)) px[i+3] = 0;
          }
          ctx.putImageData(d, 0, 0);
          const tex = new THREE.CanvasTexture(c);
          tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
          return tex;
        }

        const [ls1, ls2, ls3, ls4] = await Promise.all([
          loadImage('/livestock1.png'),
          loadImage('/livestock2.png'),
          loadImage('/livestock3.png'),
          loadImage('/livestock4.png'),
        ]);
        if (unmounted) return;
        const livestockTextures = [
          removeBg(ls1, true),   // white sheep, black bg
          removeBg(ls2, true),   // brown cow, black bg
          removeBg(ls3, false),  // black sheep, white bg
          removeBg(ls4, true),   // grey sheep, black bg
        ];

        // Scatter 16 animals near hedgerow area (X: -44 to -62, Z: -28 to 38)
        const rng = (seed) => { const x = Math.sin(seed) * 43758.5453; return x - Math.floor(x); };
        for (let i = 0; i < 16; i++) {
          const texIdx = Math.floor(rng(i * 7.1 + 1.3) * 4);
          const tex = livestockTextures[texIdx];
          const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.05 });
          const sprite = new THREE.Sprite(mat);
          const img = [ls1, ls2, ls3, ls4][texIdx];
          const aspect = img.naturalWidth / img.naturalHeight;
          const scale = 1.5 + rng(i * 3.7 + 0.5) * 0.8;
          const facing = rng(i * 5.3 + 2.1) > 0.5 ? 1 : -1;
          sprite.scale.set(scale * aspect * facing, scale, 1);
          // Keep within inter-block gap X: -36 to -49 (panels stop at X≈-50.5)
          const x = -36 - rng(i * 2.9 + 0.7) * 13;
          const z = -30 + rng(i * 4.1 + 1.9) * 60;
          sprite.position.set(x, scale / 2, z);
          scene.add(sprite);
        }

        // Bird sprite sheet — 5 cols × 2 rows = 10 frames
        const birdImg = await loadImage('/bird-sprites.jpg');
        if (unmounted) return;
        const birdFrameTextures = [];
        for (let f = 0; f < 10; f++) {
          birdFrameTextures.push(extractFrameTexture(birdImg, f % 5, Math.floor(f / 5), 5, 2, 175));
        }
        sceneRef.current.birdFrameTextures = birdFrameTextures;

        // 5 bird sprites orbiting above landfill
        const birdSprites = BIRD_DATA.map((bd) => {
          const mat = new THREE.SpriteMaterial({ map: birdFrameTextures[0], transparent: true, alphaTest: 0.05 });
          const sprite = new THREE.Sprite(mat);
          sprite.scale.set(14, 9, 1);
          sprite.position.set(240 + Math.cos(bd.phase) * bd.r, bd.h, Math.sin(bd.phase) * bd.r);
          scene.add(sprite);
          return sprite;
        });
        sceneRef.current.birdSprites = birdSprites;

      } catch (e) {
        console.warn('Asset load error:', e);
      }
    })();

    // ── Camera (hand-rolled orbit) ────────────────────────────────────────
    let radius = 240, theta = Math.PI / 4, phi = Math.PI / 3.2;
    function updateCamera() {
      camera.position.x = radius * Math.sin(phi) * Math.sin(theta);
      camera.position.y = radius * Math.cos(phi);
      camera.position.z = radius * Math.sin(phi) * Math.cos(theta);
      camera.lookAt(0, 5, 0);
    }
    updateCamera();

    // ── Tour state ────────────────────────────────────────────────────────
    const tourState = {
      active: false, running: false, clock: 0, duration: 2.5,
      curve: null,
      lookAtStart: new THREE.Vector3(0, 5, 0),
      lookAtEnd:   new THREE.Vector3(0, 5, 0),
      currentLookAt: new THREE.Vector3(0, 5, 0),
    };
    sceneRef.current.tourState = tourState;

    sceneRef.current.startTourStop = (stopIdx, dir) => {
      const stop = TOUR_STOPS[stopIdx];
      let wps;
      if (dir >= 0) {
        wps = stop.waypoints.map(([x, y, z]) => new THREE.Vector3(x, y, z));
      } else {
        const from = TOUR_STOPS[stopIdx + 1];
        wps = [...from.waypoints].reverse().map(([x, y, z]) => new THREE.Vector3(x, y, z));
        wps[wps.length - 1] = new THREE.Vector3(...stop.waypoints[stop.waypoints.length - 1]);
      }
      wps[0] = camera.position.clone();
      tourState.curve = new THREE.CatmullRomCurve3(wps, false, 'catmullrom', 0.5);
      tourState.lookAtStart = tourState.currentLookAt.clone();
      tourState.lookAtEnd = new THREE.Vector3(...stop.lookAtEnd);
      tourState.clock = 0; tourState.running = true;
    };

    sceneRef.current.restoreCamera = () => {
      radius = 240; theta = Math.PI / 4; phi = Math.PI / 3.2;
      updateCamera();
    };
    sceneRef.current.zoomIn  = () => { radius = Math.max(30,  radius * 0.8);  updateCamera(); };
    sceneRef.current.zoomOut = () => { radius = Math.min(800, radius * 1.25); updateCamera(); };

    let dragging = false, lastX = 0, lastY = 0;
    function onDown(e) { if (tourState.active) return; dragging = true; lastX = e.clientX; lastY = e.clientY; }
    function onUp() { dragging = false; }
    function onMove(e) {
      if (tourState.active || !dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      theta -= dx * 0.005;
      phi = Math.max(0.15, Math.min(Math.PI / 2 - 0.02, phi - dy * 0.005));
      updateCamera();
    }
    function onWheel(e) {
      if (tourState.active) return;
      radius = Math.max(30, Math.min(800, radius + e.deltaY * 0.16));
      updateCamera(); e.preventDefault();
    }
    renderer.domElement.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    // ── Render loop ───────────────────────────────────────────────────────
    let prevTime = performance.now(), animId;
    function animate() {
      animId = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min((now - prevTime) / 1000, 0.1);
      prevTime = now;

      // Animate bird sprites
      sceneRef.current.birdTime += dt;
      const bt = sceneRef.current.birdTime;
      const frames = sceneRef.current.birdFrameTextures;
      const bSprites = sceneRef.current.birdSprites;
      const bd = sceneRef.current.BIRD_DATA;
      if (frames.length > 0 && bSprites.length > 0) {
        bSprites.forEach((sprite, i) => {
          const { r, speed, h, phase } = bd[i];
          const angle = phase + bt * speed;
          sprite.position.set(240 + Math.cos(angle) * r, h + Math.sin(bt * 0.3 + phase) * 2, Math.sin(angle) * r);
          const frame = Math.floor((bt * 10 + i * 2.1)) % frames.length;
          sprite.material.map = frames[frame];
          sprite.material.needsUpdate = true;
          sprite.scale.set(Math.sin(angle) > 0 ? 14 : -14, 9, 1);
        });
      }

      // Tour camera
      if (tourState.active && tourState.running) {
        tourState.clock = Math.min(tourState.clock + dt, tourState.duration);
        const raw = tourState.clock / tourState.duration;
        const t = easeInOutCubic(raw);
        camera.position.copy(tourState.curve.getPoint(t));
        const la = tourState.lookAtStart.clone().lerp(tourState.lookAtEnd, t);
        camera.lookAt(la); tourState.currentLookAt.copy(la);
        if (raw >= 1) {
          tourState.running = false;
          tourState.currentLookAt.copy(tourState.lookAtEnd);
          transitioningRef.current = false;
          setTransitioning(false);
        }
      }

      renderer.render(scene, camera);
    }
    animate();

    function onResize() {
      const w = mount.clientWidth, h = mount.clientHeight;
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);

    return () => {
      unmounted = true;
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('wheel', onWheel);
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      renderer.dispose(); panelTex.dispose();
    };
  }, []);

  useEffect(() => {
    const group = sceneRef.current.flowerGroup;
    if (!group) return;
    group.visible = tourActive && tourStop === 2;
  }, [tourActive, tourStop]);

  // ── Tour controls ─────────────────────────────────────────────────────
  const startTour = useCallback(() => {
    const { tourState, startTourStop } = sceneRef.current;
    tourState.active = true; tourStopRef.current = 0;
    transitioningRef.current = true;
    setTourActive(true); setTourStop(0); setTransitioning(true); setPanelFading(false);
    startTourStop(0, 1);
  }, []);

  const goToStop = useCallback((nextIdx) => {
    if (transitioningRef.current) return;
    const { startTourStop } = sceneRef.current;
    const dir = nextIdx > tourStopRef.current ? 1 : -1;
    transitioningRef.current = true;
    setTransitioning(true); setPanelFading(true);
    startTourStop(nextIdx, dir);
    setTimeout(() => { tourStopRef.current = nextIdx; setTourStop(nextIdx); setPanelFading(false); }, 280);
  }, []);

  const exitTour = useCallback(() => {
    const { tourState, restoreCamera } = sceneRef.current;
    tourState.active = false; tourState.running = false;
    transitioningRef.current = false;
    setTourActive(false); setTourStop(0); tourStopRef.current = 0;
    setTransitioning(false); setPanelFading(false);
    restoreCamera();
  }, []);

  const btnBase = { background: '#fe470d', color: '#ffffff', border: 'none', borderRadius: 40, padding: '13px 22px', fontSize: 13, fontWeight: 600, fontFamily: FF, cursor: 'pointer', letterSpacing: 0.2, whiteSpace: 'nowrap' };
  const btnPrimary = btnBase;
  const btnGhost   = btnBase;
  const navPrimary = { background: '#22c55e', color: '#000', border: 'none', borderRadius: 30, padding: '12px 26px', fontSize: 13, fontWeight: 700, fontFamily: FF, cursor: 'pointer', opacity: transitioning ? 0.5 : 1, pointerEvents: transitioning ? 'none' : 'auto' };
  const navBack    = { background: 'rgba(255,255,255,0.14)', color: '#fff', border: '1px solid rgba(255,255,255,0.28)', borderRadius: 30, padding: '12px 22px', fontSize: 13, fontWeight: 600, fontFamily: FF, cursor: 'pointer', opacity: transitioning ? 0.5 : 1, pointerEvents: transitioning ? 'none' : 'auto' };
  const navExit    = { background: 'transparent', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 30, padding: '10px 18px', fontSize: 12, fontFamily: FF, cursor: 'pointer' };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', background: '#000', overflow: 'hidden' }}>
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Heading + info popover */}
      {!tourActive && (
        <div style={{ position: 'absolute', top: 24, left: 24, fontFamily: FF, textAlign: 'left' }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#ffffff', lineHeight: 1.2, letterSpacing: -0.4 }}>University of Manchester</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ fontSize: 22, fontWeight: 200, color: '#fe470d', letterSpacing: 0.2, lineHeight: 1.3 }}>Medbridge Solar Farm Project</div>
              <button
                onClick={() => setInfoOpen(o => !o)}
                style={{ width: 18, height: 18, borderRadius: '50%', border: '1.5px solid rgba(254,71,13,0.55)', background: 'rgba(254,71,13,0.15)', color: '#fe470d', fontSize: 10, fontWeight: 700, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FF }}
              >i</button>
            </div>
          </div>

          {infoOpen && (() => {
            const slides = [
              {
                label: '1 — The farm',
                content: (
                  <div>
                    <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.75 }}>
                      This is <strong>Medbridge</strong> — a solar farm in Ockendon, Essex, built for one purpose: to power the University of Manchester with clean, traceable energy for the next decade.
                    </p>
                    <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.75 }}>Construction began <strong>April 2024</strong>.</p>
                    <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                      {[['175', 'acres'], ['70', 'football pitches'], ['104,000', 'panels']].map(([n, l]) => (
                        <div key={l} style={{ flex: 1, background: 'rgba(254,71,13,0.1)', border: '1px solid rgba(254,71,13,0.25)', borderRadius: 8, padding: '12px 10px', textAlign: 'center' }}>
                          <div style={{ fontSize: 22, fontWeight: 800, color: '#fe470d' }}>{n}</div>
                          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 3 }}>{l}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ),
              },
              {
                label: '2 — The numbers',
                content: (
                  <div>
                    {[
                      ['72 GWh', 'generated every year'],
                      ['80% / 58 GWh', 'bought directly by the University'],
                      ['12,000 t CO₂e', 'cut from carbon footprint annually'],
                      ['21,000 homes', 'equivalent energy powered'],
                    ].map(([n, l]) => (
                      <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                        <div style={{ fontSize: 17, fontWeight: 800, color: '#fe470d', minWidth: 130 }}>{n}</div>
                        <div style={{ fontSize: 13, opacity: 0.75, lineHeight: 1.5 }}>{l}</div>
                      </div>
                    ))}
                    <p style={{ margin: '14px 0 0', fontSize: 12, opacity: 0.55, fontStyle: 'italic' }}>Not an estimate. A contracted commitment.</p>
                  </div>
                ),
              },
              {
                label: '3 — The reaction',
                content: (
                  <div>
                    <p style={{ margin: '0 0 14px', fontSize: 13, opacity: 0.7 }}>Not everyone was convinced. <a href="https://www.linkedin.com/posts/renewable-ugcPost-7366077643273687040-1_UP/?utm_source=share&utm_medium=member_desktop&rcm=ACoAADME8TUBV29CIWn1Av5RntdfcPFBz23_vjk" target="_blank" rel="noopener noreferrer" style={{ color: '#fe470d', textDecoration: 'none', fontSize: 11 }}>View post ↗</a></p>
                    {[
                      { name: 'Michael Hobbs', role: 'Founder, consultant, technologist', quote: 'I\'d love to see the cost-benefit equation for this move. The environmental costs are roughly: manufacturing solar panels; maintaining solar panels; replacement land for food production.' },
                      { name: 'John Rowland', role: 'Fellow, Institute of Mathematics', quote: 'Big mistake. The country needs reliable sources of energy. And a blot on the farming landscape.' },
                      { name: 'John Channing', role: 'Managing Director, CTO', quote: 'Has covering 175 acres in solar panels meant the loss of productive farm land? Why aren\'t solar panels being installed on University buildings instead?' },
                      { name: 'Nigel Smart', role: 'PhD, Pharma & Manufacturing', quote: 'I have 32 panels on my roof which makes more sense than wasting land!' },
                    ].map(({ name, role, quote }) => (
                      <div key={name} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: 12, color: '#fff' }}>{name}</div>
                        <div style={{ fontSize: 10.5, opacity: 0.45, marginBottom: 6 }}>{role}</div>
                        <div style={{ fontSize: 12, lineHeight: 1.55, opacity: 0.8, fontStyle: 'italic' }}>"{quote}"</div>
                      </div>
                    ))}
                  </div>
                ),
              },
              {
                label: '4 — This project',
                content: (
                  <div>
                    <p style={{ margin: '0 0 14px', fontSize: 14, lineHeight: 1.75 }}>
                      Manufacturing footprint. Maintenance cost. Land quality. Biodiversity. All of it — <strong>open, sourced, and shown.</strong>
                    </p>
                    <p style={{ margin: '0 0 18px', fontSize: 14, lineHeight: 1.75, color: '#fe470d', fontWeight: 500 }}>
                      This project is an audit to quell those fears and doubts with verifiable information.
                    </p>
                    <a href="https://www.manchester.ac.uk/about/news/university-of-manchester-powers-up-brand-new-solar-farm-delivering-clean-energy-to-campus/" target="_blank" rel="noopener noreferrer" style={{ color: '#fe470d', fontSize: 12, textDecoration: 'none', borderBottom: '1px solid rgba(254,71,13,0.35)', paddingBottom: 1 }}>
                      Source: University of Manchester ↗
                    </a>
                  </div>
                ),
              },
            ];
            return (
              <div style={{ position: 'absolute', top: 'calc(100% + 10px)', left: 0, width: 460, background: 'rgba(8,12,10,0.97)', backdropFilter: 'blur(16px)', border: '1px solid rgba(254,71,13,0.22)', borderRadius: 14, padding: '24px 26px 20px', color: '#dde8e2', boxShadow: '0 12px 48px rgba(0,0,0,0.75)', zIndex: 10 }}>
                <button onClick={() => { setInfoOpen(false); setInfoSlide(0); }} style={{ position: 'absolute', top: 12, right: 16, background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
                {/* Slide label */}
                <div style={{ fontSize: 11, letterSpacing: 1, color: '#fe470d', opacity: 0.75, textTransform: 'uppercase', marginBottom: 14, fontWeight: 600 }}>{slides[infoSlide].label}</div>
                {/* Slide content */}
                <div style={{ minHeight: 220 }}>{slides[infoSlide].content}</div>
                {/* Nav */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <button onClick={() => setInfoSlide(s => Math.max(0, s - 1))} disabled={infoSlide === 0} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 20, padding: '6px 14px', color: '#fff', fontSize: 12, cursor: infoSlide === 0 ? 'default' : 'pointer', opacity: infoSlide === 0 ? 0.25 : 0.8, fontFamily: FF }}>← Back</button>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {slides.map((_, i) => (
                      <div key={i} onClick={() => setInfoSlide(i)} style={{ width: 6, height: 6, borderRadius: '50%', background: i === infoSlide ? '#fe470d' : 'rgba(255,255,255,0.2)', cursor: 'pointer', transition: 'background 0.2s' }} />
                    ))}
                  </div>
                  <button onClick={() => setInfoSlide(s => Math.min(slides.length - 1, s + 1))} disabled={infoSlide === slides.length - 1} style={{ background: infoSlide === slides.length - 1 ? 'none' : '#fe470d', border: infoSlide === slides.length - 1 ? '1px solid rgba(255,255,255,0.18)' : 'none', borderRadius: 20, padding: '6px 14px', color: '#fff', fontSize: 12, cursor: infoSlide === slides.length - 1 ? 'default' : 'pointer', opacity: infoSlide === slides.length - 1 ? 0.25 : 1, fontFamily: FF }}>Next →</button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Zoom buttons — top right */}
      {!tourActive && (
        <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[['＋', 'zoomIn'], ['－', 'zoomOut']].map(([label, fn]) => (
            <button key={fn} onClick={() => sceneRef.current[fn]?.()} style={{
              width: 40, height: 40, borderRadius: 8, border: '1px solid rgba(255,255,255,0.25)',
              background: 'rgba(10,14,12,0.75)', color: '#e8f0ec', fontSize: 20, fontWeight: 700,
              cursor: 'pointer', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{label}</button>
          ))}
        </div>
      )}

      {tourActive && (
        <div style={{
          position: 'absolute', right: 28, top: '50%',
          transform: `translateY(-50%) translateX(${panelFading ? '10px' : '0'})`,
          width: 310, background: 'rgba(10,14,12,0.90)', backdropFilter: 'blur(14px)',
          borderRadius: 14, padding: '28px 26px', color: '#e8f0ec', fontFamily: FF,
          border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 40px rgba(0,0,0,0.55)',
          opacity: panelFading ? 0 : 1, transition: 'opacity 0.25s ease, transform 0.25s ease',
          pointerEvents: panelFading ? 'none' : 'auto',
        }}>
          <div style={{ fontSize: 11, letterSpacing: 1, opacity: 0.45, marginBottom: 12, textTransform: 'uppercase' }}>
            Stop {tourStop + 1} of {TOUR_STOPS.length}
          </div>
          <h3 style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 700, lineHeight: 1.3, color: '#fff' }}>
            {TOUR_STOPS[tourStop].title}
          </h3>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.75, opacity: 0.78 }}>
            {TOUR_STOPS[tourStop].body}
          </p>
          <div style={{ display: 'flex', gap: 6, marginTop: 22 }}>
            {TOUR_STOPS.map((_, i) => (
              <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i === tourStop ? '#4ade80' : 'rgba(255,255,255,0.22)', transition: 'background 0.3s' }} />
            ))}
          </div>
        </div>
      )}

      {tourActive && (
        <div style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 10, alignItems: 'center' }}>
          {tourStop > 0 && <button onClick={() => goToStop(tourStop - 1)} style={navBack}>← Back</button>}
          {tourStop < TOUR_STOPS.length - 1
            ? <button onClick={() => goToStop(tourStop + 1)} style={navPrimary}>Next →</button>
            : <button onClick={exitTour} style={navPrimary}>Finish →</button>
          }
          <button onClick={exitTour} style={navExit}>Exit</button>
        </div>
      )}

      {!tourActive && (
        <div style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 12, whiteSpace: 'nowrap' }}>
          <button onClick={startTour} style={btnBase}>Land viability →</button>
          {onShowChart && <button onClick={onShowChart} style={btnBase}>Solar lifetime cost v/s gas and coal →</button>}
          {onShowMaintenance && <button onClick={onShowMaintenance} style={btnBase}>Maintenance of solar comparison →</button>}
        </div>
      )}

      {!tourActive && (
        <div style={{ position: 'absolute', bottom: 16, left: 16, color: 'rgba(255,255,255,0.55)', fontSize: 11, fontFamily: FF }}>
          Drag to orbit · Scroll to zoom
        </div>
      )}
    </div>
  );
}
