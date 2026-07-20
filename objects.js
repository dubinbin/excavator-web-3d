
import { Vector3 } from 'three';
import { createProceduralTerrain } from './terrain.js';

class OBJECT3D {
    constructor() {

    }

    async createAPong(front, back) {
        return [
            new THREE.MeshPhongMaterial({ color: 0xffffff }),
            new THREE.MeshPhongMaterial({ color: 0xffffff }),
            new THREE.MeshPhongMaterial({ color: 0xffffff }),
            new THREE.MeshPhongMaterial({ color: 0xffffff }),
            new THREE.MeshPhongMaterial({ map: await LOADER.textureLoader.loadAsync(front) }),
            new THREE.MeshPhongMaterial({ map: await LOADER.textureLoader.loadAsync(back) })
        ];
    }


    //######### GLB or ZIP model Loader ############
    loadGLBorZipGLB(directory, zipobj, execute, diffuseName, specularName, normalName) {
        if (typeof (diffuseName) == _UN) diffuseName = 'diffuse.png';
        if (typeof (specularName) == _UN) specularName = 'specular.png';
        if (typeof (normalName) == _UN) normalName = 'normal.png';
        function treatObject(glbobj) {
            if (diffuseName == null) { execute(glbobj); return; }
            var finalmaterial = new THREE.MeshPhongMaterial();
            function traversech(element) {
                if (finalmaterial.flatShading) finalmaterial.flatShading = true;
                if (typeof (element.traverse) != _UN)
                    element.traverse((child) => {
                        if (child.isMesh && child.material && child.material.isMaterial) {
                            child.material = finalmaterial;
                            child.castShadow = true;
                            child.receiveShadow = true;
                            //if(typeof(child.material.metalness)!=_UN)child.material.metalness=0;
                        }
                    });
            }
            var objeto;
            if (glbobj.isObject3D) {
                traversech(glbobj);
                objeto = glbobj;
            } else {
                glbobj.scene.children.forEach(element => {
                    traversech(element);
                });
                objeto = glbobj.scene.children[0];
            }
            var oldtexture;

            oldtexture = finalmaterial.map;
            function loadnormal() {
                LOADER.textureLoader.load(directory + normalName, (normal) => {
                    finalmaterial.normalMap = normal;
                    finalmaterial.normalMap.flipY = false;
                    finalmaterial.needsUpdate = true;
                    if (typeof (execute) == 'function') execute(objeto);
                }, () => { }, () => { //error normal
                    finalmaterial.normalMap = null;
                    finalmaterial.needsUpdate = true;
                    console.warn('normalMap not loaded', directory + normalName);
                    if (typeof (execute) == 'function') execute(objeto);
                });
            }
            function loadspecular() {
                LOADER.textureLoader.load(directory + specularName, (specular) => {
                    finalmaterial.specularMap = specular;
                    finalmaterial.specularMap.flipY = false;
                    finalmaterial.specularMap.needsUpdate = true;
                    loadnormal();
                }, () => { }, () => { //error specular
                    console.warn('specularMap not loaded', directory + specularName);
                    finalmaterial.specularMap = null;
                    finalmaterial.needsUpdate = true;
                    loadnormal();
                });
            }
            LOADER.textureLoader.load(directory + diffuseName, (material) => {
                finalmaterial.map = material;
                finalmaterial.map.flipY = false;
                finalmaterial.map.needsUpdate = true;
                loadspecular();
            }, () => { }, () => {//error difuse
                console.warn('difusseMap not loaded', directory + diffuseName);
                finalmaterial.map = oldtexture;
                loadspecular();
            });
        }
        function unzip(zip) {
            zip.filter(function (path, file) {
                var manager = new THREE.LoadingManager();
                manager.setURLModifier(function (url) {
                    console.log(url);
                    var file = zip.files[url];
                    console.log(zip.files[url]);
                    if (file) {
                        var blob = new Blob([file.asArrayBuffer()], { type: 'application/octet-stream' });
                        return URL.createObjectURL(blob);
                    }
                    return url;
                });
                var extension = file.name.split('.').pop().toLowerCase();
                switch (extension) {
                    case 'glb':
                        LOADER.glbloader.parse(file.asArrayBuffer(), '', function (result) {
                            treatObject(result);
                        });
                        break;
                }
            });
        }
        var oextension = "object";
        if (!zipobj.isObject3D) {
            oextension = zipobj.split('.').pop().toLowerCase();
        }
        if (oextension == 'object') {
            treatObject(zipobj);
        }
        if (oextension == 'glb') {
            document.getElementById('loadingItens').innerText = 'model: ' + zipobj;
            LOADER.glbloader.load(directory + zipobj, function (result) {
                treatObject(result);
            });
        }
        if (oextension == 'zip') {
            document.getElementById('loadingItens').innerText = 'model: ' + zipobj;
            JSZipUtils.getBinaryContent(directory + zipobj, async function (err, data) {
                if (err) {
                    throw err; // or handle err            
                }
                var myzip = new JSZip();
                unzip(myzip.load(data));
            });
        }
    }



