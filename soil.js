import * as THREE from 'three';
import { getTerrainHeight } from './terrain.js';

// 固定泡沫沙堆：全部粒子可见，只有铲斗附近的粒子会变成动态刚体。
const SOIL_CONFIG = Object.freeze({
    poolCenterX: -23,
    poolCenterZ: 15,
    poolRadiusX: 9,
    poolRadiusZ: 6,
    poolLayers: 50,
    moundHeight: 3.8,
    particleCount: 8000,
    particleSpacing: 0.5,
    verticalSpacing: 0.3,
    particleSize: 0.34,
    particleMass: 0.001,
    maxActiveBodies: 640,
    maxActivationsPerFrame: 120,

    // 在真正碰撞前先把局部静态泡沫松动为轻量动态刚体。
    softenDistance: 0.65,

    // 轻微铲取辅助：只拉动已经动态化、且几乎贴着铲斗的粒子。
    scoopAssistDistance: 3.0,
    scoopAssistStrength: 0.5,
    scoopAssistLift: 0.22,
    scoopAssistMaxSpeed: 0.9,
    scoopAssistMaxGroundHeight: 5,
});

const FOAM_COLORS = [
    new THREE.Color(0x00bfff),
    new THREE.Color(0x12d5ff),
    new THREE.Color(0x43e6ff),
    new THREE.Color(0x8bf4ff)
];

function seededRandom(seed) {
    const value = Math.sin(seed * 91.3458 + 17.137) * 47453.5453;
    return value - Math.floor(value);
}

function createFoamPositions() {
    const baseParticles = [];
    const surfaceParticles = [];
    const middleParticles = [];
    const width = SOIL_CONFIG.poolRadiusX * 2;
    const depth = SOIL_CONFIG.poolRadiusZ * 2;
    const columnsX = Math.floor(width / SOIL_CONFIG.particleSpacing) + 1;
    const columnsZ = Math.floor(depth / SOIL_CONFIG.particleSpacing) + 1;

    for (let iz = 0; iz < columnsZ; iz++) {
        const offsetZ = -SOIL_CONFIG.poolRadiusZ + depth * iz / (columnsZ - 1);
        const normalizedZ = Math.abs(offsetZ / SOIL_CONFIG.poolRadiusZ);

        for (let ix = 0; ix < columnsX; ix++) {
            const offsetX = -SOIL_CONFIG.poolRadiusX + width * ix / (columnsX - 1);
            const normalizedX = Math.abs(offsetX / SOIL_CONFIG.poolRadiusX);
            const edgeDistance = Math.max(normalizedX, normalizedZ);
            const moundProfile = Math.pow(Math.max(0, 1 - edgeDistance), 1.3);
            const columnHeight = moundProfile * SOIL_CONFIG.moundHeight;
            const levels = Math.min(
                SOIL_CONFIG.poolLayers,
                Math.max(1, Math.floor(columnHeight / SOIL_CONFIG.verticalSpacing) + 1)
            );
            const x = SOIL_CONFIG.poolCenterX + offsetX;
            const z = SOIL_CONFIG.poolCenterZ + offsetZ;
            const surfaceHeight = getTerrainHeight(x, z);
            const column = [];

            for (let level = 0; level < levels; level++) {
                const seed = iz * 100000 + ix * 1000 + level;
                const jitterY = seededRandom(seed + 3) * SOIL_CONFIG.particleSize * 0.06;
                column.push({
                    position: new THREE.Vector3(
                        x,
                        surfaceHeight + SOIL_CONFIG.particleSize * 0.52 +
                            level * SOIL_CONFIG.verticalSpacing + jitterY,
                        z
                    ),
                    seed,
                    instanceIndex: -1,
                    activated: false,
                    scale: null
                });
            }

            baseParticles.push(column[0]);
            if (column.length > 1) surfaceParticles.push(column[column.length - 1]);
            for (let level = 1; level < column.length - 1; level++) {
                middleParticles.push(column[level]);
            }
        }
    }

    // 优先保留每一列的底面和顶面，确保矩形边界与沙堆表面连续、密集。
    const particles = baseParticles.concat(surfaceParticles);
    const remaining = Math.max(0, SOIL_CONFIG.particleCount - particles.length);
    if (remaining >= middleParticles.length) {
        particles.push(...middleParticles);
    } else if (remaining > 0) {
        const sampleStep = middleParticles.length / remaining;
        for (let i = 0; i < remaining; i++) {
            particles.push(middleParticles[Math.floor((i + 0.5) * sampleStep)]);
        }
    }

    if (particles.length > SOIL_CONFIG.particleCount) {
        particles.length = SOIL_CONFIG.particleCount;
    }
    for (let i = 0; i < particles.length; i++) particles[i].instanceIndex = i;
    return particles;
}

