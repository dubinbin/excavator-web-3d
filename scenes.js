class ISCENE {

    audioFromMedia = null;
    addAudio = null;
    createObject = null;
    scene = null;
    waitforaudiotimes;
    creating = false;
    ihud = null;
    lockfastload=null;
    lastScene=0;


    update() {
    }

    init(audio, audiofr, cobject, sc, ih) {
        this.addAudio = audio;
        this.audioFromMedia = audiofr;
        this.createObject = cobject;
        this.scene = sc;
        this.ihud = ih;
    }

    async clearObjTree(obj) {
        if (obj && obj != null && obj.children) {
            while (obj.children.length > 0) {
                await this.clearObjTree(obj.children[0]);
                obj.remove(obj.children[0]);
            }
        }
        if (obj && obj != null && obj.material) {
            //in case of map, bumpMap, normalMap, envMap ...
            Object.keys(obj.material).forEach(prop => {
                if (!obj.material[prop]) return;
                if (obj.material[prop] !== null && typeof obj.material[prop].dispose === 'function')
                    if (materials.includes(obj.material[prop]) == false) obj.material[prop].dispose();
            })
            if (obj.material !== null && typeof obj.material.dispose === 'function')
                if (materials.includes(obj.material) == false) obj.material.dispose();
        }
        if (obj && obj != null && obj.texture) {
            if (obj.texture !== null && typeof obj.texture.dispose === 'function')
                obj.texture.dispose();
        }
        if (obj && obj != null && obj.geometry) {
            if (obj.geometry !== null && typeof obj.geometry.dispose === 'function')
                obj.geometry.dispose();
        }
    }


    async clean() {
        this.creating = true;
        $('#btCenter').show();
        audios.forEach((audio) => {
            if (audio.isPlaying) audio.stop();
            /*if(audio.ismediaElement)audio.disconnect();
            const index = audios.indexOf(audio);
            audios.splice(index, 1);*/
        });
        $("video").each(function () {
            $(this).get(0).muted = true;
        });
        objects = [];
        objectbyNames = {};
        AUDIOlistener = null;
        if (camera.parent != null) camera.parent.remove(camera);
        await this.clearObjTree(this.scene);
        scene.clear();
    }

    async createScene(value, execute) {
        var loadingdObjt = 0;
        var create3DObject = this.createObject;
        var me = this;
        iphysics.paused=true;
        this.lockfastload=setTimeout(()=>{this.lockfastload=null;},2000);
        await this.clean();
        async function icreateObject(name, iobject) {
            loadingdObjt += 1;
            create3DObject(name, async (object) => {
                iobject(object);
                loadingdObjt -= 1;
                console.log('Wainting for', loadingdObjt);
                if (loadingdObjt <= 0) {                 
                        while(iscene.lockfastload!=null){
                            await new Promise(r => setTimeout(r, 1000));
                        }                                         
                    if(iscene.lastScene==value)return;                    
                    iscene.lastScene=value;
                    $('#btCenter').hide();
                    iphysics.paused=false;
                    me.creating = false;
                    if (typeof (execute) == 'function') execute();
                    return;
                }
            });
        }

        //############################################################
        //## SCENE 01                  ###############################
        //############################################################
        if (value == 1) {
            const pointLight2 = new THREE.HemisphereLight(0xffffff, 0x000000, 0.7);
            pointLight2.position.set(0, 800, 0);
            //pointLight2.shadow.bias = -0.0015;            
            scene.add(pointLight2);

            camera.position.set(-27.65725632282041,  33.65733762822409,  26.374405747961276);
            camera.rotation.set(-0.5560998227092719, -0.3060791539816928,  -0.18513613345321772,'XYZ');

            control.toggle(0);
            /*icreateObject('galery2', async (object) => {                
                this.scene.add(object);
                //object.position.y = -39.2;
            });
            */

            //controla pá
            //JOINTSHOVEL.enableAngularMotor(true,x,1); -> x menor ou maior que zero, lado da rotacao
            //JOINTSUPERIOR -> tbm controla o braço superior
            //controla o braço
            //PM.setTargetLinMotorVelocity(x); -> x posicao de -5 ate -28
            //get angle
            //JOINTBASE.getHingeAngle()

            icreateObject('plane', async (object) => {                
                this.scene.add(object);
                //object.position.y = -39.2;
            });
            icreateObject('scavator', async (object) => {                
                this.scene.add(object);
                //object.position.y = -39.2;
            });

                                    //TEST OBJECTS
                                    
                                    function rndI(min, max) { // min and max included 
                                        return Math.floor(Math.random() * (max - min + 1) + min)
                                      }
                                    const material = new THREE.MeshBasicMaterial({ color: 0xff00ff });
                                    var debrit;
                                    for(var i=0;i<20;i++){
                                        debrit = new THREE.Mesh(new THREE.BoxGeometry(rndI(1,8), rndI(1,8), rndI(1,10)), material);
                                        debrit.position.set(rndI(10,40), 5, rndI(10,40));scene.add(debrit);
                                        await iphysics.createObj(debrit, 'box', 'obj', null, 1);
                                    }
                                    for(var i=0;i<20;i++){
                                        debrit = new THREE.Mesh(new THREE.SphereGeometry(rndI(1,8)/4, 8,8), material);
                                        debrit.position.set(rndI(10,40), 5, rndI(10,40));scene.add(debrit);
                                        await iphysics.createObj(debrit, 'sphere', 'obj', null, 1);
                                    }
                                    


        }

        //############################################################
        //## SCENE 02                  ###############################
        //############################################################
        if (value == 2) {
            const pointLight2 = new THREE.HemisphereLight(0xffffff, 0x000000, 0.7);
            pointLight2.position.set(0, 800, 0);
            //pointLight2.shadow.bias = -0.0015;            
            scene.add(pointLight2);  

          
        }
      

        /*
        camera.position.set(-180.22529745683502,  144.74731627392924,154.4075816650073);
        camera.rotation.set(-0.7531175296331171, -0.7053911426427659,  -0.5461130363734521,'XYZ');
        control.maxTargetRadius=40;
        control.maxPolarAngle=1.4;
        control.minPolarAngle=0.4;
        control.maxDistance=300;
        */
    }
}
export { ISCENE };