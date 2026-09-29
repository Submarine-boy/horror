import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

const $ = (id) => document.getElementById(id);
const clamp = (v,a,b) => Math.max(a, Math.min(b,v));
const lerp = (a,b,t) => a + (b-a)*t;

const SETTINGS_KEY = "houseOfSilenceSettings";
const SAVE_KEY = "houseOfSilenceStats";

const settings = {
  sensitivity: 1,
  fov: 76,
  volume: .6,
  reducedEffects: false,
  ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")
};

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function showToast(message, duration = 1800) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => el.classList.remove("show"), duration);
}

class AudioSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.ambient = null;
  }
  start() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = settings.volume;
    this.master.connect(this.ctx.destination);
  }
  tone(freq, duration, type="sine", gain=.04, delay=0) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, this.ctx.currentTime + delay);
    g.gain.linearRampToValueAtTime(gain, this.ctx.currentTime + delay + .01);
    g.gain.exponentialRampToValueAtTime(.0001, this.ctx.currentTime + delay + duration);
    o.connect(g).connect(this.master);
    o.start(this.ctx.currentTime + delay);
    o.stop(this.ctx.currentTime + delay + duration + .03);
  }
  noise(duration=.15, gain=.025) {
    if (!this.ctx) return;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i=0;i<data.length;i++) data[i] = Math.random()*2-1;
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.buffer = buffer;
    src.connect(g).connect(this.master);
    src.start();
  }
  footstep() { this.tone(75 + Math.random()*25, .055, "triangle", .018); }
  door() { this.tone(90, .35, "sawtooth", .025); this.tone(180, .2, "triangle", .018, .05); }
  pickup() { this.tone(620, .08, "sine", .045); this.tone(880, .12, "sine", .03, .07); }
  danger() { this.tone(65, .45, "sine", .04); this.tone(48, .6, "sine", .025, .12); }
  thunder() { this.noise(.5,.018); this.tone(38,.65,"sine",.045); }
  unlock() { this.tone(330,.12,"sine",.04); this.tone(495,.18,"sine",.035,.1); }
}

const audio = new AudioSystem();

