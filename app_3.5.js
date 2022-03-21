import * as THREE from './libs/three/three.module.js';
import { VRButton } from './libs/VRButton.js';
import { XRControllerModelFactory } from './libs/three/jsm/XRControllerModelFactory.js';
import { BoxLineGeometry } from './libs/three/jsm/BoxLineGeometry.js';
import { Stats } from './libs/stats.module.js';
import { OrbitControls } from './libs/three/jsm/OrbitControls.js';
import { SpotLightVolumetricMaterial } from './libs/SpotLightVolumetricMaterial.js';
import { GLTFLoader } from './libs/three/jsm/GLTFLoader.js';


class App{
	constructor(){
        const container = document.createElement( 'div' );
		document.body.appendChild( container );
        
        this.clock = new THREE.Clock();
        
		this.camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 0.1, 100 );
		this.camera.position.set( 0, 1.6, 3 );
        
		this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color( 0x505050 );

		this.scene.add( new THREE.HemisphereLight( 0x606060, 0x404040 ) );

        const light = new THREE.DirectionalLight( 0xffffff );
        light.position.set( 1, 1, 1 ).normalize();
		this.scene.add( light );
			
		this.renderer = new THREE.WebGLRenderer({ antialias: true } );
		this.renderer.setPixelRatio( window.devicePixelRatio );
		this.renderer.setSize( window.innerWidth, window.innerHeight );
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        
		container.appendChild( this.renderer.domElement );
        
        this.controls = new OrbitControls( this.camera, this.renderer.domElement );
        this.controls.target.set(0, 1.6, 0);
        this.controls.update();
        
        this.stats = new Stats();
        
        this.raycaster = new THREE.Raycaster();
        this.workingMatrix = new THREE.Matrix4();
        this.workingVector = new THREE.Vector3();
        
        this.initScene();
        this.setupXR()
        // when resize
        window.addEventListener('resize', this.resize.bind(this) )

