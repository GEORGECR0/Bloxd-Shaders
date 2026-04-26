import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { ID_TO_NAME, NAME_TO_IMAGE } from './blockData.js';

const PLANT_IDS = new Set([1109, 1110 , 150]); 

const scene = new THREE.Scene();
const canvas = document.getElementById('viewer-canvas');
const container = document.querySelector('.main-content');
scene.background = new THREE.Color(0x336699);
scene.fog = new THREE.Fog(0x88aacc, 10, 500);

const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
    

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


const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
const controls = new PointerLockControls(camera, document.body);

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
    -0.5, -0.5, -0.5,  0.5,  0.5,  0.5, -0.5,  0.5, -0.5,
    -0.5, -0.5, -0.5,  0.5, -0.5,  0.5,  0.5,  0.5,  0.5,
    -0.5, -0.5,  0.5,  0.5,  0.5, -0.5, -0.5,  0.5,  0.5,
    -0.5, -0.5,  0.5,  0.5, -0.5, -0.5,  0.5,  0.5, -0.5,
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
            alphaTest: isPlant ? 0.5 : 0, // Discards transparent pixels
            side: isPlant ? THREE.DoubleSide : THREE.FrontSide
        });
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

    camera.position.set(schematic.size[0]/2, schematic.size[1] + 5, schematic.size[2] + 10);
    camera.lookAt(schematic.size[0]/2, 0, schematic.size[2]/2);
}

function parseBloxdschem(buffer) {
    const dataView = new DataView(buffer);
    let offset = 4;
    const readUVar = () => {
        let res = 0, shift = 0, b;
        do { b = dataView.getUint8(offset++); res |= (b & 0x7f) << shift; shift += 7; } while (b & 0x80);
        return res;
    };
    const readSVar = () => { let r = readUVar(); return (r >>> 1) ^ -(r & 1); };
    const readStr = () => {
        const len = readSVar();
        const s = new TextDecoder().decode(new Uint8Array(buffer, offset, len));
        offset += len; return s;
    };
    const readBytes = () => { 
        const len = readSVar(); 
        const b = new Uint8Array(buffer, offset, len); 
        offset += len; return b; 
    };

    const sch = { 
        name: readStr(), x: readSVar(), y: readSVar(), z: readSVar(), 
        sx: readUVar(), sy: readUVar(), sz: readUVar() 
    };
    
    const chunks = [];
    const chunkCount = readSVar();
    for (let i = 0; i < chunkCount; i++) {
        chunks.push({ x: readSVar(), y: readSVar(), z: readSVar(), data: readBytes() });
    }

    const blocks = [];
    chunks.forEach(c => {
        let bOff = 0, bIdx = 0;
        const readBlockVar = () => {
            let r = 0, s = 0, b;
            do { if (bOff >= c.data.length) return -1; b = c.data[bOff++]; r |= (b & 0x7f) << s; s += 7; } while (b & 0x80);
            return r;
        };

        while (bOff < c.data.length) {
            const count = readBlockVar(), id = readBlockVar();
            if (count === -1) break;
            for (let i = 0; i < count; i++) {
                if (id !== 0) {
                    const z = Math.floor(bIdx / 1024);
                    const y = Math.floor((bIdx % 1024) / 32);
                    const x = bIdx % 32;
                    blocks.push({ id, x: c.x * 32 + x, y: c.y * 32 + y, z: c.z * 32 + z });
                }
                bIdx++;
            }
        }
    });
    return { name: sch.name, size: [sch.sx, sch.sy, sch.sz], blocks };
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

const flySpeed = 150.0;

let prevTime = performance.now();
function animate() {
    requestAnimationFrame(animate);
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