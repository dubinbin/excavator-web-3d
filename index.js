
import * as THREE from 'three';
import { IRENDER } from './render.js'; //PostProcess Renders
import * as EXTRA from './build/extra.js';
import { ISCENE } from './scenes.js';
import { OBJECT3D } from './objects.js';
import { ANIMATE } from './animate.js';
import { ICAMERA } from './camera.js';
import { IPHYSICS } from './physics.js';
//import { IHUD } from './i_hud.js';
//import { PLAYER } from './i_player.js';
//import { IAI } from './i_ai.js';


//######### LOADERS ############
var textureLD=new THREE.TextureLoader();
window.LOADER = {
    audioLoader: new THREE.AudioLoader(),
    textureLoader:{
        load:async (url,execute)=>{
            url=await getImage(url);
            return textureLD.load(url,execute);
        },
        loadAsync:async (url)=>{
            url=await getImage(url);
            return textureLD.loadAsync(url);
        }
    },   
    //glbexporter: new GLTFExporter(),
    glbloader: new THREE.GLTFLoader(),
    fileLoader: new THREE.FileLoader(),
    zip: JSZip,
}
window.CSS2D = {
    Renderer: THREE.CSS2DRenderer,
    Object: THREE.CSS2DObject
}

const dracoLoader = new THREE.DRACOLoader();
dracoLoader.setDecoderPath('./build/jsm/libs/draco/');
LOADER.glbloader.setDRACOLoader(dracoLoader);

//######### GLOBAL VARIABLES ############
window.THREE = THREE;
window.scene = null;
window.renderer = null;
window.renderer2 = null; //css render
window.camera = null;
window.control = null;
window.MONITORLIGHT = null;
window.materials = [];
window.objects = [];
window.audios = [];
window.objectbyNames = {};
window.bublesUpdate = [];
window.AUDIOlistener = null;
window.now = Date.now();
window.iphysics=null;
//window.ai = new IAI();
var timer;
var transformCtl;
window.iscene = new ISCENE();
window.ianimate = new ANIMATE();
var irender = new IRENDER();
var iobj3D = new OBJECT3D();
var rayintersects = [], raycaster = new THREE.Raycaster(), raycasterDisabled = false;
var waitforaudio, waitforaudiotimes = 0;
const start = Date.now();
const clock = new THREE.Clock();


window.getOByName = function (oname, objmain) {
    if (typeof (objectbyNames[oname]) != _UN) {
        return objectbyNames[oname];
    } else {
        if (typeof (objmain) == _UN) objmain = scene;
        if (typeof (objmain.getObjectByName(oname)) != _UN) {
            objectbyNames[oname] = objmain.getObjectByName(oname)
            return objectbyNames[oname];
        } else return;
    }
}

