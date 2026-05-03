import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { ID_TO_NAME, NAME_TO_IMAGE } from './blockData.js';

const PLANT_IDS = new Set([1109, 1110, 150, 2016, 154, 1962, 1963, 1964]);


const width = window.innerWidth;
const height = window.innerHeight;

const scene = new THREE.Scene();
const canvas = document.getElementById('viewer-canvas');
scene.background = null;
scene.fog = new THREE.Fog(0x88aacc, 10, 150);

const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(width, height);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.physicallyCorrectLights = true;
renderer.useLegacyLights = false;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;


scene.add(new THREE.AmbientLight(0xffcfa0, 0.5));
scene.add(new THREE.HemisphereLight(0xffe6b3, 0x442200, 0.9));

const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.castShadow = true;
sun.position.set(5, 25, -5);
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 100;
sun.shadow.camera.left = -20;
sun.shadow.camera.right = 20;
sun.shadow.camera.top = 20;
sun.shadow.camera.bottom = -20;
sun.shadow.bias = -0.0005;
scene.add(sun);

scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(1, 1, 0.5).normalize();
scene.add(directionalLight);


const skyGeo = new THREE.SphereGeometry(1000, 32, 15);

const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
        topColor: { value: new THREE.Color(0x66ccff) },
        bottomColor: { value: new THREE.Color(0xfff3d6) },
        offset: { value: 33 },
        exponent: { value: 0.6 }
    },
    vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;

        varying vec3 vWorldPosition;

