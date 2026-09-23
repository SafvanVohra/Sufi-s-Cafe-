import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// ===== Scene Setup =====
const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100); // aspect updated below
// Disable antialias for enormous framerate jumps on phones and set explicit performance hints
const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: "default" });

const container = document.getElementById('canvas-wrapper');
container.appendChild(renderer.domElement);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Capped ratio for massive performance boost
renderer.shadowMap.enabled = false; // Disable shadows globally since they severely bottleneck mobile GPUs

// Orbit Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enableZoom = false; // Prevent wheel zoom so normal page scrolling works
controls.enablePan = false;
controls.dampingFactor = 0.05;
controls.rotateSpeed = 0.8;

// Responsive Camera
const updateCameraAndRenderer = () => {
  // Use explicitly window inner dims to prevent mobile browser glitches where the canvas inherits the huge page height
  const width = window.innerWidth;
  const height = window.innerHeight;

  // Update aspect ratio
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);

  // Responsive camera Z distance and Target Pan Offset
  const screenWidth = window.innerWidth;
  if (screenWidth < 480) {
    camera.position.set(10, 0, 45); // mobile
    controls.target.set(0, -1.0, 0); // pan camera down to explicitly push cup up
  } else if (screenWidth < 768) {
    camera.position.set(10, 0, 35); // tablet
    controls.target.set(0, -0.5, 0);
  } else {
    camera.position.set(10, 0, 30); // desktop
    controls.target.set(0, 1, 0);
  }
  controls.update();
};

updateCameraAndRenderer();
window.addEventListener('resize', updateCameraAndRenderer);

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.6));

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
hemiLight.position.set(0, 20, 0);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 2);
dirLight.position.set(-2, 0, 2);
dirLight.castShadow = false; // Disabled shadow computation
scene.add(dirLight);

// Ground
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: 0x333333 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = false; // Disabled shadow map
scene.add(ground);

// Animation Variables
let fluidFrames = [];
let currentFrame = 0;
let frameDelay = 1;
let frameCount = 0;
let cupGroup = null;
let coffeeStarted = true;
let animTime = 0;

const toRadians = deg => THREE.MathUtils.degToRad(deg);

const initialRotation = { x: toRadians(5), y: toRadians(-70), z: toRadians(-7) };
const finalRotation = { x: toRadians(45), y: toRadians(-70), z: toRadians(17) };
const initialPosition = { x: 0, y: 0, z: 0 };
const finalPosition = { x: 1, y: 0.76, z: 1.9 };

const fluidPosition = { x: 1, y: -11.5, z: 4 };
const fluidInitialRotation = { x: 0, y: toRadians(-90), z: 0 };

// Load Model
const loader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('libs/draco/');
loader.setDRACOLoader(dracoLoader);

loader.load(
  'node-draco.glb',
  (gltf) => {
    const allChildren = gltf.scene.children;

    // Fluid frames
    fluidFrames = allChildren.filter(child => /^Fluid_Frame_(\d+)$/.test(child.name));
    fluidFrames.sort((a, b) => {
      const aNum = parseInt(a.name.split('_').pop());
      const bNum = parseInt(b.name.split('_').pop());
      return aNum - bNum;
    });

    fluidFrames.forEach(mesh => {
      mesh.visible = false;
      mesh.position.set(fluidPosition.x, fluidPosition.y, fluidPosition.z);
      mesh.rotation.set(fluidInitialRotation.x, fluidInitialRotation.y, fluidInitialRotation.z);
      scene.add(mesh);
    });

    // Cup - positioned in pouring pose immediately from the start
    cupGroup = allChildren.find(child => child.name === 'samplecup');
    if (cupGroup) {
      cupGroup.rotation.set(finalRotation.x, finalRotation.y, finalRotation.z);
      cupGroup.position.set(finalPosition.x, finalPosition.y, finalPosition.z);
      scene.add(cupGroup);
    } else {
      console.warn('⚠️ Cup group not found.');
    }

    // Make materials double-sided and receive light
    gltf.scene.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        node.material.side = THREE.DoubleSide;
      }
    });

    // Start pouring animation immediately
    coffeeStarted = true;
    if (fluidFrames[0]) fluidFrames[0].visible = true;

    const el = document.getElementById('progress-container');
    if (el) {
      el.style.transition = 'opacity 0.4s ease';
      el.style.opacity = '0';
      setTimeout(() => { el.style.display = 'none'; }, 400);
    }

    animate();
  },
  (xhr) => {
    const progress = (xhr.loaded / xhr.total * 100).toFixed(1);
    const el = document.getElementById('progress-container');
    if (el) el.textContent = `Loading model: ${progress}%`;
  },
  (error) => {
    console.error('❌ Error loading model:', error);
    const el = document.getElementById('progress-container');
    if (el) el.textContent = 'Error loading model.';
  }
);

// Check if Hero Section is visible in the viewport
const isHeroInView = () => {
  const hero = document.getElementById('hero');
  if (!hero) return true;
  const rect = hero.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < window.innerHeight;
};

// Animate
function animate() {
  requestAnimationFrame(animate);

  // Suspend heavy rendering only when hero is completely scrolled off-screen
  if (!isHeroInView()) return;

  // Continuous fluid pouring animation loop and synced floating hover motion right from the start
  if (coffeeStarted && fluidFrames.length > 0) {
    frameCount++;
    if (frameCount % frameDelay === 0) {
      fluidFrames[currentFrame].visible = false;
      currentFrame = (currentFrame + 1) % fluidFrames.length;
      fluidFrames[currentFrame].visible = true;
    }

    // Gentle breathing hover motion: keeps cup and pouring liquid in perfect alignment
    animTime += 0.025;
    const floatY = Math.sin(animTime) * 0.06;
    if (cupGroup) {
      cupGroup.position.y = finalPosition.y + floatY;
    }
    if (fluidFrames[currentFrame]) {
      fluidFrames[currentFrame].position.y = fluidPosition.y + floatY;
    }
  }

  controls.update();
  renderer.render(scene, camera);
}
