export const sphereVS = `
attribute vec3 p;
uniform mat4  mvp;
uniform vec3  center;
uniform float radius;
varying vec3 pos;
varying vec3 normal;
void main()
{
	pos = p*radius + center;
    gl_Position = mvp * vec4(pos,1);
	normal = p;
}
`;

export const sphereFS = `
precision mediump float;
struct Material {
	vec3  k_d;	// diffuse coefficient
	vec3  k_s;	// specular coefficient
	float n;	// specular exponent
};
struct Light {
	vec3 position;
	vec3 intensity;
};
uniform samplerCube envMap;
uniform Light    light;
uniform vec3     campos;
uniform Material mtl;
varying vec3     pos;
varying vec3     normal;
void main()
{
	vec3 nrm = normalize(normal);
	vec3 view = normalize( campos - pos );
	vec3 color = vec3(0,0,0);
	vec3 L = normalize( light.position - pos );
	float c = dot( nrm, L );
	if ( c > 0.0 ) {
		vec3 clr = c * mtl.k_d;
		vec3 h = normalize( L + view );
		float s = dot( nrm, h );
		if ( s > 0.0 ) {
			clr += mtl.k_s * pow( s, mtl.n );
		}
		color += clr * light.intensity;
	}
	if ( mtl.k_s.r + mtl.k_s.g + mtl.k_s.b > 0.0 ) {
		vec3 dir = reflect( -view, nrm );
		color += mtl.k_s * textureCube( envMap, dir.xzy ).rgb;
	}
	gl_FragColor = vec4(color,1);
}`;

export const raytraceVS = `
attribute vec3 p;
uniform mat4 proj;
uniform mat4 c2w;
varying vec3 ray_pos;
varying vec3 ray_dir;
void main()
{
    gl_Position = proj * vec4(p,1);
	vec4 rp = c2w * vec4(0,0,0,1);
	ray_pos = rp.xyz;
	vec4 rd = c2w * vec4(p,1);
	ray_dir = rd.xyz - ray_pos;
}
`;

export const envFS = `
precision mediump float;
varying vec3 ray_dir;
uniform samplerCube envMap;
void main()
{
	gl_FragColor = textureCube( envMap, ray_dir.xzy );
}
`;