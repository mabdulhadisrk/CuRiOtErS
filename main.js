import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// ---------- GAME STATE ----------
const state = {
  gameMode: null,
  gameActive: false,
  timer: 60,
  p1Health: 100,
  p2Health: 100,
  roundOver: false,
  winner: null,
  screenShake: 0
};

const keys = {
  w: false, a: false, s: false, d: false,
  f: false, g: false,
  ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
  comma: false, period: false
};

let p1AttackCooldown = 0;
let p2AttackCooldown = 0;
let p1AttackAnim = 0;
let p2AttackAnim = 0;
const ATTACK_COOLDOWN = 0.5;
const ATTACK_ANIM_DURATION = 0.3;

let botTimer = 0;
let botAction = 'idle';

// DOM elements
const modeSelection = document.getElementById('modeSelection');
const controlsBar = document.getElementById('controlsBar');
const timerEl = document.getElementById('timerDisplay');
const p1HealthFill = document.getElementById('p1-health-fill');
const p2HealthFill = document.getElementById('p2-health-fill');
const p1HealthText = document.getElementById('p1-health-text');
const p2HealthText = document.getElementById('p2-health-text');
const koContainer = document.getElementById('koContainer');
const koWinner = document.getElementById('koWinner');
const rematchPanel = document.getElementById('rematchPanel');

// ---------- THREE.JS SETUP ----------
const canvas = document.getElementById('gameCanvas');
const renderer = new THREE.WebGLRenderer({ 
  canvas, 
  antialias: true,
  alpha: false,
  powerPreference: "high-performance",
  toneMapping: THREE.ACESFilmicToneMapping,
  toneMappingExposure: 1.2
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputEncoding = THREE.sRGBEncoding;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000011);
scene.fog = new THREE.FogExp2(0x000011, 0.0008);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.5, 100);
camera.position.set(0, 6, 14);
camera.lookAt(0, 1.5, 0);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '45px';
labelRenderer.domElement.style.left = '0px';
labelRenderer.domElement.style.pointerEvents = 'none';
document.body.appendChild(labelRenderer.domElement);

// ---------- PROFESSIONAL LIGHTING ----------
// Ambient
const ambientLight = new THREE.AmbientLight(0x1a1a3e, 0.6);
scene.add(ambientLight);

// Main key light
const keyLight = new THREE.DirectionalLight(0xffeedd, 2.0);
keyLight.position.set(8, 12, 5);
keyLight.castShadow = true;
keyLight.receiveShadow = true;
keyLight.shadow.mapSize.width = 2048;
keyLight.shadow.mapSize.height = 2048;
keyLight.shadow.camera.near = 1;
keyLight.shadow.camera.far = 60;
keyLight.shadow.camera.left = -15;
keyLight.shadow.camera.right = 15;
keyLight.shadow.camera.top = 15;
keyLight.shadow.camera.bottom = -5;
keyLight.shadow.bias = -0.0001;
keyLight.shadow.normalBias = 0.02;
scene.add(keyLight);

// Rim light
const rimLight = new THREE.DirectionalLight(0x4466ff, 1.5);
rimLight.position.set(-5, 3, -8);
scene.add(rimLight);

// Fill light
const fillLight = new THREE.DirectionalLight(0xff8844, 0.8);
fillLight.position.set(0, 2, 8);
scene.add(fillLight);

// Bottom glow
const bottomLight = new THREE.PointLight(0xff4400, 1.2, 8);
bottomLight.position.set(0, -0.5, 0);
scene.add(bottomLight);

// Spot lights for dramatic effect
const spotLight1 = new THREE.SpotLight(0xff4444, 0.6);
spotLight1.position.set(-4, 8, 0);
spotLight1.angle = 0.5;
spotLight1.penumbra = 0.5;
spotLight1.decay = 1;
spotLight1.distance = 20;
scene.add(spotLight1);

const spotLight2 = new THREE.SpotLight(0x4444ff, 0.6);
spotLight2.position.set(4, 8, 0);
spotLight2.angle = 0.5;
spotLight2.penumbra = 0.5;
spotLight2.decay = 1;
spotLight2.distance = 20;
scene.add(spotLight2);

// ---------- ARENA ----------
// Main platform
const platformGeo = new THREE.CylinderGeometry(5.5, 6, 0.8, 64);
const platformMat = new THREE.MeshStandardMaterial({ 
  color: 0x1a1a2e, 
  roughness: 0.3, 
  metalness: 0.9,
  emissive: new THREE.Color(0x050510)
});
const platform = new THREE.Mesh(platformGeo, platformMat);
platform.position.y = -0.5;
platform.receiveShadow = true;
platform.castShadow = true;
scene.add(platform);

// Arena floor with texture-like pattern
const floorGeo = new THREE.PlaneGeometry(25,14);
const floorMat = new THREE.MeshStandardMaterial({ 
  color: 0x2a2a4e, 
  roughness: 0.2, 
  metalness: 0.8,
  emissive: new THREE.Color(0x0a0a20)
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI /2;
floor.position.y = -0.08;
floor.receiveShadow = true;
scene.add(floor);

// Particle atmosphere
const atmosphereParticles = new THREE.Group();
const particleGeo = new THREE.SphereGeometry(0.02, 4, 4);
const particleMat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.6 });
for (let i = 0; i < 100; i++) {
  const particle = new THREE.Mesh(particleGeo, particleMat);
  particle.position.set(
    (Math.random() - 0.5) * 12,
    Math.random() * 5,
    (Math.random() - 0.5) * 12
  );
  atmosphereParticles.add(particle);
}
scene.add(atmosphereParticles);

