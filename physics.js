import * as RAPIER from 'rapier';
import * as THREE from 'three';

let world;
let characterBody;
let rapierLoaded = false;
let ramps = []; // Array to store ramp data for visualization
let walls = [];
let platforms = [];

export async function initPhysics() {
    if (!rapierLoaded) {
        await RAPIER.init();
        rapierLoaded = true;
    }

    world = new RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 });
    ramps = []; // Reset ramps array

    // Ground Collider with moderate friction
    let groundBodyDesc = RAPIER.RigidBodyDesc.fixed();
    let groundBody = world.createRigidBody(groundBodyDesc);
    let groundColliderDesc = RAPIER.ColliderDesc.cuboid(100, 0.1, 100)
        .setFriction(0.5);
    world.createCollider(groundColliderDesc, groundBody);

    // Outer Walls with restitution
    createWall({ x: 0, y: 2.5, z: 100 }, { x: 100, y: 2.5, z: 0.5 }, 0.3, 'wall');
    createWall({ x: 0, y: 2.5, z: -100 }, { x: 100, y: 2.5, z: 0.5 }, 0.3, 'wall');
    createWall({ x: 100, y: 2.5, z: 0 }, { x: 0.5, y: 2.5, z: 100 }, 0.3, 'wall');
    createWall({ x: -100, y: 2.5, z: 0 }, { x: 0.5, y: 2.5, z: 100 }, 0.3, 'wall');


    // Ramp with low friction and slight restitution
    function createRamp(position, dimensions, rotation, restitution = 0.1) {
        const rampColliderDesc = RAPIER.ColliderDesc.cuboid(dimensions.x, dimensions.y, dimensions.z)
            .setTranslation(position.x, position.y, position.z)
            .setRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w })
            .setFriction(0.01)
            .setRestitution(restitution);
        const collider = world.createCollider(rampColliderDesc);

        // Store ramp data for visualization
        ramps.push({
            position: { x: position.x, y: position.y, z: position.z },
            dimensions: { x: dimensions.x * 2, y: dimensions.y * 2, z: dimensions.z * 2 }, // Full extents for Three.js
            rotation: { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w }
        });

        return collider;
    }

    const rampAngle = Math.asin(4 / 30);
    const rampHeight = 0;
    const rampLength = 44.5;
    const rampBase = Math.sqrt(30 * 30 - 20 * 20);
    const rampWidth = 7;
    const rampThickness = 0.1;
    
    // **Inner Platform 1 Group: Rotation Variables**
    const rotation_001 = {
        w: Math.cos(rampAngle / 2),
        x: -Math.sin(rampAngle / 2),
        y: 0,
        z: 0
    };
    const rotation_002 = {
        w: Math.cos(rampAngle / 2),
        x: 0,
        y: 0,
        z: -Math.sin(rampAngle / 2)
    };
    
    // **Inner Platform 1 Group: Level 1 Ramp 1 (South)**
    createRamp(
        { x: -31.5, y: rampHeight / 2, z: 35.5 },
        { x: rampWidth/2, y: rampThickness / 2, z: rampLength / 2 },
        rotation_001,
        0.1
    );

    // **Inner Platform 1 Group: Level 1 Ramp 2 (West)**
    createRamp(
        { x: -35.5, y: rampHeight / 2, z: 31.5 },
        { x: rampLength/2, y: rampThickness / 2, z: rampWidth/2 },
        rotation_002,
        0.1
    );

    // Character with moderate friction and restitution
    let characterBodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(30, 0.25, 0)
        .setAdditionalMass(1.0)
        .setLinearDamping(0.0) // previously 0.05
        .setAngularDamping(0.1);
    characterBody = world.createRigidBody(characterBodyDesc);
    characterBody.userData = { type: 'character' };  // Add type identifier
    let characterColliderDesc = RAPIER.ColliderDesc.cuboid(0.5, 0.25, 1)
        .setFriction(0.5)
        .setRestitution(0.3)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);  // Enable collision events
    world.createCollider(characterColliderDesc, characterBody);
}


