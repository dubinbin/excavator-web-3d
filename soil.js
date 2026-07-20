import * as THREE from 'three';
import { getTerrainHeight } from './terrain.js';

// 地形挖掘采用状态判定，不再创建或吸附泡沫粒子。
// 斗底与 terrain 的交叉面积达到阈值后装土；斗口朝下后卸土。
const SOIL_CONFIG = Object.freeze({
    probeColumnsX: 10,
    probeColumnsZ: 8,
    minimumPenetrationDepth: 0.22,
    fullPenetrationDepth: 0.95,
    minimumDigArea: 9,
    rearmArea: 1.8,
    loadConfirmationFrames: 3,
    dumpOpeningY: 0.45,
    dumpConfirmationFrames: 3,
    visualFillLerp: 0.28,
});

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0, edge1, value) {
    const x = clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return x * x * (3 - 2 * x);
}

class SoilSystem {
    constructor(scene, physics) {
        this.scene = scene;
        this.physics = physics;
        this.shovel = null;
        this.terrain = null;
        this.shovelBounds = null;
        this.bucketInteriorBounds = null;
        this.soilMesh = null;

        this.digProbePoints = [];
        this.probeCellArea = 0;
        this.probeWorldPosition = new THREE.Vector3();
        this.bucketOpeningDirection = new THREE.Vector3();
        this.baseSoilScale = new THREE.Vector3();

        this.loaded = false;
        this.digArmed = true;
        this.contactArea = 0;
        this.maxPenetration = 0;
        this.loadFrameCount = 0;
        this.dumpFrameCount = 0;
        this.visualFill = 0;
    }

    create() {
        this.connectSceneObjects();
        if (!this.shovel || !this.terrain) {
            console.warn('Terrain excavation requires both the shovel and procedural terrain.');
            return null;
        }

        this.createDigProbeGrid();
        this.createSoilVisual();
        return this.soilMesh;
    }

    connectSceneObjects() {
        this.shovel = window.EXCAVATOR_SHOVEL || null;
        this.terrain = this.scene.getObjectByName('procedural-terrain') || null;
        if (!this.shovel || !this.shovel.geometry) return;

        this.shovel.geometry.computeBoundingBox();
        this.shovelBounds = this.shovel.geometry.boundingBox.clone();
        const size = new THREE.Vector3();
        this.shovelBounds.getSize(size);

        // pa_1 的斗齿朝局部 +X、斗口朝局部 +Y。范围缩到六块碰撞板内侧，
        // 只用来摆放装载后的土，不参与物理吸附。
        this.bucketInteriorBounds = this.shovelBounds.clone();
        this.bucketInteriorBounds.min.x += size.x * 0.2;
        this.bucketInteriorBounds.max.x -= size.x * 0.31;
        this.bucketInteriorBounds.min.y += size.y * 0.08;
        this.bucketInteriorBounds.max.y -= size.y * 0.08;
        this.bucketInteriorBounds.min.z += size.z * 0.14;
        this.bucketInteriorBounds.max.z -= size.z * 0.14;
    }

    createDigProbeGrid() {
        const size = new THREE.Vector3();
        this.shovelBounds.getSize(size);

        const minX = this.shovelBounds.min.x + size.x * 0.2;
        const maxX = this.shovelBounds.max.x - size.x * 0.04;
        const minZ = this.shovelBounds.min.z + size.z * 0.14;
        const maxZ = this.shovelBounds.max.z - size.z * 0.14;
        const cellWidth = (maxX - minX) / SOIL_CONFIG.probeColumnsX;
        const cellDepth = (maxZ - minZ) / SOIL_CONFIG.probeColumnsZ;
        const backFloorY = this.shovelBounds.min.y + size.y * 0.12;
        const cuttingLipY = this.shovelBounds.min.y + size.y * 0.63;

        this.probeCellArea = cellWidth * cellDepth;
        this.digProbePoints.length = 0;

        for (let ix = 0; ix < SOIL_CONFIG.probeColumnsX; ix++) {
            const xRatio = (ix + 0.5) / SOIL_CONFIG.probeColumnsX;
            const localX = minX + (maxX - minX) * xRatio;

            // 斗底前 62% 接近平面，之后沿前壁抬升到斗齿，近似 pa_ct_4/5/8。
            const lipRatio = smoothstep(0.62, 1, xRatio);
            const localY = backFloorY + (cuttingLipY - backFloorY) * lipRatio;

            for (let iz = 0; iz < SOIL_CONFIG.probeColumnsZ; iz++) {
                const zRatio = (iz + 0.5) / SOIL_CONFIG.probeColumnsZ;
                const localZ = minZ + (maxZ - minZ) * zRatio;
                this.digProbePoints.push(new THREE.Vector3(localX, localY, localZ));
            }
        }
    }

