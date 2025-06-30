import * as THREE from 'https://unpkg.com/three@0.162.0/build/three.module.js';
import { PointerLockControls } from 'https://unpkg.com/three@0.162.0/examples/jsm/controls/PointerLockControls.js';
import { VRButton } from 'https://unpkg.com/three@0.162.0/examples/jsm/webxr/VRButton.js';
import { XRControllerModelFactory } from 'https://unpkg.com/three@0.162.0/examples/jsm/webxr/XRControllerModelFactory.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.162.0/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'https://unpkg.com/three@0.162.0/examples/jsm/loaders/DRACOLoader.js';
import { RoundedBoxGeometry } from 'https://unpkg.com/three@0.162.0/examples/jsm/geometries/RoundedBoxGeometry.js';

// Create scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x666666); // Medium gray background

// Museum dimensions
const MUSEUM = {
    width: 40,
    height: 12,
    depth: 40,
    wallThickness: .2
};

// Create camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 4.7, 0); // Position at entrance, human height
camera.lookAt(0, 3, MUSEUM.depth/2 );

// Create player rig
const playerRig = new THREE.Group();
playerRig.add(camera);
scene.add(playerRig);

// Create renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true; // Enable XR support
document.body.appendChild(renderer.domElement);

// Create and add VR button
const vrButton = VRButton.createButton(renderer);
vrButton.style.position = 'absolute';
vrButton.style.bottom = '100px'; // Move it up from the bottom
vrButton.style.left = '50%';
vrButton.style.transform = 'translateX(-50%)';
document.body.appendChild(vrButton);

// First Person Controls Setup
const controls = new PointerLockControls(camera, document.body);

// Movement variables
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let isSprinting = false;

const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let baseSpeed = .7; // Reduced default speed 
const sprintMultiplier = 1.5; // Reduced sprint multiplier 

// VR movement variables
let isMoving = false;
const moveSpeed = 0.1;

// Add instructions overlay
const instructions = document.createElement('div');
instructions.style.position = 'fixed';
instructions.style.width = '100%';
instructions.style.height = '100%';
instructions.style.top = '0';
instructions.style.left = '0';
instructions.style.display = 'flex';
instructions.style.flexDirection = 'column';
instructions.style.justifyContent = 'center';
instructions.style.alignItems = 'center';
instructions.style.color = '#ffffff';
instructions.style.backgroundColor = 'rgba(0, 0, 0, 0.41)';
instructions.style.textAlign = 'center';
instructions.style.zIndex = '1'; // Lower z-index for instructions

// Create different instruction content for mobile and desktop
function getInstructionsContent() {
    if (isMobileDevice()) {
        return `
            <div style="padding: 20px; background: rgba(0,0,0,0.7); border-radius: 10px;">
                <h1 style="margin: 0 0 20px 0;">Welcome to Cafe Fomento</h1>
                <p style="margin: 0 0 10px 0;">Tap to start</p>
                <p style="margin: 0;">
                    <strong>Mobile Controls:</strong><br>
                    • Left joystick: Move around<br>
                    • Right area: Look around<br>
                    • Green button: Interact with objects<br>
                    • Tap screens to open content<br>
                    • Tap coffee info for details
                </p>
                <p id="error-message" style="color: #ff4444; margin-top: 10px; display: none;">
                    Unable to start. Please ensure:<br>
                    - You're using a supported mobile browser<br>
                    - The page is served from a web server<br>
                    - You've allowed necessary permissions
                </p>
                <button id="startButton" style="margin-top: 20px; padding: 10px; background: rgba(0,0,0,0.7); color: white; border: none; border-radius: 5px; cursor: pointer;">Tap to Start</button>
            </div>
        `;
    } else {
        return `
            <div style="padding: 20px; background: rgba(0,0,0,0.7); border-radius: 10px;">
                <h1 style="margin: 0 0 20px 0;">Welcome to Cafe Fomento </h1>
                <p style="margin: 0 0 10px 0;">Click to start</p>
                <p style="margin: 0;">
                    Move: WASD / Arrow Keys<br>
                    Look: Mouse<br>
                    Sprint: Hold Shift<br>
                    Video Play/Pause: X (when near)<br>
                    Exit: ESC
                </p>
                <p id="error-message" style="color: #ff4444; margin-top: 10px; display: none;">
                    Unable to start first-person view. Please ensure:<br>
                    - You're using a supported browser<br>
                    - The page is served from a web server<br>
                    - You've allowed pointer lock in your browser
                </p>
                <button id="startButton" style="margin-top: 20px; padding: 10px; background: rgba(0,0,0,0.7); color: white; border: none; border-radius: 5px; cursor: pointer;">Click to Start</button>
            </div>
        `;
    }
}

instructions.innerHTML = getInstructionsContent();
document.body.appendChild(instructions);

// Create status indicator separately
const statusIndicator = document.createElement('div');
statusIndicator.id = 'statusIndicator';
statusIndicator.style.position = 'fixed';
statusIndicator.style.bottom = '600px';
statusIndicator.style.left = '50%';
statusIndicator.style.transform = 'translateX(-50%)';
statusIndicator.style.width = '15px';
statusIndicator.style.height = '15px';
statusIndicator.style.backgroundColor = '#4CAF50';
statusIndicator.style.borderRadius = '50%';
statusIndicator.style.display = 'none';
statusIndicator.style.zIndex = '1000';
statusIndicator.style.opacity = '0.6';
document.body.appendChild(statusIndicator);

// Error message element
const errorMessage = document.getElementById('error-message');

// Get the start button element
const startButton = document.getElementById('startButton');

// VR session event listeners
renderer.xr.addEventListener('sessionstart', () => {
    console.log('VR session started');
    instructions.style.display = 'none';
    // Start checking gamepad state
    setInterval(checkGamepad, 50);
});

renderer.xr.addEventListener('sessionend', () => {
    console.log('VR session ended');
    if (!controls.isLocked) {
        instructions.style.display = 'flex';
    }
});

// Start button click handler
startButton.addEventListener('click', () => {
    if (renderer.xr.isPresenting) {
        instructions.style.display = 'none';
    } else if (isMobileDevice()) {
        // Mobile-specific start function
        startMobileExperience();
    } else {
        controls.lock();
        instructions.style.display = 'none';
    }
});

// Mobile-specific start function
function startMobileExperience() {
    instructions.style.display = 'none';
    // For mobile, we don't use pointer lock, just hide instructions
    // Touch controls will handle movement and interaction
    console.log('Mobile experience started');
}

// Add speed control UI
const speedControls = document.createElement('div');
speedControls.style.position = 'absolute';
speedControls.style.bottom = '20px';
speedControls.style.left = '50%';
speedControls.style.transform = 'translateX(-50%)';
speedControls.style.background = 'rgba(0,0,0,0.7)';
speedControls.style.padding = '10px';
speedControls.style.borderRadius = '5px';
speedControls.style.color = '#ffffff';
speedControls.style.textAlign = 'center';
speedControls.style.zIndex = '2'; // Lower z-index for speed controls
speedControls.innerHTML = `
    <div>
        <label for="speedSlider">Walking Speed: <span id="speedValue">2.0</span></label><br>
        <input type="range" id="speedSlider" min="0.5" max="4" step="0.25" value="2.0" style="width: 200px"><br>
        <small style="color: #aaa">Hold Shift to Sprint (1.5x speed)</small>
    </div>
`;
document.body.appendChild(speedControls);

// Speed slider functionality
const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById('speedValue');
speedSlider.addEventListener('input', (e) => {
    baseSpeed = parseFloat(e.target.value);
    speedValue.textContent = baseSpeed.toFixed(1);
});

// Keyboard controls
const onKeyDown = function(event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = true;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = true;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = true;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = true;
            break;
        case 'ShiftLeft':
        case 'ShiftRight':
            isSprinting = true;
            break;
        case 'KeyX':
            if (isNearVideoFrame()) {
                toggleVideo();
            }
            break;
    }
};

const onKeyUp = function(event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = false;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = false;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = false;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = false;
            break;
        case 'ShiftLeft':
        case 'ShiftRight':
            isSprinting = false;
            break;
    }
};

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);

// Add lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); // Brighter ambient light
scene.add(ambientLight);

// Main directional light
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(20, 30, 20);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

// Add additional lights for better visibility
const frontLight = new THREE.DirectionalLight(0xffffff, 0.5);
frontLight.position.set(0, 10, 30);
scene.add(frontLight);

const backLight = new THREE.DirectionalLight(0xffffff, 0.5);
backLight.position.set(0, 10, -30);
scene.add(backLight);

// Create floor with brighter color
const floorGeometry = new THREE.PlaneGeometry(MUSEUM.width, MUSEUM.depth);
const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0xaaaaaa, // Lighter gray
    roughness: 0.3,
    metalness: 0.2
});
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
// scene.add(floor);

// Enhanced ceiling with beams
function createCeilingBeam(width, height, depth, position) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshStandardMaterial({
        color: 0xd3d3d3,
        roughness: 0.5,
        metalness: 0.2
    });
    const beam = new THREE.Mesh(geometry, material);
    beam.position.copy(position);
    beam.castShadow = true;
    beam.receiveShadow = true;
    return beam;
}

// Create main ceiling
const ceilingGeometry = new THREE.PlaneGeometry(MUSEUM.width, MUSEUM.depth);
const ceilingMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.8,
    metalness: 0.2,
    side: THREE.DoubleSide
});
const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
ceiling.rotation.x = Math.PI / 2;
ceiling.position.y = MUSEUM.height;
ceiling.receiveShadow = true;
// scene.add(ceiling);

// Add ceiling beams
const beamSpacing = 5;
for (let x = -MUSEUM.width/2 + beamSpacing; x < MUSEUM.width/2; x += beamSpacing) {
    const beam = createCeilingBeam(
        0.3, // width
        0.4, // height
        MUSEUM.depth, // depth
        new THREE.Vector3(x, MUSEUM.height - 0.2, 0)
    );
    // scene.add(beam);
}

// Add cross beams
for (let z = -MUSEUM.depth/2 + beamSpacing; z < MUSEUM.depth/2; z += beamSpacing) {
    const crossBeam = createCeilingBeam(
        MUSEUM.width, // width
        0.4, // height
        0.3, // depth
        new THREE.Vector3(0, MUSEUM.height - 0.2, z)
    );
    // scene.add(crossBeam);
}



// Create walls
function createWall(width, height, depth, position, rotation = { x: 0, y: 0, z: 0 }) {
    // Create geometry with rounded edges
    const geometry = new RoundedBoxGeometry(
        width, 
        height, 
        depth,
        5, // segments
       .1// radius of rounded edges
    );
    
    const material = new THREE.MeshStandardMaterial({
        color: 0xf0f0f0,
        roughness: 0.45,
        metalness: 0.6
    });
    
    const wall = new THREE.Mesh(geometry, material);
    wall.position.copy(position);
    wall.rotation.x = rotation.x;
    wall.rotation.y = rotation.y;
    wall.rotation.z = rotation.z;
    wall.castShadow = true;
    wall.receiveShadow = true;
    return wall;
}

function createBox(width, height, depth, position, rotation = { x: 0, y: 0, z: 0 }) {
    // Create geometry with rounded edges
    const geometry = new RoundedBoxGeometry(
        width, 
        height, 
        depth,
        5, // segments
       1// radius of rounded edges
    );
    
    const material = new THREE.MeshStandardMaterial({
        color: 0xf0f0f0,
        roughness: 0.45,
        metalness: 0.6
    }) ;
    const box1 = new THREE.Mesh(geometry, material);
    box1.position.copy(position);
    box1.rotation.x = rotation.x;
    box1.rotation.y = rotation.y;
    box1.rotation.z = rotation.z;
    box1.castShadow = true;
    box1.receiveShadow = true;
    return box1;
     };

const bigBox =createBox (
   45,
    45,
   45,
    new THREE.Vector3(0, 20, 0)
)
// 
// scene.add(bigBox)

// Back wall
const backWall = createWall(
   MUSEUM.width,
   MUSEUM.height,
   MUSEUM.wallThickness,
    new THREE.Vector3(-MUSEUM.width / 3, MUSEUM.height / 2, MUSEUM.depth / 2)
);
// scene.add(backWall);

// Front wall with entrance
const frontWallLeft = createWall(
    MUSEUM.width / 3,
    MUSEUM.height,
    MUSEUM.wallThickness,
    new THREE.Vector3(-MUSEUM.width / 3, MUSEUM.height / 2, MUSEUM.depth / 2)
);
// scene.add(frontWallLeft);