window.getImage = async (fileSRC) => {
    return fileSRC;
    //indexedDB.deleteDatabase('pack');   
    var imageVersion='13/03/24-20:00'; 
    var filename=fileSRC;
    if(filename.startsWith("./")==true)filename=filename.slice(2);   
    if(filename.startsWith("models/")==true)filename='images/'+filename;
    const blobToImage = (blob) => {
        return new Promise(resolve => {
            const url = URL.createObjectURL(blob)
            resolve(url);/*let img = new Image()img.onload = () => {URL.revokeObjectURL(url)resolve(img)}img.src = url*/
        })
    }
    async function getiim( filename) {
        return new Promise(function (resolve) {
            const request = indexedDB.open("pack");
            var status = 0;

            request.onupgradeneeded = function () {
                status = 1;
                const db = request.result;
                const store = db.createObjectStore("images", { keyPath: 'id', autoIncrement: true });
                const fname = store.createIndex("by_name", "name", { unique: true });
                const fdata = store.createIndex("by_data", "data");
                //store.put({ name: "Quarry Memories", data: 123456 });
                JSZipUtils.getBinaryContent('./images.zip', async function (err, data) {
                    if (err) { throw err; }
                    var myzip = new JSZip();
                    return populate(myzip.load(data));
                });
            };
            request.onsuccess = function () {
                if (status == 1) return; //populating  
                const db = request.result;             
                const tx = db.transaction("images", "readonly");
                const store = tx.objectStore("images");
                const index = store.index("by_name");
                const request2 = index.get('images/version.txt');                          
                request2.onsuccess = function () {
                    const matching = request2.result;
                    if (typeof(matching)==_UN || matching.data !=imageVersion ) {                                              
                        indexedDB.deleteDatabase('pack');alert('Reload Page to update Image Database');
                        return;
                    } else {                        
                        const request3 = index.get(filename);                          
                        request3.onsuccess = function () {
                            const matching2 = request3.result;
                            if (matching2 !== undefined) {                        
                                resolve(matching2.data);
                            } else {                        
                                resolve(null);
                            }
                        };
                    }
                };
            };

            function populate(zip) {
                var asreturn = null;
                const db = request.result;
                const tx = db.transaction("images", "readwrite");
                const store = tx.objectStore("images");
                zip.filter(function (path, file) {
                    var extension = file.name.split('.').pop().toLowerCase();
                    var blob = null;
                    switch (extension) {
                        case 'jpg':
                            blob = new Blob([file.asArrayBuffer()], { type: "image/jpeg" });
                            break;
                        case 'png':
                            blob = new Blob([file.asArrayBuffer()], { type: "image/png" });
                            break;
                        case 'txt':
                            if(file.name=='images/version.txt'){blob=file.asText();}
                            break;
                    }
                    if (blob != null) {
                        store.put({ name: file.name, data: blob });
                        if (file.name == filename) {
                            asreturn = blob;
                        }
                    }
                });
                resolve(asreturn);
            }
        });
    }
    var blobi = await getiim( filename);
    if(blobi==null){
        console.warn('NotCompressed Original:',fileSRC,'Final:',filename);
        return fileSRC;
    }else{
        return await blobToImage(blobi);
    }    
}

//######### DEBUG ONLY ############
function transfCtrlShow(obj) {
    if (typeof (obj) == _UN) return;
    if (typeof (transformCtl) == _UN) transformCtl = new THREE.TransformControls(camera, renderer.domElement);
    scene.add(transformCtl);
    if (transformCtl.target != obj) {
        transformCtl.attach(obj);
        transformCtl.target = obj;
    }
    transformCtl.visible = true;
}


//######### HTML START BUTTON ############
$(document).ready(function () {
    Ammo().then(function(Ammo) {
        window.Ammo=Ammo;
        iphysics=new IPHYSICS();
        initUserWait();
    });    
});

function initUserWait() {
    waitforaudiotimes += 1;
    if (navigator.userActivation.hasBeenActive) {
        clearTimeout(waitforaudio);
        waitforaudio = false;
        init();
    } else {
        //console.log('waiting gestue');
        if (waitforaudiotimes > 10) {
            //console.log('stop waiting gestue');
            waitforaudiotimes = 0;
            clearTimeout(waitforaudio);
            waitforaudio = true;
            init();
        } else {
            waitforaudio = setTimeout(() => { initUserWait(); }, 500);
        }
    }
}

//sucess init 3d scene
function initSucess() {
    $('.scavator').show();
    $(".scavator img").hover(function() {
        $(this).animate({
            width: "34em"
        }, 300 );            
    }, function() {
            $(this).animate({
                width: "10em"
            }, 300 );
    });
    //function contextmenu(event) { event.preventDefault(); }    
    animate();
    //window.AA=iphysics.createCubeTest(new THREE.Vector3(0,100,0));  
      
}


