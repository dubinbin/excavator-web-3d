//postprocess
//import { HorizontalBlurShader } from 'three/addons/shaders/HorizontalBlurShader.js';
//import { VerticalBlurShader } from 'three/addons/shaders/VerticalBlurShader.js';
//import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
//Antialiases Pass


var darkmaterials = {};
window.finalComposer = null;
var bloomLayer = null,
    filters = { FXAA: null, N8AO: null, SMAA: null, SSAO: null, HBLUR: null, VBLUR: null, BLOOM: null },
    postprocessEnabled = true,
    darkMaterial = null;
window.SHADERMATERIAL = {};

class IRENDER {
    ishaders = null;
    filters = filters;

    update(delta,elapsed) {
        if (SHADERMATERIAL.LAVA && SHADERMATERIAL.LAVA.onUpdate) SHADERMATERIAL.LAVA.onUpdate(delta,elapsed);
        if (SHADERMATERIAL.WATER && SHADERMATERIAL.WATER.onUpdate) SHADERMATERIAL.WATER.onUpdate(delta,elapsed);
        if (SHADERMATERIAL.BUBLE && SHADERMATERIAL.BUBLE.onUpdate) SHADERMATERIAL.BUBLE.onUpdate(delta,elapsed);
        if (SHADERMATERIAL.WATERFALL && SHADERMATERIAL.WATERFALL.onUpdate) SHADERMATERIAL.WATERFALL.onUpdate(delta,elapsed);
    }

    render(execute) {
        //renderer.render(scene,camera);
        //if(typeof(execute)=='function')execute();
        //return;     
        if (finalComposer && finalComposer.render && finalComposer.render != null &&
            typeof (scene) != _UN) {
            if (postprocessEnabled == true) {

                finalComposer.render();

                scene.traverse(this.bloomMaterialTest);
                finalComposer.bloomComposer.render();
                scene.traverse(this.bloomMaterialRestore);
            } else {
                finalComposer.render();
            }
            if (typeof (execute) == 'function') execute();
        } else {
            renderer.render(scene, camera);
        }
        renderer.clearDepth();
    }