const frontWallRight = createWall(
    MUSEUM.width / 3,
    MUSEUM.height,
    MUSEUM.wallThickness,
    new THREE.Vector3(MUSEUM.width / 3, MUSEUM.height / 2, MUSEUM.depth / 2)
);
// scene.add(frontWallRight);

const frontWallTop = createWall(
    MUSEUM.width,
    MUSEUM.height,
    MUSEUM.wallThickness,
    new THREE.Vector3(0,MUSEUM.height/2  , MUSEUM.depth / 2)
);
// scene.add(frontWallTop);

// Side walls
const leftWall = createWall(
    MUSEUM.depth,
    MUSEUM.height,
    MUSEUM.wallThickness,
    new THREE.Vector3(-MUSEUM.width / 2, MUSEUM.height /2, 0),
    { x: 0, y: Math.PI / 2, z: 0 }
);
// scene.add(leftWall);

const rightWall = createWall(
    MUSEUM.depth,
    MUSEUM.height,
    MUSEUM.wallThickness,
    new THREE.Vector3(MUSEUM.width / 2, MUSEUM.height / 2, 0),
    { x: 0, y: Math.PI / 2, z: 0 }
);
// scene.add(rightWall);

// Create short interior walls
const INTERIOR_WALL_HEIGHT = MUSEUM.height * 0.7; // 70% of ceiling height
const INTERIOR_WALL_LENGTH = MUSEUM.depth / 2;

// Create first short wall (left side, parallel to entrance)

// const shortWall1 = createWall(
//     INTERIOR_WALL_LENGTH*.7,
//     INTERIOR_WALL_HEIGHT,
//     MUSEUM.wallThickness,
//     new THREE.Vector3(-MUSEUM.width / 4, INTERIOR_WALL_HEIGHT / 2, -MUSEUM.depth / 4+8),
//     { x: 0, y: 0, z: 0 }
// );
// scene.add(shortWall1);

// Create second short wall (right side, parallel to entrance)
const shortWall2 = createWall(
    INTERIOR_WALL_LENGTH*.7,
    INTERIOR_WALL_HEIGHT/3,
    MUSEUM.wallThickness,
    new THREE.Vector3(MUSEUM.width / 8-1, INTERIOR_WALL_HEIGHT / 3-1, -MUSEUM.depth / 4 ),
    { x: 0, y: 0, z: 0 }
);
// scene.add(shortWall2);

// Create third short wall (left side, perpendicular to entrance)
const shortWall3 = createWall(
    INTERIOR_WALL_LENGTH/2,
    INTERIOR_WALL_HEIGHT,
    MUSEUM.wallThickness,
    new THREE.Vector3(-MUSEUM.width / 4, INTERIOR_WALL_HEIGHT / 2, -MUSEUM.depth / 4+3),
    { x: 0, y: Math.PI / 2, z: 0 }
);
// scene.add(shortWall3);

// Create fourth short wall (right side, perpendicular to entrance)
const shortWall4 = createWall(
    INTERIOR_WALL_LENGTH/4,
    INTERIOR_WALL_HEIGHT/3,
    MUSEUM.wallThickness,
    new THREE.Vector3(MUSEUM.width / 4-2, INTERIOR_WALL_HEIGHT / 3-1, -MUSEUM.depth / 4-2.5),
    { x: 0, y: Math.PI / 2, z: 0 }
);
// scene.add(shortWall4);

const table = createWall(
    INTERIOR_WALL_LENGTH/3*.7,
    INTERIOR_WALL_HEIGHT/2*.7,
    MUSEUM.wallThickness*.7,
    new THREE.Vector3(MUSEUM.width / 4-6, INTERIOR_WALL_HEIGHT / 3-.9, MUSEUM.depth/4-5 ),
    { x: 0, y: Math.PI / 2, z: 0 }
);
table.rotation.x = Math.PI/2
table.rotation.y = Math.PI
// scene.add(table);

const holoBox = createWall(
    2,
    4.2,
    6.2,
    new THREE.Vector3(MUSEUM.width / 4+3.6,
        INTERIOR_WALL_HEIGHT / 2-.5,
        -MUSEUM.depth /2 +5  + MUSEUM.depth/4-2 ),
    { x: 0, y: 0 , z: 0 }
);
holoBox.rotation.x = Math.PI/2
holoBox.rotation.y = Math.PI
holoBox.rotation.z = Math.PI/2
// scene.add(holoBox); 

const holoBox_Wall = createWall(
    2,
    16,
    12,
    new THREE.Vector3(MUSEUM.width / 4+6.5,
        INTERIOR_WALL_HEIGHT / 2-.5,
        -MUSEUM.depth /2 +5  + MUSEUM.depth/4+6 ),
    { x: 0, y: Math.PI / 2, z: 0 }
);
holoBox_Wall.rotation.x = Math.PI/2
holoBox_Wall.rotation.y = Math.PI
// scene.add(holoBox_Wall);


const table_leg = createWall(
    INTERIOR_WALL_LENGTH/8,
    INTERIOR_WALL_HEIGHT/6,
    MUSEUM.wallThickness*4,
    new THREE.Vector3(MUSEUM.width / 4-6, INTERIOR_WALL_HEIGHT / 3-2, MUSEUM.depth/4-5 ),
    { x: 0, y: Math.PI / 2, z: 0 }
);
table_leg.rotation.x = Math.PI/2
table_leg.rotation.y = Math.PI
// scene.add(table_leg);

const coffeeinfo = createWall(
    INTERIOR_WALL_LENGTH/18,
    INTERIOR_WALL_HEIGHT/10,
    MUSEUM.wallThickness*2,
    new THREE.Vector3(MUSEUM.width / 4-3, INTERIOR_WALL_HEIGHT / 3-2, MUSEUM.depth/4-20 ),
    { x: 0, y: Math.PI / 2, z: 0 }
);
coffeeinfo.rotation.x = Math.PI
coffeeinfo.rotation.y = Math.PI/2
// scene.add(coffeeinfo);

// Create video frame
const frameWidth = 4;
const frameHeight = 6;
const frameDepth = 0.2;

// Create video elements
const video = document.createElement('video');
video.style.display = 'none';
video.crossOrigin = 'anonymous';
video.loop = true;
video.muted = true;
document.body.appendChild(video);

const video2 = document.createElement('video');
video2.style.display = 'none';
video2.crossOrigin = 'anonymous';
video2.loop = true;
video2.muted = true;
document.body.appendChild(video2);

video2.src = './videos/fomento-menu.mp4';

video2.addEventListener('loadeddata', () => {
    console.log("Video 2 is loaded and ready to play.");
    video2.play().catch((error) => {
        console.error("Error attempting to play the video:", error);
    });
});


const video3 = document.createElement('video');
video3.style.display = 'block'; // Make it visible for testing
video3.crossOrigin = 'anonymous';
video3.loop = true;
video3.muted = true;
document.body.appendChild(video3);

// set video 
video3.src = './videos/fomento-holobox.mp4';

video3.addEventListener('loadeddata', () => {
    console.log("Video 3 is loaded and ready to play.");
    video3.play().catch((error) => {
        console.error("Error attempting to play the video:", error);
    });
});


const video4 = document.createElement('video');
video4.style.display = 'block'; // Make it visible for testing
video4.crossOrigin = 'anonymous';
video4.loop = true;
video4.muted = true;
document.body.appendChild(video4);

video4.src = './videos/fomento-menu.mp4';


video4.addEventListener('loadeddata', () => {
    console.log("Video 4 is loaded and ready to play.");
    video4.play().catch((error) => {
        console.error("Error attempting to play the video:", error);
    });
});

const video5 = document.createElement('video');
video5.style.display = 'block'; // Make it visible for testing
video5.crossOrigin = 'anonymous';
video5.loop = true;
video5.muted = true;
document.body.appendChild(video5);

video5.src = './videos/fomento-expo.mp4';


video5.addEventListener('loadeddata', () => {
    console.log("Video 5 is loaded and ready to play.");
    video5.play().catch((error) => {
        console.error("Error attempting to play the video:", error);
    });
});

// Add new video element for screen_w1
const video_w1 = document.createElement('video');
video_w1.style.display = 'block';
video_w1.crossOrigin = 'anonymous';
video_w1.loop = true;
video_w1.muted = true;
document.body.appendChild(video_w1);

video_w1.src = './videos/water-running.mp4';

video_w1.addEventListener('loadeddata', () => {
    console.log("Video w1 is loaded and ready to play.");
    video_w1.play().catch((error) => {
        console.error("Error attempting to play the video:", error);
    });
});

// Add new video element for screen_w2
const video_w2 = document.createElement('video');
video_w2.style.display = 'block';
video_w2.crossOrigin = 'anonymous';
video_w2.loop = true;
video_w2.muted = true;
document.body.appendChild(video_w2);

video_w2.src = './videos/water-running.mp4';

video_w2.addEventListener('loadeddata', () => {
    console.log("Video w2 is loaded and ready to play.");
    video_w2.play().catch((error) => {
        console.error("Error attempting to play the video:", error);
    });
});

// Create video textures
const videoTexture = new THREE.VideoTexture(video);
videoTexture.minFilter = THREE.LinearFilter;
videoTexture.magFilter = THREE.LinearFilter;

const videoTexture2 = new THREE.VideoTexture(video2);
videoTexture2.minFilter = THREE.LinearFilter;
videoTexture2.magFilter = THREE.LinearFilter;

const videoTexture3 = new THREE.VideoTexture(video3);
videoTexture3.minFilter = THREE.LinearFilter;
videoTexture3.magFilter = THREE.LinearFilter;

const videoTexture4 = new THREE.VideoTexture(video4);
videoTexture4.minFilter = THREE.LinearFilter;
videoTexture4.magFilter = THREE.LinearFilter;

const videoTexture5 = new THREE.VideoTexture(video5);
videoTexture5.minFilter = THREE.LinearFilter;
videoTexture5.magFilter = THREE.LinearFilter;

// Add new video texture for screen_w1
const videoTexture_w1 = new THREE.VideoTexture(video_w1);
videoTexture_w1.minFilter = THREE.LinearFilter;
videoTexture_w1.magFilter = THREE.LinearFilter;

// Add new video texture for screen_w2
const videoTexture_w2 = new THREE.VideoTexture(video_w2);
videoTexture_w2.minFilter = THREE.LinearFilter;
videoTexture_w2.magFilter = THREE.LinearFilter;

// Create frame materials
const frameMaterial = new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.5,
    metalness: 0.5
});

const screenMaterial = new THREE.MeshBasicMaterial({
    map: videoTexture,
    side: THREE.FrontSide
});

const screenMaterial2 = new THREE.MeshBasicMaterial({
    map: videoTexture2,
    side: THREE.FrontSide
});

const screenMaterial3 = new THREE.MeshBasicMaterial({
    map: videoTexture3,
    side: THREE.FrontSide
});

const screenMaterial4 = new THREE.MeshBasicMaterial({
    map: videoTexture4,
    side: THREE.FrontSide
});

const screenMaterial5 = new THREE.MeshBasicMaterial({
    map: videoTexture5,
    side: THREE.FrontSide
});

// Add new screen material for screen_w1
const screenMaterial_w1 = new THREE.MeshBasicMaterial({
    map: videoTexture_w1,
    side: THREE.FrontSide
});

// Add new screen material for screen_w2
const screenMaterial_w2 = new THREE.MeshBasicMaterial({
    map: videoTexture_w2,
    side: THREE.FrontSide
});

// Create frame and screen geometries
const frameGeometry = new THREE.BoxGeometry(frameWidth + 0.2, frameHeight + 0.2, frameDepth);
const screenGeometry = new THREE.PlaneGeometry(frameWidth, frameHeight);
const screenGeometry4 = new THREE.PlaneGeometry(frameWidth, frameHeight);

// Create first video frame (left wall)
const frame = new THREE.Mesh(frameGeometry, frameMaterial);
const screen = new THREE.Mesh(screenGeometry, screenMaterial);
screen.scale.set(.5,.5,.5)

// Create second video frame (right wall)
const frame2 = new THREE.Mesh(frameGeometry.clone(), frameMaterial.clone());
const screen2 = new THREE.Mesh(screenGeometry.clone(), screenMaterial2);
screen2.scale.set(5.5,2.1,.5)


const screen3 = new THREE.Mesh(screenGeometry.clone(), screenMaterial3);
const screen4 = new THREE.Mesh(screenGeometry4.clone(), screenMaterial4);
const screen5 = new THREE.Mesh(screenGeometry.clone(), screenMaterial5);

