// This function takes the translation and two rotation angles (in radians) as input arguments.
// The two rotations are applied around x and y axes.
// It returns the combined 4x4 transformation matrix as an array in column-major order.
// You can use the MatrixMult function defined in project5.html to multiply two 4x4 matrices in the same format.
function GetModelViewMatrix( tx, ty, tz, rotX, rotY ) {
    // build rotation around X
    const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
    const rotMatX = [
        1,    0,     0, 0,
        0, cosX,  sinX, 0,
        0,-sinX,  cosX, 0,
        0,    0,     0, 1
    ];
    // build rotation around Y
    const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
    const rotMatY = [
       cosY, 0, -sinY, 0,
          0, 1,     0, 0,
       sinY, 0,  cosY, 0,
          0, 0,     0, 1
    ];
    // combine rotations: first X then Y
    const rotCombined = MatrixMult(rotMatY, rotMatX);

    // translation matrix
    const transMat = [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
       tx,ty,tz, 1
    ];

    // apply translation after rotation
    const mv = MatrixMult(transMat, rotCombined);
    return mv;
}


// [TO-DO] Complete the implementation of the following class.

class MeshDrawer
{
    constructor()
    {
        // Initializations
        let canvas = document.getElementById("canvas");
        this.gl = canvas.getContext("webgl", {antialias: false, depth: true});
        if (!this.gl) {
            alert("Unable to initialize WebGL.");
            return;
        }
        this.gl.clearColor(0,0,0,0);
        this.gl.enable(this.gl.DEPTH_TEST);
        // Compile and link shaders
        this.program = this.gl.createProgram();
        let vertShader = this.loadShader('VERTEX');
        let fragShader = this.loadShader('FRAGMENT');
        this.gl.attachShader(this.program, vertShader);
        this.gl.attachShader(this.program, fragShader);
        this.gl.linkProgram(this.program);
        if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
            console.log(this.gl.getProgramInfoLog(this.program));
        }
        this.meshLoaded = false;
        this.textureLoaded = false;
        this.isShowingTexture = true;
    }

    getVertShaderSource() {
        return `
            precision mediump float;
            attribute vec3 pos;
            attribute vec3 normal;
            attribute vec2 uv;
            varying vec2 vUV;
            varying vec3 vNormal;
            varying vec3 vViewDirection;
            uniform bool swapYZ;
            uniform mat4 mvp;
            uniform mat4 mv;
            uniform mat3 normalMat;
            void main(){
                vec3 p = swapYZ ? vec3(pos.x,pos.z,pos.y) : pos;
                gl_Position = mvp * vec4(p,1.0);
                vUV = uv;
                vNormal = normalMat * normal;
                vViewDirection = - (mv * vec4(p, 1)).xyz;
            }
        `;
    }
    getFragShaderSource() {
        return `
            precision mediump float;
            const float ambient = 0.1;
            const vec3 lightIntensity = vec3(1, 1, 1);
            const vec3 Ks = vec3(1, 1, 1);
            const vec3 Kd = vec3(1, 1, 1);
            varying vec2 vUV;
            varying vec3 vNormal;
            varying vec3 vViewDirection;
            uniform sampler2D textureID;
            uniform bool showTexture;
            uniform vec3 lightDir;
            uniform float shininess;
            void main() {
                vec3 n = normalize(vNormal);
                vec3 w = normalize(lightDir);
                vec3 v = normalize(vViewDirection);
                vec3 h = normalize(w + v);
                float cosphi = dot(h, n);
                float diffuse = max(dot(w, n), 0.0);
                vec3 color;
                if (showTexture){
                    vec4 texel = texture2D(textureID, vUV);
                    color = lightIntensity * (texel.xyz * diffuse + Ks * pow(cosphi, shininess));
                }else{
                    color = lightIntensity * (Kd * diffuse + Ks * pow(cosphi, shininess));
                }
                gl_FragColor = vec4(color, 1);
            }
        `;
    }
    loadShader(shaderType) {
        let shader, shaderSource;
        if (shaderType.includes("VERTEX")) {
            shader = this.gl.createShader(this.gl.VERTEX_SHADER);
            shaderSource = this.getVertShaderSource();
        } else if (shaderType.includes("FRAGMENT")) {
            shader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
            shaderSource = this.getFragShaderSource();
        }
        this.gl.shaderSource(shader, shaderSource);
        this.gl.compileShader(shader);
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.log(this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
        }
        return shader;
    }
    assignVertexAttributeData(attr, data, size, usage) {
        let buffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(data),
            usage === "STATIC" ? this.gl.STATIC_DRAW : this.gl.DYNAMIC_DRAW);
        let loc = this.gl.getAttribLocation(this.program, attr);
        this.gl.enableVertexAttribArray(loc);
        this.gl.vertexAttribPointer(loc, size, this.gl.FLOAT, false, 0, 0);
        return buffer;
    }
    setMesh(vertPos, texCoords, normals) {
        this.numTriangles = vertPos.length / 3;
        this.vertPosBuffer = this.assignVertexAttributeData('pos', vertPos, 3, 'STATIC');
        this.vertUVBuffer = this.assignVertexAttributeData('uv', texCoords, 2, 'STATIC');
        this.vertNormalBuffer = this.assignVertexAttributeData('normal', normals, 3, 'STATIC');
        this.meshLoaded = true;
    }
    swapYZ(swap) {
        this.gl.useProgram(this.program);
        let loc = this.gl.getUniformLocation(this.program, 'swapYZ');
        this.gl.uniform1i(loc, swap);
    }
    draw(matrixMVP, matrixMV, matrixNormal) {
        if (!this.meshLoaded) return;
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        this.gl.useProgram(this.program);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertPosBuffer);
        let posLoc = this.gl.getAttribLocation(this.program, 'pos');
        this.gl.enableVertexAttribArray(posLoc);
        this.gl.vertexAttribPointer(posLoc, 3, this.gl.FLOAT, false, 0, 0);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertUVBuffer);
        let uvLoc = this.gl.getAttribLocation(this.program, 'uv');
        this.gl.enableVertexAttribArray(uvLoc);
        this.gl.vertexAttribPointer(uvLoc, 2, this.gl.FLOAT, false, 0, 0);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertNormalBuffer);
        let nLoc = this.gl.getAttribLocation(this.program, 'normal');
        this.gl.enableVertexAttribArray(nLoc);
        this.gl.vertexAttribPointer(nLoc, 3, this.gl.FLOAT, false, 0, 0);

        // uniforms
        this.gl.uniformMatrix4fv(this.gl.getUniformLocation(this.program, 'mvp'), false, matrixMVP);
        this.gl.uniformMatrix4fv(this.gl.getUniformLocation(this.program, 'mv'), false, matrixMV);
        this.gl.uniformMatrix3fv(this.gl.getUniformLocation(this.program, 'normalMat'), false, matrixNormal);

        // texture
        if (this.texture) {
            this.gl.activeTexture(this.gl.TEXTURE0);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
            let loc = this.gl.getUniformLocation(this.program, 'textureID');
            this.gl.uniform1i(loc, 0);
        }

        // show texture
        let showTextureLoc = this.gl.getUniformLocation(this.program, 'showTexture');
        this.gl.uniform1i(showTextureLoc, this.isShowingTexture);

        this.gl.drawArrays(this.gl.TRIANGLES, 0, this.numTriangles);
    }
    setTexture(img) {
        this.gl.useProgram(this.program);
        this.texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGB, this.gl.RGB, this.gl.UNSIGNED_BYTE, img);
        this.gl.generateMipmap(this.gl.TEXTURE_2D);
        this.textureLoaded = true;
        let textureSampler2DLoc = this.gl.getUniformLocation(this.program, 'textureID');
        this.gl.uniform1i(textureSampler2DLoc, 0);
        if (this.isShowingTexture) {
            this.showTexture(true);
        }
    }
    showTexture(show) {
        this.isShowingTexture = show;
        this.gl.useProgram(this.program);
        let showTextureLoc = this.gl.getUniformLocation(this.program, 'showTexture');
        this.gl.uniform1i(showTextureLoc, show);
    }
    setLightDir(x, y, z) {
        this.gl.useProgram(this.program);
        let loc = this.gl.getUniformLocation(this.program, 'lightDir');
        this.gl.uniform3fv(loc, [x, y, z]);
    }
    setShininess(shininess) {
        this.gl.useProgram(this.program);
        let loc = this.gl.getUniformLocation(this.program, 'shininess');
        this.gl.uniform1f(loc, shininess);
    }
}


