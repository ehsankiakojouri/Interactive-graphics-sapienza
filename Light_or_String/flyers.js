export class FlyingObject {
	constructor(lowModel, highModel) {
		this.lowModel = lowModel;
		this.highModel = highModel;
		this.current = lowModel;
		this.position = [0, 0, 0];
		this.timer = 0;
	}

	setPosition(pos) {
		this.position = pos;
		this.lowModel.setPosition(...pos);
		this.highModel.setPosition(...pos);
	}

	update(dt) {
		this.timer += dt;
		const useHigh = Math.floor(this.timer * 5) % 2 === 0;
		this.current = useHigh ? this.highModel : this.lowModel;
		this.current.setPosition(...this.position);
	}

	draw(shader) {
		if (this.current.ready) {
			this.current.draw(shader);
		}
	}
}

export class FlyingManager {
	constructor() {
		this.objects = [];
	}

	add(flyer) {
		this.objects.push(flyer);
	}

	update(dt) {
		for (let obj of this.objects) {
			obj.update(dt);
		}
	}

	draw(shader) {
		for (let obj of this.objects) {
			obj.draw(shader);
		}
	}
}
