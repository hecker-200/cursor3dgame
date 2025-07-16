// main.js
// 3D First-Person Horror Game using Three.js
// Replace all placeholder assets with your own files as needed.

let camera, scene, renderer, controls;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let prevTime = performance.now();
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let objects = [];
let flashlight, hallway, ghost, ghostMixer;
let flickerLights = [];
let ghostLoaded = false;
let ghostVisible = false;
let ghostJumped = false;
let heartbeatAudio, ambientAudio, footstepAudio, screamAudio;
let storyText, overlay, startButton;
let triggerZones = [
  { position: 10, text: "You feel a chill run down your spine..." },
  { position: 30, text: "Something is watching you." },
  { position: 50, text: "Don't look back." }
];
let currentZone = 0;
let hallwayLength = 60;
let cameraShakeTime = 0;

// Asset placeholders
const WALL_TEXTURE = 'assets/textures/wall_placeholder.jpg';
const FLOOR_TEXTURE = 'assets/textures/floor_placeholder.jpg';
const CEILING_TEXTURE = 'assets/textures/ceiling_placeholder.jpg';
const GHOST_MODEL = 'assets/models/ghost_placeholder.glb';

init();

function init() {
  // Overlay and UI
  overlay = document.getElementById('overlay');
  startButton = document.getElementById('startButton');
  storyText = document.getElementById('storyText');
  startButton.addEventListener('click', startGame);

  // Audio elements
  screamAudio = document.getElementById('screamSound');
  heartbeatAudio = document.getElementById('heartbeatSound');
  ambientAudio = document.getElementById('ambientMusic');
  footstepAudio = document.getElementById('footstepSound');
}

function startGame() {
  overlay.style.display = 'none';
  // Start ambient and heartbeat music
  ambientAudio.volume = 0.5;
  ambientAudio.play();
  heartbeatAudio.volume = 0.1;
  heartbeatAudio.play();

  // Three.js scene setup
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x110000, 0.08); // Dark red fog

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.6, 0);

  // Dim red ambient light
  const ambientLight = new THREE.AmbientLight(0x330000, 0.5);
  scene.add(ambientLight);

  // Flashlight (spotlight attached to camera)
  flashlight = new THREE.SpotLight(0xffffff, 2, 10, Math.PI / 8, 0.5, 1);
  flashlight.position.set(0, 1.5, 0);
  flashlight.target.position.set(0, 1.5, -1);
  camera.add(flashlight);
  camera.add(flashlight.target);
  scene.add(camera);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000);
  document.body.appendChild(renderer.domElement);

  // PointerLockControls
  controls = new THREE.PointerLockControls(camera, document.body);
  document.body.addEventListener('click', () => {
    controls.lock();
  });
  controls.addEventListener('lock', () => {
    document.body.style.cursor = 'none';
  });
  controls.addEventListener('unlock', () => {
    document.body.style.cursor = 'auto';
  });

  // WASD movement
  const onKeyDown = function (event) {
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW': moveForward = true; break;
      case 'ArrowLeft':
      case 'KeyA': moveLeft = true; break;
      case 'ArrowDown':
      case 'KeyS': moveBackward = true; break;
      case 'ArrowRight':
      case 'KeyD': moveRight = true; break;
    }
  };
  const onKeyUp = function (event) {
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW': moveForward = false; break;
      case 'ArrowLeft':
      case 'KeyA': moveLeft = false; break;
      case 'ArrowDown':
      case 'KeyS': moveBackward = false; break;
      case 'ArrowRight':
      case 'KeyD': moveRight = false; break;
    }
  };
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);

  // Hallway geometry
  createHallway();

  // Flickering ceiling lights
  createFlickerLights();

  // Load ghost model
  loadGhost();

  // Handle window resize
  window.addEventListener('resize', onWindowResize);

  // Start render loop
  animate();

  // Start ghost jump scare timer
  setTimeout(triggerGhostJumpScare, 30000); // 30 seconds
}

