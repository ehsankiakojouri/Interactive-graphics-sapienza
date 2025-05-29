const transZmin = 1.001;
const transZmax = 10;

var sphereDrawer;
var canvas, gl;
var perspectiveMatrix;	// perspective projection matrix
var environmentTexture;
var viewRotX=0, viewRotZ=0, transZ=3;
var sphereCount = 0;
var ray_tracer;

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

var lights = [
	{
		position:  [ 0, 0, 1000 ],
		intensity: [ 1, 1, 1 ]
	}
];

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
function DrawScene()
{
	gl.flush();
	
	var trans = GetTrans();
	var mvp = MatrixMult( perspectiveMatrix, trans.worldToCam );

	// Clear the screen and the depth buffer.
	gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT );
	
	// Rasterization + Ray Tracing
	ray_tracer.draw( mvp, trans );
	
	meshDrawer.draw(mvp);
}

function WindowResize()
{
	UpdateCanvasSize();
	DrawScene();
}


function NewScene()
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
	
	ray_tracer.init();
	DrawScene();
}