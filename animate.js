
import * as THREE from 'three';
window.usefullChannels = {
    //0=channel1
    clips: { channel: 3, material: 4 },
    atari: { channel: 4, material: 5 },
    shows: { channel: 5, material: 12 },
    serie: { channel: 7, material: 13 },
}

THREE.Quaternion.prototype.setFromBasis = function (e1, e2, e3) {

    const m11 = e1.x, m12 = e1.y, m13 = e1.z,
        m21 = e2.x, m22 = e2.y, m23 = e2.z,
        m31 = e3.x, m32 = e3.y, m33 = e3.z,
        trace = m11 + m22 + m33;

    if (trace > 0) {

        const s = 0.5 / Math.sqrt(trace + 1.0);

        this._w = 0.25 / s;
        this._x = -(m32 - m23) * s;
        this._y = -(m13 - m31) * s;
        this._z = -(m21 - m12) * s;

    } else if (m11 > m22 && m11 > m33) {

        const s = 2.0 * Math.sqrt(1.0 + m11 - m22 - m33);

        this._w = (m32 - m23) / s;
        this._x = -0.25 * s;
        this._y = -(m12 + m21) / s;
        this._z = -(m13 + m31) / s;

    } else if (m22 > m33) {

        const s = 2.0 * Math.sqrt(1.0 + m22 - m11 - m33);

        this._w = (m13 - m31) / s;
        this._x = -(m12 + m21) / s;
        this._y = -0.25 * s;
        this._z = -(m23 + m32) / s;

    } else {

        const s = 2.0 * Math.sqrt(1.0 + m33 - m11 - m22);

        this._w = (m21 - m12) / s;
        this._x = -(m13 + m31) / s;
        this._y = -(m23 + m32) / s;
        this._z = -0.25 * s;

    }

    this._onChangeCallback();

    return this;

}

var lumen_monitor = 10;
class ANIMATE {

    constructor() {
        this.up = new THREE.Vector3(0, 1, 0);
        this.axis = new THREE.Vector3(0, 0, 0);
    }



