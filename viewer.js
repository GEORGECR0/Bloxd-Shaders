
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { ID_TO_NAME, NAME_TO_IMAGE } from './blockData.js';

const PLANT_IDS = new Set([1109, 1110, 150, 2016, 154, 1962, 1963, 1964 , 956 , 957 , 1102 , 1103 , 1492 , 1493]);
const canvas = document.getElementById('viewer-canvas');

const scene = new THREE.Scene();
scene.background = null;
scene.fog = new THREE.Fog(0x88aacc, 10, 150);

const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.useLegacyLights = false;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

scene.add(new THREE.AmbientLight(0xffcfa0, 0.18));
scene.add(new THREE.HemisphereLight(0xffe6b3, 0x442200, 0.22));

const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.castShadow = true;
sun.position.set(30, 50, 20);
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.camera.near = 0.1;
sun.shadow.camera.far = 200;
sun.shadow.camera.left = -100;
sun.shadow.camera.right = 100;
sun.shadow.camera.top = 100;
sun.shadow.camera.bottom = -100;
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.02;
scene.add(sun);

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
            float f = smoothstep(-0.6, 0.2, h);
            gl_FragColor = vec4(mix(bottomColor, topColor, f), 1.0);
        }
    `
});

const sky = new THREE.Mesh(skyGeo, skyMat);
scene.add(sky);

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

const controls = new PointerLockControls(camera, document.body);
controls.pointerSpeed = 0.7;

let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;

const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const lookDirection = new THREE.Vector3();
const rightVector = new THREE.Vector3();

document.addEventListener('click', () => controls.lock());

document.addEventListener('keydown', e => {
    if (e.code === 'KeyW') moveForward = true;
    if (e.code === 'KeyS') moveBackward = true;
    if (e.code === 'KeyA') moveLeft = true;
    if (e.code === 'KeyD') moveRight = true;
});

document.addEventListener('keyup', e => {
    if (e.code === 'KeyW') moveForward = false;
    if (e.code === 'KeyS') moveBackward = false;
    if (e.code === 'KeyA') moveLeft = false;
    if (e.code === 'KeyD') moveRight = false;
});

const blockGeometry = new THREE.BoxGeometry(1, 1, 1);
const plantGeometry = new THREE.BufferGeometry();

plantGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array([
        -0.5,-0.5,-0.5, 0.5,0.5,0.5, -0.5,0.5,-0.5,
        -0.5,-0.5,-0.5, 0.5,-0.5,0.5, 0.5,0.5,0.5,
        -0.5,-0.5,0.5, 0.5,0.5,-0.5, -0.5,0.5,0.5,
        -0.5,-0.5,0.5, 0.5,-0.5,-0.5, 0.5,0.5,-0.5
    ]), 3)
);

plantGeometry.setAttribute(
    'uv',
    new THREE.BufferAttribute(new Float32Array([
        0,0, 1,1, 0,1,
        0,0, 1,0, 1,1,
        0,0, 1,1, 0,1,
        0,0, 1,0, 1,1
    ]), 2)
);

plantGeometry.computeVertexNormals();

const textureLoader = new THREE.TextureLoader();
const materialCache = {};
let activeMeshes = [];
let ground = null;

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

        const material = new THREE.MeshLambertMaterial({
            map: texture,
            transparent: true,
            alphaTest: isPlant ? 0.5 : 0.01,
            depthWrite: !isPlant,
            side: isPlant ? THREE.DoubleSide : THREE.FrontSide
        });

        material.color.setScalar(0.97);
        materialCache[blockID] = material;
    } else {
        materialCache[blockID] = new THREE.MeshLambertMaterial({
            color: new THREE.Color().setHex(Math.random() * 0xffffff)
        });
    }

    return materialCache[blockID];
}

function clearScene() {
    activeMeshes.forEach(mesh => {
        scene.remove(mesh);
        mesh.dispose();
    });
    activeMeshes = [];
}

function displaySchematic(schematic) {
    clearScene();

    document.getElementById('info-name').textContent = schematic.name;
    document.getElementById('info-size').textContent =
        schematic.size.join(' x ');

    if (!schematic.blocks.length) return;


    const blocksByType = {};

    for (const block of schematic.blocks) {
        if (!blocksByType[block.id]) blocksByType[block.id] = [];
        blocksByType[block.id].push(block);
    }

    const dummy = new THREE.Object3D();

    for (const id in blocksByType) {
        const blocks = blocksByType[id];
        const isPlant = PLANT_IDS.has(Number(id));
        const geometry = isPlant ? plantGeometry : blockGeometry;
        const material = getBlockMaterial(id);

        const mesh = new THREE.InstancedMesh(
            geometry,
            material,
            blocks.length
        );

        for (let i = 0; i < blocks.length; i++) {
            const b = blocks[i];

            dummy.position.set(b.x, b.y, b.z);
            dummy.updateMatrix();

            mesh.setMatrixAt(i, dummy.matrix);
        }

        mesh.instanceMatrix.needsUpdate = true;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        if (material.transparent) {
            mesh.renderOrder = isPlant ? 1 : 0;
        }

        scene.add(mesh);
        activeMeshes.push(mesh);
    }

    const sx = schematic.size[0];
    const sy = schematic.size[1];
    const sz = schematic.size[2];

    camera.position.set(
        sx / 2,
        sy + 5,
        sz + 10
    );

    camera.lookAt(
        sx / 2,
        sy / 2,
        sz / 2
    );

    sun.position.set(
        sx / 2 + 30,
        sy + 50,
        sz / 2 + 20
    );

    sun.shadow.camera.left = -Math.max(sx, sz);
    sun.shadow.camera.right = Math.max(sx, sz);
    sun.shadow.camera.top = Math.max(sx, sz);
    sun.shadow.camera.bottom = -Math.max(sx, sz);
    sun.shadow.camera.updateProjectionMatrix();
}

function parseBloxdschem(buffer) {
    const dataView = new DataView(buffer);
    let offset = 4;

    function readUnsignedVarint() {
        let result = 0;
        let shift = 0;

        while (true) {
            if (offset >= dataView.byteLength)
                throw new Error('Unexpected end of file.');

            const byte = dataView.getUint8(offset++);
            result |= (byte & 0x7f) << shift;

            if (!(byte & 0x80)) return result;
            shift += 7;
        }
    }

    function readSignedVarint() {
        const r = readUnsignedVarint();
        return (r >>> 1) ^ -(r & 1);
    }

    function readString() {
        const len = readSignedVarint();

        if (len < 0 || offset + len > dataView.byteLength)
            throw new Error('Invalid string length.');

        const text = new TextDecoder().decode(
            new Uint8Array(buffer, offset, len)
        );

        offset += len;
        return text;
    }

    function readBytes() {
        const len = readSignedVarint();

        if (len < 0 || offset + len > dataView.byteLength)
            throw new Error('Invalid byte array length.');

        const bytes = new Uint8Array(buffer, offset, len);
        offset += len;
        return bytes;
    }

    const name = readString();
    const x = readSignedVarint();
    const y = readSignedVarint();
    const z = readSignedVarint();

    const sizeX = readUnsignedVarint();
    const sizeY = readUnsignedVarint();
    const sizeZ = readUnsignedVarint();

    const chunks = [];
    const chunkCount = readSignedVarint();

    for (let i = 0; i < chunkCount; i++) {
        chunks.push({
            x: readSignedVarint(),
            y: readSignedVarint(),
            z: readSignedVarint(),
            blocks_raw: readBytes()
        });
    }

    const blocks = [];

    for (const chunk of chunks) {
        let blockOffset = 0;
        let blockIndex = 0;

        function readBlockVarint() {
            let result = 0;
            let shift = 0;

            while (true) {
                if (blockOffset >= chunk.blocks_raw.length) return -1;

                const byte = chunk.blocks_raw[blockOffset++];
                result |= (byte & 0x7f) << shift;

                if (!(byte & 0x80)) return result;
                shift += 7;
            }
        }

        while (blockOffset < chunk.blocks_raw.length) {
            const count = readBlockVarint();
            const blockID = readBlockVarint();

            if (count < 0 || blockID < 0) break;

            for (let i = 0; i < count; i++) {
                const localX = blockIndex % 32;
                const localY = Math.floor(blockIndex / 32) % 32;
                const localZ = Math.floor(blockIndex / 1024);

                const worldX = chunk.x * 32 + localZ;
                const worldY = chunk.y * 32 + localY;
                const worldZ = chunk.z * 32 + localX;

                if (
                    blockID !== 0 &&
                    blockID !== 219 &&
                    blockID !== 220 &&
                    blockID !== 221 &&
                    blockID !== 222
                ) {
                    blocks.push({
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

    return {
        name,
        pos: [x, y, z],
        size: [sizeX, sizeY, sizeZ],
        blocks
    };
}

document.getElementById('fileInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = ev => {
        try {
            displaySchematic(parseBloxdschem(ev.target.result));
        } catch (err) {
            console.error(err);
        }
    };

    reader.readAsArrayBuffer(file);
});

window.addEventListener('resize', () => {
    const div = document.querySelector('.main-content');
    const w = div.clientWidth;
    const h = div.clientHeight;

    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
});

const flySpeed = 400;
let prevTime = performance.now();

function animate() {
    requestAnimationFrame(animate);

    sky.position.copy(camera.position);

    const time = performance.now();
    const delta = Math.min((time - prevTime) / 1000, 0.05);

    if (controls.isLocked) {
        velocity.x -= velocity.x * 10 * delta;
        velocity.z -= velocity.z * 10 * delta;

        direction.z =
            Number(moveForward) - Number(moveBackward);

        direction.x =
            Number(moveRight) - Number(moveLeft);

        direction.normalize();

        camera.getWorldDirection(lookDirection);

        if (moveForward || moveBackward) {
            velocity.z -= direction.z * flySpeed * delta;
            camera.position.addScaledVector(
                lookDirection,
                -velocity.z * delta
            );
        }

        if (moveLeft || moveRight) {
            velocity.x -= direction.x * flySpeed * delta;

            rightVector
                .crossVectors(lookDirection, camera.up)
                .normalize();

            camera.position.addScaledVector(
                rightVector,
                -velocity.x * delta
            );
        }
    }

    prevTime = time;
    renderer.render(scene, camera);
}

animate();