// Create new screen_w1
const screen_w1 = new THREE.Mesh(screenGeometry.clone(), screenMaterial_w1);

// Create new screen_w2
const screen_w2 = new THREE.Mesh(screenGeometry.clone(), screenMaterial_w2);

// Position first frame and screen (left wall)
frame.position.set(
    -MUSEUM.width / 4-4,
    INTERIOR_WALL_HEIGHT / 2, 
    -MUSEUM.depth /4 + MUSEUM.wallThickness / 2 + frameDepth / 2 + 8
);
screen.position.set(
    -MUSEUM.width / 4-2,
    INTERIOR_WALL_HEIGHT / 2,
    -MUSEUM.depth / 4 + MUSEUM.wallThickness / 2 + frameDepth + MUSEUM.depth/2+8
);
screen.rotation.y = 3.14

// Position second frame and screen (right wall)
frame2.position.set(
    MUSEUM.width / 4,
    INTERIOR_WALL_HEIGHT / 2,
    -MUSEUM.depth /4 + MUSEUM.wallThickness / 2 + frameDepth / 2 + 8
);
screen2.position.set(
    MUSEUM.width / 4-10.2,
    INTERIOR_WALL_HEIGHT / 2+4.3,
    MUSEUM.depth /2+.5
    

);

screen2.rotation.y = Math.PI

screen3.position.set(
    MUSEUM.width / 4-10.2,
    INTERIOR_WALL_HEIGHT / 2+4.3 ,
    -MUSEUM.depth /2-.5
);
screen3.scale.set(5.5,2.1,.5)

// screen3.rotation.z = -Math.PI/2
// screen3.rotation.y = Math.PI/2

screen4.position.set(
    -MUSEUM.width /2-.5,
     INTERIOR_WALL_HEIGHT / 2+4.3,
      0
    
);

screen4.scale.set(5.5,2.1,.5)
// screen4.rotation.z = -Math.PI/2
// screen4.rotation.x = -Math.PI/2
screen4.rotation.y = Math.PI/2

screen5.rotation.y = 3.14 

screen5.position.set(
    -12,
    INTERIOR_WALL_HEIGHT / 2,
    -MUSEUM.depth / 4  + frameDepth + MUSEUM.depth/2+3
);
screen5.scale.set(.5,.5,1)
// Position screen_w1 on the opposite side
screen_w1.position.set(
    -27,
    INTERIOR_WALL_HEIGHT / 2+1.5,
    MUSEUM.depth /4+5.5 
);
screen_w1.scale.set(1.5,1.3,1)
screen_w1.rotation.y = Math.PI/2

// Position screen_w2 beside screen_w1
screen_w2.position.set(
    -27,
    INTERIOR_WALL_HEIGHT / 2+1.5,
    MUSEUM.depth /4-14.5  // Positioned 5 units further along the z-axis
);
screen_w2.scale.set(1.5,1.3,1)
screen_w2.rotation.y = Math.PI/2

// scene.add(frame);
// scene.add(screen);
// scene.add(frame2);
scene.add(screen2);
scene.add(screen3);
scene.add(screen4);
// scene.add(screen5);
// scene.add(screen_w1);
// scene.add(screen_w2);



// Create video controls UI for both frames
const videoControls = document.createElement('div');
videoControls.style.position = 'absolute';
videoControls.style.bottom = '20%';
videoControls.style.left = '50%';
videoControls.style.transform = 'translateX(-50%)';
videoControls.style.background = 'rgba(0,0,0,0.7)';
videoControls.style.padding = '10px';
videoControls.style.borderRadius = '5px';
videoControls.style.color = '#ffffff';
videoControls.style.textAlign = 'center';
videoControls.style.display = 'none';
videoControls.innerHTML = `
    <div style="display: flex; gap: 10px; align-items: center;">
        <button id="playPauseBtn" style="padding: 5px 10px; background: #444; color: white; border: none; border-radius: 3px; cursor: pointer;">Play</button>
        <div id="videoStatus" style="margin-left: 10px;">Paused</div>
    </div>
`;

const videoControls2 = document.createElement('div');
videoControls2.style.position = 'absolute';
videoControls2.style.bottom = '20%';
videoControls2.style.left = '50%';
videoControls2.style.transform = 'translateX(-50%)';
videoControls2.style.background = 'rgba(0,0,0,0.7)';
videoControls2.style.padding = '10px';
videoControls2.style.borderRadius = '5px';
videoControls2.style.color = '#ffffff';
videoControls2.style.textAlign = 'center';
videoControls2.style.display = 'none';
videoControls2.innerHTML = `
    <div style="display: flex; gap: 10px; align-items: center;">
        <button id="playPauseBtn2" style="padding: 5px 10px; background: #444; color: white; border: none; border-radius: 3px; cursor: pointer;">Play</button>
        <div id="videoStatus2" style="margin-left: 10px;">Paused</div>
    </div>
`;

document.body.appendChild(videoControls);
document.body.appendChild(videoControls2);
// document.body.appendChild(videoControls3);


const playPauseBtn = document.getElementById('playPauseBtn');
const videoStatus = document.getElementById('videoStatus');
const playPauseBtn2 = document.getElementById('playPauseBtn2');
const videoStatus2 = document.getElementById('videoStatus2');
// const playPauseBtn3 = document.getElementById('playPauseBtn3');
// const videoStatus3 = document.getElementById('videoStatus3');

// Video control functionality for both frames
playPauseBtn.addEventListener('click', () => {
    if (video.paused) {
        video.play();
        playPauseBtn.textContent = 'Pause';
        videoStatus.textContent = 'Playing';
    } else {
        video.pause();
        playPauseBtn.textContent = 'Play';
        videoStatus.textContent = 'Paused';
    }
});

playPauseBtn2.addEventListener('click', () => {
    if (video2.paused) {
        video2.play();
        playPauseBtn2.textContent = 'Pause';
        videoStatus2.textContent = 'Playing';
    } else {
        video2.pause();
        playPauseBtn2.textContent = 'Play';
        videoStatus2.textContent = 'Paused';
    }
});

// playPauseBtn3.addEventListener('click', () => {
//     if (video3.paused) {
//         video3.play();
//         playPauseBtn3.textContent = 'Pause';
//         videoStatus3.textContent = 'Playing';
//     } else {
//         video3.pause();
//         playPauseBtn3.textContent = 'Play';
//         videoStatus3.textContent = 'Paused';
//     }
// });

// Function to check if camera is near either video frame
function isNearVideoFrame() {
    const distanceToFrame1 = camera.position.distanceTo(frame.position);
    const distanceToFrame2 = camera.position.distanceTo(frame2.position);
    const viewingDistance = 5;
    return {
        frame1: distanceToFrame1 < viewingDistance,
        frame2: distanceToFrame2 < viewingDistance
    };
}

// Add file inputs for both video selections
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = 'video/*';
fileInput.style.position = 'absolute';
fileInput.style.bottom = '60px';
fileInput.style.left = '25%';
fileInput.style.transform = 'translateX(-50%)';
fileInput.style.zIndex = '1000';
fileInput.style.backgroundColor = 'rgba(0,0,0,0.7)';
fileInput.style.color = 'white';
fileInput.style.padding = '10px';
fileInput.style.borderRadius = '5px';

const fileInput2 = document.createElement('input');
fileInput2.type = 'file';
fileInput2.accept = 'video/*';
fileInput2.style.position = 'absolute';
fileInput2.style.bottom = '60px';
fileInput2.style.left = '75%';
fileInput2.style.transform = 'translateX(-50%)';
fileInput2.style.zIndex = '1000';
fileInput2.style.backgroundColor = 'rgba(0,0,0,0.7)';
fileInput2.style.color = 'white';
fileInput2.style.padding = '10px';
fileInput2.style.borderRadius = '5px';

document.body.appendChild(fileInput);
document.body.appendChild(fileInput2);



// Handle file selection for both frames
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const fileURL = URL.createObjectURL(file);
        video.src = fileURL;
        video.load();
        video.play().catch(e => {
            console.log("Video autoplay failed:", e);
            playPauseBtn.textContent = 'Play';
            videoStatus.textContent = 'Paused';
        });
        playPauseBtn.textContent = 'Pause';
        videoStatus.textContent = 'Playing';
    }
});

fileInput2.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const fileURL = URL.createObjectURL(file);
        video2.src = fileURL;
        video2.load();
        video2.play().catch(e => {
            console.log("Video autoplay failed:", e);
            playPauseBtn2.textContent = 'Play';
            videoStatus2.textContent = 'Paused';
        });
        playPauseBtn2.textContent = 'Pause';
        videoStatus2.textContent = 'Playing';
    }
});

// Hide file inputs when in pointer lock mode
controls.addEventListener('lock', () => {
    fileInput.style.display = 'none';
    fileInput2.style.display = 'none';
    videoControls.style.display = 'none';
    videoControls2.style.display = 'none';
});

controls.addEventListener('unlock', () => {
    fileInput.style.display = 'block';
    fileInput2.style.display = 'block';
    videoControls.style.display = 'none';
    videoControls2.style.display = 'none';
    
});


// Add general room spotlights
function createSpotlight(position, targetPosition) {
    const spotlight = new THREE.SpotLight(0xffffff, 1);
    spotlight.position.copy(position);
    spotlight.angle = Math.PI / 4;
    spotlight.penumbra = 0.5;
    spotlight.decay = 2;
    spotlight.distance = 25;
    spotlight.castShadow = true;
    spotlight.shadow.mapSize.width = 1024;
    spotlight.shadow.mapSize.height = 1024;

    const targetObject = new THREE.Object3D();
    targetObject.position.copy(targetPosition);
    scene.add(targetObject);
    spotlight.target = targetObject;

    return spotlight;
}

// Add room spotlights in a grid pattern
const spotlightSpacing = 15;
for (let x = -MUSEUM.width/3; x <= MUSEUM.width/3; x += spotlightSpacing) {
    for (let z = -MUSEUM.depth/3; z <= MUSEUM.depth/3; z += spotlightSpacing) {
        const spotlight = createSpotlight(
            new THREE.Vector3(x, MUSEUM.height - 0.5, z),
            new THREE.Vector3(x, 0, z)
        );
        scene.add(spotlight);
    }
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate() {
    renderer.setAnimationLoop(render); // Use setAnimationLoop for VR
}

// Add after renderer setup
const controllerModelFactory = new XRControllerModelFactory();

// Create controllers
const controller1 = renderer.xr.getController(0); // Left controller
const controller2 = renderer.xr.getController(1); // Right controller

// Add controller models
const controllerGrip1 = renderer.xr.getControllerGrip(0);
const controllerGrip2 = renderer.xr.getControllerGrip(1);

// Add controller models to the scene
controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1));
controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2));

// Attach controllers to player rig instead of scene
playerRig.add(controllerGrip1);
playerRig.add(controllerGrip2);
playerRig.add(controller1);
playerRig.add(controller2);

// Add controller rays for pointing
const controllerRay1 = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -1)
    ]),
    new THREE.LineBasicMaterial({ color: 0xffffff })
);
controllerRay1.scale.z = 5;
controller1.add(controllerRay1);

const controllerRay2 = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -1)
    ]),
    new THREE.LineBasicMaterial({ color: 0xffffff })
);
controllerRay2.scale.z = 5;
controller2.add(controllerRay2);

// Add controller event listeners
controller1.addEventListener('squeezestart', () => {
    isMoving = true;
});

controller1.addEventListener('squeezeend', () => {
    isMoving = false;
});

controller2.addEventListener('squeezestart', () => {
    isMoving = true;
});

controller2.addEventListener('squeezeend', () => {
    isMoving = false;
});

// Function to check gamepad state
function checkGamepad() {
    if (renderer.xr.isPresenting) {
        const gamepads = navigator.getGamepads();
        for (const gamepad of gamepads) {
            if (gamepad) {
                // Check if the trigger button is pressed (button 0)
                isMoving = gamepad.buttons[0].pressed;
                console.log('Trigger button pressed:', isMoving);
            }
        }
    }
}

// Function to check controller input
function checkController() {
    if (renderer.xr.isPresenting) {
        const gamepads = navigator.getGamepads();
        for (const gamepad of gamepads) {
            if (gamepad) {
                // Using trigger button (button 0)
                isMoving = gamepad.buttons[0].pressed;
            }
        }
    }
}