function createWall(position, size, restitution = 0.3, type) {
    let wallDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z);
    let wallBody = world.createRigidBody(wallDesc);
    wallBody.userData = { type }; // Identify as a wall
    let wallColliderDesc = RAPIER.ColliderDesc.cuboid(size.x, size.y, size.z)
        .setRestitution(restitution)
        .setCollisionGroups(0x00010001)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    const collider =  world.createCollider(wallColliderDesc, wallBody);

    walls.push({
        position: { x: position.x, y: position.y, z: position.z },
        sizes: { x: size.x * 2, y: size.y * 2, z: size.z * 2 },
    });

    return collider;
}

function createPlatform(position, size, restitution = 0.3, type) {
    let platformDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z);
    let platformBody = world.createRigidBody(platformDesc);
    platformBody.userData = { type }; // Identify as a wall
    const platformColliderDesc = RAPIER.ColliderDesc.cuboid(size.x, size.y, size.z)
        .setFriction(0.5)
        .setRestitution(restitution)
        .setCollisionGroups(0x00010001)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    const collider = world.createCollider(platformColliderDesc, platformBody);

    platforms.push({
        position: { x: position.x, y: position.y, z: position.z },
        sizes: { x: size.x * 2, y: size.y * 2, z: size.z * 2 },
    });

    return collider;
}


export function updatePhysics(delta, keys, eventQueue, spheres, sphereBodies) {
    if (!rapierLoaded || !characterBody) return { position: { x: 30, y: 0.25, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, displaySpeed: 0 };

    const maxSpeed = 30;
    const turnSpeed = 1;
    const acceleration = 30;
    const friction = 5;

    // Get current velocity
    let currentVel = characterBody.linvel();

    // Get character's forward direction
    const quat = characterBody.rotation();
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(new THREE.Quaternion(quat.x, quat.y, quat.z, quat.w));

    // Project current velocity onto forward direction to get signed speed
    let speed = forward.dot(new THREE.Vector3(currentVel.x, 0, currentVel.z));

    // Input handling
    if (keys.w) {
        speed += acceleration * delta;
        if (speed > maxSpeed) speed = maxSpeed;
    } else if (keys.s) {
        speed -= acceleration * delta;
        if (speed < -maxSpeed) speed = -maxSpeed;
    } else {
        if (speed > 0) {
            speed -= friction * delta;
            if (speed < 0) speed = 0;
        } else if (speed < 0) {
            speed += friction * delta;
            if (speed > 0) speed = 0;
        }
    }

    // Set velocity along forward direction
    const velocityVector = forward.multiplyScalar(speed);
    characterBody.setLinvel({ x: velocityVector.x, y: currentVel.y, z: velocityVector.z }, true);

    // Handle turning
    let angularVelocity = { x: 0, y: 0, z: 0 };
    if (keys.a) angularVelocity.y = turnSpeed * (keys.w || keys.s ? 1.5 : 0.5);
    else if (keys.d) angularVelocity.y = -turnSpeed * (keys.w || keys.s ? 1.5 : 0.5);
    characterBody.setAngvel(angularVelocity, true);

    // Step the physics world with event queue
    world.step(eventQueue);

    if (eventQueue) {
        eventQueue.drainCollisionEvents((handle1, handle2) => {
            const collider1 = world.getCollider(handle1);
            const collider2 = world.getCollider(handle2);
            const body1 = collider1.parent();
            const body2 = collider2.parent();
            // console.log('Collision detected:', body1.userData, body2.userData); // Debug log
            if (body1.userData && body2.userData) {
                // handle Collisions

                console.log("Body1: ", body1.userData)
                console.log("Body2: ", body2.userData)
           
            }
        });
    }

    // Update return values with spheres to remove
    currentVel = characterBody.linvel();
    const displaySpeed = Math.sqrt(currentVel.x * currentVel.x + currentVel.z * currentVel.z);
    const position = characterBody.translation();
    const rotation = characterBody.rotation();
    return { 
        position, 
        rotation, 
        displaySpeed, 
        velocity: { x: currentVel.x, y: currentVel.y, z: currentVel.z }, // Add velocity 
        ramps,
        walls,
        platforms
    };
}

export { world };