    adjustMonitorLight(elementsrc) {
        var canvas = document.getElementById("tv_canvasmonitor"); //canvas test
        var ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, 256, 256);
        ctx.drawImage(elementsrc, 0, 0, 256, 256);
        var arr = ctx.getImageData(0, 0, 256, 256).data;
        var blockSize = 5;
        var arrLength = arr.length;
        var count = 0;
        var rgb = { r: 0, g: 0, b: 0 };
        var i = -4;
        while ((i += blockSize * 4) < arrLength) {
            ++count;
            rgb.r += arr[i];
            rgb.g += arr[i + 1];
            rgb.b += arr[i + 2];
        }
        rgb.r = ~~((rgb.r / count));
        rgb.g = ~~((rgb.g / count));
        rgb.b = ~~((rgb.b / count));
        var trgb = tinycolor("rgb(" + rgb.r + "," + rgb.g + "," + rgb.b + ")");
        var luma = 0.2126 * trgb._r + 0.7152 * trgb._g + 0.0722 * trgb._b; // per ITU-R BT.709
        var lumatry = 0;
        while (luma < lumen_monitor) {
            trgb.brighten(5);
            luma = 0.2126 * trgb._r + 0.7152 * trgb._g + 0.0722 * trgb._b; // per ITU-R BT.709                    
            lumatry++;
            if (lumatry > 4) break;
        }
        var bright = 6;
        rgb.r = rgb.r * 1.0 / bright;
        rgb.g = rgb.g * 1.0 / bright;
        rgb.b = rgb.b * 1.0 / bright;
        MONITORLIGHT.color.setRGB(rgb.r, rgb.g, rgb.b);
    }



    animateObjects(delta, timer) {
        if (scene == null) return;
        var temp1V3 = new THREE.Vector3();
        var temp2V3 = new THREE.Vector3();




        if (getOByName('tp_piston') && getOByName('tp_piston_h_1')) { // Make Piston Look to head part            
            var pistonhead = getOByName('tp_piston_h_1');
            var pistonbase = getOByName('tp_piston');
            var pistonheadBase = getOByName('tp_piston_h_2');
            pistonhead.getWorldPosition(temp1V3);
            pistonbase.getWorldPosition(temp2V3);
            //var dist=temp2V3.distanceTo(temp1V3);
            //var fixpos=16-dist;
            pistonbase.lookAt(temp1V3.x, temp1V3.y, temp1V3.z);
            pistonheadBase.lookAt(temp2V3.x, temp2V3.y, temp2V3.z);
            pistonbase.rotateY(Math.PI / 2 + 0.02);
            pistonheadBase.rotateY(-Math.PI / 2);
        }

        if (getOByName('sup_pist') && getOByName('sup_piston_head')) { // Make Piston Look to head part            
            var pistonhead = getOByName('sup_piston_head');
            var pistonbase = getOByName('sup_piston_head_base');
            var pistonheadBase = getOByName('sup_pist');
            pistonhead.getWorldPosition(temp1V3);
            pistonheadBase.getWorldPosition(temp2V3);
            //var dist=temp2V3.distanceTo(temp1V3);
            //var fixpos=16-dist;
            pistonheadBase.lookAt(temp1V3.x, temp1V3.y, temp1V3.z);
            pistonbase.lookAt(temp2V3.x, temp2V3.y, temp2V3.z);
            pistonheadBase.rotateX(-Math.PI / 2);
            pistonbase.rotateX(Math.PI / 2);
        }

        if (getOByName('lr_pistons_h') && getOByName('lr_pistons')) { // Make Piston Look to head part            
            var pistonhead = getOByName('lr_pistons_h');
            var pistonbase = getOByName('lr_pistons');
            //var pistonheadBase=getOByName('sup_pist');
            pistonhead.getWorldPosition(temp1V3);
            pistonbase.getWorldPosition(temp2V3);
            //var dist=temp2V3.distanceTo(temp1V3);
            //var fixpos=16-dist;
            pistonbase.lookAt(temp1V3.x, temp1V3.y, temp1V3.z);
            pistonhead.lookAt(temp2V3.x, temp2V3.y, temp2V3.z);
            pistonbase.rotateY(Math.PI / 2);
            pistonhead.rotateY(-Math.PI / 2);
            //pistonheadBase.rotateX(-Math.PI/2); 
            //pistonhead.rotateX(Math.PI/2);  
        }

/*
        if (getOByName('chain_pike') && CHAINMESH_LEFT) {
            var chainspeed = (delta / 8);
            if (typeof (CHAINMESH_LEFT.POINT) == _UN) CHAINMESH_LEFT.POINT = 0;
            if (CHAINMESH_LEFT.active != 0) {
                if (CHAINMESH_LEFT.active == 1) {
                    //CHAINMESH_LEFT.POINT >= 1 ? 0.1 : CHAINMESH_LEFT.POINT += chainspeed;
                    if (CHAINMESH_LEFT.POINT + chainspeed >= 1) CHAINMESH_LEFT.POINT = 0;
                    else CHAINMESH_LEFT.POINT += chainspeed;
                }
                if (CHAINMESH_LEFT.active == -1) {
                    //CHAINMESH_LEFT.POINT <= 0.1 ? 1.0 : CHAINMESH_LEFT.POINT -= chainspeed;
                    if (CHAINMESH_LEFT.POINT - chainspeed <= 0.01) CHAINMESH_LEFT.POINT = 1;
                    else CHAINMESH_LEFT.POINT -= chainspeed;
                }
                //console.log(CHAINMESH_LEFT.POINT);
                var chanpos = CHAINMESH_LEFT.spline.getPointAt(CHAINMESH_LEFT.POINT);
                getOByName('chain_pike').position.copy(chanpos);
            
                var tangent = CHAINMESH_LEFT.spline.getTangent(  CHAINMESH_LEFT.POINT );
                var t=tangent.clone();
                const normal = new THREE.Vector3( );
                const binormal = new THREE.Vector3( 0, 1, 0 );

                
    normal.crossVectors( tangent, binormal );    
	normal.y = 0; // to prevent lateral slope 	
	normal.normalize( );
    var n= normal.clone()
    binormal.crossVectors( normal, tangent ); // new binormal
    var b= binormal.clone( );     
    getOByName('chain_pike').quaternion.setFromBasis( t, b, n );
            }
        }*/

        
        if (getOByName('chain_tooth_l1') && CHAINMESH_LEFT && CHAINMESH_RIGHT) {
            var chainspeed = (delta / 8);
            function getShu(extra,CHAIMESH){
                var shf=CHAIMESH.iShuttle;
                if (CHAIMESH.active == 1 || CHAIMESH.first==true) {                   
                    shf=shf+extra;                                           
                }
                if (CHAIMESH.active == -1) {                   
                   shf=shf-extra;                                       
                }                
                if (shf >= CHAIMESH.lss) shf = shf - CHAIMESH.lss;   
                if (shf < 0) shf = (CHAIMESH.lss-1)+shf;                
                return shf;
            }
            if (CHAINMESH_LEFT.active != 0 || CHAINMESH_LEFT.first==true) {                
                for(var i=0;i<80;i++){
                    var ishutle=getShu(i*14,CHAINMESH_LEFT);
                    if (ishutle < 0) ishutle = (CHAINMESH_LEFT.lss-1)+ishutle;  
                    //console.log(ishutle);
                    try{
                    getOByName('chain_tooth_l'+i).quaternion.setFromBasis(
                        CHAINMESH_LEFT.t[ishutle],
                        CHAINMESH_LEFT.b[ishutle],
                        CHAINMESH_LEFT.n[ishutle]);
                    getOByName('chain_tooth_l'+i).position.set( 
                        CHAINMESH_LEFT.points[ ishutle ].x , 
                        CHAINMESH_LEFT.points[ ishutle ].y, 
                        CHAINMESH_LEFT.points[ ishutle].z );
                    }catch(e){
                        CHAINMESH_LEFT.iShuttle=Math.abs(CHAINMESH_LEFT.iShuttle);
                    }
                }
                if(CHAINMESH_LEFT.first==true)CHAINMESH_LEFT.first=false;
                CHAINMESH_LEFT.iShuttle+=CHAINMESH_LEFT.active;
            }
            if (CHAINMESH_RIGHT.active != 0 || CHAINMESH_RIGHT.first==true) {                
                for(var i=0;i<80;i++){
                    var ishutle=getShu(i*14,CHAINMESH_RIGHT);
                    if (ishutle < 0) ishutle = (CHAINMESH_RIGHT.lss-1)+ishutle;  
                    //console.log(ishutle);
                    try{
                    getOByName('chain_tooth_r'+i).quaternion.setFromBasis(
                        CHAINMESH_LEFT.t[ishutle],
                        CHAINMESH_LEFT.b[ishutle],
                        CHAINMESH_LEFT.n[ishutle]);
                    getOByName('chain_tooth_r'+i).position.set( 
                        CHAINMESH_LEFT.points[ ishutle ].x , 
                        CHAINMESH_LEFT.points[ ishutle ].y, 
                        CHAINMESH_LEFT.points[ ishutle].z -14);
                    }catch(e){
                        CHAINMESH_RIGHT.iShuttle=Math.abs(CHAINMESH_RIGHT.iShuttle);
                    }
                }
                if(CHAINMESH_RIGHT.first==true)CHAINMESH_RIGHT.first=false;
                CHAINMESH_RIGHT.iShuttle+=CHAINMESH_RIGHT.active;
            }
            
        }




    }
}




export { ANIMATE };