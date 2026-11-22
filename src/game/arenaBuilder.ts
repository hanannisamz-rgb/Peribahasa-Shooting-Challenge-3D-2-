import * as THREE from 'three';
import type { ProverbQuestion } from '../data/questions';
import {
  createHoloBillboardTexture,
  createSkyscraperPbrTextures,
  drawScoreboardCanvas,
  type MaterialPalette,
} from './materials';

export interface WalkableBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  topY: number;
}

export interface ObstacleBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  maxY: number;
}

export interface ArenaController {
  group: THREE.Group;
  walkables: WalkableBox[];
  obstacles: ObstacleBox[];
  arenaRadius: number;
  update: (time: number, dt: number) => void;
  applyStage: (
    question: ProverbQuestion,
    score: number,
    stars: number,
    questionIndex: number,
    totalQuestions: number,
  ) => void;
  updateScoreboard: (params: {
    stageName: string;
    questionIndex: number;
    totalQuestions: number;
    score: number;
    stars: number;
    peribahasa: string;
  }) => void;
  dispose: () => void;
}

function createChamferedPolygonShape(w: number, d: number, chamfer: number): THREE.Shape {
  const hw = w / 2;
  const hd = d / 2;
  const s = new THREE.Shape();
  s.moveTo(-hw + chamfer, -hd);
  s.lineTo(hw - chamfer, -hd);
  s.lineTo(hw, -hd + chamfer);
  s.lineTo(hw, hd - chamfer);
  s.lineTo(hw - chamfer, hd);
  s.lineTo(-hw + chamfer, hd);
  s.lineTo(-hw, hd - chamfer);
  s.lineTo(-hw, -hd + chamfer);
  s.closePath();
  return s;
}

function createVolumetricConeMaterial(colorHex: number, opacity = 0.22): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(colorHex) },
      uOpacity: { value: opacity },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPos;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewPos;
      void main() {
        vec3 viewDir = normalize(vViewPos);
        float fresnel = pow(abs(dot(vNormal, viewDir)), 1.6);
        float verticalFade = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.15, vUv.y);
        float alpha = uOpacity * fresnel * verticalFade;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

