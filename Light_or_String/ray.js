class RayTracer
{
	constructor()
	{
		this.sphere = new SphereProg;
	}
	initProg( vs, fs )
	{
		if ( this.prog ) gl.deleteProgram( this.prog );

		const raytraceFS_head = raytraceFS_header + `
			#define NUM_SPHERES ` + spheres.length + `
			#define NUM_LIGHTS  ` + lights.length + `
		`;
		this.prog = InitShaderProgram( vs, raytraceFS_head+raytraceFS+fs );
		if ( ! this.prog ) return;
		
		function setMaterial( prog, v, mtl )
		{
			gl.uniform3fv( gl.getUniformLocation( prog, v+'.k_d' ), mtl.k_d );
			gl.uniform3fv( gl.getUniformLocation( prog, v+'.k_s' ), mtl.k_s );
			gl.uniform1f ( gl.getUniformLocation( prog, v+'.n'   ), mtl.n   );
		}
		
		gl.useProgram( this.prog );
                this.uSphereCenter = [];
                for ( var i=0; i<spheres.length; ++i ) {
                        gl.uniform3fv( gl.getUniformLocation( this.prog, 'spheres['+i+'].center' ), spheres[i].center );
                        gl.uniform1f ( gl.getUniformLocation( this.prog, 'spheres['+i+'].radius' ), spheres[i].radius );
                        setMaterial( this.prog, 'spheres['+i+'].mtl', spheres[i].mtl );
                        this.uSphereCenter[i] = gl.getUniformLocation( this.prog, 'spheres['+i+'].center' );
                }
                for ( var i=0; i<lights.length; ++i ) {
                        gl.uniform3fv( gl.getUniformLocation( this.prog, 'lights['+i+'].position'  ), lights[i].position  );
                        gl.uniform3fv( gl.getUniformLocation( this.prog, 'lights['+i+'].intensity' ), lights[i].intensity );
                        gl.uniform1f ( gl.getUniformLocation( this.prog, 'lights['+i+'].radius'    ), lights[i].radius );
                }
                this.uLightPos = [];
                this.uLightInt = [];
                this.uLightRad = [];
                for (let i = 0; i < lights.length; ++i) {
                        this.uLightPos[i] = gl.getUniformLocation(this.prog,
                                                                `lights[${i}].position`);
                        this.uLightInt[i] = gl.getUniformLocation(this.prog,
                                                                `lights[${i}].intensity`);
                        this.uLightRad[i] = gl.getUniformLocation(this.prog,
                                                                `lights[${i}].radius`);
                }
		this.updateProj();
	}
	updateProj()
	{
		if ( ! this.prog ) return;
		gl.useProgram( this.prog );
		var proj = gl.getUniformLocation( this.prog, 'proj' );
		gl.uniformMatrix4fv( proj, false, perspectiveMatrix );
	}
	init()
	{
		this.initProg( document.getElementById('sphereVS').text, raytraceFS_secondary );
		if ( ! this.prog ) return;
		this.sphere.prog = this.prog;
		this.sphere.init();
	}
	draw( mvp, trans )
	{
		if ( ! this.prog ) return;
		this.updateLights();
		background.draw( trans );
                this.sphere.setTrans( mvp, [ trans.camToWorld[12], trans.camToWorld[13], trans.camToWorld[14] ] );
                spheres.forEach( s => { if (!s.hidden) this.sphere.draw(s); } );
        }

        updateLights() {
                gl.useProgram(this.prog);
                for (let i = 0; i < lights.length; ++i) {
                        gl.uniform3fv(this.uLightPos[i], lights[i].position);
                        gl.uniform3fv(this.uLightInt[i], lights[i].intensity);
						gl.uniform1f(this.uLightRad[i], lights[i].radius);

                }
        }

        updateSpheres() {
                if (!this.prog) return;
                gl.useProgram(this.prog);
                for (let i = 0; i < spheres.length; ++i) {
                        gl.uniform3fv(this.uSphereCenter[i], spheres[i].center);
                }
        }

};


