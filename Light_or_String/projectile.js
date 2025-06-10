class Projectile {
        constructor(gl, meshPath, texturePath) {
                this.drawer = new MeshDrawer(gl);
                this.position = [0, 0, 0];
                this.velocity = [0, 0, 0];
                this.active = true;
                this.released = false;
                this.sphereIdx = null;

		// Load mesh
                fetch(meshPath)
                        .then(res => res.text())
                        .then(obj => {
                                const mesh = new ObjMesh();
                                mesh.parse(obj);
                                const bbox = mesh.getBoundingBox();
                                const size = [
                                        bbox.max[0]-bbox.min[0],
                                        bbox.max[1]-bbox.min[1],
                                        bbox.max[2]-bbox.min[2]
                                ];
                                const maxSize = Math.max(...size);
                                const scale = 0.5; // provided scale
                                mesh.shiftAndScale([0,0,0], scale);
                                mesh.computeNormals();
                                const diag = Math.sqrt(size[0]*size[0]+size[1]*size[1]+size[2]*size[2]);
                                const radius = 0.5 * diag * scale;
                                if (this.sphereIdx === null) {
                                        this.sphereIdx = spheres.length;
                                        spheres.push({
                                                center: this.position.slice(),
                                                radius: radius,
                                                mtl: {k_d:[0.3,0.9,0.3], k_s:[0.05,0.05,0.05], n:5},
                                                hidden: true
                                        });
                                        if (ray_tracer) ray_tracer.init();
                                } else {
                                        spheres[this.sphereIdx].radius = radius;
                                }
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
                if (this.sphereIdx !== null) {
                        spheres[this.sphereIdx].center = this.position.slice();
                }
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
