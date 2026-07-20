import * as THREE from 'three';

const TERRAIN_SIZE = 800;
const TERRAIN_SEGMENTS = 160;
const GRID_CELL_SIZE = 5;
const GRID_HEIGHT_OFFSET = 0.12;

const HEIGHT_COLORS = [
    { height: -18, color: new THREE.Color(0xc9a8e8) }, // 地面以下：浅紫
    { height: 0, color: new THREE.Color(0x123c73) },   // 地表：深蓝
    { height: 8, color: new THREE.Color(0x76c8eb) },   // 低地：浅蓝
    { height: 17, color: new THREE.Color(0x91d39d) },  // 缓坡：浅绿
    { height: 28, color: new THREE.Color(0xe86f49) },  // 高地：橘红
    { height: 42, color: new THREE.Color(0xf5c84b) }   // 山顶：金黄
];

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0, edge1, value) {
    const x = clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return x * x * (3 - 2 * x);
}

function hash2D(x, y) {
    const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return value - Math.floor(value);
}

function valueNoise2D(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);

    const a = hash2D(ix, iy);
    const b = hash2D(ix + 1, iy);
    const c = hash2D(ix, iy + 1);
    const d = hash2D(ix + 1, iy + 1);
    const x1 = a + (b - a) * ux;
    const x2 = c + (d - c) * ux;
    return x1 + (x2 - x1) * uy;
}

function fbm(x, y, octaves) {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1;
    let totalAmplitude = 0;

    for (let i = 0; i < octaves; i++) {
        value += valueNoise2D(x * frequency, y * frequency) * amplitude;
        totalAmplitude += amplitude;
        frequency *= 2.03;
        amplitude *= 0.5;
    }

    return value / totalAmplitude;
}

function rawTerrainHeight(x, z) {
    const px = x * 0.0065;
    const pz = z * 0.0065;
    const warpX = (fbm(px + 17.3, pz - 9.2, 3) - 0.5) * 2;
    const warpZ = (fbm(px - 5.8, pz + 21.7, 3) - 0.5) * 2;
    const warpedX = px + warpX * 0.85;
    const warpedZ = pz + warpZ * 0.85;

    const broad = (fbm(warpedX, warpedZ, 5) - 0.5) * 2;
    const ridgeNoise = fbm(warpedX * 1.7 + 31.1, warpedZ * 1.7 - 14.6, 4);
    const ridge = Math.pow(1 - Math.abs(ridgeNoise * 2 - 1), 2);
    const detail = fbm(warpedX * 4.5, warpedZ * 4.5, 3) - 0.5;

    return broad * 30 + ridge * 17 + detail * 7 - 7;
}

const ORIGIN_HEIGHT = rawTerrainHeight(0, 0);

function getTerrainHeight(x, z) {
    const distanceFromWorkArea = Math.sqrt(x * x + z * z);
    const workAreaBlend = smoothstep(24, 62, distanceFromWorkArea);
    const height = (rawTerrainHeight(x, z) - ORIGIN_HEIGHT) * 1.35 * workAreaBlend;
    return clamp(height, HEIGHT_COLORS[0].height, HEIGHT_COLORS[HEIGHT_COLORS.length - 1].height);
}

function getHeightColor(height, target) {
    if (height <= HEIGHT_COLORS[0].height) {
        return target.copy(HEIGHT_COLORS[0].color);
    }

    for (let i = 1; i < HEIGHT_COLORS.length; i++) {
        const upper = HEIGHT_COLORS[i];
        if (height <= upper.height) {
            const lower = HEIGHT_COLORS[i - 1];
            const blend = smoothstep(lower.height, upper.height, height);
            return target.copy(lower.color).lerp(upper.color, blend);
        }
    }

    return target.copy(HEIGHT_COLORS[HEIGHT_COLORS.length - 1].color);
}

