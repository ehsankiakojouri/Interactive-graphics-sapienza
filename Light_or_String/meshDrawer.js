// This function takes the translation and two rotation angles (in radians) as input arguments.
// The two rotations are applied around x and y axes.
// It returns the combined 4x4 transformation matrix as an array in column-major order.
// You can use the MatrixMult function defined in project5.html to multiply two 4x4 matrices in the same format.
function GetModelViewMatrix( tx, ty, tz, rotX, rotY ) {
    // build rotation around X
    const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
    const rotMatX = [
        1,    0,     0, 0,
        0, cosX,  sinX, 0,
        0,-sinX,  cosX, 0,
        0,    0,     0, 1
    ];
    // build rotation around Y
    const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
    const rotMatY = [
       cosY, 0, -sinY, 0,
          0, 1,     0, 0,
       sinY, 0,  cosY, 0,
          0, 0,     0, 1
    ];
    // combine rotations: first X then Y
    const rotCombined = MatrixMult(rotMatY, rotMatX);

    // translation matrix
    const transMat = [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
       tx,ty,tz, 1
    ];

    // apply translation after rotation
    const mv = MatrixMult(transMat, rotCombined);
    return mv;
}


// [TO-DO] Complete the implementation of the following class.

class MeshDrawer
{
	// The constructor is a good place for taking care of the necessary initializations.
	constructor()
	{
        this.gl = gl
        this.gl.clearColor(0, 0, 0, 0);
        this.gl.enable(this.gl.DEPTH_TEST);
        // compile & link shaders
        const vShader = this._compileShader(this._vertSource(), this.gl.VERTEX_SHADER);
        const fShader = this._compileShader(this._fragSource(), this.gl.FRAGMENT_SHADER);
        this.program = this.gl.createProgram();
        this.gl.attachShader(this.program, vShader);
        this.gl.attachShader(this.program, fShader);
        this.gl.linkProgram(this.program);
        if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
            console.error(this.gl.getProgramInfoLog(this.program));
        }
        this.meshReady = false;
        this.textureReady = false;
        this.showTex   = true;
	}
	
	// This method is called every time the user opens an OBJ file.
	// The arguments of this function is an array of 3D vertex positions,
	// an array of 2D texture coordinates, and an array of vertex normals.
	// Every item in these arrays is a floating point value, representing one
	// coordinate of the vertex position or texture coordinate.
	// Every three consecutive elements in the vertPos array forms one vertex
	// position and every three consecutive vertex positions form a triangle.
	// Similarly, every two consecutive elements in the texCoords array
	// form the texture coordinate of a vertex and every three consecutive 
	// elements in the normals array form a vertex normal.
	// Note that this method can be called multiple times.
	setMesh( vertPos, texCoords, normals )
	{
		// [TO-DO] Update the contents of the vertex buffer objects.
		this.numTriangles = vertPos.length / 3;
		this._createBuffer('pos', vertPos, 3);
		this._createBuffer('uv', texCoords, 2);
		this._createBuffer('normal', normals, 3);
		this.meshReady = true;
	}
	
	// This method is called when the user changes the state of the
	// "Swap Y-Z Axes" checkbox. 
	// The argument is a boolean that indicates if the checkbox is checked.
	swapYZ( swap )
	{
		// [TO-DO] Set the uniform parameter(s) of the vertex shader
		this.gl.useProgram(this.program);
        const loc = this.gl.getUniformLocation(this.program, "swapYZ");
        this.gl.uniform1i(loc, swap);
	}
	
	// This method is called to draw the triangular mesh.
	// The arguments are the model-view-projection transformation matrixMVP,
	// the model-view transformation matrixMV, the same matrix returned
	// by the GetModelViewProjection function above, and the normal
	// transformation matrix, which is the inverse-transpose of matrixMV.
	draw( matrixMVP, matrixMV, matrixNormal )
	{
		// [TO-DO] Complete the WebGL initializations before drawing
		if (!this.meshReady) return;

        this.gl.useProgram(this.program);

        // attributes are already bound in setMesh(); just re-enable
        ["pos","uv","normal"].forEach(name => {
            const loc = this.gl.getAttribLocation(this.program, name);
            this.gl.enableVertexAttribArray(loc);
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this[name + "Buffer"]);
            const size = (name==="uv"?2:3);
            this.gl.vertexAttribPointer(loc, size, this.gl.FLOAT, false, 0, 0);
        });

        // set uniforms
        const uMVP = this.gl.getUniformLocation(this.program, "mvp");
        this.gl.uniformMatrix4fv(uMVP, false, matrixMVP);
        const uMV  = this.gl.getUniformLocation(this.program, "mv");
        this.gl.uniformMatrix4fv(uMV,  false, matrixMV);
        const uNorm= this.gl.getUniformLocation(this.program, "normalMat");
        this.gl.uniformMatrix3fv(uNorm,false, matrixNormal);

	if (this.textureReady && this.tex) {
		this.gl.activeTexture(this.gl.TEXTURE0);
		this.gl.bindTexture(this.gl.TEXTURE_2D, this.tex);
		const samplerLoc = this.gl.getUniformLocation(this.program, "textureID");
		this.gl.uniform1i(samplerLoc, 0);
	}

	const showLoc = this.gl.getUniformLocation(this.program, "showTexture");
	this.gl.uniform1i(showLoc, this.showTex ? 1 : 0);
    
		this.gl.drawArrays(this.gl.TRIANGLES, 0, this.numTriangles );
	}
	
	// This method is called to set the texture of the mesh.
	// The argument is an HTML IMG element containing the texture data.
	setTexture( img )
	{
		// [TO-DO] Bind the texture
        this.tex = this.gl.createTexture();
        this.gl.useProgram(this.program);
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.tex);
		// You can set the texture image data using the following command.
		this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGB, this.gl.RGB, this.gl.UNSIGNED_BYTE, img );
		this.gl.generateMipmap(this.gl.TEXTURE_2D);

		// [TO-DO] Now that we have a texture, it might be a good idea to set
		// some uniform parameter(s) of the fragment shader, so that it uses the texture.
		const samplerLoc = this.gl.getUniformLocation(this.program, "textureID");
        this.gl.uniform1i(samplerLoc, 0);

        this.textureReady = true;
        if (this.showTex) this.showTexture(true);
	}
	
	// This method is called when the user changes the state of the
	// "Show Texture" checkbox. 
	// The argument is a boolean that indicates if the checkbox is checked.
	showTexture( show )
	{
		// [TO-DO] set the uniform parameter(s) of the fragment shader to specify if it should use the texture.
        this.showTex = show;
        this.gl.useProgram(this.program);
        const loc = this.gl.getUniformLocation(this.program, "showTexture");
        this.gl.uniform1i(loc, show);
	}
	
	// This method is called to set the incoming light direction
	setLightDir( x, y, z )
	{
		// [TO-DO] set the uniform parameter(s) of the fragment shader to specify the light direction.
        this.gl.useProgram(this.program);
        const loc = this.gl.getUniformLocation(this.program, "lightDir");
        this.gl.uniform3fv(loc, [x, y, z]);
	}
	
	// This method is called to set the shininess of the material
	setShininess( shininess )
	{
		// [TO-DO] set the uniform parameter(s) of the fragment shader to specify the shininess.
		this.gl.useProgram(this.program);
        const loc = this.gl.getUniformLocation(this.program, "shininess");
        this.gl.uniform1f(loc, shininess);
	}
	
	//utils
    _createBuffer(attrName, dataArray, numComp) {
        const buf = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buf);
        this.gl.bufferData(
            this.gl.ARRAY_BUFFER,
            new Float32Array(dataArray),
            this.gl.STATIC_DRAW
        );
        this[attrName + "Buffer"] = buf;
    }

    _compileShader(src, type) {
        const sh = this.gl.createShader(type);
        this.gl.shaderSource(sh, src);
        this.gl.compileShader(sh);
        if (!this.gl.getShaderParameter(sh, this.gl.COMPILE_STATUS)) {
            console.error(this.gl.getShaderInfoLog(sh));
        }
        return sh;
    }

    _vertSource() {
        return `
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
    }

    _fragSource() {
        return `
			precision mediump float;
			varying vec2 vUV;
			uniform sampler2D textureID;
			uniform bool showTexture;
			void main() {
				if (showTexture) gl_FragColor = texture2D(textureID, vUV);
				else gl_FragColor = vec4(1.0, gl_FragCoord.z * gl_FragCoord.z, 0.0, 1.0);
			}`
    }
}