// Update the render function
function render() {
    if (renderer.xr.isPresenting) {
        if (isMoving) {
            // Get the forward direction from the camera
            const forward = new THREE.Vector3(0, 0, -1);
            forward.applyQuaternion(camera.quaternion);
            forward.y = 0; // Keep movement on the horizontal plane
            forward.normalize();
            
            // Move forward
            playerRig.position.add(forward.multiplyScalar(moveSpeed));
        }
    } else {
        // Handle both desktop (with pointer lock) and mobile (without pointer lock) movement
        const shouldHandleMovement = controls.isLocked || (isMobileDevice() && instructions.style.display === 'none');
        
        if (shouldHandleMovement) {
            // Calculate movement
            direction.z = Number(moveForward) - Number(moveBackward);
            direction.x = Number(moveRight) - Number(moveLeft);
            direction.normalize();

            // Apply movement with sprint multiplier
            const currentSpeed = isSprinting ? baseSpeed * sprintMultiplier : baseSpeed;
            
            if (moveForward || moveBackward) velocity.z = direction.z * currentSpeed;
            if (moveLeft || moveRight) velocity.x = direction.x * currentSpeed;

            // Store current position before movement
            const previousPosition = playerRig.position.clone();

            // Update position - handle differently for mobile vs desktop
            if (controls.isLocked) {
                // Desktop: use pointer lock controls
                controls.moveRight(velocity.x * 0.1);
                controls.moveForward(velocity.z * 0.1);
            } else if (isMobileDevice()) {
                // Mobile: directly update player rig position
                const forward = new THREE.Vector3(0, 0, -1);
                const right = new THREE.Vector3(1, 0, 0);
                
                forward.applyQuaternion(camera.quaternion);
                right.applyQuaternion(camera.quaternion);
                
                forward.y = 0;
                right.y = 0;
                forward.normalize();
                right.normalize();
                
                playerRig.position.add(forward.multiplyScalar(velocity.z * 0.1));
                playerRig.position.add(right.multiplyScalar(velocity.x * 0.1));
            }

            // Collision detection parameters
            const playerRadius = 0.3;
            const wallPadding = playerRadius + MUSEUM.wallThickness / 2;

            // Main walls collision
            let collision = false;

            // Outer walls collision
            if (playerRig.position.x < -MUSEUM.width/2 + wallPadding || 
                playerRig.position.x > MUSEUM.width/2 - wallPadding || 
                playerRig.position.z < -MUSEUM.depth/2 + wallPadding || 
                playerRig.position.z > MUSEUM.depth/2 - wallPadding) {
                collision = true;
            }

            // Front entrance walls collision
            if (playerRig.position.z > MUSEUM.depth/2 - wallPadding) {
                // Left entrance wall
                if (playerRig.position.x < -MUSEUM.width/6) {
                    collision = true;
                }
                // Right entrance wall
                if (playerRig.position.x > MUSEUM.width/6) {
                    collision = true;
                }
            }

            // If collision detected, restore previous position
            if (collision) {
                playerRig.position.copy(previousPosition);
            }

            // Apply friction
            velocity.x *= 0.8;
            velocity.z *= 0.8;

            // Check proximity to video frame and update controls visibility
            if (isNearVideoFrame()) {
                videoControls.style.display = 'block';
            } else {
                videoControls.style.display = 'none';
            }
        }
    }

    // Animate the guide sign
    guideSign.position.set(25, 1.7, 3.5); // Set initial position
    guideSign.rotation.set(1.6, 0, 1.6);
    animateGuide();
    
    
    renderer.render(scene, camera);

   
}
animate();

// Create texture loader
const textureLoader = new THREE.TextureLoader();

// Function to load texture and handle errors
function loadTexture(path) {
    return new Promise((resolve, reject) => {
        textureLoader.load(
            path,
            (texture) => {
                texture.encoding = THREE.sRGBEncoding;
                resolve(texture);
            },
            undefined,
            (error) => {
                console.error(`Error loading texture ${path}:`, error);
                // Return a colored material as fallback
                resolve(new THREE.MeshStandardMaterial({
                    color: Math.random() * 0xffffff,
                    roughness: 0.5,
                    metalness: 0.2
                }));
            }
        );
    });
}

// Create picture frame function with texture support
function createPictureFrame(width, height, position, rotation, texturePath) {
    const frameDepth = 0.1;
    const framePadding = 0.1;

    // Create frame
    const frameGeometry = new THREE.BoxGeometry(width + framePadding*2, height + framePadding*2, frameDepth);
    const frameMaterial = new THREE.MeshStandardMaterial({
        color: 0x222222,
        roughness: 0.5,
        metalness: 0.5
    });
    const frame = new THREE.Mesh(frameGeometry, frameMaterial);

    // Create picture
    const pictureGeometry = new THREE.PlaneGeometry(width, height);
    let pictureMaterial;

    // Load texture if path provided, otherwise use random color
    if (texturePath) {
        pictureMaterial = new THREE.MeshStandardMaterial({
            roughness: 0.5,
            metalness: 0.2
        });
        
        loadTexture(texturePath).then(texture => {
            pictureMaterial.map = texture;
            pictureMaterial.needsUpdate = true;
        });
    } else {
        pictureMaterial = new THREE.MeshStandardMaterial({
            color: Math.random() * 0xffffff,
            roughness: 0.5,
            metalness: 0.2
        });
    }

    const picture = new THREE.Mesh(pictureGeometry, pictureMaterial);

    // Position frame and picture
    frame.position.copy(position);
    frame.rotation.copy(rotation);
    picture.position.copy(position);
    picture.rotation.copy(rotation);
    
    // Offset picture slightly from frame
    const offset = new THREE.Vector3(0, 0, frameDepth/2 + 0.01);
    offset.applyEuler(rotation);
    picture.position.add(offset);

    return { frame, picture };
}

// Add picture frames to walls with texture paths
const FRAME_WIDTH = 3 * 1.3;
const FRAME_HEIGHT = 2 * 1.3;
const FRAME_WALL_HEIGHT = INTERIOR_WALL_HEIGHT / 2;

// Left wall frames
const leftFrame1 = createPictureFrame(
    FRAME_WIDTH,
    FRAME_HEIGHT,
    new THREE.Vector3(-MUSEUM.width/2 + MUSEUM.wallThickness/2 + 0.1, FRAME_WALL_HEIGHT, -MUSEUM.depth/4),
    new THREE.Euler(0, Math.PI/2, 0),
    'textures/frame1.png'
);
// scene.add(leftFrame1.frame);
// scene.add(leftFrame1.picture);

const leftFrame2 = createPictureFrame(
    FRAME_WIDTH,
    FRAME_HEIGHT,
    new THREE.Vector3(-MUSEUM.width/2 + MUSEUM.wallThickness/2 + 0.1, FRAME_WALL_HEIGHT, MUSEUM.depth/4),
    new THREE.Euler(0, Math.PI/2, 0),
    'textures/frame2.png'
);
    // scene.add(leftFrame2.frame);
    // scene.add(leftFrame2.picture);

// Right wall frames
const rightFrame1 = createPictureFrame(
    FRAME_WIDTH,
    FRAME_HEIGHT,
    new THREE.Vector3(MUSEUM.width/2 - MUSEUM.wallThickness/2 - 0.1, FRAME_WALL_HEIGHT, -MUSEUM.depth/4),
    new THREE.Euler(0, -Math.PI/2, 0),
    'textures/frame3.png'
);
// scene.add(rightFrame1.frame);
// scene.add(rightFrame1.picture);

const rightFrame2 = createPictureFrame(
    FRAME_WIDTH,
    FRAME_HEIGHT,
    new THREE.Vector3(MUSEUM.width/2 - MUSEUM.wallThickness/2 - 0.1, FRAME_WALL_HEIGHT, MUSEUM.depth/4),
    new THREE.Euler(0, -Math.PI/2, 0),
    'textures/frame4.png'
);
// scene.add(rightFrame2.frame);
// scene.add(rightFrame2.picture);

// Back wall frames
const backFrame1 = createPictureFrame(
    FRAME_WIDTH,
    FRAME_HEIGHT,
    new THREE.Vector3(-MUSEUM.width/4, FRAME_WALL_HEIGHT, -MUSEUM.depth/2 + MUSEUM.wallThickness/2 + 0.1),
    new THREE.Euler(0, 0, 0),
    'textures/frame5.png'
);
// scene.add(backFrame1.frame);
// scene.add(backFrame1.picture);

const facedetection = createPictureFrame(
    frameWidth/2,
    frameHeight/2,
    new THREE.Vector3(-MUSEUM.width / 4-2,
        INTERIOR_WALL_HEIGHT / 2,
        -MUSEUM.depth / 4 + MUSEUM.wallThickness / 2 + frameDepth + MUSEUM.depth/2+8.05),
    new THREE.Euler(0, 3.14, 0),
    'textures/frame6.png'
);
// scene.add(facedetection.picture);// scene.add(backFrame2.picture);

// Add spotlights for each picture frame
function createFrameSpotlight(position, targetPosition) {
    const spotlight = new THREE.SpotLight(0xffffff, 1.5);
    spotlight.position.copy(position);
    spotlight.angle = Math.PI/6;
    spotlight.penumbra = 0.5;
    spotlight.decay = 2;
    spotlight.distance = 10;
    spotlight.castShadow = true;

    const targetObject = new THREE.Object3D();
    targetObject.position.copy(targetPosition);
    scene.add(targetObject);
    spotlight.target = targetObject;

    return spotlight;
}

// Add spotlights for each frame
// [leftFrame1, leftFrame2, rightFrame1, rightFrame2, backFrame1,].forEach(frame => {
//     const spotlightPosition = frame.frame.position.clone();
//     spotlightPosition.y = MUSEUM.height - 3;
    
//     const spotlight = createFrameSpotlight(
//         spotlightPosition,
//         frame.frame.position
//     );
//     scene.add(spotlight);
// });

// Create VR display plane
const displayPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 2.25), // 16:9 aspect ratio
    new THREE.MeshBasicMaterial({ color: 0xffffff })
);
displayPlane.visible = false;
// scene.add(displayPlane);

// Create VR display texture
const displayTexture = new THREE.CanvasTexture(document.createElement('canvas'));
displayTexture.minFilter = THREE.LinearFilter;
displayTexture.magFilter = THREE.LinearFilter;
displayPlane.material.map = displayTexture;

// Create iframe for content
const iframe = document.createElement('iframe');
iframe.id = 'content-iframe';  // Add an ID to the iframe
iframe.style.width = '1280px';
iframe.style.height = '720px';
iframe.style.border = 'none';
iframe.style.position = 'absolute';
iframe.style.top = '0';
iframe.style.left = '0';
iframe.style.opacity = '0';
iframe.style.transition = 'opacity 1s ease';
iframe.style.display = 'block';  // Changed from 'none' to 'block'

document.body.appendChild(iframe);

function fadeInIframe() {
    const iframe = document.getElementById('content-iframe');
    iframe.style.display = 'block';
    // Force a reflow to ensure the transition works
    iframe.offsetHeight;
    iframe.style.opacity = '1';
    setTimeout(() => {
        iframe.style.pointerEvents = 'auto';
    }, 1000); // Match transition duration
}

function fadeOutIframe() {
    const iframe = document.getElementById('content-iframe');
    iframe.style.opacity = '0';
    // After fade, disable interaction and hide
    setTimeout(() => {
        iframe.style.pointerEvents = 'none';
        iframe.style.display = 'none';
    }, 1000); // Match transition duration
}

// Function to show VR display
function showVRDisplay(url) {
    iframe.src = url;
    iframe.onload = () => {
        // Create a canvas to capture iframe content
        const canvas = displayTexture.image;
        canvas.width = 1280;
        canvas.height = 720;
        const context = canvas.getContext('2d');
        
        // Update texture periodically
        function updateTexture() {
            if (displayPlane.visible) {
                try {
                    context.drawImage(iframe, 0, 0, canvas.width, canvas.height);
                    displayTexture.needsUpdate = true;
                } catch (e) {
                    console.error('Error updating texture:', e);
                }
                requestAnimationFrame(updateTexture);
            }
        }
        updateTexture();
    };
    
    // Position display in front of the camera
    const cameraPosition = new THREE.Vector3();
    const cameraDirection = new THREE.Vector3();
    camera.getWorldPosition(cameraPosition);
    camera.getWorldDirection(cameraDirection);
    
    // Place display 2 meters in front of the camera
    displayPlane.position.copy(cameraPosition).add(cameraDirection.multiplyScalar(2));
    displayPlane.lookAt(cameraPosition);
    
    // Make display visible
    displayPlane.visible = true;
}

// Function to hide VR display
function hideVRDisplay() {
    displayPlane.visible = false;
    iframe.src = '';
}