class House {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.interactables = [];
    this.colliders = [];
    this.doors = [];
    this.rooms = [];
    this.build();
  }

  mat(color, rough=.8, metal=0) {
    return new THREE.MeshStandardMaterial({ color, roughness:rough, metalness:metal });
  }

  box(name, x,y,z, sx,sy,sz, material, collision=true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz), material);
    mesh.name = name;
    mesh.position.set(x,y,z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    if (collision) this.colliders.push({x,z,sx,sz,minY:y-sy/2,maxY:y+sy/2});
    return mesh;
  }

  build() {
    const wood = this.mat(0x342a22, .78);
    const wall = this.mat(0x625f55, .92);
    const plaster = this.mat(0x777269, .95);
    const darkWood = this.mat(0x211a16, .86);
    const metal = this.mat(0x414442, .65, .5);
    const carpet = this.mat(0x3a3530, 1);
    const outside = this.mat(0x1c211c, 1);

    this.box("ground", 0,-.18,0, 54,.3,42, outside, true);
    this.box("floor", 0,0,0, 26,.35,20, wood, true);
    this.box("ceiling", 0,6.4,0, 26,.3,20, darkWood, false);

    // Exterior shell.
    this.box("north wall", 0,3.1,-10, 26,6.2,.35, wall, false);
    this.box("south wall", 0,3.1,10, 26,6.2,.35, wall, false);
    this.box("west wall", -13,3.1,0, .35,6.2,20, wall);
    this.box("east wall", 13,3.1,0, .35,6.2,20, wall);

    // Internal architecture. Door-sized gaps are intentionally left.
    this.box("hall divider", -4.7,3.1,-5, .35,6.2,10, plaster, false);
    this.box("hall divider 2", 4.7,3.1,-5, .35,6.2,10, plaster, false);
    this.box("lower divider", -7,3.1,5, 12,6.2,.35, plaster, false);
    this.box("lower divider 2", 7,3.1,5, 12,6.2,.35, plaster, false);

    // Upstairs visual balcony.
    this.box("upper floor", 7,6.7,1, 12,.35,8, darkWood, true);
    this.box("upper back", 7,9.7,5, 12,6,.3, wall, true);
    this.box("upper left", 1,9.7,1, .3,6,8, wall, true);
    this.box("upper right", 13,9.7,1, .3,6,8, wall, true);

    // Stairs.
    for (let i=0;i<9;i++) {
      const step = this.box("stair", -1.8+i*.48, .35+i*.31, 1.8+i*.32, .9,.6,.65, wood, true);
      step.rotation.y = 0;
    }

    // Furniture clusters.
    this.box("dining table", -8,.95,-4.2, 4,.2,1.8, darkWood, true);
    for (const x of [-9.3,-6.7]) this.box("chair", x,.6,-4.2,.65,1.1,.65, wood,true);
    this.box("cabinet", 9,1.4,-7.8, 3,2.8,.8, darkWood,true);
    this.box("desk", 8,1,-2.2, 3,.25,1.2, wood,true);
    this.box("bed", 8,1.1,6.9, 3.5,.6,5, carpet,true);
    this.box("workbench", -8,1.1,7.4, 4,1.3,1.2, metal,true);

    // Decorative windows.
    for (const x of [-9,0,9]) this.window(x,5.1,-9.78);
    for (const x of [-9,0,9]) this.window(x,5.1,9.78);

    this.door("front-door", 0,2,-9.78, 1.8,3.8, "Front Door", {locked:true, required:"gateKey"});
    this.door("basement-door", -5,2,5, 1.6,3.8, "Basement Door", {locked:true, required:"basementKey"});
    this.door("archive-door", 4.7,2,-1.6, 1.6,3.8, "Archive Door", {locked:true, required:"archiveKey"});
    this.door("shed-gate", -12.78,2,6.5, .3,3.8, "Shed Gate", {locked:false});

    this.addLamp(-8,4.9,-4);
    this.addLamp(0,5.1,-4);
    this.addLamp(8,5.1,-4);
    this.addLamp(8,5.1,7);
    this.addLamp(-8,5.1,7);

    // Items and clues.
    this.item("basementKey", "Basement Key", -10,1.4,-7.6, 0xd2b46b);
    this.item("screwdriver", "Screwdriver", -8.5,1.2,-4.2, 0x8c9aa0);
    this.item("fuse", "Fuse", 10.4,1.6,-7.8, 0xc7c7bf);
    this.item("battery", "Battery", -10,1.1,7.1, 0x9b9b74);
    this.item("wireCutter", "Wire Cutter", 8.5,1.2,-2.2, 0x5f686c);
    this.item("archiveKey", "Archive Key", 8.5,1.9,6.8, 0xbca46a);
    this.item("gateKey", "Gate Key", 9.5,1.1,7.8, 0xd5b96d);

    this.clue(-9.5,1.8,-7.6, 'A handwritten note: "The basement machine needs one living circuit."');
    this.clue(9.8,1.8,-7.5, 'A torn card: "Archive access follows the bedroom clock."');

    // Electrical panel puzzle.
    const panel = this.box("electrical panel", -9,2.4,7.1, 1.4,2.3,.25, metal, false);
    this.interactables.push({
      object:panel, distance:2.4,
      prompt:() => this.game.inventory.has("fuse") ? "[E] INSTALL FUSE" : "[E] EXAMINE ELECTRICAL PANEL",
      interact:() => {
        if (this.game.powerRestored) return showToast("The panel is already powered.");
        if (!this.game.inventory.has("fuse")) return showToast("A fuse is missing.");
        this.game.inventory.delete("fuse");
        this.game.powerRestored = true;
        audio.unlock();
        showToast("Power restored. Something moved upstairs.");
        this.game.setObjective("Find the archive room.");
        this.game.lights.forEach(l => l.visible = true);
      }
    });

    // Final gate interaction.
    const gate = this.box("escape gate", 0,2,-10.0, 2.4,3.9,.25, metal, false);
    this.interactables.push({
      object:gate, distance:3,
      prompt:() => this.game.inventory.has("gateKey") && this.game.powerRestored ? "[E] UNLOCK FRONT GATE" : "[E] CHECK FRONT GATE",
      interact:() => {
        if (!this.game.powerRestored) return showToast("The gate mechanism has no power.");
        if (!this.game.inventory.has("gateKey")) return showToast("The gate is locked.");
        this.game.win();
      }
    });
  }

  window(x,y,z) {
    const glass = new THREE.MeshStandardMaterial({color:0x31404a, roughness:.15, metalness:.15, transparent:true, opacity:.38});
    this.box("window",x,y,z,3,2.3,.12,glass,false);
  }

  addLamp(x,y,z) {
    const fixture = new THREE.Mesh(new THREE.CylinderGeometry(.08,.12,.35,8), this.mat(0x252525,.5,.7));
    fixture.position.set(x,y,z);
    this.scene.add(fixture);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.13,10,8), new THREE.MeshBasicMaterial({color:0xffd8a0}));
    bulb.position.set(x,y-.25,z);
    this.scene.add(bulb);
    const light = new THREE.PointLight(0xffd2a0, 1.25, 9, 2);
    light.position.set(x,y-.25,z);
    this.scene.add(light);
    this.game.lights.push(light);
  }

  door(id,x,y,z,w,h,label,opts={}) {
    const material = this.mat(0x30241d,.82);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,.18), material);
    mesh.position.set(x,y,z);
    mesh.castShadow = true;
    this.scene.add(mesh);
    const door = {
      id, object:mesh, label, locked:!!opts.locked, required:opts.required || null,
      open:false, busy:false, baseX:x, baseY:y, baseZ:z, rotation:0,
      distance:2.7,
      prompt:() => door.locked ? "[E] " + label.toUpperCase() : "[E] OPEN " + label.toUpperCase(),
      interact:() => {
        if (door.busy) return;
        if (door.locked) {
          if (!this.game.inventory.has(door.required)) return showToast("Locked.");
          door.locked = false;
          this.game.inventory.delete(door.required);
          audio.unlock();
          showToast(label + " unlocked.");
        }
        door.busy = true;
        door.open = !door.open;
        audio.door();
        this.game.makeNoise(door.open ? 0.55 : 0.42);
        const target = door.open ? Math.PI/2 : 0;
        const start = door.rotation;
        const startTime = performance.now();
        const animate = (t) => {
          const p = clamp((t-startTime)/420,0,1);
          door.rotation = lerp(start,target,p);
          mesh.rotation.y = door.rotation;
          mesh.position.x = x + Math.sin(door.rotation)*w*.5;
          mesh.position.z = z - (1-Math.cos(door.rotation))*w*.5;
          if (p<1) requestAnimationFrame(animate); else door.busy=false;
        };
        requestAnimationFrame(animate);
      }
    };
    this.doors.push(door);
    this.interactables.push(door);
  }

  item(id,label,x,y,z,color) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(.34,.18,.22), new THREE.MeshStandardMaterial({color,roughness:.55,metalness:.2}));
    mesh.position.set(x,y,z);
    mesh.rotation.y = Math.random()*Math.PI;
    mesh.castShadow = true;
    this.scene.add(mesh);
    this.interactables.push({
      object:mesh, distance:1.9,
      prompt:() => "[E] PICK UP " + label.toUpperCase(),
      interact:() => {
        this.game.inventory.add(id,label);
        mesh.visible = false;
        audio.pickup();
        this.game.makeNoise(.45);
        showToast(label + " added.");
        this.interactables = this.interactables.filter(i => i.object !== mesh);
      }
    });
  }

  clue(x,y,z,text) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(.32,.02,.22), new THREE.MeshStandardMaterial({color:0xd9d0b9,roughness:1}));
    mesh.position.set(x,y,z);
    this.scene.add(mesh);
    this.interactables.push({
      object:mesh, distance:1.8,
      prompt:() => "[E] READ NOTE",
      interact:() => showToast(text, 4500)
    });
  }
}

