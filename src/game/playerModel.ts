import * as THREE from 'three';
import type { MaterialPalette } from './materials';

export interface PlayerRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  headGroup: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  blasterGroup: THREE.Group;
  muzzleAnchor: THREE.Object3D;
  muzzleFlash: THREE.Mesh;
  contactShadow: THREE.Mesh;
  updateAnimation: (params: {
    dt: number;
    time: number;
    moveSpeed: number;
    isGrounded: boolean;
    aimPitch: number;
    recoil: number;
    victoryMode: boolean;
    playerY: number;
  }) => void;
}

function createBeveledShieldShape(w: number, h: number): THREE.Shape {
  const hw = w / 2;
  const hh = h / 2;
  const ch = Math.min(w, h) * 0.22;
  const s = new THREE.Shape();
  s.moveTo(-hw + ch, -hh);
  s.lineTo(hw - ch, -hh);
  s.lineTo(hw, -hh + ch);
  s.lineTo(hw, hh - ch);
  s.lineTo(hw - ch, hh);
  s.lineTo(-hw + ch, hh);
  s.lineTo(-hw, hh - ch);
  s.lineTo(-hw, -hh + ch);
  s.closePath();
  return s;
}

export function createLaserBlaster(palette: MaterialPalette): {
  blaster: THREE.Group;
  muzzleAnchor: THREE.Object3D;
  muzzleFlash: THREE.Mesh;
} {
  const blaster = new THREE.Group();

  // 1. Sculpted beveled main receiver body
  const receiverProfile = new THREE.Shape();
  receiverProfile.moveTo(-0.07, -0.08);
  receiverProfile.lineTo(0.07, -0.08);
  receiverProfile.lineTo(0.085, 0.04);
  receiverProfile.lineTo(0.055, 0.11);
  receiverProfile.lineTo(-0.055, 0.11);
  receiverProfile.lineTo(-0.085, 0.04);
  receiverProfile.closePath();

  const receiverGeo = new THREE.ExtrudeGeometry(receiverProfile, {
    depth: 0.56,
    bevelEnabled: true,
    bevelThickness: 0.018,
    bevelSize: 0.014,
    bevelSegments: 2,
  });
  receiverGeo.center();
  const receiver = new THREE.Mesh(receiverGeo, palette.whiteArmor);
  receiver.position.set(0, 0.01, -0.22);
  receiver.castShadow = true;
  blaster.add(receiver);

  // 2. Angled ergonomic grip with pommel cap
  const grip = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.052, 0.16, 6, 12),
    palette.darkFrame,
  );
  grip.position.set(0, -0.15, 0.02);
  grip.rotation.x = 0.28;
  grip.castShadow = true;
  blaster.add(grip);

  // 3. Purple upper shroud with cooling fin slats
  const shroudShape = createBeveledShieldShape(0.14, 0.075);
  const shroudGeo = new THREE.ExtrudeGeometry(shroudShape, {
    depth: 0.42,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 2,
  });
  shroudGeo.center();
  const shroud = new THREE.Mesh(shroudGeo, palette.purpleAccent);
  shroud.position.set(0, 0.105, -0.23);
  shroud.castShadow = true;
  blaster.add(shroud);

  // 4. Lathe-turned tapered chrome barrel + cooling collar
  const barrelPoints = [
    new THREE.Vector2(0.062, 0.0),
    new THREE.Vector2(0.062, 0.08),
    new THREE.Vector2(0.046, 0.12),
    new THREE.Vector2(0.046, 0.34),
    new THREE.Vector2(0.066, 0.36),
    new THREE.Vector2(0.058, 0.4),
    new THREE.Vector2(0.032, 0.4),
  ];
  const barrelGeo = new THREE.LatheGeometry(barrelPoints, 20);
  barrelGeo.rotateX(-Math.PI / 2);
  const barrel = new THREE.Mesh(barrelGeo, palette.chromeMetal);
  barrel.position.set(0, 0.01, -0.46);
  barrel.castShadow = true;
  blaster.add(barrel);

  // 5. Glowing cyan plasma chamber coils (3 rings)
  for (let i = 0; i < 3; i++) {
    const coil = new THREE.Mesh(
      new THREE.TorusGeometry(0.068, 0.014, 8, 18),
      palette.cyanGlow,
    );
    coil.position.set(0, 0.015, -0.16 - i * 0.11);
    blaster.add(coil);
  }

  // 6. Side energy conduit tube
  const conduitCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.075, -0.02, -0.02),
    new THREE.Vector3(0.105, 0.01, -0.2),
    new THREE.Vector3(0.072, 0.02, -0.44),
  ]);
  const conduit = new THREE.Mesh(
    new THREE.TubeGeometry(conduitCurve, 16, 0.014, 8, false),
    palette.cyanGlow,
  );
  blaster.add(conduit);

  // 7. Holographic optical sight housing & glass lens
  const sightBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.04, 0.12),
    palette.darkFrame,
  );
  sightBase.position.set(0, 0.16, -0.16);
  blaster.add(sightBase);

  const sightRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.048, 0.012, 10, 24),
    palette.cyanGlow,
  );
  sightRing.position.set(0, 0.21, -0.16);
  blaster.add(sightRing);

  const sightLens = new THREE.Mesh(
    new THREE.CircleGeometry(0.04, 18),
    palette.shieldGlass,
  );
  sightLens.position.set(0, 0.21, -0.16);
  blaster.add(sightLens);

  // 8. Muzzle emitter ring
  const muzzleTip = new THREE.Mesh(
    new THREE.TorusGeometry(0.062, 0.015, 10, 20),
    palette.cyanGlow,
  );
  muzzleTip.position.set(0, 0.01, -0.86);
  blaster.add(muzzleTip);

  // Muzzle anchor for projectile spawn
  const muzzleAnchor = new THREE.Object3D();
  muzzleAnchor.position.set(0, 0.01, -0.9);
  blaster.add(muzzleAnchor);

  const muzzleFlashMat = new THREE.MeshBasicMaterial({
    color: 0x67e8f9,
    transparent: true,
    opacity: 0,
  });
  const muzzleFlash = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 12, 12),
    muzzleFlashMat,
  );
  muzzleFlash.position.copy(muzzleAnchor.position);
  blaster.add(muzzleFlash);

  return { blaster, muzzleAnchor, muzzleFlash };
}

