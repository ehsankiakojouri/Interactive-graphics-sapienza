class FlyingObject {
	constructor(lowObjMesh, highObjMesh, gl, max_flight_box, min_flight_box, max_obj_box, min_obj_box) {
		this.max_flight_box = max_flight_box; // bounding box for flight
		this.min_flight_box = min_flight_box;
		this.timer = 0;
		this.max_obj_box = max_obj_box;
		this.min_obj_box = min_obj_box;
		this.isFirefly = false; // default to hornet
		this.lowDrawer = new MeshDrawer(gl);
		this.highDrawer = new MeshDrawer(gl);
		this.current = this.lowDrawer;
		this.position = this.getRandomPosition();

                this.glow = null;
                this.sphereIdx = null;

		    // --- flight brain ---
		this.seed   = performance.now() ^ Math.floor(Math.random()*1e9); // deterministic per object
		this.rand   = mulberry32(this.seed);          // fast PRNG, see helper below
		this.target = this.getRandomPosition();       // current waypoint
		this.vel    = [0, 0, 0];                      // current velocity
		this.speed  = this.isFirefly ? 1.2 : 4.0;     // base speed (m/s)
		this.wobbleAmp = this.isFirefly ? 0.10 : 0.03;// “buzziness”


	}

	getRandomPosition() {
		return [
			randBetween(this.min_flight_box[0], this.max_flight_box[0]),
			randBetween(this.min_flight_box[1], this.max_flight_box[1]), 
			randBetween(this.min_flight_box[2], this.max_flight_box[2]) 
		];
	}

        setMeshFromFile(objFilePath, type) {
                return fetch(objFilePath)
                        .then(response => response.text())
                        .then(objdata => {
                                const mesh = new ObjMesh();
                                mesh.parse(objdata);
				const shift = [
					-(this.min_obj_box[0] + this.max_obj_box[0]) * 0.5,
					-(this.min_obj_box[1] + this.max_obj_box[1]) * 0.5,
					-(this.min_obj_box[2] + this.max_obj_box[2]) * 0.5
				];
				const size = [
					(this.max_obj_box[0] - this.min_obj_box[0]) / 2,
					(this.max_obj_box[1] - this.min_obj_box[1]) / 2,
					(this.max_obj_box[2] - this.min_obj_box[2]) / 2
				];
                                const maxSize = Math.max(...size);
                                const scale = 0.3 / maxSize;

                                mesh.shiftAndScale(shift, scale);
                                mesh.computeNormals();

                                if (type === 'low' && this.sphereIdx === null) {
                                        const diag = Math.sqrt(size[0]*size[0] + size[1]*size[1] + size[2]*size[2]);
                                        const radius = 0.5 * diag * scale;
                                        this.sphereIdx = spheres.length;
                                        spheres.push({
                                                center: this.position.slice(),
                                                radius: radius,
                                                mtl: { k_d:[0.4,0.4,0.4], k_s:[0.1,0.1,0.1], n:10 },
                                                hidden: true
                                        });
                                        if (ray_tracer) ray_tracer.init();
                                }

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
update(dt, light_id) {
    this.timer += dt;

    /* mesh LOD swap – unchanged */
    const useHigh = Math.floor(this.timer * 30) % 2 === 0;
    this.current  = useHigh ? this.highDrawer : this.lowDrawer;

if (this.isFirefly) {
    const flick = 0.85 + 0.15 * Math.sin(this.timer*10.0 + this.seed);
    this.glowFlick = flick;
    if (light_id !== null) {
        lights[light_id].intensity = [
            0.30*flick, 0.30*flick, 0.24*flick   // cooler tint
        ];
    }
}
    /* -------- flight logic -------- */
    // 3-A: steer toward the current waypoint
    const dir = [
        this.target[0] - this.position[0],
        this.target[1] - this.position[1],
        this.target[2] - this.position[2]
    ];
    const dist = Math.hypot(...dir);
    if (dist < 0.2) {                   // arrived → choose a new waypoint
        this.target = this.pickNewTarget();
    } else {
        // normalised direction
        dir[0] /= dist; dir[1] /= dist; dir[2] /= dist;
        // first-order acceleration toward dir (critically damped)
        const ACC = this.speed * 2.5;    // 2.5 is ζ≈1 overdamped factor
        this.vel[0] += dir[0] * ACC * dt;
        this.vel[1] += dir[1] * ACC * dt;
        this.vel[2] += dir[2] * ACC * dt;
    }

    // 3-B: tiny random wobble (smooth, not jittery) --------------------
    const t = this.timer + this.seed * 0.001;
    // three independent, cheap pseudo-sine generators
    const wobble = [
        Math.sin(t*3.11) + Math.sin(t*2.13+1.1),
        Math.sin(t*2.87+0.5) + Math.sin(t*2.03),
        Math.sin(t*3.71+2.7) + Math.sin(t*1.97+3.3)
    ];
    const k = this.wobbleAmp; // amplitude
    this.position[0] += (this.vel[0] + wobble[0]*k) * dt;
    this.position[1] += (this.vel[1] + wobble[1]*k) * dt;
    this.position[2] += (this.vel[2] + wobble[2]*k) * dt;

    // 3-C: confine inside box (reflect if outside)
    for (let i = 0; i < 3; ++i) {
        if (this.position[i] < this.min_flight_box[i]) {
            this.position[i]  = this.min_flight_box[i];
            this.vel[i] *= -0.5;
        }
        if (this.position[i] > this.max_flight_box[i]) {
            this.position[i]  = this.max_flight_box[i];
            this.vel[i] *= -0.5;
        }
    }

    /* -------- light follow -------- */
    if (light_id !== null) {
        lights[light_id].position = this.position;
    }
	
    if (this.sphereIdx !== null) {
        spheres[this.sphereIdx].center = this.position.slice();
    }
}

	// // Modified update
	// update(dt, light_id) {
	// 	this.timer += dt;
	// 	const useHigh = Math.floor(this.timer * 30) % 2 === 0;
	// 	this.current = useHigh ? this.highDrawer : this.lowDrawer;

	// 	for (let i = 0; i < 3; i++) {
	// 		// Update position with velocity integration as in AMR
	// 	}
	// 	if (light_id !== null) {
	// 		lights[light_id].position = this.position; // Update light position
	// 	}

	// }

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

pickNewTarget() {
    // Keeps them inside your min/max box with a 15 % margin
    const margin = 0.15;
    const span   = [
        (this.max_flight_box[0]-this.min_flight_box[0])*(1-2*margin),
        (this.max_flight_box[1]-this.min_flight_box[1])*(1-2*margin),
        (this.max_flight_box[2]-this.min_flight_box[2])*(1-2*margin)
    ];
    return [
        this.min_flight_box[0] + span[0]*(margin + this.rand()),
        this.min_flight_box[1] + span[1]*(margin + this.rand()),
        this.min_flight_box[2] + span[2]*(margin + this.rand())
    ];
}

	draw(mvp, mv, normalMat) {
		const tx = this.position[0];
		const ty = this.position[1];
		const tz = this.position[2];
		const rotX = 0, rotY = 0;
		const localMV = GetModelViewMatrix(tx, ty, tz, rotX, rotY);
		const combinedMVP = MatrixMult(mvp, localMV);
		if (this.isFirefly && this.glow) {
			this.glow.draw(mvp, this.position, this.glowFlick);
		}
		this.current.draw(combinedMVP, localMV, normalMat);
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
		flyer.isFirefly = true; 
		flyer.glow = new GlowSprite();
		flyer.setTextureFromFile('firefly/firefly_color.png');
		return flyer.position; // return initial position
	}

	update(dt) {
		for (let hornet of this.hornets) {
			hornet.update(dt, null); // no light needed
		}

		for (let i = 0; i < this.fireflies.length; i++) {
			this.fireflies[i].update(dt, i);
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
