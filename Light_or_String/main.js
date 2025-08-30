const transZmin = 1.001;     // camera zoom min
const transZmax = 10;        // camera zoom max

let slingshot;

let projectile;
var sphereDrawer;
var canvas, gl;
var perspectiveMatrix;					// perspective projection matrix 4x4 projection
var environmentTexture; 				// GL cubemap
var viewRotX=0, viewRotZ=0, transZ=3; 	// camera controls
var sphereCount = 0;
var ray_tracer;
var overlayCanvas, overlayCtx;
let score = 0;


// Aiming parameters
let aiming=false;
let aimYaw=0;
let aimPitch=0;
const AIM_STEP=0.05;
const MIN_POWER=400;
const MAX_POWER=2000;
const POWER_PERIOD=3.0; // seconds for full oscillation
let powerTimer=0;
let currentPower=MIN_POWER;
let predictedTrajectory=[];
let cameraTarget=[0,0,0];

// Thresholding parameters for detecting when the projectile
// has effectively stopped moving vertically
const Y_STILL_THRESHOLD = 0.01;
const STILL_FRAMES = 30;
let lastProjectileY = null;
let stillCounter = 0;

class Slingshot {
	constructor(gl, meshPath, texturePath) {
		this.drawer = new MeshDrawer(gl);
		this.position = [0, -4, 0];
		this.rotation = [0, 0, 0]; // if needed

		// Load mesh
		fetch(meshPath)
		.then(res => res.text())
		.then(objText => {
			const mesh = new ObjMesh();
			mesh.parse(objText);

			// Compute bounding box:
			const bbox = mesh.getBoundingBox(); // expects { min: [x,y,z], max: [x,y,z] }
			const center = [
			(bbox.min[0] + bbox.max[0]) / 2,
			(bbox.min[1] + bbox.max[1]) / 2,
			(bbox.min[2] + bbox.max[2]) / 2
			];

			// Subtract center from every vertex position so mesh is centered at origin:
			// Assuming mesh.vpos is an array of [x,y,z] arrays:
			for (let i = 0; i < mesh.vpos.length; i++) {
			mesh.vpos[i][0] -= center[0];
			mesh.vpos[i][1] -= center[1];
			mesh.vpos[i][2] -= center[2];
			}
			// If ObjMesh keeps other derived buffers, after this you should
			// call mesh.shiftAndScale([0,0,0], scale) or just mesh.computeNormals and get buffers again.
			// For example:
			// - Either remove the existing mesh.shiftAndScale call, or replace it with:
			const scaleFactor = 10;
			mesh.shiftAndScale([0, 0, 0], scaleFactor);
			mesh.computeNormals();

			const vbufs = mesh.getVertexBuffers();
			this.drawer.setMesh(vbufs.positionBuffer, vbufs.texCoordBuffer, vbufs.normalBuffer);
			this.drawer.swapYZ(true);

			// Optionally store local pivot if needed later, though after recentering pivot=origin.
			this._meshCenterOffset = center; // for reference if needed (e.g. for repositioning collision spheres)
		});

		// Load texture
		const img = new Image();
		img.onload = () => this.drawer.setTexture(img);
		img.src = texturePath;
		this.drawer.showTexture(true);
	}

	draw(mvp, mv, normalMat) {
		const tx = this.position[0];
		const ty = this.position[1];
		const tz = this.position[2];
		const localMV = GetModelViewMatrix(tx, ty, tz, this.rotation[0], this.rotation[1], this.rotation[2]);
		const combinedMVP = MatrixMult(mvp, localMV);
		this.drawer.draw(combinedMVP, localMV, normalMat);
	}

	setPowerLevel(p){
			this.drawer.setPowerLevel(p);
	}
}


var background = {
	init()
	{
		this.prog = InitShaderProgramFromScripts( 'raytraceVS', 'envFS' );
	},
	updateProj()
	{
		gl.useProgram( this.prog );
		gl.uniformMatrix4fv( gl.getUniformLocation( this.prog, 'proj' ), false, perspectiveMatrix );
	},
	draw( trans )
	{ // draws a fullscreen quad for the sky or environment map, disabling depth writes so geometry renders in front of it
		gl.depthMask( false );
		screenQuad.draw( this.prog, trans );
		gl.depthMask( true );
	}
};

