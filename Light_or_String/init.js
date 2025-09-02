function InitFlyers(fireflyCount = 10, hornetCount = 10) {
	window.flyingManager = new FlyingManager();
	
	fireflyHighData = 'firefly/firefly_high.obj';
	fireflyLowData = 'firefly/firefly_low.obj';
	
	hornetHighData = 'hornet/hornet_high.obj';
	hornetLowData = 'hornet/hornet_low.obj';
	
	for (let i = 0; i < fireflyCount; i++) {
		const firefly = new FlyingObject(
			fireflyLowData,
			fireflyHighData,
			gl, max_flight_box,
			min_flight_box,
			[3.20344, 3.566142, 2.037548], // min obj bbox
			[-3.204121, 1.347797, -1.995025], // max obj bbox
			true); // Mark as firefly for special handling
		Promise.all([
			firefly.setMeshFromFile(fireflyLowData, 'low',),
			firefly.setMeshFromFile(fireflyHighData, 'high')
		]).then(() => {
			const id = lights.length;              // <-- remember index
			light_pos = flyingManager.addFirefly(firefly);
			lights.push({
					position: light_pos.slice(),  // copy, not ref
					intensity: [0.001, 0.001, 0.001],
					radius: 0.1
			});
			firefly.light_id = id;		// store for quick look-up
		});
	}

	for (let i = 0; i < hornetCount; i++) {
		const hornet = new FlyingObject(hornetLowData,
				hornetHighData,
				gl, max_flight_box,
				min_flight_box, 
				[2, 5.0, -0.32], // min obj bbox
				[-2, 0.5, -5.0], // max obj bbox
				false); // Mark as hornet
		Promise.all([
			hornet.setMeshFromFile(hornetLowData, 'low'),
			hornet.setMeshFromFile(hornetHighData, 'high')
		]).then(() => {
			flyingManager.addHornet(hornet);
		});
	}
}


// Creates a cubemap, starts 6 async image loads, fills faces as they arrive, builds mipmaps when done, and redraws.
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
    	// allocate placeholder
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

// Called to initialize
function InitWebGL()
{
	// set initial values
	score = 0;
	updateScore(0);
	overlayCanvas = document.getElementById('overlay');
	overlayCtx = overlayCanvas.getContext('2d');

	// Initialize the WebGL canvas
	canvas = document.getElementById("canvas");
	canvas.oncontextmenu = function() {return false;};
	gl = canvas.getContext("webgl", {antialias: false, depth: true});	// Initialize the GL context
	if (!gl) {
		alert("Unable to initialize WebGL. Your browser or machine may not support it.");
		return;
	}
	// zoom with wheel and mouse‐drag handlers
	// each interaction updates the projection matrix and redraws the scene
	mouseInteraction(canvas);

	// Initialize settings
	gl.clearColor(0,0,0,0);
	gl.enable(gl.DEPTH_TEST);

	// cubemap environment
	InitEnvironmentMap();

	// create sphere object meshes
	triSphere.init();

	// ensuring the environment is ready before other objects are drawn
	background.init();

	// firefly and hornet counts from the HTML inputs
	const fireflyCount = parseInt(document.getElementById("firefly-input").value);
	const hornetCount = parseInt(document.getElementById("hornet-input").value);
	InitFlyers(fireflyCount, hornetCount);

	projectile = new Projectile(gl, 'slime/slime.obj', 'slime/slime_color.png');
  	slingshot = new Slingshot(gl, 'slingshot/slingshot.obj', 'slingshot/slingshot_color.png');

	ray_tracer = new RayTracer;
	UpdateCanvasSize();
	ray_tracer.init();
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

// Camera pose from user input
function GetTrans()
{
	function dot(a,b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }

	var cz = Math.cos( viewRotZ );
	var sz = Math.sin( viewRotZ );
	var cx = Math.cos( viewRotX );
	var sx = Math.sin( viewRotX );
	
	// Camera forward axis z (world)
	var z = [ cx*sz, -cx*cz, sx ];
    var target = (typeof cameraTarget !== 'undefined') ? cameraTarget : [0,0,0];
	// camera position
    var c = [ target[0] + z[0]*transZ, target[1] + z[1]*transZ, target[2] + z[2]*transZ ];
	// Camera right axis x
	var xlen = Math.sqrt( z[0]*z[0] + z[1]*z[1] );
	var x = [ -z[1]/xlen, z[0]/xlen, 0 ];
	// Camera up axis y = z × x (right-handed)
	var y = [ z[1]*x[2] - z[2]*x[1], z[2]*x[0] - z[0]*x[2], z[0]*x[1] - z[1]*x[0] ];
	// worldToCam: rows are x,y,z axes and translation
	var worldToCam = [
		x[0], y[0], z[0], 0,
		x[1], y[1], z[1], 0,
		x[2], y[2], z[2], 0,
		-dot(x,c), -dot(y,c), -dot(z,c), 1,
	];
	// camToWorld: columns are axes; last row is translation
	var camToWorld = [
		x[0], x[1], x[2], 0,
		y[0], y[1], y[2], 0,
		z[0], z[1], z[2], 0,
		c[0], c[1], c[2], 1
	];
	return { camToWorld:camToWorld, worldToCam:worldToCam };
}