// This function is called for every step of the simulation.
// Its job is to advance the simulation for the given time step duration dt.
// It updates the given positions and velocities.
function SimTimeStep(dt, positions, velocities, springs, stiffness, damping, particleMass, gravity, restitution) {
    var forces = Array( positions.length ); // The total force per particle
    for (let f = 0; f < forces.length; f++){
        forces[f] = new Vec3(0, 0, 0);
    }

    // Spring and damping forces
    for (let s = 0 ; s < springs.length; s++){
        let p0idx = springs[s].p0;
        let p1idx = springs[s].p1;
        let restLen = springs[s].rest;
        let delta = positions[p1idx].sub(positions[p0idx]);
        let currLen = delta.len();
        let forceDirection = delta.unit();
        let springForce = forceDirection.mul(stiffness * (currLen - restLen));
        forces[p0idx].inc(springForce);
        forces[p1idx].dec(springForce);

        let lDot = velocities[p1idx].sub(velocities[p0idx]).dot(forceDirection);
        let dampingForce = forceDirection.mul(damping * lDot);
        forces[p0idx].inc(dampingForce);
        forces[p1idx].dec(dampingForce);
    }

    // Gravity
    for (let i = 0 ; i < positions.length ; i++){
        forces[i].inc(gravity.mul(particleMass));
    }

    // Update positions and velocities (semi-implicit Euler)
    for (let i = 0 ; i < positions.length; i++){
        let at = forces[i].div(particleMass);
        velocities[i].inc(at.mul(dt));
        positions[i].inc(velocities[i].mul(dt));
    }

    // Collisions with box [-1,1] on each axis
    for (let i = 0; i < positions.length; i++){
        ['x','y','z'].forEach(axis=>{
            if (positions[i][axis] < -1){
                positions[i][axis] = -1;
                if (velocities[i][axis] < 0)
                    velocities[i][axis] = -velocities[i][axis]*restitution;
            }
            if (positions[i][axis] > 1){
                positions[i][axis] = 1;
                if (velocities[i][axis] > 0)
                    velocities[i][axis] = -velocities[i][axis]*restitution;
            }
        });
    }
}