    async create(value, execute) {
        var loadGLBZ = this.loadGLBorZipGLB;
        function threatMeshes(object, treatment) {
            object.traverse((child) => {
                if (child.isMesh) {
                    treatment(child);
                }
            });
        }
        var directory;
        var obj1, obj2, obj3, obj4, obj5;


        switch (value) {
            case 'ball': {//plane
                objects[value] = new THREE.Mesh(new THREE.SphereGeometry(3, 10, 10), materials[99]);
                objects[value].name = value + '_box';
                if (typeof (execute) == 'function') execute(objects[value]);
                break;
            }
            case 'plane': {//plane
                obj1 = await createProceduralTerrain();
                if (typeof (execute) == 'function') execute(obj1);
                break;
            }


            case 'galery2': {//wooden bed
                directory = './models/galery2/';
                //objects[value] = new THREE.Group();
                obj1 = new Promise(function (resolve) {//Entire Object    
                    loadGLBZ(directory, 'galery2.glb', (object) => {
                        object = object.scene;
                        //object.rotation.y = -Math.PI / 2;                         
                        object.scale.multiplyScalar(10);
                        //object.name = value + '_box';                        
                        if (typeof (execute) == 'function') execute(object);
                    }, 'gray', 'gray', 'gray');
                });
                break;
            }

            case 'scavator': {//construct scavator object and physics
                //https://pybullet.org/Bullet/phpBB3/viewtopic.php?t=2195
                //https://docs.google.com/document/d/10sXEhzFRSnvFcl3XxNGhnD4N2SedqwdAvK3dsihxVUA/edit
                //file:///C:/Users/iandi/OneDrive/Desktop/Bullet_User_Manual.pdf
                directory = './models/scavator/';
                //objects[value] = new THREE.Group();
                obj1 = new Promise(function (resolve) {//Entire Object    
                    loadGLBZ(directory, 'scavator.glb', async (object) => {
                        object = object.parent;

                        var styledMaterials = new Set();
                        threatMeshes(object, (mesh) => {
                            if (mesh.material && mesh.material.isMaterial) {
                                mesh.material.transparent = true;
                                mesh.material.opacity = iphysics.debug == true ? 0.6 : 0.72;
                                mesh.material.depthWrite = true;
                                if (!styledMaterials.has(mesh.material)) {
                                    mesh.material.color.set(0x35444f);
                                    if (mesh.material.specular) mesh.material.specular.set(0x65bce8);
                                    if (mesh.material.emissive) mesh.material.emissive.set(0x07141d);
                                    mesh.material.emissiveIntensity = 0.2;
                                    mesh.material.shininess = 70;
                                    mesh.material.needsUpdate = true;
                                    styledMaterials.add(mesh.material);
                                }
                            }
                        });
                        iphysics.material.visible = iphysics.debug;

                        //hide not used parts
                        object.getObjectByName('object_1020').parent.visible = false;
                        object.getObjectByName('object_1019').parent.visible = false;
                        object.getObjectByName('esteiras').visible = false;
                        object.getObjectByName('chain_part').visible = false;

                        var stPos = new Vector3(0, 20, 0); //default apper on air

                        //cabin hover
                        var cabinhover = object.getObjectByName('cabin_hover_ct');
                        var part = object.getObjectByName('cabin_hover');
                        cabinhover.add(part);
                        part.position.set(0, 0, 0);
                        cabinhover.position.set(stPos.x, stPos.y - 10, stPos.z);
                        scene.add(cabinhover);
                        await iphysics.createObj(cabinhover, 'hull', 'obj', null, 10);
                        cabinhover.material = iphysics.material;
                        cabinhover.contact.visible = iphysics.debug;
                        //cabinhover.userData.physicsBody.setAngularFactor(new Ammo.btVector3(0, 0, 0));

                        //cabin                        
                        var cabin = object.getObjectByName('cabin_2');
                        cabin.add(object.getObjectByName('cabin_1'));
                        var pist2 = object.getObjectByName('lr_pistons');
                        cabin.position.set(0 + stPos.x, stPos.y, stPos.z);
                        cabin.add(pist2);
                        pist2.position.set(-3.878847440683917, -3.471676716514206, -1.2142705870122326);
                        scene.add(cabin);
                        var fisicParts = [];
                        for (var i = 1; i < 5; i++) { //construct by all cabin contact blocks
                            part = object.getObjectByName('cabin_ct_' + i);
                            scene.add(part);
                            part.position.copy(cabin.position);
                            await iphysics.createObj(part, 'hull', 'obj', null, 0);
                            fisicParts.push(part);
                            part.material = iphysics.material;
                            part.contact.visible = iphysics.debug;
                        }
                        cabin = await iphysics.groupObj(cabin, fisicParts, 5);
                        cabin.userData.physicsBody.setAngularFactor(new Ammo.btVector3(0.5, 1, 0.5));
                        //cabin.userData.isFixed=true;

                        //inferior arm part
                        var arminferior = object.getObjectByName('arm_inferior_ct');
                        var part = object.getObjectByName('arm_inferior');
                        var part2 = object.getObjectByName('tp_piston');
                        var part3 = object.getObjectByName('lr_pistons_h');
                        arminferior.add(part);
                        arminferior.add(part2);
                        arminferior.add(part3);
                        part.position.set(0, 0, 0);
                        part2.position.set(-1.143090112453085, 5.9, 0.19260036945343018);
                        part3.position.set(2.7420277453233557, 3.089328584728371, -0.11181146099249714);
                        arminferior.position.set(-10 + stPos.x, 5 + stPos.y, stPos.z);
                        scene.add(arminferior);
                        await iphysics.createObj(arminferior, 'hull', 'obj', null, 2);
                        arminferior.material = iphysics.material;
                        arminferior.contact.visible = iphysics.debug;
                        //arminferior.userData.physicsBody.setAngularFactor(new Ammo.btVector3(0,0,1));

                        //superior arm part                        
                        object.getObjectByName('arm_superior_2').visible = false;
                        var armsuperior = object.getObjectByName('arm_superior_ct');
                        var part = object.getObjectByName('arm_superior_1');
                        var part2 = object.getObjectByName('tp_piston_h');
                        var part3 = object.getObjectByName('sup_pist');
                        armsuperior.add(part);
                        armsuperior.add(part2);
                        armsuperior.add(part3);
                        part.position.set(0, 0, 0);
                        part2.position.set(-0.8278854044231339, 11.527218562260904, 0.018478581008921652);
                        part3.position.set(-2.7214619443859225, 5.860681271623777, 0.0761628089470668);
                        armsuperior.position.set(-26 + stPos.x, stPos.y, stPos.z);
                        scene.add(armsuperior);
                        await iphysics.createObj(armsuperior, 'hull', 'obj', null, 1);
                        //armsuperior.userData.physicsBody.setAngularFactor(new Ammo.btVector3(0, 0, 1));
                        armsuperior.material = iphysics.material;
                        armsuperior.contact.visible = iphysics.debug;

                        //shovel                        
                        object.getObjectByName('pa_2').visible = false;
                        var shovel = object.getObjectByName('pa_1');
                        var part = object.getObjectByName('sup_piston_head');
                        var part2 = object.getObjectByName('sup_piston_head_base');
                        shovel.add(part);
                        part.add(part2);
                        part.position.set(-0.8060204353668166, -2.243579024126271, 0.028296908823893532);
                        shovel.position.set(-35 + stPos.x, stPos.y, stPos.z);
                        scene.add(shovel);
                        var fisicParts = [];
                        for (var i = 3; i < 9; i++) { //generate shovel physic walls
                            part = object.getObjectByName('pa_ct_' + i);
                            scene.add(part);
                            part.position.copy(shovel.position);
                            await iphysics.createObj(part, 'hull', 'obj', null, 0);
                            fisicParts.push(part);
                            part.material = iphysics.material;
                            part.contact.visible = iphysics.debug;
                        }
                        const collisionGroups = iphysics.collisionGroups;
                        // 内缩物理壳让可视铲斗先进入地面一小段，再由 terrain 承托。
                        await iphysics.groupObj(
                            shovel,
                            fisicParts,
                            0.6,
                            collisionGroups.SHOVEL,
                            collisionGroups.ALL,
                            0.87
                        );
                        window.EXCAVATOR_SHOVEL = shovel;

                        //atach shovel to superior arm                        
                        var shoveljt = await iphysics.createJoint(
                            shovel, { x: 0, y: 0, z: 0 },
                            armsuperior, { x: -0.2, y: -7, z: 0 },
                            'hinge');
                        shoveljt.setLimit(-1.6, 1, 0.9, 0.3, 0.3);
                        window.JOINTSHOVEL = shoveljt;

                        //joint superior and inferior arm
                        var joinarms = await iphysics.createJoint(
                            armsuperior, { x: 0, y: 7, z: 0 },
                            arminferior, { x: -16, y: 7, z: 0 },
                            'hinge');
                        joinarms.setLimit(-Math.PI / 2, 0.4, 0.9, 0.3, 1);
                        window.JOINTSUPERIOR = joinarms;

                        //joint arm to base                        
                        var jointarmbase = await iphysics.createJoint(
                            cabin, { x: 0, y: 0.5, z: -1.4 }, //atach cabin to inferior arm
                            arminferior, { x: 12.2, y: -9.15, z: 0 },
                            'hinge'
                        );
                        jointarmbase.setLimit(-0.9959, 0.3406, 0.9, 0.3, 1);
                        window.JOINTBASE = jointarmbase;

                        //joint cabin to hover                       
                        var jointcabin = await iphysics.createJoint(
                            cabin, { x: 2.5, y: -4.5, z: -0.5 }, //atach hover to cabin
                            cabinhover, { x: 1.6, y: 3, z: 0 },
                            'hinge',
                            { x: 0, y: 1, z: 0 }//relative rotation
                        );
                        jointcabin.setLimit(-3.2, 3.2, 1);
                        window.JOINTCABIN = jointcabin;

                        //var cube = await iphysics.createCubeTest(new THREE.Vector3(10, stPos.y - 20, 0));
                        //var cily=await iphysics.createCylinderTest(new THREE.Vector3(100, 10, 0),new THREE.Quaternion(1,0,0,1));                        

                        //WHEELLS
                        var whells = [];
                        var jwhells = [];
                        var wheelobj = object.getObjectByName('wheel');
                        wheelobj.parent.remove(wheelobj);
                        wheelobj.material = iphysics.material;
                        for (var i = 0; i < 4; i++) {
                            whells.push(wheelobj.clone());
                            whells[i].position.set(stPos.x + (i * 8) - 9, stPos.y - 10, stPos.z + 10);                            
                            scene.add(whells[i]);
                            var whelly=-1;
                            var whellmass=1;
                            if(i==0 || i==3)whelly=-0.6;else whellmass=5;
                            await iphysics.createObj(whells[i], 'hull', 'obj', null, whellmass);
                            var wjoint = await iphysics.createJoint(
                                cabinhover, { x: (i * 6.2) - 9, y: whelly, z: 7.5 }, //atach wheel to hover
                                whells[i], { x: 0, y: 0, z: 0 },
                                'hinge',
                                { x: 0, y: 0, z: -1 }//relative rotation
                            );
                            wjoint.setLimit(-3.2, 3.2, 1);
                            wjoint.enableAngularMotor(true, 0, 100);
                            jwhells.push(wjoint);
                        }
                        for (var i = 0; i < 4; i++) {
                            whells.push(wheelobj.clone());
                            whells[i + 4].position.set(stPos.x + (i * 8) - 9, stPos.y - 10, stPos.z - 10);
                            scene.add(whells[i + 4]);
                            var whelly=-1;
                            var whellmass=1;
                            if(i==0 || i==3)whelly=-0.6;else whellmass=5;
                            await iphysics.createObj(whells[i + 4], 'hull', 'obj', null, whellmass);
                            var wjoint = await iphysics.createJoint(
                                cabinhover, { x: (i * 6.2) - 9, y: whelly, z: -7.5 }, //atach wheel to hover
                                whells[i + 4], { x: 0, y: 0, z: 0 },
                                'hinge',
                                { x: 0, y: 0, z: -1 }//relative rotation
                            );
                            wjoint.setLimit(-3.2, 3.2, 1);
                            wjoint.enableAngularMotor(true, 0, 100);
                            jwhells.push(wjoint);
                        }
                        window.JOINTWHEELS = jwhells;

                        //atach mesh part
                        var eng_tr_esq = object.getObjectByName('eng_tr_esq');
                        var eng_tr_dir = object.getObjectByName('eng_tr_dir');
                        var eng_di_esq = object.getObjectByName('eng_di_esq');
                        var eng_di_dir = object.getObjectByName('eng_di_dir');
                        whells[0].add(eng_di_esq); eng_di_esq.position.z = -0.6;
                        whells[4].add(eng_di_dir); eng_di_dir.position.z = 0.6;
                        whells[3].add(eng_tr_dir); eng_tr_dir.position.z = -0.6;
                        whells[7].add(eng_tr_esq); eng_tr_esq.position.z = 0.6;

                        //CHAINS MESH ATACH
                        var chain_tooth = object.getObjectByName('chain_pike');
                        chain_tooth.material=new THREE.MeshPhongMaterial({
                            map:await LOADER.textureLoader.loadAsync(directory+'chain.jpg'),
                            color: 0x27343d,
                            specular: 0x65bce8,
                            shininess: 66,
                            transparent: true,
                            opacity: 0.7,
                            depthWrite: true
                        });
                        var chain_ghost;
                        for (var i = 0; i < 80; i++) {
                            //chain_ghost=new THREE.InstancedMesh(chain_tooth.geometry, chain_tooth.material, 1);
                            chain_ghost = chain_tooth.clone();
                            chain_ghost.name = 'chain_tooth_l' + i;
                            cabinhover.add(chain_ghost);
                        }
                        for (var i = 0; i < 80; i++) {
                            chain_ghost = chain_tooth.clone();
                            chain_ghost.name = 'chain_tooth_r' + i;
                            cabinhover.add(chain_ghost);
                        }
                        chain_tooth.parent.remove(chain_tooth);

                        //CHAINS PATH CREATION
                        var trianglesLine = [];
                        function pushtry(x, y, z) {
                            trianglesLine.push(new THREE.Vector3(x, y, z));
                        }
                        pushtry(-11, -2.9, 7.5);
                        pushtry(-12, -1, 7.5);//front point
                        pushtry(-11, 1.5, 7.5);
                        pushtry(0, 1.5, 7.5);//mid upper
                        pushtry(11.1, 1.5, 7.5);
                        pushtry(12.7, -1, 7.5);//hear point
                        pushtry(11.1, -3, 7.5);
                        pushtry(0, -3.5, 7.5);//mid lower  
                        var ls = 800;
                        var spline = new THREE.CatmullRomCurve3(trianglesLine);
                        spline.closed = true;
                        spline.curveType = 'centripetal';
                        spline.arcLengthDivisions=20;
                        const points = spline.getPoints(ls);//spline.getSpacedPoints(ls);                        
                        window.CHAINMESH_LEFT = {
                            first:true,
                            active: 0,
                            t: [], // tangents
                            n: [], // normals
                            b: [], // binormals                       
                            iShuttle: 0,
                            lss: ls + 1,
                            points: points
                        }
                        window.CHAINMESH_RIGHT = { //use data from LEFT
                            first:true,
                            active: 0,                     
                            iShuttle: 0,
                            lss: ls + 1,
                        }
                        //get angles
                        let tangent;
                        const normal = new THREE.Vector3();
                        const binormal = new THREE.Vector3(0, 1, 0);
                        for (let j = 0; j < ls + 1; j++) {                              
                            tangent = spline.getTangent(j / ls);
                            CHAINMESH_LEFT.t.push(tangent.clone());
                            normal.crossVectors(tangent, binormal);
                            normal.y = 0; // to prevent lateral slope 	
                            normal.normalize();
                            CHAINMESH_LEFT.n.push(normal.clone());
                            binormal.crossVectors(normal, tangent); // new binormal
                            CHAINMESH_LEFT.b.push(binormal.clone());
                        }


                        //ENABLE CONTROLS
                        JOINTSHOVEL.enableAngularMotor(true, 0, 100);
                        JOINTSUPERIOR.enableAngularMotor(true, 0, 100);
                        JOINTBASE.enableAngularMotor(true, 0, 300);
                        JOINTCABIN.enableAngularMotor(true, 0, 100);
                        //JOINTWHEELS array already created before

                        //object.name = value + '_box';                        
                        if (typeof (execute) == 'function') execute(object);
                    }, 'scavator.jpg', 'scavator.jpg', 'scavator.jpg');
                    //'gray.jpg', 'gray.jpg', 'gray.jpg');                    
                });
                break;
            }

            
            case 'stair': {//wooden bed
                directory = './models/stairs/';
                //objects[value] = new THREE.Group();
                obj1 = new Promise(function (resolve) {//Entire Object    
                    loadGLBZ(directory, 'stair.glb', (object) => {                                       
                        object=object.parent;
                        object.rotation.y = -Math.PI / 2;                         
                        //object.scale.multiplyScalar(0.5);
                        object.name = value + '_box';
                        object.getObjectByName('object_1').material.map.center.set( 0.8, 0.4);
                        object.getObjectByName('object_1').material.map.repeat.set( 0.8, 0.5);
                        object.getObjectByName('object_1').material.normalMap.center.copy(object.getObjectByName('object_1').material.map.center);
                        object.getObjectByName('object_1').material.specularMap.repeat.copy(object.getObjectByName('object_1').material.map.repeat);
                        

                        loadGLBZ(directory, object.getObjectByName('object_2'), (object2) => {                              
                            object2.material.map.rotation=Math.PI/2;
                            object2.material.normalMap.rotation=object2.material.map.rotation;
                            object2.material.specularMap.rotation=object2.material.map.rotation;
                        },'wood2_dif.jpg', 'wood2_spec.jpg', 'wood2_norm.jpg');
                        
                        if (typeof (execute) == 'function') execute(object);
                    }, 'wood_dif.jpg', 'wood_spec.jpg', 'wood_norm.jpg');
                });                
                break;
            }

            case 'shower_box': {//Red victorian Chair
                directory = './models/shower/';
                objects[value] = new THREE.Group();
                obj1 = new Promise(function (resolve) {//Entire Object    
                    loadGLBZ(directory, 'shower_box.glb', (object) => {                                       
                        object=object.parent;
                        object.rotation.y = Math.PI / 2;                         
                        object.scale.multiplyScalar(0.6); 
                        //object.position.y=-18;                       
                        object.name = value + '_box';

                        var part= new THREE.Group();
                        part.name='door';
                        var partmesh=object.getObjectByName('door_glass');                                                    
                        part.add(partmesh);
                        part.add(object.getObjectByName('in_pushers'));
                        part.add(object.getObjectByName('roles'));
                        object.add(part);
                        part.position.set( -22.069536952549946,0, 28.016509971790327);
                        part.op=new THREE.Vector3(0,-1.75,0);
                    
                        //part.autoReturn=true;

                        threatMeshes(object, (mesh) => {                            
                            if (mesh.material && mesh.material.isMaterial) {                        
                                if(mesh.name=='door_glass' || mesh.name=='glass'){                                                                        
                                    mesh.material=materials[92];                                    
                                }
                                if(mesh.name=='pushers' || mesh.name=='in_pushers'){                                                                        
                                    mesh.material=materials[90];                                    
                                }
                            }
                        });
                        

                        resolve(object);
                    }, 'gray.jpg', 'gray.jpg', 'gray.jpg');
                });
                Promise.all([obj1]).then(function (values) {
                    objects[value].add(values[0]);
                    if (typeof (execute) == 'function') execute(objects[value]);
                });
                break;
            }

            
        }
    }
}

export { OBJECT3D };