    async createMaterials() {
        //#### LAVA
        try {
            SHADERMATERIAL['LAVA'] = {
                uniforms: null,
                material: null,
                onUpdate: undefined
            }
            SHADERMATERIAL.LAVA.uniforms = {
                "fogDensity": { value: 0.015 },
                "fogColor": { value: new THREE.Vector3(0, 0, 0) },
                "time": { value: 1.0 },
                "uvScale": { value: new THREE.Vector2(0.2, 0.2) },
                "texture1": { value: LOADER.textureLoader.load('./images/shader/cloud.png') },
                "texture2": { value: LOADER.textureLoader.load('./images/shader/lavatile.jpg') }
            };
            SHADERMATERIAL.LAVA.uniforms["texture1"].value.wrapS =
                SHADERMATERIAL.LAVA.uniforms["texture1"].value.wrapT = THREE.RepeatWrapping;
            SHADERMATERIAL.LAVA.uniforms["texture2"].value.wrapS =
                SHADERMATERIAL.LAVA.uniforms["texture2"].value.wrapT = THREE.RepeatWrapping;
            const size = 0.65;
            SHADERMATERIAL.LAVA.material = new THREE.ShaderMaterial({
                uniforms: SHADERMATERIAL.LAVA.uniforms,
                vertexShader: this.ishaders.vertex['vertlava'],
                fragmentShader: this.ishaders.fragment['fraglava']
            });
            SHADERMATERIAL.LAVA.onUpdate = function (delta) {
                var dt2 = 5 * delta;
                if (SHADERMATERIAL && SHADERMATERIAL.LAVA) {
                    SHADERMATERIAL.LAVA.uniforms['time'].value += 0.2 * dt2;
                }
            }
        } catch (e) { console.log('Shader Lava', e); }
        //#### WATER
        try {
            SHADERMATERIAL['WATER'] = {
                uniforms: null,
                material: null,
                onUpdate: undefined
            }
            var fogcolor = new THREE.Color(0x00ff00);
            SHADERMATERIAL.WATER.uniforms = {
                "fogDensity": { value: 0.0 },
                "fogColor": { value: new THREE.Vector3(fogcolor.r, fogcolor.g, fogcolor.b) },
                "time": { value: 1.0 },
                "uvScale": { value: new THREE.Vector2(0.2, 0.2) },
                "texture1": { value: await LOADER.textureLoader.loadAsync('./images/shader/cloud.png') },
                "texture2": { value: await LOADER.textureLoader.loadAsync('./images/shader/water.jpg') }
            };
            SHADERMATERIAL.WATER.uniforms["texture1"].value.wrapS =
                SHADERMATERIAL.WATER.uniforms["texture1"].value.wrapT = THREE.RepeatWrapping;
            SHADERMATERIAL.WATER.uniforms["texture2"].value.wrapS =
                SHADERMATERIAL.WATER.uniforms["texture2"].value.wrapT = THREE.RepeatWrapping;
            SHADERMATERIAL.WATER.material = new THREE.ShaderMaterial({
                uniforms: SHADERMATERIAL.WATER.uniforms,
                vertexShader: this.ishaders.vertex['vertlava'],
                fragmentShader: this.ishaders.fragment['fragwater'],
                transparent: true,
                opacity: 0.5
            });
            SHADERMATERIAL.WATER.onUpdate = function (delta) {
                var dt2 = delta;
                SHADERMATERIAL.WATER.uniforms['time'].value += 0.2 * dt2;
            }
        } catch (e) { console.log('Shader Water', e); }
        //#### BUBLE
        try {
            SHADERMATERIAL['BUBLE'] = {
                uniforms: null,
                material: null,
                onUpdate: undefined
            }
            SHADERMATERIAL.BUBLE.uniforms = {
                color1: { value: new THREE.Color("#FFFFFF") },
                color2: { value: new THREE.Color("#AAAAAA") }
            };
            SHADERMATERIAL.BUBLE.material = new THREE.ShaderMaterial({
                uniforms: SHADERMATERIAL.BUBLE.uniforms,
                vertexShader: this.ishaders.vertex['vertexshader'],
                fragmentShader: this.ishaders.fragment['bublefragment'],
                transparent: true,
                depthTest: true
            });
            SHADERMATERIAL.BUBLE.onUpdate = function (delta) {
                //SHADERMATERIAL.BUBLE.uniforms[1]['viewVector'].value=camera.position;
            }
        } catch (e) { console.log('Shader Buble', e); }

        //#### WATERFALL
        try {
            SHADERMATERIAL['WATERFALL'] = {
                uniforms: {                                    
                  topDarkColor: { value: new THREE.Color(0x4e7a71)},
                  bottomDarkColor: { value: new THREE.Color(0x0e7562)},
                  topLightColor: { value: new THREE.Color(0xb0f7e9) },
                  bottomLightColor: { value: new THREE.Color(0x14c6a5)},
                  foamColor: {value: new THREE.Color(0xb0f7e9)},
                  threshold: {value: 0.001},
                  //tNoise: { value: await LOADER.textureLoader.loadAsync('./images/shader/cloud.png') },
                  //tDudv: { value: await LOADER.textureLoader.loadAsync('./images/shader/dudv.png') }
                  "fogDensity": { value: 0.0 },
                "fogColor": { value: new THREE.Vector3(fogcolor.r, fogcolor.g, fogcolor.b) },
                "time": { value: 1.0 },
                "uvScale": { value: new THREE.Vector2(0.2, 0.2) },
                "texture1": { value: await LOADER.textureLoader.loadAsync('./images/shader/cloud.png') },
                "texture2": { value: await LOADER.textureLoader.loadAsync('./images/shader/water.jpg') }
                },
                material: null,
                onUpdate: undefined
            }
            SHADERMATERIAL.WATERFALL.uniforms["texture1"].value.wrapS =
                SHADERMATERIAL.WATERFALL.uniforms["texture1"].value.wrapT = THREE.RepeatWrapping;
            SHADERMATERIAL.WATERFALL.uniforms["texture2"].value.wrapS =
                SHADERMATERIAL.WATERFALL.uniforms["texture2"].value.wrapT = THREE.RepeatWrapping;
           
            SHADERMATERIAL.WATERFALL.material = new THREE.ShaderMaterial({
                uniforms: SHADERMATERIAL.WATERFALL.uniforms,
                vertexShader: this.ishaders.vertex['waterfallshader'],
                fragmentShader: this.ishaders.fragment['waterfallfrag'],
                fog: true,
                transparent: true,
                opacity: 0.6
            });
            SHADERMATERIAL.WATERFALL.onUpdate = function (delta,elapsed) {                
                SHADERMATERIAL.WATERFALL.uniforms['time'].value += delta*20;
            }
        } catch (e) { console.log('Shader Water', e); }        
        
    }

