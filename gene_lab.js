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
        this.animations = [];

        this.popSound = new Audio('pop.wav');

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
        const material = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.3
        });
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

    popBall(x = 0, y = 0, z = 0, color) {
        const ball = this.addBall(x, y, z, color);
        ball.scale.set(0, 0, 0);

        const startTime = Date.now();
        const duration = 300;

        this.popSound.currentTime = 0;
        this.popSound.play();

        this.animations.push({
            update: () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);

                const scale = this.easeOutElastic(progress);
                ball.scale.set(scale, scale, scale);

                return progress < 1;
            }
        });

        return ball;
    }

    easeOutElastic(x) {
        const c4 = (2 * Math.PI) / 3;
        return x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
    }

    popConnectedBall(parent, delay = 0) {
        setTimeout(() => {
            const child = this.popBall(parent.position.x, parent.position.y-2, parent.position.z, parent.material.color);

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

            child.userData.popCallback?.();
        }, delay);
    }

    popStickBall(parent, delay = 0) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const child = this.popBall(parent.position.x, parent.position.y-5, parent.position.z, parent.material.color);

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

                resolve(child);
            }, delay);
        });
    }

    addChromosome(pattern, color, x = 0, y = 0, z = 0) {
        const balls = [];
        let currentBall = this.addBall(x, y, z, color);
        balls.push(currentBall);

        let i = 1;
        while (i < pattern.length) {
            if (pattern[i] === '-' && pattern[i + 1] === 'o') {
                currentBall = this.addStickBall(currentBall);
                balls.push(currentBall);
                i += 2;
            } else if (pattern[i] === 'o') {
                currentBall = this.addConnectedBall(currentBall);
                balls.push(currentBall);
                i++;
            } else {
                i++;
            }
        }

        const chromosome = {
            balls: balls,
            pattern: pattern,
            color: color
        };

        return chromosome;
    }

    async duplicateChromosome(chromosome, offsetX = 3, offsetY = 0, offsetZ = 0) {
        const newBalls = [];
        const pattern = chromosome.pattern;
        const color = chromosome.color;

        const firstBall = chromosome.balls[0];
        const newFirst = this.popBall(
            firstBall.position.x + offsetX,
            firstBall.position.y + offsetY,
            firstBall.position.z + offsetZ,
            color
        );
        newBalls.push(newFirst);

        await new Promise(resolve => setTimeout(resolve, 100));

        let currentBall = newFirst;
        let ballIndex = 1;
        let i = 1;

        while (i < pattern.length) {
            if (pattern[i] === '-' && pattern[i + 1] === 'o') {
                currentBall = await this.popStickBall(currentBall, 0);
                newBalls.push(currentBall);
                i += 2;
                ballIndex++;
            } else if (pattern[i] === 'o') {
                currentBall = await new Promise((resolve) => {
                    setTimeout(() => {
                        const child = this.popBall(
                            currentBall.position.x,
                            currentBall.position.y - 2,
                            currentBall.position.z,
                            color
                        );

                        const dx = child.position.x - currentBall.position.x;
                        const dy = child.position.y - currentBall.position.y;
                        const dz = child.position.z - currentBall.position.z;
                        const restLength = Math.sqrt(dx * dx + dy * dy + dz * dz);

                        this.connections.push({
                            parent: currentBall,
                            child: child,
                            restLength: restLength,
                            line: null
                        });

                        resolve(child);
                    }, 0);
                });
                newBalls.push(currentBall);
                i++;
                ballIndex++;
            } else {
                i++;
            }

            await new Promise(resolve => setTimeout(resolve, 100));
        }

        return {
            balls: newBalls,
            pattern: pattern,
            color: color
        };
    }

    async formTetrad(chromo1, chromo2, spacing = 0.5, duration = 2000) {
        const startTime = Date.now();

        const initialPositions1 = chromo1.balls.map(ball => ({
            x: ball.position.x,
            y: ball.position.y,
            z: ball.position.z
        }));

        const initialPositions2 = chromo2.balls.map(ball => ({
            x: ball.position.x,
            y: ball.position.y,
            z: ball.position.z
        }));

        const centerX = (initialPositions1[0].x + initialPositions2[0].x) / 2;

        chromo1.balls.forEach(ball => ball.userData.pinned = true);
        chromo2.balls.forEach(ball => ball.userData.pinned = true);

        return new Promise((resolve) => {
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const eased = this.easeInOutCubic(progress);

                chromo1.balls.forEach((ball, i) => {
                    const initial = initialPositions1[i];
                    const targetX = centerX - spacing;
                    ball.position.x = initial.x + (targetX - initial.x) * eased;
                    ball.userData.oldX = ball.position.x;
                });

                chromo2.balls.forEach((ball, i) => {
                    const initial = initialPositions2[i];
                    const targetX = centerX + spacing;
                    ball.position.x = initial.x + (targetX - initial.x) * eased;
                    ball.userData.oldX = ball.position.x;
                });

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    chromo1.balls.forEach(ball => ball.userData.pinned = false);
                    chromo2.balls.forEach(ball => ball.userData.pinned = false);
                    resolve();
                }
            };

            animate();
        });
    }

    easeInOutCubic(x) {
        return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    }

    async formTetrad4(chromo1, chromo2, chromo3, chromo4, spacing = 0.5, duration = 2000) {
        const startTime = Date.now();

        const initialPositions1 = chromo1.balls.map(ball => ({
            x: ball.position.x,
            y: ball.position.y,
            z: ball.position.z
        }));

        const initialPositions2 = chromo2.balls.map(ball => ({
            x: ball.position.x,
            y: ball.position.y,
            z: ball.position.z
        }));

        const initialPositions3 = chromo3.balls.map(ball => ({
            x: ball.position.x,
            y: ball.position.y,
            z: ball.position.z
        }));

        const initialPositions4 = chromo4.balls.map(ball => ({
            x: ball.position.x,
            y: ball.position.y,
            z: ball.position.z
        }));

        const centerX = (initialPositions1[0].x + initialPositions2[0].x + initialPositions3[0].x + initialPositions4[0].x) / 4;
        const centerY = (initialPositions1[0].y + initialPositions2[0].y + initialPositions3[0].y + initialPositions4[0].y) / 4;

        chromo1.balls.forEach(ball => ball.userData.pinned = true);
        chromo2.balls.forEach(ball => ball.userData.pinned = true);
        chromo3.balls.forEach(ball => ball.userData.pinned = true);
        chromo4.balls.forEach(ball => ball.userData.pinned = true);

        return new Promise((resolve) => {
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const eased = this.easeInOutCubic(progress);

                chromo1.balls.forEach((ball, i) => {
                    const initial = initialPositions1[i];
                    const targetX = centerX - spacing * 1.5;
                    const targetY = centerY + spacing;
                    ball.position.x = initial.x + (targetX - initial.x) * eased;
                    ball.position.y = initial.y + (targetY - initial.y) * eased;
                    ball.userData.oldX = ball.position.x;
                    ball.userData.oldY = ball.position.y;
                });

                chromo2.balls.forEach((ball, i) => {
                    const initial = initialPositions2[i];
                    const targetX = centerX - spacing * 0.5;
                    const targetY = centerY + spacing;
                    ball.position.x = initial.x + (targetX - initial.x) * eased;
                    ball.position.y = initial.y + (targetY - initial.y) * eased;
                    ball.userData.oldX = ball.position.x;
                    ball.userData.oldY = ball.position.y;
                });

                chromo3.balls.forEach((ball, i) => {
                    const initial = initialPositions3[i];
                    const targetX = centerX + spacing * 0.5;
                    const targetY = centerY - spacing;
                    ball.position.x = initial.x + (targetX - initial.x) * eased;
                    ball.position.y = initial.y + (targetY - initial.y) * eased;
                    ball.userData.oldX = ball.position.x;
                    ball.userData.oldY = ball.position.y;
                });

                chromo4.balls.forEach((ball, i) => {
                    const initial = initialPositions4[i];
                    const targetX = centerX + spacing * 1.5;
                    const targetY = centerY - spacing;
                    ball.position.x = initial.x + (targetX - initial.x) * eased;
                    ball.position.y = initial.y + (targetY - initial.y) * eased;
                    ball.userData.oldX = ball.position.x;
                    ball.userData.oldY = ball.position.y;
                });

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    chromo1.balls.forEach(ball => ball.userData.pinned = false);
                    chromo2.balls.forEach(ball => ball.userData.pinned = false);
                    chromo3.balls.forEach(ball => ball.userData.pinned = false);
                    chromo4.balls.forEach(ball => ball.userData.pinned = false);
                    resolve();
                }
            };

            animate();
        });
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

        for (let i = this.animations.length - 1; i >= 0; i--) {
            const stillRunning = this.animations[i].update();
            if (!stillRunning) {
                this.animations.splice(i, 1);
            }
        }

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
