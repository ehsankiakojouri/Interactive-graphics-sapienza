function TriSphere(subdiv)
{
	var faces = [];
	var verts = [];
	verts.push(0,0, 1);
	verts.push(0,0,-1);
	var vpt = 0;
	var vpb = 1;
	var vi = 2;
	for ( var i=1; i<subdiv; ++i ) {
		var a = Math.PI * i / (2*subdiv);
		var z = Math.cos(a);
		var r = Math.sin(a);
		a = 0;
		var da = Math.PI / (2*i);
		var v0t = vpt;
		var v0b = vpb;
		var v1t = vi++;
		var v1b = vi++;
		verts.push(r,0, z);
		verts.push(r,0,-z);
		for ( var s=0; s<4; ++s ) {
			for ( var j=1; j<i; ++j ) {
				a += da;
				var x = Math.cos(a)*r;
				var y = Math.sin(a)*r;
				verts.push( x, y,  z );
				verts.push( x, y, -z );
				faces.push( v0t, vi-2, vi );
				faces.push( v0t, vi, v0t+2 );
				faces.push( v0b, vi-1, vi+1 );
				faces.push( v0b, vi+1, v0b+2 );
				v0t+=2;
				v0b+=2;
				vi+=2;
			}
			if ( s < 3 ) {
				a += da;
				var x = Math.cos(a)*r;
				var y = Math.sin(a)*r;
				verts.push( x, y,  z );
				verts.push( x, y, -z );
				faces.push( v0t, vi-2, vi );
				faces.push( v0b, vi-1, vi+1 );
				vi+=2;
			}
		}
		if ( i > 1 ) {
			faces[ faces.length-7 ] = vpt;
			faces[ faces.length-1 ] = vpb;
		}
		faces.push( vpt, vi-2, v1t );
		faces.push( vpb, vi-1, v1b );
		vpt = v1t;
		vpb = v1b;
	}
	var a = 0;
	var da = Math.PI / (2*subdiv);
	verts.push(1,0,0);
	var v0t = vpt;
	var v0b = vpb;
	var v1 = vi++;
	for ( var s=0; s<4; ++s ) {
		for ( var j=1; j<subdiv; ++j ) {
			a += da;
			var x = Math.cos(a);
			var y = Math.sin(a);
			verts.push( x, y, 0 );
			faces.push( v0t, vi-1, vi );
			faces.push( v0t, vi, v0t+2 );
			faces.push( v0b, vi-1, vi );
			faces.push( v0b, vi, v0b+2 );
			v0t+=2;
			v0b+=2;
			vi++;
		}
		if ( s < 3 ) {
			a += da;
			var x = Math.cos(a);
			var y = Math.sin(a);
			verts.push( x, y, 0 );
			faces.push( v0t, vi-1, vi );
			faces.push( v0b, vi-1, vi );
			vi++;
		}
	}
	if ( subdiv > 1 ) {
		faces[ faces.length-7 ] = vpt;
		faces[ faces.length-1 ] = vpb;
	}
	faces.push( vpt, vi-1, v1 );
	faces.push( vpb, vi-1, v1 );
	return { pos:verts, elems:faces };
}

var triSphere = {
	init()
	{
		var b = TriSphere(20);
		this.pbuf = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.pbuf);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(b.pos), gl.STATIC_DRAW);
		this.ebuf = gl.createBuffer();
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ebuf);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(b.elems), gl.STATIC_DRAW);
		this.count = b.elems.length;
	},
	draw( vp )
	{
		gl.bindBuffer( gl.ARRAY_BUFFER, this.pbuf );
		gl.vertexAttribPointer( vp, 3, gl.FLOAT, false, 0, 0 );
		gl.enableVertexAttribArray( vp );
		gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, this.ebuf );
		gl.drawElements( gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0 );
	}
};

class SphereProg
{
	init()
	{
		this.mvp     = gl.getUniformLocation( this.prog, 'mvp' );
		this.campos  = gl.getUniformLocation( this.prog, 'campos' );
		this.center  = gl.getUniformLocation( this.prog, 'center' );
		this.radius  = gl.getUniformLocation( this.prog, 'radius' );
		this.mtl_k_d = gl.getUniformLocation( this.prog, 'mtl.k_d' );
		this.mtl_k_s = gl.getUniformLocation( this.prog, 'mtl.k_s' );
		this.mtl_n   = gl.getUniformLocation( this.prog, 'mtl.n' );
		this.vp      = gl.getAttribLocation ( this.prog, 'p' );
	}
	setTrans( mvp, campos )
	{
		gl.useProgram( this.prog );
		gl.uniformMatrix4fv( this.mvp, false, mvp );
		gl.uniform3fv( this.campos, campos );
	}
        setLight( pos, intens, radius )
        {
                gl.useProgram( this.prog );
                gl.uniform3fv( gl.getUniformLocation( this.prog, 'light.position'  ), pos    );
                gl.uniform3fv( gl.getUniformLocation( this.prog, 'light.intensity' ), intens );
                gl.uniform1f ( gl.getUniformLocation( this.prog, 'light.radius'    ), radius );
        }
	draw( sphere )
	{
		gl.useProgram( this.prog );
		gl.uniform3fv( this.center,  sphere.center  );
		gl.uniform1f ( this.radius,  sphere.radius  );
		gl.uniform3fv( this.mtl_k_d, sphere.mtl.k_d );
		gl.uniform3fv( this.mtl_k_s, sphere.mtl.k_s );
		gl.uniform1f ( this.mtl_n,   sphere.mtl.n   );
		triSphere.draw( this.vp );
	}
};

