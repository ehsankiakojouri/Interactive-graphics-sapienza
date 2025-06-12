// Spring-mass utilities from project6_Animations
class Vec3 {
    constructor(x=0,y=0,z=0){ this.init(x,y,z); }
    init(x,y,z){ this.x=x; this.y=y; this.z=z; }
    copy(){ return new Vec3(this.x,this.y,this.z); }
    set(v){ this.x=v.x; this.y=v.y; this.z=v.z; }
    inc(v){ this.x+=v.x; this.y+=v.y; this.z+=v.z; }
    dec(v){ this.x-=v.x; this.y-=v.y; this.z-=v.z; }
    scale(f){ this.x*=f; this.y*=f; this.z*=f; }
    add(v){ return new Vec3(this.x+v.x,this.y+v.y,this.z+v.z); }
    sub(v){ return new Vec3(this.x-v.x,this.y-v.y,this.z-v.z); }
    dot(v){ return this.x*v.x+this.y*v.y+this.z*v.z; }
    cross(v){ return new Vec3(this.y*v.z-this.z*v.y, this.z*v.x-this.x*v.z, this.x*v.y-this.y*v.x); }
    mul(f){ return new Vec3(this.x*f,this.y*f,this.z*f); }
    div(f){ return new Vec3(this.x/f,this.y/f,this.z/f); }
    len2(){ return this.dot(this); }
    len(){ return Math.sqrt(this.len2()); }
    unit(){ return this.div(this.len()); }
    normalize(){ let l=this.len(); this.x/=l; this.y/=l; this.z/=l; }
}

function SimTimeStep(dt, positions, velocities, springs, stiffness, damping, particleMass, gravity, restitution) {
    const forces = Array(positions.length).fill(null).map(()=>new Vec3(0,0,0));
    for(let s=0;s<springs.length;s++){
        const p0 = springs[s].p0; const p1 = springs[s].p1; const rest = springs[s].rest;
        const delta = positions[p1].sub(positions[p0]);
        const currLen = delta.len();
        const dir = delta.unit();
        const springForce = dir.mul(stiffness*(currLen-rest));
        forces[p0].inc(springForce); forces[p1].dec(springForce);
        const lDot = velocities[p1].sub(velocities[p0]).dot(dir);
        const dampingForce = dir.mul(damping*lDot);
        forces[p0].inc(dampingForce); forces[p1].dec(dampingForce);
    }
    for(let i=0;i<positions.length;i++) forces[i].inc(gravity.mul(particleMass));
    for(let i=0;i<positions.length;i++){
        const at = forces[i].div(particleMass);
        velocities[i].inc(at.mul(dt));
        positions[i].inc(velocities[i].mul(dt));
    }
    for(let i=0;i<positions.length;i++){
        if(positions[i].y < -2.5){
            positions[i].y = -2.5;
            if(velocities[i].y < 0) velocities[i].y = -velocities[i].y * restitution;
        }
    }
}

