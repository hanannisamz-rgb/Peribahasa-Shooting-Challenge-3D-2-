import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { soundEngine } from '../audio/soundEngine';
import {
  ACHIEVEMENT_BADGES,
  PROVERB_QUESTIONS,
  type AchievementBadge,
  type AnswerOptionKey,
} from '../data/questions';
import { buildFuturisticArena, type ArenaController } from './arenaBuilder';
import { createMaterialPalette, type MaterialPalette } from './materials';
import { createLaserBlaster, createPlayerCharacter, type PlayerRig } from './playerModel';
import { ProjectileAndVfxSystem } from './projectiles';
import { TargetSystem, type ActiveTarget } from './targetSystem';

export type GamePhase = 'menu' | 'playing' | 'paused' | 'transition' | 'victory';
export type CameraMode = 'third-person' | 'first-person';

export interface HudSnapshot {
  phase: GamePhase;
  cameraMode: CameraMode;
  questionIndex: number;
  totalQuestions: number;
  stageName: string;
  stageSubtitle: string;
  peribahasa: string;
  prompt: string;
  score: number;
  maxScore: number;
  correctCount: number;
  stars: number;
  remainingTargets: number;
  shieldHealth: number;
  maxShield: number;
  unlockedBadges: AchievementBadge[];
  pointerLocked: boolean;
  hoveredTarget: AnswerOptionKey | null;
  vrSupported: boolean;
  inVr: boolean;
  contextLost: boolean;
}

export interface FeedbackEvent {
  id: number;
  type: 'correct' | 'wrong';
  title: string;
  explanation?: string;
}

const _camForward = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _aimOrigin = new THREE.Vector3();
const _aimDir = new THREE.Vector3();
const _muzzleWorld = new THREE.Vector3();
const _targetPoint = new THREE.Vector3();
const _tpsCamPos = new THREE.Vector3();
const _tpsLookAt = new THREE.Vector3();
const _fpsCamPos = new THREE.Vector3();
const _fpsLookAt = new THREE.Vector3();
const _desiredCamPos = new THREE.Vector3();
const _desiredLookAt = new THREE.Vector3();
const _ndcCenter = new THREE.Vector2(0, 0);
const _xrMatrix = new THREE.Matrix4();