var fixed_spheres = [
        { // big “ground sphere”
                center: [ 0, 0, -10001.0 ],
                radius: 10000.0,
                mtl: {
                // Icy ground material
                k_d: [ 0.8, 0.85, 0.9 ],
        k_s: [ 0.3, 0.3, 0.3 ], // keep some reflection
			n: 10
                },
                hidden: false
        }
];

var spheres = fixed_spheres.slice(); // working array


const raytraceFS_header = `
	precision highp float;
	precision highp int;
`;

const raytraceFS_primary = `
	varying vec3 ray_pos;
	varying vec3 ray_dir;

	void main()
	{
		Ray primary_ray;
		primary_ray.pos = ray_pos;
		primary_ray.dir = ray_dir;
		gl_FragColor = RayTracer( primary_ray );
	}
`;

const raytraceFS_secondary = `
	uniform Material mtl;
	uniform vec3     campos;
	varying vec3     pos;
	varying vec3     normal;
	void main()
	{
		vec3 nrm = normalize( normal );
		vec3 view = normalize( campos - pos );
		vec3 color = Shade( mtl, pos, nrm, view );
		if ( mtl.k_s.r > 0.0 || mtl.k_s.g > 0.0 || mtl.k_s.b > 0.0 ) 
		{
			Ray ray;
			ray.pos = pos;
			ray.dir = reflect( -view, nrm );
			vec4 reflection = RayTracer( ray );
			color += mtl.k_s * reflection.rgb;
		}
		gl_FragColor = vec4( color, 1 );
	}
`;

let lastFrameTime = null;
function AnimateScene(now) {
    if (!window.flyingManager) return;
    if (!lastFrameTime) lastFrameTime = now;
    const dt = (now - lastFrameTime) / 1000.0;
    lastFrameTime = now;

    if(aiming){
        powerTimer += dt;
        const phase = (powerTimer/POWER_PERIOD)*2.0*Math.PI;
        const t = 0.5*(Math.sin(phase)+1.0);
        currentPower = MIN_POWER + t*(MAX_POWER-MIN_POWER);
        slingshot.setPowerLevel(t);
        const dir=[-Math.sin(aimYaw)*Math.cos(aimPitch), Math.sin(aimPitch), Math.cos(aimYaw)*Math.cos(aimPitch)];
        const acceleration=dir.map(d=>d*currentPower);
        predictedTrajectory = projectile.predictTrajectory(0.016, 150, acceleration);
        window.predictedTrajectory = predictedTrajectory;
    } else {
        powerTimer = 0;
        slingshot.setPowerLevel(0);
    }

    window.flyingManager.update(dt, lights);
	// sphereDrawer.setLight(lights[0].position, lights[0].intensity);
	sphereDrawer.updateLights();
	ray_tracer.updateLights();
	ray_tracer.updateSpheres();
        projectile.update(dt);

        // Compute vertical motion delta for reset logic
        if(lastProjectileY !== null){
            const dy = Math.abs(projectile.position[1] - lastProjectileY);
            if(dy < Y_STILL_THRESHOLD && projectile.released) ++stillCounter; else stillCounter = 0;
            if(stillCounter > STILL_FRAMES){
                resetProjectileAndSlingshot();
            }
        }
        lastProjectileY = projectile.position[1];

    if(aiming || projectile.released){
        let camposition = projectile.position.slice();
		cameraTarget[0] = camposition[0];
		cameraTarget[2] = camposition[1];
		cameraTarget[1] = camposition[2];
		
    }else{
        cameraTarget = [0,0,0];
    }
    DrawScene();
    requestAnimationFrame(AnimateScene);
}

// Aiming controls
document.addEventListener("keydown", handleAimKeyDown, false);
document.addEventListener("keyup", handleAimKeyUp, false);

function handleAimKeyDown(e){
    if(e.key=="Shift"){
        aiming=true;
        powerTimer=0;

    }
    if(aiming){
        switch(e.key){
            case "ArrowUp":   aimPitch += AIM_STEP; break;
            case "ArrowDown": aimPitch -= AIM_STEP; break;
            case "ArrowLeft": aimYaw += AIM_STEP; break;
            case "ArrowRight": aimYaw -= AIM_STEP; break;
            default: return;
        }
        slingshot.rotation[0]=aimPitch;
        slingshot.rotation[2]=aimYaw;
        e.preventDefault();
        DrawScene();
    }
}