// ---------- ENHANCED FIGHTER CREATION ----------
function createFighter(characterType, posX, name) {
  const group = new THREE.Group();
  const parts = {};
  
  const presets = {
    jin: {
      bodyColor: 0x1a1a2e, skinColor: 0xffdbac, hairColor: 0x0a0a0a,
      accentColor: 0xff4444, pantsColor: 0xf5f5f5, beltColor: 0x0a0a0a
    },
    lars: {
      bodyColor: 0x8b0000, skinColor: 0xffdbac, hairColor: 0xd4af37,
      accentColor: 0xffd700, pantsColor: 0x1a1a1a, beltColor: 0x8b0000
    },
    kazuya: {
      bodyColor: 0x4a0000, skinColor: 0xffcc99, hairColor: 0x0a0a0a,
      accentColor: 0xff0000, pantsColor: 0xf5f5f5, beltColor: 0x0a0a0a
    }
  };
  
  const preset = presets[characterType] || presets.jin;
  
  // Torso with detailed armor
  const torsoGroup = new THREE.Group();
  
  // Main body
  const torsoGeo = new THREE.CylinderGeometry(0.35, 0.45, 1.2, 16);
  const torsoMat = new THREE.MeshStandardMaterial({ 
    color: preset.bodyColor, 
    roughness: 0.3, 
    metalness: 0.4,
  });
  const torso = new THREE.Mesh(torsoGeo, torsoMat);
  torso.castShadow = true; torso.receiveShadow = true;
  torsoGroup.add(torso);
  
  // Chest plate
  const chestGeo = new THREE.BoxGeometry(0.7, 0.6, 0.2);
  const chestMat = new THREE.MeshStandardMaterial({ 
    color: preset.accentColor, 
    roughness: 0.2, 
    metalness: 0.8,
    emissive: new THREE.Color(preset.accentColor).multiplyScalar(0.3)
  });
  const chestPlate = new THREE.Mesh(chestGeo, chestMat);
  chestPlate.position.set(0, 0.1, 0.25);
  chestPlate.castShadow = true;
  torsoGroup.add(chestPlate);
  
  // Belt
  const beltGeo = new THREE.TorusGeometry(0.42, 0.08, 8, 16);
  const beltMat = new THREE.MeshStandardMaterial({ 
    color: preset.beltColor, 
    roughness: 0.2, 
    metalness: 0.7 
  });
  const belt = new THREE.Mesh(beltGeo, beltMat);
  belt.position.y = -0.35; belt.rotation.x = Math.PI / 2; belt.castShadow = true;
  torsoGroup.add(belt);
  
  // Shoulder armor
  const shoulderGeo = new THREE.SphereGeometry(0.18, 8, 8);
  const shoulderMat = new THREE.MeshStandardMaterial({ 
    color: preset.accentColor, 
    roughness: 0.15, 
    metalness: 0.9,
    emissive: new THREE.Color(preset.accentColor).multiplyScalar(0.4)
  });
  
  const leftShoulder = new THREE.Mesh(shoulderGeo, shoulderMat);
  leftShoulder.position.set(-0.5, 0.35, 0);
  leftShoulder.scale.set(0.7, 0.9, 0.6);
  leftShoulder.castShadow = true;
  torsoGroup.add(leftShoulder);
  
  const rightShoulder = new THREE.Mesh(shoulderGeo, shoulderMat);
  rightShoulder.position.set(0.5, 0.35, 0);
  rightShoulder.scale.set(0.7, 0.9, 0.6);
  rightShoulder.castShadow = true;
  torsoGroup.add(rightShoulder);
  
  torsoGroup.position.y = 1.2;
  group.add(torsoGroup);
  parts.torso = torsoGroup;
  
  // Head with detailed face
  const headGroup = new THREE.Group();
  
  // Skull
  const headGeo = new THREE.SphereGeometry(0.32, 32, 32);
  const headMat = new THREE.MeshStandardMaterial({ 
    color: preset.skinColor, 
    roughness: 0.4, 
    metalness: 0.05 
  });
  const head = new THREE.Mesh(headGeo, headMat);
  head.castShadow = true; head.receiveShadow = true;
  headGroup.add(head);
  
  // Jaw
  const jawGeo = new THREE.BoxGeometry(0.3, 0.15, 0.2);
  const jaw = new THREE.Mesh(jawGeo, headMat);
  jaw.position.set(0, -0.2, 0.15);
  headGroup.add(jaw);
  
  // Spiky hair (Jin/Kazuya style)
  const hairGroup = new THREE.Group();
  for (let i = 0; i < 20; i++) {
    const spikeGeo = new THREE.ConeGeometry(0.06, 0.35 + Math.random() * 0.3, 6);
    const spikeMat = new THREE.MeshStandardMaterial({ 
      color: preset.hairColor, 
      roughness: 0.6,
      metalness: 0.2
    });
    const spike = new THREE.Mesh(spikeGeo, spikeMat);
    const angle = (i / 20) * Math.PI * 2;
    spike.position.set(
      Math.cos(angle) * 0.22,
      0.25 + Math.random() * 0.2,
      Math.sin(angle) * 0.22
    );
    spike.rotation.z = (Math.random() - 0.5) * 0.6;
    spike.rotation.x = (Math.random() - 0.5) * 0.4;
    spike.castShadow = true;
    hairGroup.add(spike);
  }
  // Top spikes
  for (let i = 0; i < 8; i++) {
    const spikeGeo = new THREE.ConeGeometry(0.05, 0.4, 6);
    const spike = new THREE.Mesh(spikeGeo, new THREE.MeshStandardMaterial({ color: preset.hairColor, roughness: 0.6 }));
    spike.position.set((Math.random() - 0.5) * 0.25, 0.45, (Math.random() - 0.5) * 0.25);
    spike.castShadow = true;
    hairGroup.add(spike);
  }
  hairGroup.position.y = 0.15;
  headGroup.add(hairGroup);
  
  // Glowing eyes
  const eyeGeo = new THREE.SphereGeometry(0.05, 8, 8);
  const eyeGlowMat = new THREE.MeshStandardMaterial({ 
    color: 0xff0000, 
    emissive: new THREE.Color(0xff0000),
    emissiveIntensity: 2,
    roughness: 0.1
  });
  const leftEye = new THREE.Mesh(eyeGeo, eyeGlowMat);
  leftEye.position.set(-0.1, 0.05, 0.3);
  headGroup.add(leftEye);
  const rightEye = new THREE.Mesh(eyeGeo, eyeGlowMat);
  rightEye.position.set(0.1, 0.05, 0.3);
  headGroup.add(rightEye);
  
  // Eyebrows
  const browGeo = new THREE.BoxGeometry(0.1, 0.02, 0.03);
  const browMat = new THREE.MeshStandardMaterial({ color: preset.hairColor });
  const leftBrow = new THREE.Mesh(browGeo, browMat);
  leftBrow.position.set(-0.1, 0.12, 0.3);
  headGroup.add(leftBrow);
  const rightBrow = new THREE.Mesh(browGeo, browMat);
  rightBrow.position.set(0.1, 0.12, 0.3);
  headGroup.add(rightBrow);
  
  // Headband (Tekken style)
  const headbandGeo = new THREE.TorusGeometry(0.33, 0.04, 8, 32);
  const headbandMat = new THREE.MeshStandardMaterial({ 
    color: preset.accentColor,
    roughness: 0.3,
    metalness: 0.5,
    emissive: new THREE.Color(preset.accentColor).multiplyScalar(0.3)
  });
  const headband = new THREE.Mesh(headbandGeo, headbandMat);
  headband.position.y = 0.05;
  headband.rotation.x = Math.PI / 2;
  headGroup.add(headband);
  
  headGroup.position.y = 2.0;
  group.add(headGroup);
  parts.headGroup = headGroup;
  
  // Right Arm with detailed muscles
  const rightArmGroup = new THREE.Group();
  rightArmGroup.position.set(0.5, 1.5, 0);
  
  const upperArmGeo = new THREE.CylinderGeometry(0.14, 0.17, 0.6, 12);
  const armMat = new THREE.MeshStandardMaterial({ 
    color: preset.bodyColor, 
    roughness: 0.3, 
    metalness: 0.4 
  });
  const upperArm = new THREE.Mesh(upperArmGeo, armMat);
  upperArm.position.y = -0.1;
  upperArm.castShadow = true; upperArm.receiveShadow = true;
  rightArmGroup.add(upperArm);
  
  // Elbow guard
  const elbowGeo = new THREE.SphereGeometry(0.15, 8, 8);
  const elbowMat = new THREE.MeshStandardMaterial({ 
    color: preset.accentColor, 
    roughness: 0.15, 
    metalness: 0.8,
    emissive: new THREE.Color(preset.accentColor).multiplyScalar(0.3)
  });
  const elbow = new THREE.Mesh(elbowGeo, elbowMat);
  elbow.position.y = -0.45;
  elbow.castShadow = true;
  rightArmGroup.add(elbow);
  
  const forearmGroup = new THREE.Group();
  forearmGroup.position.y = -0.45;
  
  const forearmGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.5, 12);
  const forearm = new THREE.Mesh(forearmGeo, armMat);
  forearm.position.y = -0.15;
  forearm.castShadow = true; forearm.receiveShadow = true;
  forearmGroup.add(forearm);
  
  // Power glove
  const gloveGeo = new THREE.SphereGeometry(0.18, 12, 12);
  const gloveMat = new THREE.MeshStandardMaterial({ 
    color: preset.accentColor, 
    roughness: 0.1, 
    metalness: 0.7,
    emissive: new THREE.Color(preset.accentColor).multiplyScalar(0.5)
  });
  const glove = new THREE.Mesh(gloveGeo, gloveMat);
  glove.position.y = -0.45;
  glove.scale.set(1.1, 1.4, 1.1);
  glove.castShadow = true; glove.receiveShadow = true;
  forearmGroup.add(glove);
  
  // Knuckle spikes
  for (let i = 0; i < 4; i++) {
    const spikeGeo = new THREE.ConeGeometry(0.03, 0.12, 4);
    const spikeMat = new THREE.MeshStandardMaterial({ 
      color: 0xffd700, 
      roughness: 0.1, 
      metalness: 1.0,
      emissive: new THREE.Color(0x332200)
    });
    const spike = new THREE.Mesh(spikeGeo, spikeMat);
    spike.position.set((i - 1.5) * 0.06, -0.55, 0.16);
    spike.rotation.x = -Math.PI / 2;
    forearmGroup.add(spike);
  }
  
  rightArmGroup.add(forearmGroup);
  group.add(rightArmGroup);
  parts.rightArmGroup = rightArmGroup;
  parts.rightForearm = forearmGroup;
  
  // Left Arm (same as right)
  const leftArmGroup = new THREE.Group();
  leftArmGroup.position.set(-0.5, 1.5, 0);
  
  const leftUpperArm = new THREE.Mesh(upperArmGeo, armMat);
  leftUpperArm.position.y = -0.1;
  leftUpperArm.castShadow = true; leftUpperArm.receiveShadow = true;
  leftArmGroup.add(leftUpperArm);
  
  const leftElbow = new THREE.Mesh(elbowGeo, elbowMat);
  leftElbow.position.y = -0.45;
  leftElbow.castShadow = true;
  leftArmGroup.add(leftElbow);
  
  const leftForearmGroup = new THREE.Group();
  leftForearmGroup.position.y = -0.45;
  
  const leftForearm = new THREE.Mesh(forearmGeo, armMat);
  leftForearm.position.y = -0.15;
  leftForearm.castShadow = true; leftForearm.receiveShadow = true;
  leftForearmGroup.add(leftForearm);
  
  const leftGlove = new THREE.Mesh(gloveGeo, gloveMat);
  leftGlove.position.y = -0.45;
  leftGlove.scale.set(1.1, 1.4, 1.1);
  leftGlove.castShadow = true; leftGlove.receiveShadow = true;
  leftForearmGroup.add(leftGlove);
  
  for (let i = 0; i < 4; i++) {
    const spikeGeo = new THREE.ConeGeometry(0.03, 0.12, 4);
    const spikeMat = new THREE.MeshStandardMaterial({ 
      color: 0xffd700, 
      roughness: 0.1, 
      metalness: 1.0,
      emissive: new THREE.Color(0x332200)
    });
    const spike = new THREE.Mesh(spikeGeo, spikeMat);
    spike.position.set((i - 1.5) * 0.06, -0.55, 0.16);
    spike.rotation.x = -Math.PI / 2;
    leftForearmGroup.add(spike);
  }
  
  leftArmGroup.add(leftForearmGroup);
  group.add(leftArmGroup);
  parts.leftArmGroup = leftArmGroup;
  parts.leftForearm = leftForearmGroup;
  
  // Right Leg with armor
  const rightLegGroup = new THREE.Group();
  rightLegGroup.position.set(0.2, 0.5, 0);
  
  const upperLegGeo = new THREE.CylinderGeometry(0.18, 0.2, 0.55, 12);
  const pantsMat = new THREE.MeshStandardMaterial({ 
    color: preset.pantsColor, 
    roughness: 0.5, 
    metalness: 0.1 
  });
  const upperLeg = new THREE.Mesh(upperLegGeo, pantsMat);
  upperLeg.position.y = -0.1;
  upperLeg.castShadow = true; upperLeg.receiveShadow = true;
  rightLegGroup.add(upperLeg);
  
  // Knee guard
  const kneeGeo = new THREE.SphereGeometry(0.16, 8, 8);
  const kneeMat = new THREE.MeshStandardMaterial({ 
    color: preset.accentColor, 
    roughness: 0.15, 
    metalness: 0.8,
    emissive: new THREE.Color(preset.accentColor).multiplyScalar(0.3)
  });
  const knee = new THREE.Mesh(kneeGeo, kneeMat);
  knee.position.y = -0.4;
  knee.castShadow = true;
  rightLegGroup.add(knee);
  
  const lowerLegGroup = new THREE.Group();
  lowerLegGroup.position.y = -0.4;
  
  const lowerLegGeo = new THREE.CylinderGeometry(0.15, 0.18, 0.5, 12);
  const lowerLeg = new THREE.Mesh(lowerLegGeo, pantsMat);
  lowerLeg.position.y = -0.15;
  lowerLeg.castShadow = true; lowerLeg.receiveShadow = true;
  lowerLegGroup.add(lowerLeg);
  
  // Boot
  const bootGeo = new THREE.BoxGeometry(0.2, 0.15, 0.3);
  const bootMat = new THREE.MeshStandardMaterial({ 
    color: 0x1a1a1a, 
    roughness: 0.2, 
    metalness: 0.5 
  });
  const boot = new THREE.Mesh(bootGeo, bootMat);
  boot.position.set(0, -0.45, 0.06);
  boot.castShadow = true; boot.receiveShadow = true;
  lowerLegGroup.add(boot);
  
  rightLegGroup.add(lowerLegGroup);
  group.add(rightLegGroup);
  parts.rightLegGroup = rightLegGroup;
  parts.rightLowerLeg = lowerLegGroup;
  
  // Left Leg
  const leftLegGroup = new THREE.Group();
  leftLegGroup.position.set(-0.2, 0.5, 0);
  
  const leftUpperLeg = new THREE.Mesh(upperLegGeo, pantsMat);
  leftUpperLeg.position.y = -0.1;
  leftUpperLeg.castShadow = true; leftUpperLeg.receiveShadow = true;
  leftLegGroup.add(leftUpperLeg);
  
  const leftKnee = new THREE.Mesh(kneeGeo, kneeMat);
  leftKnee.position.y = -0.4;
  leftKnee.castShadow = true;
  leftLegGroup.add(leftKnee);
  
  const leftLowerLegGroup = new THREE.Group();
  leftLowerLegGroup.position.y = -0.4;
  
  const leftLowerLeg = new THREE.Mesh(lowerLegGeo, pantsMat);
  leftLowerLeg.position.y = -0.15;
  leftLowerLeg.castShadow = true; leftLowerLeg.receiveShadow = true;
  leftLowerLegGroup.add(leftLowerLeg);
  
  const leftBoot = new THREE.Mesh(bootGeo, bootMat);
  leftBoot.position.set(0, -0.45, 0.06);
  leftBoot.castShadow = true; leftBoot.receiveShadow = true;
  leftLowerLegGroup.add(leftBoot);
  
  leftLegGroup.add(leftLowerLegGroup);
  group.add(leftLegGroup);
  parts.leftLegGroup = leftLegGroup;
  
  group.position.set(posX, 0.1, 0);
  group.rotation.y = posX > 0 ? -Math.PI / 2 : Math.PI / 2;
  
  // Name label
  const div = document.createElement('div');
  div.textContent = name;
  div.style.color = '#ffd700';
  div.style.fontWeight = 'bold';
  div.style.fontSize = '16px';
  div.style.textShadow = '2px 2px 4px black';
  div.style.background = 'rgba(0,0,0,0.8)';
  div.style.padding = '4px 12px';
  div.style.borderRadius = '5px';
  div.style.border = '2px solid #ffd700';
  const label = new CSS2DObject(div);
  label.position.set(0, 4.0, 0);
  group.add(label);
  
  return { group, parts };
}

