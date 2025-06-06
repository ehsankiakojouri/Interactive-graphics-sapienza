class FlyingObject {
	constructor(max_boxlowObjMesh, highObjMesh, gl, max_box, min_box) {
		this.lowDrawer = new MeshDrawer(gl);
		this.highDrawer = new MeshDrawer(gl);
		this.current = this.lowDrawer;
		this.position = this.getRandomPosition();
		this.timer = 0;
		this.max_box = max_box;
		this.min_box = min_box;
	}
	getRandomPosition() {
		return [
			(Math.random() - 0.5) * 50, // spread in x
			Math.random() * 25, // spread in x
			(Math.random() - 0.5) * 50  // spread in z
		];
	}

	setMeshFromFile(objFilePath, type) {
		return fetch(objFilePath)
			.then(response => response.text())
			.then(objdata => {
				const mesh = new ObjMesh();
				mesh.parse(objdata);
				const shift = [
					(-(this.min_box[0] + this.max_box[0]) / 3) + this.position[0],
					(-(this.min_box[1] + this.max_box[1]) / 3) + this.position[1],
					(-(this.min_box[2] + this.max_box[2]) / 3) + this.position[2]
				];
				const size = [
					(this.max_box[0] - this.min_box[0]) / 3,
					(this.max_box[1] - this.min_box[1]) / 3,
					(this.max_box[2] - this.min_box[2]) / 3
				];
				const maxSize = Math.max(...size);
				const scale = 0.3 / maxSize;
				
				mesh.shiftAndScale(shift, scale);
				mesh.computeNormals();

				const vbufs = mesh.getVertexBuffers();
				if (type === 'low') {
					this.lowDrawer.setMesh(vbufs.positionBuffer, vbufs.texCoordBuffer, vbufs.normalBuffer);
				} else if (type === 'high') {
					this.highDrawer.setMesh(vbufs.positionBuffer, vbufs.texCoordBuffer, vbufs.normalBuffer);
				}
				this.lowDrawer.swapYZ(true);
				this.highDrawer.swapYZ(true);
			});
	}
	setPosition(pos) {
		this.position = pos;
	}

	update(dt) {
		this.timer += dt;
		const useHigh = Math.floor(this.timer * 30) % 2 === 0;
		this.current = useHigh ? this.highDrawer : this.lowDrawer;
	}
	
	setTextureFromFile(imgFilePath) {
		console.log("Loaded texture", imgFilePath);
		const img = new Image();
		img.onload = () => {
			this.lowDrawer.setTexture(img);
			this.highDrawer.setTexture(img);
		};
		img.src = imgFilePath;
		this.lowDrawer.showTexture(true);
		this.highDrawer.showTexture(true);
	}


	draw(mvp, mv, normalMat) {
		this.current.draw(mvp, mv, normalMat);
	}
}


class FlyingManager {
	constructor() {
		this.hornets = [];
		this.fireflies = [];
	}

	addHornet(flyer) {
		this.hornets.push(flyer);
		flyer.setTextureFromFile('hornet/hornet_color.png');
	}

	addFirefly(flyer) {
		this.fireflies.push(flyer);
		flyer.setTextureFromFile('firefly/firefly_color.png');
	}

	update(dt) {
		for (let hornet of this.hornets) {
			hornet.update(dt);
		}
		for (let firefly of this.fireflies) {
			firefly.update(dt);
		}
	}

	draw(mvp, mv, normalMat) {
		for (let hornet of this.hornets) {
			hornet.draw(mvp, mv, normalMat);
		}
		for (let firefly of this.fireflies) {
			firefly.draw(mvp, mv, normalMat);
		}
	}

	killFirefly(index) {
		if (index >= 0 && index < this.fireflies.length) {
			this.fireflies.splice(index, 1);
		}
	}
	killFireflyByRef(flyer) {
	const i = this.fireflies.indexOf(flyer);
	if (i !== -1) {
		this.killFirefly(i);
	}
}

}