function handleAimKeyUp(e){
    if(e.key=="Shift" && aiming){
        aiming=false;
        const dir=[-Math.sin(aimYaw)*Math.cos(aimPitch), Math.sin(aimPitch), Math.cos(aimYaw)*Math.cos(aimPitch)];
        const acceleration=dir.map(d=>d*currentPower);
        projectile.launch(acceleration);
    }
}


// This is the main function that handled WebGL drawing
function DrawScene() {
	gl.flush();

	const trans = GetTrans();
	const mvp = MatrixMult(perspectiveMatrix, trans.worldToCam);
	const mv = trans.worldToCam;
	const normalMat = [1, 0, 0, 0, 1, 0, 0, 0, 1]; // or compute from mv if lighting is directional

	// Clear screen once
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// 1. Draw background (sky/environment cube map)
	background.draw(trans);

	// 2. Draw raytraced spheres (like the floor)
	ray_tracer.draw(mvp, trans);

	// 3. Draw animated meshes
	window.flyingManager.draw(mvp, mv, normalMat);
	slingshot.draw(mvp, mv, normalMat);
	projectile.draw(mvp, mv, normalMat);

	if(overlayCtx){
		overlayCtx.clearRect(0,0,overlayCanvas.width,overlayCanvas.height);
		if(aiming && predictedTrajectory.length){
			drawPredictedPath(predictedTrajectory);
		}
	}

}

function drawPredictedPath(path){
    overlayCtx.beginPath();
    overlayCtx.strokeStyle = 'rgba(255,255,0,0.7)';
    overlayCtx.lineWidth = 2;
    for(let i=0;i<path.length;i++){
        const [sx,sy] = WorldToScreen(path[i]);
        if(i===0) overlayCtx.moveTo(sx,sy); else overlayCtx.lineTo(sx,sy);
    }
    overlayCtx.stroke();
}



function WindowResize()
{
	UpdateCanvasSize();
	DrawScene();
}


async function NewScene()
{		
	// Hide controls
	var c = document.getElementById('controls');
	c.style.display = 'none';

	// set initial values
	score = 0;
	updateScore(0);
	InitWebGL();
	overlayCanvas = document.getElementById('overlay');
	overlayCtx = overlayCanvas.getContext('2d');
	// zoom, wheel, and mouse‐drag handlers
	// each interaction updates the projection matrix and redraws the scene
	canvas.zoom = function( s ) {
		transZ *= s/canvas.height + 1;
		if ( transZ < transZmin ) transZ = transZmin;
		if ( transZ > transZmax ) transZ = transZmax;
		UpdateProjectionMatrix();
		DrawScene();
	}
	canvas.onwheel = function() { canvas.zoom(0.3*event.deltaY); }
	canvas.onmousedown = function() {
		var cx = event.clientX;
		var cy = event.clientY;
		if ( event.ctrlKey ) {
			canvas.onmousemove = function() {
				canvas.zoom(5*(event.clientY - cy));
				cy = event.clientY;
			}
               } else {
                       canvas.onmousemove = function() {
                               viewRotZ += (cx - event.clientX)/canvas.width*5;
                               viewRotX -= (cy - event.clientY)/canvas.height*5;
                               cx = event.clientX;
				cy = event.clientY;
				const eps = 0.01;
				if ( viewRotX < -0.1 ) viewRotX = -0.1;
				if ( viewRotX > Math.PI/2 - eps ) viewRotX = Math.PI/2 - eps;
				UpdateProjectionMatrix();
				DrawScene();
			}
		}
	}
       canvas.onmouseup = canvas.onmouseleave = function() {
               canvas.onmousemove = null;
       }

	// firefly and hornet counts from the HTML inputs
	const fireflyCount = parseInt(document.getElementById("firefly-input").value);
	const hornetCount = parseInt(document.getElementById("hornet-input").value);

	InitScene(fireflyCount, hornetCount); // creates lights[]
	ray_tracer  = new RayTracer();
	ray_tracer.init();
	sphereDrawer = new SphereDrawer();
	projectile = new Projectile(gl, 'slime/slime.obj', 'slime/slime_color.png');
  	slingshot = new Slingshot(gl, 'slingshot/slingshot.obj', 'slingshot/slingshot_color.png');

	// Start rendering loop
	requestAnimationFrame(AnimateScene);
	DrawScene();
}