//######### Create Materials ############
async function createMaterial() {
    async function createAPong(front, back) {
        return [
            new THREE.MeshPhongMaterial({ color: 0xffffff }),
            new THREE.MeshPhongMaterial({ color: 0xffffff }),
            new THREE.MeshPhongMaterial({ color: 0xffffff }),
            new THREE.MeshPhongMaterial({ color: 0xffffff }),
            new THREE.MeshPhongMaterial({ map: await LOADER.textureLoader.loadAsync(front) }),
            new THREE.MeshPhongMaterial({ map: await LOADER.textureLoader.loadAsync(back) })
        ];
    }
    async function createAstandart(front, bump, rought, repeat, color) {
        if (!color) color = 0xffffff;
        var stdd = [
            new THREE.MeshPhongMaterial({ color: color }),
            new THREE.MeshPhongMaterial({ color: color }),
            new THREE.MeshPhongMaterial({ color: color }),
            new THREE.MeshPhongMaterial({ color: color }),
            new THREE.MeshStandardMaterial({
                roughness: 0.8,
                color: 0xffffff,
                metalness: 0.2,
                bumpScale: 1,
                map: await LOADER.textureLoader.loadAsync(front)
            }),
            new THREE.MeshPhongMaterial({ color: color })
        ];
        var floorMat = stdd[4];
        floorMat.map.wrapS = floorMat.map.wrapT = THREE.RepeatWrapping;
        floorMat.map.anisotropy = 4;
        if (repeat) floorMat.map.repeat.copy(repeat);
        if (bump) {
            floorMat.bumpMap = await LOADER.textureLoader.loadAsync(bump);
            floorMat.bumpMap.wrapS = floorMat.bumpMap.wrapT = THREE.RepeatWrapping;
            floorMat.bumpMap.anisotropy = 4;
            floorMat.bumpMap.repeat.copy(floorMat.map.repeat);
        }
        if (rought) {
            floorMat.roughnessMap = await LOADER.textureLoader.loadAsync(rought);
            floorMat.roughnessMap.wrapS = floorMat.roughnessMap.wrapT = THREE.RepeatWrapping;
            floorMat.roughnessMap.anisotropy = 4;
            floorMat.roughnessMap.repeat.copy(floorMat.map.repeat);
        }
        return stdd;
    }
    const metalbase = new THREE.MeshPhysicalMaterial({
        metalness: .9,
        roughness: .05,
        clearcoat: 1,
        transparent: true,
        transmission: 0.9,
        opacity: .5,
        reflectivity: 0.2,
        //refractionRatio: 0.985,
        ior: 0.9,
        side: 2,
        //flatShading:true,
        //envMap: maptexture2,
        envMapIntensity: 0.6
    });
    const glassSceneMaterial = new THREE.MeshPhysicalMaterial({
        metalness: .9,
        roughness: .05,
        envMapIntensity: 0.9,
        clearcoat: 1,
        transparent: true,
        transmission: 0,
        opacity: .5,
        reflectivity: 0.2,
        //refractionRatio: 0.985,
        ior: 0.9,
        side: 2,
        //flatShading:true,
        //envMap: maptexture2,//-->ADD ENVMAP
        envMapIntensity: 0.4
    });
    const waterCubeMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x56D8FF,
        //emissive: { r: 0.05, g: 0.05, b: 0.05 },
        transmission: 1,
        opacity: 1,
        metalness: 0,
        roughness: 0,
        ior: 1.5,
        thickness: 0.01,
        specularIntensity: 1,
        specularColor: 0xffffff,
        envMapIntensity: 1,
        side: THREE.DoubleSide,
        transparent: false,
        depthWrite: false
    });

    //########CREATING
    document.getElementById('loadingItens').innerText = 'loading materials';
    materials[99] = new THREE.MeshPhongMaterial({ color: 0x00ffff });
    materials[98] = new THREE.MeshPhongMaterial({ color: 0xffffff, flatShading: true });
    //GLASS
    materials[97] = glassSceneMaterial;
    //Water Cube Trasmission
    materials[96] = waterCubeMaterial;
    //GLASS window
    materials[95] = glassSceneMaterial.clone();
    //materials[95].envMap = maptexture1;-> chnangeEnvmap
    //window exterior
    materials[94] = new THREE.MeshBasicMaterial({  side: 0 });
    //materials[94].envMap = maptexture1;-> chnangeEnvmap
    //METAL
    materials[93] = metalbase.clone();
    materials[93].opacity = 1;

}