const player1Data = createFighter('jin', -3.5, 'CURIO');
const player2Data = createFighter('lars', 3.5, 'MYSTIC');
const player1 = player1Data.group;
const player2 = player2Data.group;
const p1Parts = player1Data.parts;
const p2Parts = player2Data.parts;
scene.add(player1);
scene.add(player2);
// Martial arts stance
p1Parts.rightArmGroup.rotation.z = -0.4;
p1Parts.rightArmGroup.rotation.x = 0.3;
p1Parts.leftArmGroup.rotation.z = 0.4;
p1Parts.leftArmGroup.rotation.x = 0.3;
p1Parts.rightLegGroup.rotation.x = 0.2;
p1Parts.leftLegGroup.rotation.x = -0.3;

p2Parts.rightArmGroup.rotation.z = -0.4;
p2Parts.rightArmGroup.rotation.x = 0.3;
p2Parts.leftArmGroup.rotation.z = 0.4;
p2Parts.leftArmGroup.rotation.x = 0.3;
p2Parts.rightLegGroup.rotation.x = 0.2;
p2Parts.leftLegGroup.rotation.x = -0.3;


// ---------- PROFESSIONAL EFFECTS ----------
const particles = [];

function spawnHitEffect(position, colorHex) {
  // Main burst
  const burstCount = 40;
  const burstGroup = new THREE.Group();
  const geo = new THREE.SphereGeometry(0.06, 6, 6);
  
  for (let i = 0; i < burstCount; i++) {
    const mat = new THREE.MeshBasicMaterial({ 
      color: colorHex, 
      transparent: true, 
      opacity: 1 
    });
    const particle = new THREE.Mesh(geo, mat);
    particle.position.set(
      (Math.random() - 0.5) * 1.0,
      (Math.random() - 0.5) * 1.0 + 0.2,
      (Math.random() - 0.5) * 1.0
    );
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 5,
      Math.random() * 6 + 2,
      (Math.random() - 0.5) * 5
    );
    particle.userData = { vel };
    burstGroup.add(particle);
  }
  burstGroup.position.copy(position);
  scene.add(burstGroup);
  particles.push({ group: burstGroup, life: 0.5 });
  
  // Shockwave ring
  const ringGeo = new THREE.TorusGeometry(0.2, 0.1, 16, 32);
  const ringMat = new THREE.MeshBasicMaterial({ 
    color: 0xffffff, 
    transparent: true, 
    opacity: 0.9 
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.copy(position);
  ring.rotation.x = Math.PI / 2;
  scene.add(ring);
  particles.push({ group: ring, life: 0.3, scale: true, startScale: 0.2 });
  
  // Sparks
  for (let i = 0; i < 15; i++) {
    const sparkGeo = new THREE.SphereGeometry(0.03, 4, 4);
    const sparkMat = new THREE.MeshBasicMaterial({ 
      color: 0xffd700, 
      transparent: true, 
      opacity: 1 
    });
    const spark = new THREE.Mesh(sparkGeo, sparkMat);
    spark.position.copy(position);
    spark.userData = { 
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        Math.random() * 8 + 3,
        (Math.random() - 0.5) * 8
      )
    };
    scene.add(spark);
    particles.push({ group: spark, life: 0.4 });
  }
}

