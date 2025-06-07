const transZmin = 1.001;
const transZmax = 10;

let isDragging = false;
let dragStart = null;
let dragCurrent = null;
let dragDepth = 3.0;
let dragOffset = [0, 0];

let projectile;
var sphereDrawer;
var canvas, gl;
var perspectiveMatrix;	// perspective projection matrix
var environmentTexture;
var viewRotX=0, viewRotZ=0, transZ=3;
var sphereCount = 0;
var ray_tracer;

class Slingshot {
	constructor(gl, meshPath, texturePath) {
		this.drawer = new MeshDrawer(gl);
		this.position = [0, 0, 0];
		this.rotation = [0, 0]; // if needed

		// Load mesh
		fetch(meshPath)
			.then(res => res.text())
			.then(obj => {
				const mesh = new ObjMesh();
				mesh.parse(obj);
				mesh.shiftAndScale([0, 0, 0], 0.4); // scale and position
				mesh.computeNormals();
				const vbufs = mesh.getVertexBuffers();
				this.drawer.setMesh(vbufs.positionBuffer, vbufs.texCoordBuffer, vbufs.normalBuffer);
				this.drawer.swapYZ(true);
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
		const localMV = GetModelViewMatrix(tx, ty, tz, this.rotation[0], this.rotation[1]);
		const combinedMVP = MatrixMult(mvp, localMV);
		this.drawer.draw(combinedMVP, localMV, normalMat);
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
	{
		gl.depthMask( false );
		screenQuad.draw( this.prog, trans );
		gl.depthMask( true );
	}
};

var fixed_spheres = [
	{
		center: [ 0, 0, -10001.0 ],
		radius: 10000.0,
		mtl: {
			k_d: [ 0.1, 0.1, 0.2 ],
			k_s: [ 0.2, 0.2, 0.2 ],
			n: 10
		}
	}
];

var spheres = fixed_spheres.slice();


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


    window.flyingManager.update(dt, lights);
	// sphereDrawer.setLight(lights[0].position, lights[0].intensity);
	sphereDrawer.updateLights();
	ray_tracer.updateLights();
	projectile.update(dt);
    DrawScene();
    requestAnimationFrame(AnimateScene);
}

document.addEventListener("keydown", keyDownTextField, false);
function keyDownTextField(e) {
	var keyCode = e.keyCode;
	if(keyCode==115) {	// F4
		document.getElementById('includedscript').remove();
		var head = document.getElementsByTagName('head')[0];
		var script = document.createElement('script');
		script.src= 'ray.js';
		script.id = 'includedscript';
		script.onload = function() {
			ray_tracer.init();
			DrawScene();
		}
		head.appendChild(script);
		console.log('New script loaded.');
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

	// 3. Draw animated meshes (fireflies and hornets)
	if (window.flyingManager) {
		window.flyingManager.draw(mvp, mv, normalMat);
	}
	projectile.draw(mvp, mv, normalMat);

}



function WindowResize()
{
	UpdateCanvasSize();
	DrawScene();
}


async function NewScene()
{
	var c = document.getElementById('controls');
	c.style.display = 'none';
	InitWebGL();
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
		} else if ( event.shiftKey ) {

isDragging = true;
dragStart = [event.clientX, event.clientY];
dragDepth = WorldToViewDepth(projectile.position);

const slimeScreen = WorldToScreen(projectile.position);
dragOffset = [
	event.clientX - slimeScreen[0],
	event.clientY - slimeScreen[1]
];


canvas.onmousemove = function(event) {
	// Dragging code using dragDepth instead of fixed 3.0
	const correctedX = event.clientX - dragOffset[0];
	const correctedY = event.clientY - dragOffset[1];

	const mouseX = (correctedX / canvas.width) * 2 - 1;
	const mouseY = 1 - (correctedY / canvas.height) * 2;

	const trans = GetTrans();
	const invProjView = trans.camToWorld;

	const ndc = [mouseX * dragDepth, mouseY * dragDepth, -dragDepth, 1];
	const p = [
		invProjView[0]*ndc[0] + invProjView[4]*ndc[1] + invProjView[8]*ndc[2] + invProjView[12],
		invProjView[1]*ndc[0] + invProjView[5]*ndc[1] + invProjView[9]*ndc[2] + invProjView[13],
		invProjView[2]*ndc[0] + invProjView[6]*ndc[1] + invProjView[10]*ndc[2] + invProjView[14]
	];

	projectile.position = p;
};


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
		if (isDragging) {
			isDragging = false;
			// (launching logic comes later)
	dragStart = null;
		}
		canvas.onmousemove = null;	
	}

	const fireflyCount = parseInt(document.getElementById("firefly-input").value);
	const hornetCount = parseInt(document.getElementById("hornet-input").value);
	InitScene(fireflyCount, hornetCount); // creates lights[]
	ray_tracer  = new RayTracer();
	ray_tracer.init();              // now #define NUM_LIGHTS is correct
	sphereDrawer = new SphereDrawer();             // #define NUM_LIGHTS ok for water
	projectile = new Projectile(gl, 'slime/slime.obj', 'slime/slime_color.png');
	requestAnimationFrame(AnimateScene);
	DrawScene();
}