    createSoilVisual() {
        const roundedRectangle = new THREE.Shape();
        const halfWidth = 1;
        const halfDepth = 1;
        const cornerRadius = 0.18;
        roundedRectangle.moveTo(-halfWidth + cornerRadius, -halfDepth);
        roundedRectangle.lineTo(halfWidth - cornerRadius, -halfDepth);
        roundedRectangle.quadraticCurveTo(halfWidth, -halfDepth, halfWidth, -halfDepth + cornerRadius);
        roundedRectangle.lineTo(halfWidth, halfDepth - cornerRadius);
        roundedRectangle.quadraticCurveTo(halfWidth, halfDepth, halfWidth - cornerRadius, halfDepth);
        roundedRectangle.lineTo(-halfWidth + cornerRadius, halfDepth);
        roundedRectangle.quadraticCurveTo(-halfWidth, halfDepth, -halfWidth, halfDepth - cornerRadius);
        roundedRectangle.lineTo(-halfWidth, -halfDepth + cornerRadius);
        roundedRectangle.quadraticCurveTo(-halfWidth, -halfDepth, -halfWidth + cornerRadius, -halfDepth);

        const geometry = new THREE.ExtrudeGeometry(roundedRectangle, {
            depth: 0.7,
            steps: 1,
            curveSegments: 5,
            bevelEnabled: true,
            bevelThickness: 0.1,
            bevelSize: 0.1,
            bevelSegments: 3
        });
        geometry.rotateX(-Math.PI * 0.5);
        geometry.computeBoundingBox();

        const positions = geometry.attributes.position;
        const originalBounds = geometry.boundingBox;
        const originalHeight = originalBounds.max.y - originalBounds.min.y;

        // 保留矩形轮廓，只把上半部轻微收边并做成不完全平整的料堆顶面。
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            const z = positions.getZ(i);
            const topWeight = smoothstep(
                originalBounds.min.y + originalHeight * 0.48,
                originalBounds.max.y,
                y
            );
            const edgeDistance = Math.max(
                Math.abs(x) / (halfWidth + 0.1),
                Math.abs(z) / (halfDepth + 0.1)
            );
            const crown = Math.max(0, 1 - edgeDistance) * 0.12 * topWeight;
            const noise = Math.sin(i * 12.9898 + x * 19.19 + z * 7.13) *
                0.028 * topWeight;
            const taper = 1 - topWeight * 0.045;
            positions.setXYZ(
                i,
                x * taper,
                y + crown + noise,
                z * taper
            );
        }
        positions.needsUpdate = true;
        geometry.computeVertexNormals();
        geometry.computeBoundingBox();
        geometry.translate(0, -geometry.boundingBox.min.y, 0);
        geometry.computeBoundingBox();

        const material = new THREE.MeshStandardMaterial({
            color: 0x8b5a32,
            roughness: 0.96,
            metalness: 0,
            side: THREE.DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1
        });

        const interiorSize = new THREE.Vector3();
        const interiorCenter = new THREE.Vector3();
        const geometrySize = new THREE.Vector3();
        this.bucketInteriorBounds.getSize(interiorSize);
        this.bucketInteriorBounds.getCenter(interiorCenter);
        geometry.boundingBox.getSize(geometrySize);