// Aura effects
const aura1Geo = new THREE.TorusGeometry(0.85, 0.04, 16, 32);
const aura1Mat = new THREE.MeshBasicMaterial({ 
  color: 0xff4444, 
  transparent: true, 
  opacity: 0.4 
});
const aura1 = new THREE.Mesh(aura1Geo, aura1Mat);
aura1.rotation.x = Math.PI / 2;
aura1.position.y = 0.2;
player1.add(aura1);

const aura2Geo = new THREE.TorusGeometry(0.85, 0.04, 16, 32);
const aura2Mat = new THREE.MeshBasicMaterial({ 
  color: 0x4488ff, 
  transparent: true, 
  opacity: 0.4 
});
const aura2 = new THREE.Mesh(aura2Geo, aura2Mat);
aura2.rotation.x = Math.PI / 2;
aura2.position.y = 0.2;
player2.add(aura2);

// ---------- ANIMATION FUNCTIONS ----------
function animatePunch(parts, isRight) {
  const armGroup = isRight ? parts.rightArmGroup : parts.leftArmGroup;
  const forearm = isRight ? parts.rightForearm : parts.leftForearm;
  
  armGroup.rotation.z = isRight ? -1.8 : 1.8;
  armGroup.rotation.x = -0.8;
  forearm.rotation.x = -1.5;
}