// Add close button to VR display
const vrCloseButtonGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
const vrCloseButtonMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const vrCloseButton = new THREE.Mesh(vrCloseButtonGeometry, vrCloseButtonMaterial);
vrCloseButton.position.set(2, 1.2, 0); // Position in top-right corner
displayPlane.add(vrCloseButton);

// Raycaster and mouse vector for non-VR mode
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Add trigger button event listeners for VR mode
controller1.addEventListener('selectstart', () => {
    if (renderer.xr.isPresenting) {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromXRController(controller1);

        // Check for interactive objects
        const intersects = raycaster.intersectObjects([screen,screen4, screen5, coffeeinfo, linkedInModel, telegramModel, vrCloseButton]);

        if (intersects.length > 0) {
            const clickedObject = intersects[0].object;
            
            if (clickedObject === vrCloseButton) {
                hideVRDisplay();
            } else if (clickedObject === screen4 || clickedObject === screen5) {
                console.log("Screen clicked in VR");
                showVRDisplay('storyline/fomento-final/index.html');
                // fadeInIframe();
            } else if (clickedObject === coffeeinfo) {
                console.log("coffee clicked in VR");
                showInfoDialog();
            } else if (clickedObject === linkedInModel) {
                console.log("LinkedIn clicked in VR");
                openLinkedInProfile();
            } else if (clickedObject === telegramModel) {
                console.log("Telegram clicked in VR");
                openTelegramChannel();
            }
        }
    }
});

controller2.addEventListener('selectstart', () => {
    if (renderer.xr.isPresenting) {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromXRController(controller2);

        // Check for interactive objects
        const intersects = raycaster.intersectObjects([screen4, screen5, coffeeinfo, linkedInModel, telegramModel, vrCloseButton]);

        if (intersects.length > 0) {
            const clickedObject = intersects[0].object;
            
            if (clickedObject === vrCloseButton) {
                hideVRDisplay();
            } else if (clickedObject === screen4 || clickedObject === screen5) {
                console.log("Screen clicked in VR");
                showVRDisplay('storyline/fomento-final/index.html');
            } else if (clickedObject === coffeeinfo) {
                console.log("coffee clicked in VR");
                showInfoDialog();
            } else if (clickedObject === linkedInModel) {
                console.log("LinkedIn clicked in VR");
                openLinkedInProfile();
            } else if (clickedObject === telegramModel) {
                console.log("Telegram clicked in VR");
                openTelegramChannel();
            }
        }
    }
});

// Restore non-VR click handlers
window.addEventListener('click', (event) => {
    // Only handle mouse clicks when not in VR mode
    if (renderer.xr.isPresenting) return;
    
    // For mobile devices, allow interaction without pointer lock
    // For desktop, require pointer lock
    if (!isMobileDevice() && !document.pointerLockElement) {
        console.log("Pointer is not locked. Action is limited.");
        return;
    }

    // Calculate mouse position in normalized device coordinates (-1 to +1)
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);

    // Calculate objects intersecting the picking ray
    const intersects = raycaster.intersectObjects([screen,screen4, screen5, coffeeinfo, doorModel, linkedInModel, telegramModel, instagramModel], true);

    console.log('Desktop click intersects:', intersects);
    console.log('doorModel in desktop click:', doorModel);
    console.log('linkedInModel in desktop click:', linkedInModel);
    console.log('telegramModel in desktop click:', telegramModel);
    console.log('instagramModel in desktop click:', instagramModel);

    if (intersects.length > 0) {
        const clickedObject = intersects[0].object;
        console.log('Desktop clicked object:', clickedObject);
        
        // Check if clicked object is the door or any of its children
        let isDoorClicked = false;
        if (doorModel) {
            // Check if it's the door model itself
            if (clickedObject === doorModel) {
                isDoorClicked = true;
            } else {
                // Check if it's a child of the door model
                let parent = clickedObject.parent;
                while (parent) {
                    if (parent === doorModel) {
                        isDoorClicked = true;
                        break;
                    }
                    parent = parent.parent;
                }
            }
        }
        
        // Check if clicked object is the LinkedIn model or any of its children
        let isLinkedInClicked = false;
        if (linkedInModel) {
            // Check if it's the LinkedIn model itself
            if (clickedObject === linkedInModel) {
                isLinkedInClicked = true;
            } else {
                // Check if it's a child of the LinkedIn model
                let parent = clickedObject.parent;
                while (parent) {
                    if (parent === linkedInModel) {
                        isLinkedInClicked = true;
                        break;
                    }
                    parent = parent.parent;
                }
            }
        }
        
        // Check if clicked object is the Telegram model or any of its children
        let isTelegramClicked = false;
        if (telegramModel) {
            // Check if it's the Telegram model itself
            if (clickedObject === telegramModel) {
                isTelegramClicked = true;
            } else {
                // Check if it's a child of the Telegram model
                let parent = clickedObject.parent;
                while (parent) {
                    if (parent === telegramModel) {
                        isTelegramClicked = true;
                        break;
                    }
                    parent = parent.parent;
                }
            }
        }
        
        // Check if clicked object is the Instagram model or any of its children
        let isInstagramClicked = false;
        if (instagramModel) {
            // Check if it's the Instagram model itself
            if (clickedObject === instagramModel) {
                isInstagramClicked = true;
            } else {
                // Check if it's a child of the Instagram model
                let parent = clickedObject.parent;
                while (parent) {
                    if (parent === instagramModel) {
                        isInstagramClicked = true;
                        break;
                    }
                    parent = parent.parent;
                }
            }
        }
        
        console.log('Is door clicked?', isDoorClicked);
        console.log('Is LinkedIn clicked?', isLinkedInClicked);
        console.log('Is Telegram clicked?', isTelegramClicked);
        console.log('Is Instagram clicked?', isInstagramClicked);
        
        if (clickedObject === screen4) {
            console.log("screen4 clicked");
            
            setTimeout(() => {
                iframe.style.display = 'block';
                
             fadeInIframe();
              iframe.style.opacity = '1s ease'
            iframe.style.display = 'block';
            iframe.style.position = 'fixed';
            iframe.style.top = '10%';
            iframe.style.left = '10%';
            iframe.style.width = '80%';
            iframe.style.height = '80%';
            iframe.style.zIndex = '3000';
           
            iframe.style.opacity = '1'
            iframe.src = 'storyline/fomento-menu/index.html';
        }, 1000);
            showcCloseButton();
            if (!isMobileDevice()) {
                controls.unlock();
            }
        } else if (clickedObject === screen5) {
            console.log("screen5 clicked");
            iframe.src = 'storyline/fomento-final/index.html';
            iframe.style.display = 'block';
            iframe.style.position = 'fixed';
            iframe.style.top = '10%';
            iframe.style.left = '10%';
            iframe.style.width = '80%';
            iframe.style.height = '80%';
            iframe.style.zIndex = '1000';
            showcCloseButton();
            if (!isMobileDevice()) {
                controls.unlock();
            }
        } else if (clickedObject === coffeeinfo) {
            console.log("coffee clicked");
            showInfoDialog();
            if (!isMobileDevice()) {
                controls.unlock();
            }
        } else if (clickedObject === screen) {
            console.log("screen clicked");
            iframe.src = 'storyline/fomento-final/index.html';
            iframe.style.display = 'block';
            iframe.style.position = 'fixed';
            iframe.style.top = '10%';
            iframe.style.left = '10%';
            iframe.style.width = '80%';
            iframe.style.height = '80%';
            iframe.style.zIndex = '1000';
            showcCloseButton();
            if (!isMobileDevice()) {
                controls.unlock();
            }
        } else if (isDoorClicked) {
            console.log("door clicked");
            animateDoor();
        } else if (isLinkedInClicked) {
            console.log("LinkedIn clicked");
            openLinkedInProfile();
            if (!isMobileDevice()) {
                controls.unlock();
            }
        } else if (isTelegramClicked) {
            console.log("Telegram clicked");
            openTelegramChannel();
            if (!isMobileDevice()) {
                controls.unlock();
            }
        } else if (isInstagramClicked) {
            console.log("Instagram clicked");
            openInstagramProfile();
            if (!isMobileDevice()) {
                controls.unlock();
            }
        }
    }
});

// Restore close button functionality for non-VR mode
let closeButton;
function showcCloseButton() {
    if (!closeButton) {
        closeButton = document.createElement('button');
        closeButton.textContent = 'X';
        closeButton.style.position = 'absolute';
        closeButton.style.top = '5%';
        closeButton.style.right = '5%';
        closeButton.style.zIndex = '1001';
        closeButton.style.fontSize = '20px';
        closeButton.style.backgroundColor = 'red';
        closeButton.style.color = 'white';
        closeButton.style.border = 'none';
        closeButton.style.cursor = 'pointer';
        closeButton.style.padding = '5px 10px';
        closeButton.style.borderRadius = '5px';
        document.body.appendChild(closeButton);

        closeButton.addEventListener('click', () => {
            fadeOutIframe();
            setTimeout(() => {
                iframe.style.display = 'none';
                closeButton.style.display = 'none';
            }, 1000);
        });
    } else {
        closeButton.style.display = 'block';
    }
}

function showInfoDialog() {
    const dialog = document.createElement('div');
    dialog.style.position = 'fixed';
    dialog.style.top = '50%';
    dialog.style.left = '50%';
    dialog.style.transform = 'translate(-50%, -50%)';
    dialog.style.padding = '20px';
    dialog.style.background = 'rgba(255, 255, 255, 0.95)';
    dialog.style.border = '2px solid #333';
    dialog.style.borderRadius = '10px';
    dialog.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
    dialog.style.zIndex = '1000';
    dialog.style.minWidth = '300px';
    dialog.style.textAlign = 'center';
    dialog.innerHTML = `
        <h2 style="margin-top: 0; color: #333;">Coffee Info</h2>
        <p style="font-size: 16px; line-height: 1.5;">This is a coffee information place. </br>☕  You can present your coffee here</p>
        <button id="closeBtn" style="
            padding: 8px 20px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            margin-top: 10px;
        ">Close</button>
    `;

    document.body.appendChild(dialog);
  
    document.getElementById('closeBtn').onclick = () => {
        dialog.remove();
    };
}

// Restore start button functionality
startButton.addEventListener('click', () => {
    if (renderer.xr.isPresenting) {
        instructions.style.display = 'none';
    } else if (isMobileDevice()) {
        // Mobile-specific start function
        startMobileExperience();
    } else {
        controls.lock();
        instructions.style.display = 'none';
    }
});

// Handle pointer lock state changes
controls.addEventListener('lock', () => {
    if (!renderer.xr.isPresenting) {
        instructions.style.display = 'none';
    }
    speedControls.style.display = 'none';
    if (errorMessage) {
        errorMessage.style.display = 'none';
    }
    // Show the status indicator when locked
    statusIndicator.style.display = 'block';
});

controls.addEventListener('unlock', () => {
    if (!renderer.xr.isPresenting && !isMobileDevice()) {
        instructions.style.display = 'flex';
    }
    speedControls.style.display = 'block';
    // Hide the status indicator when unlocked
    statusIndicator.style.display = 'none';
});

// Create loading manager
const loadingManager = new THREE.LoadingManager();
const loadingScreen = document.createElement('div');
loadingScreen.style.position = 'fixed';
loadingScreen.style.top = '0';
loadingScreen.style.left = '0';
loadingScreen.style.width = '100%';
loadingScreen.style.height = '100%';
loadingScreen.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
loadingScreen.style.display = 'flex';
loadingScreen.style.flexDirection = 'column';
loadingScreen.style.justifyContent = 'center';
loadingScreen.style.alignItems = 'center';
loadingScreen.style.zIndex = '1000';
loadingScreen.style.color = 'white';
loadingScreen.style.fontFamily = 'Arial, sans-serif';

const progressBar = document.createElement('div');
progressBar.style.width = '300px';
progressBar.style.height = '20px';
progressBar.style.backgroundColor = '#333';
progressBar.style.borderRadius = '10px';
progressBar.style.overflow = 'hidden';
progressBar.style.marginTop = '20px';

const progressBarFill = document.createElement('div');
progressBarFill.style.width = '0%';
progressBarFill.style.height = '100%';
progressBarFill.style.backgroundColor = '#4CAF50';
progressBarFill.style.transition = 'width 0.3s ease-in-out';
progressBar.appendChild(progressBarFill);
loadingScreen.appendChild(progressBar);

const loadingText = document.createElement('div');
loadingText.style.marginTop = '10px';
loadingText.textContent = 'Loading model...';
loadingScreen.appendChild(loadingText);

document.body.appendChild(loadingScreen);

loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
    const progress = (itemsLoaded / itemsTotal) * 100;
    progressBarFill.style.width = progress + '%';
    loadingText.textContent = `Loading model... ${Math.round(progress)}%`;
};

loadingManager.onLoad = () => {
    loadingScreen.style.display = 'none';
    console.log('Model loading complete!');
};

loadingManager.onError = (url) => {
    console.error('Error loading model:', url);
    loadingText.textContent = 'Error loading model. Please check console for details.';
    progressBarFill.style.backgroundColor = '#ff0000';
};

// Add scale controls UI
const scaleControls = document.createElement('div');
scaleControls.style.position = 'absolute';
scaleControls.style.top = '20px';
scaleControls.style.right = '20px';
scaleControls.style.background = 'rgba(0,0,0,0.7)';
scaleControls.style.padding = '10px';
scaleControls.style.borderRadius = '5px';
scaleControls.style.color = '#ffffff';
scaleControls.style.zIndex = '1000';
scaleControls.innerHTML = `
    <div>
        <label for="scaleSlider">Model Scale: <span id="scaleValue">1.0</span>x</label><br>
        <input type="range" id="scaleSlider" min="0.1" max="10" step="0.1" value="1.0" style="width: 200px">
    </div>
`;
document.body.appendChild(scaleControls);

// Function to load heavy GLTF model with optimizations
function loadHeavyModel(modelPath, position = new THREE.Vector3(0, 0, 0), initialScale = 1) {
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader(loadingManager);
        
        // Setup DRACO loader for compressed models
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
        dracoLoader.setDecoderConfig({ type: 'js' });
        loader.setDRACOLoader(dracoLoader);

        console.log('Starting to load model from:', modelPath);
        
        let currentModel = null; // Store reference to the current model

        // Load the model
        loader.load(
            modelPath,
            (gltf) => {
                console.log('Model loaded successfully:', gltf);
                const model = gltf.scene;
                currentModel = model; // Store reference to the model
                
                // Enhanced material handling for baked materials
                model.traverse((node) => {
                    if (node.isMesh) {
                        // Ensure mesh is always visible
                        node.visible = true;
                        
                        // Handle materials
                        if (node.material) {
                            // If material is an array, handle each material
                            const materials = Array.isArray(node.material) ? node.material : [node.material];
                            
                            materials.forEach(material => {
                                // Preserve original material properties
                                material.needsUpdate = true;
                                
                                // Handle baked textures
                                if (material.map) {
                                    material.map.encoding = THREE.sRGBEncoding;
                                    material.map.flipY = false;
                                    material.map.needsUpdate = true;
                                }
                                
                                // For baked materials, we want to preserve the original look
                                if (material.userData && material.userData.baked) {
                                    // Keep original material properties
                                    material.roughness = material.roughness || 1.0;
                                    material.metalness = material.metalness || 0.0;
                                    material.envMapIntensity = 0.0; // Disable environment reflections for baked materials
                                } else {
                                    // Default PBR properties for non-baked materials
                                    material.roughness = material.roughness || 0.7;
                                    material.metalness = material.metalness || 0.3;
                                    material.envMapIntensity = material.envMapIntensity || 1.0;
                                }
                                
                                // Enable transparency if needed
                                if (material.transparent) {
                                    material.transparent = true;
                                    material.opacity = material.opacity || 1.0;
                                    material.alphaTest = 0.5;
                                }
                                
                                // Set material side to DoubleSide to prevent disappearing
                                material.side = THREE.DoubleSide;
                                
                                // Handle normal maps
                                if (material.normalMap) {
                                    material.normalScale.set(1, 1);
                                    material.normalMap.needsUpdate = true;
                                }
                                
                                // Handle AO maps
                                if (material.aoMap) {
                                    material.aoMapIntensity = 1.0;
                                    material.aoMap.needsUpdate = true;
                                }
                                
                                // Handle emissive maps
                                if (material.emissiveMap) {
                                    material.emissiveIntensity = 1.0;
                                    material.emissiveMap.needsUpdate = true;
                                }

                                // Ensure material is not null or undefined
                                if (!material) {
                                    material = new THREE.MeshStandardMaterial({
                                        color: 0x808080,
                                        roughness: 0.7,
                                        metalness: 0.3
                                    });
                                }

                                // Log material information for debugging
                                console.log('Material properties:', {
                                    name: material.name,
                                    map: material.map ? 'Has texture' : 'No texture',
                                    roughness: material.roughness,
                                    metalness: material.metalness,
                                    envMapIntensity: material.envMapIntensity,
                                    userData: material.userData
                                });
                            });
                            
                            // If original material was an array, update the mesh
                            if (Array.isArray(node.material)) {
                                node.material = materials;
                            }
                        } else {
                            // If no material exists, create a default one
                            node.material = new THREE.MeshStandardMaterial({
                                color: 0x808080,
                                roughness: 0.7,
                                metalness: 0.3
                            });
                        }
                    }
                });

                
                
                
                // Center and scale the model
                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                
                const maxDim = Math.max(size.x, size.y, size.z);
                const modelScale = initialScale / maxDim;
                model.scale.setScalar(modelScale);
                
                // Position the model
                model.position.copy(position);
                model.position.sub(center.multiplyScalar(modelScale));

                // Add model directly to scene
                scene.add(model);

                // Ensure model is visible
                model.visible = true;

                console.log('Model added to scene');

                // Add scale slider functionality
                const scaleSlider = document.getElementById('scaleSlider');
                const scaleValue = document.getElementById('scaleValue');
                
                scaleSlider.addEventListener('input', (e) => {
                    const newScale = parseFloat(e.target.value);
                    scaleValue.textContent = newScale.toFixed(1);
                    
                    if (currentModel) {
                        // Apply new scale
                        currentModel.scale.setScalar(newScale * modelScale);
                    }
                });
                
                // Resolve the promise with the model
                resolve(model);
            },
            (xhr) => {
                const progress = (xhr.loaded / xhr.total) * 100;
                console.log(`Loading progress: ${progress.toFixed(2)}%`);
                loadingText.textContent = `Loading model... ${Math.round(progress)}%`;
            },
            (error) => {
                console.error('Error loading model:', error);
                loadingText.textContent = 'Error loading model. Please check console for details.';
                progressBarFill.style.backgroundColor = '#ff0000';
                reject(error);
            }
        );
    });
}

// Call the function with your model path, position, and scale
loadHeavyModel(
    'model/ba monitor.glb',  // Updated to correct model name
    new THREE.Vector3(0, 15, 0), // Original position that was working
    43  // Original scale that was working
).then(model => {
    console.log('Monitor model loaded successfully');
}).catch(error => {
    console.error('Error loading monitor model:', error);
});

// Load additional GLTF model
loadHeavyModel(
    'model/Instagram.glb',  // Instagram model
    new THREE.Vector3(20.5,4.5, -9), // Position in the scene
    2  // Scale factor
).then(model => {
    console.log('Instagram loaded successfully');
}).catch(error => {
    console.error('Error loading Instagram model:', error);
});

loadHeavyModel(
    'model/Telegram.glb',  // BoomBox model
    new THREE.Vector3(20.5,8.5, -9), // Position in the scene
    2  // Scale factor
).then(model => {
    console.log('telegram loaded successfully');
}).catch(error => {
    console.error('Error loading telegaram:', error);
});

// Load LowPoly model
loadHeavyModel(
    'model/.glb',
    new THREE.Vector3(-1, 0.55, 1),
    2.4
).then(model => {
    console.log('LowPoly model loaded successfully');
    // Setup interaction for the model
    setupModelInteraction(model);
}).catch(error => {
    console.error('Error loading LowPoly model:', error);
});

// Load Door model
let doorModel = null; // Global reference to door model
loadHeavyModel(
    'model/Door.glb',  // Door model
    new THREE.Vector3(21.5, 5, 0), // Position near entrance
    12.5  // Scale factor
).then(model => {
    doorModel = model; // Store reference to the door model
    console.log('Door model loaded and stored:', doorModel);
    console.log('Door model position:', doorModel.position);
    console.log('Door model visible:', doorModel.visible);
}).catch(error => {
    console.error('Error loading door model:', error);
    doorModel.position.copy(doorClosedPosition); // or doorOpenPosition depending on initial state
});


// Door animation variables
let isDoorOpen = false;
let doorAnimation = false;
const doorOpenPosition = new THREE.Vector3(0, 0, 0); // Original position
const doorClosedPosition = new THREE.Vector3(0, 0, -5); // Position when open (slid aside)

// Function to animate door sliding
function animateDoor() {
   
    console.log('animateDoor called');
    console.log('doorModel:', doorModel);
    console.log('isDoorOpen:', isDoorOpen);
    
    if (!doorModel) {
        console.log('Door model not loaded yet');
        return;
    }
    
    const targetPosition = isDoorOpen ? doorClosedPosition : doorOpenPosition;
    const startPosition = doorModel.position.clone();
    const duration = 1000; // 1 second animation
    const startTime = Date.now();
    
    console.log('Starting door animation');
    console.log('Start position:', startPosition);
    console.log('Target position:', targetPosition);
    
    function updateDoorPosition() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Smooth easing function
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        
        // Interpolate position
        // doorModel.position.lerpVectors(startPosition, targetPosition, easeProgress);
        doorModel.position.copy(startPosition).lerp(targetPosition, easeProgress);
        
        console.log('Door animation progress:', progress, 'Position:', doorModel.position);
        
        if (progress < 1) {
            requestAnimationFrame(updateDoorPosition);
        } else {
            // Animation complete
            isDoorOpen = !isDoorOpen;
            console.log('Door animation complete. Door is now:', isDoorOpen ? 'open' : 'closed');
        }
    }
    
    updateDoorPosition();
}

// Function to handle door click/tap
function handleDoorInteraction() {
    if (!doorModel) {
        console.log('Door model not loaded yet');
        return;
    }
    
    console.log('Door clicked! Animating door...');
    animateDoor();
}

// Load LinkedIn model
let linkedInModel = null; // Global reference to LinkedIn model
loadHeavyModel(
    'model/LinkedIn.glb',  // LinkedIn model
    new THREE.Vector3(20.5, 12.5, -9), // Position in the scene
    2  // Scale factor
).then(model => {
    linkedInModel = model; // Store reference to the LinkedIn model
    console.log('LinkedIn model loaded successfully');
    console.log('LinkedIn model position:', linkedInModel.position);
}).catch(error => {
    console.error('Error loading LinkedIn model:', error);
});

// Function to open LinkedIn profile
function openLinkedInProfile() {
    // Replace this URL with your actual LinkedIn profile URL
    const linkedInUrl = 'https://www.linkedin.com/in/your-profile/';
    console.log('Opening LinkedIn profile:', linkedInUrl);
    
    // Open in new tab
    window.open(linkedInUrl, '_blank');
    
    // Show a notification
    showNotification('Opening LinkedIn profile...', 'info');
}

// Function to show notifications
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.left = '50%';
    notification.style.transform = 'translateX(-50%)';
    notification.style.padding = '10px 20px';
    notification.style.borderRadius = '5px';
    notification.style.color = 'white';
    notification.style.fontWeight = 'bold';
    notification.style.zIndex = '10000';
    notification.style.transition = 'opacity 0.3s ease';
    
    // Set background color based on type
    switch(type) {
        case 'success':
            notification.style.backgroundColor = '#4CAF50';
            break;
        case 'error':
            notification.style.backgroundColor = '#f44336';
            break;
        case 'warning':
            notification.style.backgroundColor = '#ff9800';
            break;
        default:
            notification.style.backgroundColor = '#2196F3';
    }
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Create chat UI
const chatUI = document.createElement('div');
chatUI.style.position = 'fixed';
chatUI.style.bottom = '20px';
chatUI.style.right = '20px';
chatUI.style.width = '300px';
chatUI.style.height = '400px';
chatUI.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
chatUI.style.borderRadius = '10px';
chatUI.style.padding = '10px';
chatUI.style.display = 'none';
chatUI.style.zIndex = '1000';
chatUI.innerHTML = `
    <div style="color: white; margin-bottom: 10px;">Chat with the Model</div>
    <div id="chatMessages" style="height: 300px; overflow-y: auto; margin-bottom: 10px; color: white;"></div>
    <div style="display: flex;">
        <input type="text" id="chatInput" style="flex-grow: 1; padding: 5px; margin-right: 5px;" placeholder="Type your message...">
        <button id="sendMessage" style="padding: 5px 10px;">Send</button>
        <button id="micButton" style="padding: 5px 10px; margin-left: 5px;">🎤</button>
    </div>
`;
document.body.appendChild(chatUI);

