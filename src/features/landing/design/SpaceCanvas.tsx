import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface SpaceCanvasProps {
  reducedMotion?: boolean;
}

export const SpaceCanvas: React.FC<SpaceCanvasProps> = ({ reducedMotion = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const scrollRef = useRef({ y: 0, targetY: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x05070d, 0.0018);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      2000
    );
    camera.position.set(0, 0, 100);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x05070d, 1);
    container.appendChild(renderer.domElement);

    // --- Capa 2: Starfield (Irregular distribution, diagonal band, 3 clusters) ---
    // Total stars: ~1800 stars with 3 distinct clusters and a diagonal band
    const starCount = 2000;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);

    const colorColdWhite = new THREE.Color('#e8eefc');
    const colorStellarBlue = new THREE.Color('#d6e2ff');
    const colorWarmStar = new THREE.Color('#ffeede');
    const colorCyan = new THREE.Color('#5ee7f7');

    for (let i = 0; i < starCount; i++) {
      let x = 0, y = 0, z = 0;
      const type = Math.random();

      if (type < 0.45) {
        // Diagonal galactic arm across viewport: y ~ 0.6 * x + noise
        const t = (Math.random() - 0.5) * 450;
        const perp = (Math.random() - 0.5) * 70;
        x = t + (Math.random() - 0.5) * 30;
        y = t * 0.55 + perp;
        z = (Math.random() - 0.5) * 350 - 50;
      } else if (type < 0.62) {
        // Cluster 1 (Upper left dense stellar nursery)
        const rad = Math.pow(Math.random(), 1.8) * 60;
        const theta = Math.random() * Math.PI * 2;
        x = -130 + Math.cos(theta) * rad;
        y = 90 + Math.sin(theta) * rad;
        z = (Math.random() - 0.5) * 200 - 80;
      } else if (type < 0.77) {
        // Cluster 2 (Mid-right sparse open cluster)
        const rad = Math.pow(Math.random(), 1.5) * 85;
        const theta = Math.random() * Math.PI * 2;
        x = 140 + Math.cos(theta) * rad;
        y = -20 + Math.sin(theta) * rad;
        z = (Math.random() - 0.5) * 250 - 60;
      } else if (type < 0.88) {
        // Cluster 3 (Deep faint cluster in lower horizon)
        const rad = Math.pow(Math.random(), 2.0) * 45;
        const theta = Math.random() * Math.PI * 2;
        x = 30 + Math.cos(theta) * rad;
        y = -110 + Math.sin(theta) * rad;
        z = (Math.random() - 0.5) * 220 - 100;
      } else {
        // General background deep void field (sparse)
        x = (Math.random() - 0.5) * 600;
        y = (Math.random() - 0.5) * 500;
        z = (Math.random() - 0.5) * 450 - 100;
      }

      starPositions[i * 3] = x;
      starPositions[i * 3 + 1] = y;
      starPositions[i * 3 + 2] = z;

      // Color selection
      const colRand = Math.random();
      let chosenColor = colorColdWhite;
      if (colRand < 0.55) chosenColor = colorColdWhite;
      else if (colRand < 0.82) chosenColor = colorStellarBlue;
      else if (colRand < 0.94) chosenColor = colorWarmStar;
      else chosenColor = colorCyan;

      starColors[i * 3] = chosenColor.r;
      starColors[i * 3 + 1] = chosenColor.g;
      starColors[i * 3 + 2] = chosenColor.b;

      // Sizes: varied depth scale
      starSizes[i] = Math.random() * 2.2 + 0.8;
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    starGeometry.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));

    // Custom star sprite canvas texture
    const starCanvas = document.createElement('canvas');
    starCanvas.width = 32;
    starCanvas.height = 32;
    const starCtx = starCanvas.getContext('2d')!;
    const starGradient = starCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
    starGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    starGradient.addColorStop(0.25, 'rgba(230, 240, 255, 0.85)');
    starGradient.addColorStop(0.7, 'rgba(94, 231, 247, 0.15)');
    starGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    starCtx.fillStyle = starGradient;
    starCtx.fillRect(0, 0, 32, 32);

    const starTexture = new THREE.CanvasTexture(starCanvas);

    const starMaterial = new THREE.PointsMaterial({
      size: 1.6,
      vertexColors: true,
      map: starTexture,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const starField = new THREE.Points(starGeometry, starMaterial);
    scene.add(starField);

    // --- Capa 4: Cosmic Dust Particles (14 to 64 visible motes) ---
    const dustCount = 48;
    const dustGeometry = new THREE.BufferGeometry();
    const dustPositions = new Float32Array(dustCount * 3);
    const dustColors = new Float32Array(dustCount * 3);
    const dustVelocities: { x: number; y: number; z: number }[] = [];

    const cianStellar = new THREE.Color('#5ee7f7');
    const violetSelect = new THREE.Color('#8b7cf6');
    const whiteMote = new THREE.Color('#e6ecfa');
    const magentaRare = new THREE.Color('#e879c6');

    for (let i = 0; i < dustCount; i++) {
      dustPositions[i * 3] = (Math.random() - 0.5) * 160;
      dustPositions[i * 3 + 1] = (Math.random() - 0.5) * 120;
      dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 80 + 30; // closer to camera

      const r = Math.random();
      let col = whiteMote;
      if (r < 0.45) col = cianStellar;
      else if (r < 0.78) col = violetSelect;
      else if (r < 0.95) col = whiteMote;
      else col = magentaRare; // minimal rare magenta

      dustColors[i * 3] = col.r;
      dustColors[i * 3 + 1] = col.g;
      dustColors[i * 3 + 2] = col.b;

      dustVelocities.push({
        x: (Math.random() - 0.5) * 0.012,
        y: (Math.random() - 0.5) * 0.009 + 0.004,
        z: (Math.random() - 0.5) * 0.008,
      });
    }

    dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    dustGeometry.setAttribute('color', new THREE.BufferAttribute(dustColors, 3));

    const dustMaterial = new THREE.PointsMaterial({
      size: 3.2,
      map: starTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const dustPoints = new THREE.Points(dustGeometry, dustMaterial);
    scene.add(dustPoints);

    // --- Capa 5: Cuerpos Celestes ---

    // 1. Objeto Principal: Planeta Cian con iluminación lateral a las 10 en punto
    // Light direction: from top-left (10 o'clock)
    const planetGroup = new THREE.Group();
    planetGroup.position.set(42, 4, 15); // Asymmetric editorial position on right flank

    // Texture generation for cyan planet: procedural atmospheric rings and tectonic fissures
    const planetCanvas = document.createElement('canvas');
    planetCanvas.width = 1024;
    planetCanvas.height = 512;
    const pCtx = planetCanvas.getContext('2d')!;

    // Base deep oceanic dark cyan
    pCtx.fillStyle = '#09152b';
    pCtx.fillRect(0, 0, 1024, 512);

    // Subtle atmospheric swirls and geological bands
    pCtx.strokeStyle = 'rgba(94, 231, 247, 0.22)';
    pCtx.lineWidth = 14;
    for (let i = 0; i < 28; i++) {
      const y = (i / 28) * 512 + Math.sin(i * 1.4) * 12;
      pCtx.beginPath();
      pCtx.moveTo(0, y);
      pCtx.bezierCurveTo(
        256, y + Math.sin(i) * 24,
        768, y - Math.cos(i) * 24,
        1024, y
      );
      pCtx.stroke();
    }

    // Faint subtle continental plates
    pCtx.fillStyle = 'rgba(20, 48, 86, 0.45)';
    for (let i = 0; i < 18; i++) {
      const cx = (i * 97) % 1024;
      const cy = (i * 61) % 512;
      const rad = 25 + (i * 7) % 45;
      pCtx.beginPath();
      pCtx.arc(cx, cy, rad, 0, Math.PI * 2);
      pCtx.fill();
    }

    const planetTexture = new THREE.CanvasTexture(planetCanvas);
    planetTexture.wrapS = THREE.RepeatWrapping;

    const planetGeom = new THREE.SphereGeometry(18, 64, 64);
    const planetMat = new THREE.MeshStandardMaterial({
      map: planetTexture,
      roughness: 0.65,
      metalness: 0.2,
      color: 0x48d6e8,
      emissive: 0x051329,
      emissiveIntensity: 0.15,
    });

    const planetMesh = new THREE.Mesh(planetGeom, planetMat);
    planetGroup.add(planetMesh);

    // Atmospheric Rayleigh rim glow (Cyan outer atmosphere shell)
    const atmosphereGeom = new THREE.SphereGeometry(18.5, 64, 64);
    const atmosphereMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.68 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.2);
          gl_FragColor = vec4(0.368, 0.905, 0.968, 1.0) * intensity * 1.6;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    const atmosphereMesh = new THREE.Mesh(atmosphereGeom, atmosphereMat);
    planetGroup.add(atmosphereMesh);

    // Subtle orbital ring around planet
    const ringGeom = new THREE.RingGeometry(22, 28, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x5ee7f7,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ringMesh = new THREE.Mesh(ringGeom, ringMat);
    ringMesh.rotation.x = Math.PI / 2.3;
    ringMesh.rotation.y = -Math.PI / 6;
    planetGroup.add(ringMesh);

    scene.add(planetGroup);

    // 2. Objeto Secundario: Esfera Violeta más pequeña y distante
    const violetPlanetGeom = new THREE.SphereGeometry(6.5, 32, 32);
    const violetPlanetMat = new THREE.MeshStandardMaterial({
      color: 0x8b7cf6,
      roughness: 0.8,
      metalness: 0.1,
      emissive: 0x241442,
      emissiveIntensity: 0.25,
    });
    const violetPlanetMesh = new THREE.Mesh(violetPlanetGeom, violetPlanetMat);
    violetPlanetMesh.position.set(-68, -26, -50); // deeper back, left
    scene.add(violetPlanetMesh);

    // Subtle violet atmosphere halo
    const violetHaloGeom = new THREE.SphereGeometry(7.0, 32, 32);
    const violetHaloMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
          gl_FragColor = vec4(0.545, 0.486, 0.964, 1.0) * intensity * 1.2;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    const violetHalo = new THREE.Mesh(violetHaloGeom, violetHaloMat);
    violetPlanetMesh.add(violetHalo);

    // 3. Objeto Terciario: Estrella puntual con halo delicado y espigas de difracción
    const starCoreCanvas = document.createElement('canvas');
    starCoreCanvas.width = 128;
    starCoreCanvas.height = 128;
    const scCtx = starCoreCanvas.getContext('2d')!;

    // Circular core
    const radG = scCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
    radG.addColorStop(0, 'rgba(255, 255, 255, 1)');
    radG.addColorStop(0.12, 'rgba(230, 245, 255, 0.9)');
    radG.addColorStop(0.4, 'rgba(94, 231, 247, 0.3)');
    radG.addColorStop(1, 'rgba(0, 0, 0, 0)');
    scCtx.fillStyle = radG;
    scCtx.fillRect(0, 0, 128, 128);

    // 4-point subtle diffraction spikes
    scCtx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    scCtx.lineWidth = 1.2;
    scCtx.beginPath();
    scCtx.moveTo(64, 8);
    scCtx.lineTo(64, 120);
    scCtx.moveTo(8, 64);
    scCtx.lineTo(120, 64);
    scCtx.stroke();

    const starPointTexture = new THREE.CanvasTexture(starCoreCanvas);
    const starPointMat = new THREE.SpriteMaterial({
      map: starPointTexture,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });
    const starPointSprite = new THREE.Sprite(starPointMat);
    starPointSprite.scale.set(16, 16, 1);
    starPointSprite.position.set(-36, 42, -15);
    scene.add(starPointSprite);

    // --- Lighting Architecture (Strict: 10 o'clock lateral light) ---
    // Ambient light: low intensity so space remains dark and moody
    const ambientLight = new THREE.AmbientLight(0x0b1124, 0.7);
    scene.add(ambientLight);

    // Directional light: 10 o'clock angle (upper-left, slightly forward)
    const sunLight = new THREE.DirectionalLight(0xe8f4ff, 2.8);
    sunLight.position.set(-60, 50, 45); // 10 o'clock position
    scene.add(sunLight);

    // Subtle cyan rim fill light from lower right
    const cyanRimLight = new THREE.DirectionalLight(0x5ee7f7, 0.6);
    cyanRimLight.position.set(50, -30, -20);
    scene.add(cyanRimLight);

    // Subtle violet atmospheric fill
    const violetFillLight = new THREE.DirectionalLight(0x8b7cf6, 0.35);
    violetFillLight.position.set(-80, -40, 10);
    scene.add(violetFillLight);

    // --- Event Listeners for Parallax and Responsiveness ---
    const handleMouseMove = (e: MouseEvent) => {
      if (reducedMotion) return;
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -(e.clientY / window.innerHeight) * 2 + 1;
      mouseRef.current.targetX = x * 8;
      mouseRef.current.targetY = y * 6;
    };

    const handleScroll = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      scrollRef.current.targetY = scrollY * 0.04;
    };

    const handleResize = () => {
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    // --- Animation Loop ---
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Smooth damping interpolation (lerp)
      if (!reducedMotion) {
        mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
        mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;
        scrollRef.current.y += (scrollRef.current.targetY - scrollRef.current.y) * 0.06;
      }

      // Camera responds with delicate parallax and scroll glide
      camera.position.x = mouseRef.current.x;
      camera.position.y = mouseRef.current.y - scrollRef.current.y;
      camera.lookAt(0, -scrollRef.current.y * 0.7, 0);

      // Celestial Bodies motion
      // 1. Cyan planet subtle axial spin and slow orbital drift
      planetMesh.rotation.y = elapsed * 0.04;
      planetGroup.rotation.z = Math.sin(elapsed * 0.08) * 0.02;
      planetGroup.position.y = 4 + Math.sin(elapsed * 0.3) * 0.6;

      // 2. Violet sphere counter-drift
      violetPlanetMesh.rotation.y = -elapsed * 0.03;
      violetPlanetMesh.position.y = -26 + Math.cos(elapsed * 0.25) * 0.8;
      violetPlanetMesh.position.x = -68 + Math.sin(elapsed * 0.15) * 0.6;

      // 3. Point star subtle twinkle
      starPointSprite.scale.set(
        15 + Math.sin(elapsed * 2.4) * 1.5,
        15 + Math.sin(elapsed * 2.4) * 1.5,
        1
      );

      // 4. Cosmic dust particles drifting smoothly
      const posAttr = dustGeometry.attributes.position as THREE.BufferAttribute;
      const posArray = posAttr.array as Float32Array;
      for (let i = 0; i < dustCount; i++) {
        const vel = dustVelocities[i];
        if (!vel) continue;
        const ix = i * 3;
        const x = (posArray[ix] ?? 0) + vel.x;
        const y = (posArray[ix + 1] ?? 0) + vel.y;
        const z = (posArray[ix + 2] ?? 0) + vel.z;
        posArray[ix] = x > 90 ? -90 : x < -90 ? 90 : x;
        posArray[ix + 1] = y > 70 ? -70 : y < -70 ? 70 : y;
        posArray[ix + 2] = z;
      }
      posAttr.needsUpdate = true;

      // Starfield slow orbital roll
      starField.rotation.y = elapsed * 0.003;
      starField.rotation.x = elapsed * 0.0015;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);

      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      renderer.forceContextLoss();
      renderer.dispose();
      violetHaloGeom.dispose();
      violetHaloMat.dispose();
      starPointTexture.dispose();
      starPointMat.dispose();
      starGeometry.dispose();
      starMaterial.dispose();
      dustGeometry.dispose();
      dustMaterial.dispose();
      planetGeom.dispose();
      planetMat.dispose();
      atmosphereGeom.dispose();
      atmosphereMat.dispose();
      ringGeom.dispose();
      ringMat.dispose();
      violetPlanetGeom.dispose();
      violetPlanetMat.dispose();
      starTexture.dispose();
      planetTexture.dispose();
    };
  }, [reducedMotion]);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Capa 1: Void Radial Background Vignette with Deep Dark Core */}
      <div
        className="absolute inset-0 bg-[#05070d]"
        style={{
          backgroundImage: `
            radial-gradient(circle at 50% 30%, #0b1124 0%, #070a16 55%, #05070d 100%)
          `,
        }}
      />

      {/* Capa 3: Diffuse Organic Nebulae (Strictly adhering to prompt specs) */}
      {/* 3.1 Violet nebula in upper left */}
      <div
        className="absolute -top-[15%] -left-[10%] w-[55vw] h-[55vw] rounded-full blur-[140px] opacity-25 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, #8b7cf6 0%, rgba(139, 124, 246, 0.12) 60%, transparent 80%)',
        }}
      />

      {/* 3.2 Deep blue towards right */}
      <div
        className="absolute top-[25%] -right-[15%] w-[65vw] h-[65vw] rounded-full blur-[160px] opacity-35 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, #0e1e47 0%, rgba(11, 17, 36, 0.4) 65%, transparent 85%)',
        }}
      />

      {/* 3.3 Faint cyan in lower sector */}
      <div
        className="absolute -bottom-[20%] left-[20%] w-[50vw] h-[45vw] rounded-full blur-[130px] opacity-20 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, #5ee7f7 0%, rgba(94, 231, 247, 0.08) 55%, transparent 75%)',
        }}
      />

      {/* 3.4 Minimal magenta smudge (strictly scarce) */}
      <div
        className="absolute top-[48%] left-[12%] w-[18vw] h-[18vw] rounded-full blur-[90px] opacity-[0.07] pointer-events-none"
        style={{
          background: 'radial-gradient(circle, #e879c6 0%, transparent 70%)',
        }}
      />

      {/* Subtle edge vignette overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(5, 7, 13, 0.75) 100%)',
        }}
      />

      {/* Three.js Canvas Container (Capa 2, 4, 5) */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
};