function animateKick(parts, isRight) {
  const legGroup = isRight ? parts.rightLegGroup : parts.leftLegGroup;
  const lowerLeg = isRight ? parts.rightLowerLeg : parts.leftLowerLeg;
  
  legGroup.rotation.x = -2.0;
  if (lowerLeg) lowerLeg.rotation.x = -0.8;
}

function resetPose(parts) {
  if (parts.rightArmGroup) {
    parts.rightArmGroup.rotation.z = -0.4;
    parts.rightArmGroup.rotation.x = 0.3;
    if (parts.rightForearm) parts.rightForearm.rotation.x = 0;
  }
  if (parts.leftArmGroup) {
    parts.leftArmGroup.rotation.z = 0.4;
    parts.leftArmGroup.rotation.x = 0.3;
    if (parts.leftForearm) parts.leftForearm.rotation.x = 0;
  }
  if (parts.rightLegGroup) {
    parts.rightLegGroup.rotation.x = 0.2;
    if (parts.rightLowerLeg) parts.rightLowerLeg.rotation.x = 0;
  }
  if (parts.leftLegGroup) {
    parts.leftLegGroup.rotation.x = -0.3;
  }
}

// ---------- GAME LOGIC ----------
function updateHealthBars() {
  const p1Percent = Math.max(0, state.p1Health);
  const p2Percent = Math.max(0, state.p2Health);
  p1HealthFill.style.width = `${p1Percent}%`;
  p2HealthFill.style.width = `${p2Percent}%`;
  p1HealthText.textContent = `${Math.ceil(p1Percent)}%`;
  p2HealthText.textContent = `${Math.ceil(p2Percent)}%`;
  
  if (p1Percent < 30) p1HealthFill.style.background = 'linear-gradient(90deg, #ff0000, #ff4444)';
  else if (p1Percent < 60) p1HealthFill.style.background = 'linear-gradient(90deg, #ffaa00, #ffdd00)';
  else p1HealthFill.style.background = 'linear-gradient(90deg, #00ff00, #88ff00)';
  
  if (p2Percent < 30) p2HealthFill.style.background = 'linear-gradient(90deg, #ff0000, #ff4444)';
  else if (p2Percent < 60) p2HealthFill.style.background = 'linear-gradient(90deg, #ffaa00, #ffdd00)';
  else p2HealthFill.style.background = 'linear-gradient(90deg, #00ff00, #88ff00)';
}