class Projectile {
    constructor(gl, meshPath, texturePath){
        this.drawer = new MeshDrawer(gl);
        this._position = [0,1.25,-4];
        this.velocity = [0,0,0];
        this.active = true;
        this.released = false;
        this.sphereIdx = null;
        this.mass = 0.1;
        this.stiffness = 1.5;
        this.damping = 1;
        this.gravity = new Vec3(0,0,0);
        // Constant Earth gravity used for predictions and once launched
        this.baseGravity = new Vec3(0,-100,0);
        this.restitution = 0.8;
                // Additional acceleration applied right after launch
        this.launchAcc = new Vec3(0,0,0);
        // How quickly the slingshot acceleration fades (per second)
        this.accFade = 15;

        fetch(meshPath)
            .then(res=>res.text())
            .then(obj=>{
                const mesh = new ObjMesh();
                mesh.parse(obj);
                const bbox = mesh.getBoundingBox();
                const size=[bbox.max[0]-bbox.min[0],bbox.max[1]-bbox.min[1],bbox.max[2]-bbox.min[2]];
                const diag=Math.sqrt(size[0]*size[0]+size[1]*size[1]+size[2]*size[2]);
                // const scale=1.5;
                const scale=0.5;
                mesh.shiftAndScale([0,0,0],scale);
                mesh.computeNormals();
                const radius=0.5*diag*scale;
                this.radius = radius;
                if(this.sphereIdx===null){
                    this.sphereIdx=spheres.length;
                    spheres.push({center:this._position.slice(),radius:radius,mtl:{k_d:[0.3,0.9,0.3],k_s:[0.05,0.05,0.05],n:5},hidden:true});
                    if(ray_tracer) ray_tracer.init();
                }else{
                    spheres[this.sphereIdx].radius=radius;
                }
                this.mesh=mesh;
                this.pos=mesh.vpos.map(v=>new Vec3(v[0],v[1],v[2]));
                const off=new Vec3(...this._position);
                for(let pt of this.pos) pt.inc(off);
                this.vel=this.pos.map(()=>new Vec3(0,0,0));
                this.nrm=mesh.norm.map(n=>new Vec3(n[0],n[1],n[2]));
                this.initSprings();
                this.buffers=mesh.getVertexBuffers();
                this.drawer.setMesh(this.buffers.positionBuffer,this.buffers.texCoordBuffer,this.buffers.normalBuffer);
                this.drawer.swapYZ(true);
                this.updateMesh();
            });
        const img=new Image();
        img.onload=()=>this.drawer.setTexture(img);
        img.src=texturePath;
        this.drawer.showTexture(true);
    }
    get position(){ return this._position; }
    set position(p){
        const diff=[p[0]-this._position[0], p[1]-this._position[1], p[2]-this._position[2]];
        if(this.pos) for(let v of this.pos) v.inc(new Vec3(...diff));
        this._position=p.slice();
        if(this.sphereIdx!==null) spheres[this.sphereIdx].center=this._position.slice();
        if(this.pos&&this.buffers) this.updateMesh();
    }
    initSprings(){
        this.springs=[];
        for(let i=0;i<this.pos.length;i++){
            for(let j=i+1;j<this.pos.length;j++){
                let r=this.pos[i].sub(this.pos[j]).len();
                if(r>0.02) this.springs.push({p0:i,p1:j,rest:r});
            }
        }
    }
    computeCenter(){
        const c=new Vec3(0,0,0);
        for(let p of this.pos) c.inc(p);
        c.scale(1/this.pos.length);
        return c;
    }
    updateMesh(){
        if(!this.mesh) return;
        const updateBuffer=(buffer,faces,verts)=>{
            const addTri=(buf,bi,vals,i,j,k)=>{
                buf[bi++]=vals[i].x; buf[bi++]=vals[i].y; buf[bi++]=vals[i].z;
                buf[bi++]=vals[j].x; buf[bi++]=vals[j].y; buf[bi++]=vals[j].z;
                buf[bi++]=vals[k].x; buf[bi++]=vals[k].y; buf[bi++]=vals[k].z;
            };
            for(let i=0,bi=0;i<faces.length;++i){
                const f=faces[i];
                if(f.length<3) continue;
                addTri(buffer,bi,verts,f[0],f[1],f[2]); bi+=9;
                for(let j=3;j<f.length;j++,bi+=9) addTri(buffer,bi,verts,f[0],f[j-1],f[j]);
            }
        };
        updateBuffer(this.buffers.positionBuffer,this.mesh.face,this.pos);
        for(let i=0;i<this.nrm.length;i++) this.nrm[i].init(0,0,0);
        for(let i=0;i<this.mesh.face.length;i++){
            const f=this.mesh.face[i];
            const nf=this.mesh.nfac[i];
            const v0=this.pos[f[0]];
            for(let j=1;j<f.length-1;j++){
                const v1=this.pos[f[j]];
                const v2=this.pos[f[j+1]];
                let e0=v1.sub(v0); let e1=v2.sub(v0); let n=e0.cross(e1); n=n.unit();
                this.nrm[nf[0]].inc(n); this.nrm[nf[j]].inc(n); this.nrm[nf[j+1]].inc(n);
            }
        }
        for(let i=0;i<this.nrm.length;i++) this.nrm[i].normalize();
        updateBuffer(this.buffers.normalBuffer,this.mesh.nfac,this.nrm);
        this.drawer.setMesh(this.buffers.positionBuffer,this.buffers.texCoordBuffer,this.buffers.normalBuffer);
    }