function createHallway() {
  // Hallway dimensions
  const width = 4, height = 3, length = hallwayLength;
  // Wall
  const wallTexture = new THREE.TextureLoader().load(WALL_TEXTURE);
  wallTexture.wrapS = wallTexture.wrapT = THREE.RepeatWrapping;
  wallTexture.repeat.set(length / 2, 1);
  // Floor
  const floorTexture = new THREE.TextureLoader().load(FLOOR_TEXTURE);
  floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
  floorTexture.repeat.set(length / 2, width / 2);
  // Ceiling
  const ceilingTexture = new THREE.TextureLoader().load(CEILING_TEXTURE);
  ceilingTexture.wrapS = ceilingTexture.wrapT = THREE.RepeatWrapping;
  ceilingTexture.repeat.set(length / 2, width / 2);

  // Floor
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.1, length),
    new THREE.MeshPhongMaterial({ map: floorTexture })
  );
  floor.position.set(0, 0, -length / 2);
  scene.add(floor);
  objects.push(floor);

  // Ceiling
  const ceiling = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.1, length),
    new THREE.MeshPhongMaterial({ map: ceilingTexture })
  );
  ceiling.position.set(0, height, -length / 2);
  scene.add(ceiling);

  // Left wall
  const leftWall = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, height, length),
    new THREE.MeshPhongMaterial({ map: wallTexture })
  );
  leftWall.position.set(-width / 2, height / 2, -length / 2);
  scene.add(leftWall);
  objects.push(leftWall);

  // Right wall
  const rightWall = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, height, length),
    new THREE.MeshPhongMaterial({ map: wallTexture })
  );
  rightWall.position.set(width / 2, height / 2, -length / 2);
  scene.add(rightWall);
  objects.push(rightWall);
}

function createFlickerLights() {
  // Place flickering lights along the hallway ceiling
  for (let i = 4; i < hallwayLength; i += 8) {
    const light = new THREE.PointLight(0xff2222, 1, 8);
    light.position.set(0, 2.8, -i);
    scene.add(light);
    flickerLights.push(light);
  }
}

function loadGhost() {
  const loader = new THREE.GLTFLoader();
  loader.load(GHOST_MODEL, (gltf) => {
    ghost = gltf.scene;
    ghost.position.set(0, 0, -hallwayLength + 5); // Far down the hallway
    ghost.scale.set(1.5, 1.5, 1.5);
    scene.add(ghost);
    ghostLoaded = true;
    // If the model has animation
    if (gltf.animations && gltf.animations.length > 0) {
      ghostMixer = new THREE.AnimationMixer(ghost);
      ghostMixer.clipAction(gltf.animations[0]).play();
    }
  });
}

function triggerGhostJumpScare() {
  if (!ghostLoaded || ghostJumped) return;
  // Move ghost 5 units in front of player
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  ghost.position.copy(camera.position).add(dir.multiplyScalar(5));
  ghost.position.y = 0; // Keep on floor
  ghostVisible = true;
  ghostJumped = true;
  screamAudio.currentTime = 0;
  screamAudio.volume = 1;
  screamAudio.play();
  cameraShakeTime = 0.7; // Shake for 0.7s
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  const time = performance.now();
  const delta = (time - prevTime) / 1000;

  // Flicker ceiling lights
  flickerLights.forEach(light => {
    light.intensity = 0.7 + Math.random() * 0.7 * (Math.random() > 0.7 ? 1 : 0.3);
  });

  // Ghost animation
  if (ghostMixer) ghostMixer.update(delta);

  // Camera shake effect
  if (cameraShakeTime > 0) {
    cameraShakeTime -= delta;
    camera.position.x += (Math.random() - 0.5) * 0.1;
    camera.position.y += (Math.random() - 0.5) * 0.1;
  }

  // Player movement
  if (controls.isLocked) {
    direction.z = Number(moveForward) - Number(moveBackward);
    direction.x = Number(moveRight) - Number(moveLeft);
    direction.normalize();
    // Simple collision with walls
    let speed = 4.0;
    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;
    if (moveForward || moveBackward) velocity.z -= direction.z * speed * delta;
    if (moveLeft || moveRight) velocity.x -= direction.x * speed * delta;
    controls.moveRight(-velocity.x * delta);
    controls.moveForward(-velocity.z * delta);
    // Play footstep sound
    if ((moveForward || moveBackward || moveLeft || moveRight) && footstepAudio.paused) {
      footstepAudio.currentTime = 0;
      footstepAudio.volume = 0.5;
      footstepAudio.play();
    }
    if (!(moveForward || moveBackward || moveLeft || moveRight)) {
      footstepAudio.pause();
      footstepAudio.currentTime = 0;
    }
  }

  // Heartbeat volume increases near ghost
  if (ghostLoaded && ghostVisible) {
    const dist = camera.position.distanceTo(ghost.position);
    heartbeatAudio.volume = Math.min(1, 1.2 - dist / 10);
  } else {
    // Subtle heartbeat before ghost appears
    heartbeatAudio.volume = 0.1;
  }

  // Story text trigger zones
  if (currentZone < triggerZones.length) {
    const zone = triggerZones[currentZone];
    if (Math.abs(camera.position.z) > zone.position) {
      showStoryText(zone.text);
      currentZone++;
    }
  }

  renderer.render(scene, camera);
  prevTime = time;
}

function showStoryText(text) {
  storyText.textContent = text;
  storyText.classList.remove('hidden');
  storyText.classList.add('visible');
  setTimeout(() => {
    storyText.classList.remove('visible');
    storyText.classList.add('hidden');
  }, 4000);
}
