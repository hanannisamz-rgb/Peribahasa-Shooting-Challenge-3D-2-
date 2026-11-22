import * as THREE from 'three';
import type { AnswerOptionKey, ProverbQuestion } from '../data/questions';
import { createTargetBoardTexture, type MaterialPalette } from './materials';

export interface ActiveTarget {
  key: AnswerOptionKey;
  text: string;
  isCorrect: boolean;
  group: THREE.Group;
  hitboxMesh: THREE.Mesh;
  screenMesh: THREE.Mesh;
  rimMesh: THREE.Mesh;
  ringMesh: THREE.Mesh;
  outerGyroMesh: THREE.Mesh;
  basePos: THREE.Vector3;
  slotIndex: number;
  destroyed: boolean;
  triedWrong: boolean;
  wrongFlashTimer: number;
  hovered: boolean;
  textures: {
    normal: THREE.CanvasTexture;
    hover: THREE.CanvasTexture;
    wrong: THREE.CanvasTexture;
    correct: THREE.CanvasTexture;
  };
}

function createChamferedFrameGeo(w: number, h: number, c: number, depth: number): THREE.ExtrudeGeometry {
  const hw = w / 2;
  const hh = h / 2;
  const s = new THREE.Shape();
  s.moveTo(-hw + c, -hh);
  s.lineTo(hw - c, -hh);
  s.lineTo(hw, -hh + c);
  s.lineTo(hw, hh - c);
  s.lineTo(hw - c, hh);
  s.lineTo(-hw + c, hh);
  s.lineTo(-hw, hh - c);
  s.lineTo(-hw, -hh + c);
  s.closePath();

  const geo = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.06,
    bevelSegments: 3,
  });
  geo.center();
  return geo;
}

function createWingFinGeo(): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, -0.95);
  s.lineTo(0.68, -0.55);
  s.lineTo(0.84, 0.35);
  s.lineTo(0.45, 0.92);
  s.lineTo(0, 0.72);
  s.closePath();

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.12,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 2,
  });
  geo.center();
  return geo;
}

export class TargetSystem {
  private group = new THREE.Group();
  private targets: ActiveTarget[] = [];
  private hitboxes: THREE.Mesh[] = [];
  private currentQuestion: ProverbQuestion | null = null;
  private palette: MaterialPalette;
  private maxAnisotropy: number;

  // Shared sculpted geometries for balanced, steady target drones
  private frameGeo = createChamferedFrameGeo(6.2, 3.8, 0.38, 0.28);
  private rimGeo = createChamferedFrameGeo(6.4, 4.0, 0.4, 0.16);
  private wingGeo = createWingFinGeo();
  private turbineGeo: THREE.LatheGeometry;
  private screenGeo = new THREE.PlaneGeometry(5.9, 3.5);
  private hitboxGeo = new THREE.BoxGeometry(6.45, 4.05, 1.2);

  constructor(
    scene: THREE.Scene,
    palette: MaterialPalette,
    maxAnisotropy: number,
  ) {
    this.palette = palette;
    this.maxAnisotropy = maxAnisotropy;

    const turbinePts = [
      new THREE.Vector2(0.05, 0.0),
      new THREE.Vector2(0.48, 0.02),
      new THREE.Vector2(0.75, 0.14),
      new THREE.Vector2(0.86, 0.32),
      new THREE.Vector2(0.62, 0.42),
      new THREE.Vector2(0.05, 0.42),
    ];
    this.turbineGeo = new THREE.LatheGeometry(turbinePts, 24);

    scene.add(this.group);
  }

  public getHitboxes(): THREE.Mesh[] {
    return this.hitboxes;
  }

  public getTargets(): ActiveTarget[] {
    return this.targets;
  }

  public getRemainingCount(): number {
    return this.targets.filter((t) => !t.destroyed && !t.triedWrong).length;
  }

  public clearTargets() {
    for (const t of this.targets) {
      this.group.remove(t.group);
      t.textures.normal.dispose();
      t.textures.hover.dispose();
      t.textures.wrong.dispose();
      t.textures.correct.dispose();
      t.group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (
            child.geometry !== this.frameGeo &&
            child.geometry !== this.rimGeo &&
            child.geometry !== this.wingGeo &&
            child.geometry !== this.turbineGeo &&
            child.geometry !== this.screenGeo &&
            child.geometry !== this.hitboxGeo
          ) {
            child.geometry.dispose();
          }
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }
    this.targets = [];
    this.hitboxes = [];
  }