    launch(acceleration) {
        // Reset position and velocities
        //this.position = position.slice();
        if(this.vel) for(let v of this.vel) v.set(new Vec3(0,0,0));

        // Earth gravity now starts acting
        this.gravity = this.baseGravity.copy();

        // Initial acceleration provided by the slingshot
        this.launchAcc = new Vec3(...acceleration);

        this.released = true;
        this.active = true;
    }
    update(dt){
        if(!this.pos) return;
        const damping=this.damping*this.stiffness*dt;
        // Total acceleration combines gravity and the fading launch impulse
        const totalAcc = this.gravity.add(this.launchAcc);
        SimTimeStep(dt,this.pos,this.vel,this.springs,this.stiffness,damping,this.mass,totalAcc,this.restitution);

        // Fade the launch acceleration so that after a short time only gravity remains
        this.launchAcc.scale(Math.max(0, 1 - this.accFade * dt));        this.updateMesh();
        const c=this.computeCenter();
        this._position=[c.x,c.y,c.z];
        if(this.sphereIdx!==null) spheres[this.sphereIdx].center=this._position.slice();
        this.checkHits();
    }


    // Predict future center positions without affecting the actual simulation
    // dt: time step, steps: number of simulation steps to advance
    predictTrajectory(dt, steps, launchAcc){
        if(!this.pos) return [];
        const simPos = this.pos.map(p=>p.copy());
        const simVel = this.vel.map(v=>v.copy());
        let simLaunchAcc = launchAcc ? new Vec3(...launchAcc) : this.launchAcc.copy();
        let acc = this.baseGravity.add(simLaunchAcc);
        const path = [];
        for(let s=0; s<steps; s++){
            const damping = this.damping*this.stiffness*dt;
            SimTimeStep(dt, simPos, simVel, this.springs,
                        this.stiffness, damping, this.mass, acc,
                        this.restitution);
            simLaunchAcc.scale(Math.max(0, 1 - this.accFade*dt));
            acc = this.baseGravity.add(simLaunchAcc);
            const c = new Vec3(0,0,0);
            for(const p of simPos) c.inc(p);
            c.scale(1/simPos.length);
            path.push([c.x, c.z, c.y]);
        }
        return path;
    }
    checkHits(){
        if(typeof window==='undefined'||!window.flyingManager) return;
        const mgr=window.flyingManager;
        const flyers=mgr.hornets.concat(mgr.fireflies);
        for(const f of flyers){
            if(!f || !f.position) continue;
            const dx=f.position[0]-this._position[0];
            const dy=f.position[1]-this._position[1];
            const dz=f.position[2]-this._position[2];
            const fr=(f.radius||0.3)+this.radius;
            if(dx*dx+dy*dy+dz*dz <= fr*fr){
                if(f.isFirefly){
                    if(window.updateScore) window.updateScore(-1);
                    if(mgr.killFireflyByRef) mgr.killFireflyByRef(f);
                }else{
                    if(window.updateScore) window.updateScore(1);
                    const i=mgr.hornets.indexOf(f);
                    if(i!==-1) mgr.hornets.splice(i,1);
                }
                if(f.sphereIdx!==null&&spheres[f.sphereIdx]) spheres[f.sphereIdx].hidden=true;
            }
        }
    }
    draw(mvp,mv,normalMat){
        if(!this.active) return;
        this.drawer.draw(mvp,mv,normalMat);
    }
}