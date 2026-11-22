import * as THREE from 'three';
import type { ActiveTarget, TargetSystem } from './targetSystem';

interface EnergyBolt {
  mesh: THREE.Group;
  velocity: THREE.Vector3;
  life: number;
  intendedTarget: ActiveTarget | null;
}

interface ShardParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  rotSpeed: THREE.Vector3;
  life: number;
  maxLife: number;
}

interface ShockRing {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
}

const _prevPos = new THREE.Vector3();
const _stepVec = new THREE.Vector3();
const _rayDir = new THREE.Vector3();

export class ProjectileAndVfxSystem {
  private scene: THREE.Scene;
  private bolts: EnergyBolt[] = [];
  private particles: ShardParticle[] = [];
  private rings: ShockRing[] = [];
  private raycaster = new THREE.Raycaster();

  private coreGeo = new THREE.SphereGeometry(0.14, 10, 10);
  private trailGeo = new THREE.CylinderGeometry(0.06, 0.14, 1.3, 8);
  private shardGeo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
  private ringGeo = new THREE.RingGeometry(0.6, 0.95, 32);

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.trailGeo.rotateX(Math.PI / 2);
  }

  public spawnLaserBolt(
    origin: THREE.Vector3,
    targetPoint: THREE.Vector3,
    intendedTarget: ActiveTarget | null,
  ) {
    const boltGroup = new THREE.Group();
    boltGroup.position.copy(origin);

    const core = new THREE.Mesh(
      this.coreGeo,
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    boltGroup.add(core);

    const aura = new THREE.Mesh(
      this.trailGeo,
      new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.88,
      }),
    );
    aura.position.z = 0.45;
    boltGroup.add(aura);

    const dir = targetPoint.clone().sub(origin).normalize();
    boltGroup.lookAt(origin.clone().add(dir));

    this.scene.add(boltGroup);

    this.bolts.push({
      mesh: boltGroup,
      velocity: dir.multiplyScalar(78),
      life: 1.3,
      intendedTarget,
    });
  }

  public spawnBurst(
    center: THREE.Vector3,
    type: 'correct' | 'wrong' | 'firework',
  ) {
    const count = type === 'correct' ? 28 : type === 'firework' ? 32 : 14;
    const palette =
      type === 'correct'
        ? [0x10b981, 0x34d399, 0x22d3ee, 0xffffff]
        : type === 'firework'
          ? [0x22d3ee, 0xa855f7, 0xfbbf24, 0x38bdf8, 0xffffff]
          : [0xf43f5e, 0xef4444, 0xfca5a5];

    for (let i = 0; i < count; i++) {
      const color = palette[i % palette.length];
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1,
      });
      const mesh = new THREE.Mesh(this.shardGeo, mat);
      mesh.position.copy(center);
      const scale = type === 'correct' ? 0.7 + Math.random() * 1.1 : 0.45 + Math.random() * 0.6;
      mesh.scale.setScalar(scale);

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed =
        type === 'correct'
          ? 7 + Math.random() * 11
          : type === 'firework'
            ? 8 + Math.random() * 12
            : 4 + Math.random() * 6;

      const velocity = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.cos(phi) * speed + (type === 'firework' ? 4 : 2),
        Math.sin(phi) * Math.sin(theta) * speed,
      );

      this.scene.add(mesh);
      this.particles.push({
        mesh,
        velocity,
        rotSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12,
        ),
        life: 0.95 + Math.random() * 0.45,
        maxLife: 1.4,
      });
    }

    // Shockwave ring
    const ringMat = new THREE.MeshBasicMaterial({
      color: type === 'wrong' ? 0xf43f5e : type === 'correct' ? 0x34d399 : 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
    });
    const ringMesh = new THREE.Mesh(this.ringGeo, ringMat);
    ringMesh.position.copy(center);
    ringMesh.lookAt(0, center.y, 14);
    this.scene.add(ringMesh);
    this.rings.push({ mesh: ringMesh, life: 0.55, maxLife: 0.55 });
  }

  public update(
    dt: number,
    targetSystem: TargetSystem,
    onTargetHit: (target: ActiveTarget, hitPoint: THREE.Vector3) => void,
  ) {
    const hitboxes = targetSystem.getHitboxes();

    // Update laser bolts with continuous segment raycast to avoid tunneling
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const bolt = this.bolts[i];
      _prevPos.copy(bolt.mesh.position);
      _stepVec.copy(bolt.velocity).multiplyScalar(dt);
      const stepDist = _stepVec.length();

      bolt.mesh.position.add(_stepVec);
      bolt.life -= dt;

      let hitTarget: ActiveTarget | null = null;
      let hitPoint = bolt.mesh.position.clone();

      if (hitboxes.length > 0 && stepDist > 0.001) {
        _rayDir.copy(_stepVec).normalize();
        this.raycaster.set(_prevPos, _rayDir);
        this.raycaster.near = 0;
        this.raycaster.far = stepDist + 0.65;
        const hits = this.raycaster.intersectObjects(hitboxes, false);
        if (hits.length > 0) {
          hitTarget = targetSystem.findTargetByHitbox(hits[0].object);
          hitPoint = hits[0].point.clone();
        }
      }

      if (hitTarget) {
        this.removeBolt(i);
        onTargetHit(hitTarget, hitPoint);
        continue;
      }

      if (bolt.life <= 0) {
        this.removeBolt(i);
      }
    }

    // Update explosion shards
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.velocity.y -= 14 * dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.mesh.rotation.x += p.rotSpeed.x * dt;
      p.mesh.rotation.y += p.rotSpeed.y * dt;
      p.life -= dt;

      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, p.life / p.maxLife);

      if (p.life <= 0 || p.mesh.position.y < -1) {
        this.scene.remove(p.mesh);
        mat.dispose();
        this.particles.splice(i, 1);
      }
    }

    // Update shockwave rings
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      const progress = 1 - r.life / r.maxLife;
      r.mesh.scale.setScalar(1 + progress * 4.5);
      const mat = r.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 1 - progress);

      if (r.life <= 0) {
        this.scene.remove(r.mesh);
        mat.dispose();
        this.rings.splice(i, 1);
      }
    }
  }

  private removeBolt(index: number) {
    const bolt = this.bolts[index];
    this.scene.remove(bolt.mesh);
    bolt.mesh.traverse((c) => {
      if (c instanceof THREE.Mesh && c.material instanceof THREE.Material) {
        c.material.dispose();
      }
    });
    this.bolts.splice(index, 1);
  }

  public clearAll() {
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      this.removeBolt(i);
    }
    for (const p of this.particles) {
      this.scene.remove(p.mesh);
      (p.mesh.material as THREE.Material).dispose();
    }
    this.particles = [];
    for (const r of this.rings) {
      this.scene.remove(r.mesh);
      (r.mesh.material as THREE.Material).dispose();
    }
    this.rings = [];
  }

  public dispose() {
    this.clearAll();
    this.coreGeo.dispose();
    this.trailGeo.dispose();
    this.shardGeo.dispose();
    this.ringGeo.dispose();
  }
}