class Inventory {
  constructor() { this.items = new Map(); }
  add(id,label) { this.items.set(id,label); renderInventory(this); }
  has(id) { return this.items.has(id); }
  delete(id) { this.items.delete(id); renderInventory(this); }
}

function renderInventory(inv) {
  $("inventory").innerHTML = [...inv.items.values()].map(v => `<div class="item-chip">${v.toUpperCase()}</div>`).join("");
}

class Player {
  constructor(camera, scene, game) {
    this.camera=camera; this.scene=scene; this.game=game;
    this.position = new THREE.Vector3(0,1.65,7.5);
    this.velocity = new THREE.Vector3();
    this.keys = {};
    this.yaw=0;
    this.pitch=0;
    this.stamina=1;
    this.battery=100;
    this.crouched=false;
    this.lastStep=0;
    this.lastNoise=0;
    this.setupInput();
  }

  setupInput() {
    addEventListener("keydown", e => {
      this.keys[e.code]=true;
      if (e.code==="KeyF" && !e.repeat && this.game.running) this.toggleFlashlight();
      if (e.code==="KeyE" && !e.repeat && this.game.running) this.interact();
      if (e.code==="ControlLeft" || e.code==="ControlRight") this.crouched=true;
      if (e.code==="Escape" && this.game.running) this.game.pause();
    });
    addEventListener("keyup", e => {
      this.keys[e.code]=false;
      if (e.code==="ControlLeft" || e.code==="ControlRight") this.crouched=false;
    });
  }