class SoilSystem {
    constructor(scene, physics) {
        this.scene = scene;
        this.physics = physics;
        this.poolMesh = null;
        this.mesh = null;
        this.sources = [];
        this.spatialMap = new Map();
        this.spatialCellSize = 1;

        this.activeParticles = [];
        this.bodies = [];
        this.motionStates = [];
        this.recycleCursor = 0;
        this.collisionShape = null;
        this.inertia = null;

        this.transform = new Ammo.btTransform();
        this.spawnTransform = new Ammo.btTransform();
        this.spawnOrigin = new Ammo.btVector3(0, 0, 0);
        this.zeroVelocity = new Ammo.btVector3(0, 0, 0);
        this.assistVelocity = new Ammo.btVector3(0, 0, 0);

        this.dummy = new THREE.Object3D();
        this.shovel = null;
        this.shovelBounds = null;
        this.inverseShovelMatrix = new THREE.Matrix4();
        this.worldActivationBounds = new THREE.Box3();
        this.worldPosition = new THREE.Vector3();
        this.localPosition = new THREE.Vector3();
        this.scoopTargetLocal = new THREE.Vector3();
        this.scoopTargetWorld = new THREE.Vector3();
        this.assistDirection = new THREE.Vector3();
    }

    create() {
        this.sources = createFoamPositions();
        this.createFoamMeshes();
        this.createCollisionShape();
        this.connectShovel();
        return this.poolMesh;
    }

