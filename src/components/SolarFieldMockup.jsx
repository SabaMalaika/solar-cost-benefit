import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

export default function SolarFieldMockup() {
  const mountRef = useRef(null);
  const sceneRef = useRef({});
  const [params, setParams] = useState({
    rows: 40,
    panelsPerRow: 60,
    blocks: 3,
    tiltDeg: 28,
  });
  const [panelCount, setPanelCount] = useState(0);

  // One-time scene setup
  useEffect(() => {
    const mount = mountRef.current;
    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#a9c7dd');
    scene.fog = new THREE.Fog('#a9c7dd', 220, 950);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 3000);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    // Lights
    const ambient = new THREE.AmbientLight('#ffffff', 0.6);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight('#fff3da', 1.15);
    sun.position.set(180, 260, 120);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -420;
    sun.shadow.camera.right = 420;
    sun.shadow.camera.top = 420;
    sun.shadow.camera.bottom = -420;
    sun.shadow.camera.far = 900;
    scene.add(sun);

    // Ground
    const groundGeo = new THREE.PlaneGeometry(2400, 2400, 1, 1);
    const groundMat = new THREE.MeshStandardMaterial({ color: '#5d9651', roughness: 1 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Tree-line border for context (simple cones/spheres scattered at the field edge)
    const treeGroup = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#5a4632', roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: '#3f6b34', roughness: 0.9 });
    const trunkGeo = new THREE.CylinderGeometry(0.5, 0.7, 4, 6);
    const leafGeo = new THREE.SphereGeometry(3.2, 7, 6);
    for (let i = 0; i < 70; i++) {
      const angle = (i / 70) * Math.PI * 2;
      const r = 340 + Math.sin(i * 3.1) * 25;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(x, 2, z);
      trunk.castShadow = true;
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(x, 5.2, z);
      leaf.castShadow = true;
      treeGroup.add(trunk, leaf);
    }
    scene.add(treeGroup);

    // Build (or rebuild) the panel field
    function buildField(rows, panelsPerRow, blocks, tiltDeg) {
      const old = sceneRef.current.fieldMesh;
      if (old) {
        scene.remove(old);
        old.geometry.dispose();
        old.material.dispose();
      }

      const panelW = 1.0, panelH = 1.7, panelD = 0.05;
      const geo = new THREE.BoxGeometry(panelW, panelD, panelH);
      const mat = new THREE.MeshStandardMaterial({
        color: '#121b26',
        metalness: 0.4,
        roughness: 0.3,
      });

      const total = rows * panelsPerRow * blocks;
      const mesh = new THREE.InstancedMesh(geo, mat, total);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      const dummy = new THREE.Object3D();
      const rowSpacing = 3.4;
      const panelSpacing = 1.15;
      const blockGap = 16;
      const tilt = THREE.MathUtils.degToRad(tiltDeg);

      const fieldWidth = panelsPerRow * panelSpacing;
      const totalBlocksWidth = blocks * fieldWidth + (blocks - 1) * blockGap;
      const fieldDepth = rows * rowSpacing;

      let idx = 0;
      for (let b = 0; b < blocks; b++) {
        const blockStartX = b * (fieldWidth + blockGap) - totalBlocksWidth / 2;
        for (let r = 0; r < rows; r++) {
          const z = r * rowSpacing - fieldDepth / 2;
          for (let p = 0; p < panelsPerRow; p++) {
            const x = blockStartX + p * panelSpacing;
            dummy.position.set(x, 0.95, z);
            dummy.rotation.set(tilt, 0, 0);
            dummy.updateMatrix();
            mesh.setMatrixAt(idx, dummy.matrix);
            idx++;
          }
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
      scene.add(mesh);
      sceneRef.current.fieldMesh = mesh;
      setPanelCount(total);
    }

    sceneRef.current.buildField = buildField;
    sceneRef.current.scene = scene;

    // Custom orbit camera (no THREE.OrbitControls in this build)
    let radius = 260, theta = Math.PI / 4, phi = Math.PI / 3.1;
    function updateCamera() {
      camera.position.x = radius * Math.sin(phi) * Math.sin(theta);
      camera.position.y = radius * Math.cos(phi);
      camera.position.z = radius * Math.sin(phi) * Math.cos(theta);
      camera.lookAt(0, 6, 0);
    }
    updateCamera();

    let dragging = false, lastX = 0, lastY = 0;
    function onDown(e) { dragging = true; lastX = e.clientX; lastY = e.clientY; }
    function onUp() { dragging = false; }
    function onMove(e) {
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      theta -= dx * 0.005;
      phi -= dy * 0.005;
      phi = Math.max(0.18, Math.min(Math.PI / 2 - 0.02, phi));
      updateCamera();
    }
    function onWheel(e) {
      radius += e.deltaY * 0.18;
      radius = Math.max(35, Math.min(700, radius));
      updateCamera();
      e.preventDefault();
    }
    renderer.domElement.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    let animId;
    function animate() {
      animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }
    animate();

    function onResize() {
      const w = mount.clientWidth, h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);

    sceneRef.current.cleanup = () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('wheel', onWheel);
      mount.removeChild(renderer.domElement);
      renderer.dispose();
    };

    return () => sceneRef.current.cleanup && sceneRef.current.cleanup();
  }, []);

  // Rebuild the field whenever controls change (also covers the first build)
  useEffect(() => {
    if (sceneRef.current.buildField) {
      sceneRef.current.buildField(params.rows, params.panelsPerRow, params.blocks, params.tiltDeg);
    }
  }, [params]);

  const update = (key) => (e) =>
    setParams((p) => ({ ...p, [key]: Number(e.target.value) }));

  const panelStyle = {
    position: 'absolute',
    top: 16,
    left: 16,
    background: 'rgba(12,16,14,0.82)',
    color: '#e7efe9',
    padding: '16px 18px',
    borderRadius: 10,
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    fontSize: 13,
    width: 230,
    backdropFilter: 'blur(6px)',
    lineHeight: 1.5,
  };

  const row = { marginBottom: 10 };
  const labelStyle = { display: 'flex', justifyContent: 'space-between', marginBottom: 4, opacity: 0.85 };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', background: '#000', overflow: 'hidden' }}>
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />

      <div style={panelStyle}>
        <div style={{ fontWeight: 700, fontSize: 13, letterSpacing: 0.5, marginBottom: 12, opacity: 0.9 }}>
          FIELD GENERATOR
        </div>

        <div style={row}>
          <div style={labelStyle}><span>Rows</span><span>{params.rows}</span></div>
          <input type="range" min={10} max={100} value={params.rows} onChange={update('rows')} style={{ width: '100%' }} />
        </div>

        <div style={row}>
          <div style={labelStyle}><span>Panels per row</span><span>{params.panelsPerRow}</span></div>
          <input type="range" min={10} max={150} value={params.panelsPerRow} onChange={update('panelsPerRow')} style={{ width: '100%' }} />
        </div>

        <div style={row}>
          <div style={labelStyle}><span>Blocks</span><span>{params.blocks}</span></div>
          <input type="range" min={1} max={6} value={params.blocks} onChange={update('blocks')} style={{ width: '100%' }} />
        </div>

        <div style={row}>
          <div style={labelStyle}><span>Tilt angle</span><span>{params.tiltDeg}°</span></div>
          <input type="range" min={10} max={40} value={params.tiltDeg} onChange={update('tiltDeg')} style={{ width: '100%' }} />
        </div>

        <div style={{ marginTop: 8, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.12)', opacity: 0.75 }}>
          Panels rendered: {panelCount.toLocaleString()}
        </div>
      </div>

      <div style={{
        position: 'absolute', bottom: 16, left: 16,
        color: 'rgba(255,255,255,0.65)', fontSize: 12,
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      }}>
        Drag to look around · Scroll to zoom
      </div>
    </div>
  );
}
