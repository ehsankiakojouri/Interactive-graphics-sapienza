function InitScene(fireflyCount = 10, hornetCount = 10) {
	window.flyingManager = new FlyingManager();
	
	fireflyHighData = 'firefly/firefly_high.obj';
	fireflyLowData = 'firefly/firefly_low.obj';
	
	hornetHighData = 'hornet/hornet_high.obj';
	hornetLowData = 'hornet/hornet_low.obj';
	
	for (let i = 0; i < fireflyCount; i++) {
		const firefly = new FlyingObject(fireflyLowData, fireflyHighData, gl, max_flight_box, min_flight_box, [3.20344, 3.566142, 2.037548], [-3.204121, 1.347797, -1.995025]);
		firefly.isFirefly = true; // Mark as firefly for special handling
		Promise.all([
			firefly.setMeshFromFile(fireflyLowData, 'low',),
			firefly.setMeshFromFile(fireflyHighData, 'high')
		]).then(() => {
			// light_pos = flyingManager.addFirefly(firefly);
			// lights.push({
			// 	position: light_pos,
			// 	intensity: [2.0, 2.0, 2.0]
				// intensity: [1.0, 1.0, 0.77]
				// });
			const id = lights.length;              // <-- remember index
			light_pos = flyingManager.addFirefly(firefly);
			lights.push({
					position: light_pos.slice(),  // copy, not ref
					intensity: [0.1, 0.1, 0.1],
					radius: 0.3
			});
			firefly.light_id = id;                      // store for quick look-up
			DrawScene();
		});
	}

	for (let i = 0; i < hornetCount; i++) {
		const hornet = new FlyingObject(hornetLowData, hornetHighData, gl, max_flight_box, min_flight_box, [2, 5.0, -0.32], [-2, 0.5, -5.0]);
		Promise.all([
			hornet.setMeshFromFile(hornetLowData, 'low'),
			hornet.setMeshFromFile(hornetHighData, 'high')
		]).then(() => {
			flyingManager.addHornet(hornet);
			DrawScene();
		});
	}
	flyingManager.draw()
}


function InitEnvironmentMap()
{
	environmentTexture = gl.createTexture();
	gl.bindTexture( gl.TEXTURE_CUBE_MAP, environmentTexture );
	
	const url = 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/cube/MilkyWay/';
	const files = [
	  'dark-s_px.jpg', 'dark-s_nx.jpg',
	  'dark-s_py.jpg', 'dark-s_ny.jpg',
	  'dark-s_pz.jpg', 'dark-s_nz.jpg',
	];
	const faces = [
		gl.TEXTURE_CUBE_MAP_POSITIVE_X,
		gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
		gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
		gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
		gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
		gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
	];

	var loaded = 0;
	for ( var i=0; i<6; ++i ) {
		gl.texImage2D( faces[i], 0, gl.RGBA, 128, 128, 0, gl.RGBA, gl.UNSIGNED_BYTE, null );
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.face = faces[i];
		img.onload = function() {
			gl.bindTexture( gl.TEXTURE_CUBE_MAP, environmentTexture );
			gl.texImage2D( this.face, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this );
			loaded++;
			if ( loaded == 6 ) {
				gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
				DrawScene();
			}
		};
		img.src = url + files[i];
	}
	gl.texParameteri( gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR );
}

// Called once to initialize
function InitWebGL()
{
	// Initialize the WebGL canvas
	canvas = document.getElementById("canvas");
	canvas.oncontextmenu = function() {return false;};
	gl = canvas.getContext("webgl", {antialias: false, depth: true});	// Initialize the GL context
	if (!gl) {
		alert("Unable to initialize WebGL. Your browser or machine may not support it.");
		return;
	}
	
	// Initialize settings
	gl.clearColor(0,0,0,0);
	gl.enable(gl.DEPTH_TEST);
	
	InitEnvironmentMap();

	triSphere.init();
	background.init();

	ray_tracer = new RayTracer;

	sphereDrawer = new SphereDrawer;
    sphereDrawer.setLight( lights[0].position, lights[0].intensity, lights[0].radius );

	meshDrawer = new MeshDrawer();

	UpdateCanvasSize();
}

// Called every time the window size is changed.
function UpdateCanvasSize()
{
	canvas.style.width  = "100%";
	canvas.style.height = "100%";
	const pixelRatio = window.devicePixelRatio || 1;
	canvas.width  = pixelRatio * canvas.clientWidth;
	canvas.height = pixelRatio * canvas.clientHeight;
	const width  = (canvas.width  / pixelRatio);
	const height = (canvas.height / pixelRatio);
	canvas.style.width  = width  + 'px';
	canvas.style.height = height + 'px';
	if(typeof overlayCanvas !== 'undefined' && overlayCanvas){
			overlayCanvas.width = canvas.width;
			overlayCanvas.height = canvas.height;
			overlayCanvas.style.width = width + 'px';
			overlayCanvas.style.height = height + 'px';
	}
	gl.viewport( 0, 0, canvas.width, canvas.height );
	UpdateProjectionMatrix();
}

function UpdateProjectionMatrix()
{
	const fov = 60;
	var r = canvas.width / canvas.height;
	var n = 0.1;
	const min_n = 0.001;
	if ( n < min_n ) n = min_n;
	var f = transZmax*100;
	var ff = Math.PI * fov / 180;
	var tant_2 = Math.tan( ff/2 );
	var s = 1 / tant_2;
	perspectiveMatrix = [
		s/r, 0, 0, 0,
		0, s, 0, 0,
		0, 0, -(n+f)/(f-n), -1,
		0, 0, -2*n*f/(f-n), 0
	];
	
	screenQuad.init(fov,(n+f)/2);
	background.updateProj();
	ray_tracer.updateProj();
}

function GetTrans()
{
	function dot(a,b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }

	var cz = Math.cos( viewRotZ );
	var sz = Math.sin( viewRotZ );
	var cx = Math.cos( viewRotX );
	var sx = Math.sin( viewRotX );

	var z = [ cx*sz, -cx*cz, sx ];
        var target = (typeof cameraTarget !== 'undefined') ? cameraTarget : [0,0,0];
        var c = [ target[0] + z[0]*transZ, target[1] + z[1]*transZ, target[2] + z[2]*transZ ];
	var xlen = Math.sqrt( z[0]*z[0] + z[1]*z[1] );
	var x = [ -z[1]/xlen, z[0]/xlen, 0 ];
	var y = [ z[1]*x[2] - z[2]*x[1], z[2]*x[0] - z[0]*x[2], z[0]*x[1] - z[1]*x[0] ];
	
	var worldToCam = [
		x[0], y[0], z[0], 0,
		x[1], y[1], z[1], 0,
		x[2], y[2], z[2], 0,
		-dot(x,c), -dot(y,c), -dot(z,c), 1,
	];
	var camToWorld = [
		x[0], x[1], x[2], 0,
		y[0], y[1], y[2], 0,
		z[0], z[1], z[2], 0,
		c[0], c[1], c[2], 1
	];
	return { camToWorld:camToWorld, worldToCam:worldToCam };
}
function mulberry32(a){
    return function() {
        let t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}