//######### LIST of 3D Objects Definitions ############
async function create3DObject(value, execute) {
    document.getElementById('loadingItens').innerText = 'inserting: ' + value;
    iobj3D.create(value, execute);
}

//######### create 3D or static audio ############
async function createAudio(local, volume, loop, autostart, toObject, distance, newname) {
    if (AUDIOlistener == null) {
        AUDIOlistener = new THREE.AudioListener();
        camera.add(AUDIOlistener);
    }
    document.getElementById('loadingItens').innerText = 'audio: ' + local.split('/').pop().toLowerCase();
    var sound;
    if (newname) {
        audios.forEach((audio) => {
            if (audio.name == newname) sound = audio;
        });
    } else {
        audios.forEach((audio) => {
            if (audio.name == local) sound = audio;
        });
    }
    if (typeof (sound) != _UN) {
        if (toObject) toObject.add(sound);
        sound.setVolume(volume);
        sound.setLoop(loop);
        sound.autoplay = autostart;
        if (autostart == true) sound.play();
    } else {
        if (toObject) {
            sound = new THREE.PositionalAudio(AUDIOlistener);
            if (distance) sound.setRefDistance(distance);
            toObject.add(sound);
        } else {
            sound = new THREE.Audio(AUDIOlistener);
        }
        var buffer = await LOADER.audioLoader.loadAsync(local);
        sound.setBuffer(buffer);
        sound.setVolume(volume);
        sound.setLoop(loop);
        sound.autoplay = autostart;
        if (autostart == true) sound.play();
        sound.name = local;
        if (newname) sound.name = newname;
        audios.push(sound);
    }
    return sound;
}

//######### create 3D or static audio ############
async function createAudioFromMedia(media, volume, toObject, distance, newname) {
    if (AUDIOlistener == null) {
        AUDIOlistener = new THREE.AudioListener();
        camera.add(AUDIOlistener);
    }
    document.getElementById('loadingItens').innerText = 'audio: internal';
    var sound;
    audios.forEach((audio) => {
        if (audio.name == newname) sound = audio;
    });
    if (typeof (sound) != _UN) {
        if (toObject) toObject.add(sound);
        sound.setVolume(volume);
    } else {
        if (toObject) {
            sound = new THREE.PositionalAudio(AUDIOlistener);
            if (distance) sound.setRefDistance(distance);
            toObject.add(sound);
        } else {
            sound = new THREE.Audio(AUDIOlistener);
        }
        sound.setMediaElementSource(media);
        sound.ismediaElement = true;
        sound.mediaElement = media;
        sound.setVolume(volume);
        sound.name = newname;
        audios.push(sound);
    }
    return sound;
}


