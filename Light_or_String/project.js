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
};

struct HitInfo {
	float    t;
	vec3     position;
	vec3     normal;
	Material mtl;
};

uniform Sphere spheres[ NUM_SPHERES ];
uniform Light  lights [ NUM_LIGHTS  ];
uniform samplerCube envMap;

float reflectionBiasCoefficient = 1e-9;

bool IntersectRay( inout HitInfo hit, Ray ray );
bool IsInShadow( Ray ray, Light light );

// Shades the given point and returns the computed color.
vec3 Shade( Material mtl, vec3 position, vec3 normal, vec3 view )
{
	vec3 color = vec3(0,0,0);
	
	for ( int i=0; i<NUM_LIGHTS; ++i ) {
		Ray toLightRay = Ray(position, normalize(lights[i].position - position));

		// Check for shadows
		bool isInShadow = IsInShadow(toLightRay, lights[i]);

		// If not shadowed, perform shading using the Blinn model
		if (isInShadow == false){
			vec3 h = normalize(toLightRay.dir + view);
			float cosTheta = dot(toLightRay.dir, normal);
			float cosPhi = dot(h, normal);
			color += lights[i].intensity * max(0.0, cosTheta) *(mtl.k_d + mtl.k_s * (pow(max(cosPhi, 0.0), mtl.n)/cosTheta));	
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
				foundHit = true;
			}
		}
	}
	return foundHit;
}

bool IsInShadow(Ray ray, Light light)
{
	for ( int i=0; i<NUM_SPHERES; ++i ) {
		float a = dot(ray.dir, ray.dir);
		float b = 2.0 * dot(ray.dir, (ray.pos - spheres[i].center));
		float c = dot((ray.pos - spheres[i].center), (ray.pos - spheres[i].center)) - pow(spheres[i].radius, 2.0);
		float delta = pow(b, 2.0) - 4.0 * a * c;

		if (delta >= 0.0){
			float t = (-b - sqrt(delta)) / (2.0 * a);
			if (t >= reflectionBiasCoefficient){
				return true;
			}
		}		
	}
	return false;
}

// Given a ray, returns the shaded color where the ray intersects a sphere.
// If the ray does not hit a sphere, returns the environment color.
vec4 RayTracer( Ray ray )
{
	HitInfo hit;
	if ( IntersectRay( hit, ray ) ) {
		vec3 view = normalize( -ray.dir );
		vec3 clr = Shade( hit.mtl, hit.position, hit.normal, view );
		
		// Compute reflections
		vec3 k_s = hit.mtl.k_s;
		if (hit.mtl.k_s.r + hit.mtl.k_s.g + hit.mtl.k_s.b > 0.0) {
			Ray r;
			r.pos = hit.position;
			r.dir = reflect(ray.dir, hit.normal);

			HitInfo h;
			if (IntersectRay(h, r)) {
				clr += Shade(h.mtl, h.position, h.normal, view) * hit.mtl.k_s;
			} else {
				clr += hit.mtl.k_s * textureCube(envMap, r.dir.xzy).rgb;
			}
		}

		return vec4( clr, 1 );	// return the accumulated color, including the reflections
	} else {
		return vec4( textureCube( envMap, ray.dir.xzy ).rgb, 1 );	// return the environment color
	}
}
`;