function showKO(winner) {
  state.roundOver = true;
  state.gameActive = false;
  state.screenShake = 0.5;
  koContainer.style.display = 'flex';
  setTimeout(() => {
    rematchPanel.style.display = 'flex';
  }, 800);
  if (winner === 'p1') koWinner.textContent = 'CURIO WINS!';
  else if (winner === 'p2') koWinner.textContent = 'MYSTIC WINS!';
  else koWinner.textContent = 'DRAW!';
}

function checkRoundEnd() {
  if (state.roundOver) return true;
  if (state.p1Health <= 0 || state.p2Health <= 0 || state.timer <= 0) {
    if (state.p1Health <= 0) state.winner = 'p2';
    else if (state.p2Health <= 0) state.winner = 'p1';
    else state.winner = state.p1Health > state.p2Health ? 'p1' : 'p2';
    showKO(state.winner);
    return true;
  }
  return false;
}

function applyDamage(target, amount, attackerPos) {
  if (!state.gameActive || state.roundOver) return;
  
  if (target === 'p1') {
    state.p1Health = Math.max(0, state.p1Health - amount);
    spawnHitEffect(player1.position.clone().add(new THREE.Vector3(0, 1.3, 0)), 0xff4444);
    const dir = new THREE.Vector3().subVectors(player1.position, attackerPos).normalize();
    player1.position.add(dir.multiplyScalar(1.0));
    state.screenShake = 0.15;
  } else {
    state.p2Health = Math.max(0, state.p2Health - amount);
    spawnHitEffect(player2.position.clone().add(new THREE.Vector3(0, 1.3, 0)), 0x4488ff);
    const dir = new THREE.Vector3().subVectors(player2.position, attackerPos).normalize();
    player2.position.add(dir.multiplyScalar(1.0));
    state.screenShake = 0.15;
  }
  
  updateHealthBars();
  checkRoundEnd();
}

function handleAttacks() {
  if (!state.gameActive) return;
  
  if (p1AttackCooldown <= 0 && p1AttackAnim <= 0) {
    if (keys.f || keys.g) {
      const isPunch = keys.f;
      const damage = isPunch ? 7 : 11;
      const dist = player1.position.distanceTo(player2.position);
      if (dist < 2.8) {
        applyDamage('p2', damage, player1.position);
        p1AttackCooldown = ATTACK_COOLDOWN;
        p1AttackAnim = ATTACK_ANIM_DURATION;
        if (isPunch) animatePunch(p1Parts, true);
        else animateKick(p1Parts, true);
      }
    }
  }
  
  if (p2AttackCooldown <= 0 && p2AttackAnim <= 0) {
    if (state.gameMode === 'multiplayer') {
      if (keys.comma || keys.period) {
        const isPunch = keys.comma;
        const damage = isPunch ? 7 : 11;
        const dist = player2.position.distanceTo(player1.position);
        if (dist < 2.8) {
          applyDamage('p1', damage, player2.position);
          p2AttackCooldown = ATTACK_COOLDOWN;
          p2AttackAnim = ATTACK_ANIM_DURATION;
          if (isPunch) animatePunch(p2Parts, true);
          else animateKick(p2Parts, true);
        }
      }
    } else if (state.gameMode === 'bot' && botAction === 'attack') {
      const isPunch = Math.random() > 0.4;
      const damage = isPunch ? 7 : 11;
      const dist = player2.position.distanceTo(player1.position);
      if (dist < 2.8) {
        applyDamage('p1', damage, player2.position);
        p2AttackCooldown = ATTACK_COOLDOWN;
        p2AttackAnim = ATTACK_ANIM_DURATION;
        if (isPunch) animatePunch(p2Parts, true);
        else animateKick(p2Parts, true);
      }
    }
  }
}

