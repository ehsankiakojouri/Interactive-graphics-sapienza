function LoadObjModel(input) {
	if (input.files && input.files[0]) {
		const reader = new FileReader();
		reader.onload = function (e) {
			const obj = new ObjMesh();
			obj.parse(e.target.result);

			const box = obj.getBoundingBox();
			const shift = [
				-(box.min[0] + box.max[0]) / 2,
				-(box.min[1] + box.max[1]) / 2,
				-(box.min[2] + box.max[2]) / 2,
			];
			const size = [
				(box.max[0] - box.min[0]) / 2,
				(box.max[1] - box.min[1]) / 2,
				(box.max[2] - box.min[2]) / 2,
			];
			const scale = 1 / Math.max(...size);
			obj.shiftAndScale(shift, scale);

			// Swap Y-Z to match coordinate system
			for (let i = 0; i < obj.vpos.length; ++i) {
				let temp = obj.vpos[i][1];
				obj.vpos[i][1] = obj.vpos[i][2];
				obj.vpos[i][2] = temp;
			}

			const buffers = obj.getVertexBuffers();
			meshDrawer.setMesh(buffers.positionBuffer, buffers.texCoordBuffer, buffers.normalBuffer);

			// Load and apply texture
			const img = new Image();
			img.onload = function () {
				meshDrawer.setTexture(img);
				DrawScene();
			};
			img.src = 'hornet/hornet_color.png';  // use correct path or URL here
		};
		reader.readAsText(input.files[0]);
	}
}

class MeshDrawer {
	constructor() {
		this.prog = InitShaderProgram(this._vertSource(), this._fragSource());
		this.mvpLoc = gl.getUniformLocation(this.prog, 'mvp');
		this.mvLoc = gl.getUniformLocation(this.prog, 'mv');
		this.normalMatLoc = gl.getUniformLocation(this.prog, 'normalMat');
		this.lightDirLoc = gl.getUniformLocation(this.prog, 'lightDir');
		this.shininessLoc = gl.getUniformLocation(this.prog, 'shininess');
		this.showTexLoc = gl.getUniformLocation(this.prog, 'showTexture');
		this.swapYZLoc = gl.getUniformLocation(this.prog, 'swapYZ');
		this.textureIDLoc = gl.getUniformLocation(this.prog, 'textureID');

		this.showTex = true;
		this.swapYZFlag = true;
		this.meshReady = false;
		this.textureReady = false;
	}

	setMesh(vertPos, texCoords, normals) {
		this.numVertices = vertPos.length / 3;
		this._createBuffer('pos', vertPos, 3);
		this._createBuffer('uv', texCoords, 2);
		this._createBuffer('normal', normals, 3);
		this.meshReady = true;
	}

	setTexture(img) {
		this.texture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, this.texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
		gl.generateMipmap(gl.TEXTURE_2D);
		this.textureReady = true;
	}

	showTexture(show) {
		this.showTex = show;
	}

	swapYZ(swap) {
		this.swapYZFlag = swap;
	}

	setLightDir(x, y, z) {
		this.lightDir = [x, y, z];
	}

	setShininess(sh) {
		this.shininess = sh;
	}

	draw(mvp, mv = mvp, normalMat = [
		mv[0], mv[1], mv[2],
		mv[4], mv[5], mv[6],
		mv[8], mv[9], mv[10]
	]) {
		if (!this.meshReady) return;

		gl.useProgram(this.prog);
		gl.uniformMatrix4fv(this.mvpLoc, false, mvp);
		gl.uniformMatrix4fv(this.mvLoc, false, mv);
		gl.uniformMatrix3fv(this.normalMatLoc, false, normalMat);
		gl.uniform3fv(this.lightDirLoc, this.lightDir || [0, 0, 1]);
		gl.uniform1f(this.shininessLoc, this.shininess || 32);
		gl.uniform1i(this.showTexLoc, this.showTex);
		gl.uniform1i(this.swapYZLoc, this.swapYZFlag);

		if (this.textureReady) {
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, this.texture);
			gl.uniform1i(this.textureIDLoc, 0);
		}

		this._bindBuffer('pos', 3);
		this._bindBuffer('uv', 2);
		this._bindBuffer('normal', 3);

		gl.drawArrays(gl.TRIANGLES, 0, this.numVertices);
	}

	_createBuffer(name, data, size) {
		const buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
		this[name + 'Buffer'] = { buffer, size };
	}

	_bindBuffer(name, size) {
		const loc = gl.getAttribLocation(this.prog, name);
		if (loc < 0 || !this[name + 'Buffer']) return;
		gl.bindBuffer(gl.ARRAY_BUFFER, this[name + 'Buffer'].buffer);
		gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
		gl.enableVertexAttribArray(loc);
	}

	_vertSource() {
		return `
			attribute vec3 pos;
			attribute vec3 normal;
			attribute vec2 uv;
			uniform bool swapYZ;
			uniform mat4 mvp;
			uniform mat4 mv;
			uniform mat3 normalMat;
			varying vec2 vUV;
			varying vec3 vNormal;
			varying vec3 vViewDir;
			void main() {
				vec4 p = vec4(pos,1);
				if (swapYZ) p = vec4(p.x, p.z, p.y, 1);
				gl_Position = mvp * p;
				vUV = uv;
				vNormal = normalMat * normal;
				vViewDir = -(mv * vec4(pos,1)).xyz;
			}
		`;
	}

	_fragSource() {
		return `
			precision mediump float;
			varying vec2 vUV;
			varying vec3 vNormal;
			varying vec3 vViewDir;
			uniform sampler2D textureID;
			uniform bool showTexture;
			uniform vec3 lightDir;
			uniform float shininess;
			const float ambient = 0.1;
			const vec3 Kd = vec3(1);
			const vec3 Ks = vec3(1);
			const vec3 L = vec3(1);
			void main() {
				vec3 N = normalize(vNormal);
				vec3 W = normalize(lightDir);
				vec3 V = normalize(vViewDir);
				vec3 H = normalize(W + V);
				float diff = max(dot(W,N),0.0);
				float spec = pow(max(dot(H,N),0.0), shininess);
				if (showTexture) {
					vec3 texCol = texture2D(textureID, vUV).xyz;
					gl_FragColor = vec4(L * (texCol * diff + Ks * spec), 1);
				} else {
					gl_FragColor = vec4(L * (Kd * diff + Ks * spec), 1);
				}
			}
		`;
	}
}