export function createPlayerCharacter(palette: MaterialPalette): PlayerRig {
  const root = new THREE.Group();

  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.75, 1.75),
    palette.contactShadow,
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.02;
  root.add(contactShadow);

  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  // 1. Sculpted Core Torso Suit
  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.3, 0.44, 10, 18),
    palette.whiteArmor,
  );
  torso.position.y = 1.12;
  torso.scale.set(1.12, 1, 0.86);
  torso.castShadow = true;
  bodyPivot.add(torso);

  // 2. Beveled Armored Chest Plate (ExtrudeGeometry)
  const chestShape = createBeveledShieldShape(0.46, 0.36);
  const chestGeo = new THREE.ExtrudeGeometry(chestShape, {
    depth: 0.22,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.03,
    bevelSegments: 3,
  });
  chestGeo.center();
  const chestPlate = new THREE.Mesh(chestGeo, palette.blueArmor);
  chestPlate.position.set(0, 1.21, -0.09);
  chestPlate.castShadow = true;
  bodyPivot.add(chestPlate);

  // Illuminated chest energy medallion
  const coreHousing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.14, 0.06, 18),
    palette.chromeMetal,
  );
  coreHousing.rotation.x = Math.PI / 2;
  coreHousing.position.set(0, 1.24, -0.23);
  bodyPivot.add(coreHousing);

  const chestCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.085, 0.075, 18),
    palette.cyanGlow,
  );
  chestCore.rotation.x = Math.PI / 2;
  chestCore.position.set(0, 1.24, -0.24);
  bodyPivot.add(chestCore);

  // 3. Sculpted Utility Belt with front buckle
  const belt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.37, 0.14, 20),
    palette.purpleAccent,
  );
  belt.position.y = 0.85;
  belt.castShadow = true;
  bodyPivot.add(belt);

  const buckle = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.11, 0.08),
    palette.chromeMetal,
  );
  buckle.position.set(0, 0.85, -0.35);
  bodyPivot.add(buckle);

  // 4. Sculpted Dual-Pod Power Pack (with Lathe turbine vents)
  const packShape = createBeveledShieldShape(0.4, 0.44);
  const packGeo = new THREE.ExtrudeGeometry(packShape, {
    depth: 0.18,
    bevelEnabled: true,
    bevelThickness: 0.028,
    bevelSize: 0.025,
    bevelSegments: 3,
  });
  packGeo.center();
  const pack = new THREE.Mesh(packGeo, palette.purpleAccent);
  pack.position.set(0, 1.22, 0.28);
  pack.castShadow = true;
  bodyPivot.add(pack);

  const ventPoints = [
    new THREE.Vector2(0.05, 0),
    new THREE.Vector2(0.08, 0.06),
    new THREE.Vector2(0.06, 0.14),
    new THREE.Vector2(0.02, 0.16),
  ];
  const ventGeo = new THREE.LatheGeometry(ventPoints, 16);
  [-0.12, 0.12].forEach((vx) => {
    const vent = new THREE.Mesh(ventGeo, palette.chromeMetal);
    vent.rotation.x = Math.PI;
    vent.position.set(vx, 0.99, 0.31);
    bodyPivot.add(vent);

    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 10, 10),
      palette.cyanGlow,
    );
    glow.position.set(vx, 0.94, 0.31);
    bodyPivot.add(glow);
  });

  const packStrip = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.3, 0.04),
    palette.cyanGlow,
  );
  packStrip.position.set(0, 1.22, 0.39);
  bodyPivot.add(packStrip);

  // 5. Head & Friendly Stylized Aero-Helmet
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.72, 0);
  bodyPivot.add(headGroup);

  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.055, 10, 24),
    palette.blueArmor,
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.y = -0.22;
  headGroup.add(collar);

  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 24, 20),
    palette.whiteArmor,
  );
  helmet.castShadow = true;
  headGroup.add(helmet);

  // Sculpted side comms pods
  const earGeo = new THREE.CylinderGeometry(0.105, 0.12, 0.09, 18);
  [-0.31, 0.31].forEach((ex) => {
    const ear = new THREE.Mesh(earGeo, palette.blueArmor);
    ear.rotation.z = Math.PI / 2;
    ear.position.set(ex, 0, 0);
    headGroup.add(ear);

    const earGlow = new THREE.Mesh(
      new THREE.TorusGeometry(0.065, 0.012, 8, 16),
      palette.cyanGlow,
    );
    earGlow.rotation.y = Math.PI / 2;
    earGlow.position.set(ex + (ex > 0 ? 0.048 : -0.048), 0, 0);
    headGroup.add(earGlow);
  });

  // Visor bezel & physical optical visor glass
  const visor = new THREE.Mesh(
    new THREE.SphereGeometry(0.275, 22, 16, 0, Math.PI, Math.PI * 0.24, Math.PI * 0.48),
    palette.visorGlass,
  );
  visor.rotation.y = Math.PI;
  visor.position.set(0, 0.02, -0.07);
  headGroup.add(visor);

  const crestShape = new THREE.Shape();
  crestShape.moveTo(-0.16, 0);
  crestShape.lineTo(0.18, 0);
  crestShape.lineTo(0.12, 0.11);
  crestShape.lineTo(-0.1, 0.09);
  crestShape.closePath();
  const crestGeo = new THREE.ExtrudeGeometry(crestShape, {
    depth: 0.06,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 2,
  });
  crestGeo.center();
  crestGeo.rotateY(Math.PI / 2);
  const crest = new THREE.Mesh(crestGeo, palette.cyanGlow);
  crest.position.set(0, 0.32, 0.03);
  headGroup.add(crest);

  // 6. Articulated Legs with Knee Guards & Sculpted Hover-Boots
  const buildLeg = (xOffset: number) => {
    const legPivot = new THREE.Group();
    legPivot.position.set(xOffset, 0.78, 0);

    const thigh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.115, 0.26, 8, 14),
      palette.blueArmor,
    );
    thigh.position.y = -0.22;
    thigh.castShadow = true;
    legPivot.add(thigh);

    const kneeGuard = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 12, 12),
      palette.chromeMetal,
    );
    kneeGuard.position.set(0, -0.38, -0.06);
    legPivot.add(kneeGuard);

    const shin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.105, 0.125, 0.24, 14),
      palette.whiteArmor,
    );
    shin.position.y = -0.5;
    shin.castShadow = true;
    legPivot.add(shin);

    const bootShape = createBeveledShieldShape(0.22, 0.32);
    const bootGeo = new THREE.ExtrudeGeometry(bootShape, {
      depth: 0.16,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.02,
      bevelSegments: 2,
    });
    bootGeo.center();
    bootGeo.rotateX(Math.PI / 2);
    const boot = new THREE.Mesh(bootGeo, palette.whiteArmor);
    boot.position.set(0, -0.66, -0.05);
    boot.castShadow = true;
    legPivot.add(boot);

    const sole = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.05, 0.34),
      palette.cyanGlow,
    );
    sole.position.set(0, -0.75, -0.05);
    legPivot.add(sole);

    bodyPivot.add(legPivot);
    return legPivot;
  };

  const leftLegPivot = buildLeg(-0.18);
  const rightLegPivot = buildLeg(0.18);

  // 7. Left Arm with Beveled Pauldron
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.44, 1.42, 0);
  bodyPivot.add(leftArmPivot);

  const leftShoulder = new THREE.Mesh(
    new THREE.SphereGeometry(0.145, 14, 14),
    palette.purpleAccent,
  );
  leftArmPivot.add(leftShoulder);

  const leftArmMesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.092, 0.34, 8, 12),
    palette.whiteArmor,
  );
  leftArmMesh.position.y = -0.24;
  leftArmMesh.castShadow = true;
  leftArmPivot.add(leftArmMesh);

  const leftGauntlet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.095, 0.14, 14),
    palette.blueArmor,
  );
  leftGauntlet.position.y = -0.38;
  leftArmPivot.add(leftGauntlet);

  const leftGlove = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 12, 12),
    palette.chromeMetal,
  );
  leftGlove.position.y = -0.5;
  leftArmPivot.add(leftGlove);

  // 8. Right Arm (Holds Laser Blaster)
  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.44, 1.42, 0);
  bodyPivot.add(rightArmPivot);

  const rightShoulder = new THREE.Mesh(
    new THREE.SphereGeometry(0.145, 14, 14),
    palette.purpleAccent,
  );
  rightArmPivot.add(rightShoulder);

  const rightArmMesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.092, 0.34, 8, 12),
    palette.whiteArmor,
  );
  rightArmMesh.position.set(0, -0.1, -0.18);
  rightArmMesh.rotation.x = Math.PI / 2.2;
  rightArmMesh.castShadow = true;
  rightArmPivot.add(rightArmMesh);

  const rightGlove = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 12, 12),
    palette.blueArmor,
  );
  rightGlove.position.set(0, -0.14, -0.4);
  rightArmPivot.add(rightGlove);

  const { blaster, muzzleAnchor, muzzleFlash } = createLaserBlaster(palette);
  blaster.position.set(0.02, -0.04, -0.46);
  rightArmPivot.add(blaster);

  let walkPhase = 0;

  const updateAnimation: PlayerRig['updateAnimation'] = ({
    dt,
    time,
    moveSpeed,
    isGrounded,
    aimPitch,
    recoil,
    victoryMode,
    playerY,
  }) => {
    const heightAboveFloor = Math.max(0, playerY);
    const shadowScale = THREE.MathUtils.clamp(1 - heightAboveFloor * 0.12, 0.45, 1.0);
    contactShadow.scale.setScalar(shadowScale);
    contactShadow.position.y = -heightAboveFloor + 0.02;

    if (victoryMode) {
      const bounce = Math.abs(Math.sin(time * 6.5)) * 0.45;
      bodyPivot.position.y = bounce;
      leftLegPivot.rotation.x = Math.sin(time * 6.5) * 0.35;
      rightLegPivot.rotation.x = -Math.sin(time * 6.5) * 0.35;
      leftArmPivot.rotation.z = -2.4 + Math.sin(time * 8) * 0.25;
      leftArmPivot.rotation.x = 0;
      rightArmPivot.rotation.z = 0.25;
      rightArmPivot.rotation.x = 1.1 + Math.sin(time * 8) * 0.25;
      headGroup.rotation.y = Math.sin(time * 3) * 0.2;
      blaster.position.z = -0.46;
      return;
    }

    if (moveSpeed > 0.25 && isGrounded) {
      walkPhase += dt * (4.5 + moveSpeed * 0.9);
      const swing = Math.sin(walkPhase) * 0.65;
      leftLegPivot.rotation.x = swing;
      rightLegPivot.rotation.x = -swing;
      leftArmPivot.rotation.x = -swing * 0.7;
      leftArmPivot.rotation.z = 0.12;
      bodyPivot.position.y = Math.abs(Math.cos(walkPhase)) * 0.08;
    } else if (!isGrounded) {
      leftLegPivot.rotation.x = THREE.MathUtils.damp(leftLegPivot.rotation.x, 0.38, 10, dt);
      rightLegPivot.rotation.x = THREE.MathUtils.damp(rightLegPivot.rotation.x, -0.32, 10, dt);
      leftArmPivot.rotation.x = THREE.MathUtils.damp(leftArmPivot.rotation.x, -0.45, 10, dt);
      leftArmPivot.rotation.z = THREE.MathUtils.damp(leftArmPivot.rotation.z, -0.35, 10, dt);
      bodyPivot.position.y = THREE.MathUtils.damp(bodyPivot.position.y, 0, 10, dt);
    } else {
      leftLegPivot.rotation.x = THREE.MathUtils.damp(leftLegPivot.rotation.x, 0, 10, dt);
      rightLegPivot.rotation.x = THREE.MathUtils.damp(rightLegPivot.rotation.x, 0, 10, dt);
      leftArmPivot.rotation.x = THREE.MathUtils.damp(leftArmPivot.rotation.x, 0, 10, dt);
      leftArmPivot.rotation.z = THREE.MathUtils.damp(
        leftArmPivot.rotation.z,
        0.1 + Math.sin(time * 2) * 0.04,
        8,
        dt,
      );
      bodyPivot.position.y = Math.sin(time * 2.4) * 0.025;
    }

    rightArmPivot.rotation.z = 0;
    rightArmPivot.rotation.x =
      THREE.MathUtils.clamp(aimPitch * 0.85, -0.65, 0.65) + recoil * 0.35;
    blaster.position.z = -0.46 + recoil * 0.14;
    headGroup.rotation.x = THREE.MathUtils.clamp(aimPitch * 0.45, -0.35, 0.35);
    headGroup.rotation.y = 0;

    const flashMat = muzzleFlash.material as THREE.MeshBasicMaterial;
    flashMat.opacity = Math.max(0, recoil * 0.95);
    muzzleFlash.scale.setScalar(0.6 + recoil * 1.1);
  };

  return {
    root,
    bodyPivot,
    headGroup,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    blasterGroup: blaster,
    muzzleAnchor,
    muzzleFlash,
    contactShadow,
    updateAnimation,
  };
}