export function buildFuturisticArena(
  scene: THREE.Scene,
  palette: MaterialPalette,
  maxAnisotropy: number,
  isSoftwareGl = false,
): ArenaController {
  const group = new THREE.Group();
  scene.add(group);

  const walkables: WalkableBox[] = [];
  const obstacles: ObstacleBox[] = [];
  const arenaRadius = 26;
  const disposables: { dispose: () => void }[] = [];

  // Dynamic materials that morph across the 7 stages
  const stageAccentMat = new THREE.MeshStandardMaterial({
    color: 0x00e5ff,
    emissive: 0x00e5ff,
    emissiveIntensity: 1.35,
    roughness: 0.2,
    metalness: 0.25,
  });

  const stageSecondaryMat = new THREE.MeshStandardMaterial({
    color: 0x7c3aed,
    emissive: 0x6366f1,
    emissiveIntensity: 0.95,
    roughness: 0.28,
    metalness: 0.35,
  });

  const stageRingMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x38bdf8,
    emissiveIntensity: 1.45,
    roughness: 0.18,
    metalness: 0.15,
  });

  const volumetricMat = createVolumetricConeMaterial(0x22d3ee, 0.2);
  disposables.push(stageAccentMat, stageSecondaryMat, stageRingMat, volumetricMat);

  // 1. Procedural Stylized Twilight Sky Dome
  const skyUniforms = {
    uTime: { value: 0 },
    uZenith: { value: new THREE.Color(0x060b24) },
    uMidSky: { value: new THREE.Color(0x101c4a) },
    uHorizon: { value: new THREE.Color(0x162a68) },
    uAccentGlow: { value: new THREE.Color(0x22d3ee) },
  };
  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uZenith;
      uniform vec3 uMidSky;
      uniform vec3 uHorizon;
      uniform vec3 uAccentGlow;
      varying vec3 vWorldDir;

      void main() {
        float h = clamp(vWorldDir.y, -0.1, 1.0);
        vec3 col = mix(uHorizon, uMidSky, smoothstep(0.0, 0.35, h));
        col = mix(col, uZenith, smoothstep(0.32, 0.9, h));

        // Stylized atmospheric aurora / cloud bands
        float band1 = sin(vWorldDir.x * 5.0 + vWorldDir.z * 3.0 + uTime * 0.18) * 0.5 + 0.5;
        float band2 = cos(vWorldDir.z * 7.0 - vWorldDir.x * 4.0 - uTime * 0.12) * 0.5 + 0.5;
        float ribbon = smoothstep(0.45, 0.95, band1 * band2) * smoothstep(0.04, 0.35, h) * (1.0 - smoothstep(0.45, 0.88, h));
        col += uAccentGlow * ribbon * 0.24;

        // City horizon ambient glow
        float horizonGlow = exp(-max(h, 0.0) * 7.5);
        col += mix(uHorizon, uAccentGlow, 0.35) * horizonGlow * 0.45;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(185, 32, 24), skyMat);
  group.add(skyDome);
  disposables.push(skyMat);

  // 2. Extended City Ground & Multi-Tiered Stepped Plaza
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(280, 280), palette.floorMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.18;
  ground.receiveShadow = true;
  group.add(ground);

  // Stepped circular arena plaza built via LatheGeometry (clean beveled tiers)
  const plazaProfile = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(arenaRadius - 0.5, 0),
    new THREE.Vector2(arenaRadius, -0.03),
    new THREE.Vector2(arenaRadius + 0.8, -0.12),
    new THREE.Vector2(arenaRadius + 1.4, -0.22),
  ];
  const plazaGeo = new THREE.LatheGeometry(plazaProfile, 72);
  const plazaDeck = new THREE.Mesh(plazaGeo, palette.floorMaterial);
  plazaDeck.receiveShadow = true;
  group.add(plazaDeck);

  // Outer bevelled stone curb ring around canal
  const outerCurb = new THREE.Mesh(
    new THREE.RingGeometry(32.2, 36.5, 72),
    palette.plazaRingMaterial,
  );
  outerCurb.rotation.x = -Math.PI / 2;
  outerCurb.position.y = -0.15;
  outerCurb.receiveShadow = true;
  group.add(outerCurb);

  // 3. Reflective Animated Perimeter Water Canal (using onBeforeCompile PBR ripples)
  const waterUniforms = { uTime: { value: 0 } };
  const canalWaterMat = new THREE.MeshStandardMaterial({
    color: 0x0b3a66,
    roughness: 0.08,
    metalness: 0.72,
    envMapIntensity: 1.6,
  });
  canalWaterMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = waterUniforms.uTime;
    shader.vertexShader =
      `uniform float uTime;\nvarying vec3 vWaterWorld;\n` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        float wave = sin(position.x * 0.45 + uTime * 2.1) * cos(position.y * 0.45 - uTime * 1.7) * 0.035;
        transformed.z += wave;
        vWaterWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
        `,
      );
    shader.fragmentShader =
      `uniform float uTime;\nvarying vec3 vWaterWorld;\n` +
      shader.fragmentShader.replace(
        '#include <normal_fragment_maps>',
        `
        #include <normal_fragment_maps>
        float r1 = sin(vWaterWorld.x * 1.4 + uTime * 2.4) * 0.06;
        float r2 = cos(vWaterWorld.z * 1.4 - uTime * 2.0) * 0.06;
        normal = normalize(normal + vec3(r1, 0.0, r2));
        `,
      );
  };
  const canalGeo = new THREE.RingGeometry(arenaRadius + 0.6, 32.4, 96, 4);
  const canalWater = new THREE.Mesh(canalGeo, canalWaterMat);
  canalWater.rotation.x = -Math.PI / 2;
  canalWater.position.y = -0.09;
  canalWater.receiveShadow = true;
  group.add(canalWater);
  disposables.push(canalWaterMat);

  // Glowing perimeter curb ring & inlaid radial court lines
  const perimeterRing = new THREE.Mesh(
    new THREE.TorusGeometry(arenaRadius - 0.15, 0.18, 12, 84),
    stageAccentMat,
  );
  perimeterRing.rotation.x = Math.PI / 2;
  perimeterRing.position.y = 0.06;
  group.add(perimeterRing);

  const innerRing = new THREE.Mesh(
    new THREE.TorusGeometry(13.5, 0.08, 8, 72),
    stageSecondaryMat,
  );
  innerRing.rotation.x = Math.PI / 2;
  innerRing.position.y = 0.025;
  group.add(innerRing);

  // Central sculpted spawn pad medallion
  const spawnMedallion = new THREE.Group();
  spawnMedallion.position.set(0, 0.02, 9);
  const medRingOuter = new THREE.Mesh(
    new THREE.RingGeometry(2.1, 2.55, 48),
    stageRingMat,
  );
  medRingOuter.rotation.x = -Math.PI / 2;
  spawnMedallion.add(medRingOuter);

  const medRingInner = new THREE.Mesh(
    new THREE.RingGeometry(1.15, 1.32, 36),
    palette.chromeMetal,
  );
  medRingInner.rotation.x = -Math.PI / 2;
  medRingInner.position.y = 0.01;
  spawnMedallion.add(medRingInner);
  group.add(spawnMedallion);

  // 4 Sculpted Pedestrian Bridges over the perimeter canal (E, W, S, NE/NW)
  const bridgeAngles = [Math.PI / 2, 0, Math.PI, Math.PI * 0.25, Math.PI * 0.75];
  bridgeAngles.forEach((ang) => {
    const bridge = new THREE.Group();
    const rMid = 29.4;
    bridge.position.set(Math.cos(ang) * rMid, 0.02, Math.sin(ang) * rMid);
    bridge.rotation.y = -ang + Math.PI / 2;

    const spanShape = createChamferedPolygonShape(4.4, 7.2, 0.45);
    const spanGeo = new THREE.ExtrudeGeometry(spanShape, {
      depth: 0.26,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 2,
    });
    spanGeo.center();
    spanGeo.rotateX(Math.PI / 2);
    const spanMesh = new THREE.Mesh(spanGeo, palette.whiteArmor);
    spanMesh.receiveShadow = true;
    bridge.add(spanMesh);

    [-2.05, 2.05].forEach((rx) => {
      const railCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(rx, 0.1, -3.2),
        new THREE.Vector3(rx, 0.95, 0),
        new THREE.Vector3(rx, 0.1, 3.2),
      ]);
      const rail = new THREE.Mesh(
        new THREE.TubeGeometry(railCurve, 16, 0.07, 8, false),
        palette.chromeMetal,
      );
      bridge.add(rail);

      const railGlow = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.08, 6.2),
        stageAccentMat,
      );
      railGlow.position.set(rx, 0.16, 0);
      bridge.add(railGlow);
    });

    group.add(bridge);
  });

  // 4. Sculpted Modern Skyscrapers (3 Architectural Archetypes with PBR Normal/Roughness/Emissive Maps)
  const curtainPbr = createSkyscraperPbrTextures('#22d3ee', '#818cf8', maxAnisotropy, 'curtain');
  const ribbedPbr = createSkyscraperPbrTextures('#a855f7', '#38bdf8', maxAnisotropy, 'ribbed');
  disposables.push(
    curtainPbr.map,
    curtainPbr.emissiveMap,
    curtainPbr.roughnessMap,
    curtainPbr.normalMap,
    ribbedPbr.map,
    ribbedPbr.emissiveMap,
    ribbedPbr.roughnessMap,
    ribbedPbr.normalMap,
  );

  const buildingMatA = new THREE.MeshStandardMaterial({
    map: curtainPbr.map,
    emissive: 0xffffff,
    emissiveMap: curtainPbr.emissiveMap,
    emissiveIntensity: 0.65,
    roughnessMap: curtainPbr.roughnessMap,
    normalMap: curtainPbr.normalMap,
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughness: 0.55,
    metalness: 0.5,
  });

  const buildingMatB = new THREE.MeshStandardMaterial({
    map: ribbedPbr.map,
    emissive: 0xffffff,
    emissiveMap: ribbedPbr.emissiveMap,
    emissiveIntensity: 0.65,
    roughnessMap: ribbedPbr.roughnessMap,
    normalMap: ribbedPbr.normalMap,
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughness: 0.55,
    metalness: 0.55,
  });

  const towerTrimMat = new THREE.MeshStandardMaterial({
    color: 0x162247,
    roughness: 0.35,
    metalness: 0.78,
  });
  disposables.push(buildingMatA, buildingMatB, towerTrimMat);

  const buildingCount = 26;
  for (let i = 0; i < buildingCount; i++) {
    const angle = (i / buildingCount) * Math.PI * 2;
    const ringDist = i % 2 === 0 ? 45 : 64;
    const bx = Math.cos(angle) * ringDist;
    const bz = Math.sin(angle) * ringDist;
    const bw = 9.5 + ((i * 5) % 5);
    const bd = 9.5 + ((i * 7) % 5);
    const bh = 28 + ((i * 11) % 34);
    const archetype = i % 3;

    const bGroup = new THREE.Group();
    bGroup.position.set(bx, -0.2, bz);
    bGroup.lookAt(0, -0.2, 0);

    // Podium base with chamfered overhang
    const podiumShape = createChamferedPolygonShape(bw * 1.24, bd * 1.24, 1.3);
    const podiumGeo = new THREE.ExtrudeGeometry(podiumShape, {
      depth: 5.2,
      bevelEnabled: true,
      bevelThickness: 0.25,
      bevelSize: 0.25,
      bevelSegments: 2,
    });
    podiumGeo.rotateX(-Math.PI / 2);
    const podium = new THREE.Mesh(podiumGeo, towerTrimMat);
    bGroup.add(podium);

    if (archetype === 0) {
      // Archetype A: Stepped Glass Curtain Spire
      const lowerShaft = new THREE.Mesh(
        new THREE.BoxGeometry(bw, bh * 0.62, bd),
        buildingMatA,
      );
      lowerShaft.position.y = 5.2 + bh * 0.31;
      bGroup.add(lowerShaft);

      const skyDeck = new THREE.Mesh(
        new THREE.CylinderGeometry(bw * 0.68, bw * 0.72, 1.4, 8),
        palette.whiteArmor,
      );
      skyDeck.position.y = 5.2 + bh * 0.62 + 0.7;
      bGroup.add(skyDeck);

      const upperShaft = new THREE.Mesh(
        new THREE.BoxGeometry(bw * 0.72, bh * 0.36, bd * 0.72),
        buildingMatA,
      );
      upperShaft.position.y = 5.2 + bh * 0.62 + 1.4 + bh * 0.18;
      bGroup.add(upperShaft);

      const crownHalo = new THREE.Mesh(
        new THREE.TorusGeometry(bw * 0.38, 0.25, 10, 28),
        stageAccentMat,
      );
      crownHalo.rotation.x = Math.PI / 2;
      crownHalo.position.y = 5.2 + bh + 2.1;
      bGroup.add(crownHalo);
    } else if (archetype === 1) {
      // Archetype B: Exo-Braced Megatower with Diagonal Structural Fins
      const shaft = new THREE.Mesh(
        new THREE.BoxGeometry(bw * 0.94, bh, bd * 0.94),
        buildingMatB,
      );
      shaft.position.y = 5.2 + bh / 2;
      bGroup.add(shaft);

      // Vertical corner exo-fins
      const finOffsets = [
        [-bw * 0.5, -bd * 0.5],
        [bw * 0.5, -bd * 0.5],
        [-bw * 0.5, bd * 0.5],
        [bw * 0.5, bd * 0.5],
      ];
      finOffsets.forEach(([fx, fz]) => {
        const fin = new THREE.Mesh(
          new THREE.BoxGeometry(0.9, bh + 3.2, 0.9),
          palette.chromeMetal,
        );
        fin.position.set(fx, 5.2 + bh / 2 + 1.4, fz);
        bGroup.add(fin);
      });

      const crownBeacon = new THREE.Mesh(
        new THREE.BoxGeometry(bw * 0.98, 0.7, bd * 0.98),
        stageSecondaryMat,
      );
      crownBeacon.position.y = 5.2 + bh + 0.4;
      bGroup.add(crownBeacon);
    } else {
      // Archetype C: Tapered Octagonal Terraced Tower
      const tier1 = new THREE.Mesh(
        new THREE.CylinderGeometry(bw * 0.56, bw * 0.64, bh * 0.55, 8),
        buildingMatB,
      );
      tier1.position.y = 5.2 + bh * 0.275;
      bGroup.add(tier1);

      const collarRing = new THREE.Mesh(
        new THREE.CylinderGeometry(bw * 0.62, bw * 0.62, 0.7, 8),
        stageAccentMat,
      );
      collarRing.position.y = 5.2 + bh * 0.55 + 0.35;
      bGroup.add(collarRing);

      const tier2 = new THREE.Mesh(
        new THREE.CylinderGeometry(bw * 0.38, bw * 0.52, bh * 0.42, 8),
        buildingMatA,
      );
      tier2.position.y = 5.2 + bh * 0.55 + 0.7 + bh * 0.21;
      bGroup.add(tier2);

      const spire = new THREE.Mesh(
        new THREE.ConeGeometry(bw * 0.22, 6.5, 8),
        palette.chromeMetal,
      );
      spire.position.y = 5.2 + bh + 3.6;
      bGroup.add(spire);
    }

    group.add(bGroup);
  }

  // Elevated Curved Sky-Viaduct Arches bridging outer skyline
  [-1, 1].forEach((side) => {
    const viaductCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 42, 11, -34),
      new THREE.Vector3(side * 34, 14.5, -14),
      new THREE.Vector3(side * 35, 14.5, 14),
      new THREE.Vector3(side * 42, 11, 34),
    ]);
    const deckPipe = new THREE.Mesh(
      new THREE.TubeGeometry(viaductCurve, 32, 0.85, 10, false),
      towerTrimMat,
    );
    group.add(deckPipe);

    const railLightCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 41.2, 11.7, -34),
      new THREE.Vector3(side * 33.2, 15.2, -14),
      new THREE.Vector3(side * 34.2, 15.2, 14),
      new THREE.Vector3(side * 41.2, 11.7, 34),
    ]);
    const railPipe = new THREE.Mesh(
      new THREE.TubeGeometry(railLightCurve, 32, 0.14, 8, false),
      stageAccentMat,
    );
    group.add(railPipe);
  });

  // 5. Sculpted Perimeter Energy Pylons + Volumetric Light Beams + Curved Lamp Bollards
  const pylonCount = 8;
  const volumetricBeams: THREE.Mesh[] = [];
  const pylonCrystals: THREE.Mesh[] = [];

  for (let i = 0; i < pylonCount; i++) {
    const angle = (i / pylonCount) * Math.PI * 2 + Math.PI / 8;
    const px = Math.cos(angle) * (arenaRadius - 0.35);
    const pz = Math.sin(angle) * (arenaRadius - 0.35);

    const pylon = new THREE.Group();
    pylon.position.set(px, 0, pz);
    pylon.lookAt(0, 0, 0);

    // Lathe-turned tapered pedestal base
    const basePts = [
      new THREE.Vector2(0.05, 0),
      new THREE.Vector2(1.35, 0),
      new THREE.Vector2(1.15, 0.45),
      new THREE.Vector2(0.75, 0.9),
      new THREE.Vector2(0.05, 0.9),
    ];
    const baseMesh = new THREE.Mesh(
      new THREE.LatheGeometry(basePts, 16),
      palette.darkFrame,
    );
    pylon.add(baseMesh);

    // Sculpted twin-fin column shaft
    const finShape = new THREE.Shape();
    finShape.moveTo(-0.42, 0);
    finShape.lineTo(0.42, 0);
    finShape.lineTo(0.28, 7.6);
    finShape.lineTo(-0.28, 7.6);
    finShape.closePath();
    const shaftGeo = new THREE.ExtrudeGeometry(finShape, {
      depth: 0.56,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.07,
      bevelSegments: 2,
    });
    shaftGeo.translate(0, 0.85, -0.28);
    const shaft = new THREE.Mesh(shaftGeo, palette.whiteArmor);
    shaft.castShadow = true;
    pylon.add(shaft);

    const neonStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 6.8, 0.76),
      i % 2 === 0 ? stageAccentMat : stageSecondaryMat,
    );
    neonStrip.position.y = 4.4;
    pylon.add(neonStrip);

    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.62, 0),
      stageAccentMat,
    );
    crystal.position.y = 9.2;
    pylon.add(crystal);
    pylonCrystals.push(crystal);

    // Soft upward volumetric light shaft
    if (!isSoftwareGl || i % 2 === 0) {
      const beamCone = new THREE.Mesh(
        new THREE.ConeGeometry(2.8, 13, 24, 1, true),
        volumetricMat,
      );
      beamCone.rotation.x = Math.PI;
      beamCone.position.y = 15.6;
      pylon.add(beamCone);
      volumetricBeams.push(beamCone);
    }

    group.add(pylon);
  }

  // Instanced Perimeter Illuminated Bollards along the plaza curb
  const bollardCount = 32;
  const bollardGeo = new THREE.CylinderGeometry(0.14, 0.2, 0.95, 12);
  const bollardMesh = new THREE.InstancedMesh(bollardGeo, palette.chromeMetal, bollardCount);
  const bollardCapGeo = new THREE.SphereGeometry(0.16, 10, 10);
  const bollardCaps = new THREE.InstancedMesh(bollardCapGeo, stageAccentMat, bollardCount);
  const bDummy = new THREE.Object3D();

  for (let i = 0; i < bollardCount; i++) {
    const ang = (i / bollardCount) * Math.PI * 2;
    const bx = Math.cos(ang) * (arenaRadius + 0.15);
    const bz = Math.sin(ang) * (arenaRadius + 0.15);
    bDummy.position.set(bx, 0.45, bz);
    bDummy.updateMatrix();
    bollardMesh.setMatrixAt(i, bDummy.matrix);

    bDummy.position.set(bx, 0.98, bz);
    bDummy.updateMatrix();
    bollardCaps.setMatrixAt(i, bDummy.matrix);
  }
  bollardMesh.computeBoundingSphere();
  bollardCaps.computeBoundingSphere();
  group.add(bollardMesh);
  group.add(bollardCaps);

  // 6. Sculpted Grand Parabolic Championship Archway & Giant 3D Scoreboard
  const archGroup = new THREE.Group();
  archGroup.position.set(0, 0, -27.2);

  // Sweeping twin parabolic arch ribs via TubeGeometry
  [-0.85, 0.85].forEach((zOff) => {
    const archCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-17.8, 0, zOff),
      new THREE.Vector3(-15.5, 10.5, zOff),
      new THREE.Vector3(-8.5, 17.8, zOff),
      new THREE.Vector3(0, 19.6, zOff),
      new THREE.Vector3(8.5, 17.8, zOff),
      new THREE.Vector3(15.5, 10.5, zOff),
      new THREE.Vector3(17.8, 0, zOff),
    ]);
    const archRib = new THREE.Mesh(
      new THREE.TubeGeometry(archCurve, 48, 0.68, 12, false),
      palette.whiteArmor,
    );
    archRib.castShadow = true;
    archGroup.add(archRib);
  });

  // Glowing inner energy arch conduit
  const glowArchCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-16.6, 0.2, 0),
    new THREE.Vector3(-14.2, 10.2, 0),
    new THREE.Vector3(-7.6, 16.9, 0),
    new THREE.Vector3(0, 18.6, 0),
    new THREE.Vector3(7.6, 16.9, 0),
    new THREE.Vector3(14.2, 10.2, 0),
    new THREE.Vector3(16.6, 0.2, 0),
  ]);
  const glowArchTube = new THREE.Mesh(
    new THREE.TubeGeometry(glowArchCurve, 48, 0.24, 10, false),
    stageAccentMat,
  );
  archGroup.add(glowArchTube);

  // Sculpted buttress pedestals at arch feet
  [-17.8, 17.8].forEach((ax) => {
    const footShape = createChamferedPolygonShape(3.2, 3.4, 0.45);
    const footGeo = new THREE.ExtrudeGeometry(footShape, {
      depth: 2.2,
      bevelEnabled: true,
      bevelThickness: 0.15,
      bevelSize: 0.15,
      bevelSegments: 2,
    });
    footGeo.rotateX(-Math.PI / 2);
    const foot = new THREE.Mesh(footGeo, palette.blueArmor);
    foot.position.set(ax, 0, 0);
    archGroup.add(foot);
  });
  group.add(archGroup);

  // Large 3D Arena Scoreboard (Live CanvasTexture in Beveled Frame)
  const scoreCanvas = document.createElement('canvas');
  scoreCanvas.width = 1024;
  scoreCanvas.height = 512;
  drawScoreboardCanvas(scoreCanvas, {
    stageName: 'Tahap 1: Arena Permulaan',
    questionIndex: 0,
    totalQuestions: 7,
    score: 0,
    stars: 0,
    peribahasa: '“Tidak lapuk dek hujan, tidak lekang dek panas.”',
  });
  const scoreTexture = new THREE.CanvasTexture(scoreCanvas);
  scoreTexture.colorSpace = THREE.SRGBColorSpace;
  scoreTexture.anisotropy = maxAnisotropy;
  disposables.push(scoreTexture);

  const scoreboardGroup = new THREE.Group();
  scoreboardGroup.position.set(0, 11.4, -26.5);

  const boardFrameShape = createChamferedPolygonShape(19.0, 9.8, 0.85);
  const boardFrameGeo = new THREE.ExtrudeGeometry(boardFrameShape, {
    depth: 0.75,
    bevelEnabled: true,
    bevelThickness: 0.14,
    bevelSize: 0.14,
    bevelSegments: 3,
  });
  boardFrameGeo.center();
  const boardHousing = new THREE.Mesh(boardFrameGeo, palette.darkFrame);
  scoreboardGroup.add(boardHousing);

  const boardTrimShape = createChamferedPolygonShape(19.4, 10.2, 0.92);
  const boardTrimGeo = new THREE.ExtrudeGeometry(boardTrimShape, {
    depth: 0.35,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.08,
    bevelSegments: 2,
  });
  boardTrimGeo.center();
  const boardTrim = new THREE.Mesh(boardTrimGeo, stageSecondaryMat);
  boardTrim.position.z = -0.18;
  scoreboardGroup.add(boardTrim);

  const boardScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(17.8, 8.8),
    new THREE.MeshBasicMaterial({ map: scoreTexture }),
  );
  boardScreen.position.z = 0.54;
  scoreboardGroup.add(boardScreen);
  group.add(scoreboardGroup);

  // 7. Holographic Billboards on Left & Right Flanks with Sculpted Emitter Pedestals
  const holoLeftTex = createHoloBillboardTexture(
    'CABARAN PERIBAHASA',
    'TEMBAK JAWAPAN YANG BETUL!',
    '#22d3ee',
    maxAnisotropy,
  );
  const holoRightTex = createHoloBillboardTexture(
    'ARENA FUTURISTIK',
    'BAHASA MELAYU TAHUN 4',
    '#c084fc',
    maxAnisotropy,
  );
  disposables.push(holoLeftTex, holoRightTex);

  const buildBillboard = (
    x: number,
    y: number,
    z: number,
    rotY: number,
    tex: THREE.CanvasTexture,
  ) => {
    const bb = new THREE.Group();
    bb.position.set(x, y, z);
    bb.rotation.y = rotY;

    const frameShape = createChamferedPolygonShape(8.8, 4.6, 0.45);
    const frameGeo = new THREE.ExtrudeGeometry(frameShape, {
      depth: 0.28,
      bevelEnabled: true,
      bevelThickness: 0.07,
      bevelSize: 0.07,
      bevelSegments: 2,
    });
    frameGeo.center();
    const frame = new THREE.Mesh(frameGeo, palette.darkFrame);
    bb.add(frame);

    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(8.1, 4.0),
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: 0.96,
      }),
    );
    screen.position.z = 0.24;
    bb.add(screen);

    // Lathe-turned projector pylon column
    const postPts = [
      new THREE.Vector2(0.05, 0),
      new THREE.Vector2(0.7, 0),
      new THREE.Vector2(0.45, 0.8),
      new THREE.Vector2(0.28, y - 2.2),
      new THREE.Vector2(0.55, y - 1.8),
    ];
    const post = new THREE.Mesh(
      new THREE.LatheGeometry(postPts, 16),
      palette.chromeMetal,
    );
    post.position.y = -y;
    bb.add(post);

    group.add(bb);
    return bb;
  };

  const leftBillboard = buildBillboard(-21, 7.5, -14, Math.PI / 3.5, holoLeftTex);
  const rightBillboard = buildBillboard(21, 7.5, -14, -Math.PI / 3.5, holoRightTex);

  // 8. High-Detail Sculpted Floating Platforms (Exact walkable bounds preserved!)
  const floatingPads: { mesh: THREE.Group; baseY: number; phase: number }[] = [];
  const platformSpecs = [
    { x: -8.5, y: 1.5, z: -3.5, w: 4.8, d: 4.0 },
    { x: 8.5, y: 1.5, z: -3.5, w: 4.8, d: 4.0 },
    { x: 0, y: 2.3, z: -8.5, w: 5.6, d: 4.2 },
    { x: -13.5, y: 2.6, z: 3.5, w: 4.2, d: 4.2 },
    { x: 13.5, y: 2.6, z: 3.5, w: 4.2, d: 4.2 },
  ];

  const podPts = [
    new THREE.Vector2(0.04, 0),
    new THREE.Vector2(0.32, 0.08),
    new THREE.Vector2(0.38, 0.28),
    new THREE.Vector2(0.22, 0.44),
    new THREE.Vector2(0.04, 0.44),
  ];
  const podGeo = new THREE.LatheGeometry(podPts, 16);

  platformSpecs.forEach((spec, idx) => {
    const pad = new THREE.Group();
    pad.position.set(spec.x, spec.y, spec.z);

    // Beveled octagonal deck plate
    const deckShape = createChamferedPolygonShape(spec.w, spec.d, 0.55);
    const deckGeo = new THREE.ExtrudeGeometry(deckShape, {
      depth: 0.34,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.06,
      bevelSegments: 2,
    });
    deckGeo.center();
    deckGeo.rotateX(Math.PI / 2);
    const deckMesh = new THREE.Mesh(deckGeo, palette.platformTop);
    deckMesh.receiveShadow = true;
    deckMesh.castShadow = true;
    pad.add(deckMesh);

    // Recessed glowing perimeter trim
    const rimShape = createChamferedPolygonShape(spec.w + 0.14, spec.d + 0.14, 0.6);
    const rimGeo = new THREE.ExtrudeGeometry(rimShape, {
      depth: 0.1,
      bevelEnabled: false,
    });
    rimGeo.center();
    rimGeo.rotateX(Math.PI / 2);
    const rim = new THREE.Mesh(
      rimGeo,
      idx % 2 === 0 ? stageAccentMat : stageSecondaryMat,
    );
    rim.position.y = -0.14;
    pad.add(rim);

    // Tapered under-hull chassis
    const underHull = new THREE.Mesh(
      new THREE.CylinderGeometry(
        Math.min(spec.w, spec.d) * 0.42,
        Math.min(spec.w, spec.d) * 0.22,
        0.35,
        8,
      ),
      palette.darkFrame,
    );
    underHull.position.y = -0.35;
    pad.add(underHull);

    // 4 Corner magnetic levitation pods
    const cornerOffsets = [
      [-spec.w * 0.36, -spec.d * 0.36],
      [spec.w * 0.36, -spec.d * 0.36],
      [-spec.w * 0.36, spec.d * 0.36],
      [spec.w * 0.36, spec.d * 0.36],
    ];
    cornerOffsets.forEach(([cx, cz]) => {
      const pod = new THREE.Mesh(podGeo, palette.chromeMetal);
      pod.position.set(cx, -0.48, cz);
      pad.add(pod);

      const podGlow = new THREE.Mesh(
        new THREE.TorusGeometry(0.26, 0.045, 8, 16),
        stageAccentMat,
      );
      podGlow.rotation.x = Math.PI / 2;
      podGlow.position.set(cx, -0.46, cz);
      pad.add(podGlow);
    });

    // Soft downward volumetric levitation glow cone
    const underCone = new THREE.Mesh(
      new THREE.ConeGeometry(Math.min(spec.w, spec.d) * 0.38, spec.y - 0.2, 20, 1, true),
      volumetricMat,
    );
    underCone.position.y = -0.5 - (spec.y - 0.2) / 2;
    pad.add(underCone);

    group.add(pad);
    floatingPads.push({ mesh: pad, baseY: spec.y, phase: idx * 1.1 });

    walkables.push({
      minX: spec.x - spec.w / 2,
      maxX: spec.x + spec.w / 2,
      minZ: spec.z - spec.d / 2,
      maxZ: spec.z + spec.d / 2,
      topY: spec.y + 0.225,
    });
  });

  // 9. Sculpted Tactical Energy Cover Barriers (Exact obstacle/walkable bounds preserved!)
  const coverSpecs = [
    { x: -5.5, z: 2.5, w: 3.4, h: 1.25, d: 0.9 },
    { x: 5.5, z: 2.5, w: 3.4, h: 1.25, d: 0.9 },
    { x: -11.5, z: -9.5, w: 3.0, h: 1.4, d: 1.0 },
    { x: 11.5, z: -9.5, w: 3.0, h: 1.4, d: 1.0 },
  ];

  coverSpecs.forEach((c) => {
    const barrier = new THREE.Group();
    barrier.position.set(c.x, 0, c.z);

    // Sloped beveled lower base
    const baseShape = createChamferedPolygonShape(c.w, c.d, 0.22);
    const baseGeo = new THREE.ExtrudeGeometry(baseShape, {
      depth: c.h * 0.56,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.06,
      bevelSegments: 2,
    });
    baseGeo.rotateX(-Math.PI / 2);
    const body = new THREE.Mesh(baseGeo, palette.barrierBody);
    body.castShadow = true;
    body.receiveShadow = true;
    barrier.add(body);

    // Translucent armored energy shield glass upper wall
    const shieldPane = new THREE.Mesh(
      new THREE.BoxGeometry(c.w * 0.86, c.h * 0.42, 0.14),
      palette.shieldGlass,
    );
    shieldPane.position.y = c.h * 0.78;
    barrier.add(shieldPane);

    // Top horizontal cap rail
    const topRail = new THREE.Mesh(
      new THREE.BoxGeometry(c.w + 0.08, 0.11, 0.24),
      palette.whiteArmor,
    );
    topRail.position.y = c.h;
    barrier.add(topRail);

    // End stanchion pillars
    [-c.w * 0.46, c.w * 0.46].forEach((sx) => {
      const stanchion = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.18, c.h + 0.05, 12),
        palette.chromeMetal,
      );
      stanchion.position.set(sx, c.h / 2, 0);
      stanchion.castShadow = true;
      barrier.add(stanchion);
    });

    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(c.w * 0.82, 0.1, c.d + 0.14),
      stageAccentMat,
    );
    strip.position.y = c.h * 0.48;
    barrier.add(strip);

    group.add(barrier);

    obstacles.push({
      minX: c.x - c.w / 2,
      maxX: c.x + c.w / 2,
      minZ: c.z - c.d / 2,
      maxZ: c.z + c.d / 2,
      maxY: c.h,
    });
    walkables.push({
      minX: c.x - c.w / 2,
      maxX: c.x + c.w / 2,
      minZ: c.z - c.d / 2,
      maxZ: c.z + c.d / 2,
      topY: c.h + 0.07,
    });
  });

  // 10. Sculpted Futuristic Cyber-Trees & Decorative Plaza Fountains
  const cyberTrees: THREE.Group[] = [];
  const treeCoords = [
    [-19, 10],
    [19, 10],
    [-21, -2],
    [21, -2],
  ];

  const planterPts = [
    new THREE.Vector2(0.05, 0),
    new THREE.Vector2(1.42, 0),
    new THREE.Vector2(1.32, 0.36),
    new THREE.Vector2(1.18, 0.56),
    new THREE.Vector2(0.95, 0.56),
    new THREE.Vector2(0.9, 0.35),
    new THREE.Vector2(0.05, 0.35),
  ];
  const planterGeo = new THREE.LatheGeometry(planterPts, 20);

  treeCoords.forEach(([tx, tz], tIdx) => {
    const tree = new THREE.Group();
    tree.position.set(tx, 0, tz);

    const planter = new THREE.Mesh(planterGeo, palette.whiteArmor);
    planter.receiveShadow = true;
    planter.castShadow = true;
    tree.add(planter);

    const planterRim = new THREE.Mesh(
      new THREE.TorusGeometry(1.22, 0.06, 8, 24),
      stageAccentMat,
    );
    planterRim.rotation.x = Math.PI / 2;
    planterRim.position.y = 0.54;
    tree.add(planterRim);

    // Organic curved metallic trunk + 3 sweeping branches via TubeGeometry
    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.3, 0),
      new THREE.Vector3(0.14 * (tIdx % 2 === 0 ? 1 : -1), 1.6, 0.1),
      new THREE.Vector3(0, 3.3, 0),
    ]);
    const trunk = new THREE.Mesh(
      new THREE.TubeGeometry(trunkCurve, 16, 0.22, 10, false),
      palette.chromeMetal,
    );
    trunk.castShadow = true;
    tree.add(trunk);

    const branchAngles = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];
    const crystalNodes: THREE.Mesh[] = [];
    branchAngles.forEach((bAng, bIdx) => {
      const bx = Math.cos(bAng) * 1.15;
      const bz = Math.sin(bAng) * 1.15;
      const bCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 2.7, 0),
        new THREE.Vector3(bx * 0.55, 3.4, bz * 0.55),
        new THREE.Vector3(bx, 4.15 + bIdx * 0.2, bz),
      ]);
      const branch = new THREE.Mesh(
        new THREE.TubeGeometry(bCurve, 12, 0.09, 8, false),
        palette.chromeMetal,
      );
      tree.add(branch);

      const canopy = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.75 + bIdx * 0.08, 1),
        bIdx % 2 === 0 ? stageSecondaryMat : stageAccentMat,
      );
      canopy.position.set(bx, 4.35 + bIdx * 0.2, bz);
      tree.add(canopy);
      crystalNodes.push(canopy);
    });

    const crownOrb = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.95, 1),
      stageAccentMat,
    );
    crownOrb.position.set(0, 4.9, 0);
    tree.add(crownOrb);
    tree.userData.crystals = crystalNodes;
    tree.userData.crown = crownOrb;

    group.add(tree);
    cyberTrees.push(tree);

    obstacles.push({
      minX: tx - 1.25,
      maxX: tx + 1.25,
      minZ: tz - 1.25,
      maxZ: tz + 1.25,
      maxY: 2.5,
    });
  });

  // 2 Decorative Urban Energy-Water Fountains flanking the plaza
  const fountainPositions = [
    [-16.5, -15.5],
    [16.5, -15.5],
  ];
  const fountainPts = [
    new THREE.Vector2(0.05, 0),
    new THREE.Vector2(2.2, 0),
    new THREE.Vector2(2.15, 0.45),
    new THREE.Vector2(1.85, 0.52),
    new THREE.Vector2(1.8, 0.2),
    new THREE.Vector2(0.45, 0.25),
    new THREE.Vector2(0.32, 1.3),
    new THREE.Vector2(0.85, 1.65),
    new THREE.Vector2(0.18, 1.8),
    new THREE.Vector2(0.05, 1.8),
  ];
  const fountainGeo = new THREE.LatheGeometry(fountainPts, 28);
  const fountainJets: THREE.Mesh[] = [];

  fountainPositions.forEach(([fx, fz]) => {
    const fGroup = new THREE.Group();
    fGroup.position.set(fx, 0, fz);

    const basin = new THREE.Mesh(fountainGeo, palette.whiteArmor);
    basin.castShadow = true;
    basin.receiveShadow = true;
    fGroup.add(basin);

    const fWater = new THREE.Mesh(
      new THREE.CircleGeometry(1.82, 28),
      canalWaterMat,
    );
    fWater.rotation.x = -Math.PI / 2;
    fWater.position.y = 0.36;
    fGroup.add(fWater);

    const jet = new THREE.Mesh(
      new THREE.ConeGeometry(0.48, 2.2, 16, 1, true),
      volumetricMat,
    );
    jet.rotation.x = Math.PI;
    jet.position.y = 2.75;
    fGroup.add(jet);
    fountainJets.push(jet);

    group.add(fGroup);
    obstacles.push({
      minX: fx - 2.1,
      maxX: fx + 2.1,
      minZ: fz - 2.1,
      maxZ: fz + 2.1,
      maxY: 1.9,
    });
  });

  // 11. Overhead Rotating Holographic Energy Rings
  const holoRings: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(13 + i * 4.5, 0.14, 12, 72),
      i % 2 === 0 ? stageRingMat : stageSecondaryMat,
    );
    ring.position.set(0, 14.5 + i * 2.5, -12);
    ring.rotation.x = Math.PI / 2.6 + i * 0.2;
    group.add(ring);
    holoRings.push(ring);
  }

  // 12. Ambient Floating Light Motes via InstancedMesh
  const moteCount = 72;
  const moteGeo = new THREE.OctahedronGeometry(0.13, 0);
  const moteMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });
  const motes = new THREE.InstancedMesh(moteGeo, moteMat, moteCount);
  motes.frustumCulled = false;

  const moteSeeds: { x: number; y: number; z: number; speed: number; phase: number }[] = [];
  const dummy = new THREE.Object3D();
  const colorTmp = new THREE.Color();

  for (let i = 0; i < moteCount; i++) {
    const angle = (i / moteCount) * Math.PI * 2 + (i % 5) * 0.4;
    const dist = 7 + (i % 20) * 1.15;
    moteSeeds.push({
      x: Math.cos(angle) * dist,
      y: 1.0 + (i % 9) * 1.35,
      z: Math.sin(angle) * dist - 4,
      speed: 0.38 + (i % 4) * 0.2,
      phase: i * 0.7,
    });
    const paletteChoice = i % 3 === 0 ? 0x22d3ee : i % 3 === 1 ? 0xa855f7 : 0xffffff;
    colorTmp.setHex(paletteChoice);
    motes.setColorAt(i, colorTmp);
  }
  if (motes.instanceColor) motes.instanceColor.needsUpdate = true;
  group.add(motes);

  const updateScoreboard: ArenaController['updateScoreboard'] = (params) => {
    drawScoreboardCanvas(scoreCanvas, params);
    scoreTexture.needsUpdate = true;
  };

  const applyStage: ArenaController['applyStage'] = (
    question,
    score,
    stars,
    questionIndex,
    totalQuestions,
  ) => {
    const { skyHex, fogHex, accentHex, secondaryHex, ringHex } = question.themeColors;

    skyUniforms.uZenith.value.setHex(skyHex).multiplyScalar(0.75);
    skyUniforms.uMidSky.value.setHex(skyHex);
    skyUniforms.uHorizon.value.setHex(fogHex);
    skyUniforms.uAccentGlow.value.setHex(accentHex);

    scene.background = new THREE.Color(skyHex);
    scene.fog = new THREE.FogExp2(fogHex, 0.0095);

    stageAccentMat.color.setHex(accentHex);
    stageAccentMat.emissive.setHex(accentHex);

    stageSecondaryMat.color.setHex(secondaryHex);
    stageSecondaryMat.emissive.setHex(secondaryHex);

    stageRingMat.color.setHex(ringHex);
    stageRingMat.emissive.setHex(ringHex);

    volumetricMat.uniforms.uColor.value.setHex(accentHex);

    holoRings.forEach((ring, idx) => {
      ring.visible = question.stageNumber >= idx * 2 + 1 || question.stageNumber >= 6;
    });

    updateScoreboard({
      stageName: question.stageName,
      questionIndex,
      totalQuestions,
      score,
      stars,
      peribahasa: question.peribahasa,
    });
  };

  const update: ArenaController['update'] = (time) => {
    skyUniforms.uTime.value = time;
    waterUniforms.uTime.value = time;

    floatingPads.forEach((p) => {
      p.mesh.position.y = p.baseY + Math.sin(time * 1.6 + p.phase) * 0.06;
    });

    leftBillboard.position.y = 7.5;
    rightBillboard.position.y = 7.5;

    holoRings.forEach((ring, idx) => {
      ring.rotation.z = time * (0.18 + idx * 0.08) * (idx % 2 === 0 ? 1 : -1);
      ring.rotation.y = Math.sin(time * 0.35 + idx) * 0.25;
    });

    pylonCrystals.forEach((c, idx) => {
      c.rotation.y = time * 1.1 + idx;
      c.position.y = 9.2 + Math.sin(time * 2.2 + idx) * 0.16;
    });

    cyberTrees.forEach((tree, idx) => {
      const crown = tree.userData.crown as THREE.Mesh | undefined;
      if (crown) crown.rotation.y = time * 0.7 + idx;
    });

    fountainJets.forEach((jet, idx) => {
      const pulse = 0.92 + Math.sin(time * 4.5 + idx) * 0.12;
      jet.scale.set(pulse, 0.9 + Math.cos(time * 3.8 + idx) * 0.14, pulse);
    });

    for (let i = 0; i < moteCount; i++) {
      const m = moteSeeds[i];
      const yOffset = ((time * m.speed + m.phase) % 10.5) + 0.8;
      dummy.position.set(
        m.x + Math.sin(time * 0.7 + m.phase) * 0.6,
        yOffset,
        m.z + Math.cos(time * 0.7 + m.phase) * 0.6,
      );
      dummy.rotation.set(time + m.phase, time * 1.2, 0);
      const s = 0.7 + Math.sin(time * 2 + m.phase) * 0.3;
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      motes.setMatrixAt(i, dummy.matrix);
    }
    motes.instanceMatrix.needsUpdate = true;
  };

  const dispose = () => {
    disposables.forEach((d) => d.dispose());
  };

  return {
    group,
    walkables,
    obstacles,
    arenaRadius,
    update,
    applyStage,
    updateScoreboard,
    dispose,
  };
}
