// This is a helper function for compiling the given vertex and fragment shader script ids into a program.
function InitShaderProgramFromScripts( vs, fs )
{
	return InitShaderProgram( document.getElementById(vs).text, document.getElementById(fs).text );	
}

// This is a helper function for compiling the given vertex and fragment shader source code into a program.
function InitShaderProgram( vsSource, fsSource )
{
	const vs = CompileShader( gl.VERTEX_SHADER,   vsSource );
	const fs = CompileShader( gl.FRAGMENT_SHADER, fsSource );

	if ( ! vs || ! fs ) return null;
	
	const prog = gl.createProgram();
	gl.attachShader(prog, vs);
	gl.attachShader(prog, fs);
	gl.linkProgram(prog);

	if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
		alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(prog));
		return null;
	}
	return prog;
}

// This is a helper function for compiling a shader, called by InitShaderProgram().
function CompileShader( type, source )
{
	const shader = gl.createShader(type);
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter( shader, gl.COMPILE_STATUS) ) {
		alert('An error occurred compiling shader:\n' + gl.getShaderInfoLog(shader));
		gl.deleteShader(shader);
		return null;
	}
	return shader;
}

// Multiplies two matrices and returns the result A*B.
// The arguments A and B are arrays, representing column-major matrices.
function MatrixMult( A, B )
{
	var C = [];
	for ( var i=0; i<4; ++i ) {
		for ( var j=0; j<4; ++j ) {
			var v = 0;
			for ( var k=0; k<4; ++k ) {
				v += A[j+4*k] * B[k+4*i];
			}
			C.push(v);
		}
	}
	return C;
}

var screenQuad = {
	init( fov, z )
	{
		if ( ! this.vbuf ) this.vbuf = gl.createBuffer();
		const r = canvas.width / canvas.height;
		const ff = Math.PI * fov / 180;
		const tant_2 = Math.tan( ff/2 );
		const y = z * tant_2;
		const x = y * r;
		const rtp = [
			-x, -y, -z,
			 x, -y, -z,
			 x,  y, -z,
			-x, -y, -z,
			 x,  y, -z,
			-x,  y, -z,
		];
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vbuf);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(rtp), gl.STATIC_DRAW);
	},
	draw( prog, trans )
	{
		gl.useProgram( prog );
		gl.uniformMatrix4fv( gl.getUniformLocation( prog, 'c2w' ), false, trans.camToWorld );
		gl.bindBuffer( gl.ARRAY_BUFFER, this.vbuf );
		var p = gl.getAttribLocation ( prog, 'p' );
		gl.vertexAttribPointer( p, 3, gl.FLOAT, false, 0, 0 );
		gl.enableVertexAttribArray( p );
		gl.drawArrays( gl.TRIANGLES, 0, 6 );
	}
};

function updateDraggedProjectile(mouse) {
	const rect = canvas.getBoundingClientRect();
	const x = (mouse[0] - rect.left) / rect.width * 2 - 1;
	const y = (mouse[1] - rect.top) / rect.height * -2 + 1;

	// Define an ellipse in camera space and map mouse to it
	const ellipseX = 0.5 * x;  // X-axis
	const ellipseY = 0.3 * y;  // Y-axis
	const ellipseZ = -0.4 * (1 - x * x - y * y);  // inward (camera view dir)

	const camSpacePos = [ellipseX, ellipseY, ellipseZ, 1];

	// Convert camera space to world space using camToWorld
	const trans = GetTrans();
	const c2w = trans.camToWorld;
	const worldPos = [
		c2w[0]*camSpacePos[0] + c2w[4]*camSpacePos[1] + c2w[8]*camSpacePos[2] + c2w[12],
		c2w[1]*camSpacePos[0] + c2w[5]*camSpacePos[1] + c2w[9]*camSpacePos[2] + c2w[13],
		c2w[2]*camSpacePos[0] + c2w[6]*camSpacePos[1] + c2w[10]*camSpacePos[2] + c2w[14],
	];

	// Move the projectile to the dragged position
	if (projectile && !projectile.active) {
		projectile.position = worldPos;
	}
}

function WorldToViewDepth(pointWorld) {
	const trans = GetTrans();
	const worldToCam = trans.worldToCam;

	// Multiply world point by worldToCam matrix
	const x = pointWorld[0], y = pointWorld[1], z = pointWorld[2];
	const cx = worldToCam[0]*x + worldToCam[4]*y + worldToCam[8]*z + worldToCam[12];
	const cy = worldToCam[1]*x + worldToCam[5]*y + worldToCam[9]*z + worldToCam[13];
	const cz = worldToCam[2]*x + worldToCam[6]*y + worldToCam[10]*z + worldToCam[14];
	return -cz; // distance from camera
}
function WorldToScreen(pointWorld) {
	const trans = GetTrans();
	const worldToCam = trans.worldToCam;

	const x = pointWorld[0], y = pointWorld[1], z = pointWorld[2];
	const cx = worldToCam[0]*x + worldToCam[4]*y + worldToCam[8]*z + worldToCam[12];
	const cy = worldToCam[1]*x + worldToCam[5]*y + worldToCam[9]*z + worldToCam[13];
	const cz = worldToCam[2]*x + worldToCam[6]*y + worldToCam[10]*z + worldToCam[14];

	const clipX = perspectiveMatrix[0]*cx + perspectiveMatrix[8]*cz;
	const clipY = perspectiveMatrix[5]*cy + perspectiveMatrix[9]*cz;
	const clipW = -cz;

	const ndcX = clipX / clipW;
	const ndcY = clipY / clipW;

	const screenX = (ndcX + 1) / 2 * canvas.width;
	const screenY = (1 - ndcY) / 2 * canvas.height;

	return [screenX, screenY];
}