    async createPostProcess() {   
        this.ishaders = new ISHADERS();
        this.ishaders.load();
        await this.createMaterials();
        darkMaterial = new THREE.MeshBasicMaterial({ color: "black" });
        bloomLayer = new THREE.Layers();
        bloomLayer.set(10);
        var defaultShader = this.ishaders.vertex['vertexshader'];
        var defaultFragment = this.ishaders.fragment['fragmentshader'];

        /*var watershader=ishaders.vertex['watershader'];
        var updateShader=ishaders.vertex['updateShader'];
        var normalShader=ishaders.vertex['normalShader'];*/
        //#####################################
        //###### FINAL FILTERS on Window
        //#####################################
        function makevertex(texture) {
            return new THREE.ShaderPass(
                new THREE.ShaderMaterial({
                    uniforms: {
                        baseTexture: { value: null },
                        xTexture: { value: texture },
                        brightness: { value: 1.0 }
                    },
                    vertexShader: defaultShader,
                    //document.getElementById('vertexshader').textContent,
                    fragmentShader: defaultFragment,
                    //document.getElementById('fragmentshader').textContent,
                    defines: {}
                }), "baseTexture"
            );
        }

        finalComposer = new THREE.EffectComposer(renderer);
        filters.FINAL = finalComposer;

        const renderScene = new THREE.RenderPass(scene, camera);
        finalComposer.addPass(renderScene);


        var vetor2 = new THREE.Vector2(renderer.domElement.width, renderer.domElement.height);
        const pixelRatio = renderer.getPixelRatio();
        //SSAO - shadow on borders
        /* Disabled - Using N8AO
        filters.SSAO = new SSAOPass(scene, camera, vetor2.x, vetor2.y);
        filters.SSAO.kernelRadius = 1.4;//14;
        filters.SSAO.minDistance = 0.0005;//0.012;
        filters.SSAO.maxDistance = 0.3;//1;
        filters.SSAO.enabled = postprocessEnabled;
        finalComposer.addPass(filters.SSAO);
        filters.SSAO.active = function (onOff) {
            if (onOff == true) {
                if (finalComposer.passes.includes(filters.SSAO) != true)
                finalComposer.addPass(filters.SSAO);
            } else {
                if (finalComposer.passes.includes(filters.SSAO) == true)
                finalComposer.removePass(filters.SSAO);
            }
            filters.SSAO.enabled = onOff;
        }
        */


        

        //FFXAA - pixel cleaner    
        /*Disabled using SMAA      
        filters.FXAA = new ShaderPass(FXAAShader);
        filters.FXAA.enabled = false;
        filters.FXAA.material.uniforms['resolution'].value.x = 1 / (vetor2.x * pixelRatio);
        filters.FXAA.material.uniforms['resolution'].value.y = 1 / (vetor2.y * pixelRatio);
        finalComposer.addPass(filters.FXAA);
        filters.FXAA.active = function (onOff) {
            if (onOff == true) {
                if (finalComposer.passes.includes(filters.FXAA) != true)
                finalComposer.addPass(filters.FXAA);
            } else {
                if (finalComposer.passes.includes(filters.FXAA) == true)
                finalComposer.removePass(filters.FXAA);
            }
            filters.FXAA.enabled = onOff;
        }
        */

        //N8AO - shadow on borders
        filters.N8AO = new THREE.N8AOPass(scene, camera, vetor2.x, vetor2.y);
        filters.N8AO.configuration.gammaCorrection = false;
        filters.N8AO.configuration.denoiseRadius
        filters.N8AO.configuration.aoRadius = 6;
        filters.N8AO.configuration.denoiseRadius = 10;
        filters.N8AO.enabled = false;
        finalComposer.addPass(filters.N8AO);

        //######### EFFECT BLOOM                 
        filters.BLOOM = new THREE.UnrealBloomPass(vetor2, 1.5, 0.4, 0.85);
        filters.BLOOM.enabled = postprocessEnabled;        
        filters.BLOOM.threshold = 0;
        filters.BLOOM.strength = 1;
        filters.BLOOM.radius = 0;
        finalComposer.bloomComposer = new THREE.EffectComposer(renderer);
        finalComposer.bloomComposer.renderToScreen = false;
        finalComposer.bloomComposer.addPass(renderScene);
        finalComposer.bloomComposer.addPass(filters.BLOOM);
        const bloomPass = makevertex(finalComposer.bloomComposer.renderTarget2.texture);
        bloomPass.needsSwap = true;
        finalComposer.addPass(bloomPass);


        //antaliase
        filters.SMAA = new THREE.SMAAPass(vetor2.x, vetor2.y);
        filters.SMAA.enabled = postprocessEnabled;
        finalComposer.addPass(filters.SMAA);

        //######### EFFECT Blur 
        /*Disable - too Ugly                 
        filters.HBLUR = new ShaderPass(HorizontalBlurShader);
        filters.VBLUR = new ShaderPass(VerticalBlurShader);
        filters.HBLUR.uniforms['h'].value = 0.0002;//2 / ( ENGINE.canvObj.width / 2 );
        filters.VBLUR.uniforms['v'].value = 0.0002;//2 / ( ENGINE.canvObj.height / 2 );  
        finalComposer.addPass(filters.HBLUR);
        finalComposer.addPass(filters.VBLUR);
        filters.VBLUR.enabled = filters.HBLUR.enabled = true;
        */
    }