//######### 3D initialization ############
async function init() {
    $($('.box')[0]).removeClass('animation_paused');
    $($('.box')[1]).removeClass('animation_paused');
    $($('.box')[2]).removeClass('animation_paused');
    $('#loadingText').text('System Initializing');

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 600);
    camera.position.y = 84;
    camera.position.z = 220;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0, 0, 0);
    scene.add(camera);

    renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        precision: "highp", //highp", "mediump" or "lowp"
        powerPreference: "high-performance" //"low-power", //"high-performance", "low-power" or "default"
    });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;//THREE.VSMShadowMap;//THREE.PCFSoftShadowMap; //THREE.BasicShadowMap;                
    renderer.toneMapping = THREE.ACESFilmicToneMapping;//THREE.ACESFilmicToneMapping;//THREE.ReinhardToneMapping;//THREE.LinearToneMapping;//THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.8;
    //renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.gammaFactor = 1;
    //renderer.autoClear = false;
    //renderer.preserveDrawingBuffer = true;
    renderer.setSize(window.innerWidth, window.innerHeight);
    //scene.background.setRGB(1,1,1);
    scene.background = null; //transparent    
    scene.fog = new THREE.Fog( 0x000000, 200, 700 )

    var mainDiv = document.getElementById('main');
    renderer.domElement.classList.add('cmain');
    mainDiv.appendChild(renderer.domElement);
    THREE.Cache.enabled = true;
    //CSS Renderer
    renderer2 = new CSS2D.Renderer();
    renderer2.setSize(window.innerWidth, window.innerHeight);
    renderer2.domElement.style.position = 'absolute';
    renderer2.domElement.style.top = '0px';//renderer2.domElement.style.backgroundColor = "rgba(0,0,0,0)";
    //mainDiv.appendChild(renderer2.domElement);
    //start creation
    control = new ICAMERA();
    await createMaterial();
    await create3DObject();
    await irender.createPostProcess();    
    iscene.init(createAudio, createAudioFromMedia, create3DObject, scene);
    iscene.createScene(CURR_SCENE, initSucess);
    var filters = irender.filters;
    if(isWebGL2Supported==true){        
        filters.N8AO.enabled=true;
    }
    window.GAME = { materials, objects, audios, transfCtrlShow, rayintersects, filters };
    window.addEventListener('resize', onWindowResize);
    EVENTS.create(THREE);
    EVENTS.onClick = onClick;
    EVENTS.onKeyUp = onKeyUp;
    EVENTS.onKeyDown = onKeyDown;
}


function isWebGL2Supported() {
    try {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('webgl2');
        canvas.remove(); // Remove o canvas da árvore DOM (se foi adicionado, ou apenas limpa a referência)
        return !!(window.WebGL2RenderingContext && context);
    } catch (e) {
        return false;
    }
}

//#####################################################
//######### Scene Events and Functions ############
//#####################################################

//on recalculate scene
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer2.setSize(window.innerWidth, window.innerHeight);
}

//on loop native function
var deltafps = 0;
var timestep = 1 / 30; //frameRate
function animate() {
    var delta = clock.getDelta();
    var elapsed = clock.getElapsedTime();
    deltafps += delta;
    if (delta && delta != null && iscene.creating == false && control && typeof (control != _UN)) {
        while (deltafps >= timestep) {
            //updates
            if (deltafps < 0.3) {
                var test = 0.02;
                control.update(test, EVENTS._keyMap, EVENTS.mouseHPos, 1);                
                control.update(test, EVENTS._keyMap, EVENTS.mouseHPos, 2);                
                //PHYSIC.update(timestep);    
                //animate        
                now = Date.now();
                timer = now - start;
                ianimate.animateObjects(test, timer);
                iphysics.update(deltafps);
                iscene.update();
            }
            deltafps -= timestep;
            //if (deltafps > 5) deltafps = 0;
        }
        irender.update(delta, elapsed);
        render();
    }
    requestAnimationFrame(animate);
}

//on render scene
function render() {
    renderer2.render(scene, camera);
    irender.render(() => {
        if (raycasterDisabled == false && EVENTS.mousePos != null) {
            raycaster.setFromCamera(EVENTS.mousePos, camera);
        }
    });
}