// Speech Recognition setup
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'fa-ir'; // Set language as needed
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
} else {
    console.warn('Speech Recognition not supported in this browser.');
}

const micButton = document.getElementById('micButton');
if (micButton && recognition) {
    micButton.addEventListener('click', () => {
        recognition.start();
        micButton.textContent = '🎤...';
    });

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        document.getElementById('chatInput').value = transcript;
        micButton.textContent = '🎤';
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        micButton.textContent = '🎤';
    };

    recognition.onend = () => {
        micButton.textContent = '🎤';
    };
}

function speakText(text) {
    console.log('Attempting to speak text:', text); // Debug log

    if ('speechSynthesis' in window) {
        console.log('Speech synthesis is supported'); // Debug log
        
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        // Create new utterance
        const msg = new SpeechSynthesisUtterance(text);
        msg.lang = "fa-IR"; // Set to Farsi
        console.log('Speech language set to:', msg.lang); // Debug log

        // Get available voices
        const voices = window.speechSynthesis.getVoices();
        console.log('Available voices:', voices.map(v => `${v.name} (${v.lang})`)); // Debug log
        
        // Try to find a Farsi voice
        const farsiVoice = voices.find(voice => voice.lang.includes('fa'));
        if (farsiVoice) {
            msg.voice = farsiVoice;
            console.log('Using Farsi voice:', farsiVoice.name);
        } else {
            console.log('No Farsi voice found, using default voice');
        }

        // Add event listeners for debugging
        msg.onstart = () => {
            console.log('Speech started');
        };

        msg.onend = () => {
            console.log('Speech ended');
        };

        msg.onerror = (event) => {
            console.error('Speech error:', event);
        };

        // Speak the text
        window.speechSynthesis.speak(msg);
        console.log('Speech synthesis initiated'); // Debug log
    } else {
        console.warn('Speech synthesis not supported in this browser');
    }
}

// Initialize voices when they become available
if ('speechSynthesis' in window) {
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = () => {
            const voices = speechSynthesis.getVoices();
            console.log('Voices loaded:', voices.map(v => `${v.name} (${v.lang})`));
        };
    }
}

// Chat state
let isChatOpen = false;
let currentModel = null;

// Function to list available models
async function listAvailableModels() {
    try {
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyA4uynwR5RfHjoppWd4yxhjk_-4TZryZkI');
        const data = await response.json();
        console.log('Available models:', data);
        return data;
    } catch (error) {
        console.error('Error listing models:', error);
        return null;
    }
}

async function handleChat(message) {
    try {
        console.log('Sending message to Gemini:', message);
        const requestBody = {
            contents: [{
                parts: [{
                    text: `You are a helpful AI assistant representing a 3D model in a virtual environment. Please respond to this message in Farsi (Persian): ${message}`
                }]
            }],
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 1024,
            },
            safetySettings: [
                {
                    category: "HARM_CATEGORY_HARASSMENT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_HATE_SPEECH",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                }
            ]
        };

        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyA4uynwR5RfHjoppWd4yxhjk_-4TZryZkI', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        console.log('Gemini API response:', data);

        if (!response.ok) {
            console.error('API Error Response:', {
                status: response.status,
                statusText: response.statusText,
                data: data
            });
            return `خطا: درخواست API با وضعیت ${response.status} ناموفق بود. ${data.error?.message || 'خطای ناشناخته رخ داد'}`;
        }

        if (data.candidates && Array.isArray(data.candidates) && data.candidates.length > 0) {
            const candidate = data.candidates[0];
            if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                const responseText = candidate.content.parts[0].text;
                console.log('Extracted response:', responseText);
                return responseText;
            }
        }

        return `خطا: فرمت پاسخ غیرمنتظره از API. لطفاً کنسول را برای جزئیات بررسی کنید.`;
    } catch (error) {
        console.error('Error in chat:', error);
        if (error instanceof TypeError) {
            return "خطای شبکه: اتصال به API امکان‌پذیر نیست. لطفاً اتصال اینترنت خود را بررسی کنید.";
        }
        return `خطا: ${error.message || 'یک خطای غیرمنتظره رخ داد'}`;
    }
}

// Function to add message to chat
function addMessageToChat(message, isUser = true) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.style.marginBottom = '10px';
    messageDiv.style.padding = '5px';
    messageDiv.style.backgroundColor = isUser ? 'rgba(0, 100, 255, 0.3)' : 'rgba(100, 100, 100, 0.3)';
    messageDiv.style.borderRadius = '5px';
    messageDiv.textContent = isUser ? `You: ${message}` : `Model: ${message}`;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Add click handler for the model
function setupModelInteraction(model) {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    window.addEventListener('click', async (event) => {
        if (!controls.isLocked) return;

        // Calculate mouse position in normalized device coordinates
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        // Update the picking ray with the camera and mouse position
        raycaster.setFromCamera(mouse, camera);

        // Calculate objects intersecting the picking ray
        const intersects = raycaster.intersectObject(model, true);

        if (intersects.length > 0) {
            currentModel = model;
            chatUI.style.display = 'block';
            isChatOpen = true;
            controls.unlock();
        }
    });
}

// Add chat event listeners
document.getElementById('sendMessage').addEventListener('click', async () => {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (message && currentModel) {
        addMessageToChat(message, true);
        input.value = '';
        
        const response = await handleChat(message);
        console.log('AI Response received:', response); // Debug log
        addMessageToChat(response, false);
        speakText(response);
    }
});

document.getElementById('chatInput').addEventListener('keypress', async (event) => {
    if (event.key === 'Enter') {
        const message = event.target.value.trim();
        
        if (message && currentModel) {
            addMessageToChat(message, true);
            event.target.value = '';
            
            const response = await handleChat(message);
            console.log('AI Response received:', response); // Debug log
            addMessageToChat(response, false);
            speakText(response);
        }
    }
});

// Add close button to chat
const closeChatButton = document.createElement('button');
closeChatButton.textContent = 'X';
closeChatButton.style.position = 'absolute';
closeChatButton.style.top = '5px';
closeChatButton.style.right = '5px';
closeChatButton.style.background = 'none';
closeChatButton.style.border = 'none';
closeChatButton.style.color = 'white';
closeChatButton.style.cursor = 'pointer';
chatUI.appendChild(closeChatButton);

closeChatButton.addEventListener('click', () => {
    chatUI.style.display = 'none';
    isChatOpen = false;
    currentModel = null;
    controls.lock();
});

// Create floating guide sign
const guideGeometry = new THREE.ConeGeometry(0.5, 2, 4);
const guideMaterial = new THREE.MeshBasicMaterial({ 
    color: 0x4CAF50,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide
});
const guideSign = new THREE.Mesh(guideGeometry, guideMaterial);
guideSign.rotation.x = Math.PI/2; // Rotate to point upward
// guideSign.position.set(15, 1.7, 2); // Set initial position
// scene.add(guideSign);

// Add animation to the guide sign
function animateGuide() {
    if (guideSign) {
        // Floating motion
        guideSign.position.x = 28 + Math.sin(Date.now() * 0.004) * 0.1;
    }
}

// In the render function, find the line before renderer.render(scene, camera);
// and add these lines:
if (controls.isLocked) {
    // Keep the guide sign at its fixed position
    guideSign.position.set(15, guideSign.position.y, 2);
}

scene.add(guideSign);

// Animate the guide sign
animateGuide();

// Mobile touch controls
let touchStartX = 0;
let touchStartY = 0;
let touchMoveX = 0;
let touchMoveY = 0;
let isTouching = false;
let touchMode = 'look'; // 'look' or 'move'
let lastTouchTime = 0;
let touchSensitivity = 0.002;
let moveSensitivity = 0.05;

// Touch controls UI
const touchControls = document.createElement('div');
touchControls.style.position = 'fixed';
touchControls.style.bottom = '20px';
touchControls.style.left = '20px';
touchControls.style.right = '20px';
touchControls.style.height = '120px';
touchControls.style.display = 'none';
touchControls.style.zIndex = '1000';
touchControls.style.pointerEvents = 'none';
touchControls.style.userSelect = 'none';
touchControls.style.webkitUserSelect = 'none';
touchControls.style.touchAction = 'none';
touchControls.innerHTML = `
    <div id="joystick" style="
        position: absolute;
        bottom: 20px;
        left: 20px;
        width: 80px;
        height: 80px;
        background: rgba(255, 255, 255, 0.3);
        border: 2px solid rgba(255, 255, 255, 0.5);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
    ">
        <div id="joystickHandle" style="
            width: 30px;
            height: 30px;
            background: rgba(255, 255, 255, 0.8);
            border-radius: 50%;
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            touch-action: none;
            user-select: none;
            -webkit-user-select: none;
        "></div>
    </div>
    <div id="lookArea" style="
        position: absolute;
        bottom: 20px;
        right: 20px;
        width: 120px;
        height: 80px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 10px;
        pointer-events: auto;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
    "></div>
    <div id="actionButton" style="
        position: absolute;
        top: 20px;
        right: 20px;
        width: 60px;
        height: 60px;
        background: rgba(0, 255, 0, 0.6);
        border: 2px solid rgba(255, 255, 255, 0.8);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        pointer-events: auto;
        cursor: pointer;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
        font-size: 18px;
    ">X</div>
    <div style="
        position: absolute;
        top: 20px;
        left: 20px;
        color: white;
        font-size: 12px;
        background: rgba(0, 0, 0, 0.5);
        padding: 5px 10px;
        border-radius: 5px;
        pointer-events: none;
    ">
        Mobile Controls Active
    </div>
`;
document.body.appendChild(touchControls);

// Touch event handlers
function handleTouchStart(event) {
    event.preventDefault();
    const touch = event.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    isTouching = true;
    lastTouchTime = Date.now();
}

function handleTouchMove(event) {
    event.preventDefault();
    if (!isTouching) return;
    
    const touch = event.touches[0];
    touchMoveX = touch.clientX - touchStartX;
    touchMoveY = touch.clientY - touchStartY;
    
    // Determine touch area
    const joystick = document.getElementById('joystick');
    const lookArea = document.getElementById('lookArea');
    const joystickRect = joystick.getBoundingClientRect();
    const lookAreaRect = lookArea.getBoundingClientRect();
    
    // Check if touch is in joystick area (movement)
    if (touch.clientX >= joystickRect.left && touch.clientX <= joystickRect.right &&
        touch.clientY >= joystickRect.top && touch.clientY <= joystickRect.bottom) {
        touchMode = 'move';
        updateJoystick(touch.clientX, touch.clientY, joystickRect);
    }
    // Check if touch is in look area (camera control)
    else if (touch.clientX >= lookAreaRect.left && touch.clientX <= lookAreaRect.right &&
             touch.clientY >= lookAreaRect.top && touch.clientY <= lookAreaRect.bottom) {
        touchMode = 'look';
        if (controls.isLocked) {
            // Apply camera rotation
            const deltaX = touchMoveX * touchSensitivity;
            const deltaY = touchMoveY * touchSensitivity;
            
            // Rotate camera
            camera.rotation.y -= deltaX;
            camera.rotation.x -= deltaY;
            
            // Clamp vertical rotation
            camera.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, camera.rotation.x));
        }
    }
}

function handleTouchEnd(event) {
    event.preventDefault();
    isTouching = false;
    touchMode = 'look';
    
    // Reset joystick
    const joystickHandle = document.getElementById('joystickHandle');
    joystickHandle.style.left = '50%';
    joystickHandle.style.top = '50%';
    joystickHandle.style.transform = 'translate(-50%, -50%)';
    
    // Stop movement
    moveForward = false;
    moveBackward = false;
    moveLeft = false;
    moveRight = false;
}

function updateJoystick(touchX, touchY, joystickRect) {
    const joystickHandle = document.getElementById('joystickHandle');
    const centerX = joystickRect.left + joystickRect.width / 2;
    const centerY = joystickRect.top + joystickRect.height / 2;
    
    const deltaX = touchX - centerX;
    const deltaY = touchY - centerY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const maxDistance = joystickRect.width / 2 - 15; // Leave some margin
    
    if (distance > maxDistance) {
        const angle = Math.atan2(deltaY, deltaX);
        const clampedX = centerX + Math.cos(angle) * maxDistance;
        const clampedY = centerY + Math.sin(angle) * maxDistance;
        
        joystickHandle.style.left = (clampedX - joystickRect.left) + 'px';
        joystickHandle.style.top = (clampedY - joystickRect.top) + 'px';
    } else {
        joystickHandle.style.left = (touchX - joystickRect.left) + 'px';
        joystickHandle.style.top = (touchY - joystickRect.top) + 'px';
    }
    
    joystickHandle.style.transform = 'translate(-50%, -50%)';
    
    // Determine movement direction based on joystick position
    const normalizedX = deltaX / maxDistance;
    const normalizedY = deltaY / maxDistance;
    
    // Set movement flags
    moveForward = normalizedY < -0.3;
    moveBackward = normalizedY > 0.3;
    moveLeft = normalizedX < -0.3;
    moveRight = normalizedX > 0.3;
}