    bloomMaterialTest(obj) {
        if (bloomLayer != null && (obj.isMesh || obj.isSprite) &&
            bloomLayer.test(obj.layers) === false) {
            darkmaterials[obj.uuid] = obj.material;
            obj.material = darkMaterial;
        }
    }

    bloomMaterialRestore(obj) {
        if (typeof (darkmaterials[obj.uuid]) !== _UN) {
            obj.material = darkmaterials[obj.uuid];
            delete darkmaterials[obj.uuid];
        }
    }



}
export { IRENDER };


class ISHADERS {
	vertex = [];
	fragment = [];
	_generateVertex(id, data) {
		this.vertex[id] = data;
		/*var elem = document.createElement('script');
		elem.setAttribute('type','x-shader/x-vertex');
		elem.innerHTML=data;
		elem.id=id;
		document.head.appendChild(elem);
		*/
	}
	_generateFragment(id, data) {
		this.fragment[id] = data;
		/*var elem = document.createElement('script');
		 elem.setAttribute('type','x-shader/x-fragment');
		 elem.innerHTML=data;
		 elem.id=id;
		 document.head.appendChild(elem);
		 */
	}

	load() {
		//######## DEFAULT ######
		this._generateVertex('vertexshader',
			`varying vec2 vUv;void main() {vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );}`);
		this._generateFragment('fragmentshader',
			`uniform sampler2D baseTexture;
				uniform sampler2D xTexture;varying vec2 vUv;
				void main() {gl_FragColor = ( texture2D( baseTexture, vUv ) + vec4( 1.0 ) * texture2D( xTexture, vUv ) );}`
		);
		//######## FIRE ######
		this._generateVertex('vertfire',
			`uniform float pointMultiplier;
			attribute float size;
			attribute float angle;
			attribute vec4 colour;
			varying vec4 vColour;
			varying vec2 vAngle;
			void main() {
			  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
			  gl_Position = projectionMatrix * mvPosition;
			  gl_PointSize = 1.0 * pointMultiplier / gl_Position.w;			 
			  vAngle = vec2(cos(angle), sin(angle));
			  vColour = colour;}`
		);
		this._generateFragment('fragfire', `uniform sampler2D diffuseTexture;
		 varying vec4 vColour;
		 varying vec2 vAngle;
		 void main() {
			  vec2 coords = (gl_PointCoord - 0.5) * mat2(vAngle.x, vAngle.y, -vAngle.y, vAngle.x) + 0.5;
			  gl_FragColor = texture2D(diffuseTexture, coords) * vColour;}`
		);
		//######## Lava ######
		this._generateFragment('fraglava',
			`uniform float time;uniform float fogDensity;
			uniform vec3 fogColor;uniform sampler2D texture1;
			uniform sampler2D texture2;varying vec2 vUv;
			void main( void ) {
				vec2 position = - 1.0 + 2.0 * vUv;
				vec4 noise = texture2D( texture1, vUv );
				vec2 T1 = vUv + vec2( 1.5, - 1.5 ) * time * 0.02;
				vec2 T2 = vUv + vec2( - 0.5, 2.0 ) * time * 0.01;
				T1.x += noise.x * 2.0;
				T1.y += noise.y * 2.0;
				T2.x -= noise.y * 0.2;
				T2.y += noise.z * 0.2;
				float p = texture2D( texture1, T1 * 2.0 ).a;
				vec4 color = texture2D( texture2, T2 * 2.0 );
				vec4 temp = color * ( vec4( p, p, p, p ) * 2.0 ) + ( color * color - 0.1 );
				if( temp.r > 1.0 ) { temp.bg += clamp( temp.r - 2.0, 0.0, 100.0 ); }
				if( temp.g > 1.0 ) { temp.rb += temp.g - 1.0; }
				if( temp.b > 1.0 ) { temp.rg += temp.b - 1.0; }
				gl_FragColor = temp;
				float depth = gl_FragCoord.z / gl_FragCoord.w;
				const float LOG2 = 1.442695;
				float fogFactor = exp2( - fogDensity * fogDensity * depth * depth * LOG2 );
				fogFactor = 1.0 - clamp( fogFactor, 0.0, 1.0 );
				gl_FragColor = mix( gl_FragColor, vec4( fogColor, gl_FragColor.w ), fogFactor );
			}`);
		this._generateVertex('vertlava',
			`uniform vec2 uvScale;
			varying vec2 vUv;void main(){vUv = uvScale * uv;
				vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
				gl_Position = projectionMatrix * mvPosition;}`);
		//######## WATER ######
		this._generateFragment('fragwater',
			`uniform float time;
			uniform float fogDensity;
			uniform vec3 fogColor;
			uniform sampler2D texture1;
			uniform sampler2D texture2;
			varying vec2 vUv;
			void main( void ) {
				vec2 position = - 1.0 + 2.0 * vUv;
				vec4 noise = texture2D( texture1, vUv );
				vec2 T1 = vUv + vec2( 1.5, - 1.5 ) * time * 0.02;
				vec2 T2 = vUv + vec2( - 0.5, 2.0 ) * time * 0.01;
				T1.x += noise.x * 2.0;
				T1.y += noise.y * 2.0;
				T2.x -= noise.y * 0.2;
				T2.y += noise.z * 0.2;
				float p = texture2D( texture1, T1 * 2.0 ).a;        
				vec4 color = texture2D( texture2, T2 * 2.0 );        
				vec4 temp = color * ( vec4( p, p, p, p ) * 2.0 ) + ( color * color - 0.1 );
				//if( temp.r > 1.0 ) { temp.bg += temp.r - 1.0;  }
				//if( temp.g > 1.0 ) { temp.rb += temp.g - 1.0; }
				if( temp.b > 1.0 ) { temp.rg += clamp( temp.b - 2.0, 0.0, 50.0 ); }
				gl_FragColor = temp;				
				float depth = gl_FragCoord.z / gl_FragCoord.w;
				const float LOG2 = 1.442695;
				float fogFactor = exp2( - fogDensity * fogDensity * depth * depth * LOG2 );
				fogFactor = 1.0 - clamp( fogFactor, 0.0, 1.0 );
				gl_FragColor = mix( gl_FragColor, vec4( fogColor, gl_FragColor.w ), fogFactor ); 				
                gl_FragColor.a=0.1;       
			}`);

		//######## BUBLES ######
		this._generateFragment('bublefragment',
			`uniform vec3 color1;
			uniform vec3 color2;			
			varying vec2 vUv;
			void main() {
				gl_FragColor = vec4(mix(color1, color2, vUv.y), 1.0);
				gl_FragColor.a=0.06;
			}`
		);

		//waterfall
		this._generateVertex('waterfallshader',
			`			
			uniform vec2 uvScale;
			varying vec2 vUv;
			void main(){
				vUv = uvScale * uv;
				vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
				gl_Position = projectionMatrix * mvPosition;
			}
  		`);
		this._generateFragment('waterfallfrag', `
		
		uniform vec3 waterColor;
		uniform vec3 foamColor;
		uniform vec3 topDarkColor;
		uniform vec3 topLightColor;
		uniform vec3 bottomLightColor;	
		uniform vec3 bottomDarkColor;	

		uniform float threshold;
		uniform float time;
		uniform float fogDensity;
		uniform vec3 fogColor;
		uniform sampler2D texture1;
		uniform sampler2D texture2;
		varying vec2 vUv;
		void main( void ) {
			vec2 position = - 1.0 + 2.0 * vUv;
			vec4 noise = texture2D( texture1, vUv );
			vec2 T1 = vUv + vec2( 1.5, - 1.5 ) * time * -0.02;
			vec2 T2 = vUv + vec2( - 0.5, 2.0 ) * time * -0.01;
			T1.x += noise.x * 2.0;
			T1.y += noise.y * 2.0;
			T2.x -= noise.y * 0.2;
			T2.y += noise.z * 0.2;
			float p = texture2D( texture1, T1 * 2.0 ).a;        
			vec4 color = texture2D( texture2, T2 * 2.0 );        
			vec4 temp = color * ( vec4( p, p, p, p ) * 2.0 ) + ( color * color - 0.1 );
			//if( temp.r > 1.0 ) { temp.bg += temp.r - 1.0;  }
			//if( temp.g > 1.0 ) { temp.rb += temp.g - 1.0; }
			if( temp.b > 1.0 ) { temp.rg += clamp( temp.b - 2.0, 0.0, 50.0 ); }
			gl_FragColor = temp;
			
			vec3 color2 = mix( mix( bottomDarkColor, topDarkColor, vUv.y ), mix( bottomLightColor, topLightColor, vUv.y ), p );
			color2 = mix( gl_FragColor.rgb, foamColor, step( vUv.y , threshold ) ); // add foam
	
			  gl_FragColor.rgb = color2;
			  gl_FragColor.a = 0.6;

			/*
			float depth = gl_FragCoord.z / gl_FragCoord.w;
			const float LOG2 = 1.442695;
			float fogFactor = exp2( - fogDensity * fogDensity * depth * depth * LOG2 );
			fogFactor = 1.0 - clamp( fogFactor, 0.0, 1.0 );
			gl_FragColor = mix( gl_FragColor, vec4( fogColor, gl_FragColor.w ), fogFactor ); 			
			gl_FragColor.a=0.1; 
			*/
		}

  		`);


	}

}