  public spawnForQuestion(question: ProverbQuestion) {
    this.clearTargets();
    this.currentQuestion = question;

    question.options.forEach((option, index) => {
      const [px, py, pz] = question.targetPositions[index];
      const basePos = new THREE.Vector3(px, py, pz);

      const targetGroup = new THREE.Group();
      targetGroup.position.copy(basePos);

      // 1. Beveled sculpted armored chassis
      const frame = new THREE.Mesh(this.frameGeo, this.palette.darkFrame.clone());
      frame.castShadow = true;
      targetGroup.add(frame);

      // 2. Glowing chamfered neon perimeter rim
      const rimMat = new THREE.MeshStandardMaterial({
        color: 0x22d3ee,
        emissive: 0x06b6d4,
        emissiveIntensity: 1.3,
        roughness: 0.22,
        metalness: 0.25,
      });
      const rim = new THREE.Mesh(this.rimGeo, rimMat);
      rim.position.z = -0.05;
      targetGroup.add(rim);

      // 3. Sculpted Lateral Stabilizer Wings (Left & Right)
      const leftWing = new THREE.Mesh(this.wingGeo, this.palette.whiteArmor.clone());
      leftWing.rotation.y = Math.PI;
      leftWing.position.set(-3.48, 0, -0.09);
      leftWing.castShadow = true;
      targetGroup.add(leftWing);

      const rightWing = new THREE.Mesh(this.wingGeo, this.palette.whiteArmor.clone());
      rightWing.position.set(3.48, 0, -0.09);
      rightWing.castShadow = true;
      targetGroup.add(rightWing);

      // Glowing fin edge strips
      [-3.48, 3.48].forEach((wx) => {
        const finAccent = new THREE.Mesh(
          new THREE.BoxGeometry(0.14, 1.35, 0.22),
          rimMat,
        );
        finAccent.position.set(wx + (wx > 0 ? 0.22 : -0.22), 0.1, -0.05);
        targetGroup.add(finAccent);
      });

      // 4. Dual Counter-Rotating Decorative Gyroscopic Energy Rings behind chassis
      const ringMat = new THREE.MeshStandardMaterial({
        color: 0xa855f7,
        emissive: 0x9333ea,
        emissiveIntensity: 1.25,
        roughness: 0.2,
        metalness: 0.35,
      });
      const haloRing = new THREE.Mesh(
        new THREE.TorusGeometry(2.35, 0.085, 12, 42),
        ringMat,
      );
      haloRing.position.z = -0.35;
      targetGroup.add(haloRing);

      const outerGyro = new THREE.Mesh(
        new THREE.TorusGeometry(2.75, 0.055, 10, 48, Math.PI * 1.45),
        rimMat,
      );
      outerGyro.position.z = -0.45;
      targetGroup.add(outerGyro);

      // 5. Lathe-turned Hover Emitter Pod & Volumetric Light Cone below
      const hoverPod = new THREE.Mesh(
        this.turbineGeo,
        this.palette.chromeMetal.clone(),
      );
      hoverPod.position.set(0, -2.32, 0);
      targetGroup.add(hoverPod);

      const hoverGlow = new THREE.Mesh(
        new THREE.TorusGeometry(0.74, 0.075, 10, 28),
        rimMat,
      );
      hoverGlow.rotation.x = Math.PI / 2;
      hoverGlow.position.set(0, -2.34, 0);
      targetGroup.add(hoverGlow);

      const emitterConeMat = new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const emitterCone = new THREE.Mesh(
        new THREE.ConeGeometry(1.12, 1.8, 24, 1, true),
        emitterConeMat,
      );
      emitterCone.position.set(0, -3.2, 0);
      targetGroup.add(emitterCone);

      // 6. High-Res Answer Board Textures (1024x596)
      const textures = {
        normal: createTargetBoardTexture(
          option.key,
          option.text,
          'normal',
          this.maxAnisotropy,
        ),
        hover: createTargetBoardTexture(
          option.key,
          option.text,
          'hover',
          this.maxAnisotropy,
        ),
        wrong: createTargetBoardTexture(
          option.key,
          option.text,
          'wrong',
          this.maxAnisotropy,
        ),
        correct: createTargetBoardTexture(
          option.key,
          option.text,
          'correct',
          this.maxAnisotropy,
        ),
      };

      const screenMat = new THREE.MeshBasicMaterial({
        map: textures.normal,
      });
      const screenMesh = new THREE.Mesh(this.screenGeo, screenMat);
      screenMesh.position.z = 0.21;
      targetGroup.add(screenMesh);

      // Top sensor crest node
      const sensorPod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.44, 0.22, 16),
        this.palette.purpleAccent.clone(),
      );
      sensorPod.position.set(0, 2.06, 0);
      targetGroup.add(sensorPod);

      // 7. Generous invisible collision & raycast hitbox
      const hitbox = new THREE.Mesh(
        this.hitboxGeo,
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hitbox.userData.targetKey = option.key;
      targetGroup.add(hitbox);

      // Face directly toward the player's arena viewing zone with zero vertical tilt distortion
      targetGroup.lookAt(0, basePos.y, 9);
      this.group.add(targetGroup);

      const activeTarget: ActiveTarget = {
        key: option.key,
        text: option.text,
        isCorrect: option.key === question.correctKey,
        group: targetGroup,
        hitboxMesh: hitbox,
        screenMesh,
        rimMesh: rim,
        ringMesh: haloRing,
        outerGyroMesh: outerGyro,
        basePos,
        slotIndex: index,
        destroyed: false,
        triedWrong: false,
        wrongFlashTimer: 0,
        hovered: false,
        textures,
      };

      this.targets.push(activeTarget);
      this.hitboxes.push(hitbox);
    });
  }

  public setHoveredTarget(targetKey: AnswerOptionKey | null) {
    for (const t of this.targets) {
      if (t.destroyed) continue;
      const shouldHover = t.key === targetKey;
      if (t.hovered !== shouldHover) {
        t.hovered = shouldHover;
        this.refreshTargetVisual(t);
      }
    }
  }

  private refreshTargetVisual(t: ActiveTarget) {
    const screenMat = t.screenMesh.material as THREE.MeshBasicMaterial;
    const rimMat = t.rimMesh.material as THREE.MeshStandardMaterial;

    if (t.wrongFlashTimer > 0 || t.triedWrong) {
      screenMat.map = t.textures.wrong;
      rimMat.color.setHex(0xf43f5e);
      rimMat.emissive.setHex(0xe11d48);
      rimMat.emissiveIntensity = t.wrongFlashTimer > 0 ? 2.2 : 0.85;
    } else if (t.hovered) {
      screenMat.map = t.textures.hover;
      rimMat.color.setHex(0xffffff);
      rimMat.emissive.setHex(0x67e8f9);
      rimMat.emissiveIntensity = 1.9;
    } else {
      screenMat.map = t.textures.normal;
      rimMat.color.setHex(0x22d3ee);
      rimMat.emissive.setHex(0x06b6d4);
      rimMat.emissiveIntensity = 1.25;
    }
    screenMat.needsUpdate = true;
  }

  public triggerWrongHit(target: ActiveTarget) {
    target.triedWrong = true;
    target.wrongFlashTimer = 0.85;
    this.refreshTargetVisual(target);
  }

  public triggerCorrectHit(target: ActiveTarget): THREE.Vector3 {
    target.destroyed = true;
    const worldPos = new THREE.Vector3();
    target.group.getWorldPosition(worldPos);
    target.group.visible = false;
    this.hitboxes = this.hitboxes.filter((h) => h !== target.hitboxMesh);
    return worldPos;
  }

  public findTargetByHitbox(obj: THREE.Object3D): ActiveTarget | null {
    const key = obj.userData.targetKey as AnswerOptionKey | undefined;
    if (!key) return null;
    return this.targets.find((t) => t.key === key && !t.destroyed) ?? null;
  }

  public update(time: number, dt: number, _playerPos: THREE.Vector3) {
    for (const t of this.targets) {
      if (t.destroyed) continue;

      if (t.wrongFlashTimer > 0) {
        t.wrongFlashTimer = Math.max(0, t.wrongFlashTimer - dt);
        if (t.wrongFlashTimer === 0) {
          this.refreshTargetVisual(t);
        }
      }

      // Keep answer panels completely stationary (no bobbing, shaking, rotating, or scaling)
      t.group.position.copy(t.basePos);
      t.group.scale.setScalar(1.0);

      // Only decorative rear gyroscopic rings gently animate
      const idx = t.slotIndex;
      t.ringMesh.rotation.z = time * (1.2 + idx * 0.2);
      t.outerGyroMesh.rotation.z = -time * (1.6 + idx * 0.25);
    }
  }
}