function updateBot(deltaTime) {
  if (state.gameMode !== 'bot' || !state.gameActive) return;
  
  botTimer -= deltaTime;
  if (botTimer <= 0) {
    botTimer = 0.3 + Math.random() * 1.2;
    const actions = ['moveLeft', 'moveRight', 'moveForward', 'moveBack', 'idle', 'attack', 'attack'];
    botAction = actions[Math.floor(Math.random() * actions.length)];
  }
  
  const speed = 3.5;
  const moveDelta = speed * deltaTime;
  const dist = player2.position.distanceTo(player1.position);
  
  if (dist > 3.5) {
    const dir = new THREE.Vector3().subVectors(player1.position, player2.position).normalize();
    player2.position.add(dir.multiplyScalar(moveDelta));
  } else if (dist < 1.5) {
    const dir = new THREE.Vector3().subVectors(player2.position, player1.position).normalize();
    player2.position.add(dir.multiplyScalar(moveDelta * 0.5));
  } else if (botAction.startsWith('move')) {
    if (botAction === 'moveLeft') player2.position.x -= moveDelta;
    if (botAction === 'moveRight') player2.position.x += moveDelta;
    if (botAction === 'moveForward') player2.position.z -= moveDelta;
    if (botAction === 'moveBack') player2.position.z += moveDelta;
  }
  
  player2.position.x = Math.max(-4.5, Math.min(4.5, player2.position.x));
  player2.position.z = Math.max(-3, Math.min(3, player2.position.z));
}

function movePlayers(deltaTime) {
  if (!state.gameActive) return;
  const speed = 4.5;
  const moveDelta = speed * deltaTime;
  
  if (keys.a) player1.position.x -= moveDelta;
  if (keys.d) player1.position.x += moveDelta;
  if (keys.w) player1.position.z -= moveDelta;
  if (keys.s) player1.position.z += moveDelta;
  const p1Moving = keys.w || keys.a || keys.s || keys.d;
p1Parts.rightLegGroup.rotation.x = p1Moving ? 0.2 + Math.sin(Date.now() * 0.015) * 0.4 : 0.2;
p1Parts.leftLegGroup.rotation.x = p1Moving ? -0.3 + Math.cos(Date.now() * 0.015) * 0.4 : -0.3;

 const p2Moving = keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight;
p2Parts.rightLegGroup.rotation.x = p2Moving ? 0.2 + Math.sin(Date.now() * 0.015) * 0.4 : 0.2;
p2Parts.leftLegGroup.rotation.x = p2Moving ? -0.3 + Math.cos(Date.now() * 0.015) * 0.4 : -0.3;
  
  if (state.gameMode === 'multiplayer') {
    if (keys.ArrowLeft) player2.position.x -= moveDelta;
    if (keys.ArrowRight) player2.position.x += moveDelta;
    if (keys.ArrowUp) player2.position.z -= moveDelta;
    if (keys.ArrowDown) player2.position.z += moveDelta;
  }
  
  player1.position.x = Math.max(-4.5, Math.min(4.5, player1.position.x));
  player1.position.z = Math.max(-3, Math.min(3, player1.position.z));
  player2.position.x = Math.max(-4.5, Math.min(4.5, player2.position.x));
  player2.position.z = Math.max(-3, Math.min(3, player2.position.z));
  
  const dist = player1.position.distanceTo(player2.position);
  if (dist < 1.2) {
    const dir = new THREE.Vector3().subVectors(player1.position, player2.position).normalize();
    player1.position.add(dir.clone().multiplyScalar(0.04));
    player2.position.add(dir.clone().multiplyScalar(-0.04));
  }
}

function updateTimer(deltaTime) {
  if (!state.gameActive || state.roundOver) return;
  state.timer -= deltaTime;
  if (state.timer < 0) state.timer = 0;
  timerEl.textContent = Math.ceil(state.timer);
  if (state.timer <= 0) checkRoundEnd();
}

// ---------- GAME CONTROL ----------
function startGame(mode) {
  state.gameMode = mode;
  state.gameActive = true;
  state.roundOver = false;
  state.timer = 60;
  state.p1Health = 100;
  state.p2Health = 100;
  state.winner = null;
  state.screenShake = 0;
  player1.position.set(-3.5, 0.1, 0);
  player2.position.set(3.5, 0.1, 0);
  p1AttackCooldown = 0;
  p2AttackCooldown = 0;
  p1AttackAnim = 0;
  p2AttackAnim = 0;
  botTimer = 1;
  botAction = 'idle';
  
  modeSelection.style.display = 'none';
  controlsBar.style.display = 'flex';
  koContainer.style.display = 'none';
  rematchPanel.style.display = 'none';
  
  resetPose(p1Parts);
  resetPose(p2Parts);
  updateHealthBars();
  timerEl.textContent = '60';
  
  particles.forEach(p => scene.remove(p.group));
  particles.length = 0;
}