var raytraceFS = `
struct Ray {
	vec3 pos;
	vec3 dir;
};

struct Material {
	vec3  k_d;	// diffuse coefficient
	vec3  k_s;	// specular coefficient
	float n;	// specular exponent
};

struct Sphere {
	vec3     center;
	float    radius;
	Material mtl;
};

struct Light {
	vec3 position;
	vec3 intensity;
	float radius;

};

struct HitInfo {
        float    t;
        vec3     position;
        vec3     normal;
        Material mtl;
        vec3     center;
        float    radius;
};

uniform Sphere spheres[ NUM_SPHERES ];
uniform Light  lights [ NUM_LIGHTS  ];
uniform samplerCube envMap;

float reflectionBiasCoefficient = 1e-9;

bool IntersectRay( inout HitInfo hit, Ray ray );
float SoftShadow( Ray ray, Light light );

// Shades the given point and returns the computed color.
vec3 Shade( Material mtl, vec3 position, vec3 normal, vec3 view )
{
	vec3 color = vec3(0,0,0);
	
	for ( int i=0; i<NUM_LIGHTS; ++i ) {
		Ray toLightRay = Ray(position, normalize(lights[i].position - position));

               // Compute a soft shadow factor in [0,1]
               float shadow = SoftShadow(toLightRay, lights[i]);

               // If not completely shadowed, perform shading using the Blinn model
               if (shadow > 0.0){
                       vec3 h = normalize(toLightRay.dir + view);
                       float cosTheta = dot(toLightRay.dir, normal);
                       float cosPhi = dot(h, normal);
                       color += lights[i].intensity * shadow * max(0.0, cosTheta) *(mtl.k_d + mtl.k_s * (pow(max(cosPhi, 0.0), mtl.n)/cosTheta));
               }
       }
	return color;
}

// Intersects the given ray with all spheres in the scene
// and updates the given HitInfo using the information of the sphere
// that first intersects with the ray.
// Returns true if an intersection is found.
bool IntersectRay( inout HitInfo hit, Ray ray )
{
	hit.t = 1e30;
	bool foundHit = false;
	for ( int i=0; i<NUM_SPHERES; ++i ) {
		float a = dot(ray.dir, ray.dir);
		float b = 2.0 * dot(ray.dir, (ray.pos - spheres[i].center));
		float c = dot((ray.pos - spheres[i].center), (ray.pos - spheres[i].center)) - pow(spheres[i].radius, 2.0);
		float delta = pow(b, 2.0) - 4.0 * a * c;

		if (delta >= 0.0){
			float newT = (-b - sqrt(delta)) / (2.0 * a);
			if (newT >= reflectionBiasCoefficient && newT <= hit.t){
				hit.t = newT;
				hit.position = ray.pos + newT*ray.dir;
				hit.normal = normalize(hit.position - spheres[i].center);
                               hit.mtl = spheres[i].mtl;
                               hit.center = spheres[i].center;
                               hit.radius = spheres[i].radius;
                               foundHit = true;
                        }
                }
        }
	return foundHit;
}

float SoftShadow(Ray ray, Light light)
{
        const int NUM_SAMPLES = 4;
        vec3 baseDir = normalize(light.position - ray.pos);

        // Build an orthonormal basis around the light direction
        vec3 up = abs(baseDir.y) < 0.99 ? vec3(0.0,1.0,0.0) : vec3(1.0,0.0,0.0);
        vec3 tangent = normalize(cross(up, baseDir));
        vec3 bitangent = cross(baseDir, tangent);

        vec2 offsets[4];
        offsets[0] = vec2(-0.5, -0.5);
        offsets[1] = vec2( 0.5, -0.5);
        offsets[2] = vec2(-0.5,  0.5);
        offsets[3] = vec2( 0.5,  0.5);

        float shade = 0.0;
        for (int s = 0; s < NUM_SAMPLES; ++s) {
                vec3 samplePos = light.position +
                        light.radius * (offsets[s].x * tangent + offsets[s].y * bitangent);
                vec3 dir = samplePos - ray.pos;
                float dist = length(dir);
                Ray r = Ray(ray.pos, dir / dist);
                HitInfo h;
                if (!IntersectRay(h, r) || h.t > dist) shade += 1.0;
        }
        return shade / float(NUM_SAMPLES);
}

// Given a ray, returns the shaded color where the ray intersects a sphere.
// If the ray does not hit a sphere, returns the environment color.
vec4 RayTracer( Ray ray )
{
	HitInfo hit;
	if ( IntersectRay( hit, ray ) ) {
		vec3 view = normalize( -ray.dir );
                vec3 clr = Shade( hit.mtl, hit.position, hit.normal, view );
                float centerDist = length(hit.position - hit.center);
                float edgeFade = 1.0 - smoothstep(hit.radius*0.7, hit.radius, centerDist);
                clr *= edgeFade;

                // Compute reflections
                vec3 k_s = hit.mtl.k_s;
                if (hit.mtl.k_s.r + hit.mtl.k_s.g + hit.mtl.k_s.b > 0.0) {
                        Ray r;
			r.pos = hit.position;
			r.dir = reflect(ray.dir, hit.normal);

			HitInfo h;
			if (IntersectRay(h, r)) {
                                clr += Shade(h.mtl, h.position, h.normal, view) * hit.mtl.k_s * edgeFade;
                        } else {
                                clr += hit.mtl.k_s * textureCube(envMap, r.dir.xzy).rgb * edgeFade;
                        }
                }

		return vec4( clr, 1 );	// return the accumulated color, including the reflections
	} else {
		return vec4( textureCube( envMap, ray.dir.xzy ).rgb, 1 );	// return the environment color
	}
}
`;