function createTerrainGeometry() {
    const geometry = new THREE.PlaneGeometry(
        TERRAIN_SIZE,
        TERRAIN_SIZE,
        TERRAIN_SEGMENTS,
        TERRAIN_SEGMENTS
    );
    geometry.rotateX(-Math.PI / 2);

    const positions = geometry.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    const color = new THREE.Color();

    for (let i = 0; i < positions.count; i++) {
        const height = getTerrainHeight(positions.getX(i), positions.getZ(i));
        positions.setY(i, height);
        getHeightColor(height, color);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }

    positions.needsUpdate = true;
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
}

function createTerrainGrid() {
    const vertices = [];
    const halfSize = TERRAIN_SIZE / 2;
    const sampleStep = TERRAIN_SIZE / TERRAIN_SEGMENTS;

    function addSegment(x1, z1, x2, z2) {
        vertices.push(
            x1, getTerrainHeight(x1, z1) + GRID_HEIGHT_OFFSET, z1,
            x2, getTerrainHeight(x2, z2) + GRID_HEIGHT_OFFSET, z2
        );
    }

    for (let x = -halfSize; x <= halfSize + 0.001; x += GRID_CELL_SIZE) {
        for (let z = -halfSize; z < halfSize; z += sampleStep) {
            addSegment(x, z, x, Math.min(z + sampleStep, halfSize));
        }
    }

    for (let z = -halfSize; z <= halfSize + 0.001; z += GRID_CELL_SIZE) {
        for (let x = -halfSize; x < halfSize; x += sampleStep) {
            addSegment(x, z, Math.min(x + sampleStep, halfSize), z);
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const material = new THREE.LineBasicMaterial({
        color: 0xf7f2ff,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
        toneMapped: false
    });
    const grid = new THREE.LineSegments(geometry, material);
    grid.name = 'terrain-grid';
    grid.renderOrder = 2;
    return grid;
}

async function createTerrainPhysics(terrain) {
    const geometry = terrain.geometry;
    const positions = geometry.attributes.position;
    const indices = geometry.index.array;
    const triangleMesh = new Ammo.btTriangleMesh();
    const vertexA = new Ammo.btVector3(0, 0, 0);
    const vertexB = new Ammo.btVector3(0, 0, 0);
    const vertexC = new Ammo.btVector3(0, 0, 0);

    function setAmmoVertex(vertex, index) {
        vertex.setValue(
            positions.getX(index),
            positions.getY(index),
            positions.getZ(index)
        );
    }

    for (let i = 0; i < indices.length; i += 3) {
        setAmmoVertex(vertexA, indices[i]);
        setAmmoVertex(vertexB, indices[i + 1]);
        setAmmoVertex(vertexC, indices[i + 2]);
        triangleMesh.addTriangle(vertexA, vertexB, vertexC, true);
    }

    Ammo.destroy(vertexA);
    Ammo.destroy(vertexB);
    Ammo.destroy(vertexC);

    const shape = new Ammo.btBvhTriangleMeshShape(triangleMesh, true, true);
    shape.setMargin(0.05);
    const collisionGroups = iphysics.collisionGroups;
    const body = await iphysics.createRigidBody(
        terrain,
        0,
        null,
        terrain.position,
        terrain.quaternion,
        shape,
        collisionGroups.TERRAIN,
        collisionGroups.ALL
    );
    body.setRollingFriction(iphysics.conf.frictionrwall);
    body.setFriction(iphysics.conf.frictionwall);
    body.setRestitution(0);

    // Bullet 需要这个三角网格在碰撞形状的整个生命周期内保持存活。
    terrain.userData.physicsTriangleMesh = triangleMesh;
}

async function createProceduralTerrain() {
    const material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.9,
        metalness: 0.02,
        side: THREE.DoubleSide
    });
    const terrain = new THREE.Mesh(createTerrainGeometry(), material);
    terrain.name = 'procedural-terrain';
    terrain.receiveShadow = true;
    terrain.add(createTerrainGrid());
    await createTerrainPhysics(terrain);
    return terrain;
}

export { createProceduralTerrain, getTerrainHeight };