    createFoamMeshes() {
        const geometry = new THREE.DodecahedronGeometry(SOIL_CONFIG.particleSize * 0.5, 0);
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            emissive: 0x00aee6,
            emissiveIntensity: 0.52,
            roughness: 0.52,
            metalness: 0.06,
            flatShading: true
        });

        this.poolMesh = new THREE.InstancedMesh(geometry, material, this.sources.length);
        this.poolMesh.name = 'excavator-foam-mound';
        this.poolMesh.castShadow = false;
        this.poolMesh.receiveShadow = true;
        this.poolMesh.frustumCulled = false;
        this.poolMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        for (let i = 0; i < this.sources.length; i++) {
            const source = this.sources[i];
            source.scale = new THREE.Vector3(
                0.78 + seededRandom(source.seed + 5) * 0.4,
                0.7 + seededRandom(source.seed + 6) * 0.48,
                0.78 + seededRandom(source.seed + 7) * 0.4
            );

            this.dummy.position.copy(source.position);
            this.dummy.rotation.set(
                seededRandom(source.seed + 8) * 0.35,
                seededRandom(source.seed + 9) * Math.PI,
                seededRandom(source.seed + 10) * 0.35
            );
            this.dummy.scale.copy(source.scale);
            this.dummy.updateMatrix();
            this.poolMesh.setMatrixAt(i, this.dummy.matrix);
            this.poolMesh.setColorAt(i, FOAM_COLORS[i % FOAM_COLORS.length]);
            this.addSourceToSpatialMap(source);
        }
        this.poolMesh.instanceMatrix.needsUpdate = true;
        if (this.poolMesh.instanceColor) this.poolMesh.instanceColor.needsUpdate = true;

        this.mesh = new THREE.InstancedMesh(
            geometry,
            material,
            SOIL_CONFIG.maxActiveBodies
        );
        this.mesh.name = 'active-foam-particles';
        this.mesh.castShadow = false;
        this.mesh.receiveShadow = true;
        this.mesh.frustumCulled = false;
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        for (let i = 0; i < SOIL_CONFIG.maxActiveBodies; i++) {
            this.dummy.position.set(0, -1000, 0);
            this.dummy.rotation.set(0, 0, 0);
            this.dummy.scale.set(0, 0, 0);
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
            this.mesh.setColorAt(i, FOAM_COLORS[i % FOAM_COLORS.length]);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
        if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

        this.scene.add(this.poolMesh);
        this.scene.add(this.mesh);
    }

    addSourceToSpatialMap(source) {
        const ix = Math.floor(source.position.x / this.spatialCellSize);
        const iz = Math.floor(source.position.z / this.spatialCellSize);
        const key = ix + ':' + iz;
        if (!this.spatialMap.has(key)) this.spatialMap.set(key, []);
        this.spatialMap.get(key).push(source.instanceIndex);
    }

    createCollisionShape() {
        const collisionRadius = SOIL_CONFIG.particleSize * 0.44;
        this.collisionShape = new Ammo.btSphereShape(collisionRadius);
        this.collisionShape.setMargin(0.014);
        this.inertia = new Ammo.btVector3(0, 0, 0);
        this.collisionShape.calculateLocalInertia(SOIL_CONFIG.particleMass, this.inertia);
    }

    connectShovel() {
        this.shovel = window.EXCAVATOR_SHOVEL || null;
        if (!this.shovel || !this.shovel.geometry) return;

        this.shovel.geometry.computeBoundingBox();
        this.shovelBounds = this.shovel.geometry.boundingBox.clone();
        this.shovelBounds.getCenter(this.scoopTargetLocal);
        this.scoopTargetLocal.y += SOIL_CONFIG.particleSize * 0.7;
    }

    update() {
        if (!this.poolMesh || !this.mesh) return;
        const shovelReady = this.updateShovelFrame();
        if (shovelReady) this.activateNearbyFoam();

        let matrixChanged = false;
        for (let i = 0; i < this.activeParticles.length; i++) {
            const particle = this.activeParticles[i];
            const motionState = particle.body.getMotionState();
            if (!motionState) continue;

            motionState.getWorldTransform(this.transform);
            const position = this.transform.getOrigin();
            const rotation = this.transform.getRotation();
            this.worldPosition.set(position.x(), position.y(), position.z());

            const terrainHeight = getTerrainHeight(this.worldPosition.x, this.worldPosition.z);
            if (this.worldPosition.y < terrainHeight - SOIL_CONFIG.particleSize * 0.14) {
                this.recoverParticle(particle.body, motionState, terrainHeight);
                motionState.getWorldTransform(this.transform);
            } else if (
                shovelReady &&
                this.worldPosition.y - terrainHeight < SOIL_CONFIG.scoopAssistMaxGroundHeight
            ) {
                this.applyScoopAssist(particle.body);
            }

            const renderPosition = this.transform.getOrigin();
            const renderRotation = this.transform.getRotation();
            this.dummy.position.set(renderPosition.x(), renderPosition.y(), renderPosition.z());
            this.dummy.quaternion.set(
                renderRotation.x(),
                renderRotation.y(),
                renderRotation.z(),
                renderRotation.w()
            );
            this.dummy.scale.copy(particle.scale);
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(particle.instanceIndex, this.dummy.matrix);
            matrixChanged = true;
        }

        if (matrixChanged) this.mesh.instanceMatrix.needsUpdate = true;
    }

    updateShovelFrame() {
        if (!this.shovel || !this.shovelBounds) return false;

        this.shovel.updateMatrixWorld(true);
        this.inverseShovelMatrix.copy(this.shovel.matrixWorld).invert();
        this.scoopTargetWorld.copy(this.scoopTargetLocal).applyMatrix4(this.shovel.matrixWorld);
        this.worldActivationBounds.copy(this.shovelBounds).applyMatrix4(this.shovel.matrixWorld);
        this.worldActivationBounds.expandByScalar(SOIL_CONFIG.softenDistance);
        return true;
    }

    applyScoopAssist(body) {
        this.localPosition.copy(this.worldPosition).applyMatrix4(this.inverseShovelMatrix);
        const distance = this.shovelBounds.distanceToPoint(this.localPosition);
        if (distance > SOIL_CONFIG.scoopAssistDistance) return;

        this.assistDirection.subVectors(this.scoopTargetWorld, this.worldPosition);
        const targetDistance = this.assistDirection.length();
        if (targetDistance < 0.001) return;

        const proximity = 1 - distance / SOIL_CONFIG.scoopAssistDistance;
        const targetSpeed = Math.min(
            SOIL_CONFIG.scoopAssistMaxSpeed,
            targetDistance * 0.7
        ) * (0.45 + proximity * 0.55);
        this.assistDirection.multiplyScalar(targetSpeed / targetDistance);
        this.assistDirection.y += SOIL_CONFIG.scoopAssistLift * proximity;

        const currentVelocity = body.getLinearVelocity();
        const blend = SOIL_CONFIG.scoopAssistStrength * proximity;
        this.assistVelocity.setValue(
            currentVelocity.x() + (this.assistDirection.x - currentVelocity.x()) * blend,
            currentVelocity.y() + (this.assistDirection.y - currentVelocity.y()) * blend,
            currentVelocity.z() + (this.assistDirection.z - currentVelocity.z()) * blend
        );
        body.setLinearVelocity(this.assistVelocity);
        body.activate(true);
    }

    activateNearbyFoam() {
        const minX = Math.floor(this.worldActivationBounds.min.x / this.spatialCellSize);
        const maxX = Math.floor(this.worldActivationBounds.max.x / this.spatialCellSize);
        const minZ = Math.floor(this.worldActivationBounds.min.z / this.spatialCellSize);
        const maxZ = Math.floor(this.worldActivationBounds.max.z / this.spatialCellSize);
        const candidates = [];

        for (let ix = minX; ix <= maxX; ix++) {
            for (let iz = minZ; iz <= maxZ; iz++) {
                const indices = this.spatialMap.get(ix + ':' + iz);
                if (!indices) continue;

                for (let i = 0; i < indices.length; i++) {
                    const source = this.sources[indices[i]];
                    if (source.activated) continue;

                    this.localPosition.copy(source.position).applyMatrix4(this.inverseShovelMatrix);
                    const distance = this.shovelBounds.distanceToPoint(this.localPosition);
                    if (distance > SOIL_CONFIG.softenDistance) continue;
                    candidates.push({ source, distance });
                }
            }
        }

        candidates.sort((a, b) => a.distance - b.distance);

        let activated = 0;
        for (let i = 0; i < candidates.length; i++) {
            const particle = this.acquireActiveParticle();
            if (!particle) break;
            this.activateSource(candidates[i].source, particle);
            activated++;
            if (activated >= SOIL_CONFIG.maxActivationsPerFrame) break;
        }
        if (activated > 0) this.poolMesh.instanceMatrix.needsUpdate = true;
    }

    acquireActiveParticle() {
        if (this.activeParticles.length < SOIL_CONFIG.maxActiveBodies) {
            return this.createActiveParticle(this.activeParticles.length);
        }

        for (let offset = 0; offset < this.activeParticles.length; offset++) {
            const index = (this.recycleCursor + offset) % this.activeParticles.length;
            const particle = this.activeParticles[index];
            if (particle.body.isActive()) continue;
            this.recycleCursor = (index + 1) % this.activeParticles.length;
            return particle;
        }
        return null;
    }

    createActiveParticle(instanceIndex) {
        this.spawnTransform.setIdentity();
        this.spawnOrigin.setValue(0, -1000, 0);
        this.spawnTransform.setOrigin(this.spawnOrigin);

        const motionState = new Ammo.btDefaultMotionState(this.spawnTransform);
        const bodyInfo = new Ammo.btRigidBodyConstructionInfo(
            SOIL_CONFIG.particleMass,
            motionState,
            this.collisionShape,
            this.inertia
        );
        const body = new Ammo.btRigidBody(bodyInfo);
        const collisionRadius = SOIL_CONFIG.particleSize * 0.44;
        body.setFriction(0.38);
        body.setRollingFriction(0.08);
        body.setRestitution(0.06);
        body.setDamping(0.06, 0.36);
        body.setSleepingThresholds(0.14, 0.2);
        body.setCcdMotionThreshold(SOIL_CONFIG.particleSize * 0.5);
        body.setCcdSweptSphereRadius(collisionRadius * 0.72);
        body.setUserIndex(instanceIndex + 1);
        this.physics.physicsWorld.addRigidBody(body);

        const particle = {
            body,
            motionState,
            instanceIndex,
            scale: new THREE.Vector3(1, 1, 1)
        };
        this.activeParticles.push(particle);
        this.bodies.push(body);
        this.motionStates.push(motionState);
        Ammo.destroy(bodyInfo);
        return particle;
    }

    activateSource(source, particle) {
        source.activated = true;
        this.dummy.position.copy(source.position);
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.scale.set(0, 0, 0);
        this.dummy.updateMatrix();
        this.poolMesh.setMatrixAt(source.instanceIndex, this.dummy.matrix);

        this.spawnTransform.setIdentity();
        this.spawnOrigin.setValue(source.position.x, source.position.y, source.position.z);
        this.spawnTransform.setOrigin(this.spawnOrigin);
        particle.body.setWorldTransform(this.spawnTransform);
        particle.motionState.setWorldTransform(this.spawnTransform);
        particle.body.setLinearVelocity(this.zeroVelocity);
        particle.body.setAngularVelocity(this.zeroVelocity);
        particle.body.clearForces();
        particle.body.activate(true);
        particle.scale.copy(source.scale);
        this.mesh.setColorAt(
            particle.instanceIndex,
            FOAM_COLORS[source.instanceIndex % FOAM_COLORS.length]
        );
        if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }

    recoverParticle(body, motionState, terrainHeight) {
        const position = this.transform.getOrigin();
        const rotation = this.transform.getRotation();
        position.setValue(
            this.worldPosition.x,
            terrainHeight + SOIL_CONFIG.particleSize * 0.54,
            this.worldPosition.z
        );
        rotation.setValue(0, 0, 0, 1);
        this.transform.setOrigin(position);
        this.transform.setRotation(rotation);
        body.setWorldTransform(this.transform);
        motionState.setWorldTransform(this.transform);
        body.setLinearVelocity(this.zeroVelocity);
        body.setAngularVelocity(this.zeroVelocity);
        body.activate(true);
    }

    dispose() {
        for (let i = 0; i < this.bodies.length; i++) {
            this.physics.physicsWorld.removeRigidBody(this.bodies[i]);
            Ammo.destroy(this.bodies[i]);
            Ammo.destroy(this.motionStates[i]);
        }

        this.bodies.length = 0;
        this.motionStates.length = 0;
        this.activeParticles.length = 0;
        this.sources.length = 0;
        this.spatialMap.clear();

        if (this.collisionShape) Ammo.destroy(this.collisionShape);
        if (this.inertia) Ammo.destroy(this.inertia);
        if (this.transform) Ammo.destroy(this.transform);
        if (this.spawnTransform) Ammo.destroy(this.spawnTransform);
        if (this.spawnOrigin) Ammo.destroy(this.spawnOrigin);
        if (this.zeroVelocity) Ammo.destroy(this.zeroVelocity);
        if (this.assistVelocity) Ammo.destroy(this.assistVelocity);
        this.collisionShape = null;
        this.inertia = null;
        this.transform = null;
        this.spawnTransform = null;
        this.spawnOrigin = null;
        this.zeroVelocity = null;
        this.assistVelocity = null;

        if (this.poolMesh && this.poolMesh.parent) this.poolMesh.parent.remove(this.poolMesh);
        if (this.mesh && this.mesh.parent) this.mesh.parent.remove(this.mesh);
        if (this.poolMesh) {
            this.poolMesh.geometry.dispose();
            this.poolMesh.material.dispose();
        }
        this.poolMesh = null;
        this.mesh = null;
    }
}

export { SoilSystem, SOIL_CONFIG };