void main() {
    float h = normalize(vWorldPosition + offset).y;
    float mixFactor = smoothstep(-0.6, 0.2, h);
    gl_FragColor = vec4(mix(bottomColor, topColor, mixFactor), 1.0);
}
    `
});

const sky = new THREE.Mesh(skyGeo, skyMat);
scene.add(sky);
    


const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
const controls = new PointerLockControls(camera, document.body);
controls.pointerSpeed = 0.7;

let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

document.addEventListener('click', () => {
    controls.lock();
});

const onKeyDown = (event) => {
    switch (event.code) {
        case 'KeyW': moveForward = true; break;
        case 'KeyA': moveLeft = true; break;
        case 'KeyS': moveBackward = true; break;
        case 'KeyD': moveRight = true; break;
    }
};

const onKeyUp = (event) => {
    switch (event.code) {
        case 'KeyW': moveForward = false; break;
        case 'KeyA': moveLeft = false; break;
        case 'KeyS': moveBackward = false; break;
        case 'KeyD': moveRight = false; break;
    }
};

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);


const blockGeometry = new THREE.BoxGeometry(1, 1, 1);

const plantGeometry = new THREE.BufferGeometry();
const vertices = new Float32Array([
    -0.5, -0.5, -0.5, 0.5, 0.5, 0.5, -0.5, 0.5, -0.5,
    -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5,
    -0.5, -0.5, 0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5,
    -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5,
]);
const uvs = new Float32Array([
    0, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1,
    0, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1,
]);
plantGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
plantGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
plantGeometry.computeVertexNormals();

const textureLoader = new THREE.TextureLoader();
const materialCache = {};
let activeMeshes = [];

function getBlockMaterial(blockID) {
    if (materialCache[blockID]) return materialCache[blockID];

    const blockName = ID_TO_NAME[blockID];
    const textureName = NAME_TO_IMAGE[blockName];
    const isPlant = PLANT_IDS.has(Number(blockID));

    if (textureName) {
        const texture = textureLoader.load(`textures/${textureName}.png`);
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.colorSpace = THREE.SRGBColorSpace;

        materialCache[blockID] = new THREE.MeshLambertMaterial({
            map: texture,
            transparent: isPlant,
            alphaTest: isPlant ? 0.5 : 0,
            side: isPlant ? THREE.DoubleSide : THREE.FrontSide
        });
        materialCache[blockID].roughness = 0.85 + Math.random() * 0.1;
materialCache[blockID].color = new THREE.Color(1, 1, 1).multiplyScalar(0.95 + Math.random() * 0.1);
    } else {
        const color = new THREE.Color().setHex(Math.random() * 0xffffff);
        materialCache[blockID] = new THREE.MeshLambertMaterial({ color: color });
    }
    return materialCache[blockID];
}

function clearScene() {
    activeMeshes.forEach(mesh => scene.remove(mesh));
    activeMeshes = [];
}

function displaySchematic(schematic) {
    clearScene();
    document.getElementById('info-name').textContent = schematic.name;
    document.getElementById('info-size').textContent = schematic.size.join(' x ');

    if (schematic.blocks.length === 0) return;

    const blocksByType = {};
    schematic.blocks.forEach(block => {
        if (!blocksByType[block.id]) blocksByType[block.id] = [];
        blocksByType[block.id].push(block);
    });

    const dummy = new THREE.Object3D();

    for (const id in blocksByType) {
        const blocks = blocksByType[id];
        const isPlant = PLANT_IDS.has(Number(id));
        const geometry = isPlant ? plantGeometry : blockGeometry;

        const mesh = new THREE.InstancedMesh(geometry, getBlockMaterial(id), blocks.length);

        blocks.forEach((b, i) => {
            dummy.position.set(b.x, b.y, b.z);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        });

        mesh.instanceMatrix.needsUpdate = true;
        scene.add(mesh);
        activeMeshes.push(mesh);
    }

    camera.position.set(schematic.size[0] / 2, schematic.size[1] + 5, schematic.size[2] + 10);
    camera.lookAt(schematic.size[0] / 2, 0, schematic.size[2] / 2);
}

function parseBloxdschem(buffer) {
    const dataView = new DataView(buffer);
    let offset = 4;
    function readUnsignedVarint() {
        let result = 0, shift = 0, byte;
        do {
            if (offset >= dataView.byteLength) throw new Error("Unexpected end of file while reading unsigned varint.");
            byte = dataView.getUint8(offset++); result |= (byte & 0x7f) << shift; shift += 7;
        } while (byte & 0x80); return result;
    }
    function readSignedVarint() { let r = readUnsignedVarint(); return (r >>> 1) ^ -(r & 1); }
    function readString() {
        const len = readSignedVarint(); if (len < 0 || offset + len > dataView.byteLength) throw new Error("Invalid string length.");
        const text = new TextDecoder().decode(new Uint8Array(buffer, offset, len)); offset += len; return text;
    }
    function readBytes() {
        const len = readSignedVarint(); if (len < 0 || offset + len > dataView.byteLength) throw new Error("Invalid byte array length.");
        const bytes = new Uint8Array(buffer, offset, len); offset += len; return bytes;
    }
    const schematic = {}; schematic.name = readString(); schematic.x = readSignedVarint(); schematic.y = readSignedVarint();
    schematic.z = readSignedVarint(); schematic.sizeX = readUnsignedVarint(); schematic.sizeY = readUnsignedVarint();
    schematic.sizeZ = readUnsignedVarint(); schematic.chunks = []; let chunkCount = readSignedVarint();
    for (let i = 0; i < chunkCount; i++) {
        schematic.chunks.push({ x: readSignedVarint(), y: readSignedVarint(), z: readSignedVarint(), blocks_raw: readBytes() });
    }
    const allBlocks = [];

    for (const chunk of schematic.chunks) {
        let blockOffset = 0;
        let blockIndex = 0;

        function readBlockVarint() {
            let r = 0, s = 0, b;

            do {
                if (blockOffset >= chunk.blocks_raw.length) return -1;

                b = chunk.blocks_raw[blockOffset++];
                r |= (b & 0x7f) << s;
                s += 7;

            } while (b & 0x80);

            return r;
        }

        while (blockOffset < chunk.blocks_raw.length) {
            const count = readBlockVarint();
            const blockID = readBlockVarint();

            if (count === -1 || blockID === -1) break;

            for (let i = 0; i < count; i++) {

                const x = blockIndex % 32;
                const y = Math.floor((blockIndex / 32) % 32);
                const z = Math.floor(blockIndex / (32 * 32));

                const worldX = chunk.x * 32 + z;
                const worldY = chunk.y * 32 + y;
                const worldZ = chunk.z * 32 + x;

                if ( blockID !== 0 && blockID !== 219 && blockID !== 220 && blockID !== 221 && blockID !== 222) {
                    //  console.log(`local=(${x},${y},${z}) world=(${worldX},${worldY},${worldZ}) index=${blockIndex}`); //debugging ass shit took me 1 week to fix big WWW

                    allBlocks.push({
                        id: blockID,
                        x: worldX,
                        y: worldY,
                        z: worldZ
                    });
                }

                blockIndex++;
            }
        }
    }
    return { name: schematic.name, pos: [schematic.x, schematic.y, schematic.z], size: [schematic.sizeX, schematic.sizeY, schematic.sizeZ], blocks: allBlocks };
}

document.getElementById('fileInput').addEventListener('change', (e) => {
    const reader = new FileReader();
    reader.onload = ev => displaySchematic(parseBloxdschem(ev.target.result));
    if (e.target.files[0]) reader.readAsArrayBuffer(e.target.files[0]);
});

window.addEventListener('resize', () => {
    const div = document.querySelector('.main-content');
    camera.aspect = div.clientWidth / div.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(div.clientWidth, div.clientHeight);
});

const flySpeed = 100.0;

let prevTime = performance.now();
function animate() {
    requestAnimationFrame(animate);
    sky.position.copy(camera.position);
    const time = performance.now();
    const delta = (time - prevTime) / 1000;

    if (controls.isLocked) {
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        const lookDirection = new THREE.Vector3();
        camera.getWorldDirection(lookDirection);

        if (moveForward || moveBackward) {
            velocity.z -= direction.z * flySpeed * delta;

            camera.position.addScaledVector(lookDirection, -velocity.z * delta);
        }
        if (moveLeft || moveRight) {
            velocity.x -= direction.x * flySpeed * delta;

            const rightVector = new THREE.Vector3();
            rightVector.crossVectors(lookDirection, camera.up).normalize();

            camera.position.addScaledVector(rightVector, -velocity.x * delta);
        }
    }

    prevTime = time;
    renderer.render(scene, camera);
}
animate();