//window keyUp
function onKeyUp(code) {       
    switch (code) {
        case 'KeyA': JOINTCABIN.enableAngularMotor(true,0,100); break;
        case 'KeyD': JOINTCABIN.enableAngularMotor(true,0,100); break;
        case 'KeyW': JOINTBASE.enableAngularMotor(true,0.011 ,100); break;
        case 'KeyS': JOINTBASE.enableAngularMotor(true,0.011 ,100); break; 
        case 'ArrowUp': JOINTSUPERIOR.enableAngularMotor(true,0,100); break;
        case 'ArrowDown': JOINTSUPERIOR.enableAngularMotor(true,0,100); break; 
        case 'ArrowLeft': JOINTSHOVEL.enableAngularMotor(true,0,100); break;
        case 'ArrowRight': JOINTSHOVEL.enableAngularMotor(true,0,100); break; 
        case 'KeyE': 
        case 'KeyQ': 
        case 'AltLeft':  
        case 'Space': 
        CHAINMESH_LEFT.active=0;
        CHAINMESH_RIGHT.active=0;        
        for(var i=0;i<8;i++)JOINTWHEELS[i].enableAngularMotor(true,0,100); break;         
    }

}

//window keydown
function onKeyDown(code) {      
    switch (code) {
        case 'KeyA': JOINTCABIN.enableAngularMotor(true,0.3,100); break;
        case 'KeyD': JOINTCABIN.enableAngularMotor(true,-0.3,100); break;
        case 'KeyW': JOINTBASE.enableAngularMotor(true,0.1,100); break;
        case 'KeyS': JOINTBASE.enableAngularMotor(true,-0.1,100); break;    
        case 'ArrowUp': JOINTSUPERIOR.enableAngularMotor(true,-0.3,100); break;
        case 'ArrowDown': JOINTSUPERIOR.enableAngularMotor(true,0.3,100); break;  
        case 'ArrowLeft': JOINTSHOVEL.enableAngularMotor(true,-0.5,100); break;
        case 'ArrowRight': JOINTSHOVEL.enableAngularMotor(true,0.5,100); break;
        case 'Space': 
        CHAINMESH_LEFT.active=-1;
        CHAINMESH_RIGHT.active=-1;
        for(var i=0;i<8;i++)JOINTWHEELS[i].enableAngularMotor(true,1,100); break;  
        case 'AltLeft': 
        CHAINMESH_LEFT.active=1;
        CHAINMESH_RIGHT.active=1;
        for(var i=0;i<8;i++)JOINTWHEELS[i].enableAngularMotor(true,-1,100); break;  
        case 'KeyE': 
            CHAINMESH_LEFT.active=-1;
            CHAINMESH_RIGHT.active=1;
            for(var i=0;i<4;i++)
            JOINTWHEELS[i].enableAngularMotor(true,1,100); 
            for(var i=4;i<8;i++)
            JOINTWHEELS[i].enableAngularMotor(true,-1,100); 
            break;          
        case 'KeyQ': 
            CHAINMESH_LEFT.active=1;
            CHAINMESH_RIGHT.active=-1;
            for(var i=4;i<8;i++)
            JOINTWHEELS[i].enableAngularMotor(true,1,100); 
            for(var i=0;i<4;i++)
            JOINTWHEELS[i].enableAngularMotor(true,-1,100); 
            break;          
    }
    /*
    //Left
    KeyA
    index.js:554 KeyD
    index.js:554 KeyS
    index.js:554 KeyW
    //right
    ArrowRight
    index.js:554 ArrowLeft
    index.js:554 ArrowUp
    index.js:554 ArrowDown
    AltLeft -> back
    Space -> front
    */

}

//window mouse click
function onClick(mouseButtons) {
    if (mouseButtons.left != 1) return;
    raycaster.layers.set(0);
    rayintersects = raycaster.intersectObjects(scene.children, true);
    for (var e = 0; e < rayintersects.length; e++) {
        var intercept = rayintersects[e].object;

        if (typeof (intercept.onClick) == 'function') {
            intercept.onClick(intercept);
        }

        //intercept direct
        if (intercept && intercept.name && typeof (intercept.name) == 'string') {
            if (intercept.name == 'room_floor' ) {

            }
        }
        return;//ONLY THE FIRST ITERCEPT and RETURN
    }
}