function resetMatch() {
  state.gameActive = true;
  state.roundOver = false;
  state.timer = 60;
  state.p1Health = 100;
  state.p2Health = 100;
  state.winner = null;
  state.screenShake = 0;
  player1.position.set(-3.5, 0.1, 0);
  player2.position.set(3.5, 0.1, 0);
  p1AttackCooldown = 0;
  p2AttackCooldown = 0;
  p1AttackAnim = 0;
  p2AttackAnim = 0;
  botTimer = 1;
  botAction = 'idle';
  
  koContainer.style.display = 'none';
  rematchPanel.style.display = 'none';
  
  resetPose(p1Parts);
  resetPose(p2Parts);
  updateHealthBars();
  timerEl.textContent = '60';
  
  particles.forEach(p => scene.remove(p.group));
  particles.length = 0;
}

function goToMainMenu() {
  state.gameActive = false;
  state.gameMode = null;
  modeSelection.style.display = 'flex';
  controlsBar.style.display = 'none';
  koContainer.style.display = 'none';
  rematchPanel.style.display = 'none';
  player1.position.set(-3.5, 0.1, 0);
  player2.position.set(3.5, 0.1, 0);
  resetPose(p1Parts);
  resetPose(p2Parts);
}

document.getElementById('vsBotBtn').addEventListener('click', () => startGame('bot'));
document.getElementById('multiplayerBtn').addEventListener('click', () => startGame('multiplayer'));
document.getElementById('rematchYes').addEventListener('click', resetMatch);
document.getElementById('mainMenuBtn').addEventListener('click', goToMainMenu);

window.addEventListener('keydown', (e) => {
  const key = e.key;
  if (key in keys) { keys[key] = true; e.preventDefault(); }
  if (key === ',') { keys.comma = true; e.preventDefault(); }
  if (key === '.') { keys.period = true; e.preventDefault(); }
});

window.addEventListener('keyup', (e) => {
  const key = e.key;
  if (key in keys) { keys[key] = false; e.preventDefault(); }
  if (key === ',') { keys.comma = false; e.preventDefault(); }
  if (key === '.') { keys.period = false; e.preventDefault(); }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- ANIMATION LOOP ----------
let clock = new THREE.Clock();

function animate() {
  const delta = Math.min(clock.getDelta(), 0.1);
  
  if (state.gameActive) {
    if (p1AttackCooldown > 0) p1AttackCooldown -= delta;
    if (p2AttackCooldown > 0) p2AttackCooldown -= delta;
    
    if (p1AttackAnim > 0) {
      p1AttackAnim -= delta;
      if (p1AttackAnim <= 0) resetPose(p1Parts);
    }
    if (p2AttackAnim > 0) {
      p2AttackAnim -= delta;
      if (p2AttackAnim <= 0) resetPose(p2Parts);
    }
    
    movePlayers(delta);
    if (state.gameMode === 'bot') updateBot(delta);
    handleAttacks();
    updateTimer(delta);
    
    // Aura animations
    aura1.rotation.z += 0.05;
    aura2.rotation.z -= 0.05;
    aura1.material.opacity = 0.3 + Math.sin(Date.now() * 0.01) * 0.2;
    aura2.material.opacity = 0.3 + Math.cos(Date.now() * 0.01) * 0.2;
    const t = Date.now() * 0.003;
    // Idle breathing - smoother
    player1.position.y = 0.1 + Math.sin(t) * 0.04;
    player2.position.y = 0.1 + Math.cos(t) * 0.04;

    //arm away
    p1Parts.rightArmGroup.rotation.z = -0.4 + Math.sin(t) * 0.04;
    p1Parts.leftArmGroup.rotation.z = 0.4 + Math.cos(t) * 0.04;
    p2Parts.rightArmGroup.rotation.z = -0.4 + Math.sin(t+1)* 0.04;
    p2Parts.leftArmGroup.rotation.z = 0.4 + Math.cos(t+1)*0.04;
    p1Parts.torso.rotation.y = Math.sin(t*0.7)*0.02;
    p2Parts.torso.rotation.y = Math.cos(t*0.7)*0.02;
    
    // brathing chest animation

      const chestBreathe = 1 +Math.sin(t*0.5) * 0.03;
      p1Parts.torso.scale.set(chestBreathe, 1, chestBreathe);
      p2Parts.torso.scale.set(chestBreathe, 1, chestBreathe);

    
    // Atmosphere particles
    atmosphereParticles.children.forEach((p, i) => {
      p.position.y += Math.sin(Date.now() * 0.001 + i) * 0.003;
    });
  }
  
  // Update particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= delta;
    
    if (p.scale) {
      const scale = p.startScale + (1 - p.life / 0.3) * 3;
      p.group.scale.setScalar(scale);
      p.group.material.opacity = p.life * 2;
    }
    
    if (p.group.children) {
      p.group.children.forEach(child => {
        child.material.opacity = Math.min(1, p.life * 2);
        if (child.userData && child.userData.vel) {
          child.position.add(child.userData.vel.clone().multiplyScalar(delta));
          child.userData.vel.y -= 12 * delta;
        }
      });
    } else if (p.group.userData && p.group.userData.vel) {
      p.group.position.add(p.group.userData.vel.clone().multiplyScalar(delta));
      p.group.userData.vel.y -= 12 * delta;
      p.group.material.opacity = p.life * 2;
    }
    
    if (p.life <= 0) {
      scene.remove(p.group);
      particles.splice(i, 1);
    }
  }
  
  // Dynamic camera
  camera.position.set(0, 6, 14);
  camera.lookAt(0, 1.5, 0);
  
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
  requestAnimationFrame(animate);
}

updateHealthBars();
animate();