        // adjust animation loop since we can't use our well known window.requestAnimationFrame() function.
        // For VR projects we use setAnimationLoop
        // Example:
        //
        // renderer.setAnimationLoop( function () {
        //     renderer.render( scene, camera )    
        // } )
        //
        this.renderer.setAnimationLoop( this.render.bind(this) );
	}	
    
    random( min, max ){
        return Math.random() * (max-min) + min;
    }

    // Define meshs and scene components
    initScene(){
        this.radius = 0.08;
         // create a line box, rendered as line (not triangular faces)
        this.room = new THREE.LineSegments(
					new BoxLineGeometry( 6, 6, 6, 10, 10, 10 ),
					new THREE.LineBasicMaterial( { color: 0x808080 } )
				);
        this.room.geometry.translate( 0, 3, 0 );
        this.scene.add( this.room );
        
        const geometry = new THREE.IcosahedronBufferGeometry( this.radius, 2 );

        for ( let i = 0; i < 200; i ++ ) {

            const object = new THREE.Mesh( geometry, new THREE.MeshLambertMaterial( { color: Math.random() * 0xffffff } ) );

            object.position.x = this.random( -2, 2 );
            object.position.y = this.random( -2, 2 );
            object.position.z = this.random( -2, 2 );

            this.room.add( object );
        }
        this.highlight = new THREE.Mesh( geometry, new THREE.MeshBasicMaterial( { color: 0xffffff, side: THREE.BackSide } ) )
        this.highlight.scale.set(1.2, 1.2, 1.2)
       // this.scene.add(this.highlight)
    }
     // Set up webXR library
    // setupXR(){
    //     this.renderer.xr.enabled = true
        
    //     const button = new VRButton( this.renderer )
    //     this.controllers = this.buildControllers()

    //     const self = this

    //     function onSelectStart() {         
    //         this.children[0].scale.z = 10;
    //         this.userData.selectPressed = true;
    //     }
        
    //     function onSelectEnd()
    //     {
    //         this.children[0].scale.z = 0;
    //         self.highlight.visible = false;
    //         this.userData.selectPressed = false;         
    //     }  

    //     this.controllers.forEach( (controller) => {
    //         controller.addEventListener( 'selectstart', onSelectStart );
    //         controller.addEventListener( 'selectend', onSelectEnd );
    //     });
    // }

    setupXR()
    {
        this.renderer.xr.enabled = true;   
        const button = new VRButton( this.renderer );
        const self = this;
        function onSelectStart() 
        {
            this.userData.selectPressed = true;
            if (self.spotlight) self.spotlight.visible = true;
        }
        function onSelectEnd() 
        {
            self.highlight.visible = false;
            this.userData.selectPressed = false;
            if (self.spotlight) self.spotlight.visible = false;          
        }
        this.controller = this.renderer.xr.getController( 0 );
        this.controller.addEventListener( 'selectstart', onSelectStart );
        this.controller.addEventListener( 'selectend', onSelectEnd );
        this.controller.addEventListener( 'connected', function ( event ) 
        {
            self.buildController.call(self, event.data, this );
        } );
        this.controller.addEventListener( 'disconnected', function () 
        {
            while(this.children.length>0) this.remove( this.children[ 0 ] );
            self.controller = null;
        } );
        this.scene.add( this.controller );
        this.scene.add(this.highlight);
    }

    
    buildControllers()
    {
        const controllerModelFactory = new XRControllerModelFactory()

        const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)])
        const line = new THREE.Line(geometry)
        line.name = 'line'
        line.scale.z = 0

        const controllers = []

        for(let i = 0; i <= 1; i++)
        {
            // add target ray sapce
            const controller = this.renderer.xr.getController(i)
            controller.add(line.clone())
            controller.userData.selectPressed = false
            this.scene.add(controller)

            controllers.push(controller)
            // Add grip using controllerModelFactory
            const grip = this.renderer.xr.getControllerGrip(i)
            grip.add(controllerModelFactory.createControllerModel(grip))
            this.scene.add(grip)
        }
        return controllers;
    }

    buildController( data, controller ) {
        let geometry, material, loader;  
        const self = this;     
        switch ( data.targetRayMode ) 
        {           
            case 'tracked-pointer':
                loader = new GLTFLoader().setPath('./assets/');
                loader.load( 'flash-light.glb',
                    ( gltf ) => {
                        const flashLight = gltf.scene.children[2];
                        const scale = 0.6;
                        flashLight.scale.set(scale, scale, scale);
                        controller.add( flashLight );
                        self.spotlight = new THREE.Group();
                        const spotlight = new THREE.SpotLight( 0xFFFFFF, 2, 12, Math.PI/15, 0.3 );
                        geometry = new THREE.CylinderBufferGeometry(0.03, 1, 5, 32, 5, true);
                        geometry.rotateX( Math.PI/2 );
                        material = new SpotLightVolumetricMaterial();
                        const cone = new THREE.Mesh( geometry, material );
                        cone.translateZ( -2.6 );
                    
                        spotlight.position.set(0,0,0);
                        spotlight.target.position.set(0,0,-1);
                        self.spotlight.add( spotlight.target );
                        self.spotlight.add( spotlight );
                        self.spotlight.add( cone );
                        
                        controller.add(self.spotlight);
                        self.spotlight.visible = false;
                    },
                    null,
                    (error) =>  {
                        console.error( 'An error occurred' );    
                    }
                );              
                break;
                
            case 'gaze':
                geometry = new THREE.RingBufferGeometry( 0.02, 0.04, 32 ).translate( 0, 0, - 1 );
                material = new THREE.MeshBasicMaterial( { opacity: 0.5, transparent: true } );
                controller.add( new THREE.Mesh( geometry, material ) )
        }
    }
    
    
    handleController( controller )
    {
        if (controller.userData.selectPressed )
        {
            //controller.children[0].scale.z = 10
            // assign controller's rotation to the working matrix
            this.workingMatrix.identity()                // indentity property of matrix4 returns 4x4 indentity matrix
            .extractRotation( controller.matrixWorld )   // get rotation from controller.matrixWorld property 

            // set rayCaster
            this.raycaster.ray.origin.setFromMatrixPosition( controller.matrixWorld )
            // set ray to -z then rotate it to match our controller target ray
            this.raycaster.ray.direction.set( 0, 0, - 1 ).applyMatrix4( this.workingMatrix )
            // rayCaster intersections
            const intersects = this.raycaster.intersectObjects( this.room.children )
            // If has intersections:
            if (intersects.length>0)
            {
                // intersects[0] since returned array of intersected objects are ordered by distance
                intersects[0].object.add(this.highlight)
                this.highlight.visible = true
                //controller.children[0].scale.z = intersects[0].distance
            }
            else
            {
                this.highlight.visible = false
            }
        }       
    }
    
    resize(){
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize( window.innerWidth, window.innerHeight );  
    }
    
	render( ) {   
        this.stats.update();
        if (this.controller ) this.handleController( this.controller );
        // if (this.controllers ){
        //     const self = this;
        //     this.controllers.forEach( ( controller) => { 
        //         self.handleController( controller ) 
        //     });
        // }
        
        this.renderer.render( this.scene, this.camera );
    }
}

export { App };