        this.baseSoilScale.set(
            interiorSize.x * 0.86 / geometrySize.x,
            interiorSize.y * 0.27 / geometrySize.y,
            interiorSize.z * 0.88 / geometrySize.z
        );
        this.soilMesh = new THREE.Mesh(geometry, material);
        this.soilMesh.name = 'bucket-excavated-soil';
        this.soilMesh.position.set(
            interiorCenter.x,
            this.bucketInteriorBounds.min.y + interiorSize.y * 0.37,
            interiorCenter.z
        );
        this.soilMesh.scale.set(this.baseSoilScale.x * 0.72, 0.001, this.baseSoilScale.z * 0.72);
        this.soilMesh.visible = false;
        this.soilMesh.castShadow = true;
        this.soilMesh.receiveShadow = true;
        this.soilMesh.renderOrder = 1;
        this.shovel.add(this.soilMesh);
    }

    update() {
        if (!this.shovel || !this.terrain || !this.soilMesh) return;

        this.shovel.updateMatrixWorld(true);
        this.bucketOpeningDirection
            .set(0, 1, 0)
            .transformDirection(this.shovel.matrixWorld);
        this.contactArea = this.estimateTerrainIntersectionArea();

        if (this.contactArea <= SOIL_CONFIG.rearmArea) {
            this.digArmed = true;
        }

        const dumping = this.bucketOpeningDirection.y <= SOIL_CONFIG.dumpOpeningY;
        if (this.loaded) {
            this.loadFrameCount = 0;
            this.dumpFrameCount = dumping ? this.dumpFrameCount + 1 : 0;
            if (this.dumpFrameCount >= SOIL_CONFIG.dumpConfirmationFrames) {
                this.unloadSoil();
            }
        } else {
            this.dumpFrameCount = 0;
            const canLoad = this.digArmed && !dumping &&
                this.contactArea >= SOIL_CONFIG.minimumDigArea;
            this.loadFrameCount = canLoad ? this.loadFrameCount + 1 : 0;
            if (this.loadFrameCount >= SOIL_CONFIG.loadConfirmationFrames) {
                this.loadSoil();
            }
        }

        this.updateSoilVisual();
    }

    estimateTerrainIntersectionArea() {
        let area = 0;
        let maximumPenetration = 0;

        for (let i = 0; i < this.digProbePoints.length; i++) {
            this.probeWorldPosition
                .copy(this.digProbePoints[i])
                .applyMatrix4(this.shovel.matrixWorld);
            const terrainHeight = getTerrainHeight(
                this.probeWorldPosition.x,
                this.probeWorldPosition.z
            );
            const penetration = terrainHeight - this.probeWorldPosition.y;
            maximumPenetration = Math.max(maximumPenetration, penetration);

            if (penetration <= SOIL_CONFIG.minimumPenetrationDepth) continue;
            const coverage = smoothstep(
                SOIL_CONFIG.minimumPenetrationDepth,
                SOIL_CONFIG.fullPenetrationDepth,
                penetration
            );
            area += this.probeCellArea * coverage;
        }

        this.maxPenetration = maximumPenetration;
        return area;
    }

    loadSoil() {
        this.loaded = true;
        this.digArmed = false;
        this.loadFrameCount = 0;
        this.dumpFrameCount = 0;
        this.soilMesh.visible = true;
    }

    unloadSoil() {
        this.loaded = false;
        this.loadFrameCount = 0;
        this.dumpFrameCount = 0;
    }

    updateSoilVisual() {
        const targetFill = this.loaded ? 1 : 0;
        this.visualFill += (targetFill - this.visualFill) * SOIL_CONFIG.visualFillLerp;
        if (Math.abs(targetFill - this.visualFill) < 0.002) {
            this.visualFill = targetFill;
        }

        if (this.visualFill <= 0.002) {
            this.soilMesh.visible = false;
            return;
        }

        this.soilMesh.visible = true;
        const radialFill = 0.72 + Math.sqrt(this.visualFill) * 0.28;
        this.soilMesh.scale.set(
            this.baseSoilScale.x * radialFill,
            this.baseSoilScale.y * Math.max(0.001, this.visualFill),
            this.baseSoilScale.z * radialFill
        );
    }

    dispose() {
        if (this.soilMesh) {
            if (this.soilMesh.parent) this.soilMesh.parent.remove(this.soilMesh);
            this.soilMesh.geometry.dispose();
            this.soilMesh.material.dispose();
        }

        this.soilMesh = null;
        this.shovel = null;
        this.terrain = null;
        this.shovelBounds = null;
        this.bucketInteriorBounds = null;
        this.digProbePoints.length = 0;
    }
}

export { SoilSystem, SOIL_CONFIG };