// Action button for interaction
document.getElementById('actionButton').addEventListener('click', () => {
    if (controls.isLocked) {
        // Simulate X key press for video interaction
        if (isNearVideoFrame()) {
            toggleVideo();
        }
        
        // Check for model interaction
        const raycaster = new THREE.Raycaster();
        const center = new THREE.Vector2(0, 0); // Center of screen
        raycaster.setFromCamera(center, camera);
        
        // Check for model intersection
        const intersects = raycaster.intersectObjects(scene.children, true);
        if (intersects.length > 0) {
            const clickedObject = intersects[0].object;
            
            // Check if it's a screen or interactive object
            if (clickedObject === screen4 || clickedObject === screen5) {
                console.log("Screen clicked via touch");
                iframe.src = 'storyline/fomento-final/index.html';
                iframe.style.display = 'block';
                iframe.style.position = 'fixed';
                iframe.style.top = '10%';
                iframe.style.left = '10%';
                iframe.style.width = '80%';
                iframe.style.height = '80%';
                iframe.style.zIndex = '1000';
                showcCloseButton();
                controls.unlock();
            } else if (clickedObject === coffeeinfo) {
                console.log("Coffee info clicked via touch");
                showInfoDialog();
                controls.unlock();
            } else if (clickedObject === linkedInModel) {
                console.log("LinkedIn clicked via touch");
                openLinkedInProfile();
                controls.unlock();
            } else if (clickedObject === telegramModel) {
                console.log("Telegram clicked via touch");
                openTelegramChannel();
                controls.unlock();
            } else if (clickedObject === instagramModel) {
                console.log("Instagram clicked via touch");
                openInstagramProfile();
                controls.unlock();
            }
        }
    }
});

// Add touch event listeners
document.addEventListener('touchstart', handleTouchStart, { passive: false });
document.addEventListener('touchmove', handleTouchMove, { passive: false });
document.addEventListener('touchend', handleTouchEnd, { passive: false });

// Add touch tap handler for mobile interaction
document.addEventListener('touchend', (event) => {
    if (!isMobileDevice() || renderer.xr.isPresenting) return;
    
    // Only handle single taps, not joystick or look area touches
    const touch = event.changedTouches[0];
    const joystick = document.getElementById('joystick');
    const lookArea = document.getElementById('lookArea');
    const actionButton = document.getElementById('actionButton');
    
    if (joystick && lookArea && actionButton) {
        const joystickRect = joystick.getBoundingClientRect();
        const lookAreaRect = lookArea.getBoundingClientRect();
        const actionButtonRect = actionButton.getBoundingClientRect();
        
        // Check if touch was in control areas
        const inJoystick = touch.clientX >= joystickRect.left && touch.clientX <= joystickRect.right &&
                          touch.clientY >= joystickRect.top && touch.clientY <= joystickRect.bottom;
        const inLookArea = touch.clientX >= lookAreaRect.left && touch.clientX <= lookAreaRect.right &&
                          touch.clientY >= lookAreaRect.top && touch.clientY <= lookAreaRect.bottom;
        const inActionButton = touch.clientX >= actionButtonRect.left && touch.clientX <= actionButtonRect.right &&
                              touch.clientY >= actionButtonRect.top && touch.clientY <= actionButtonRect.bottom;
        
        // If touch was not in control areas, treat as screen tap
        if (!inJoystick && !inLookArea && !inActionButton) {
            handleMobileTap(touch);
        }
    }
}, { passive: false });

// Handle mobile tap for object interaction
function handleMobileTap(touch) {
    // Calculate touch position in normalized device coordinates
    const touchX = (touch.clientX / window.innerWidth) * 2 - 1;
    const touchY = -(touch.clientY / window.innerHeight) * 2 + 1;
    
    // Update the picking ray with the camera and touch position
    raycaster.setFromCamera(new THREE.Vector2(touchX, touchY), camera);
    
    // Calculate objects intersecting the picking ray
    const intersects = raycaster.intersectObjects([screen, screen4, screen5, coffeeinfo, doorModel, linkedInModel, telegramModel, instagramModel], true);
    
    console.log('Mobile tap intersects:', intersects);
    
    if (intersects.length > 0) {
        const clickedObject = intersects[0].object;
        console.log('Mobile tapped object:', clickedObject);
        
        // Check if clicked object is the door or any of its children
        let isDoorClicked = false;
        if (doorModel) {
            // Check if it's the door model itself
            if (clickedObject === doorModel) {
                isDoorClicked = true;
            } else {
                // Check if it's a child of the door model
                let parent = clickedObject.parent;
                while (parent) {
                    if (parent === doorModel) {
                        isDoorClicked = true;
                        break;
                    }
                    parent = parent.parent;
                }
            }
        }
        
        // Check if clicked object is the LinkedIn model or any of its children
        let isLinkedInClicked = false;
        if (linkedInModel) {
            // Check if it's the LinkedIn model itself
            if (clickedObject === linkedInModel) {
                isLinkedInClicked = true;
            } else {
                // Check if it's a child of the LinkedIn model
                let parent = clickedObject.parent;
                while (parent) {
                    if (parent === linkedInModel) {
                        isLinkedInClicked = true;
                        break;
                    }
                    parent = parent.parent;
                }
            }
        }
        
        // Check if clicked object is the Telegram model or any of its children
        let isTelegramClicked = false;
        if (telegramModel) {
            // Check if it's the Telegram model itself
            if (clickedObject === telegramModel) {
                isTelegramClicked = true;
            } else {
                // Check if it's a child of the Telegram model
                let parent = clickedObject.parent;
                while (parent) {
                    if (parent === telegramModel) {
                        isTelegramClicked = true;
                        break;
                    }
                    parent = parent.parent;
                }
            }
        }
        
        // Check if clicked object is the Instagram model or any of its children
        let isInstagramClicked = false;
        if (instagramModel) {
            // Check if it's the Instagram model itself
            if (clickedObject === instagramModel) {
                isInstagramClicked = true;
            } else {
                // Check if it's a child of the Instagram model
                let parent = clickedObject.parent;
                while (parent) {
                    if (parent === instagramModel) {
                        isInstagramClicked = true;
                        break;
                    }
                    parent = parent.parent;
                }
            }
        }
        
        console.log('Is door clicked on mobile?', isDoorClicked);
        console.log('Is LinkedIn clicked on mobile?', isLinkedInClicked);
        console.log('Is Telegram clicked on mobile?', isTelegramClicked);
        console.log('Is Instagram clicked on mobile?', isInstagramClicked);
        
        if (clickedObject === screen4) {
            console.log("screen4 tapped on mobile");
            setTimeout(() => {
                iframe.style.display = 'block';
                fadeInIframe();
                iframe.style.opacity = '1s ease';
                iframe.style.display = 'block';
                iframe.style.position = 'fixed';
                iframe.style.top = '10%';
                iframe.style.left = '10%';
                iframe.style.width = '80%';
                iframe.style.height = '80%';
                iframe.style.zIndex = '3000';
                iframe.style.opacity = '1';
                iframe.src = 'storyline/fomento-menu/index.html';
            }, 1000);
            showcCloseButton();
        } else if (clickedObject === screen5) {
            console.log("screen5 tapped on mobile");
            iframe.src = 'storyline/fomento-final/index.html';
            iframe.style.display = 'block';
            iframe.style.position = 'fixed';
            iframe.style.top = '10%';
            iframe.style.left = '10%';
            iframe.style.width = '80%';
            iframe.style.height = '80%';
            iframe.style.zIndex = '1000';
            showcCloseButton();
        } else if (clickedObject === coffeeinfo) {
            console.log("coffee info tapped on mobile");
            showInfoDialog();
        } else if (clickedObject === screen) {
            console.log("screen tapped on mobile");
            iframe.src = 'storyline/fomento-final/index.html';
            iframe.style.display = 'block';
            iframe.style.position = 'fixed';
            iframe.style.top = '10%';
            iframe.style.left = '10%';
            iframe.style.width = '80%';
            iframe.style.height = '80%';
            iframe.style.zIndex = '1000';
            showcCloseButton();
        } else if (isDoorClicked) {
            console.log("door tapped on mobile");
            animateDoor();
        } else if (isLinkedInClicked) {
            console.log("LinkedIn tapped on mobile");
            openLinkedInProfile();
        } else if (isTelegramClicked) {
            console.log("Telegram tapped on mobile");
            openTelegramChannel();
        } else if (isInstagramClicked) {
            console.log("Instagram tapped on mobile");
            openInstagramProfile();
        }
    }
}

// Function to detect mobile device
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           window.innerWidth <= 768;
}

// Show/hide touch controls based on device
function updateTouchControls() {
    if (isMobileDevice()) {
        touchControls.style.display = 'block';
        // Hide desktop controls on mobile
        speedControls.style.display = 'none';
        fileInput.style.display = 'none';
        fileInput2.style.display = 'none';
    } else {
        touchControls.style.display = 'none';
        // Show desktop controls on desktop
        speedControls.style.display = 'block';
        fileInput.style.display = 'block';
        fileInput2.style.display = 'block';
    }
}

// Update controls on window resize
window.addEventListener('resize', updateTouchControls);

// Initialize touch controls
updateTouchControls();

// Add mobile-specific CSS to prevent unwanted behaviors
const mobileCSS = document.createElement('style');
mobileCSS.textContent = `
    @media (max-width: 768px) {
        body {
            touch-action: none;
            user-select: none;
            -webkit-user-select: none;
            -webkit-touch-callout: none;
            -webkit-tap-highlight-color: transparent;
            overflow: hidden;
        }
        
        canvas {
            touch-action: none;
        }
        
        #joystick, #lookArea, #actionButton {
            touch-action: none !important;
            user-select: none !important;
            -webkit-user-select: none !important;
        }
    }
`;
document.head.appendChild(mobileCSS);

// Prevent default touch behaviors on mobile
document.addEventListener('touchstart', (e) => {
    if (isMobileDevice()) {
        e.preventDefault();
    }
}, { passive: false });

document.addEventListener('touchmove', (e) => {
    if (isMobileDevice()) {
        e.preventDefault();
    }
}, { passive: false });

document.addEventListener('touchend', (e) => {
    if (isMobileDevice()) {
        e.preventDefault();
    }
}, { passive: false });

// Load Telegram model
let telegramModel = null; // Global reference to Telegram model
loadHeavyModel(
    'model/Telegram.glb',  // Telegram model
    new THREE.Vector3(20.5,8.5, -9), // Position in the scene
    2  // Scale factor
).then(model => {
    telegramModel = model; // Store reference to the Telegram model
    console.log('Telegram model loaded successfully');
    console.log('Telegram model position:', telegramModel.position);
}).catch(error => {
    console.error('Error loading Telegram model:', error);
});

// Function to open Telegram channel
function openTelegramChannel() {
    // Replace this URL with your actual Telegram channel URL
    const telegramUrl = 'https://t.me/your-channel';
    console.log('Opening Telegram channel:', telegramUrl);
    
    // Open in new tab
    window.open(telegramUrl, '_blank');
    
    // Show a notification
    showNotification('Opening Telegram channel...', 'info');
}

// Load Instagram model
let instagramModel = null; // Global reference to Instagram model
loadHeavyModel(
    'model/Instagram.glb',  // Instagram model
    new THREE.Vector3(20.5,4.5, -9), // Position in the scene
    2  // Scale factor
).then(model => {
    instagramModel = model; // Store reference to the Instagram model
    console.log('Instagram model loaded successfully');
    console.log('Instagram model position:', instagramModel.position);
}).catch(error => {
    console.error('Error loading Instagram model:', error);
});

// Function to open Instagram profile
function openInstagramProfile() {
    // Replace this URL with your actual Instagram profile URL
    const instagramUrl = 'https://www.instagram.com/your-username/';
    console.log('Opening Instagram profile:', instagramUrl);
    // Open in new tab
    window.open(instagramUrl, '_blank');
    // Show a notification
    showNotification('Opening Instagram profile...', 'info');
}

// --- Add Instagram to all intersection checks and click handlers below ---

