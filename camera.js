//TODO https://codepen.io/Fyrestar/pen/ExKLZxd

class ICAMERA {
    constructor() {
        this.active = 0;
        this.orbitCamera = new THREE.OrbitControls(camera, renderer.domElement);
        this.first = new THREE.FirstPersonControls(camera, renderer.domElement);
        this.mesh
        this.goal
        this.keys
        this.follow
        this.isEnabled = true   
        this.thirdCamDist=new THREE.Vector3()     
        //

        return this;
    }

    get enabled() {
        return this.isEnabled;
    }
    set enabled(onOff) {
        this.isEnabled = onOff;
        this.orbitCamera.enabled = false;
        this.first.enabled = false;
        switch (this.active) {
            case 0:
            case 2:
                this.orbitCamera.enabled = onOff;
                break;
            case 1:
                this.first.enabled = onOff;
                //camera.position.copy(this.mesh.position);
                //camera.position.y+=1;
                break;
        }
    }
    get target() {
        switch (this.active) {
            case 0:
            case 2: return this.orbitCamera.target;
            case 1: return camera.position.clone();
        }
    }
    set target(value) {
        switch (this.active) {
            case 0:
            case 2: this.orbitCamera.target.copy(value); break;
            case 1: this.first.lookAt(value); break;
        }
    }

    toggle(value) {
        this.active = value;
        this.orbitCamera.enabled = false;
        this.first.enabled = false;
        switch (value) {
            case 0:
                this.orbitCamera.enabled = this.isEnabled;
                this.orbitCamera.enablePan=true;
                this.orbitCamera.mouseButtons={LEFT: 0, MIDDLE: 1, RIGHT: 2};
                //scene.add(camera);
                break;
            case 1:
                this.first.enabled = this.enabled;
                //scene.add(camera);                
                break;
            case 2:
                this.orbitCamera.enabled = this.isEnabled;
                this.orbitCamera.enablePan=false;
                this.orbitCamera.mouseButtons={LEFT: 2, MIDDLE: 1, RIGHT: 0};
                scene.add(camera);
                break;
        }
    }




    update(delta, keyMap, mousePos,step) {
        switch (this.active) {
            case 0:
                if (this.orbitCamera && this.orbitCamera.update)
                    if(step==2)this.orbitCamera.update();
                break;
            case 1:
                if (this.first && this.first.update)
                    if(step==2)this.firstUpdate(delta, keyMap, mousePos);
                break;
            case 2:
                if (this.orbitCamera && this.orbitCamera.update)
                    this.thirdUpdate(delta, keyMap, mousePos,step);                    
                break;
        }
    }

    firstUpdate(delta, keyMap, mousePos) {
        if ((mousePos.x > 60 || mousePos.x < -60) ||
            (mousePos.y > 60 || mousePos.y < -60)) {
            this.first.activeLook = true;
        } else {
            this.first.activeLook = false;
        }
        this.first.update(delta * 50);
    }

    thirdUpdate(delta, keyMap, mousePos,step) {
        if (typeof (iplayer) != _UN && typeof (iplayer.players[0]) != _UN) {
            var ppos=iplayer.players[0].position; 
            if(step==1){
                this.thirdCamDist.subVectors(camera.position, ppos);
            }else{
                camera.position.copy(ppos);
                camera.position.add(this.thirdCamDist);
                this.orbitCamera.target=ppos;
                this.orbitCamera.update();
            }        
        }
    }


}

export { ICAMERA };