  reset() {
    this.position.set(0,1.65,7.5);
    this.velocity.set(0,0,0);
    this.stamina=1;
    this.battery=100;
    this.crouched=false;
  }

  toggleFlashlight() {
    this.game.flashlightOn=!this.game.flashlightOn;
    this.game.flashlight.visible=this.game.flashlightOn && this.battery>0;
  }

  interact() {
    const hit=this.game.getInteraction();
    if (hit) hit.interact();
  }

  update(dt) {
    const forward = new THREE.Vector3(0,0,-1).applyAxisAngle(new THREE.Vector3(0,1,0),this.yaw);
    const right = new THREE.Vector3(1,0,0).applyAxisAngle(new THREE.Vector3(0,1,0),this.yaw);
    const move = new THREE.Vector3();
    if (this.keys.KeyW) move.add(forward);
    if (this.keys.KeyS) move.sub(forward);
    if (this.keys.KeyD) move.add(right);
    if (this.keys.KeyA) move.sub(right);
    if (move.lengthSq()) move.normalize();

    const running = (this.keys.ShiftLeft || this.keys.ShiftRight) && !this.crouched && this.stamina>0 && move.lengthSq();
    const speed = this.crouched ? 1.45 : (running ? 4.9 : 2.8);

    if (running) this.stamina=clamp(this.stamina-dt*.24,0,1);
    else this.stamina=clamp(this.stamina+dt*.18,0,1);

    const old = this.position.clone();
    this.position.addScaledVector(move,speed*dt);
    this.position.x=clamp(this.position.x,-11.7,11.7);
    this.position.z=clamp(this.position.z,-8.8,8.8);

    if (this.collides()) this.position.copy(old);

    if (move.lengthSq() && performance.now()-this.lastStep > (running?290:470)) {
      audio.footstep();
      this.lastStep=performance.now();
      this.game.makeNoise(running?.62:(this.crouched?.08:.22));
    }

    if (this.game.flashlightOn && this.battery>0) {
      this.battery -= dt*.55;
      if (this.battery<=0) {
        this.battery=0;
        this.game.flashlightOn=false;
        this.game.flashlight.visible=false;
        showToast("The flashlight battery is dead.");
      }
    }

    // PointerLockControls owns the camera rotation. Do not overwrite its
    // quaternion/rotation here, otherwise mouse look fights the controls.
    this.camera.position.copy(this.position);
    this.camera.position.y = this.crouched ? 1.05 : 1.65;
  }

