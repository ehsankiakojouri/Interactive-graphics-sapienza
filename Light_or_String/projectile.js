class Projectile {
	constructor(gl, meshPath, texturePath) {
		this.drawer = new MeshDrawer(gl);
		this.position = [0, 0, 0];
		this.velocity = [0, 0, 0];
		this.active = true;
		this.released = false;

		// Load mesh
		fetch(meshPath)
			.then(res => res.text())
			.then(obj => {
				const mesh = new ObjMesh();
				mesh.parse(obj);
				mesh.shiftAndScale([0, 0, 0], 0.5); // small slime
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

	launch(position, velocity) {
		this.position = position.slice();
		this.velocity = velocity.slice();
		this.active = true;
	}

	update(dt) {
		if (!this.active) return;

		// Update position with simple physics
		// const gravity = -9.8;
		// this.velocity[1] += gravity * dt;  // Apply gravity on Y axis
		// for (let i = 0; i < 3; i++) {
		// 	this.position[i] += this.velocity[i] * dt;
		// }

		// // Deactivate if too low
		// if (this.position[1] < -1) this.active = false;
	}

	draw(mvp, mv, normalMat) {
		if (!this.active) return;

		const tx = this.position[0];
		const ty = this.position[1];
		const tz = this.position[2];
		const rotX = 0, rotY = 0;
		const localMV = GetModelViewMatrix(tx, ty, tz, rotX, rotY);
		const combinedMVP = MatrixMult(mvp, localMV);
		this.drawer.draw(combinedMVP, localMV, normalMat);
	}
}