// class SphereDrawer extends SphereProg
// {
// 	constructor()
// 	{
// 		super();
// 		this.prog = InitShaderProgramFromScripts( 'sphereVS', 'sphereFS' );
// 		this.init();
// 	}
// };

class SphereDrawer extends SphereProg {
    constructor() { super(); this.recompile(); }

    /* re-build when light count changes ---------------------- */
    recompile() {
        const vsSrc = document.getElementById('sphereVS').text;
        const fsTpl = document.getElementById('sphereFS_multi').text;
        const fsSrc = `#define NUM_LIGHTS ${lights.length}\n` + fsTpl;

        this.prog = InitShaderProgram(vsSrc, fsSrc);
        this.init();                        // ↖ caches common uniforms

        /* cache the per-light uniform locations --------------- */
        this.uLightPos = [];
        this.uLightInt = [];
		this.uLightRad = [];

        for (let i = 0; i < lights.length; ++i) {
            this.uLightPos[i] =
                 gl.getUniformLocation(this.prog, `lights[${i}].position`);
            this.uLightInt[i] =
                 gl.getUniformLocation(this.prog, `lights[${i}].intensity`);
			this.uLightRad[i] =
                 gl.getUniformLocation(this.prog, `lights[${i}].radius`);
        }
    }

    /* called once per frame ---------------------------------- */
    updateLights() {
        gl.useProgram(this.prog);
        for (let i = 0; i < lights.length; ++i) {
            gl.uniform3fv(this.uLightPos[i], lights[i].position);
            gl.uniform3fv(this.uLightInt[i], lights[i].intensity);
            gl.uniform1f(this.uLightRad[i], lights[i].radius);
        }
    }
}

class GlowSprite {
    constructor(baseRadius = 0.7, color = [0.6, 0.9, 1.3]) {
        this.baseR  = baseRadius;
        // this.color = color;
		// In GlowSprite constructor or firefly init
		const baseHue = 0.18 + 0.04 * Math.random(); // yellow-green hues
		this.color = hsvToRgb(baseHue, 1.0, 1.0);    // full saturation, full value

        this.prog = InitShaderProgramFromScripts('glowVS','glowFS');
		this.uInt = gl.getUniformLocation(this.prog, "intensity");
        this.uMVP = gl.getUniformLocation(this.prog, "mvp");
        this.uCen = gl.getUniformLocation(this.prog, "center");
        this.uScale = gl.getUniformLocation(this.prog, "scale");
        this.uRad = gl.getUniformLocation(this.prog, "radius");
        this.uCol = gl.getUniformLocation(this.prog, "glowColor");
        this.uGam = gl.getUniformLocation(this.prog, "gamma");   // NEW
        this.vPos = gl.getAttribLocation (this.prog, "p");
    }

    /* draw N nested shells -------------------------------------------- */
    draw(mvp, center, flick) {
        gl.useProgram(this.prog);
        gl.uniformMatrix4fv(this.uMVP, false, mvp);
        gl.uniform3fv   (this.uCen, center);
        gl.uniform3fv   (this.uCol, this.color);
        gl.depthMask(false);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

        const LAYERS = 20;           // how many shells
        const GAMMA  = 0.95;        // base γ  (outermost shell)
        const RAD_K  = 1.4;         // radius→fade multiplier (same as before)
		const BASE_INT = 0.001;   // outermost shell
		const CORE_INT = 0.05;   // innermost shell (optional)

		for (let i = 0; i < LAYERS; ++i) {
			const g      = Math.pow(GAMMA, i);          // γ, γ², γ³…
			const s      = this.baseR * flick * g;
			const fade   = i / (LAYERS - 1);            // 0 → outer, 1 → inner
			const inten  = BASE_INT + (CORE_INT - BASE_INT) * fade;

			gl.uniform1f(this.uScale, s);
			gl.uniform1f(this.uRad,   s * RAD_K);
			gl.uniform1f(this.uGam,   g);
			gl.uniform1f(this.uInt,   inten);           // pass intensity
			triSphere.draw(this.vPos);
		}

        // for (let i = 0; i < LAYERS; ++i) {
        //     const g = Math.pow(GAMMA, i);         // γ, γ², γ³, …
        //     const s = this.baseR * flick * g;     // shrink geometry
        //     gl.uniform1f(this.uScale, s);
        //     gl.uniform1f(this.uRad,   s * RAD_K); // keep fade in sync
        //     gl.uniform1f(this.uGam,   g);         // pass current γ
        //     triSphere.draw(this.vPos);
        // }

        gl.disable(gl.BLEND);
        gl.depthMask(true);
    }
}