  collides() {
    const r=.38;
    for (const c of this.game.house.colliders) {
      if (this.position.y < c.minY-.2 || this.position.y > c.maxY+.5) continue;
      if (this.position.x>c.x-c.sx/2-r && this.position.x<c.x+c.sx/2+r &&
          this.position.z>c.z-c.sz/2-r && this.position.z<c.z+c.sz/2+r) return true;
    }
    return false;
  }
}

class Warden {
  constructor(scene, game) {
    this.scene=scene; this.game=game;
    this.group=new THREE.Group();
    this.group.position.set(9,0,-1);
    scene.add(this.group);
    this.speed=1.25;
    this.state="PATROL";
    this.target=new THREE.Vector3();
    this.lastKnown=new THREE.Vector3();
    this.searchTime=0;
    this.attackCooldown=0;
    this.build();
    this.patrol=[
      new THREE.Vector3(9,0,-1),
      new THREE.Vector3(9,0,7),
      new THREE.Vector3(0,0,7),
      new THREE.Vector3(-9,0,7),
      new THREE.Vector3(-9,0,-6),
      new THREE.Vector3(0,0,-6),
      new THREE.Vector3(9,0,-1)
    ];
    this.patrolIndex=0;
  }

  build() {
    const coat=new THREE.MeshStandardMaterial({color:0x111211,roughness:1});
    const skin=new THREE.MeshStandardMaterial({color:0x6f7169,roughness:1});
    const body=new THREE.Mesh(new THREE.CapsuleGeometry(.38,1.35,6,10),coat);
    body.position.y=1.55; body.castShadow=true; this.group.add(body);
    const head=new THREE.Mesh(new THREE.SphereGeometry(.38,16,12),skin);
    head.position.y=2.65; head.castShadow=true; this.group.add(head);
    const hood=new THREE.Mesh(new THREE.ConeGeometry(.52,.6,10),coat);
    hood.position.y=2.95; hood.rotation.x=Math.PI; hood.castShadow=true; this.group.add(hood);
    this.group.visible=true;
  }

  canSeePlayer() {
    const p=this.game.player.position;
    const e=this.group.position;
    const to=p.clone().sub(e);
    const dist=to.length();
    if (dist>11) return false;
    to.y=0;
    const dir=new THREE.Vector3(0,0,1).applyQuaternion(this.group.quaternion);
    const angle=dir.angleTo(to.clone().normalize());
    if (angle>Math.PI*.42) return false;
    const ray=new THREE.Raycaster(e.clone().add(new THREE.Vector3(0,1.7,0)),p.clone().sub(e).normalize(),0,dist);
    const hits=ray.intersectObjects(this.scene.children,true);
    return !hits.some(h => h.object !== this.group && h.object.userData && h.object.userData.blocksVision);
  }

  update(dt) {
    this.attackCooldown=Math.max(0,this.attackCooldown-dt);
    const player=this.game.player.position;
    const dist=this.group.position.distanceTo(player);

    if (this.canSeePlayer()) {
      this.state="CHASE";
      this.lastKnown.copy(player);
      this.target.copy(player);
    } else if (this.game.lastNoise && this.game.lastNoise.time > performance.now()-2200) {
      const n=this.game.lastNoise;
      if (this.group.position.distanceTo(n.position) < n.radius) {
        this.state="INVESTIGATE";
        this.target.copy(n.position);
      }
    }

    if (this.state==="PATROL") {
      this.target.copy(this.patrol[this.patrolIndex]);
      if (this.group.position.distanceTo(this.target)<.8) this.patrolIndex=(this.patrolIndex+1)%this.patrol.length;
    } else if (this.state==="INVESTIGATE") {
      if (this.group.position.distanceTo(this.target)<.75) {
        this.searchTime+=dt;
        if (this.searchTime>2.2) { this.searchTime=0; this.state="PATROL"; }
      }
    } else if (this.state==="CHASE") {
      this.target.copy(player);
      if (dist>14) this.state="PATROL";
      if (dist<1.05 && this.attackCooldown<=0) {
        this.attackCooldown=2;
        this.game.lose();
        return;
      }
    }

    const dir=this.target.clone().sub(this.group.position);
    dir.y=0;
    if (dir.lengthSq()>.01) {
      dir.normalize();
      const speed=this.state==="CHASE"?2.15:this.speed;
      this.group.position.addScaledVector(dir,speed*dt);
      this.group.lookAt(this.group.position.x+dir.x,this.group.position.y, this.group.position.z+dir.z);
    }

    const danger=clamp(1-dist/7,0,1);
    $("danger-vignette").style.boxShadow=`inset 0 0 100px rgba(150,30,25,${danger*.72})`;
    if (danger>.55 && Math.random()<dt*.8) audio.danger();
  }
}

