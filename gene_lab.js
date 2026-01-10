import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DragControls } from 'three/addons/controls/DragControls.js';

export class GeneLab {
    constructor(container) {
        this.container = container || document.body;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });

        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.container.appendChild(this.renderer.domElement);

        this.camera.position.z = 25;

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(5, 5, 5);
        this.scene.add(directionalLight);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;

        this.draggableObjects = [];
        this.connections = [];
        this.gravity = 0.0;
        this.friction = 0.99;
        this.iterations = 5;

        this.dragControls = new DragControls(this.draggableObjects, this.camera, this.renderer.domElement);

        this.dragControls.addEventListener('drag', (event) => {
            const object = event.object;
            object.userData.oldX = object.position.x;
            object.userData.oldY = object.position.y;
            object.userData.oldZ = object.position.z;
        });

        this.dragControls.addEventListener('dragstart', (event) => {
            this.controls.enabled = false;
            event.object.userData.pinned = true;
        });

        this.dragControls.addEventListener('dragend', (event) => {
            this.controls.enabled = true;
            event.object.userData.pinned = false;
        });

        this.animate();

        window.addEventListener('resize', () => this.onWindowResize());
    }

    addBall(x = 0, y = 0, z = 0, color) {
        const geometry = new THREE.SphereGeometry(1, 32, 32);
        const material = new THREE.MeshStandardMaterial({ color: color });
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.set(x, y, z);
        sphere.userData.oldX = x;
        sphere.userData.oldY = y;
        sphere.userData.oldZ = z;
        sphere.userData.pinned = false;
        this.scene.add(sphere);
        this.draggableObjects.push(sphere);
        return sphere;
    }

    addConnectedBall(parent) {
        const child = this.addBall(parent.position.x, parent.position.y-2, parent.position.z, parent.material.color);

        const dx = child.position.x - parent.position.x;
        const dy = child.position.y - parent.position.y;
        const dz = child.position.z - parent.position.z;
        const restLength = Math.sqrt(dx * dx + dy * dy + dz * dz);

        this.connections.push({
            parent: parent,
            child: child,
            restLength: restLength,
            line: null
        });

        return child;
    }

    addStickBall(parent) {
        const child = this.addBall(parent.position.x, parent.position.y-5, parent.position.z, parent.material.color);

        const dx = child.position.x - parent.position.x;
        const dy = child.position.y - parent.position.y;
        const dz = child.position.z - parent.position.z;
        const restLength = Math.sqrt(dx * dx + dy * dy + dz * dz);

        const material = new THREE.LineBasicMaterial({ color: 0xffffff });
        const points = [
            new THREE.Vector3(parent.position.x, parent.position.y, parent.position.z),
            new THREE.Vector3(child.position.x, child.position.y, child.position.z)
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, material);
        this.scene.add(line);

        this.connections.push({
            parent: parent,
            child: child,
            restLength: restLength,
            line: line
        });

        return child;
    }

    updatePhysics() {
        for (let ball of this.draggableObjects) {
            if (!ball.userData.pinned) {
                const velocityX = (ball.position.x - ball.userData.oldX) * this.friction;
                const velocityY = (ball.position.y - ball.userData.oldY) * this.friction;
                const velocityZ = (ball.position.z - ball.userData.oldZ) * this.friction;

                ball.userData.oldX = ball.position.x;
                ball.userData.oldY = ball.position.y;
                ball.userData.oldZ = ball.position.z;

                ball.position.x += velocityX;
                ball.position.y += velocityY - this.gravity;
                ball.position.z += velocityZ;
            }
        }

        for (let i = 0; i < this.iterations; i++) {
            this.applyConstraints();
            this.applyBallCollisions();
        }

        this.updateLines();
    }

    applyConstraints() {
        for (let connection of this.connections) {
            const parent = connection.parent;
            const child = connection.child;
            const restLength = connection.restLength;

            const dx = child.position.x - parent.position.x;
            const dy = child.position.y - parent.position.y;
            const dz = child.position.z - parent.position.z;
            let dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (dist === 0) {
                dist = 0.0001;
            }

            const difference = restLength - dist;
            const percent = difference / dist / 2;
            const offsetX = dx * percent;
            const offsetY = dy * percent;
            const offsetZ = dz * percent;

            if (!parent.userData.pinned) {
                parent.position.x -= offsetX;
                parent.position.y -= offsetY;
                parent.position.z -= offsetZ;
            }

            if (!child.userData.pinned) {
                child.position.x += offsetX;
                child.position.y += offsetY;
                child.position.z += offsetZ;
            }
        }
    }

    applyBallCollisions() {
        const ballRadius = 1;
        const minDistance = ballRadius * 2;

        for (let i = 0; i < this.draggableObjects.length; i++) {
            for (let j = i + 1; j < this.draggableObjects.length; j++) {
                const ball1 = this.draggableObjects[i];
                const ball2 = this.draggableObjects[j];

                const dx = ball2.position.x - ball1.position.x;
                const dy = ball2.position.y - ball1.position.y;
                const dz = ball2.position.z - ball1.position.z;
                let dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

                if (dist < minDistance) {
                    if (dist === 0) {
                        dist = 0.0001;
                    }

                    const difference = minDistance - dist;
                    const percent = difference / dist / 2;
                    const offsetX = dx * percent;
                    const offsetY = dy * percent;
                    const offsetZ = dz * percent;

                    if (!ball1.userData.pinned) {
                        ball1.position.x -= offsetX;
                        ball1.position.y -= offsetY;
                        ball1.position.z -= offsetZ;
                    }

                    if (!ball2.userData.pinned) {
                        ball2.position.x += offsetX;
                        ball2.position.y += offsetY;
                        ball2.position.z += offsetZ;
                    }
                }
            }
        }
    }

    updateLines() {
        for (let connection of this.connections) {
            if (connection.line) {
                const positions = connection.line.geometry.attributes.position.array;
                positions[0] = connection.parent.position.x;
                positions[1] = connection.parent.position.y;
                positions[2] = connection.parent.position.z;
                positions[3] = connection.child.position.x;
                positions[4] = connection.child.position.y;
                positions[5] = connection.child.position.z;
                connection.line.geometry.attributes.position.needsUpdate = true;
            }
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.updatePhysics();
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}
