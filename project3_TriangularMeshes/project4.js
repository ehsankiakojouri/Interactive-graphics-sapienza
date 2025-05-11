// This function takes the projection matrix, the translation, and two rotation angles (in radians) as input arguments.
// The two rotations are applied around x and y axes.
// It returns the combined 4x4 transformation matrix as an array in column-major order.
// The given projection matrix is also a 4x4 matrix stored as an array in column-major order.
// You can use the MatrixMult function defined in project4.html to multiply two 4x4 matrices in the same format.
function GetModelViewProjection( projectionMatrix, translationX, translationY, translationZ, rotationX, rotationY )
{
	// [TO-DO] Modify the code below to form the transformation matrix.
	var rotX = getHomogeneousRotationMatrix(rotationX, 'x');
	var rotY = getHomogeneousRotationMatrix(rotationY, 'y');
	var rot  = MatrixMult(rotY, rotX);

	var trans = rot.slice();
	trans[12] = translationX;
	trans[13] = translationY;
	trans[14] = translationZ;

	var mvp = MatrixMult( projectionMatrix, trans );
	return mvp;
}


function getHomogeneousRotationMatrix(angle, axis)
{
	var c = Math.cos(angle);
	var s = Math.sin(angle);
	switch (axis.toLowerCase()) {
		case 'x': return [
			1, 0, 0, 0,
			0, c, s, 0,
			0,-s, c, 0,
			0, 0, 0, 1
		];
		case 'y': return [
			c, 0,-s, 0,
			0, 1, 0, 0,
			s, 0, c, 0,
			0, 0, 0, 1
		];
		case 'z': return [
			c, s, 0, 0,
			-s,c, 0, 0,
			0, 0, 1, 0,
			0, 0, 0, 1
		];
		default: return [
			1, 0, 0, 0,
			0, 1, 0, 0,
			0, 0, 1, 0,
			0, 0, 0, 1
		];
	}
}

// [TO-DO] Complete the implementation of the following class.

class MeshDrawer
{
	// The constructor is a good place for taking care of the necessary initializations.
	constructor()
	{
		// [TO-DO] initializations
		this.numTriangles = 0;
		this.swap         = false;
		this.showTex      = true;
		this.vboPos       = gl.createBuffer();
		this.vboUV        = gl.createBuffer();
		this.tex          = gl.createTexture();

		// Compile shaders
		var vertSrc = `
			precision mediump float;
			attribute vec3 pos;
			attribute vec2 uv;
			varying vec2 vUV;
			uniform bool swapYZ;
			uniform mat4 mvp;
			void main() {
				vec3 p = swapYZ ? vec3(pos.x, pos.z, pos.y) : pos;
				gl_Position = mvp * vec4(p, 1.0);
				vUV = uv;
			}
		`;
		var fragSrc = `
			precision mediump float;
			varying vec2 vUV;
			uniform sampler2D textureID;
			uniform bool showTexture;
			void main() {
				if (showTexture) gl_FragColor = texture2D(textureID, vUV);
				else gl_FragColor = vec4(1.0, gl_FragCoord.z * gl_FragCoord.z, 0.0, 1.0);
			}
		`;
		this.program = gl.createProgram();
		[vertSrc, fragSrc].forEach((src, i) => {
			var shType = i === 0 ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER;
			var sh     = gl.createShader(shType);
			gl.shaderSource(sh, src);
			gl.compileShader(sh);
			gl.attachShader(this.program, sh);
		});
		gl.linkProgram(this.program);
	}
	
	// This method is called every time the user opens an OBJ file.
	// The arguments of this function is an array of 3D vertex positions
	// and an array of 2D texture coordinates.
	// Every item in these arrays is a floating point value, representing one
	// coordinate of the vertex position or texture coordinate.
	// Every three consecutive elements in the vertPos array forms one vertex
	// position and every three consecutive vertex positions form a triangle.
	// Similarly, every two consecutive elements in the texCoords array
	// form the texture coordinate of a vertex.
	// Note that this method can be called multiple times.
	setMesh( vertPos, texCoords )
	{
		// [TO-DO] Update the contents of the vertex buffer objects.
		this.numTriangles = vertPos.length / 3;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vboPos);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertPos), gl.STATIC_DRAW);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vboUV);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texCoords), gl.STATIC_DRAW);
	}
	
	// This method is called when the user changes the state of the
	// "Swap Y-Z Axes" checkbox. 
	// The argument is a boolean that indicates if the checkbox is checked.
	swapYZ( swap )
	{
		// [TO-DO] Set the uniform parameter(s) of the vertex shader
		this.swap = swap;
	}
	
	// This method is called to draw the triangular mesh.
	// The argument is the transformation matrix, the same matrix returned
	// by the GetModelViewProjection function above.
	draw( trans )
	{
		// [TO-DO] Complete the WebGL initializations before drawing
		if (!this.numTriangles) return;
		gl.useProgram(this.program);
		gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'mvp'), false, trans);
		gl.uniform1i(gl.getUniformLocation(this.program, 'swapYZ'), this.swap);
		gl.uniform1i(gl.getUniformLocation(this.program, 'showTexture'), this.showTex);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.tex);
		gl.uniform1i(gl.getUniformLocation(this.program, 'textureID'), 0);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vboPos);
		gl.enableVertexAttribArray(gl.getAttribLocation(this.program, 'pos'));
		gl.vertexAttribPointer(gl.getAttribLocation(this.program, 'pos'), 3, gl.FLOAT, false, 0, 0);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vboUV);
		gl.enableVertexAttribArray(gl.getAttribLocation(this.program, 'uv'));
		gl.vertexAttribPointer(gl.getAttribLocation(this.program, 'uv'), 2, gl.FLOAT, false, 0, 0);
		gl.drawArrays(gl.TRIANGLES, 0, this.numTriangles);
	}
	
	// This method is called to set the texture of the mesh.
	// The argument is an HTML IMG element containing the texture data.
	setTexture( img )
	{
		// [TO-DO] Bind the texture
		gl.useProgram(this.program);
		gl.bindTexture(gl.TEXTURE_2D, this.tex);

		// You can set the texture image data using the following command.
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);

		// [TO-DO] Now that we have a texture, it might be a good idea to set
		// some uniform parameter(s) of the fragment shader, so that it uses the texture.
		gl.generateMipmap(gl.TEXTURE_2D);
		this.showTex = true;
	}
	
	// This method is called when the user changes the state of the
	// "Show Texture" checkbox. 
	// The argument is a boolean that indicates if the checkbox is checked.
	showTexture( show )
	{
		// [TO-DO] set the uniform parameter(s) of the fragment shader to specify if it should use the texture.
		this.showTex = show;
	}
	
}