class Game {
  constructor() {
    this.canvas=$("game");
    this.scene=new THREE.Scene();
    this.scene.background=new THREE.Color(0x070908);
    this.scene.fog=new THREE.FogExp2(0x0b0d0c,.032);
    this.camera=new THREE.PerspectiveCamera(settings.fov,innerWidth/innerHeight,.05,80);
    this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,antialias:true,powerPreference:"high-performance"});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
    this.renderer.setSize(innerWidth,innerHeight);
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.clock=new THREE.Clock();
    this.controls=new PointerLockControls(this.camera,document.body);
    this.controls.pointerSpeed=settings.sensitivity * 0.85;
    this.running=false;
    this.paused=false;
    this.finished=false;
    this.powerRestored=false;
    this.flashlightOn=true;
    this.lights=[];
    this.inventory=new Inventory();
    this.lastNoise=null;
    this.startTime=0;
    this.stats={deaths:0};
    this.setupWorld();
    this.setupUI();
    this.animate();
  }

  setupWorld() {
    const hemi=new THREE.HemisphereLight(0x7d8790,0x242018,.58);
    this.scene.add(hemi);

    const ambient=new THREE.AmbientLight(0x53605b,.24);
    this.scene.add(ambient);

    const moon=new THREE.DirectionalLight(0x9fb0c5,1.05);
    moon.position.set(-10,14,5);
    moon.castShadow=true;
    moon.shadow.mapSize.set(1024,1024);
    moon.shadow.camera.left=-22; moon.shadow.camera.right=22; moon.shadow.camera.top=22; moon.shadow.camera.bottom=-22;
    this.scene.add(moon);

    this.house=new House(this.scene,this);
    this.player=new Player(this.camera,this.scene,this);
    this.warden=new Warden(this.scene,this);

    this.flashlight=new THREE.SpotLight(0xe6f0ff,8.5,24,Math.PI/6,.62,1.15);
    this.flashlight.position.set(0,1.55,0);
    this.camera.add(this.flashlight);
    this.camera.add(this.flashlight.target);
    this.flashlight.target.position.set(0,0,-12);
    this.flashlight.castShadow=false;
    this.scene.add(this.camera);

    this.createRain();
    this.setObjective("Find a way into the basement.");
  }

  createRain() {
    const count=1400;
    const geo=new THREE.BufferGeometry();
    const pos=new Float32Array(count*3);
    for(let i=0;i<count;i++) {
      pos[i*3]=(Math.random()-.5)*48;
      pos[i*3+1]=Math.random()*18;
      pos[i*3+2]=(Math.random()-.5)*40;
    }
    geo.setAttribute("position",new THREE.BufferAttribute(pos,3));
    const mat=new THREE.PointsMaterial({color:0x8fa1ad,size:.035,transparent:true,opacity:.45});
    this.rain=new THREE.Points(geo,mat);
    this.scene.add(this.rain);
  }

  setupUI() {
    $("new-game").onclick=()=>this.start();
    $("retry").onclick=()=>this.start();
    $("play-again").onclick=()=>this.start();
    $("resume").onclick=()=>this.resume();
    $("restart").onclick=()=>this.start();
    $("back-menu").onclick=()=>this.toMenu();
    $("death-menu").onclick=()=>this.toMenu();
    $("ending-menu").onclick=()=>this.toMenu();
    $("how-to").onclick=()=>$("menu-help").classList.toggle("hidden");
    $("settings").onclick=()=>$("settings-panel").classList.remove("hidden");
    $("close-settings").onclick=()=>$("settings-panel").classList.add("hidden");

    $("sensitivity").value=settings.sensitivity;
    $("fov").value=settings.fov;
    $("volume").value=settings.volume;
    $("reduced-effects").checked=settings.reducedEffects;

    $("sensitivity").oninput=e=>{
      settings.sensitivity=+e.target.value;
      this.controls.pointerSpeed=settings.sensitivity * 0.85;
      saveSettings();
    };
    $("fov").oninput=e=>{settings.fov=+e.target.value;this.camera.fov=settings.fov;this.camera.updateProjectionMatrix();saveSettings();};
    $("volume").oninput=e=>{settings.volume=+e.target.value;if(audio.master)audio.master.gain.value=settings.volume;saveSettings();};
    $("reduced-effects").onchange=e=>{settings.reducedEffects=e.target.checked;saveSettings();};

    this.controls.addEventListener("lock",()=>{
      $("start-overlay").classList.add("hidden");
      $("hud").classList.remove("hidden");
    });
    this.controls.addEventListener("unlock",()=>{
      if(this.running && !this.paused && !this.finished) this.pause();
    });

    addEventListener("resize",()=>this.resize());
  }

  start() {
    audio.start();
    this.running=true;
    this.paused=false;
    this.finished=false;
    this.stats.deaths=0;
    this.startTime=performance.now();
    this.inventory=new Inventory();
    renderInventory(this.inventory);
    this.player.reset();
    this.powerRestored=false;
    this.flashlightOn=true;
    this.flashlight.visible=true;
    this.house.interactables.forEach(i=>{ if(i.object) i.object.visible=true; });
    this.warden.group.position.set(9,0,-1);
    this.warden.state="PATROL";
    this.warden.patrolIndex=0;
    $("menu").classList.add("hidden");
    $("pause").classList.add("hidden");
    $("gameover").classList.add("hidden");
    $("ending").classList.add("hidden");
    $("hud").classList.remove("hidden");
    $("start-overlay").classList.remove("hidden");
    $("battery-value").textContent="100%";
    this.setObjective("Find a way into the basement.");
    this.controls.lock();
  }

  pause() {
    if(!this.running || this.finished) return;
    this.paused=true;
    $("pause").classList.remove("hidden");
    $("hud").classList.add("hidden");
    this.controls.unlock();
  }

  resume() {
    if(!this.running || this.finished) return;
    this.paused=false;
    $("pause").classList.add("hidden");
    $("hud").classList.remove("hidden");
    this.controls.lock();
  }

  toMenu() {
    this.running=false;
    this.paused=false;
    this.finished=true;
    this.controls.unlock();
    $("hud").classList.add("hidden");
    $("pause").classList.add("hidden");
    $("gameover").classList.add("hidden");
    $("ending").classList.add("hidden");
    $("menu").classList.remove("hidden");
  }

  setObjective(text) {
    $("objective-text").textContent=text;
  }

  makeNoise(intensity) {
    const radius=2.5+intensity*10;
    this.lastNoise={position:this.player.position.clone(),radius,time:performance.now()};
    $("noise-indicator").style.opacity=String(clamp(intensity,0,1));
    clearTimeout(this.noiseTimer);
    this.noiseTimer=setTimeout(()=>$("noise-indicator").style.opacity="0",260);
  }

  getInteraction() {
    let best=null;
    const origin=this.camera.position.clone();
    const dir=new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    for(const i of this.house.interactables) {
      if(!i.object.visible) continue;
      const dist=origin.distanceTo(i.object.getWorldPosition(new THREE.Vector3()));
      if(dist>=(i.distance||2.5)) continue;
      const to=i.object.getWorldPosition(new THREE.Vector3()).sub(origin).normalize();
      if(dir.dot(to)<.72) continue;
      const ray=new THREE.Raycaster(origin,dir,0,i.distance||2.5);
      const hits=ray.intersectObject(i.object,true);
      if(hits.length && (!best || dist<best.dist)) best={...i,dist};
    }
    return best;
  }

  updateInteraction() {
    const i=this.getInteraction();
    $("interaction").textContent=i?i.prompt():"";
  }

  lose() {
    if(this.finished) return;
    this.finished=true;
    this.running=false;
    this.stats.deaths++;
    audio.danger();
    this.controls.unlock();
    $("hud").classList.add("hidden");
    $("death-stats").textContent=`The house kept you for ${this.formatTime(performance.now()-this.startTime)}. The Warden heard you.`;
    $("gameover").classList.remove("hidden");
    const old=JSON.parse(localStorage.getItem(SAVE_KEY)||"{}");
    old.deaths=(old.deaths||0)+1;
    localStorage.setItem(SAVE_KEY,JSON.stringify(old));
  }

  win() {
    if(this.finished) return;
    this.finished=true;
    this.running=false;
    audio.unlock();
    this.controls.unlock();
    const time=this.formatTime(performance.now()-this.startTime);
    $("hud").classList.add("hidden");
    $("ending-stats").textContent=`Escape time: ${time} · Items collected: ${this.inventory.items.size}`;
    $("ending").classList.remove("hidden");
    const old=JSON.parse(localStorage.getItem(SAVE_KEY)||"{}");
    old.bestTime=Math.min(old.bestTime||Infinity,performance.now()-this.startTime);
    old.escapes=(old.escapes||0)+1;
    localStorage.setItem(SAVE_KEY,JSON.stringify(old));
  }

  formatTime(ms) {
    const total=Math.floor(ms/1000);
    return String(Math.floor(total/60)).padStart(2,"0")+":"+String(total%60).padStart(2,"0");
  }

  resize() {
    this.camera.aspect=innerWidth/innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth,innerHeight);
  }

  update(dt) {
    if(!this.running || this.paused || this.finished) return;
    this.player.update(dt);
    this.warden.update(dt);
    this.updateInteraction();

    if(this.powerRestored && !this.inventory.has("archiveKey")) {
      this.setObjective("Find the archive key upstairs.");
    } else if(this.inventory.has("archiveKey") && !this.inventory.has("gateKey")) {
      this.setObjective("Search the upper room for the gate key.");
    } else if(this.inventory.has("gateKey")) {
      this.setObjective("Reach the front gate and escape.");
    }

    $("battery-value").textContent=Math.round(this.player.battery)+"%";
    $("stamina-fill").style.width=Math.round(this.player.stamina*100)+"%";

    if(this.rain) {
      const p=this.rain.geometry.attributes.position;
      for(let i=0;i<p.count;i++) {
        let y=p.getY(i)-dt*9;
        if(y<0) y=17;
        p.setY(i,y);
      }
      p.needsUpdate=true;
    }

    // Subtle lightning flashes.
    if(Math.random()<dt*.035) {
      const flash=this.scene.children.find(o=>o.isDirectionalLight);
      if(flash) {
        const old=flash.intensity;
        flash.intensity=1.8;
        setTimeout(()=>flash.intensity=old,80);
        audio.thunder();
      }
    }
  }

  animate() {
    requestAnimationFrame(()=>this.animate());
    const dt=Math.min(this.clock.getDelta(),.05);
    this.update(dt);
    this.renderer.render(this.scene,this.camera);
  }
}

const game=new Game();

setTimeout(()=>{
  $("loading").classList.add("hidden");
  $("menu").classList.remove("hidden");
},1600);

// Give walls a flag used by future vision upgrades without changing their material.
for (const child of game.scene.children) {
  if (child.name && child.name.includes("wall")) child.userData.blocksVision=true;
}