export class GameEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private palette: MaterialPalette;
  private arena: ArenaController;
  private player: PlayerRig;
  private targetSystem: TargetSystem;
  private vfx: ProjectileAndVfxSystem;

  // WebXR Rig & Controllers
  private xrRig = new THREE.Group();
  private xrControllers: THREE.Group[] = [];
  private xrQuestionMesh: THREE.Mesh;
  private xrQuestionCanvas: HTMLCanvasElement;
  private xrQuestionTex: THREE.CanvasTexture;

  // First-Person Viewmodel Weapon
  private fpsBlaster: THREE.Group;
  private fpsMuzzleAnchor: THREE.Object3D;
  private fpsMuzzleFlash: THREE.Mesh;

  // Game State
  private phase: GamePhase = 'menu';
  private cameraMode: CameraMode = 'third-person';
  private cameraBlend = 0; // 0 = third-person, 1 = first-person
  private questionIndex = 0;
  private score = 0;
  private correctCount = 0;
  private stars = 0;
  private shieldHealth = 3;
  private readonly maxShield = 3;
  private questionSolved = false;
  private unlockedBadgeIds = new Set<string>();
  private feedbackCounter = 0;
  private transitionTimer = 0;
  private fireworkTimer = 0;

  // Player Physics & Aim State
  private playerPos = new THREE.Vector3(0, 0, 9);
  private playerVel = new THREE.Vector3(0, 0, 0);
  private isGrounded = true;
  private yaw = 0; // 0 looks toward -Z (targets)
  private pitch = 0.08;
  private smoothCamPos = new THREE.Vector3(0, 4.2, 16);
  private smoothLookAt = new THREE.Vector3(0, 2.5, -10);
  private recoil = 0;
  private shootCooldown = 0;
  private hoveredTarget: AnswerOptionKey | null = null;

  // Inputs
  private keys = new Set<string>();
  private mobileMove = { x: 0, y: 0 };
  private pointerLocked = false;
  private mouseNdc = new THREE.Vector2(0, 0);
  private hasMouseMovedUnlocked = false;
  private isDraggingLook = false;
  private lastDragPos = { x: 0, y: 0 };
  private dragDistance = 0;

  // Loop & Lifecycle
  private clock = new THREE.Clock();
  private frameId = 0;
  private disposed = false;
  private inVr = false;
  private vrSupported = false;
  private contextLost = false;
  private activeRaycaster = new THREE.Raycaster();
  private hoverThrottleTimer = 0;

  // Callbacks
  private onHudUpdate: (snapshot: HudSnapshot) => void;
  private onFeedback: (event: FeedbackEvent | null) => void;
  private onBadgeUnlocked: (badge: AchievementBadge) => void;

  // Bound Event Handlers
  private handleResizeBound: () => void;
  private handleKeyDownBound: (e: KeyboardEvent) => void;
  private handleKeyUpBound: (e: KeyboardEvent) => void;
  private handleMouseMoveBound: (e: MouseEvent) => void;
  private handleMouseDownBound: (e: MouseEvent) => void;
  private handleMouseUpBound: (e: MouseEvent) => void;
  private handlePointerLockChangeBound: () => void;
  private handleContextLostBound: (e: Event) => void;
  private handleContextRestoredBound: () => void;

  constructor(
    container: HTMLElement,
    callbacks: {
      onHudUpdate: (snapshot: HudSnapshot) => void;
      onFeedback: (event: FeedbackEvent | null) => void;
      onBadgeUnlocked: (badge: AchievementBadge) => void;
    },
  ) {
    this.container = container;
    this.onHudUpdate = callbacks.onHudUpdate;
    this.onFeedback = callbacks.onFeedback;
    this.onBadgeUnlocked = callbacks.onBadgeUnlocked;

    // Detect Software WebGL per skill directive
    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
    );
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.xr.enabled = true;

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, width / height, 0.1, 280);

    // Mandatory studio environment map via RoomEnvironment
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04,
    ).texture;
    pmremGenerator.dispose();

    // Balanced Cinematic 3-Point + Architectural Softbox Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e1b4b, 0.78);
    this.scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.55);
    keyLight.position.set(18, 30, 20);
    keyLight.castShadow = !this.isSoftwareGl;
    keyLight.shadow.mapSize.width = this.isSoftwareGl ? 1024 : 2048;
    keyLight.shadow.mapSize.height = this.isSoftwareGl ? 1024 : 2048;
    keyLight.shadow.radius = 3.5;
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 88;
    const d = 30;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.00045;
    keyLight.shadow.normalBias = 0.02;
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.45);
    fillLight.position.set(22, 10, -10);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xa855f7, 0.85);
    rimLight.position.set(-18, 16, -24);
    this.scene.add(rimLight);

    if (!this.isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      const archSoftbox = new THREE.RectAreaLight(0x38bdf8, 3.2, 16, 4);
      archSoftbox.position.set(0, 15.5, -24);
      archSoftbox.lookAt(0, 4, 0);
      this.scene.add(archSoftbox);
    }

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.palette = createMaterialPalette(maxAniso, this.isSoftwareGl);

    // Build World, Player, Targets, and Projectiles
    this.arena = buildFuturisticArena(
      this.scene,
      this.palette,
      maxAniso,
      this.isSoftwareGl,
    );
    this.player = createPlayerCharacter(this.palette);
    this.player.root.position.copy(this.playerPos);
    this.scene.add(this.player.root);

    // First-person viewmodel blaster attached to camera
    const fpsWeapon = createLaserBlaster(this.palette);
    this.fpsBlaster = fpsWeapon.blaster;
    this.fpsMuzzleAnchor = fpsWeapon.muzzleAnchor;
    this.fpsMuzzleFlash = fpsWeapon.muzzleFlash;
    this.fpsBlaster.scale.setScalar(0.68);
    this.fpsBlaster.position.set(0.28, -0.24, -0.36);
    this.fpsBlaster.rotation.set(0.02, 0.05, 0);
    this.fpsBlaster.visible = false;
    this.camera.add(this.fpsBlaster);
    this.scene.add(this.camera);

    this.targetSystem = new TargetSystem(this.scene, this.palette, maxAniso);
    this.vfx = new ProjectileAndVfxSystem(this.scene);

    // Setup WebXR Rig & Floating 3D Question Board (comfortable VR viewing distance)
    this.scene.add(this.xrRig);
    this.xrQuestionCanvas = document.createElement('canvas');
    this.xrQuestionCanvas.width = 1280;
    this.xrQuestionCanvas.height = 360;
    this.xrQuestionTex = new THREE.CanvasTexture(this.xrQuestionCanvas);
    this.xrQuestionTex.colorSpace = THREE.SRGBColorSpace;
    this.xrQuestionTex.anisotropy = maxAniso;
    this.xrQuestionMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(12.8, 3.6),
      new THREE.MeshBasicMaterial({ map: this.xrQuestionTex, transparent: true }),
    );
    this.xrQuestionMesh.position.set(0, 9.4, -14.5);
    this.xrQuestionMesh.visible = false; // Shown in VR mode
    this.scene.add(this.xrQuestionMesh);

    this.setupXrControllers();
    this.checkVrSupport();

    // Load Stage 1 backdrop for Menu preview
    this.loadQuestion(0, false);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // Bind Events
    this.handleResizeBound = this.onResize.bind(this);
    this.handleKeyDownBound = this.onKeyDown.bind(this);
    this.handleKeyUpBound = this.onKeyUp.bind(this);
    this.handleMouseMoveBound = this.onMouseMove.bind(this);
    this.handleMouseDownBound = this.onMouseDown.bind(this);
    this.handleMouseUpBound = this.onMouseUp.bind(this);
    this.handlePointerLockChangeBound = this.onPointerLockChange.bind(this);
    this.handleContextLostBound = (e: Event) => {
      e.preventDefault();
      this.contextLost = true;
      this.emitHud();
    };
    this.handleContextRestoredBound = () => {
      this.contextLost = false;
      this.emitHud();
    };

    window.addEventListener('resize', this.handleResizeBound);
    window.addEventListener('keydown', this.handleKeyDownBound);
    window.addEventListener('keyup', this.handleKeyUpBound);
    this.renderer.domElement.addEventListener('mousemove', this.handleMouseMoveBound);
    this.renderer.domElement.addEventListener('mousedown', this.handleMouseDownBound);
    window.addEventListener('mouseup', this.handleMouseUpBound);
    document.addEventListener('pointerlockchange', this.handlePointerLockChangeBound);
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLostBound);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestoredBound);

    this.emitHud();
    this.startLoop();
  }

  private async checkVrSupport() {
    try {
      if ('xr' in navigator && navigator.xr) {
        this.vrSupported = await navigator.xr.isSessionSupported('immersive-vr');
        this.emitHud();
      }
    } catch {
      this.vrSupported = false;
    }
  }

  private setupXrControllers() {
    for (let i = 0; i < 2; i++) {
      const controller = this.renderer.xr.getController(i);
      const { blaster } = createLaserBlaster(this.palette);
      blaster.scale.setScalar(0.55);
      controller.add(blaster);

      // Laser pointer beam
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, -0.4),
        new THREE.Vector3(0, 0, -35),
      ]);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.75,
      });
      const pointerLine = new THREE.Line(lineGeo, lineMat);
      controller.add(pointerLine);

      controller.addEventListener('selectstart', () => {
        if (this.phase === 'playing' && !this.questionSolved) {
          this.fireFromXrController(controller);
        }
      });

      this.xrRig.add(controller);
      this.xrControllers.push(controller);
    }
  }

  public async enterVr() {
    if (!('xr' in navigator) || !navigator.xr) return;
    try {
      const session = await navigator.xr.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor', 'bounded-floor'],
      });
      this.inVr = true;
      this.xrRig.position.set(this.playerPos.x, 0, this.playerPos.z);
      this.xrRig.add(this.camera);
      this.player.root.visible = false;
      this.fpsBlaster.visible = false;
      this.xrQuestionMesh.visible = true;
      this.updateXrQuestionBoard();

      await this.renderer.xr.setSession(session);
      session.addEventListener('end', () => {
        this.inVr = false;
        this.xrRig.remove(this.camera);
        this.scene.add(this.camera);
        this.player.root.visible = this.cameraMode === 'third-person';
        this.fpsBlaster.visible =
          this.cameraMode === 'first-person' &&
          (this.phase === 'playing' || this.phase === 'transition' || this.phase === 'paused');
        this.xrQuestionMesh.visible = false;
        this.startLoop();
        this.emitHud();
      });

      // Use WebXR animation loop
      cancelAnimationFrame(this.frameId);
      clearTimeout(this.frameId);
      this.renderer.setAnimationLoop(() => {
        this.stepFrame();
        this.renderer.render(this.scene, this.camera);
      });

      this.emitHud();
    } catch {
      this.inVr = false;
      this.emitHud();
    }
  }

  private updateXrQuestionBoard() {
    const q = PROVERB_QUESTIONS[this.questionIndex];
    const w = this.xrQuestionCanvas.width;
    const h = this.xrQuestionCanvas.height;
    const ctx = this.xrQuestionCanvas.getContext('2d')!;
    ctx.fillStyle = '#08112e';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, w - 16, h - 16);

    ctx.fillStyle = '#7dd3fc';
    ctx.font = '700 28px "Poppins", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Soalan ${this.questionIndex + 1}/7 · ${q.stageName}`, w / 2, 54);

    // Wrap long proverb text cleanly for VR readability
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 42px "Nunito", Arial, sans-serif';
    const words = q.peribahasa.split(' ');
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > w - 110 && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);

    const startY = lines.length > 1 ? 128 : 160;
    lines.slice(0, 2).forEach((line, idx) => {
      ctx.fillText(line, w / 2, startY + idx * 54);
    });

    ctx.fillStyle = '#fde68a';
    ctx.font = '700 32px "Nunito", Arial, sans-serif';
    ctx.fillText(q.prompt, w / 2, h - 40);

    this.xrQuestionTex.needsUpdate = true;
  }

  public startNewGame() {
    soundEngine.unlock();
    soundEngine.playUiClick();
    this.score = 0;
    this.correctCount = 0;
    this.stars = 0;
    this.shieldHealth = this.maxShield;
    this.unlockedBadgeIds.clear();
    this.questionIndex = 0;
    this.questionSolved = false;
    this.playerPos.set(0, 0, 9);
    this.playerVel.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0.08;
    this.vfx.clearAll();
    this.loadQuestion(0, true);
    this.phase = 'playing';
    this.onFeedback(null);
    this.emitHud();
  }

  public pauseGame() {
    if (this.phase !== 'playing') return;
    this.phase = 'paused';
    this.keys.clear();
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    }
    this.emitHud();
  }

  public resumeGame() {
    if (this.phase !== 'paused') return;
    soundEngine.unlock();
    soundEngine.playUiClick();
    this.phase = 'playing';
    this.emitHud();
  }

  public toggleCameraMode() {
    if (this.inVr) return;
    soundEngine.unlock();
    soundEngine.playUiClick();
    this.cameraMode =
      this.cameraMode === 'third-person' ? 'first-person' : 'third-person';
    this.emitHud();
  }

  public setCameraMode(mode: CameraMode) {
    if (this.inVr || this.cameraMode === mode) return;
    soundEngine.unlock();
    soundEngine.playUiClick();
    this.cameraMode = mode;
    this.emitHud();
  }

  public returnToMenu() {
    soundEngine.playUiClick();
    this.phase = 'menu';
    this.keys.clear();
    this.onFeedback(null);
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    }
    this.questionIndex = 0;
    this.loadQuestion(0, false);
    this.emitHud();
  }

  public requestPointerLock() {
    if (this.phase !== 'playing' || this.inVr) return;
    try {
      const maybePromise = this.renderer.domElement.requestPointerLock?.() as unknown as Promise<void> | undefined;
      if (maybePromise && typeof maybePromise.catch === 'function') {
        maybePromise.catch(() => {});
      }
    } catch {
      // Fallback mouse aiming remains active if pointer lock is unavailable
    }
  }

  public setMobileMove(x: number, y: number) {
    this.mobileMove.x = THREE.MathUtils.clamp(x, -1, 1);
    this.mobileMove.y = THREE.MathUtils.clamp(y, -1, 1);
  }

  public addLookDelta(dx: number, dy: number) {
    this.yaw -= dx * 0.0045;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.0038, -0.35, 0.62);
  }

  public triggerJump() {
    if (this.phase !== 'playing') return;
    if (this.isGrounded) {
      this.playerVel.y = 10.6;
      this.isGrounded = false;
      soundEngine.playJump();
    }
  }

  public triggerShoot() {
    if (this.phase !== 'playing' || this.questionSolved) return;
    if (this.shootCooldown > 0) return;

    this.shootCooldown = 0.24;
    this.recoil = 1.0;
    soundEngine.unlock();
    soundEngine.playLaserShot();

    // Determine exact 3D aim point via camera raycast (center reticle when locked, or mouse NDC)
    const rayCoord = this.pointerLocked || !this.hasMouseMovedUnlocked ? _ndcCenter : this.mouseNdc;
    this.activeRaycaster.setFromCamera(rayCoord, this.camera);

    const hitboxes = this.targetSystem.getHitboxes();
    const hits = this.activeRaycaster.intersectObjects(hitboxes, false);
    let intendedTarget: ActiveTarget | null = null;

    if (hits.length > 0) {
      _targetPoint.copy(hits[0].point);
      intendedTarget = this.targetSystem.findTargetByHitbox(hits[0].object);
    } else {
      this.activeRaycaster.ray.at(55, _targetPoint);
    }

    // Muzzle world origin: use first-person viewmodel muzzle in FPS, character blaster muzzle in TPS
    if (this.cameraMode === 'first-person' && this.fpsBlaster.visible) {
      this.camera.updateMatrixWorld(true);
      this.fpsMuzzleAnchor.getWorldPosition(_muzzleWorld);
    } else {
      this.player.root.updateMatrixWorld(true);
      this.player.muzzleAnchor.getWorldPosition(_muzzleWorld);
    }

    this.vfx.spawnLaserBolt(_muzzleWorld, _targetPoint, intendedTarget);
  }

  private fireFromXrController(controller: THREE.Group) {
    if (this.shootCooldown > 0) return;
    this.shootCooldown = 0.24;
    soundEngine.playLaserShot();

    _xrMatrix.identity().extractRotation(controller.matrixWorld);
    _aimOrigin.setFromMatrixPosition(controller.matrixWorld);
    _aimDir.set(0, 0, -1).applyMatrix4(_xrMatrix).normalize();

    this.activeRaycaster.set(_aimOrigin, _aimDir);
    const hits = this.activeRaycaster.intersectObjects(this.targetSystem.getHitboxes(), false);
    let intended: ActiveTarget | null = null;
    if (hits.length > 0) {
      _targetPoint.copy(hits[0].point);
      intended = this.targetSystem.findTargetByHitbox(hits[0].object);
    } else {
      _targetPoint.copy(_aimOrigin).addScaledVector(_aimDir, 55);
    }

    this.vfx.spawnLaserBolt(_aimOrigin, _targetPoint, intended);
  }

  public advanceToNextQuestion() {
    if (this.phase !== 'transition') return;
    this.transitionTimer = 0;
    this.proceedAfterCorrect();
  }

  private proceedAfterCorrect() {
    const nextIdx = this.questionIndex + 1;
    if (nextIdx >= PROVERB_QUESTIONS.length) {
      // Completed all 7 questions -> Victory!
      this.phase = 'victory';
      this.onFeedback(null);
      if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock();
      }
      soundEngine.playVictoryFanfare();
      this.fireworkTimer = 0.05;
      this.emitHud();
      return;
    }

    this.questionIndex = nextIdx;
    this.questionSolved = false;
    this.shieldHealth = this.maxShield;
    this.phase = 'playing';
    this.onFeedback(null);
    soundEngine.playStageUnlock();
    this.loadQuestion(nextIdx, true);
    this.emitHud();
  }

  private loadQuestion(index: number, spawnTargets: boolean) {
    const q = PROVERB_QUESTIONS[index];
    this.arena.applyStage(
      q,
      this.score,
      this.stars,
      index,
      PROVERB_QUESTIONS.length,
    );
    if (spawnTargets) {
      this.targetSystem.spawnForQuestion(q);
    } else {
      // Show Stage 1 targets in background during menu preview for visual excitement
      this.targetSystem.spawnForQuestion(q);
    }
    this.updateXrQuestionBoard();
  }

  private handleTargetHit = (target: ActiveTarget, hitPoint: THREE.Vector3) => {
    if (this.phase !== 'playing' || this.questionSolved) return;

    const currentQ = PROVERB_QUESTIONS[this.questionIndex];

    if (target.isCorrect) {
      // Prevent repeated points for same question
      this.questionSolved = true;
      this.score += 10;
      this.correctCount += 1;
      this.stars += 1;

      const explodePos = this.targetSystem.triggerCorrectHit(target);
      this.vfx.spawnBurst(explodePos, 'correct');
      soundEngine.playCorrectHit();

      // Update 3D Arena Scoreboard immediately
      this.arena.updateScoreboard({
        stageName: currentQ.stageName,
        questionIndex: this.questionIndex,
        totalQuestions: PROVERB_QUESTIONS.length,
        score: this.score,
        stars: this.stars,
        peribahasa: currentQ.peribahasa,
      });

      // Check achievement badge unlocks
      for (const badge of ACHIEVEMENT_BADGES) {
        if (
          this.correctCount >= badge.requiredCorrect &&
          !this.unlockedBadgeIds.has(badge.id)
        ) {
          this.unlockedBadgeIds.add(badge.id);
          this.onBadgeUnlocked(badge);
        }
      }

      this.phase = 'transition';
      this.transitionTimer = 3.2;

      this.feedbackCounter += 1;
      this.onFeedback({
        id: this.feedbackCounter,
        type: 'correct',
        title: 'TAHNIAH! JAWAPAN ANDA BETUL!',
        explanation: currentQ.explanation,
      });

      this.emitHud();
    } else {
      // Incorrect shot
      this.targetSystem.triggerWrongHit(target);
      this.vfx.spawnBurst(hitPoint, 'wrong');
      soundEngine.playWrongHit();

      // Visual shield indicator pulse (softly resets if 1 so pupils can always retry!)
      this.shieldHealth = Math.max(1, this.shieldHealth - 1);

      this.feedbackCounter += 1;
      this.onFeedback({
        id: this.feedbackCounter,
        type: 'wrong',
        title: 'CUBA LAGI! JAWAPAN ANDA KURANG TEPAT.',
      });

      this.emitHud();
    }
  };

  private startLoop() {
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    const tick = () => {
      if (this.disposed || this.inVr) return;
      this.stepFrame();
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.afterDraw(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed || this.inVr) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private stepFrame() {
    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.05);
    const time = this.clock.elapsedTime;

    this.arena.update(time, dt);
    this.targetSystem.update(time, dt, this.playerPos);
    this.vfx.update(dt, this.targetSystem, this.handleTargetHit);

    if (this.shootCooldown > 0) this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt * 6.5);

    if (this.phase === 'menu') {
      this.player.root.visible = true;
      this.fpsBlaster.visible = false;
      // Gentle scenic orbit around the arena on Title Screen
      const orbitAngle = Math.sin(time * 0.22) * 0.45;
      const camX = Math.sin(orbitAngle) * 14;
      const camZ = 15 + Math.cos(orbitAngle) * 3;
      this.camera.position.set(camX, 6.2, camZ);
      this.camera.lookAt(0, 4.5, -14);
      this.player.updateAnimation({
        dt,
        time,
        moveSpeed: 0,
        isGrounded: true,
        aimPitch: 0.08,
        recoil: 0,
        victoryMode: false,
        playerY: 0,
      });
      return;
    }

    if (this.phase === 'victory') {
      this.player.root.visible = true;
      this.fpsBlaster.visible = false;
      // Celebration camera orbit + fireworks in 3D arena
      const angle = time * 0.65;
      this.camera.position.set(
        this.playerPos.x + Math.sin(angle) * 6.5,
        this.playerPos.y + 3.0,
        this.playerPos.z + Math.cos(angle) * 6.5,
      );
      this.camera.lookAt(this.playerPos.x, this.playerPos.y + 1.4, this.playerPos.z);

      this.player.root.rotation.y = Math.atan2(
        this.camera.position.x - this.playerPos.x,
        this.camera.position.z - this.playerPos.z,
      ) + Math.PI;
      this.player.updateAnimation({
        dt,
        time,
        moveSpeed: 0,
        isGrounded: true,
        aimPitch: 0,
        recoil: 0,
        victoryMode: true,
        playerY: this.playerPos.y,
      });

      this.fireworkTimer -= dt;
      if (this.fireworkTimer <= 0) {
        this.fireworkTimer = 0.65 + Math.random() * 0.45;
        const burstPos = new THREE.Vector3(
          (Math.random() - 0.5) * 24,
          7 + Math.random() * 7,
          -14 + (Math.random() - 0.5) * 12,
        );
        this.vfx.spawnBurst(burstPos, 'firework');
        soundEngine.playFireworkPop();
      }
      return;
    }

    if (this.phase === 'transition') {
      this.transitionTimer -= dt;
      if (this.transitionTimer <= 0) {
        this.proceedAfterCorrect();
      }
    }

    if (this.phase === 'playing' || this.phase === 'transition' || this.phase === 'paused') {
      if (this.inVr) {
        if (this.phase !== 'paused') {
          this.updateXrMovement(dt);
        }
        this.player.root.visible = false;
        this.fpsBlaster.visible = false;
      } else {
        if (this.phase !== 'paused') {
          this.updatePlayerPhysics(dt);
        }
        this.updateCamera(dt, time);
      }

      if (this.phase !== 'paused') {
        // Throttled hover raycast for reticle feedback
        this.hoverThrottleTimer += dt;
        if (this.hoverThrottleTimer >= 0.05) {
          this.hoverThrottleTimer = 0;
          const rayCoord =
            this.pointerLocked || !this.hasMouseMovedUnlocked ? _ndcCenter : this.mouseNdc;
          this.activeRaycaster.setFromCamera(rayCoord, this.camera);
          const hits = this.activeRaycaster.intersectObjects(
            this.targetSystem.getHitboxes(),
            false,
          );
          const newHover =
            hits.length > 0
              ? this.targetSystem.findTargetByHitbox(hits[0].object)?.key ?? null
              : null;
          this.targetSystem.setHoveredTarget(newHover);
          if (newHover !== this.hoveredTarget) {
            this.hoveredTarget = newHover;
            this.emitHud();
          }
        }
      }
    }

    const horizontalSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
    this.player.root.position.copy(this.playerPos);
    this.player.root.rotation.y = this.yaw;
    this.player.updateAnimation({
      dt,
      time,
      moveSpeed: horizontalSpeed,
      isGrounded: this.isGrounded,
      aimPitch: this.pitch,
      recoil: this.recoil,
      victoryMode: false,
      playerY: this.playerPos.y,
    });
  }

  private updateXrMovement(dt: number) {
    const session = this.renderer.xr.getSession();
    if (!session) return;
    for (const source of session.inputSources) {
      if (source.gamepad && source.gamepad.axes.length >= 4) {
        const ax = source.gamepad.axes[2];
        const ay = source.gamepad.axes[3];
        if (Math.abs(ax) > 0.15 || Math.abs(ay) > 0.15) {
          if (source.handedness === 'left') {
            this.camera.getWorldDirection(_camForward);
            _camForward.y = 0;
            _camForward.normalize();
            _camRight.crossVectors(_camForward, THREE.Object3D.DEFAULT_UP).normalize();

            this.xrRig.position.addScaledVector(_camForward, -ay * 6.0 * dt);
            this.xrRig.position.addScaledVector(_camRight, ax * 6.0 * dt);

            const r = Math.hypot(this.xrRig.position.x, this.xrRig.position.z);
            const maxR = this.arena.arenaRadius - 2;
            if (r > maxR) {
              this.xrRig.position.x *= maxR / r;
              this.xrRig.position.z *= maxR / r;
            }
          } else if (source.handedness === 'right' && Math.abs(ax) > 0.35) {
            // Smooth comfortable turn
            this.xrRig.rotation.y -= ax * 1.4 * dt;
          }
        }
      }
    }
    this.playerPos.copy(this.xrRig.position);
  }

  private updatePlayerPhysics(dt: number) {
    // Movement input from keyboard + mobile virtual joystick
    let forwardInput =
      (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
      (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) +
      this.mobileMove.y;
    let strafeInput =
      (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
      (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0) +
      this.mobileMove.x;

    forwardInput = THREE.MathUtils.clamp(forwardInput, -1, 1);
    strafeInput = THREE.MathUtils.clamp(strafeInput, -1, 1);

    const isSprinting = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const targetSpeed = isSprinting ? 12.2 : 7.8;

    // Facing direction from yaw (yaw = 0 faces -Z)
    _camForward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    _camRight.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    _moveDir
      .set(0, 0, 0)
      .addScaledVector(_camForward, forwardInput)
      .addScaledVector(_camRight, strafeInput);

    if (_moveDir.lengthSq() > 1) _moveDir.normalize();

    const targetVx = _moveDir.x * targetSpeed;
    const targetVz = _moveDir.z * targetSpeed;

    this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, targetVx, 12, dt);
    this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, targetVz, 12, dt);

    // Gravity
    this.playerVel.y -= 26 * dt;

    // Next X/Z with obstacle AABB check
    const nextX = this.playerPos.x + this.playerVel.x * dt;
    const nextZ = this.playerPos.z + this.playerVel.z * dt;
    const playerRadius = 0.55;

    let blockedX = false;
    let blockedZ = false;

    for (const obs of this.arena.obstacles) {
      if (this.playerPos.y < obs.maxY - 0.15) {
        if (
          nextX + playerRadius > obs.minX &&
          nextX - playerRadius < obs.maxX &&
          this.playerPos.z + playerRadius > obs.minZ &&
          this.playerPos.z - playerRadius < obs.maxZ
        ) {
          blockedX = true;
        }
        if (
          this.playerPos.x + playerRadius > obs.minX &&
          this.playerPos.x - playerRadius < obs.maxX &&
          nextZ + playerRadius > obs.minZ &&
          nextZ - playerRadius < obs.maxZ
        ) {
          blockedZ = true;
        }
      }
    }

    if (!blockedX) this.playerPos.x = nextX;
    if (!blockedZ) this.playerPos.z = nextZ;

    // Keep inside circular arena perimeter (keep player comfortably in front of targets)
    const distFromCenter = Math.hypot(this.playerPos.x, this.playerPos.z);
    const maxRadius = this.arena.arenaRadius - 1.4;
    if (distFromCenter > maxRadius) {
      this.playerPos.x *= maxRadius / distFromCenter;
      this.playerPos.z *= maxRadius / distFromCenter;
    }

    // Vertical floor + walkable floating platforms collision
    let floorHeight = 0;
    for (const pad of this.arena.walkables) {
      if (
        this.playerPos.x >= pad.minX - 0.3 &&
        this.playerPos.x <= pad.maxX + 0.3 &&
        this.playerPos.z >= pad.minZ - 0.3 &&
        this.playerPos.z <= pad.maxZ + 0.3 &&
        this.playerPos.y >= pad.topY - 0.35
      ) {
        floorHeight = Math.max(floorHeight, pad.topY);
      }
    }

    this.playerPos.y += this.playerVel.y * dt;
    if (this.playerPos.y <= floorHeight) {
      this.playerPos.y = floorHeight;
      this.playerVel.y = 0;
      this.isGrounded = true;
    } else {
      this.isGrounded = false;
    }
  }

  private updateCamera(dt: number, time: number) {
    // Smoothly blend between Third-Person (0) and First-Person (1)
    const targetBlend = this.cameraMode === 'first-person' ? 1 : 0;
    this.cameraBlend = THREE.MathUtils.damp(this.cameraBlend, targetBlend, 11, dt);

    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);

    // Third-person over-the-shoulder camera pose
    const camDistance = 5.4;
    const shoulderOffset = 1.05;
    const camHeight = 2.55;
    _tpsCamPos.set(
      this.playerPos.x + sinY * camDistance * Math.cos(this.pitch * 0.5) + cosY * shoulderOffset,
      this.playerPos.y + camHeight - Math.sin(this.pitch) * 2.2,
      this.playerPos.z + cosY * camDistance * Math.cos(this.pitch * 0.5) - sinY * shoulderOffset,
    );
    _tpsCamPos.y = Math.max(0.9, _tpsCamPos.y);
    _tpsLookAt.set(
      this.playerPos.x - sinY * 22 + cosY * shoulderOffset * 0.4,
      this.playerPos.y + 1.85 + Math.sin(this.pitch) * 18,
      this.playerPos.z - cosY * 22 - sinY * shoulderOffset * 0.4,
    );

    // First-person eye-level camera pose
    const eyeHeight = 1.68;
    _fpsCamPos.set(this.playerPos.x, this.playerPos.y + eyeHeight, this.playerPos.z);
    _fpsLookAt.set(
      this.playerPos.x - sinY * 22,
      this.playerPos.y + eyeHeight + Math.sin(this.pitch) * 22,
      this.playerPos.z - cosY * 22,
    );

    _desiredCamPos.lerpVectors(_tpsCamPos, _fpsCamPos, this.cameraBlend);
    _desiredLookAt.lerpVectors(_tpsLookAt, _fpsLookAt, this.cameraBlend);

    // Use tighter tracking in pure FPS so aiming feels crisp, smooth damp during transitions/TPS
    const posLambda = this.cameraBlend > 0.96 ? 34 : 13;
    const lookLambda = this.cameraBlend > 0.96 ? 38 : 16;

    this.smoothCamPos.x = THREE.MathUtils.damp(this.smoothCamPos.x, _desiredCamPos.x, posLambda, dt);
    this.smoothCamPos.y = THREE.MathUtils.damp(this.smoothCamPos.y, _desiredCamPos.y, posLambda, dt);
    this.smoothCamPos.z = THREE.MathUtils.damp(this.smoothCamPos.z, _desiredCamPos.z, posLambda, dt);

    this.smoothLookAt.x = THREE.MathUtils.damp(this.smoothLookAt.x, _desiredLookAt.x, lookLambda, dt);
    this.smoothLookAt.y = THREE.MathUtils.damp(this.smoothLookAt.y, _desiredLookAt.y, lookLambda, dt);
    this.smoothLookAt.z = THREE.MathUtils.damp(this.smoothLookAt.z, _desiredLookAt.z, lookLambda, dt);

    this.camera.position.copy(this.smoothCamPos);
    this.camera.lookAt(this.smoothLookAt);

    // Hide full character model & show first-person blaster when camera reaches eye level
    const showFpsView = this.cameraBlend > 0.65;
    this.player.root.visible = !showFpsView;
    this.fpsBlaster.visible = showFpsView;

    if (showFpsView) {
      const speed = Math.hypot(this.playerVel.x, this.playerVel.z);
      const bobX = this.isGrounded && speed > 0.3 ? Math.sin(time * 9) * 0.012 : 0;
      const bobY = this.isGrounded && speed > 0.3 ? Math.abs(Math.cos(time * 9)) * 0.014 : Math.sin(time * 2.2) * 0.004;
      const slideIn = THREE.MathUtils.clamp((this.cameraBlend - 0.65) / 0.35, 0, 1);

      this.fpsBlaster.position.set(
        0.28 + bobX,
        -0.25 + bobY - (1 - slideIn) * 0.14,
        -0.36 + this.recoil * 0.08,
      );
      this.fpsBlaster.rotation.set(
        0.02 + this.recoil * 0.14,
        0.05,
        -this.recoil * 0.04,
      );

      const flashMat = this.fpsMuzzleFlash.material as THREE.MeshBasicMaterial;
      flashMat.opacity = Math.max(0, this.recoil * 0.95);
      this.fpsMuzzleFlash.scale.setScalar(0.55 + this.recoil * 0.95);
    }

    // Subtle sprint FOV cue
    const isSprinting = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const targetFov = isSprinting && this.keys.size > 0 ? 67 : 62;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 8, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  private onKeyDown(e: KeyboardEvent) {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (this.phase === 'playing') {
        this.pauseGame();
        return;
      } else if (this.phase === 'paused') {
        this.resumeGame();
        return;
      }
    }

    if (e.code === 'KeyV' && !e.repeat) {
      if (this.phase === 'playing' || this.phase === 'paused' || this.phase === 'transition') {
        this.toggleCameraMode();
        return;
      }
    }

    if (this.phase === 'transition' && (e.code === 'Space' || e.code === 'Enter')) {
      e.preventDefault();
      this.advanceToNextQuestion();
      return;
    }

    if (this.phase !== 'playing') return;

    this.keys.add(e.code);
    if (e.code === 'Space') {
      e.preventDefault();
      this.triggerJump();
    }
  }

  private onKeyUp(e: KeyboardEvent) {
    this.keys.delete(e.code);
  }

  private onMouseMove(e: MouseEvent) {
    if (this.phase !== 'playing' || this.inVr) return;

    if (document.pointerLockElement === this.renderer.domElement) {
      this.yaw -= e.movementX * 0.0024;
      this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * 0.0021, -0.35, 0.62);
    } else {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouseNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouseNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.hasMouseMovedUnlocked = true;

      if (this.isDraggingLook) {
        const dx = e.clientX - this.lastDragPos.x;
        const dy = e.clientY - this.lastDragPos.y;
        this.dragDistance += Math.hypot(dx, dy);
        this.lastDragPos = { x: e.clientX, y: e.clientY };
        this.addLookDelta(dx, dy);
      }
    }
  }

  private onMouseDown(e: MouseEvent) {
    if (this.phase !== 'playing' || this.inVr) return;
    if (e.button !== 0) return;

    soundEngine.unlock();

    if (document.pointerLockElement === this.renderer.domElement) {
      this.triggerShoot();
    } else {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouseNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouseNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.hasMouseMovedUnlocked = true;
      this.isDraggingLook = true;
      this.dragDistance = 0;
      this.lastDragPos = { x: e.clientX, y: e.clientY };
      this.triggerShoot();
      // Attempt pointer lock smoothly on click for full mouse-aiming
      this.requestPointerLock();
    }
  }

  private onMouseUp() {
    this.isDraggingLook = false;
  }

  private onPointerLockChange() {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    if (this.pointerLocked) {
      this.hasMouseMovedUnlocked = false;
    }
    this.emitHud();
  }

  private onResize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
    );
  }

  public getMouseScreenPercent(): { x: number; y: number } | null {
    if (this.pointerLocked || !this.hasMouseMovedUnlocked) return null;
    return {
      x: ((this.mouseNdc.x + 1) / 2) * 100,
      y: ((-this.mouseNdc.y + 1) / 2) * 100,
    };
  }

  private emitHud() {
    const q = PROVERB_QUESTIONS[this.questionIndex];
    const badges = ACHIEVEMENT_BADGES.filter((b) => this.unlockedBadgeIds.has(b.id));

    this.onHudUpdate({
      phase: this.phase,
      cameraMode: this.cameraMode,
      questionIndex: this.questionIndex,
      totalQuestions: PROVERB_QUESTIONS.length,
      stageName: q.stageName,
      stageSubtitle: q.stageSubtitle,
      peribahasa: q.peribahasa,
      prompt: q.prompt,
      score: this.score,
      maxScore: PROVERB_QUESTIONS.length * 10,
      correctCount: this.correctCount,
      stars: this.stars,
      remainingTargets: this.targetSystem.getRemainingCount(),
      shieldHealth: this.shieldHealth,
      maxShield: this.maxShield,
      unlockedBadges: badges,
      pointerLocked: this.pointerLocked,
      hoveredTarget: this.hoveredTarget,
      vrSupported: this.vrSupported,
      inVr: this.inVr,
      contextLost: this.contextLost,
    });
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.renderer.setAnimationLoop(null);

    window.removeEventListener('resize', this.handleResizeBound);
    window.removeEventListener('keydown', this.handleKeyDownBound);
    window.removeEventListener('keyup', this.handleKeyUpBound);
    this.renderer.domElement.removeEventListener('mousemove', this.handleMouseMoveBound);
    this.renderer.domElement.removeEventListener('mousedown', this.handleMouseDownBound);
    window.removeEventListener('mouseup', this.handleMouseUpBound);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChangeBound);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLostBound);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestoredBound);

    this.targetSystem.clearTargets();
    this.vfx.dispose();
    this.arena.dispose();
    this.xrQuestionTex.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
